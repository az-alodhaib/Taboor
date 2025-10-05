// =============================================
// STEP 1: Import Required Packages
// =============================================
// Think of these as tools we need to build our server

const express = require('express');            // Framework to build web server
const sqlite3 = require('sqlite3').verbose();  // Database to store user data
const bcrypt = require('bcrypt');              // Tool to encrypt passwords
const cors = require('cors');                  // Allow frontend to talk to backend
const bodyParser = require('body-parser');     // Tool to read data from forms

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

// Allow server to read form data
app.use(bodyParser.urlencoded({ extended: true }));

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
    name TEXT NOT NULL,           -- provider name
    category TEXT,                -- e.g. Barber, Car Wash
    address TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    owner_user_id INTEGER,        -- optional link to users.id
    is_active INTEGER DEFAULT 1,  -- 1 active, 0 inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) console.error('Error creating businesses table:', err.message);
  else     console.log('Businesses table ready');
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
// Business / Service / Queue Management (new endpoints)
// ====================================================================

// STEP DATABASE
// ---------- Businesses ----------

// POST /business/register
// Create a new business (provider). Required: name.
app.post('/business/register', async (req, res) => {
  const { name, category, address, latitude, longitude, phone, owner_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Business name is required' });

  try {
    const result = await runSQL(
      `INSERT INTO businesses (name, category, address, latitude, longitude, phone, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, category, address, latitude, longitude, phone, owner_user_id || null]
    );
    const business = await getSQL(`SELECT * FROM businesses WHERE id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Business created', business });
  } catch {
    res.status(500).json({ error: 'Failed to create business' });
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
// Add a service to a business. Required: business_id, name.
app.post('/services', async (req, res) => {
  const { business_id, name, description, duration_minutes, price } = req.body;
  if (!business_id || !name) return res.status(400).json({ error: 'business_id and name are required' });

  try {
    const result = await runSQL(
      `INSERT INTO services (business_id, name, description, duration_minutes, price)
       VALUES (?, ?, ?, ?, ?)`,
      [business_id, name, description, duration_minutes || 15, price || 0]
    );
    const service = await getSQL(`SELECT * FROM services WHERE id = ?`, [result.lastID]);
    res.status(201).json({ message: 'Service created', service });
  } catch {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// STEP DATABASE
// GET /businesses/:businessId/services
// List services for one business.
app.get('/businesses/:businessId/services', async (req, res) => {
  try {
    const rows = await allSQL(
      `SELECT * FROM services WHERE business_id = ? AND is_active = 1 ORDER BY id DESC`,
      [req.params.businessId]
    );
    res.json({ services: rows });
  } catch {
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
       WHERE queue_id = ? AND status = 'waiting' AND id < ?`,
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
      ticket_number: me.ticket_number,
      status: me.status,
      position: (ahead ? ahead.ahead : 0) + 1
    });
  } catch {
    res.status(500).json({ error: 'Failed to get position' });
  }
});

// STEP DATABASE
// POST /queues/:queueId/leave
// Leave queue: mark latest waiting ticket as 'left'.
app.post('/queues/:queueId/leave', async (req, res) => {
  const { user_id } = req.body;
  const queueId = req.params.queueId;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const row = await getSQL(
      `SELECT * FROM queue_members
       WHERE queue_id = ? AND user_id = ? AND status = 'waiting'
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

    res.json({
      queue,
      stats,
      estimated_wait_minutes: (stats?.waiting || 0) * baseMinutes
    });
  } catch {
    res.status(500).json({ error: 'Failed to get overview' });
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
