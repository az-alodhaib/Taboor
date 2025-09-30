// =============================================
// STEP 1: Import Required Packages
// =============================================
// Think of these as tools we need to build our server

const express = require('express');        // Framework to build web server
const sqlite3 = require('sqlite3').verbose(); // Database to store user data
const bcrypt = require('bcrypt');          // Tool to encrypt passwords
const cors = require('cors');              // Allow frontend to talk to backend
const bodyParser = require('body-parser'); // Tool to read data from forms

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
        
        db.run(query, [name, email, phone, hashedPassword], function(err) {
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