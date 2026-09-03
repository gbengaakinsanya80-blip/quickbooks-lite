const router = require('express').Router();
const { queryAll, queryOne, run } = require('../database');

// Write a check / record an expense: credit bank account, debit expense account(s)
// Direct expense posting — does not require a vendor or bill.
router.post('/', (req, res) => {
  const { date, description, account_id, items, reference, notes } = req.body;
  if (!date || !account_id || !items?.length) {
    return res.status(400).json({ error: 'date, account_id, items are required' });
  }

  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  // Post a journal entry so it's traceable and date-filterable
  const jId = run(
    'INSERT INTO journal_entries (date, description, reference) VALUES (?, ?, ?)',
    [date, description || 'Expense/Check', reference || 'CHECK']
  );

  for (const it of items) {
    const acctId = it.account_id || queryOne("SELECT id FROM accounts WHERE code = '6000'").id;
    run(
      'INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
      [jId, acctId, it.amount, 0]
    );
    // Debit expense account (increase balance for asset/expense types)
    run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [it.amount, acctId]);
  }

  // Credit bank account
  run(
    'INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
    [jId, account_id, 0, total]
  );
  run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [total, account_id]);

  res.json({ id: jId, total });
});

module.exports = router;