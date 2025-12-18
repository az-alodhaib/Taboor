// =============================================
// STEP 1: Import Required Packages
// =============================================
// Think of these as tools we need to build our server

const express = require('express');            // Framework to build web server
const sqlite3 = require('sqlite3').verbose();  // Database to store user data
const bcrypt = require('bcrypt');              // Tool to encrypt passwords
const cors = require('cors');                  // Allow frontend to talk to backend
const bodyParser = require('body-parser');     // Tool to read data from forms
const path = require("path");

// =============================================
// STEP 2: Create the Application
// =============================================
// Create our server application
const app = express();

// Set the port number where server will run
const PORT = 3000;

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


// self-note: serve frontend files (HTML/CSS/JS)
const FRONTEND_DIR = path.join(__dirname, "forntend");
app.use(express.static(FRONTEND_DIR));

// self-note: open index.html when visiting the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// self-note: keep the JSON test endpoint but move it away from "/"
app.get("/health", (req, res) => {
  res.json({ message: "Taboor Server is Running!" });
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

//  historical_data
db.run(`
  CREATE TABLE IF NOT EXISTS historical_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,  -- references businesses table
    arrival_time DATETIME,
    queue_length INTEGER,
    service_type TEXT,
    service_details TEXT,
    wait_time INTEGER,  -- actual wait time
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id)
  )
`, (err) => {
  if (err) console.error('Error creating historical_data table:', err.message);
  else     console.log('Historical Data table ready');
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


// =============================================
// STEP 5: API Routes (Endpoints)
// =============================================
// Routes = URLs that frontend can call to do actions

// ---------------------------------------------
// Route 1: Test Route - Check if server works
// URL: http://localhost:3000/
// Method: GET
// ---------------------------------------------
app.get('/', (req, res) => {
  res.json({ message: 'Taboor Server is Running!' });
});

// ---------------------------------------------
// Route 2: Register New User
// URL: http://localhost:3000/register
// Method: POST
// Data needed: name, email, phone, password
// ---------------------------------------------
app.post('/register', async (req, res) => {
  console.log(req.body);
  // Get data from the form
  const { name, email, phone, password } = req.body;

  // Check if all fields are provided
  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'يرجى ملء جميع الحقول المطلوبة'
    });
  }

  try {
    // Encrypt the password for security
    // Number 10 means how strong the encryption is
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into database
    const query = `INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)`;

    db.run(query, [name, email, phone, hashedPassword], function (err) {
      if (err) {
        // If email already exists, show error
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({
            error: 'البريد الإلكتروني مستخدم بالفعل'
          });
        }
        return res.status(500).json({ error: 'خطأ في التسجيل' });
      }

      // Success! Return user ID
      res.status(201).json({
        message: 'تم إنشاء الحساب بنجاح',
        userId: this.lastID
      });
    });

  } catch (error) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

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

    // Check if password matches
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // Success! Login approved
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
  const {
    name,
    email,
    password,
    category,
    address,
    latitude,
    longitude,
    phone
  } = req.body;

  // simple required fields check
  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Business name, email, and password are required'
    });
  }

  try {
    // hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await runSQL(
      `INSERT INTO businesses (
         name,
         email,
         password,
         category,
         address,
         latitude,
         longitude,
         phone,
         is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name,
        email,
        hashedPassword,
        category,
        address,
        latitude,
        longitude,
        phone
      ]
    );

    return res.status(201).json({
      message: 'Business created (pending)',
      business_id: result.lastID
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create business' });
  }
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

    // compare password
    const match = await bcrypt.compare(password, business.password);
    if (!match) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // map is_active to status
    let status;
    if (business.is_active === 1) status = 'approved';
    else if (business.is_active === 0) status = 'pending';
    else if (business.is_active === -1) status = 'rejected';
    else status = 'unknown';

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
// Add a service for a business as "pending" (is_active = 0).
app.post('/services', async (req, res) => {
  const { business_id, name, description, duration_minutes, price } = req.body;
  if (!business_id || !name) return res.status(400).json({ error: 'business_id and name are required' });

  try {
    const result = await runSQL(
      `INSERT INTO services (business_id, name, description, duration_minutes, price, is_active)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [business_id, name, description, duration_minutes || 15, price || 0]
    );

    const service = await getSQL(`SELECT * FROM services WHERE id = ?`, [result.lastID]);

    res.status(201).json({ message: 'Service created (pending)', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create service' });
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
// Mark business as rejected (is_active = -1).
app.patch('/admin/businesses/:id/reject', async (req, res) => {
  const id = req.params.id;

  try {
    await runSQL(
      `UPDATE businesses SET is_active = -1 WHERE id = ?`,
      [id]
    );

    const business = await getSQL(
      `SELECT * FROM businesses WHERE id = ?`,
      [id]
    );

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ message: 'Business rejected', business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject business' });
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
  const { business_id, arrival_time, queue_length, service_type, service_details, wait_time } = req.body;
  if (!business_id || !arrival_time || !queue_length) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const result = await runSQL(
      `INSERT INTO historical_data (business_id, arrival_time, queue_length, service_type, service_details, wait_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [business_id, arrival_time, queue_length, service_type, service_details, wait_time]
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
