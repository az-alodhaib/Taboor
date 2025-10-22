// tests/db/users.test.js
const sqlite3 = require('sqlite3').verbose();
const { runSQL, getSQL } = require('../../your-db-helpers'); // adjust path

describe('Users Table', () => {
  let db;

  beforeAll(() => {
    db = new sqlite3.Database(':memory:'); // in-memory DB for testing
    return runSQL(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  test('Insert a new user', async () => {
    const result = await runSQL(
      'INSERT INTO users (name,email,phone,password) VALUES (?,?,?,?)',
      ['Alice','alice@test.com','123','pass']
    );
    expect(result.lastID).toBeGreaterThan(0);

    const user = await getSQL('SELECT * FROM users WHERE email=?', ['alice@test.com']);
    expect(user.name).toBe('Alice');
  });

  test('Unique email constraint', async () => {
    await expect(runSQL(
      'INSERT INTO users (name,email,phone,password) VALUES (?,?,?,?)',
      ['Bob','alice@test.com','456','pass']
    )).rejects.toThrow();
  });
});
