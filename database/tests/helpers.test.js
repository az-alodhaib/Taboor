// tests/db/helpers.test.js
const { runSQL, getNextTicketNumber } = require('../../your-db-helpers');

describe('DB Helpers', () => {
  beforeAll(async () => {
    await runSQL(`
      CREATE TABLE queue_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_id INTEGER NOT NULL,
        ticket_number INTEGER NOT NULL
      )
    `);
    await runSQL('INSERT INTO queues (business_id) VALUES (1)');
  });

  test('Next ticket number increments', async () => {
    const queueId = 1;
    await runSQL('INSERT INTO queue_members (queue_id,ticket_number) VALUES (?,?)',[queueId,1]);
    const next = await getNextTicketNumber(queueId);
    expect(next).toBe(2);
  });
});
