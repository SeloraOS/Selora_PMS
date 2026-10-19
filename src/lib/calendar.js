/**
 * Pure calendar helpers (no React). All dates are YYYY-MM-DD strings; weeks start on Monday.
 */
import { addDays } from './dates.js';

export const TYPES = ['task', 'project', 'timesheet', 'holiday', 'update'];
export const TYPE_LABELS = { task: 'Tasks', project: 'Project dates', timesheet: 'Timesheet hours', holiday: 'Holidays', update: 'Project updates' };
// order inside a day cell (what is most informative stays visible when a cell is crowded)
const ORDER = { holiday: 0, project: 1, update: 2, timesheet: 3, task: 4 };
// among tasks: overdue first, then the ones starting/ending that day, then the days in between
const taskRank = (e) => (e.overdue ? 0 : e.isStart || e.isEnd ? 1 : 2);

const MS = 86400000;
const dayNumber = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / MS);
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);
export const pad = (n) => String(n).padStart(2, '0');
export const toYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-11

/** 0 = Monday ... 6 = Sunday */
export const weekdayIndex = (ymd) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
export const monthStart = (ymd) => `${ymd.slice(0, 7)}-01`;
export const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
export const addMonths = (ymd, n) => {
  const d = new Date(`${monthStart(ymd)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** Weeks (arrays of 7 { date, inMonth }) covering the month; 4-6 rows depending on the month. */
export function monthGrid(year, month) {
  const first = toYmd(year, month, 1);
  const offset = weekdayIndex(first);
  const total = daysInMonth(year, month);
  const weeks = Math.ceil((offset + total) / 7);
  const start = addDays(first, -offset);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, inMonth: Number(date.slice(5, 7)) === month + 1 };
    })
  );
}

export const weekDays = (ymd) => {
  const start = addDays(ymd, -weekdayIndex(ymd));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Visible range for a view. */
export function rangeFor(view, cursor) {
  if (view === 'week') { const d = weekDays(cursor); return { from: d[0], to: d[6] }; }
  const y = Number(cursor.slice(0, 4)); const m = Number(cursor.slice(5, 7)) - 1;
  if (view === 'agenda') return { from: toYmd(y, m, 1), to: toYmd(y, m, daysInMonth(y, m)) };
  const grid = monthGrid(y, m);
  return { from: grid[0][0].date, to: grid[grid.length - 1][6].date };
}

export const rangeDays = (from, to) => Array.from({ length: Math.max(0, daysBetween(from, to) + 1) }, (_, i) => addDays(from, i));

/** Inclusive task span. Missing one date = that single day; missing both = null; end before start collapses to the start. */
export function taskSpan(task) {
  const s = task.expectedStartDate || ''; const e = task.expectedEndDate || '';
  if (!s && !e) return null;
  const start = s || e; const end = e || s;
  return { start, end: end < start ? start : end };
}

/** Move a task by `delta` days, keeping its length. Returns the date patch for updateProjectTask. */
export function shiftTask(task, delta) {
  const patch = {};
  if (task.expectedStartDate) patch.expectedStartDate = addDays(task.expectedStartDate, delta);
  if (task.expectedEndDate) patch.expectedEndDate = addDays(task.expectedEndDate, delta);
  return patch;
}

const isClosed = (t) => t.status === 'Completed' || t.status === 'Cancelled';

/**
 * Events for the visible range.
 * data: { tasks, projects, entries (reportData.entryRows), holidays [{holiday_date, description}], updates [{update_date,type,description,projects:{project_name}}] }
 * opts: { from, to, today, types:Set, project:'' }
 */
export function buildEvents(data, { from, to, today, types, project = '' }) {
  const inRange = (d) => d >= from && d <= to;
  const on = (t) => !types || types.has(t);
  const events = [];

  if (on('task')) {
    for (const t of data.tasks || []) {
      if (project && t.project !== project) continue;
      const span = taskSpan(t);
      if (!span || span.end < from || span.start > to) continue;
      const overdue = !isClosed(t) && span.end < today;
      for (const day of rangeDays(span.start < from ? from : span.start, span.end > to ? to : span.end)) {
        events.push({ key: `task:${t.id}:${day}`, type: 'task', date: day, id: t.id, title: t.subject, sub: t.project || '', status: t.status, priority: t.priority, overdue, isStart: day === span.start, isEnd: day === span.end, span, link: `/projects/task/${t.id}` });
      }
    }
  }

  if (on('project')) {
    for (const p of data.projects || []) {
      if (project && p.projectName !== project) continue;
      const add = (date, kind, label, extra = {}) => {
        if (date && inRange(date)) events.push({ key: `project:${p.id}:${kind}`, type: 'project', date, id: p.id, kind, title: `${label}: ${p.projectName}`, sub: p.status, status: p.status, link: `/projects/project/${p.id}`, ...extra });
      };
      add(p.expectedStartDate, 'start', 'Start');
      add(p.expectedEndDate, 'end', 'Due', { overdue: p.status === 'Open' && p.expectedEndDate < today });
      add(p.actualEndDate, 'done', 'Finished');
    }
  }

  if (on('timesheet')) {
    const byDay = new Map();
    for (const e of data.entries || []) {
      if (!e.date || !inRange(e.date) || (project && e.project !== project)) continue;
      const cur = byDay.get(e.date) || { hours: 0, people: new Map() };
      cur.hours += e.hours;
      cur.people.set(e.employee, (cur.people.get(e.employee) || 0) + e.hours);
      byDay.set(e.date, cur);
    }
    for (const [date, v] of byDay) {
      const hours = Math.round(v.hours * 100) / 100;
      events.push({ key: `timesheet:${date}`, type: 'timesheet', date, hours, title: `${hours} h logged`, sub: [...v.people].map(([n, h]) => `${n} ${Math.round(h * 100) / 100} h`).join(', '), link: '/projects/timesheet' });
    }
  }

  if (on('holiday')) {
    for (const h of data.holidays || []) if (inRange(h.holiday_date)) events.push({ key: `holiday:${h.holiday_date}`, type: 'holiday', date: h.holiday_date, title: h.description || 'Holiday', sub: '' });
  }

  if (on('update')) {
    for (const u of data.updates || []) {
      const name = u.projects?.project_name || '';
      if (!inRange(u.update_date) || (project && name !== project)) continue;
      events.push({ key: `update:${u.id}`, type: 'update', date: u.update_date, id: u.id, kind: u.type, title: u.description || u.type, sub: name, link: '/projects/setup/project-update' });
    }
  }
  return events;
}

export function groupByDay(events) {
  const map = new Map();
  for (const e of events) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); }
  for (const list of map.values()) list.sort((a, b) => ORDER[a.type] - ORDER[b.type] || (a.type === 'task' ? taskRank(a) - taskRank(b) : 0) || a.title.localeCompare(b.title));
  return map;
}
