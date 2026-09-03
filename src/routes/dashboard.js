const router = require('express').Router();
const { queryAll, queryOne } = require('../database');

router.get('/', (req, res) => {
  const totalAssets = queryOne("SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type='Asset'").v;
  const totalLiabilities = queryOne("SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type='Liability'").v;
  const totalEquity = queryOne("SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type='Equity'").v;
  const totalRevenue = queryOne("SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type='Revenue'").v;
  const totalExpenses = queryOne("SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type='Expense'").v;
  const netIncome = totalRevenue - totalExpenses;

  const totalAR = queryOne("SELECT COALESCE(balance,0) as v FROM accounts WHERE code='1100'").v;
  const totalAP = queryOne("SELECT COALESCE(balance,0) as v FROM accounts WHERE code='2000'").v;

  const recentInvoices = queryAll(`
    SELECT i.id, i.number, i.total, i.status, i.date, c.name as customer_name
    FROM invoices i JOIN customers c ON i.customer_id = c.id
    ORDER BY i.date DESC LIMIT 5
  `);

  const recentBills = queryAll(`
    SELECT b.id, b.number, b.total, b.status, b.date, v.name as vendor_name
    FROM bills b JOIN vendors v ON b.vendor_id = v.id
    ORDER BY b.date DESC LIMIT 5
  `);

  const overdueCount = queryOne(
    "SELECT COUNT(*) as c FROM invoices WHERE status IN ('Sent','Overdue') AND due_date < date('now')"
  ).c;

  const billsDueCount = queryOne(
    "SELECT COUNT(*) as c FROM bills WHERE status IN ('Received','Overdue') AND due_date < date('now')"
  ).c;

  const customerCount = queryOne("SELECT COUNT(*) as c FROM customers WHERE is_active=1").c;
  const vendorCount = queryOne("SELECT COUNT(*) as c FROM vendors WHERE is_active=1").c;

  res.json({
    totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpenses,
    netIncome, totalAR, totalAP, recentInvoices, recentBills,
    overdueCount, billsDueCount, customerCount, vendorCount
  });
});

module.exports = router;
