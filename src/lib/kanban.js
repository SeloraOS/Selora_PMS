/**
 * Kanban pipelines: the field a board is grouped by. Each page offers a few of them.
 * A pipeline provides its columns, how to read an item's column, and the update a drop applies.
 * Values match the database CHECK constraints (0011_integrity.sql) for status/priority.
 */
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

export const pipelineById = (entity, id) => PIPELINES[entity].find((p) => p.id === id) || PIPELINES[entity][0];

/** Date shown on cards, dd/mm/yyyy */
export const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '');
