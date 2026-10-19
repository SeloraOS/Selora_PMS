/** Pure helpers for approvals, snags and daily reports (no React). Dates are YYYY-MM-DD strings. */
import { addDays } from './dates.js';
import { daysBetween } from './gantt.js';

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const SNAG_STATUSES = ['Open', 'Fixed', 'Verified', 'Rejected'];
export const APPROVAL_STATUSES = ['Not started', 'Applied', 'Approved', 'Rejected'];

/** { key: 'expired'|'expiring'|'valid'|'pending'|'rejected', days } for an approval; days is until expiry (negative = past). */
export function approvalState(a, today, warnDays = 30) {
  if (a.status === 'Rejected') return { key: 'rejected', days: null };
  if (a.status !== 'Approved') return { key: 'pending', days: null };
  if (!a.expiry_on) return { key: 'valid', days: null };
  const days = daysBetween(today, a.expiry_on);
  if (days < 0) return { key: 'expired', days };
  return { key: days <= warnDays ? 'expiring' : 'valid', days };
}

export const snagOverdue = (s, today) => (s.status === 'Open' || s.status === 'Fixed') && !!s.due_date && s.due_date < today;

/** Open projects that have no submitted report for `today` (only after the cutoff time, HH:MM). */
export function missingReports(projects, reports, today, nowHm, cutoff = '18:00', required = false) {
  if (!required || nowHm < String(cutoff).slice(0, 5)) return [];
  const done = new Set(reports.filter((r) => r.report_date === today && r.status === 'submitted').map((r) => r.project_id));
  return projects.filter((p) => p.status === 'Open' && p.isActive !== 'No' && !done.has(p.dbId));
}

/** Alerts for the drawer: expiring/expired approvals, overdue snags, missing reports. */
export function siteAlerts({ approvals, snags, reports, projects }, { today, nowHm, settings }) {
  const warn = settings?.approval_warning_days ?? 30;
  const nameOf = new Map(projects.map((p) => [p.dbId, p.projectName]));
  const approvalAlerts = approvals
    .map((a) => ({ a, st: approvalState(a, today, warn) }))
    .filter(({ st }) => st.key === 'expired' || st.key === 'expiring')
    .sort((x, y) => x.st.days - y.st.days)
    .map(({ a, st }) => ({ id: a.id, title: a.name, project: nameOf.get(a.project_id) || '', days: st.days, expired: st.key === 'expired' }));
  const snagAlerts = snags.filter((s) => snagOverdue(s, today)).sort((x, y) => x.due_date.localeCompare(y.due_date))
    .map((s) => ({ id: s.id, code: s.code, title: s.title, project: nameOf.get(s.project_id) || '', days: daysBetween(s.due_date, today), severity: s.severity }));
  const missing = missingReports(projects, reports, today, nowHm, settings?.dpr_cutoff_time, settings?.dpr_required);
  return { approvals: approvalAlerts, snags: snagAlerts, missingReports: missing, count: approvalAlerts.length + snagAlerts.length + missing.length };
}

export const dueDateFor = (today, days) => addDays(today, Number(days) || 7);

/** Total head count of a report's manpower lines. */
export const totalManpower = (lines) => (lines || []).reduce((n, l) => n + (Number(l.head_count) || 0), 0);
