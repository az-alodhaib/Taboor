// =============================================
// STEP 1: Import Required Packages
// =============================================
// Think of these as tools we need to build our server

const express = require('express');            // Framework to build web server
const sqlite3 = require('sqlite3').verbose();  // Database to store user data
const bcrypt = require('bcrypt');              // Tool to encrypt passwords
const cors = require('cors');                  // Allow frontend to talk to backend
const bodyParser = require('body-parser');     // Tool to read data from forms
const path = require("path"); // self-note: path helper for HTML serving
const session = require("express-session"); // self-note: server-side login memory
const crypto = require("crypto");
const nodemailer = require("nodemailer");


// ML service base URL (single source of truth)
const ML_URL = process.env.ML_URL || "https://taboor-ml.onrender.com";


// =============================================
// STEP 2: Create the Application
// =============================================
// Create our server application
const app = express();

// Set the port number where server will run
const PORT = process.env.PORT || 3000;


// =============================================
// STEP 3: Setup Middleware
// =============================================
// Middleware = tools that process requests before they reach our code

// Allow frontend (HTML pages) to communicate with backend
app.use(cors());

// Allow server to read JSON data from requests
app.use(bodyParser.json());
app.use(express.json());

// Allow server to read form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true })); // optional for forms


// self-note: sessions (server remembers logged-in user/business/admin)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "taboor-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);

//define frontend folder
const FRONTEND_DIR = path.join(__dirname, "frontend");

// self-note: block direct access to private HTML files
app.get(
  ["/home_page.html", "/business_dashboard.html", "/admin.html"],
  (req, res, next) => {
    if (req.path === "/admin.html") {
      if (!req.session.isAdmin) return res.redirect("/index.html");
      return next();
    }

    if (req.path === "/business_dashboard.html") {
      if (!req.session.businessId) return res.redirect("/businesses_index.html");
      return next();
    }

    // customer private page
    if (!req.session.userId) return res.redirect("/index.html");
    next();
  }
);

// self-note: serve static files
app.use(express.static(FRONTEND_DIR));

// here we will add protected routes
app.get("/home", requireCustomer, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "home_page.html"));
});

app.get("/business/dashboard", requireBusiness, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "business_dashboard.html"));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "admin.html"));
});


// ==========================
// Business types (single source of truth)
// ==========================
const BUSINESS_TYPES = [
  { value: "barber", label: "صالون حلاقة" },
  { value: "carwash", label: "غسيل سيارات" },
  { value: "shop", label: "متجر" },
  { value: "cafe", label: "مقهى" },
  { value: "restaurant", label: "مطعم" },
  { value: "clinic", label: "عيادة" }
];

// Meta endpoint for admin dropdown
app.get("/meta/business-types", (req, res) => {
  res.json({ businessTypes: BUSINESS_TYPES });
});

// =============================================
// STEP 4: Setup Database
// =============================================
// Create/Open database file named 'taboor.db'
const db = new sqlite3.Database('./taboor.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create users table if it doesn't exist
// This table will store: id, name, email, phone, password
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    email_verified INTEGER DEFAULT 0,
    email_verify_token TEXT,
    email_verify_expires INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    console.log('Users table ready');
  }
});


// STEP DATABASE
// ===== New DB tables: businesses / services / queues / queue_members =====
// Simple schema for providers, their services, queues, and queue members.
db.run(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,               -- business name
    email TEXT UNIQUE NOT NULL,       -- business login email
    password TEXT NOT NULL,           -- business hashed password
    category TEXT,                    -- e.g. Barber, Car Wash
    address TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    email_verified INTEGER DEFAULT 0,
    email_verify_token TEXT,
    email_verify_expires INTEGER,
    is_active INTEGER NOT NULL DEFAULT 0
        CHECK (is_active IN (-1,0,1)), -- 0=pending,1=approved,-1=rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('Error creating businesses table:', err.message);
  else     console.log('Businesses table ready with email + password');
});

// STEP DATABASE
db.run(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL, -- service belongs to a business
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 15, -- average time per service
    price REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  )
`, (err) => {
  if (err) console.error('Error creating services table:', err.message);
  else     console.log('Services table ready');
});

// STEP DATABASE
db.run(`
  CREATE TABLE IF NOT EXISTS queues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL, -- queue for a business
    service_id INTEGER,           -- optional: queue for a specific service
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paused','closed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id),
    FOREIGN KEY (service_id)  REFERENCES services(id)
  )
`, (err) => {
  if (err) console.error('Error creating queues table:', err.message);
  else     console.log('Queues table ready');
});

// STEP DATABASE
db.run(`
  CREATE TABLE IF NOT EXISTS queue_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL,    -- which queue
    user_id INTEGER NOT NULL,     -- who joined
    ticket_number INTEGER NOT NULL, -- unique number per queue
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','called','skipped','done','left')),
    note TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(queue_id, ticket_number),
    FOREIGN KEY (queue_id) REFERENCES queues(id),
    FOREIGN KEY (user_id)  REFERENCES users(id)
  )
`, (err) => {
  if (err) console.error('Error creating queue_members table:', err.message);
  else     console.log('Queue Members table ready');
});

//  appointments
db.run(`
  CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,  -- references businesses table
    arrival_time DATETIME,
    queue_length INTEGER,
    service_type TEXT,
    service_details TEXT,
    predicted_wait INTEGER,  -- predicted wait time from ML model
    actual_wait INTEGER,    -- to be filled later
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  )
`, (err) => {
  if (err) console.error('Error creating appointments table:', err.message);
  else     console.log('Appointments table ready');
});

// historical_data
db.run(`
  CREATE TABLE IF NOT EXISTS historical_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    arrival_time DATETIME,
    queue_length INTEGER,
    service_type TEXT,
    service_details TEXT,
    wait_time INTEGER,          -- total wait (queue + service)
    service_duration INTEGER,   -- ADD THIS: actual service time only
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  )
`, (err) => {
  if (err) console.error('Error creating historical_data table:', err.message);
  else console.log('Historical Data table ready with service_duration');
});

// STEP DATABASE
// ---- Small DB helpers (Promise wrappers)
// Use these to run SQL with .then/await and get lastID/rows easily.
function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });
}

// STEP DATABASE
function getSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

// STEP DATABASE
function allSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function safeAddColumn(table, colDef) {
  return new Promise((resolve) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`, [], () => resolve());
  });
}


  // =============================================
  // DB MIGRATION (SAFE, AFTER TABLES EXIST)
  // =============================================
  // self-note: SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so ignore errors
  (async () => {
    try {
      await safeAddColumn("users", "email_verified INTEGER DEFAULT 0");
      await safeAddColumn("users", "email_verify_token TEXT");
      await safeAddColumn("users", "email_verify_expires INTEGER");

      await safeAddColumn("businesses", "email_verified INTEGER DEFAULT 0");
      await safeAddColumn("businesses", "email_verify_token TEXT");
      await safeAddColumn("businesses", "email_verify_expires INTEGER");

      console.log("DB migration done");
    }   catch (e) {
      console.error("DB migration error:", e);
    }
  })();


// =============================================
// GLOBAL UNIQUENESS HELPERS (users + businesses)
// =============================================

async function isEmailTaken(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;

  const u = await getSQL(`SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`, [e]);
  if (u) return true;

  const b = await getSQL(`SELECT id FROM businesses WHERE LOWER(email) = ? LIMIT 1`, [e]);
  return !!b;
}

async function isPhoneTaken(phone) {
  const p = String(phone || "").trim();
  if (!p) return false;

  const u = await getSQL(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [p]);
  if (u) return true;

  const b = await getSQL(`SELECT id FROM businesses WHERE phone = ? LIMIT 1`, [p]);
  return !!b;
}

// ===============================
// Email verification helpers
// ===============================

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || "true") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000
});

const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER;

// self-note: 24h token
function makeVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}
function makeVerifyExpiresMs(hours = 24) {
  return Date.now() + hours * 60 * 60 * 1000;
}

async function sendVerifyEmail(to, verifyUrl, kind) {
  const subject = "Taboor - Verify your email";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Email Verification</h2>
      <p>You created a ${kind} account in Taboor.</p>
      <p>Click this link to verify your email (expires in 24 hours):</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    </div>
  `;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html
  });
}

//--------------------------------------

// self-note: server-side guards (real protection)
function requireCustomer(req, res, next) {
  if (!req.session.userId) return res.redirect("/index.html");
  next();
}

function requireBusiness(req, res, next) {
  if (!req.session.businessId) return res.redirect("/businesses_index.html");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect("/index.html");
  next();
}

// =============================================
// STEP 5: API Routes (Endpoints)
// =============================================
// Routes = URLs that frontend can call to do actions

// ---------------------------------------------
// Route 1: Test Route - Check if server works
// URL: http://localhost:3000/
// Method: GET
// ---------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ message: "Taboor Server is Running!" });
});


// ---------------------------------------------
// Route 2: Register New User
// URL: http://localhost:3000/register
// Method: POST
// Data needed: name, email, phone, password
// ---------------------------------------------
app.post('/register', async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const phone = String(req.body?.phone || "").trim();
  const password = String(req.body?.password || "");

  // required fields
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
  }

  // password rule
  if (password.length < 8) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف أو أكثر" });
  }

  try {
    // GLOBAL uniqueness: email
    if (await isEmailTaken(email)) {
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    }

    // GLOBAL uniqueness: phone (only if provided)
    if (phone && await isPhoneTaken(phone)) {
      return res.status(400).json({ error: "رقم الجوال مستخدم بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // self-note: create verify token for this new user
    const verifyToken = makeVerifyToken();
    const verifyExpires = makeVerifyExpiresMs(24);

    // IMPORTANT: use the NEW insert that includes verification fields
    const result = await runSQL(
      `INSERT INTO users
       (name, email, phone, password, email_verified, email_verify_token, email_verify_expires)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [name, email, phone || null, hashedPassword, verifyToken, verifyExpires]
    );

    // self-note: send verification email (account can exist even if email fails)
    try {
      const verifyUrl = `${BASE_URL}/verify/user?token=${verifyToken}`;
      await sendVerifyEmail(email, verifyUrl, "user");
    } catch (mailErr) {
      console.error("Email send failed:", mailErr);
    }

    return res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح. تم إرسال رابط التحقق إلى بريدك الإلكتروني.',
      userId: result.lastID
    });

  } catch (err) {
    console.error(err);

    if (String(err.message || "").includes("UNIQUE")) {
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    }

    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});



//--------------------------------------------------
//for admin login(Will be added later)
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body || {};

  // self-note: demo credentials (change later)
  if (email === "admin@taboor.com" && password === "aziz1") {
    req.session.isAdmin = true;
    return res.json({ message: "Admin logged in" });
  }

  res.status(401).json({ error: "Unauthorized" });
});

app.use("/admin", requireAdmin);


// ---------------------------------------------
// Route 3: Login User
// URL: http://localhost:3000/login
// Method: POST
// Data needed: email, password
// ---------------------------------------------
app.post('/login', (req, res) => {
  // Get email and password from form
  const { email, password } = req.body;

  // Check if both fields are provided
  if (!email || !password) {
    return res.status(400).json({
      error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
    });
  }

  // Find user in database by email
  const query = `SELECT * FROM users WHERE email = ?`;

  db.get(query, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }

    // If user not found
    if (!user) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    if (user.email_verified !== 1) {
      return res.status(403).json({ error: "يرجى تفعيل البريد الإلكتروني أولاً" });
    }  

    // Check if password matches
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // Success! Login approved
    req.session.userId = user.id; // self-note: customer session

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  });
});

// ---------------------------------------------
// Route 4: Get All Users (for testing)
// URL: http://localhost:3000/users
// Method: GET
// ---------------------------------------------
app.get('/users', (req, res) => {
  const query = `SELECT id, name, email, phone, created_at FROM users`;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
    res.json({ users: rows });
  });
});


// ====================================================================
// Business / Service / Queue Management 
// ====================================================================

// STEP DATABASE
// ---------- Businesses ----------

// BUSINESS REGISTER – uses businesses.email + businesses.password
app.post('/business/register', async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const category = req.body?.category ?? null;
  const address = req.body?.address ?? null;
  const latitude = req.body?.latitude ?? null;
  const longitude = req.body?.longitude ?? null;

  const phone = String(req.body?.phone || "").trim();

  // required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Business name, email, and password are required'
    });
  }

  // password rule
  if (password.length < 8) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف أو أكثر" });
  }

  try {
    // GLOBAL uniqueness: email
    if (await isEmailTaken(email)) {
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    }

    // GLOBAL uniqueness: phone (only if provided)
    if (phone && await isPhoneTaken(phone)) {
      return res.status(400).json({ error: "رقم الجوال مستخدم بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // self-note: create verify token for this business
    const verifyToken = makeVerifyToken();
    const verifyExpires = makeVerifyExpiresMs(24);

    // IMPORTANT: insert verification fields
    const result = await runSQL(
      `INSERT INTO businesses (
         name, email, password, category, address, latitude, longitude, phone, is_active,
         email_verified, email_verify_token, email_verify_expires
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        name,
        email,
        hashedPassword,
        category,
        address,
        latitude,
        longitude,
        phone || null,
        verifyToken,
        verifyExpires
      ]
    );

    // self-note: send verification email
    // self-note: fire-and-forget email so registration never hangs
      const verifyUrl = `${BASE_URL}/verify/business?token=${verifyToken}`;

      sendVerifyEmail(email, verifyUrl, "business")
      .then(() => console.log("Verify email sent to:", email))
      .catch((e) => console.error("Email send failed:", e));


    return res.status(201).json({
      message: 'Business created (pending). Verification email sent.',
      business_id: result.lastID
    });
  } catch (err) {
    console.error(err);

    if (String(err.message || "").includes("UNIQUE")) {
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    }

    return res.status(500).json({ error: 'Failed to create business' });
  }
});
  
//verify route
  app.get("/verify/business", async (req, res) => {
  const token = String(req.query?.token || "");
  if (!token) return res.status(400).send("Missing token");

  const b = await getSQL(
    `SELECT id FROM businesses WHERE email_verify_token = ? AND email_verify_expires > ?`,
    [token, Date.now()]
  );

  if (!b) return res.status(400).send("Invalid/expired token");

  await runSQL(
    `UPDATE businesses
     SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL
     WHERE id = ?`,
    [b.id]
  );

  return res.send("تم توثيق حسابك, يمكنك تسجيل الدخول الان");
  });


// BUSINESS LOGIN – checks email + password from businesses table
app.post('/business/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
    });
  }

  try {
    // find business by email
    const business = await getSQL(
      `SELECT * FROM businesses WHERE email = ?`,
      [email]
    );

    if (!business) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    if (business.email_verified !== 1) {
        return res.status(403).json({ error: "يرجى تفعيل البريد الإلكتروني أولاً" });
    }

    // compare password
    const match = await bcrypt.compare(password, business.password);
    if (!match) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // map is_active to status
    let status;
    if (business.is_active === 1) status = "approved";
    else if (business.is_active === 0) status = "pending";
    else if (business.is_active === -1) status = "rejected";
    else status = "unknown";

    // self-note: only approved businesses get a server session
    if (status === "approved") {
    req.session.businessId = business.id;
    }

    // self-note: always return status so UI can show pending/rejected
    return res.json({
      status,
      business: {
         id: business.id,
        name: business.name,
        email: business.email,
        category: business.category,
        is_active: business.is_active
    }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});




// STEP DATABASE
// GET /businesses
// List active businesses.
app.get('/businesses', async (_req, res) => {
  try {
    const rows = await allSQL(`SELECT * FROM businesses WHERE is_active = 1 ORDER BY created_at DESC`);
    res.json({ businesses: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// STEP DATABASE
// ---------- Services ----------

// POST /services
// Create service request (pending) for logged-in business only
app.post('/services', requireBusiness, async (req, res) => {
  const { name, description, duration_minutes, price } = req.body || {};

  // IMPORTANT: business_id comes from session, not frontend
  const business_id = req.session.businessId;

  if (!business_id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Service name is required" });
  }

  try {
    const result = await runSQL(
      `INSERT INTO services 
       (business_id, name, description, duration_minutes, price, is_active)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        business_id,
        name.trim(),
        description || null,
        Number(duration_minutes || 15),
        Number(price || 0)
      ]
    );

    const service = await getSQL(
      `SELECT * FROM services WHERE id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: "Service request sent (pending approval)",
      service
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create service" });
  }
});




// GET /businesses/:businessId/services
// List services for one business.
// If ?all=1 is passed, include pending ones (is_active any).
app.get('/businesses/:businessId/services', async (req, res) => {
  const businessId = req.params.businessId;
  const includeAll = req.query.all === '1';

  try {
    let rows;

    if (includeAll) {
      rows = await allSQL(
        `SELECT * FROM services WHERE business_id = ? ORDER BY id DESC`,
        [businessId]
      );
    } else {
      rows = await allSQL(
        `SELECT * FROM services WHERE business_id = ? AND is_active = 1 ORDER BY id DESC`,
        [businessId]
      );
    }

    res.json({ services: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});


// STEP DATABASE
// ---------- Queues ----------

// POST /queues
// Create a queue (for a business, optional service_id).
app.post('/queues', async (req, res) => {
  const { business_id, service_id } = req.body;
  if (!business_id) return res.status(400).json({ error: 'business_id is required' });

  try {
    const result = await runSQL(
      `INSERT INTO queues (business_id, service_id, status) VALUES (?, ?, 'open')`,
      [business_id, service_id || null]
    );
    const queue = await getSQL(`SELECT * FROM queues WHERE id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Queue created', queue });
  } catch {
    res.status(500).json({ error: 'Failed to create queue' });
  }
});

// STEP DATABASE
// GET /businesses/:businessId/queues
// List queues of one business (with service name if set).
app.get('/businesses/:businessId/queues', async (req, res) => {
  try {
    const rows = await allSQL(`
      SELECT q.*, s.name AS service_name
      FROM queues q
      LEFT JOIN services s ON s.id = q.service_id
      WHERE q.business_id = ?
      ORDER BY q.updated_at DESC
    `, [req.params.businessId]);
    res.json({ queues: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// STEP DATABASE
// PATCH /queues/:queueId/status
// Update queue status. Allowed: open | paused | closed.
app.patch('/queues/:queueId/status', async (req, res) => {
  const { status } = req.body;
  if (!['open','paused','closed'].includes(status))
    return res.status(400).json({ error: 'Invalid status. Use open|paused|closed' });

  try {
    await runSQL(`UPDATE queues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, req.params.queueId]);
    const queue = await getSQL(`SELECT * FROM queues WHERE id = ?`, [req.params.queueId]);
    res.json({ message: 'Queue status updated', queue });
  } catch {
    res.status(500).json({ error: 'Failed to update status' });
  }
});


// =============================================
// ML Prediction Endpoint
// =============================================
app.post('/predict-wait', async (req, res) => {
  const business_id = req.body?.business_id;
  const arrival_time = req.body?.arrival_time;
  const queue_length = req.body?.queue_length;
  const service_type = req.body?.service_type;
  const service_details = req.body?.service_details;

  try {
    // self-note: basic input sanity (avoid Date invalid + ML schema errors)
    if (business_id === undefined || business_id === null) {
      return res.status(400).json({ error: "business_id is required" });
    }
    if (!arrival_time) {
      return res.status(400).json({ error: "arrival_time is required" });
    }
    if (queue_length === undefined || queue_length === null) {
      return res.status(400).json({ error: "queue_length is required" });
    }

    // self-note: normalize service strings (ML expects strings even if empty)
    const st = String(service_type || "").trim();
    const sd = String(service_details || "").trim();

    // self-note: parse arrival_time and derive arrival_hour feature
    const arrivalDate = new Date(arrival_time);
    if (Number.isNaN(arrivalDate.getTime())) {
      return res.status(400).json({ error: "arrival_time must be a valid date string" });
    }
    const arrival_hour = arrivalDate.getHours();

    // self-note: avg service duration for this business+service combo (fallback if no history)
    const serviceAvg = await getSQL(
      `SELECT AVG(service_duration) as avg_time
       FROM historical_data
       WHERE business_id = ? AND service_type = ? AND service_details = ?`,
      [business_id, st, sd]
    );
    const avg_service_time = Number(serviceAvg?.avg_time) || 30;

    // self-note: avg service duration by arrival hour (fallback if no history)
    const hourlyAvg = await getSQL(
      `SELECT AVG(service_duration) as hourly_avg
       FROM historical_data
       WHERE business_id = ? AND strftime('%H', arrival_time) = ?`,
      [business_id, String(arrival_hour).padStart(2, "0")] // self-note: sqlite %H expects 00-23
    );
    const hourly_avg_service_time = Number(hourlyAvg?.hourly_avg) || 30;

    // self-note: FastAPI schema expects business_id as string; keep all numeric features numbers
    const payload = {
      business_id: String(business_id),
      arrival_hour: Number(arrival_hour),
      queue_length: Number(queue_length),
      service_type: st,
      service_details: sd,
      avg_service_time: Number(avg_service_time),
      hourly_avg_service_time: Number(hourly_avg_service_time)
    };

    // self-note: call ML service (Node acts as feature-builder + validator)
    const response = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // self-note: handle non-200 responses from ML (422/500/etc)
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ML error ${response.status}: ${text || "unknown"}`);
    }

    let result = {};
    const text = await response.text();
    try { result = JSON.parse(text); } catch { result = { error: text }; }


    // self-note: support both possible ML response keys (depending on your FastAPI output)
    const predicted =
      Number(result.predicted_wait_minutes ?? result.predicted_wait ?? result.minutes);

    if (!Number.isFinite(predicted)) {
      throw new Error("ML response missing predicted_wait_minutes");
    }

    // self-note: store prediction request + output for later training/audit
    const insertResult = await runSQL(
      `INSERT INTO appointments
       (business_id, arrival_time, queue_length, service_type, service_details, predicted_wait)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [business_id, arrival_time, queue_length, st, sd, predicted]
    );

    // self-note: return prediction to frontend so UI can show it immediately
    return res.json({
      predicted_wait_minutes: predicted,
      appointment_id: insertResult.lastID
    });

  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: error.message });
  }
});


// STEP DATABASE
// ---------- Queue Members ----------

// Helper: get next ticket number inside this queue
async function getNextTicketNumber(queue_id) {
  const row = await getSQL(`SELECT MAX(ticket_number) AS max_no FROM queue_members WHERE queue_id = ?`, [queue_id]);
  return (row && row.max_no ? row.max_no : 0) + 1;
}

// STEP DATABASE
// POST /queues/:queueId/join
// Join queue. Required: user_id. Returns ticket_number + position.
app.post('/queues/:queueId/join', async (req, res) => {
  const { user_id, note } = req.body;
  const queueId = req.params.queueId;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const queue = await getSQL(`SELECT * FROM queues WHERE id = ?`, [queueId]);
    if (!queue) return res.status(404).json({ error: 'Queue not found' });
    if (queue.status !== 'open') return res.status(400).json({ error: 'Queue is not open' });

    const ticket = await getNextTicketNumber(queueId);
    const ins = await runSQL(
      `INSERT INTO queue_members (queue_id, user_id, ticket_number, note) VALUES (?, ?, ?, ?)`,
      [queueId, user_id, ticket, note || null]
    );
    const me = await getSQL(`SELECT * FROM queue_members WHERE id = ?`, [ins.lastID]);

    const ahead = await getSQL(
      `SELECT COUNT(*) AS ahead
       FROM queue_members
       WHERE queue_id = ? AND status IN ('waiting','called') AND id < ?`,
      [queueId, me.id]
    );


    res.status(201).json({
      message: 'Joined queue successfully',
      ticket_number: ticket,
      position: (ahead ? ahead.ahead : 0) + 1
    });
  } catch {
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// STEP DATABASE
// GET /queues/:queueId/position?user_id=123
// Get my position in queue (latest waiting ticket for this user).
app.get('/queues/:queueId/position', async (req, res) => {
  const { user_id } = req.query;
  const queueId = req.params.queueId;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const me = await getSQL(
      `SELECT * FROM queue_members
       WHERE queue_id = ? AND user_id = ? AND status = 'waiting'
       ORDER BY id DESC LIMIT 1`,
      [queueId, user_id]
    );
    if (!me) return res.status(404).json({ error: 'No active ticket for this user in this queue' });

    const ahead = await getSQL(
      `SELECT COUNT(*) AS ahead
       FROM queue_members
       WHERE queue_id = ? AND status = 'waiting' AND id < ?`,
      [queueId, me.id]
    );

    res.json({
      member_id: me.id,
      ticket_number: me.ticket_number,
      status: me.status,
      position: (ahead ? ahead.ahead : 0) + 1
    });

  } catch {
    res.status(500).json({ error: 'Failed to get position' });
  }
});

// STEP ETA/WAIT
// GET /queues/:queueId/user-status?user_id=123
// Returns: my position + wait time (people ahead * service duration) + business coords (for ETA travel time).
app.get('/queues/:queueId/user-status', async (req, res) => {
  const queueId = req.params.queueId;
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    // self-note: fetch queue + business + service duration
    const queue = await getSQL(
      `SELECT q.*,
              b.name AS business_name,
              b.latitude  AS business_latitude,
              b.longitude AS business_longitude,
              s.duration_minutes AS service_duration_minutes
       FROM queues q
       JOIN businesses b ON b.id = q.business_id
       LEFT JOIN services s ON s.id = q.service_id
       WHERE q.id = ?`,
      [queueId]
    );

    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    // self-note: get my latest active ticket (waiting or called)
    const me = await getSQL(
      `SELECT * FROM queue_members
       WHERE queue_id = ? AND user_id = ? AND status IN ('waiting','called')
       ORDER BY id DESC LIMIT 1`,
      [queueId, user_id]
     );

    if (!me) {
      return res.status(404).json({ error: 'No active ticket for this user in this queue' });
    }

    // self-note: count people ahead of me in line (waiting + called) using ticket id ordering
    const aheadRow = await getSQL(
      `SELECT COUNT(*) AS ahead
       FROM queue_members
       WHERE queue_id = ?
         AND status IN ('waiting','called')
         AND id < ?`,
      [queueId, me.id]
    );

    const ahead = Number(aheadRow?.ahead || 0);

    //  If there is no service duration, return an error
    if (!queue.service_duration_minutes) {
      return res.status(400).json({
          error: 'Service duration is not defined for this queue'
      });
    }

    const baseMinutes = Number(queue.service_duration_minutes);


    const waitMinutes = ahead * baseMinutes;

    // self-note: total people currently blocking line (waiting + called)
    const totals = await getSQL(
      `SELECT
         SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) AS waiting,
         SUM(CASE WHEN status='called'  THEN 1 ELSE 0 END) AS called
       FROM queue_members
       WHERE queue_id = ?`,
      [queueId]
    );

    const peopleInLine = Number(totals?.waiting || 0) + Number(totals?.called || 0);

    res.json({
      ticket_number: me.ticket_number,
      status: me.status,
      position: ahead + 1,
      wait_minutes: waitMinutes,
      service_duration_minutes: baseMinutes,
      people_in_line: peopleInLine,
      business: {
        id: queue.business_id,
        name: queue.business_name,
        latitude: queue.business_latitude,
        longitude: queue.business_longitude
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get user status' });
  }
});


// STEP DATABASE
// POST /queues/:queueId/leave
// Leave queue: mark latest waiting/called ticket as 'left'.
app.post('/queues/:queueId/leave', async (req, res) => {
  const { user_id } = req.body;
  const queueId = req.params.queueId;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const row = await getSQL(
      `SELECT * FROM queue_members
       WHERE queue_id = ? AND user_id = ? AND status IN ('waiting','called')
       ORDER BY id DESC LIMIT 1`,
      [queueId, user_id]
    );
    if (!row) return res.status(404).json({ error: 'No active ticket to leave' });

    await runSQL(`UPDATE queue_members SET status = 'left', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
    res.json({ message: 'Left the queue successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});


// STEP DATABASE
// POST /queues/:queueId/next
// Dashboard helper: call next waiting -> 'called'.
app.post('/queues/:queueId/next', async (req, res) => {
  try {
    const next = await getSQL(
      `SELECT * FROM queue_members WHERE queue_id = ? AND status = 'waiting' ORDER BY id ASC LIMIT 1`,
      [req.params.queueId]
    );
    if (!next) return res.json({ message: 'No one is waiting' });

    await runSQL(`UPDATE queue_members SET status = 'called', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [next.id]);
    res.json({ message: 'Next customer called', ticket_number: next.ticket_number, user_id: next.user_id });
  } catch {
    res.status(500).json({ error: 'Failed to call next' });
  }
});

// STEP DATABASE
// GET /queues/:queueId/overview
// Simple dashboard summary: queue info + counts + ETA.
app.get('/queues/:queueId/overview', async (req, res) => {
  const queueId = req.params.queueId;
  try {
    const queue = await getSQL(
      `SELECT q.*, b.name AS business_name, s.name AS service_name
       FROM queues q
       JOIN businesses b ON b.id = q.business_id
       LEFT JOIN services s ON s.id = q.service_id
       WHERE q.id = ?`,
      [queueId]
    );
    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    const stats = await getSQL(
      `SELECT
         SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) AS waiting,
         SUM(CASE WHEN status='called'  THEN 1 ELSE 0 END) AS called,
         SUM(CASE WHEN status='done'    THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) AS skipped,
         SUM(CASE WHEN status='left'    THEN 1 ELSE 0 END) AS left
       FROM queue_members WHERE queue_id = ?`,
      [queueId]
    );

    // ETA: waiting count * service duration (or 10 if no service)
    const baseMinutes = queue.service_id
      ? (await getSQL(`SELECT duration_minutes FROM services WHERE id = ?`, [queue.service_id]))?.duration_minutes || 10
      : 10;

        // self-note: "wait time" = time until a NEW customer starts service.
    // self-note: include 'called' because the current serving customer still blocks the queue.
    // self-note: later: replace this with SUM of each member's selected service duration (needs storing service per member).
    const waitingCount = Number(stats?.waiting || 0);
    const calledCount  = Number(stats?.called  || 0);
    const peopleInLine = waitingCount + calledCount;

    res.json({
      queue,
      stats,
      estimated_wait_minutes: peopleInLine * baseMinutes
    });

  } catch {
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

// STEP DATABASE
// GET /queues/:queueId/members
// Returns all members in this queue with their user names.
app.get('/queues/:queueId/members', async (req, res) => {
  const queueId = req.params.queueId;
  try {
    const members = await allSQL(
      `SELECT qm.id,
              qm.ticket_number,
              qm.user_id,
              qm.status,
              qm.joined_at,
              u.name AS user_name
       FROM queue_members qm
       JOIN users u ON u.id = qm.user_id
       WHERE qm.queue_id = ?
       ORDER BY qm.ticket_number ASC`,
      [queueId]
    );

    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queue members' });
  }
});

// STEP DATABASE
// PATCH /queue_members/:id/status
// Update status of a specific ticket (waiting/called/skipped/done/left).
app.patch('/queue_members/:id/status', async (req, res) => {
  const memberId = req.params.id;
  const { status } = req.body;

  const allowed = ['waiting', 'called', 'skipped', 'done', 'left'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    await runSQL(
      `UPDATE queue_members
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, memberId]
    );

    const member = await getSQL(
      `SELECT * FROM queue_members WHERE id = ?`,
      [memberId]
    );

    res.json({ message: 'Status updated', member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member status' });
  }
});

// =====================================================
// Admin: manage business approval
// =====================================================

// GET /admin/businesses?status=pending|approved
// List businesses by status.
app.get('/admin/businesses', async (req, res) => {
  const status = req.query.status || 'pending';
  let isActive;

  if (status === 'approved') {
    isActive = 1;
  } else {
    // default: pending
    isActive = 0;
  }

  try {
    const rows = await allSQL(
      `SELECT * FROM businesses WHERE is_active = ? ORDER BY created_at DESC`,
      [isActive]
    );
    res.json({ businesses: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch admin businesses' });
  }
});

// PATCH /admin/businesses/:id/approve
// Mark business as approved (is_active = 1).
  app.patch('/admin/businesses/:id/approve', async (req, res) => {
    const id = req.params.id;
    const { category } = req.body || {};

    try {
      if (category && category.trim() !== "") {
       const allowed = BUSINESS_TYPES.some(t => t.value === category);
        if (!allowed) return res.status(400).json({ error: "Invalid business category" });

        await runSQL(`UPDATE businesses SET is_active = 1, category = ? WHERE id = ?`, [category, id]);
      }   else {
      await runSQL(`UPDATE businesses SET is_active = 1 WHERE id = ?`, [id]);
      }

      const business = await getSQL(`SELECT * FROM businesses WHERE id = ?`, [id]);
      if (!business) return res.status(404).json({ error: 'Business not found' });

      res.json({ message: 'Business approved', business });
    }   catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to approve business' });
    }
  });

// PATCH /admin/businesses/:id/reject
// self-note: rejection = delete business + all dependent rows so they can reapply
app.patch('/admin/businesses/:id/reject', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const business = await getSQL(`SELECT * FROM businesses WHERE id = ?`, [id]);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // self-note: delete children first (avoid FK issues)
    await runSQL(`DELETE FROM queue_members WHERE business_id = ?`, [id]).catch(() => {});
    await runSQL(`DELETE FROM queues WHERE business_id = ?`, [id]).catch(() => {});
    await runSQL(`DELETE FROM services WHERE business_id = ?`, [id]).catch(() => {});
    await runSQL(`DELETE FROM appointments WHERE business_id = ?`, [id]).catch(() => {});
    await runSQL(`DELETE FROM historical_data WHERE business_id = ?`, [id]).catch(() => {});

    // self-note: delete the business row (email becomes free again)
    await runSQL(`DELETE FROM businesses WHERE id = ?`, [id]);

    return res.json({ message: 'Business rejected and deleted', deleted_business: business });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to reject/delete business' });
  }
});



// Admin: list services by status (pending / approved)
app.get('/admin/services', async (req, res) => {
  const status = req.query.status || 'pending';
  let isActive;

  if (status === 'approved') {
    isActive = 1;
  } else {
    isActive = 0;
  }

  try {
    const rows = await allSQL(
      `SELECT s.*, b.name AS business_name
       FROM services s
       JOIN businesses b ON b.id = s.business_id
       WHERE s.is_active = ?
       ORDER BY s.created_at DESC`,
      [isActive]
    );
    res.json({ services: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch admin services' });
  }
});

// Admin: approve a service
app.patch('/admin/services/:id/approve', async (req, res) => {
  const id = req.params.id;

  try {
    await runSQL(
      `UPDATE services SET is_active = 1 WHERE id = ?`,
      [id]
    );

    const service = await getSQL(
      `SELECT * FROM services WHERE id = ?`,
      [id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ message: 'Service approved', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve service' });
  }
});

// Admin: reject a service (is_active = -1)
app.patch('/admin/services/:id/reject', async (req, res) => {
  const id = req.params.id;

  try {
    await runSQL(
      `UPDATE services SET is_active = -1 WHERE id = ?`,
      [id]
    );

    const service = await getSQL(
      `SELECT * FROM services WHERE id = ?`,
      [id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ message: 'Service rejected', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject service' });
  }
});

// ==========================
// Google Traffic ETA (Distance Matrix)
// ==========================

const GOOGLE_MAPS_API_KEY = "AIzaSyA9KhxebYlMwEFPghSqCSn8p8eq4UVAU8o";

app.post("/eta", async (req, res) => {
  const { origin, destination } = req.body || {};

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return res.status(400).json({ error: "origin/destination lat/lng required" });
  }

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });
    }

    const origins = `${origin.lat},${origin.lng}`;
    const destinations = `${destination.lat},${destination.lng}`;

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}` +
      `&mode=driving` +
      `&departure_time=now` +
      `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

    const r = await fetch(url);
    const data = await r.json();

    const el = data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") {
      return res.status(502).json({ error: "Google ETA failed", details: data });
    }

    res.json({
      distanceMeters: el.distance?.value ?? null,
      durationSeconds: el.duration?.value ?? null,
      durationInTrafficSeconds: el.duration_in_traffic?.value ?? null,
      durationText: el.duration?.text ?? null,
      durationInTrafficText: el.duration_in_traffic?.text ?? null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "ETA server error" });
  }
});
// ===============================
// Verify email endpoints
// ===============================

app.get("/verify/user", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).send("Missing token");

  try {
    const user = await getSQL(
      `SELECT id, email_verify_expires FROM users WHERE email_verify_token = ?`,
      [token]
    );
    if (!user) return res.status(400).send("Invalid token");

    if (!user.email_verify_expires || Date.now() > Number(user.email_verify_expires)) {
      return res.status(400).send("Token expired");
    }

    await runSQL(
      `UPDATE users
       SET email_verified = 1,
           email_verify_token = NULL,
           email_verify_expires = NULL
       WHERE id = ?`,
      [user.id]
    );

    return res.send("Email verified successfully. You can login now.");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
});

app.get("/verify/business", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).send("Missing token");

  try {
    const biz = await getSQL(
      `SELECT id, email_verify_expires FROM businesses WHERE email_verify_token = ?`,
      [token]
    );
    if (!biz) return res.status(400).send("Invalid token");

    if (!biz.email_verify_expires || Date.now() > Number(biz.email_verify_expires)) {
      return res.status(400).send("Token expired");
    }

    await runSQL(
      `UPDATE businesses
       SET email_verified = 1,
           email_verify_token = NULL,
           email_verify_expires = NULL
       WHERE id = ?`,
      [biz.id]
    );

    return res.send("Business email verified successfully. If pending, wait for admin approval.");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
});

// =============================================
// STEP 6: Start the Server
// =============================================
// Make the server start listening for requests
app.listen(PORT, () => {
  console.log('=================================');
  console.log(`Taboor Server is running!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log('=================================');
});

// =============================================
// STEP 7: Handle Server Shutdown
// =============================================
// Close database connection when server stops
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});

// GET & POST appointments
app.post('/appointments', async (req, res) => {
  const { business_id, arrival_time, queue_length, service_type, service_details, predicted_wait } = req.body;
  if (!business_id || !arrival_time || !queue_length) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const result = await runSQL(
      `INSERT INTO appointments (business_id, arrival_time, queue_length, service_type, service_details, predicted_wait)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [business_id, arrival_time, queue_length, service_type, service_details, predicted_wait]
    );
    const appointment = await getSQL(`SELECT * FROM appointments WHERE appointment_id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Appointment created', appointment });
  } catch {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});


app.get('/appointments', async (_req, res) => {
  try {
    const rows = await allSQL(`SELECT * FROM appointments ORDER BY created_at DESC`);
    res.json({ appointments: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});


// GET & POST historical_data
app.post('/historical_data', async (req, res) => {
  const { business_id, arrival_time, queue_length, service_type, service_details, wait_time, service_duration } = req.body;
  if (!business_id || !arrival_time || !queue_length) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const result = await runSQL(
      `INSERT INTO historical_data 
       (business_id, arrival_time, queue_length, service_type, service_details, wait_time, service_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [business_id, arrival_time, queue_length, service_type, service_details, wait_time, service_duration || null]
    );
    const historicalData = await getSQL(`SELECT * FROM historical_data WHERE id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Historical data created', historicalData });
  } catch {
    res.status(500).json({ error: 'Failed to create historical data' });
  }
});

app.get('/historical_data', async (_req, res) => {
  try {
    const rows = await allSQL(`SELECT * FROM historical_data ORDER BY created_at DESC`);
    res.json({ historical_data: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});
