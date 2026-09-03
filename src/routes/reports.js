const router = require('express').Router();
const { queryAll, queryOne } = require('../database');

// Profit & Loss by date range using invoices (revenue) and bills (expenses)
router.get('/profit-loss', (req, res) => {
  const { start_date, end_date } = req.query;
  const hasDate = start_date && end_date;
  const params = hasDate ? [start_date, end_date] : [];

  const revRows = queryAll(
    `SELECT inc.account_id, a.code, a.name, SUM(inc.amount) as total
     FROM invoice_items inc
     JOIN invoices i ON inc.invoice_id = i.id
     JOIN accounts a ON inc.account_id = a.id
     WHERE i.status != 'Cancelled' ${hasDate ? 'AND i.date BETWEEN ? AND ?' : ''}
     GROUP BY inc.account_id ORDER BY a.code`,
    params
  );

  const expRows = queryAll(
    `SELECT bi.account_id, a.code, a.name, SUM(bi.amount) as total
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
     JOIN accounts a ON bi.account_id = a.id
     WHERE b.status != 'Cancelled' ${hasDate ? 'AND b.date BETWEEN ? AND ?' : ''}
     GROUP BY bi.account_id ORDER BY a.code`,
    params
  );

  // Also include journal-posted revenue/expense accounts
  const jrnlRev = queryAll(
    `SELECT jl.account_id, a.code, a.name, SUM(jl.debit - jl.credit) as total
     FROM journal_lines jl
     JOIN accounts a ON jl.account_id = a.id
     WHERE a.type = 'Revenue' ${hasDate ? 'AND jl.journal_id IN (SELECT id FROM journal_entries WHERE date BETWEEN ? AND ?)' : ''}
     GROUP BY jl.account_id ORDER BY a.code`,
    params
  );
  const jrnlExp = queryAll(
    `SELECT jl.account_id, a.code, a.name, SUM(jl.debit - jl.credit) as total
     FROM journal_lines jl
     JOIN accounts a ON jl.account_id = a.id
     WHERE a.type = 'Expense' ${hasDate ? 'AND jl.journal_id IN (SELECT id FROM journal_entries WHERE date BETWEEN ? AND ?)' : ''}
     GROUP BY jl.account_id ORDER BY a.code`,
    params
  );

  const revenue = queryAll("SELECT id, code, name, balance FROM accounts WHERE type='Revenue' ORDER BY code");
  const expenses = queryAll("SELECT id, code, name, balance FROM accounts WHERE type='Expense' ORDER BY code");

  const revMap = new Map(revRows.map(r => [r.account_id, r]));
  const expMap = new Map(expRows.map(r => [r.account_id, r]));
  for (const j of jrnlRev) { const v = revMap.get(j.account_id); revMap.set(j.account_id, v ? {...v, total: v.total + j.total} : j); }
  for (const j of jrnlExp) { const v = expMap.get(j.account_id); expMap.set(j.account_id, v ? {...v, total: v.total + j.total} : j); }

  const revenueReport = revenue.map(a => ({ id: a.id, code: a.code, name: a.name, balance: revMap.get(a.id)?.total || 0 }));
  const expensesReport = expenses.map(a => ({ id: a.id, code: a.code, name: a.name, balance: expMap.get(a.id)?.total || 0 }));

  const totalRevenue = revenueReport.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expensesReport.reduce((s, a) => s + a.balance, 0);

  res.json({
    revenue: revenueReport, expenses: expensesReport,
    totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses,
    start_date: start_date || null, end_date: end_date || null
  });
});

router.get('/balance-sheet', (req, res) => {
  const assets = queryAll("SELECT code, name, balance FROM accounts WHERE type='Asset' ORDER BY code");
  const liabilities = queryAll("SELECT code, name, balance FROM accounts WHERE type='Liability' ORDER BY code");
  const equity = queryAll("SELECT code, name, balance FROM accounts WHERE type='Equity' ORDER BY code");

  const revTotal = queryOne("SELECT COALESCE(SUM(balance),0) as total FROM accounts WHERE type='Revenue'").total;
  const expTotal = queryOne("SELECT COALESCE(SUM(balance),0) as total FROM accounts WHERE type='Expense'").total;
  const netIncome = revTotal - expTotal;

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0) + netIncome;

  res.json({ assets, liabilities, equity, netIncome, totalAssets, totalLiabilities, totalEquity });
});

router.get('/aged-receivables', (req, res) => {
  const results = queryAll(`
    SELECT c.id, c.name, c.balance,
      SUM(CASE WHEN i.due_date >= date('now') THEN i.total - i.amount_paid ELSE 0 END) as current,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) BETWEEN 1 AND 30 THEN i.total - i.amount_paid ELSE 0 END) as days_1_30,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) BETWEEN 31 AND 60 THEN i.total - i.amount_paid ELSE 0 END) as days_31_60,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) > 60 THEN i.total - i.amount_paid ELSE 0 END) as over_60
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status IN ('Sent','Overdue')
    GROUP BY c.id
    HAVING c.balance > 0 OR current > 0 OR days_1_30 > 0 OR days_31_60 > 0 OR over_60 > 0
    ORDER BY c.name
  `);
  res.json(results);
});

router.get('/aged-payables', (req, res) => {
  const results = queryAll(`
    SELECT v.id, v.name, v.balance,
      SUM(CASE WHEN b.due_date >= date('now') THEN b.total - b.amount_paid ELSE 0 END) as current,
      SUM(CASE WHEN julianday('now') - julianday(b.due_date) BETWEEN 1 AND 30 THEN b.total - b.amount_paid ELSE 0 END) as days_1_30,
      SUM(CASE WHEN julianday('now') - julianday(b.due_date) BETWEEN 31 AND 60 THEN b.total - b.amount_paid ELSE 0 END) as days_31_60,
      SUM(CASE WHEN julianday('now') - julianday(b.due_date) > 60 THEN b.total - b.amount_paid ELSE 0 END) as over_60
    FROM vendors v
    LEFT JOIN bills b ON v.id = b.vendor_id AND b.status IN ('Received','Overdue')
    GROUP BY v.id
    HAVING v.balance > 0 OR current > 0 OR days_1_30 > 0 OR days_31_60 > 0 OR over_60 > 0
    ORDER BY v.name
  `);
  res.json(results);
});

module.exports = router;