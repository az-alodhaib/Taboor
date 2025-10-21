// tests/db/queues.test.js
const { runSQL, getSQL } = require('../../your-db-helpers');

describe('Queues Table', () => {
  beforeAll(async () => {
    await runSQL(`
      CREATE TABLE queues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        service_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open'
      )
    `);
    await runSQL('INSERT INTO businesses (name) VALUES (?)', ['TestBiz']);
  });

  test('Create queue', async () => {
    const biz = await getSQL('SELECT * FROM businesses LIMIT 1');
    const res = await runSQL('INSERT INTO queues (business_id) VALUES (?)', [biz.id]);
    const queue = await getSQL('SELECT * FROM queues WHERE id=?', [res.lastID]);
    expect(queue.status).toBe('open');
  });

  test('Update queue status', async () => {
    const queue = await getSQL('SELECT * FROM queues LIMIT 1');
    await runSQL('UPDATE queues SET status=? WHERE id=?', ['paused', queue.id]);
    const updated = await getSQL('SELECT * FROM queues WHERE id=?', [queue.id]);
    expect(updated.status).toBe('paused');
  });
});
