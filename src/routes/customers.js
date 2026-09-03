const router = require('express').Router();
const { queryAll, queryOne, run } = require('../database');

router.get('/', (req, res) => {
  res.json(queryAll('SELECT * FROM customers ORDER BY name'));
});

router.get('/:id', (req, res) => {
  const customer = queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/', (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = run(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [name, email || '', phone || '', address || '']
  );
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const { name, email, phone, address, is_active } = req.body;
  run(
    'UPDATE customers SET name=?, email=?, phone=?, address=?, is_active=? WHERE id=?',
    [name, email || '', phone || '', address || '', is_active !== undefined ? is_active : 1, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
