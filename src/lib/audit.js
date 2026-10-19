/** Human-readable summaries of audit_log rows (see supabase/migrations/0020). Pure, unit-tested. */
const LABELS = {
  status: 'Status', priority: 'Priority', subject: 'Subject', project_name: 'Name', description: 'Description',
  expected_start_date: 'Expected start', expected_end_date: 'Expected end', actual_start_date: 'Actual start', actual_end_date: 'Actual end',
  assignee_id: 'Assignee', weight: 'Weight', department: 'Department', company: 'Company', customer: 'Customer', estimated_cost: 'Estimated cost',
  role: 'Role', name: 'File',
};
const HIDDEN = new Set(['id', 'code', 'created_at', 'created_by', 'updated_at', 'project_id', 'storage_path']);

const label = (key) => LABELS[key] || key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** @returns {{ title: string, details: string[] }} */
export function summarizeAudit(entry) {
  const noun = { projects: 'project', project_tasks: 'task', timesheets: 'timesheet', project_updates: 'update', project_users: 'member', attachments: 'file', pm_settings: 'settings', profiles: 'user' }[entry.table_name] || entry.table_name;
  if (entry.action === 'insert') return { title: `Created ${noun}`, details: [] };
  if (entry.action === 'delete') return { title: `Deleted ${noun}`, details: [] };
  const details = Object.entries(entry.changes || {})
    .filter(([k]) => !HIDDEN.has(k))
    .map(([k, v]) => `${label(k)}: ${show(v?.old)} → ${show(v?.new)}`);
  return { title: `Updated ${noun}`, details };
}
