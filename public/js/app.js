const API = (path, opts) => fetch('/api' + path, {
  headers: { 'Content-Type': 'application/json' },
  ...opts,
  body: opts?.body ? JSON.stringify(opts.body) : undefined,
}).then(r => r.json());

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const html = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content; };

function showModal(title, bodyHtml) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-overlay').classList.remove('hidden');
}
function closeModal() { $('#modal-overlay').classList.add('hidden'); }

function badge(status) {
  const cls = { Draft:'draft', Sent:'sent', Received:'received', Paid:'paid', Overdue:'overdue', Cancelled:'cancelled' };
  return `<span class="badge badge-${cls[status]||'draft'}">${status}</span>`;
}

let currentPage = 'dashboard';
const pages = {};

function openSidebar() { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('show'); }

function navigate(page) {
  currentPage = page;
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  closeSidebar();
  if (pages[page]) pages[page]();
}

function wideTable(inner) {
  return `<div class="table-wrap"><table>${inner}</table></div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.nav-link').forEach(l => l.addEventListener('click', e => { e.preventDefault(); navigate(l.dataset.page); }));
  $('#menu-btn').addEventListener('click', openSidebar);
  navigate('dashboard');
});

/* =================== DASHBOARD =================== */
pages.dashboard = async () => {
  const d = await API('/dashboard');
  $('#page-container').innerHTML = `
    <h2 style="margin-bottom:20px">Dashboard</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Assets</div><div class="value">${fmt(d.totalAssets)}</div></div>
      <div class="stat-card warning"><div class="label">Total Liabilities</div><div class="value">${fmt(d.totalLiabilities)}</div></div>
      <div class="stat-card info"><div class="label">Net Income</div><div class="value ${d.netIncome >= 0 ? 'text-success' : 'text-danger'}">${fmt(d.netIncome)}</div></div>
      <div class="stat-card"><div class="label">Accounts Receivable</div><div class="value">${fmt(d.totalAR)}</div></div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div class="card-header"><h3>Recent Invoices</h3></div>
        ${d.recentInvoices.length ? wideTable(`
          <thead><tr><th>#</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>${d.recentInvoices.map(i => `<tr><td>${i.number}</td><td>${i.customer_name}</td><td>${fmt(i.total)}</td><td>${badge(i.status)}</td></tr>`).join('')}</tbody>
        `) : '<div class="empty-state"><p>No invoices yet</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><h3>Recent Bills</h3></div>
        ${d.recentBills.length ? wideTable(`
          <thead><tr><th>#</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>${d.recentBills.map(b => `<tr><td>${b.number}</td><td>${b.vendor_name}</td><td>${fmt(b.total)}</td><td>${badge(b.status)}</td></tr>`).join('')}</tbody>
        `) : '<div class="empty-state"><p>No bills yet</p></div>'}
      </div>
    </div>
    <div class="stat-grid" style="margin-top:20px;">
      <div class="stat-card danger"><div class="label">Overdue Invoices</div><div class="value">${d.overdueCount}</div></div>
      <div class="stat-card warning"><div class="label">Bills Due</div><div class="value">${d.billsDueCount}</div></div>
      <div class="stat-card info"><div class="label">Customers</div><div class="value">${d.customerCount}</div></div>
      <div class="stat-card"><div class="label">Vendors</div><div class="value">${d.vendorCount}</div></div>
    </div>`;
};

/* =================== CHART OF ACCOUNTS =================== */
pages.accounts = async () => {
  const accounts = await API('/accounts');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Chart of Accounts</h2>
      <button class="btn btn-primary" onclick="showAccountForm()">+ New Account</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Subtype</th><th class="text-right">Balance</th><th></th></tr></thead>
        <tbody>${accounts.map(a => `<tr>
          <td><strong>${a.code}</strong></td><td>${a.name}</td><td>${a.type}</td><td>${a.subtype}</td>
          <td class="text-right ${a.balance >= 0 ? '' : 'text-danger'}">${fmt(a.balance)}</td>
          <td class="text-right"><button class="btn btn-sm btn-secondary" onclick="showAccountForm(${a.id})">Edit</button></td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showAccountForm = async (id) => {
  let account = { code:'', name:'', type:'Asset', subtype:'Bank', description:'', is_bank:0 };
  if (id) account = await API('/accounts/' + id);
  showModal(id ? 'Edit Account' : 'New Account', `
    <form onsubmit="saveAccount(event, ${id || 'null'})">
      <div class="form-row">
        <div class="form-group"><label>Code</label><input name="code" value="${account.code}" required ${id?'readonly':''}></div>
        <div class="form-group"><label>Name</label><input name="name" value="${account.name}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Type</label>
          <select name="type">${['Asset','Liability','Equity','Revenue','Expense'].map(t => `<option ${t===account.type?'selected':''}>${t}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Subtype</label><input name="subtype" value="${account.subtype}"></div>
      </div>
      <div class="form-group"><label>Description</label><input name="description" value="${account.description}"></div>
      <div class="form-group"><label><input type="checkbox" name="is_bank" ${account.is_bank?'checked':''}> Bank Account</label></div>
      <div class="btn-group"><button type="submit" class="btn btn-primary">Save</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

window.saveAccount = async (e, id) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  body.is_bank = body.is_bank === 'on';
  if (id) await API('/accounts/' + id, { method:'PUT', body });
  else await API('/accounts', { method:'POST', body });
  closeModal(); pages.accounts();
};

/* =================== CUSTOMERS =================== */
pages.customers = async () => {
  const customers = await API('/customers');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Customers</h2>
      <button class="btn btn-primary" onclick="showCustomerForm()">+ New Customer</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="text-right">Balance</th><th></th></tr></thead>
        <tbody>${customers.map(c => `<tr>
          <td><strong>${c.name}</strong></td><td>${c.email}</td><td>${c.phone}</td>
          <td class="text-right">${fmt(c.balance)}</td>
          <td class="text-right"><button class="btn btn-sm btn-secondary" onclick="showCustomerForm(${c.id})">Edit</button></td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showCustomerForm = async (id) => {
  let c = { name:'', email:'', phone:'', address:'' };
  if (id) c = await API('/customers/' + id);
  showModal(id ? 'Edit Customer' : 'New Customer', `
    <form onsubmit="saveCustomer(event, ${id || 'null'})">
      <div class="form-group"><label>Name</label><input name="name" value="${c.name}" required></div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input name="email" type="email" value="${c.email}"></div>
        <div class="form-group"><label>Phone</label><input name="phone" value="${c.phone}"></div>
      </div>
      <div class="form-group"><label>Address</label><textarea name="address">${c.address}</textarea></div>
      <div class="btn-group"><button type="submit" class="btn btn-primary">Save</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

window.saveCustomer = async (e, id) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  if (id) await API('/customers/' + id, { method:'PUT', body });
  else await API('/customers', { method:'POST', body });
  closeModal(); pages.customers();
};

/* =================== VENDORS =================== */
pages.vendors = async () => {
  const vendors = await API('/vendors');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Vendors</h2>
      <button class="btn btn-primary" onclick="showVendorForm()">+ New Vendor</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="text-right">Balance</th><th></th></tr></thead>
        <tbody>${vendors.map(v => `<tr>
          <td><strong>${v.name}</strong></td><td>${v.email}</td><td>${v.phone}</td>
          <td class="text-right">${fmt(v.balance)}</td>
          <td class="text-right"><button class="btn btn-sm btn-secondary" onclick="showVendorForm(${v.id})">Edit</button></td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showVendorForm = async (id) => {
  let v = { name:'', email:'', phone:'', address:'' };
  if (id) v = await API('/vendors/' + id);
  showModal(id ? 'Edit Vendor' : 'New Vendor', `
    <form onsubmit="saveVendor(event, ${id || 'null'})">
      <div class="form-group"><label>Name</label><input name="name" value="${v.name}" required></div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input name="email" type="email" value="${v.email}"></div>
        <div class="form-group"><label>Phone</label><input name="phone" value="${v.phone}"></div>
      </div>
      <div class="form-group"><label>Address</label><textarea name="address">${v.address}</textarea></div>
      <div class="btn-group"><button type="submit" class="btn btn-primary">Save</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

window.saveVendor = async (e, id) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  if (id) await API('/vendors/' + id, { method:'PUT', body });
  else await API('/vendors', { method:'POST', body });
  closeModal(); pages.vendors();
};

/* =================== INVOICES =================== */
pages.invoices = async () => {
  const invoices = await API('/invoices');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Invoices</h2>
      <button class="btn btn-primary" onclick="showInvoiceForm()">+ New Invoice</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>#</th><th>Customer</th><th>Date</th><th>Due</th><th class="text-right">Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${invoices.map(i => `<tr>
          <td><strong>${i.number}</strong></td><td>${i.customer_name}</td><td>${i.date}</td><td>${i.due_date}</td>
          <td class="text-right">${fmt(i.total)}</td><td>${badge(i.status)}</td>
          <td class="text-right btn-group">
            ${i.status === 'Draft' ? `<button class="btn btn-sm btn-primary" onclick="updateInvoiceStatus(${i.id},'Sent')">Send</button>` : ''}
            ${i.status === 'Sent' || i.status === 'Overdue' ? `<button class="btn btn-sm btn-success" onclick="showReceivePayment('Customer',${i.customer_id},${i.id},'Invoice',${i.total - i.amount_paid})">Pay</button>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="printInvoice(${i.id})">View</button>
            <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${i.id})">X</button>
          </td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showInvoiceForm = async () => {
  const customers = await API('/customers');
  const accounts = await API('/accounts');
  showModal('New Invoice', `
    <form onsubmit="saveInvoice(event)">
      <div class="form-row">
        <div class="form-group"><label>Customer</label>
          <select name="customer_id" required><option value="">Select...</option>${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Tax Rate %</label><input name="tax_rate" type="number" value="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Invoice Date</label><input name="date" type="date" value="${today()}" required></div>
        <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${today()}" required></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
      <h4 style="margin:12px 0 8px">Line Items</h4>
      <table class="line-items-table" id="invoice-items">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th></th></tr></thead>
        <tbody><tr>
          <td><input name="desc_0" required></td>
          <td><input name="qty_0" type="number" value="1" min="0" step="any" style="width:70px" required></td>
          <td><input name="price_0" type="number" value="0" min="0" step="0.01" style="width:100px" required></td>
          <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>
        </tr></tbody>
      </table>
      <button type="button" class="btn btn-sm btn-secondary mt-4" onclick="addInvoiceLine()">+ Add Line</button>
      <div class="btn-group mt-4"><button type="submit" class="btn btn-primary">Create Invoice</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

let invLineCount = 1;
window.addInvoiceLine = () => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input name="desc_${invLineCount}" required></td>
    <td><input name="qty_${invLineCount}" type="number" value="1" min="0" step="any" style="width:70px" required></td>
    <td><input name="price_${invLineCount}" type="number" value="0" min="0" step="0.01" style="width:100px" required></td>
    <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>`;
  $('#invoice-items tbody').appendChild(tr);
  invLineCount++;
};

window.saveInvoice = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const items = [];
  for (let i = 0; i < 50; i++) {
    const desc = fd.get('desc_' + i);
    if (!desc) continue;
    items.push({ description: desc, quantity: parseFloat(fd.get('qty_' + i)), unit_price: parseFloat(fd.get('price_' + i)) });
  }
  await API('/invoices', { method:'POST', body: {
    customer_id: parseInt(fd.get('customer_id')), date: fd.get('date'), due_date: fd.get('due_date'),
    tax_rate: parseFloat(fd.get('tax_rate')), notes: fd.get('notes'), items
  }});
  closeModal(); pages.invoices();
};

window.updateInvoiceStatus = async (id, status) => {
  await API('/invoices/' + id, { method:'PUT', body: { status }});
  pages.invoices();
};

window.deleteInvoice = async (id) => {
  if (confirm('Delete this invoice?')) { await API('/invoices/' + id, { method:'DELETE' }); pages.invoices(); }
};

/* Printable / PDF invoice */
window.printInvoice = async (id) => {
  const i = await API('/invoices/' + id);
  const w = window.open('', '_blank', 'width=800,height=1000');
  w.document.write(`<!DOCTYPE html><html><head>
    <title>${i.number} - ${i.customer_name}</title>
    <style>
      body{font-family:Georgia,'Times New Roman',serif;color:#222;max-width:680px;margin:0 auto;padding:30px;}
      .inv-head{display:flex;justify-content:space-between;border-bottom:2px solid #2ca01c;padding-bottom:15px;margin-bottom:25px;}
      h1{margin:0;color:#2ca01c;font-size:28px;letter-spacing:1px;}
      .company{color:#555;font-size:13px;margin-top:4px;}
      .right{text-align:right;font-size:14px;}
      .meta{display:flex;justify-content:space-between;margin-bottom:25px;}
      .meta div p{margin:2px 0;font-size:13px;}
      .meta strong{display:block;margin-bottom:6px;font-size:15px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      th{background:#f4f6f8;text-align:left;padding:8px;font-size:12px;border:1px solid #ddd;}
      td{padding:8px;border:1px solid #ddd;font-size:13px;}
      .num{text-align:right;}
      .totals{width:50%;margin-left:auto;}
      .totals td{border:none;padding:5px 10px;font-size:14px;}
      .totals .grand td{font-size:17px;font-weight:bold;border-top:2px solid #222;}
      .status{display:inline-block;padding:4px 12px;border-radius:3px;font-size:12px;font-weight:bold;background:#e9ecef;}
      .foot{margin-top:30px;font-size:12px;color:#888;text-align:center;border-top:1px solid #eee;padding-top:15px;}
      @media print{ .no-print{display:none;} }
    </style></head><body>
    <div class="inv-head">
      <div><h1>QB LITE</h1><div class="company">Accounting Inc.<br>123 Main Street, Suite 100<br>support@qb-lite.local</div></div>
      <div class="right"><strong>${i.number}</strong><br><span class="status">${i.status}</span><br>Date: ${i.date}<br>Due: ${i.due_date}</div>
    </div>
    <div class="meta">
      <div><strong>Bill To</strong><p>${i.customer_name}</p></div>
      <div style="text-align:right"><strong>Invoice Details</strong></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${i.items.map(it => `<tr>
        <td>${it.description}</td><td class="num">${it.quantity}</td><td class="num">${fmt(it.unit_price)}</td><td class="num">${fmt(it.amount)}</td>
      </tr>`).join('')}
      <tr><td colspan="3" style="text-align:right">Subtotal</td><td class="num">${fmt(i.subtotal)}</td></tr>
      <tr><td colspan="3" style="text-align:right">Tax (${i.tax_rate}%)</td><td class="num">${fmt(i.tax_amount)}</td></tr>
      </tbody>
    </table>
    <table class="totals">
      <tr class="grand"><td>Balance Due</td><td class="num">${fmt(i.total - i.amount_paid)}</td></tr>
    </table>
    ${i.notes ? `<p style="font-size:13px"><strong>Notes:</strong> ${i.notes}</p>` : ''}
    <div class="foot">Generated by QB Lite | ${new Date().toLocaleString()}</div>
    <div class="no-print" style="text-align:center;margin-top:25px">
      <button onclick="window.print()" style="padding:10px 25px;background:#2ca01c;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:15px">Print / Save as PDF</button>
    </div>
    </body></html>`);
  w.document.close();
  w.focus();
};

/* =================== BILLS =================== */
pages.bills = async () => {
  const bills = await API('/bills');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Bills</h2>
      <button class="btn btn-primary" onclick="showBillForm()">+ New Bill</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>#</th><th>Vendor</th><th>Date</th><th>Due</th><th class="text-right">Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${bills.map(b => `<tr>
          <td><strong>${b.number}</strong></td><td>${b.vendor_name}</td><td>${b.date}</td><td>${b.due_date}</td>
          <td class="text-right">${fmt(b.total)}</td><td>${badge(b.status)}</td>
          <td class="text-right btn-group">
            ${b.status === 'Draft' ? `<button class="btn btn-sm btn-primary" onclick="updateBillStatus(${b.id},'Received')">Receive</button>` : ''}
            ${b.status === 'Received' || b.status === 'Overdue' ? `<button class="btn btn-sm btn-success" onclick="showReceivePayment('Vendor',${b.vendor_id},${b.id},'Bill',${b.total - b.amount_paid})">Pay</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteBill(${b.id})">X</button>
          </td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showBillForm = async () => {
  const vendors = await API('/vendors');
  showModal('New Bill', `
    <form onsubmit="saveBill(event)">
      <div class="form-row">
        <div class="form-group"><label>Vendor</label>
          <select name="vendor_id" required><option value="">Select...</option>${vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Tax Rate %</label><input name="tax_rate" type="number" value="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Bill Date</label><input name="date" type="date" value="${today()}" required></div>
        <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${today()}" required></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
      <h4 style="margin:12px 0 8px">Line Items</h4>
      <table class="line-items-table" id="bill-items">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th></th></tr></thead>
        <tbody><tr>
          <td><input name="desc_0" required></td>
          <td><input name="qty_0" type="number" value="1" min="0" step="any" style="width:70px" required></td>
          <td><input name="price_0" type="number" value="0" min="0" step="0.01" style="width:100px" required></td>
          <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>
        </tr></tbody>
      </table>
      <button type="button" class="btn btn-sm btn-secondary mt-4" onclick="addBillLine()">+ Add Line</button>
      <div class="btn-group mt-4"><button type="submit" class="btn btn-primary">Create Bill</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

let billLineCount = 1;
window.addBillLine = () => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input name="desc_${billLineCount}" required></td>
    <td><input name="qty_${billLineCount}" type="number" value="1" min="0" step="any" style="width:70px" required></td>
    <td><input name="price_${billLineCount}" type="number" value="0" min="0" step="0.01" style="width:100px" required></td>
    <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>`;
  $('#bill-items tbody').appendChild(tr);
  billLineCount++;
};

window.saveBill = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const items = [];
  for (let i = 0; i < 50; i++) {
    const desc = fd.get('desc_' + i);
    if (!desc) continue;
    items.push({ description: desc, quantity: parseFloat(fd.get('qty_' + i)), unit_price: parseFloat(fd.get('price_' + i)) });
  }
  await API('/bills', { method:'POST', body: {
    vendor_id: parseInt(fd.get('vendor_id')), date: fd.get('date'), due_date: fd.get('due_date'),
    tax_rate: parseFloat(fd.get('tax_rate')), notes: fd.get('notes'), items
  }});
  closeModal(); pages.bills();
};

window.updateBillStatus = async (id, status) => {
  await API('/bills/' + id, { method:'PUT', body: { status }});
  pages.bills();
};

window.deleteBill = async (id) => {
  if (confirm('Delete this bill?')) { await API('/bills/' + id, { method:'DELETE' }); pages.bills(); }
};

/* =================== PAYMENTS =================== */
pages.payments = async () => {
  const payments = await API('/payments');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Payments</h2>
      <button class="btn btn-primary" onclick="showReceivePayment()">+ Record Payment</button>
    </div>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Date</th><th>Type</th><th>Payee/Payer</th><th>Linked</th><th>Account</th><th class="text-right">Amount</th><th></th></tr></thead>
        <tbody>${payments.map(p => `<tr>
          <td>${p.date}</td><td>${badge(p.type === 'Receive' ? 'Paid' : 'Sent')}</td><td>${p.entity_name}</td>
          <td>${p.linked_type ? p.linked_type + ' #' + p.linked_id : '-'}</td><td>${p.account_id}</td>
          <td class="text-right">${fmt(p.amount)}</td>
          <td><button class="btn btn-sm btn-danger" onclick="deletePayment(${p.id})">X</button></td>
        </tr>`).join('')}</tbody>
      `)}
    </div>`;
};

window.showReceivePayment = async (entityType, entityId, linkedId, linkedType, amountDue) => {
  const bankAccounts = await API('/accounts?subtype=Bank');
  let customers = [], vendors = [];
  if (!entityType || entityType === 'Customer') customers = await API('/customers');
  if (!entityType || entityType === 'Vendor') vendors = await API('/vendors');
  showModal('Record Payment', `
    <form onsubmit="savePayment(event)">
      <div class="form-row">
        <div class="form-group"><label>Type</label>
          <select name="type" required onchange="this.form.entity_type.value=this.value==='Receive'?'Customer':'Vendor'">
            <option value="Receive" ${entityType==='Customer'?'selected':''}>Receive Payment</option>
            <option value="Pay" ${entityType==='Vendor'?'selected':''}>Make Payment</option>
          </select>
        </div>
        <div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${entityType==='Vendor'?'Vendor':'Customer'}</label>
          <select name="entity_id" required>
            <option value="">Select...</option>
            ${customers.map(c => `<option value="${c.id}" ${entityId==c.id?'selected':''}>${c.name}</option>`).join('')}
            ${vendors.map(v => `<option value="${v.id}" ${entityId==v.id?'selected':''}>${v.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Amount</label><input name="amount" type="number" step="0.01" min="0" value="${amountDue||''}" required></div>
      </div>
      <input type="hidden" name="entity_type" value="${entityType||'Customer'}">
      <div class="form-group"><label>Bank Account</label>
        <select name="account_id" required>${bankAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Reference</label><input name="reference"></div>
        <div class="form-group"><label>Linked Type</label>
          <select name="linked_type"><option value="">None</option><option value="Invoice" ${linkedType==='Invoice'?'selected':''}>Invoice</option><option value="Bill" ${linkedType==='Bill'?'selected':''}>Bill</option></select>
        </div>
      </div>
      <div class="form-group"><label>Linked ID</label><input name="linked_id" type="number" value="${linkedId||''}"></div>
      <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
      <div class="btn-group"><button type="submit" class="btn btn-primary">Save Payment</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

window.savePayment = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  body.amount = parseFloat(body.amount);
  body.entity_id = parseInt(body.entity_id);
  body.account_id = parseInt(body.account_id);
  if (body.linked_id) body.linked_id = parseInt(body.linked_id);
  else { delete body.linked_id; delete body.linked_type; }
  await API('/payments', { method:'POST', body });
  closeModal(); pages.payments();
};

window.deletePayment = async (id) => {
  if (confirm('Delete this payment?')) { await API('/payments/' + id, { method:'DELETE' }); pages.payments(); }
};

/* =================== JOURNAL ENTRIES =================== */
pages.journal = async () => {
  const entries = await API('/journal');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Journal Entries</h2>
      <button class="btn btn-primary" onclick="showJournalForm()">+ New Journal Entry</button>
    </div>
    ${entries.length ? entries.map(e => `
      <div class="card">
        <div class="card-header"><h3>${e.date} - ${e.description}</h3><span>${e.reference || ''}</span></div>
        ${wideTable(`
          <thead><tr><th>Account</th><th class="text-right">Debit</th><th class="text-right">Credit</th></tr></thead>
          <tbody>${e.lines.map(l => `<tr>
            <td>${l.account_code} - ${l.account_name}</td>
            <td class="text-right">${l.debit ? fmt(l.debit) : ''}</td>
            <td class="text-right">${l.credit ? fmt(l.credit) : ''}</td>
          </tr>`).join('')}</tbody>
        `)}
      </div>`).join('') : '<div class="card"><div class="empty-state"><p>No journal entries yet</p></div></div>'}`;
};

window.showJournalForm = async () => {
  const accounts = await API('/accounts');
  window._journalAccounts = accounts;
  showModal('New Journal Entry', `
    <form onsubmit="saveJournal(event)">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}" required></div>
        <div class="form-group"><label>Reference</label><input name="reference"></div>
      </div>
      <div class="form-group"><label>Description</label><input name="description" required></div>
      <h4 style="margin:12px 0 8px">Lines</h4>
      <table class="line-items-table" id="journal-lines">
        <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th></th></tr></thead>
        <tbody><tr>
          <td><select name="acct_0" required><option value="">Select...</option>${accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></td>
          <td><input name="dr_0" type="number" step="0.01" min="0" value="0" style="width:100px"></td>
          <td><input name="cr_0" type="number" step="0.01" min="0" value="0" style="width:100px"></td>
          <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>
        </tr></tbody>
      </table>
      <button type="button" class="btn btn-sm btn-secondary mt-4" onclick="addJournalLine()">+ Add Line</button>
      <div class="btn-group mt-4"><button type="submit" class="btn btn-primary">Save Entry</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>
    </form>`);
};

let jrnlLineCount = 1;
window.addJournalLine = () => {
  const accounts = window._journalAccounts || [];
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><select name="acct_${jrnlLineCount}" required><option value="">Select...</option>${accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></td>
    <td><input name="dr_${jrnlLineCount}" type="number" step="0.01" min="0" value="0" style="width:100px"></td>
    <td><input name="cr_${jrnlLineCount}" type="number" step="0.01" min="0" value="0" style="width:100px"></td>
    <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>`;
  $('#journal-lines tbody').appendChild(tr);
  jrnlLineCount++;
};

window.saveJournal = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const lines = [];
  for (let i = 0; i < 50; i++) {
    const acct = fd.get('acct_' + i);
    if (!acct) continue;
    lines.push({ account_id: parseInt(acct), debit: parseFloat(fd.get('dr_' + i) || 0), credit: parseFloat(fd.get('cr_' + i) || 0) });
  }
  await API('/journal', { method:'POST', body: { date: fd.get('date'), description: fd.get('description'), reference: fd.get('reference'), lines }});
  closeModal(); pages.journal();
};

/* =================== REPORTS =================== */
pages['profit-loss'] = async () => {
  const start = window._plStart || (new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const end = window._plEnd || today();
  const qs = `?start_date=${start}&end_date=${end}`;
  const r = await API('/reports/profit-loss' + qs);
  $('#page-container').innerHTML = `
    <h2 style="margin-bottom:20px">Profit & Loss Report</h2>
    <div class="card" style="background:var(--bg)">
      <form class="form-row" onsubmit="runPLFilter(event)">
        <div class="form-group"><label>From</label><input type="date" id="pl-start" value="${start}"></div>
        <div class="form-group"><label>To</label><input type="date" id="pl-end" value="${end}"></div>
        <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" type="submit">Run Report</button></div>
      </form>
    </div>
    <div class="card">
      <h3 style="color:var(--success)">Revenue</h3>
      ${wideTable(`<thead><tr><th>Account</th><th class="text-right">Amount</th></tr></thead>
      <tbody>${r.revenue.map(a => `<tr><td>${a.code} - ${a.name}</td><td class="text-right">${fmt(a.balance)}</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total Revenue</td><td class="text-right text-success">${fmt(r.totalRevenue)}</td></tr>
      </tbody>`)}
    </div>
    <div class="card">
      <h3 style="color:var(--danger)">Expenses</h3>
      ${wideTable(`<thead><tr><th>Account</th><th class="text-right">Amount</th></tr></thead>
      <tbody>${r.expenses.map(a => `<tr><td>${a.code} - ${a.name}</td><td class="text-right">${fmt(a.balance)}</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total Expenses</td><td class="text-right text-danger">${fmt(r.totalExpenses)}</td></tr>
      </tbody>`)}
    </div>
    <div class="card" style="border-left:4px solid ${r.netIncome >= 0 ? 'var(--success)' : 'var(--danger)'}">
      <div class="flex-between"><h3>Net Income</h3><h3 class="${r.netIncome >= 0 ? 'text-success' : 'text-danger'}">${fmt(r.netIncome)}</h3></div>
    </div>`;
};
window.runPLFilter = (e) => {
  e.preventDefault();
  window._plStart = $('#pl-start').value;
  window._plEnd = $('#pl-end').value;
  pages['profit-loss']();
};

/* Aged Receivables */
pages.receivables = async () => {
  const r = await API('/reports/aged-receivables');
  $('#page-container').innerHTML = `
    <h2 style="margin-bottom:20px">Accounts Receivable Aging</h2>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Customer</th><th class="text-right">Current</th><th class="text-right">1-30</th><th class="text-right">31-60</th><th class="text-right">60+</th><th class="text-right">Total</th></tr></thead>
        <tbody>${r.map(c => `<tr>
          <td>${c.name}</td>
          <td class="text-right">${fmt(c.current)}</td>
          <td class="text-right">${fmt(c.days_1_30)}</td>
          <td class="text-right">${fmt(c.days_31_60)}</td>
          <td class="text-right">${fmt(c.over_60)}</td>
          <td class="text-right"><strong>${fmt(c.balance)}</strong></td>
        </tr>`).join('')}
      `)}
    </div>`;
};

/* Aged Payables */
pages.payables = async () => {
  const r = await API('/reports/aged-payables');
  $('#page-container').innerHTML = `
    <h2 style="margin-bottom:20px">Accounts Payable Aging</h2>
    <div class="card">
      ${wideTable(`
        <thead><tr><th>Vendor</th><th class="text-right">Current</th><th class="text-right">1-30</th><th class="text-right">31-60</th><th class="text-right">60+</th><th class="text-right">Total</th></tr></thead>
        <tbody>${r.map(v => `<tr>
          <td>${v.name}</td>
          <td class="text-right">${fmt(v.current)}</td>
          <td class="text-right">${fmt(v.days_1_30)}</td>
          <td class="text-right">${fmt(v.days_31_60)}</td>
          <td class="text-right">${fmt(v.over_60)}</td>
          <td class="text-right"><strong>${fmt(v.balance)}</strong></td>
        </tr>`).join('')}
      `)}
    </div>`;
};

pages['balance-sheet'] = async () => {
  const r = await API('/reports/balance-sheet');
  $('#page-container').innerHTML = `
    <h2 style="margin-bottom:20px">Balance Sheet</h2>
    <div class="card">
      <h3>Assets</h3>
      ${wideTable(`<thead><tr><th>Account</th><th class="text-right">Amount</th></tr></thead>
      <tbody>${r.assets.map(a => `<tr><td>${a.code} - ${a.name}</td><td class="text-right">${fmt(a.balance)}</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total Assets</td><td class="text-right">${fmt(r.totalAssets)}</td></tr>
      </tbody>`)}
    </div>
    <div class="card">
      <h3>Liabilities</h3>
      ${wideTable(`<thead><tr><th>Account</th><th class="text-right">Amount</th></tr></thead>
      <tbody>${r.liabilities.map(a => `<tr><td>${a.code} - ${a.name}</td><td class="text-right">${fmt(a.balance)}</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total Liabilities</td><td class="text-right">${fmt(r.totalLiabilities)}</td></tr>
      </tbody>`)}
    </div>
    <div class="card">
      <h3>Equity</h3>
      ${wideTable(`<thead><tr><th>Account</th><th class="text-right">Amount</th></tr></thead>
      <tbody>${r.equity.map(a => `<tr><td>${a.code} - ${a.name}</td><td class="text-right">${fmt(a.balance)}</td></tr>`).join('')}
      <tr><td>Net Income</td><td class="text-right">${fmt(r.netIncome)}</td></tr>
      <tr style="font-weight:700"><td>Total Equity</td><td class="text-right">${fmt(r.totalEquity)}</td></tr>
      </tbody>`)}
    </div>
    <div class="card" style="border-left:4px solid ${Math.abs(r.totalAssets - (r.totalLiabilities + r.totalEquity)) < 0.01 ? 'var(--success)' : 'var(--danger)'}">
      <div class="flex-between"><h3>Total Liabilities + Equity</h3><h3>${fmt(r.totalLiabilities + r.totalEquity)}</h3></div>
    </div>`;
};

/* =================== WRITE CHECK / EXPENSE =================== */
pages.expenses = async () => {
  const bankAccounts = await API('/accounts?subtype=Bank');
  const expenseAccts = await API('/accounts?type=Expense');
  window._expBankAccts = bankAccounts;
  window._expExpAccts = expenseAccts;
  const expenses = await API('/journal');
  const checks = expenses.filter(e => e.description === 'Expense/Check');
  $('#page-container').innerHTML = `
    <div class="flex-between mb-4">
      <h2>Write Check / Expense</h2>
      <button class="btn btn-primary" onclick="showExpenseForm()">+ Write Check</button>
    </div>
    ${checks.length ? wideTable(`
      <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="text-right">Amount</th><th></th></tr></thead>
      <tbody>${checks.map(e => {
        const total = e.lines.reduce((s,l) => s + (l.credit || 0), 0);
        const bank = e.lines.find(l => l.credit > 0);
        return `<tr>
          <td>${e.date}</td><td>${e.description}</td><td>${e.reference}</td>
          <td class="text-right text-danger">${fmt(total)}</td>
          <td><button class="btn btn-sm btn-danger" onclick="deleteExpense(${e.id})">X</button></td>
        </tr>`;
      }).join('')}</tbody>
    `) : '<div class="card"><div class="empty-state"><p>No checks written yet</p></div></div>'}`;
};

window.showExpenseForm = async () => {
  const bankAccounts = window._expBankAccts || await API('/accounts?subtype=Bank');
  const expenseAccts = window._expExpAccts || await API('/accounts?type=Expense');
  showModal('Write Check', `
    <form onsubmit="saveExpense(event)">
      <div class="form-row">
        <div class="form-group"><label>Payee</label><input name="payee" placeholder="Who is this for?" required></div>
        <div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}" required></div>
      </div>
      <div class="form-group"><label>Bank Account</label>
        <select name="account_id" required>${bankAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
      </div>
      <h4 style="margin:12px 0 8px">Expense Lines</h4>
      <table class="line-items-table" id="expense-lines">
        <thead><tr><th>Expense Account</th><th>Description</th><th>Amount</th><th></th></tr></thead>
        <tbody><tr>
          <td><select name="exp_acct_0" required><option value="">Select...</option>${expenseAccts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></td>
          <td><input name="exp_desc_0" value="Office expense" required></td>
          <td><input name="exp_amt_0" type="number" step="0.01" min="0.01" required style="width:100px"></td>
          <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>
        </tr></tbody>
      </table>
      <button type="button" class="btn btn-sm btn-secondary mt-4" onclick="addExpenseLine()">+ Add Line</button>
      <div class="form-group mt-4"><label>Reference</label><input name="reference"></div>
      <div class="btn-group mt-4">
        <button type="submit" class="btn btn-primary">Save Check</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    </form>`);
};

let expLineCount = 1;
window.addExpenseLine = async () => {
  const expenseAccts = window._expExpAccts || await API('/accounts?type=Expense');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><select name="exp_acct_${expLineCount}" required><option value="">Select...</option>${expenseAccts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></td>
    <td><input name="exp_desc_${expLineCount}" required></td>
    <td><input name="exp_amt_${expLineCount}" type="number" step="0.01" min="0.01" required style="width:100px"></td>
    <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">&times;</button></td>`;
  $('#expense-lines tbody').appendChild(tr);
  expLineCount++;
};

window.saveExpense = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const items = [];
  for (let i = 0; i < 50; i++) {
    const amt = fd.get('exp_amt_' + i);
    if (!amt || parseFloat(amt) <= 0) continue;
    items.push({ account_id: parseInt(fd.get('exp_acct_' + i)), description: fd.get('exp_desc_' + i), amount: parseFloat(amt) });
  }
  if (!items.length) return alert('Add at least one expense line');
  await API('/expenses', { method:'POST', body: {
    date: fd.get('date'), description: fd.get('payee'), account_id: parseInt(fd.get('account_id')),
    reference: fd.get('reference'), items
  }});
  closeModal(); pages.expenses();
};

window.deleteExpense = async (id) => {
  if (confirm('Delete this check/expense?')) { await API('/journal/' + id, { method:'DELETE' }); pages.expenses(); }
};
