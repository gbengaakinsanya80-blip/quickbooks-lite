const router = require('express').Router();
const { queryAll, queryOne, run } = require('../database');

router.get('/', (req, res) => {
  const { type, active } = req.query;
  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (active !== undefined) { sql += ' AND is_active = ?'; params.push(active); }
  sql += ' ORDER BY code';
  res.json(queryAll(sql, params));
});

router.get('/:id', (req, res) => {
  const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

router.post('/', (req, res) => {
  const { code, name, type, subtype, description, is_bank } = req.body;
  if (!code || !name || !type || !subtype) {
    return res.status(400).json({ error: 'code, name, type, subtype are required' });
  }
  const id = run(
    'INSERT INTO accounts (code, name, type, subtype, description, is_bank) VALUES (?, ?, ?, ?, ?, ?)',
    [code, name, type, subtype, description || '', is_bank ? 1 : 0]
  );
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const { name, type, subtype, description, is_bank, is_active } = req.body;
  run(
    'UPDATE accounts SET name=?, type=?, subtype=?, description=?, is_bank=?, is_active=? WHERE id=?',
    [name, type, subtype, description || '', is_bank ? 1 : 0, is_active !== undefined ? is_active : 1, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM accounts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
