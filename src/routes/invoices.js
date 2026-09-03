const router = require('express').Router();
const { queryAll, queryOne, run, save } = require('../database');
function generateInvoiceNumber() {
  const last = queryOne("SELECT number FROM invoices ORDER BY id DESC LIMIT 1");
  if (!last) return 'INV-0001';
  const num = parseInt(last.number.split('-')[1]) + 1;
  return 'INV-' + String(num).padStart(4, '0');
}

router.get('/', (req, res) => {
  const { status, customer_id } = req.query;
  let sql = `SELECT i.*, c.name as customer_name FROM invoices i
    JOIN customers c ON i.customer_id = c.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  if (customer_id) { sql += ' AND i.customer_id = ?'; params.push(customer_id); }
  sql += ' ORDER BY i.date DESC';
  res.json(queryAll(sql, params));
});

router.get('/:id', (req, res) => {
  const invoice = queryOne(
    `SELECT i.*, c.name as customer_name FROM invoices i
     JOIN customers c ON i.customer_id = c.id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  invoice.items = queryAll('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
  res.json(invoice);
});

router.post('/', (req, res) => {
  const { customer_id, date, due_date, items, tax_rate, notes } = req.body;
  if (!customer_id || !date || !due_date || !items?.length) {
    return res.status(400).json({ error: 'customer_id, date, due_date, items are required' });
  }

  const number = generateInvoiceNumber();
  const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
  const tax = subtotal * ((tax_rate || 0) / 100);
  const total = subtotal + tax;

  const invId = run(
    'INSERT INTO invoices (number, customer_id, date, due_date, subtotal, tax_rate, tax_amount, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [number, customer_id, date, due_date, subtotal, tax_rate || 0, tax, total, notes || '']
  );

  const salesAcct = queryOne("SELECT id FROM accounts WHERE code = '4000'");

  for (const item of items) {
    const amount = item.quantity * item.unit_price;
    run(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [invId, item.description, item.quantity, item.unit_price, amount, item.account_id || salesAcct.id]
    );
  }

  // Update customer balance
  run('UPDATE customers SET balance = balance + ? WHERE id = ?', [total, customer_id]);
  // Update A/R account
  run("UPDATE accounts SET balance = balance + ? WHERE code = '1100'", [total]);
  // Update Revenue account (subtotal only)
  run("UPDATE accounts SET balance = balance + ? WHERE code = '4000'", [subtotal]);
  // Book sales tax to Sales Tax Payable (2200)
  if (tax > 0) {
    run("UPDATE accounts SET balance = balance + ? WHERE code = '2200'", [tax]);
  }

  res.json({ id: invId, number });
});

router.put('/:id', (req, res) => {
  const { status } = req.body;
  run('UPDATE invoices SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
  run('DELETE FROM invoices WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
