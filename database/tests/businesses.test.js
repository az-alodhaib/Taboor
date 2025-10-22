// tests/db/businesses.test.js
const { runSQL, getSQL, allSQL } = require('../../your-db-helpers');

describe('Businesses Table', () => {
  beforeAll(async () => {
    await runSQL(`
      CREATE TABLE businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        phone TEXT,
        owner_user_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  test('Insert a business', async () => {
    const res = await runSQL(
      'INSERT INTO businesses (name,category) VALUES (?,?)',
      ['BarberShop','Barber']
    );
    const biz = await getSQL('SELECT * FROM businesses WHERE id=?', [res.lastID]);
    expect(biz.name).toBe('BarberShop');
  });

  test('Get all active businesses', async () => {
    const rows = await allSQL('SELECT * FROM businesses WHERE is_active=1');
    expect(rows.length).toBeGreaterThan(0);
  });
});
