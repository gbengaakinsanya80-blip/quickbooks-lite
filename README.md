# QuickBooks Lite

A simple, web-based accounting system inspired by QuickBooks. Fully responsive and works on desktop and Android phones.

## Features

- Dashboard with financial summary (assets, liabilities, net income, A/R)
- Chart of Accounts (Asset, Liability, Equity, Revenue, Expense)
- Customers & Vendors with running balances
- Invoices & Bills (line items, tax, statuses, auto-numbering)
- Payments (receive/pay, linked to invoices/bills)
- Write Check / Expense quick entry
- Journal entries (validated double-entry, debit = credit)
- Reports: Profit & Loss (date-filterable), Balance Sheet, A/R Aging, A/P Aging
- Printable/PDF invoice view

## Run Locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Deploy to Render (free)

### Option A: One-click with render.yaml

1. Push this repo to GitHub
2. In Render dashboard: **New → Blueprint**
3. Select this repo — Render auto-detects `render.yaml`
4. Click **Apply**

### Option B: Manual Web Service

1. Push this repo to GitHub
2. In Render dashboard: **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Click **Create Web Service**

> **Note:** On Render's free tier, the SQLite database (ephemeral disk) resets when the service restarts or redeploys. For persistent data, add a **Persistent Disk** (paid plans) by mounting `/var/data` and setting the DB path.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQL.js (WASM SQLite — no native compilation needed)
- **Frontend:** Vanilla JS, responsive CSS

## Access from Android phone (local)

Both devices on the same Wi-Fi:
1. `npm start`
2. Get your PC's IP: `ipconfig` (e.g. `192.168.1.10`)
3. Phone browser: `http://192.168.1.10:3000`
