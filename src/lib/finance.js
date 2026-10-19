/** Pure finance helpers (no React). Amounts are rupees; dates are YYYY-MM-DD strings. */
import { addDays } from './dates.js';
import { daysBetween, ganttSpan } from './gantt.js';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Same math as the database trigger (ra_amounts): net = gross + GST - retention - TDS. */
export function computeBill(gross, { retention = 0, tds = 0, gst = 0 } = {}) {
  const g = Number(gross) || 0;
  const retentionAmount = r2((g * retention) / 100);
  const tdsAmount = r2((g * tds) / 100);
  const gstAmount = r2((g * gst) / 100);
  return { gross: r2(g), retentionAmount, tdsAmount, gstAmount, net: r2(g + gstAmount - retentionAmount - tdsAmount) };
}

/** Budget status of a finance_summary row: committed value against the budget. */
export function budgetHealth(row, alertPercent = 90) {
  const budget = Number(row.budget) || 0;
  const committed = Number(row.committed) || 0;
  if (budget <= 0) return { key: committed > 0 ? 'unbudgeted' : 'none', pct: null };
  const pct = Math.round((committed / budget) * 1000) / 10;
  return { key: committed > budget ? 'over' : pct >= alertPercent ? 'warn' : 'ok', pct };
}

/** Sum finance_summary rows (optionally filtered) into totals. */
export function totals(rows) {
  const t = rows.reduce((a, r) => ({ budget: a.budget + Number(r.budget), committed: a.committed + Number(r.committed), billed: a.billed + Number(r.billed), paid: a.paid + Number(r.paid) }), { budget: 0, committed: 0, billed: 0, paid: 0 });
  return { ...t, balance: r2(t.budget - t.committed), payable: r2(t.billed - t.paid) };
}

/** Financial year of a date for a start month (1-12): { label: 'FY 2026-27', from, to }. */
export function fiscalYear(ymd, startMonth = 4) {
  const y = Number(ymd.slice(0, 4)); const m = Number(ymd.slice(5, 7));
  const startYear = m >= startMonth ? y : y - 1;
  const pad = (n) => String(n).padStart(2, '0');
  const from = `${startYear}-${pad(startMonth)}-01`;
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const to = `${endYear}-${pad(endMonth)}-${pad(new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate())}`;
  const label = startMonth === 1 ? `FY ${startYear}` : `FY ${startYear}-${String(startYear + 1).slice(2)}`;
  return { label, from, to };
}

/**
 * Planned vs actual progress (S-curve), weighted by task weight (default 1).
 * Planned accrues linearly across each task's planned span; actual counts completed tasks by their actual end date
 * and, up to `today`, the reported percent complete of the tasks still open. Returns [{ date, planned, actual|null }] in percent.
 */
export function sCurve(tasks, today, points = 12) {
  const rows = tasks.filter((t) => t.isTemplate !== 'Yes' && t.status !== 'Cancelled' && ganttSpan(t));
  const total = rows.reduce((n, t) => n + (Number(t.weight) || 1), 0);
  if (!rows.length || !total) return [];
  let from = rows[0] && ganttSpan(rows[0]).start; let to = ganttSpan(rows[0]).end;
  for (const t of rows) { const s = ganttSpan(t); if (s.start < from) from = s.start; if (s.end > to) to = s.end; }
  const span = Math.max(1, daysBetween(from, to));
  const dates = Array.from({ length: points + 1 }, (_, i) => addDays(from, Math.round((span * i) / points)));
  const lastActual = dates.reduce((idx, d, i) => (d <= today ? i : idx), -1);
  const out = [];
  for (let i = 0; i <= points; i++) {
    const date = dates[i];
    let planned = 0; let actual = 0;
    for (const t of rows) {
      const w = Number(t.weight) || 1; const s = ganttSpan(t);
      const len = daysBetween(s.start, s.end) + 1;
      planned += w * Math.min(1, Math.max(0, (daysBetween(s.start, date) + 1) / len));
      if (date <= today) {
        if (t.status === 'Completed') actual += w * ((t.actualEndDate || s.end) <= date ? 1 : 0);
        else if (i === lastActual) actual += w * ((Number(t.percentComplete) || 0) / 100); // reported progress of open tasks counts at the latest point
      }
    }
    out.push({ date, planned: Math.round((planned / total) * 1000) / 10, actual: date <= today ? Math.round((actual / total) * 1000) / 10 : null });
  }
  return out;
}

/** Outstanding (approved, unpaid) bill amounts by due month, plus what is already overdue. */
export function cashFlow(bills, today) {
  const months = new Map(); let overdue = 0;
  for (const b of bills) {
    if (b.status !== 'approved') continue;
    const due = Number(b.net_amount) - Number(b.paid_amount);
    if (due <= 0) continue;
    if (b.due_date && b.due_date < today) { overdue += due; continue; }
    const key = (b.due_date || today).slice(0, 7);
    months.set(key, (months.get(key) || 0) + due);
  }
  return { overdue: r2(overdue), months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: r2(amount) })) };
}

export const BILL_STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', paid: 'Paid' };
export const WO_STATUS_LABELS = { draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', closed: 'Closed', cancelled: 'Cancelled' };
