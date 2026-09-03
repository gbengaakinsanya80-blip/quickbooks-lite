const router = require('express').Router();
const { queryAll, run } = require('../database');

router.get('/', (req, res) => {
  const { type } = req.query;
  let sql = `SELECT p.*,
    CASE WHEN p.entity_type = 'Customer' THEN c.name ELSE v.name END as entity_name
    FROM payments p
    LEFT JOIN customers c ON p.entity_type = 'Customer' AND p.entity_id = c.id
    LEFT JOIN vendors v ON p.entity_type = 'Vendor' AND p.entity_id = v.id`;
  const params = [];
  if (type) { sql += ' WHERE p.type = ?'; params.push(type); }
  sql += ' ORDER BY p.date DESC';
  res.json(queryAll(sql, params));
});

router.post('/', (req, res) => {
  const { type, reference, date, entity_type, entity_id, amount, account_id, linked_type, linked_id, notes } = req.body;
  if (!type || !date || !entity_type || !entity_id || !amount || !account_id) {
    return res.status(400).json({ error: 'type, date, entity_type, entity_id, amount, account_id are required' });
  }

  const id = run(
    'INSERT INTO payments (type, reference, date, entity_type, entity_id, amount, account_id, linked_type, linked_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [type, reference || '', date, entity_type, entity_id, amount, account_id, linked_type || null, linked_id || null, notes || '']
  );

  if (type === 'Receive') {
    run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, account_id]);
    run("UPDATE accounts SET balance = balance - ? WHERE code = '1100'", [amount]);
    run('UPDATE customers SET balance = balance - ? WHERE id = ?', [amount, entity_id]);

    if (linked_type === 'Invoice' && linked_id) {
      run('UPDATE invoices SET amount_paid = amount_paid + ? WHERE id = ?', [amount, linked_id]);
      const inv = require('../database').queryOne('SELECT total, amount_paid + ? as new_paid FROM invoices WHERE id = ?', [amount, linked_id]);
      if (inv && inv.new_paid >= inv.total) {
        run("UPDATE invoices SET status = 'Paid' WHERE id = ?", [linked_id]);
      }
    }
  } else {
    run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, account_id]);
    run("UPDATE accounts SET balance = balance - ? WHERE code = '2000'", [amount]);
    run('UPDATE vendors SET balance = balance - ? WHERE id = ?', [amount, entity_id]);

    if (linked_type === 'Bill' && linked_id) {
      run('UPDATE bills SET amount_paid = amount_paid + ? WHERE id = ?', [amount, linked_id]);
      const bill = require('../database').queryOne('SELECT total, amount_paid + ? as new_paid FROM bills WHERE id = ?', [amount, linked_id]);
      if (bill && bill.new_paid >= bill.total) {
        run("UPDATE bills SET status = 'Paid' WHERE id = ?", [linked_id]);
      }
    }
  }

  res.json({ id });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM payments WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
