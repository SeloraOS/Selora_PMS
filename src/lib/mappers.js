/**
 * Maps between database rows (snake_case, typed) and the camelCase objects the
 * Projects pages work with. The UI-facing `id` is the human-readable `code`
 * (PROJ-0001 ...), and project references on tasks/timesheets use the project name.
 */

const ymd = (v) => (v ? String(v).slice(0, 10) : '');
const hm = (v) => (v ? String(v).slice(0, 5) : '');
const dt = (v) => (v ? String(v).slice(0, 16) : '');
const orNull = (v) => (v === '' || v === undefined ? null : v);
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const createdOn = (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '');

// kind -> [fromRow, toRow]
const KINDS = {
  text: [(v) => v ?? '', (v) => orNull(v)],
  bool: [(v) => !!v, (v) => !!v],
  yesno: [(v) => (v ? 'Yes' : 'No'), (v) => v === 'Yes' || v === true],
  num: [(v) => (v ?? ''), num],
  date: [ymd, orNull],
  time: [hm, orNull],
  ts: [dt, orNull],
};

function fromRow(spec, row) {
  const out = {};
  for (const [ui, db, kind] of spec) out[ui] = KINDS[kind][0](row[db]);
  return out;
}

// Only fields present on `ui` are written, so partial updates stay partial.
function toRow(spec, ui) {
  const out = {};
  for (const [uiKey, db, kind] of spec) {
    if (Object.prototype.hasOwnProperty.call(ui, uiKey)) out[db] = KINDS[kind][1](ui[uiKey]);
  }
  return out;
}

const PROJECT_SPEC = [
  ['series', 'series', 'text'],
  ['projectName', 'project_name', 'text'],
  ['fromTemplate', 'from_template', 'text'],
  ['company', 'company', 'text'],
  ['status', 'status', 'text'],
  ['percentCompleteMethod', 'percent_complete_method', 'text'],
  ['priority', 'priority', 'text'],
  ['department', 'department', 'text'],
  ['isActive', 'is_active', 'yesno'],
  ['estimatedCost', 'estimated_cost', 'num'],
  ['defaultCostCenter', 'default_cost_center', 'text'],
  ['collectProgress', 'collect_progress', 'bool'],
  ['holidayList', 'holiday_list', 'text'],
  ['frequencyToCollectProgress', 'frequency_to_collect_progress', 'text'],
  ['fromTime', 'from_time', 'time'],
  ['toTime', 'to_time', 'time'],
  ['subject', 'subject', 'text'],
  ['message', 'message', 'text'],
  ['customer', 'customer', 'text'],
  ['salesOrder', 'sales_order', 'text'],
  ['notes', 'notes', 'text'],
  ['description', 'description', 'text'],
  ['expectedStartDate', 'expected_start_date', 'date'],
  ['expectedEndDate', 'expected_end_date', 'date'],
  ['actualStartDate', 'actual_start_date', 'date'],
  ['actualEndDate', 'actual_end_date', 'date'],
];

const TASK_SPEC = [
  ['subject', 'subject', 'text'],
  ['assigneeId', 'assignee_id', 'text'],
  ['isTemplate', 'is_template', 'yesno'],
  ['issue', 'issue', 'text'],
  ['type', 'type', 'text'],
  ['color', 'color', 'text'],
  ['isGroup', 'is_group', 'yesno'],
  ['status', 'status', 'text'],
  ['priority', 'priority', 'text'],
  ['weight', 'weight', 'num'],
  ['description', 'description', 'text'],
  ['company', 'company', 'text'],
  ['department', 'department', 'text'],
  ['expectedStartDate', 'expected_start_date', 'date'],
  ['expectedEndDate', 'expected_end_date', 'date'],
  ['actualStartDate', 'actual_start_date', 'date'],
  ['actualEndDate', 'actual_end_date', 'date'],
];

const TIMESHEET_SPEC = [
  ['series', 'series', 'text'],
  ['status', 'status', 'text'],
  ['company', 'company', 'text'],
  ['customer', 'customer', 'text'],
  ['currency', 'currency', 'text'],
  ['exchangeRate', 'exchange_rate', 'num'],
  ['employee', 'employee', 'text'],
  ['note', 'note', 'text'],
];

/** Field specs, exported for scripts/verify-db.mjs and tests. */
export const SPECS = { projects: PROJECT_SPEC, project_tasks: TASK_SPEC, timesheets: TIMESHEET_SPEC };

const nameOf = (projectsById, id) => (id && projectsById.get(id)?.project_name) || '';
const idOf = (projectsByName, name) => (name ? projectsByName.get(name)?.id ?? null : null);

export const indexProjects = (rows, types = [], tasks = []) => ({
  byId: new Map(rows.map((r) => [r.id, r])),
  byName: new Map(rows.map((r) => [r.project_name, r])),
  typeById: new Map(types.map((t) => [t.id, t])),
  typeByName: new Map(types.map((t) => [t.name, t])),
  taskById: new Map(tasks.map((t) => [t.id, t])),
  taskByCode: new Map(tasks.map((t) => [t.code, t])),
});

export const projectFromRow = (row, idx) => ({
  ...fromRow(PROJECT_SPEC, row),
  id: row.code,
  dbId: row.id,
  projectType: idx?.typeById.get(row.project_type_id)?.name ?? '',
  users: (row.project_users || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((u) => ({ user: u.user_email, fullName: u.full_name ?? '', selected: false })),
  createdBy: row.created_by,
  createdAt: row.created_at,
  createdOn: createdOn(row),
});
export function projectToRow(ui, idx) {
  const out = toRow(PROJECT_SPEC, ui);
  if (Object.prototype.hasOwnProperty.call(ui, 'projectType')) {
    out.project_type_id = ui.projectType ? idx?.typeByName.get(ui.projectType)?.id ?? null : null;
  }
  return out;
}

export const taskFromRow = (row, idx) => ({
  ...fromRow(TASK_SPEC, row),
  id: row.code,
  dbId: row.id,
  project: nameOf(idx.byId, row.project_id),
  parentTask: idx.taskById.get(row.parent_task_id)?.code ?? '',
  dependencies: (row.task_dependencies || [])
    .map((d) => idx.taskById.get(d.depends_on_id))
    .filter(Boolean)
    .map((t) => ({ taskId: t.code, subject: t.subject, selected: false })),
  createdBy: row.created_by,
  createdAt: row.created_at,
  createdOn: createdOn(row),
});
export function taskToRow(ui, idx) {
  const out = toRow(TASK_SPEC, ui);
  if (Object.prototype.hasOwnProperty.call(ui, 'project')) out.project_id = idOf(idx.byName, ui.project);
  if (Object.prototype.hasOwnProperty.call(ui, 'parentTask')) {
    out.parent_task_id = ui.parentTask ? idx.taskByCode.get(ui.parentTask)?.id ?? null : null;
  }
  return out;
}
// project_users rows; blank and duplicate (case-insensitive) emails are dropped.
export function projectUserRows(projectId, users) {
  const seen = new Set();
  const rows = [];
  for (const u of users || []) {
    const email = String(u.user || '').trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    rows.push({ project_id: projectId, user_email: email, full_name: orNull(u.fullName), sort_order: rows.length });
  }
  return rows;
}

// Dependency rows for one task; ignores blanks, duplicates, unknown codes and self-references.
export function dependencyRows(taskId, deps, idx) {
  const ids = new Set();
  for (const d of deps || []) {
    const target = idx.taskByCode.get(d.taskId);
    if (target && target.id !== taskId) ids.add(target.id);
  }
  return [...ids].map((depends_on_id) => ({ task_id: taskId, depends_on_id }));
}

export const timesheetFromRow = (row, idx) => ({
  ...fromRow(TIMESHEET_SPEC, row),
  id: row.code,
  project: nameOf(idx.byId, row.project_id),
  timeSheets: (row.timesheet_entries || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({
      activityType: e.activity_type ?? '',
      fromTime: dt(e.from_time),
      hrs: Number(e.hours),
      project: nameOf(idx.byId, e.project_id),
      isBillable: e.is_billable,
      taskId: idx.taskById.get(e.task_id)?.code ?? '',
      billingRate: e.billing_rate === null ? null : Number(e.billing_rate),
      costingRate: e.costing_rate === null ? null : Number(e.costing_rate),
    })),
  totalWorkingHours: Number(row.total_working_hours),
  totalBillableHours: Number(row.total_billable_hours),
  totalBillableAmount: Number(row.total_billable_amount),
  totalCostingAmount: Number(row.total_costing_amount),
  createdBy: row.created_by,
  createdAt: row.created_at,
  createdOn: createdOn(row),
});
// Totals and entry rates are computed by database triggers, so they are never written from the client.
export function timesheetToRow(ui, idx) {
  const out = toRow(TIMESHEET_SPEC, ui);
  if (Object.prototype.hasOwnProperty.call(ui, 'project')) out.project_id = idOf(idx.byName, ui.project);
  return out;
}
export const entriesToRows = (timesheetId, entries, idx) =>
  (entries || []).map((e, i) => ({
    timesheet_id: timesheetId,
    activity_type: orNull(e.activityType),
    from_time: orNull(e.fromTime),
    hours: Number(e.hrs) || 0,
    project_id: idOf(idx.byName, e.project),
    task_id: e.taskId ? idx.taskByCode.get(e.taskId)?.id ?? null : null,
    is_billable: !!e.isBillable,
    sort_order: i,
  }));
