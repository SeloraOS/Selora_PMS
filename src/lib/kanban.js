/**
 * Kanban pipelines: the field a board is grouped by. Each page offers a few of them.
 * A pipeline provides its columns, how to read an item's column, and the update a drop applies.
 * Values match the database CHECK constraints (0011_integrity.sql) for status/priority.
 */
import { approvalState } from './site.js';

export const NONE = '__none'; // column for items without a value

const PROJECT_COLUMNS = [
  { id: 'Open', label: 'Open', color: '#3b82f6' },
  { id: 'Completed', label: 'Completed', color: '#22c55e' },
  { id: 'Cancelled', label: 'Cancelled', color: '#9ca3af' },
];
const TASK_COLUMNS = [
  { id: 'Open', label: 'Open', color: '#3b82f6' },
  { id: 'Working', label: 'Working', color: '#f59e0b' },
  { id: 'Pending', label: 'Pending', color: '#8b5cf6' },
  { id: 'Overdue', label: 'Overdue', color: '#ef4444' },
  { id: 'Completed', label: 'Completed', color: '#22c55e' },
  { id: 'Cancelled', label: 'Cancelled', color: '#9ca3af' },
];
const TIMESHEET_COLUMNS = [
  { id: 'Draft', label: 'Draft', color: '#9ca3af' },
  { id: 'Submitted', label: 'Submitted', color: '#3b82f6' },
  { id: 'Billed', label: 'Billed', color: '#22c55e' },
  { id: 'Cancelled', label: 'Cancelled', color: '#ef4444' },
];
const PRIORITY_COLUMNS = [
  { id: 'Low', label: 'Low', color: '#6b7280' },
  { id: 'Medium', label: 'Medium', color: '#3b82f6' },
  { id: 'High', label: 'High', color: '#f59e0b' },
  { id: 'Urgent', label: 'Urgent', color: '#ef4444' },
];

const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#6366f1'];
const unassigned = { id: NONE, label: 'Unassigned', color: '#9ca3af' };

const fixed = (cols) => () => cols;
/** Columns for a list of known names (always includes Unassigned). */
const named = (names) => [...names.map((n, i) => ({ id: n, label: n, color: PALETTE[i % PALETTE.length] })), unassigned];
/** Columns from the distinct values present on the items; Unassigned only when needed. */
const distinct = (items, read) => {
  const values = [...new Set(items.map(read).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return [...named(values).slice(0, -1), ...(items.some((i) => !read(i)) ? [unassigned] : [])];
};
const column = (read) => (item) => read(item) || NONE;
const value = (id) => (id === NONE ? '' : id);

/** ctx: { projects, projectTypes } (UI projects from ProjectsContext, rows from SetupContext) */
export const PIPELINES = {
  project: [
    { id: 'status', label: 'Status', field: 'status', columns: fixed(PROJECT_COLUMNS), column: (p) => p.status, patch: (c) => ({ status: c }) },
    { id: 'priority', label: 'Priority', field: 'priority', columns: fixed(PRIORITY_COLUMNS), column: (p) => p.priority, patch: (c) => ({ priority: c }) },
    { id: 'type', label: 'Project Type', field: 'projectType', columns: (_items, ctx) => named(ctx.projectTypes.map((t) => t.name)), column: column((p) => p.projectType), patch: (c) => ({ projectType: value(c) }) },
    { id: 'department', label: 'Department', field: 'department', columns: (items) => distinct(items, (p) => p.department), column: column((p) => p.department), patch: (c) => ({ department: value(c) }) },
  ],
  task: [
    { id: 'status', label: 'Status', field: 'status', columns: fixed(TASK_COLUMNS), column: (t) => t.status, patch: (c) => ({ status: c }) },
    { id: 'priority', label: 'Priority', field: 'priority', columns: fixed(PRIORITY_COLUMNS), column: (t) => t.priority, patch: (c) => ({ priority: c }) },
    { id: 'project', label: 'Project', field: 'project', columns: (_items, ctx) => named(ctx.projects.map((p) => p.projectName)), column: column((t) => t.project), patch: (c) => ({ project: value(c) }) },
  ],
  timesheet: [
    { id: 'status', label: 'Status', field: 'status', columns: fixed(TIMESHEET_COLUMNS), column: (t) => t.status, patch: (c) => ({ status: c }) },
    { id: 'employee', label: 'Employee', field: 'employee', columns: (items) => distinct(items, (t) => t.employee), column: column((t) => t.employee), patch: (c) => ({ employee: value(c) }) },
    { id: 'project', label: 'Project', field: 'project', columns: (_items, ctx) => named(ctx.projects.map((p) => p.projectName)), column: column((t) => t.project), patch: (c) => ({ project: value(c) }) },
    { id: 'customer', label: 'Customer', field: 'customer', columns: (items) => distinct(items, (t) => t.customer), column: column((t) => t.customer), patch: (c) => ({ customer: value(c) }) },
  ],
};


// ── DB-row entities (snags, approvals, finance, ...). Their pipelines read ctx too (project/vendor names, today). ──
const col = (id, label, color) => ({ id, label, color });
const SNAG_STATUS = [col('Open', 'Open', '#f59e0b'), col('Fixed', 'Fixed', '#3b82f6'), col('Verified', 'Verified', '#22c55e'), col('Rejected', 'Rejected', '#9ca3af')];
const SEVERITY = [col('Low', 'Low', '#6b7280'), col('Medium', 'Medium', '#3b82f6'), col('High', 'High', '#f59e0b'), col('Critical', 'Critical', '#ef4444')];
const APPROVAL_STATUS = [col('Not started', 'Not started', '#9ca3af'), col('Applied', 'Applied', '#3b82f6'), col('Approved', 'Approved', '#22c55e'), col('Rejected', 'Rejected', '#ef4444')];
const VALIDITY = [col('valid', 'Valid', '#22c55e'), col('expiring', 'Expiring soon', '#f59e0b'), col('expired', 'Expired', '#ef4444'), col('pending', 'Not approved yet', '#3b82f6'), col('rejected', 'Rejected', '#9ca3af')];
const WO_STATUS = [col('draft', 'Draft', '#9ca3af'), col('pending_approval', 'Pending approval', '#f59e0b'), col('approved', 'Approved', '#22c55e'), col('closed', 'Closed', '#3b82f6'), col('cancelled', 'Cancelled', '#ef4444')];
const BILL_STATUS = [col('draft', 'Draft', '#9ca3af'), col('submitted', 'Submitted', '#f59e0b'), col('approved', 'Approved', '#3b82f6'), col('paid', 'Paid', '#22c55e'), col('rejected', 'Rejected', '#ef4444')];
const MR_STATUS = [col('requested', 'Requested', '#f59e0b'), col('approved', 'Approved', '#3b82f6'), col('ordered', 'Ordered', '#8b5cf6'), col('delivered', 'Delivered', '#22c55e'), col('rejected', 'Rejected', '#ef4444')];
const DPR_STATUS = [col('draft', 'Draft', '#f59e0b'), col('submitted', 'Submitted', '#22c55e')];
const UPDATE_TYPE = [col('Progress', 'Progress', '#3b82f6'), col('Milestone', 'Milestone', '#22c55e'), col('Issue', 'Issue', '#ef4444'), col('Other', 'Other', '#9ca3af')];
const HEALTH = [col('ok', 'On track', '#22c55e'), col('warn', 'Near limit', '#f59e0b'), col('over', 'Over budget', '#ef4444'), col('unbudgeted', 'No budget', '#9ca3af'), col('none', 'Nothing yet', '#6b7280')];

const field = (id, label, columns, key) => ({ id, label, field: key, columns: fixed(columns), column: (r) => r[key], patch: (c) => ({ [key]: c }) });
const byName = (id, label, namesOf, read) => ({ id, label, readOnly: true, columns: (_items, ctx) => named(namesOf(ctx)), column: (r, ctx) => read(r, ctx) || NONE, patch: () => ({}) });
const projectPipe = byName('project', 'Project', (ctx) => ctx.projects.map((p) => p.projectName), (r, ctx) => ctx.projectName?.(r.project_id));
const vendorPipe = byName('vendor', 'Vendor', (ctx) => (ctx.vendors || []).map((v) => v.name), (r, ctx) => ctx.vendorName?.(r.vendor_id));

Object.assign(PIPELINES, {
  snag: [
    field('status', 'Status', SNAG_STATUS, 'status'),
    field('severity', 'Severity', SEVERITY, 'severity'),
    { id: 'category', label: 'Category', field: 'category', columns: (_i, ctx) => named((ctx.categories || []).map((c) => c.name)), column: column((r) => r.category), patch: (c) => ({ category: value(c) }) },
    projectPipe,
  ],
  approval: [
    field('status', 'Status', APPROVAL_STATUS, 'status'),
    { id: 'validity', label: 'Validity', readOnly: true, columns: fixed(VALIDITY), column: (r, ctx) => approvalState(r, ctx.today, ctx.warnDays).key, patch: () => ({}) },
    projectPipe,
  ],
  workOrder: [
    field('status', 'Status', WO_STATUS, 'status'),
    vendorPipe,
    byName('costHead', 'Cost head', (ctx) => (ctx.costHeads || []).map((c) => c.name), (r, ctx) => ctx.headName?.(r.cost_head_id)),
    projectPipe,
  ],
  raBill: [field('status', 'Status', BILL_STATUS, 'status'), vendorPipe, projectPipe],
  materialRequest: [field('status', 'Status', MR_STATUS, 'status'), projectPipe],
  dailyReport: [field('status', 'Status', DPR_STATUS, 'status'), projectPipe],
  projectUpdate: [field('type', 'Type', UPDATE_TYPE, 'type'), projectPipe],
  budget: [
    { id: 'health', label: 'Budget health', readOnly: true, columns: fixed(HEALTH), column: (r) => r.health.key, patch: () => ({}) },
    byName('costHead', 'Cost head', (ctx) => (ctx.costHeads || []).map((c) => c.name), (r) => r.head.name),
  ],
});

export const pipelineById = (entity, id) => PIPELINES[entity].find((p) => p.id === id) || PIPELINES[entity][0];

/** Date shown on cards, dd/mm/yyyy */
export const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '');
