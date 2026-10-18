/**
 * Pure aggregation helpers for the dashboard and reports.
 * Inputs are the UI-shaped objects from ProjectsContext (see lib/mappers.js);
 * `today` is a YYYY-MM-DD string so results are deterministic in tests.
 */

const CLOSED = new Set(['Completed', 'Cancelled']);
const DAY = 86400000;

// Local calendar date (not UTC) so "today" matches the user's clock
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const isClosed = (task) => CLOSED.has(task.status);

const dayNumber = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY);
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);

const sum = (rows, f) => rows.reduce((t, r) => t + (Number(f(r)) || 0), 0);
const round = (n) => Math.round(n * 100) / 100;

/** All timesheet lines flattened, each carrying its sheet's employee/status/customer. */
export function entryRows(timesheets) {
  return timesheets.flatMap((ts) =>
    (ts.timeSheets || []).map((e) => ({
      timesheetId: ts.id,
      employee: ts.employee || 'Unassigned',
      status: ts.status,
      customer: ts.customer,
      project: e.project || ts.project || '',
      activityType: e.activityType,
      date: e.fromTime ? String(e.fromTime).slice(0, 10) : '',
      hours: Number(e.hrs) || 0,
      isBillable: !!e.isBillable,
      billingAmount: e.isBillable ? (Number(e.hrs) || 0) * (Number(e.billingRate) || 0) : 0,
      costingAmount: (Number(e.hrs) || 0) * (Number(e.costingRate) || 0),
    }))
  );
}

/** 0-100. Weighted by task weight when any task has one, otherwise by task count. */
export function projectProgress(projectName, tasks) {
  const mine = tasks.filter((t) => t.project === projectName && t.status !== 'Cancelled');
  if (!mine.length) return 0;
  const weighted = mine.some((t) => Number(t.weight) > 0);
  const total = sum(mine, (t) => (weighted ? Number(t.weight) || 0 : 1));
  if (!total) return 0;
  const done = sum(mine.filter((t) => t.status === 'Completed'), (t) => (weighted ? Number(t.weight) || 0 : 1));
  return Math.round((done / total) * 100);
}

export function countBy(rows, f) {
  const out = new Map();
  for (const r of rows) {
    const k = f(r) || 'Unspecified';
    out.set(k, (out.get(k) || 0) + 1);
  }
  return [...out].map(([name, value]) => ({ name, value }));
}

/** Open tasks whose expected end date is before `today`, with days of delay (most delayed first). */
export function delayedTasks(tasks, today) {
  return tasks
    .filter((t) => !isClosed(t) && t.expectedEndDate && t.expectedEndDate < today)
    .map((t) => ({ ...t, delayDays: daysBetween(t.expectedEndDate, today) }))
    .sort((a, b) => b.delayDays - a.delayDays);
}

export function delayBuckets(delayed) {
  const b = [
    { name: '1-3 days', value: 0, color: '#f59e0b' },
    { name: '4-7 days', value: 0, color: '#ef4444' },
    { name: '>7 days', value: 0, color: '#7c3aed' },
  ];
  for (const t of delayed) b[t.delayDays <= 3 ? 0 : t.delayDays <= 7 ? 1 : 2].value++;
  return b;
}

export function hoursBy(entries, keyFn) {
  const out = new Map();
  for (const e of entries) {
    const k = keyFn(e) || 'Unspecified';
    const cur = out.get(k) || { name: k, hours: 0, billable: 0, billingAmount: 0, costingAmount: 0 };
    cur.hours += e.hours;
    if (e.isBillable) cur.billable += e.hours;
    cur.billingAmount += e.billingAmount;
    cur.costingAmount += e.costingAmount;
    out.set(k, cur);
  }
  return [...out.values()].map((r) => ({
    ...r, hours: round(r.hours), billable: round(r.billable),
    billingAmount: round(r.billingAmount), costingAmount: round(r.costingAmount),
  }));
}

/** Sum of `pick(entry)` per calendar month for the last `months` months ending at `today` (zero-filled). */
export function monthlyTotals(entries, today, months, pick) {
  const [y, m] = today.split('-').map(Number);
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const e of entries) {
    const k = e.date.slice(0, 7);
    if (totals.has(k)) totals.set(k, totals.get(k) + pick(e));
  }
  const label = (k) => new Date(`${k}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return keys.map((k) => ({ date: label(k), value: round(totals.get(k)) }));
}

export const monthlyHours = (entries, today, months = 7) => monthlyTotals(entries, today, months, (e) => e.hours);

/** Estimated cost vs timesheet costing / billing per project. */
export function projectCosts(projects, entries) {
  return projects.map((p) => {
    const mine = entries.filter((e) => e.project === p.projectName);
    const estimated = Number(p.estimatedCost) || 0;
    const costing = round(sum(mine, (e) => e.costingAmount));
    return {
      id: p.id,
      name: p.projectName,
      status: p.status,
      estimated,
      hours: round(sum(mine, (e) => e.hours)),
      costing,
      billing: round(sum(mine, (e) => e.billingAmount)),
      variance: round(estimated - costing),
    };
  });
}

export function dashboardStats(projects, tasks, timesheets, today) {
  const entries = entryRows(timesheets);
  const month = today.slice(0, 7);
  const thisMonth = entries.filter((e) => e.date.startsWith(month));
  return {
    openProjects: projects.filter((p) => p.status === 'Open').length,
    completedProjects: projects.filter((p) => p.status === 'Completed').length,
    openTasks: tasks.filter((t) => !isClosed(t)).length,
    delayedTasks: delayedTasks(tasks, today).length,
    hoursThisMonth: round(sum(thisMonth, (e) => e.hours)),
    billableThisMonth: round(sum(thisMonth, (e) => e.billingAmount)),
    totalBilling: round(sum(entries, (e) => e.billingAmount)),
    totalCosting: round(sum(entries, (e) => e.costingAmount)),
  };
}

export const formatINR = (n) =>
  `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** Compact INR for chart axes, e.g. 42,00,00,000 -> "42Cr". */
export const compactINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
