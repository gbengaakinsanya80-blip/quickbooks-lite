const express = require('express');
const path = require('path');
const { initDB } = require('./src/database');

async function main() {
  await initDB();

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api/accounts', require('./src/routes/accounts'));
  app.use('/api/customers', require('./src/routes/customers'));
  app.use('/api/vendors', require('./src/routes/vendors'));
  app.use('/api/invoices', require('./src/routes/invoices'));
  app.use('/api/bills', require('./src/routes/bills'));
  app.use('/api/payments', require('./src/routes/payments'));
  app.use('/api/journal', require('./src/routes/journal'));
  app.use('/api/reports', require('./src/routes/reports'));
  app.use('/api/dashboard', require('./src/routes/dashboard'));
  app.use('/api/expenses', require('./src/routes/expenses'));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`QuickBooks Lite running at http://localhost:${PORT}`);
  });
}

main().catch(console.error);
