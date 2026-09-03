const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'accounting.db');
let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subtype TEXT NOT NULL,
      description TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      is_bank INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      account_id INTEGER,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      account_id INTEGER,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference TEXT DEFAULT '',
      date TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      account_id INTEGER NOT NULL,
      linked_type TEXT,
      linked_id INTEGER,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      reference TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      FOREIGN KEY (journal_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);

  seedIfEmpty();
  save();
  return db;
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const id = queryOne('SELECT last_insert_rowid() as id').id;
  save();
  return id;
}

function runNoSave(sql, params = []) {
  db.run(sql, params);
}

function seedIfEmpty() {
  const count = queryOne('SELECT COUNT(*) as c FROM accounts');
  if (count.c > 0) return;

  const accounts = [
    ['1000', 'Cash and Cash Equivalents', 'Asset', 'Bank', 1],
    ['1010', 'Checking Account', 'Asset', 'Bank', 1],
    ['1020', 'Savings Account', 'Asset', 'Bank', 1],
    ['1100', 'Accounts Receivable', 'Asset', 'Receivable', 0],
    ['1200', 'Inventory', 'Asset', 'Inventory', 0],
    ['1500', 'Fixed Assets', 'Asset', 'Fixed Asset', 0],
    ['2000', 'Accounts Payable', 'Liability', 'Payable', 0],
    ['2100', 'Credit Card', 'Liability', 'Credit Card', 0],
    ['2200', 'Sales Tax Payable', 'Liability', 'Tax', 0],
    ['3000', "Owner's Equity", 'Equity', 'Equity', 0],
    ['3100', 'Retained Earnings', 'Equity', 'Retained Earnings', 0],
    ['4000', 'Sales', 'Revenue', 'Sales', 0],
    ['4100', 'Service Income', 'Revenue', 'Service', 0],
    ['5000', 'Cost of Goods Sold', 'Expense', 'COGS', 0],
    ['6000', 'Rent Expense', 'Expense', 'Rent', 0],
    ['6100', 'Utilities Expense', 'Expense', 'Utilities', 0],
    ['6200', 'Salaries Expense', 'Expense', 'Payroll', 0],
    ['6300', 'Office Supplies', 'Expense', 'Supplies', 0],
    ['6400', 'Depreciation Expense', 'Expense', 'Depreciation', 0],
    ['6500', 'Purchases Tax', 'Expense', 'Tax', 0],
  ];

  for (const [code, name, type, subtype, is_bank] of accounts) {
    runNoSave(
      'INSERT INTO accounts (code, name, type, subtype, is_bank) VALUES (?, ?, ?, ?, ?)',
      [code, name, type, subtype, is_bank]
    );
  }
}

module.exports = { initDB, queryAll, queryOne, run, save };
