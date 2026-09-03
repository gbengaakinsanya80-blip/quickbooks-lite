const router = require('express').Router();
const { queryAll, run } = require('../database');

router.get('/', (req, res) => {
  const entries = queryAll('SELECT * FROM journal_entries ORDER BY date DESC');
  for (const entry of entries) {
    entry.lines = queryAll(
      `SELECT jl.*, a.name as account_name, a.code as account_code
       FROM journal_lines jl JOIN accounts a ON jl.account_id = a.id
       WHERE jl.journal_id = ?`,
      [entry.id]
    );
  }
  res.json(entries);
});

router.post('/', (req, res) => {
  const { date, description, reference, lines } = req.body;
  if (!date || !description || !lines?.length) {
    return res.status(400).json({ error: 'date, description, lines are required' });
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: 'Debits must equal credits' });
  }

  const jId = run(
    'INSERT INTO journal_entries (date, description, reference) VALUES (?, ?, ?)',
    [date, description, reference || '']
  );

  for (const line of lines) {
    run(
      'INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
      [jId, line.account_id, line.debit || 0, line.credit || 0]
    );

    const { queryOne } = require('../database');
    if (line.debit) {
      const acct = queryOne('SELECT type FROM accounts WHERE id = ?', [line.account_id]);
      if (['Asset', 'Expense'].includes(acct.type)) {
        run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [line.debit, line.account_id]);
      } else {
        run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [line.debit, line.account_id]);
      }
    }
    if (line.credit) {
      const acct = queryOne('SELECT type FROM accounts WHERE id = ?', [line.account_id]);
      if (['Asset', 'Expense'].includes(acct.type)) {
        run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [line.credit, line.account_id]);
      } else {
        run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [line.credit, line.account_id]);
      }
    }
  }

  res.json({ id: jId });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM journal_lines WHERE journal_id = ?', [req.params.id]);
  run('DELETE FROM journal_entries WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
