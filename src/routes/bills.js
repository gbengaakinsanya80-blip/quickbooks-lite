const router = require('express').Router();
const { queryAll, queryOne, run } = require('../database');
function generateBillNumber() {
  const last = queryOne("SELECT number FROM bills ORDER BY id DESC LIMIT 1");
  if (!last) return 'BILL-0001';
  const num = parseInt(last.number.split('-')[1]) + 1;
  return 'BILL-' + String(num).padStart(4, '0');
}

router.get('/', (req, res) => {
  const { status, vendor_id } = req.query;
  let sql = `SELECT b.*, v.name as vendor_name FROM bills b
    JOIN vendors v ON b.vendor_id = v.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND b.status = ?'; params.push(status); }
  if (vendor_id) { sql += ' AND b.vendor_id = ?'; params.push(vendor_id); }
  sql += ' ORDER BY b.date DESC';
  res.json(queryAll(sql, params));
});

router.get('/:id', (req, res) => {
  const bill = queryOne(
    `SELECT b.*, v.name as vendor_name FROM bills b
     JOIN vendors v ON b.vendor_id = v.id WHERE b.id = ?`,
    [req.params.id]
  );
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  bill.items = queryAll('SELECT * FROM bill_items WHERE bill_id = ?', [req.params.id]);
  res.json(bill);
});

router.post('/', (req, res) => {
  const { vendor_id, date, due_date, items, tax_rate, notes } = req.body;
  if (!vendor_id || !date || !due_date || !items?.length) {
    return res.status(400).json({ error: 'vendor_id, date, due_date, items are required' });
  }

  const number = generateBillNumber();
  const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
  const tax = subtotal * ((tax_rate || 0) / 100);
  const total = subtotal + tax;

  const billId = run(
    'INSERT INTO bills (number, vendor_id, date, due_date, subtotal, tax_rate, tax_amount, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [number, vendor_id, date, due_date, subtotal, tax_rate || 0, tax, total, notes || '']
  );

  const cogsAcct = queryOne("SELECT id FROM accounts WHERE code = '5000'");

  for (const item of items) {
    const amount = item.quantity * item.unit_price;
    run(
      'INSERT INTO bill_items (bill_id, description, quantity, unit_price, amount, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [billId, item.description, item.quantity, item.unit_price, amount, item.account_id || cogsAcct.id]
    );
  }

  // Book tax as a separate line to Purchases Tax expense account
  if (tax > 0) {
    const taxAcct = queryOne("SELECT id FROM accounts WHERE code = '6500'");
    run(
      'INSERT INTO bill_items (bill_id, description, quantity, unit_price, amount, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [billId, 'Sales Tax', 1, tax, tax, taxAcct.id]
    );
  }

  // Update vendor balance
  run('UPDATE vendors SET balance = balance + ? WHERE id = ?', [total, vendor_id]);
  // Update A/P account (full total including tax)
  run("UPDATE accounts SET balance = balance + ? WHERE code = '2000'", [total]);
  // Update Expense accounts from bill_items (each item posts to its account)
  for (const item of items) {
    run("UPDATE accounts SET balance = balance + ? WHERE id = ?", [item.quantity * item.unit_price, item.account_id || cogsAcct.id]);
  }
  if (tax > 0) {
    const taxAcct = queryOne("SELECT id FROM accounts WHERE code = '6500'");
    run("UPDATE accounts SET balance = balance + ? WHERE id = ?", [tax, taxAcct.id]);
  }

  res.json({ id: billId, number });
});

router.put('/:id', (req, res) => {
  const { status } = req.body;
  run('UPDATE bills SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);
  run('DELETE FROM bills WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
