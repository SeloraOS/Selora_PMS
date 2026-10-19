/** Export helpers (no React): CSV, Excel (HTML table .xls), printable documents and accounting vouchers. */

const text = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? '' : String(v));

/** Plain value of a column for a row: explicit csv(), the row field, or a primitive render(). */
export function cellValue(col, row) {
  if (col.csv) return text(col.csv(row));
  if (col.key && Object.prototype.hasOwnProperty.call(row, col.key) && typeof row[col.key] !== 'object') return text(row[col.key]);
  if (col.render) { const v = col.render(row); return typeof v === 'string' || typeof v === 'number' ? text(v) : ''; }
  return '';
}

export function toCsv(columns, rows) {
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }; // no formula injection
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(cellValue(c, r))).join(','))].join('\r\n');
}

const html = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escapeHtml = html;

/** Excel opens an HTML table saved as .xls. */
export function toXls(columns, rows, title = 'Export') {
  const head = columns.map((c) => `<th style="background:#f1f5f9;font-weight:bold">${html(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${html(cellValue(c, r))}</td>`).join('')}</tr>`).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><title>${html(title)}</title></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? `﻿${content}` : content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export const downloadCsvFile = (name, columns, rows) => download(`${name}.csv`, toCsv(columns, rows), 'text/csv;charset=utf-8');
export const downloadXlsFile = (name, columns, rows) => download(`${name}.xls`, toXls(columns, rows, name), 'application/vnd.ms-excel');

/** Branded printable page (use the browser's Save as PDF). `brand`: { company, letterhead, logo }. */
export function brandedDocument({ title, bodyHtml, brand = {} }) {
  const head = `<div class="head">${brand.logo ? `<img src="${html(brand.logo)}" alt="" />` : ''}<div><div class="co">${html(brand.company || '')}</div><div class="lh">${html(brand.letterhead || '').replace(/\n/g, '<br>')}</div></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${html(title)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:13px;line-height:1.5}
    .head{display:flex;gap:16px;align-items:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:20px}
    .head img{max-height:56px;max-width:160px}.co{font-size:18px;font-weight:700}.lh{color:#444;font-size:12px}
    h1{font-size:18px;margin:0 0 12px}table{border-collapse:collapse;width:100%;margin:12px 0}
    th,td{border:1px solid #999;padding:6px 8px;text-align:left}td.n,th.n{text-align:right}
    .total td{font-weight:700;background:#f3f3f3}.sig{margin-top:56px;display:flex;justify-content:space-between}
    @media print{body{margin:12mm}}
  </style></head><body>${head}${bodyHtml}</body></html>`;
}

/** Open the document in a new window and start the print dialog. Returns false when pop-ups are blocked. */
export function printDocument(doc) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(doc); w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '');

export function raBillHtml({ bill, workOrder, vendor, project }) {
  const row = (label, v, cls = '') => `<tr class="${cls}"><td>${html(label)}</td><td class="n">${inr(v)}</td></tr>`;
  return `<h1>Running Account Bill ${html(bill.code)}</h1>
  <table><tr><td>Project</td><td>${html(project)}</td><td>Work order</td><td>${html(workOrder?.code)} ${html(workOrder?.title)}</td></tr>
  <tr><td>Vendor</td><td>${html(vendor?.name)}${vendor?.gstin ? `<br>GSTIN ${html(vendor.gstin)}` : ''}</td><td>Bill no. / period</td><td>${html(bill.bill_no)} · ${dmy(bill.period_from)} to ${dmy(bill.period_to)}</td></tr>
  <tr><td>Status</td><td>${html(bill.status)}</td><td>Due date</td><td>${dmy(bill.due_date)}</td></tr></table>
  <table>${row('Gross amount of work', bill.gross_amount)}${row(`Add: GST @ ${Number(bill.gst_percent)}%`, bill.gst_amount)}${row(`Less: retention @ ${Number(bill.retention_percent)}%`, bill.retention_amount)}${row(`Less: TDS @ ${Number(bill.tds_percent)}%`, bill.tds_amount)}${row('Net payable', bill.net_amount, 'total')}${row('Paid so far', bill.paid_amount)}${row('Balance', Number(bill.net_amount) - Number(bill.paid_amount), 'total')}</table>
  <div class="sig"><div>Prepared by<br><br>______________</div><div>Checked by<br><br>______________</div><div>Approved by<br><br>______________</div></div>`;
}

export function demandLetterHtml({ customer, project, milestone, amount, dueOn, reference, today }) {
  return `<p>Date: ${dmy(today)}${reference ? `<br>Ref: ${html(reference)}` : ''}</p>
  <p>To,<br><b>${html(customer)}</b></p>
  <h1>Demand letter: ${html(milestone)}</h1>
  <p>Dear ${html(customer)},</p>
  <p>With reference to your booking in <b>${html(project)}</b>, the construction milestone <b>${html(milestone)}</b> has been achieved. As per the payment schedule agreed, you are requested to pay <b>Rs ${inr(amount)}</b> on or before <b>${dmy(dueOn)}</b>.</p>
  <p>Kindly make the payment by cheque or bank transfer in favour of the company account. Delay beyond the due date may attract interest as per the agreement.</p>
  <p>Thank you for your continued association.</p>
  <div class="sig"><div>Yours sincerely,<br><br><br>Authorised signatory</div></div>`;
}

// ── accounting exports (Tally / Zoho Books) ─────────────────────────────────
const xml = html;
const tallyDate = (d) => String(d).replace(/-/g, '');

/**
 * Tally Prime import XML: a Purchase voucher for each approved/paid RA bill (Cr vendor, Dr work expense, Dr GST input,
 * Cr TDS payable, Cr retention payable) and a Payment voucher for each payment.
 * `bills`: ra_bills rows enriched with { vendorName, workTitle, costHead }, `payments`: rows with { bill, vendorName }.
 */
export function tallyXml({ company, bills, payments }) {
  const entry = (ledger, amount, debit) => `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${debit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${debit ? '-' : ''}${Number(amount).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
  const vouchers = [];
  for (const b of bills) {
    const date = b.approved_at ? b.approved_at.slice(0, 10) : b.period_to || b.created_at.slice(0, 10);
    const lines = [
      entry(b.vendorName, Number(b.net_amount), false),
      entry(b.costHead || 'Contract expenses', Number(b.gross_amount), true),
      ...(Number(b.gst_amount) ? [entry('GST Input', Number(b.gst_amount), true)] : []),
      ...(Number(b.tds_amount) ? [entry('TDS Payable', Number(b.tds_amount), false)] : []),
      ...(Number(b.retention_amount) ? [entry('Retention Payable', Number(b.retention_amount), false)] : []),
    ];
    vouchers.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Purchase" ACTION="Create"><DATE>${tallyDate(date)}</DATE><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(b.code)}</VOUCHERNUMBER><PARTYLEDGERNAME>${xml(b.vendorName)}</PARTYLEDGERNAME><NARRATION>${xml(`${b.workTitle || ''} ${b.code}`.trim())}</NARRATION>${lines.join('')}</VOUCHER></TALLYMESSAGE>`);
  }
  for (const p of payments) {
    vouchers.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Payment" ACTION="Create"><DATE>${tallyDate(p.payment_date)}</DATE><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME><PARTYLEDGERNAME>${xml(p.vendorName)}</PARTYLEDGERNAME><NARRATION>${xml(`${p.bill} ${p.reference || ''}`.trim())}</NARRATION>${entry(p.vendorName, Number(p.amount), true)}${entry(p.mode === 'Cash' ? 'Cash' : 'Bank Account', Number(p.amount), false)}</VOUCHER></TALLYMESSAGE>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${vouchers.join('')}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

/** Zoho Books "Bills" import CSV, one line per bill. */
export function zohoBillsCsv(bills) {
  const columns = [
    { label: 'Bill Date', csv: (b) => (b.approved_at || b.created_at).slice(0, 10) }, { label: 'Bill Number', csv: (b) => b.code },
    { label: 'Vendor Name', csv: (b) => b.vendorName }, { label: 'Due Date', csv: (b) => b.due_date || '' },
    { label: 'Account', csv: (b) => b.costHead || 'Contract expenses' }, { label: 'Description', csv: (b) => b.workTitle || '' },
    { label: 'Item Total', csv: (b) => Number(b.gross_amount).toFixed(2) }, { label: 'Tax Percentage', csv: (b) => Number(b.gst_percent) },
    { label: 'TDS Amount', csv: (b) => Number(b.tds_amount).toFixed(2) }, { label: 'Retention Amount', csv: (b) => Number(b.retention_amount).toFixed(2) },
    { label: 'Total', csv: (b) => Number(b.net_amount).toFixed(2) }, { label: 'Status', csv: (b) => b.status },
  ];
  return toCsv(columns, bills);
}
