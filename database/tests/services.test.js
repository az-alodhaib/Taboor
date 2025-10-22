// tests/db/services.test.js
const { runSQL, getSQL, allSQL } = require('../../your-db-helpers');

describe('Services Table', () => {
  beforeAll(async () => {
    await runSQL(`
      CREATE TABLE services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER DEFAULT 15,
        price REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runSQL('INSERT INTO businesses (name) VALUES (?)', ['TestBiz']);
  });

  test('Insert a service', async () => {
    const biz = await getSQL('SELECT * FROM businesses LIMIT 1');
    const res = await runSQL(
      'INSERT INTO services (business_id,name) VALUES (?,?)',
      [biz.id,'Haircut']
    );
    const svc = await getSQL('SELECT * FROM services WHERE id=?', [res.lastID]);
    expect(svc.name).toBe('Haircut');
  });
});
