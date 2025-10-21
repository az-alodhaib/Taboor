// tests/db/queue_members.test.js
const { runSQL, getSQL } = require('../../your-db-helpers');

describe('Queue Members', () => {
  beforeAll(async () => {
    await runSQL(`
      CREATE TABLE queue_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        ticket_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting'
      )
    `);
    await runSQL('INSERT INTO queues (business_id) VALUES (1)');
  });

  test('Join queue', async () => {
    const queue = await getSQL('SELECT * FROM queues LIMIT 1');
    const ticketNumber = 1;
    const res = await runSQL(
      'INSERT INTO queue_members (queue_id,user_id,ticket_number) VALUES (?,?,?)',
      [queue.id, 1, ticketNumber]
    );
    const member = await getSQL('SELECT * FROM queue_members WHERE id=?', [res.lastID]);
    expect(member.ticket_number).toBe(ticketNumber);
  });
});
