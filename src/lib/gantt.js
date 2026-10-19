/**
 * Pure Gantt helpers (no React). Dates are YYYY-MM-DD strings.
 * A task is { id, expectedStartDate, expectedEndDate, baselineStart, baselineEnd, dependencies: [{ taskId }] }.
 */
import { addDays } from './dates.js';

const MS = 86400000;
const dayNumber = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / MS);
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);

/** Inclusive span of a task, or null when it has no dates. A missing end/start falls back to the other. */
export function ganttSpan(t) {
  const s = t.expectedStartDate || t.expectedEndDate;
  const e = t.expectedEndDate || t.expectedStartDate;
  if (!s) return null;
  return { start: s, end: e < s ? s : e };
}

/**
 * Critical path: the tasks with zero slack in the longest dependency chain.
 * Uses each task's own duration (days, inclusive) and finish-to-start links; ignores unknown or cyclic links.
 * Returns a Set of task ids.
 */
export function criticalPath(tasks) {
  const byId = new Map();
  for (const t of tasks) { const span = ganttSpan(t); if (span) byId.set(t.id, { id: t.id, dur: daysBetween(span.start, span.end) + 1, preds: [], succs: [] }); }
  for (const t of tasks) {
    const n = byId.get(t.id);
    if (!n) continue;
    for (const d of t.dependencies || []) {
      const p = byId.get(d.taskId);
      if (p && p !== n) { n.preds.push(p); p.succs.push(n); }
    }
  }
  // topological order (Kahn); nodes left over are in a cycle and are skipped
  const indeg = new Map([...byId.values()].map((n) => [n.id, n.preds.length]));
  const queue = [...byId.values()].filter((n) => indeg.get(n.id) === 0);
  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    for (const s of n.succs) { indeg.set(s.id, indeg.get(s.id) - 1); if (indeg.get(s.id) === 0) queue.push(s); }
  }
  if (order.length !== byId.size) return new Set();
  for (const n of order) { n.es = Math.max(0, ...n.preds.map((p) => p.ef)); n.ef = n.es + n.dur; }
  const finish = Math.max(0, ...order.map((n) => n.ef));
  for (const n of [...order].reverse()) { n.lf = n.succs.length ? Math.min(...n.succs.map((s) => s.ls)) : finish; n.ls = n.lf - n.dur; }
  const hasLinks = order.some((n) => n.preds.length || n.succs.length);
  return new Set(hasLinks ? order.filter((n) => n.ls === n.es && (n.preds.length || n.succs.length)).map((n) => n.id) : []);
}

/** Visible range with a little padding; defaults to a month around `today` when there are no dates. */
export function ganttRange(tasks, today) {
  let min = null; let max = null;
  for (const t of tasks) {
    for (const d of [ganttSpan(t)?.start, ganttSpan(t)?.end, t.baselineStart, t.baselineEnd]) {
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
  }
  if (!min) return { from: addDays(today, -7), to: addDays(today, 30) };
  return { from: addDays(min, -2), to: addDays(max, 5) };
}

/** Offset (in days) and length (inclusive days) of a bar inside a range. */
export const barGeometry = (start, end, from) => ({ offset: daysBetween(from, start), length: daysBetween(start, end) + 1 });

/** Delay of the current end against the baseline end, in days (positive = late); null without a baseline. */
export function baselineSlip(t) {
  const span = ganttSpan(t);
  if (!span || !t.baselineEnd) return null;
  return daysBetween(t.baselineEnd, span.end);
}

/** Number of working days in [from, to] given a Set of weekday names ('Mon'..'Sun') and optional holiday dates. */
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function workingDays(from, to, working = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), holidays = new Set()) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (working.has(NAMES[new Date(`${d}T00:00:00Z`).getUTCDay()]) && !holidays.has(d)) n += 1;
  }
  return n;
}

/** Pixels per day for each zoom level. */
export const ZOOM_PX = { day: 32, week: 16, month: 6 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Header for a timeline: `months` = [{ label, offset, span }] (offset/span in days from `from`),
 * `marks` = [{ date, label, offset }] — every day (day zoom), every Monday (week zoom) or none (month zoom).
 */
export function ticks(from, to, zoom = 'week') {
  const total = daysBetween(from, to) + 1;
  const months = [];
  const marks = [];
  for (let i = 0; i < total; i++) {
    const d = addDays(from, i);
    const first = d.slice(8) === '01' || i === 0;
    if (first) months.push({ label: `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`, offset: i, span: 0 });
    months[months.length - 1].span += 1;
    const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
    if (zoom === 'day' || (zoom === 'week' && monday)) marks.push({ date: d, label: d.slice(8), offset: i });
  }
  return { months, marks };
}
