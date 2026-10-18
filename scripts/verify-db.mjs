/**
 * Verifies that the frontend field mappings match the live database and that data round-trips.
 *   npm run verify:db      (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_DEMO_* from .env.local)
 * Creates temporary rows as the demo user and always deletes them again.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as m from '../src/lib/mappers.js';
import { scheduleTemplateTasks } from '../src/lib/templates.js';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// ── 1. mapped fields vs real columns ─────────────────────────────────────────
const { error: loginErr } = await sb.auth.signInWithPassword({ email: env.VITE_DEMO_EMAIL, password: env.VITE_DEMO_PASSWORD });
if (loginErr) { console.error('demo login failed:', loginErr.message); process.exit(2); }
const { data: colRows, error: colErr } = await sb.rpc('verify_columns');
if (colErr) { console.error('verify_columns() failed (apply migration 0015):', colErr.message); process.exit(2); }
const columns = {};
for (const r of colRows) (columns[r.table_name] ||= []).push(r.column_name);
// Columns intentionally not part of the field specs (system columns or handled by relation code in mappers.js)
const COMMON = ['id', 'code', 'created_by', 'created_at', 'updated_at'];
const HANDLED = {
  projects: ['project_type_id'],
  project_tasks: ['project_id', 'parent_task_id'],
  timesheets: ['project_id', 'total_working_hours', 'total_billable_hours', 'total_billable_amount', 'total_costing_amount'],
};
// timesheet_entries.task_id is exercised in the settings section below
for (const [table, fields] of Object.entries(m.SPECS)) {
  const cols = columns[table] || [];
  const mapped = fields.map((f) => f[1]);
  const missing = mapped.filter((c) => !cols.includes(c));
  const unmapped = cols.filter((c) => !mapped.includes(c) && ![...COMMON, ...HANDLED[table]].includes(c));
  check(`${table}: every mapped field exists as a column`, !missing.length, missing.join(', '));
  check(`${table}: every column is mapped or intentionally handled`, !unmapped.length, unmapped.join(', '));
}

// ── 2. relations: every foreign key target resolves (embedded selects) ───────
const embeds = [
  ['projects', '*, project_users(*), project_types(name), project_templates(name), holiday_lists(name), companies(name)'],
  ['project_tasks', '*, task_dependencies!task_dependencies_task_id_fkey(depends_on_id), projects(project_name)'],
  ['timesheets', '*, timesheet_entries(*, activity_types(name)), projects(project_name)'],
  ['project_templates', '*, project_template_tasks(*), project_types(name)'],
  ['holiday_lists', '*, holidays(*)'],
  ['project_updates', '*, projects(project_name)'],
  ['activity_costs', '*, activity_types(name)'],
];
for (const [t, sel] of embeds) {
  const { error } = await sb.from(t).select(sel).limit(1);
  check(`relations embed on ${t}`, !error, error?.message);
}

// ── 3. round trips through the real mappers ──────────────────────────────────
const created = []; // [table, id] for cleanup
let settingsBackup = null;
const eq = (a, b) => (typeof b === 'number' || typeof a === 'number' ? Number(a) === Number(b) : String(a) === String(b));
const compare = (name, got, want) => {
  const bad = Object.keys(want).filter((k) => !eq(got[k], want[k]));
  check(name, !bad.length, bad.map((k) => `${k}: got ${JSON.stringify(got[k])} want ${JSON.stringify(want[k])}`).join('; '));
};

try {
  const [{ data: types }, { data: templates }, { data: holidayLists }] = await Promise.all([
    sb.from('project_types').select('*'), sb.from('project_templates').select('*'), sb.from('holiday_lists').select('*'),
  ]);
  let idx = m.indexProjects([], types, []);

  // project
  const projectUi = {
    series: 'PROJ-.####', projectName: `VERIFY ${Date.now()}`, fromTemplate: templates[0].name, company: 'Selora Realty',
    status: 'Open', projectType: types[0].name, percentCompleteMethod: 'Manual', priority: 'High', department: 'QA',
    isActive: 'No', estimatedCost: '12345.5', defaultCostCenter: 'CC1', collectProgress: true, holidayList: holidayLists[0].name,
    frequencyToCollectProgress: 'Weekly', fromTime: '09:30', toTime: '18:00', subject: 'subj', message: 'msg',
    customer: 'Acme', salesOrder: 'SO-1', notes: 'n', description: 'd',
    expectedStartDate: '2026-11-01', expectedEndDate: '2026-12-01', actualStartDate: '2026-11-02', actualEndDate: '2026-12-02',
  };
  const { data: pRow, error: pErr } = await sb.from('projects').insert(m.projectToRow(projectUi, idx)).select('*, project_users(*)').single();
  check('project insert', !pErr, pErr?.message);
  created.push(['projects', pRow.id]);
  const { error: puErr } = await sb.from('project_users').insert(m.projectUserRows(pRow.id, [{ user: 'a@x.test', fullName: 'A' }, { user: 'A@X.TEST', fullName: 'dup' }, { user: '', fullName: 'blank' }]));
  check('project users insert (dups/blank dropped)', !puErr, puErr?.message);
  const { data: pFull } = await sb.from('projects').select('*, project_users(*)').eq('id', pRow.id).single();
  const projectBack = m.projectFromRow(pFull, idx);
  compare('project round trip', projectBack, projectUi);
  check('project users round trip', projectBack.users.length === 1 && projectBack.users[0].user === 'a@x.test');
  idx = m.indexProjects([pFull], types, []);

  // tasks: parent + dependency + yes/no flags
  const parentUi = { subject: 'verify parent', project: projectUi.projectName, isTemplate: 'No', isGroup: 'Yes', status: 'Working', priority: 'Urgent', weight: '40', description: 'd', company: 'Selora Realty', department: 'QA', expectedStartDate: '2026-11-01', expectedEndDate: '2026-11-10', actualStartDate: '', actualEndDate: '', issue: 'i', type: 't', color: '#fff' };
  const { data: parent, error: e1 } = await sb.from('project_tasks').insert(m.taskToRow(parentUi, idx)).select('*').single();
  check('parent task insert', !e1, e1?.message); created.push(['project_tasks', parent.id]);
  idx = m.indexProjects([pFull], types, [parent]);
  const childUi = { ...parentUi, subject: 'verify child', isGroup: 'No', isTemplate: 'Yes', parentTask: parent.code, status: 'Open', priority: 'Low' };
  const { data: child, error: e2 } = await sb.from('project_tasks').insert(m.taskToRow(childUi, idx)).select('*').single();
  check('child task insert with parent', !e2, e2?.message); created.push(['project_tasks', child.id]);
  idx = m.indexProjects([pFull], types, [parent, child]);
  const { error: depErr } = await sb.from('task_dependencies').insert(m.dependencyRows(child.id, [{ taskId: parent.code }], idx));
  check('dependency insert', !depErr, depErr?.message);
  const { data: childFull } = await sb.from('project_tasks').select('*, task_dependencies!task_dependencies_task_id_fkey(depends_on_id)').eq('id', child.id).single();
  const childBack = m.taskFromRow(childFull, idx);
  compare('task round trip (yes/no flags, parent, deps)', { ...childBack, dep: childBack.dependencies[0]?.taskId }, { ...childUi, dep: parent.code });
  check('"No" is stored as false', parent.is_template === false && parent.is_group === true && child.is_template === true);
  const { error: loopErr } = await sb.from('project_tasks').update({ parent_task_id: child.id }).eq('id', parent.id);
  check('parent loop is rejected', !!loopErr, loopErr ? '' : 'update succeeded');
  const { error: cycErr } = await sb.from('task_dependencies').insert({ task_id: parent.id, depends_on_id: child.id });
  check('dependency cycle is rejected', !!cycErr, cycErr ? '' : 'insert succeeded');
  const { error: codeErr } = await sb.from('project_tasks').update({ code: 'TASK-HACK' }).eq('id', child.id);
  check('code cannot be changed', !!codeErr);

  // timesheet + entries
  const tsUi = { series: 'TS-.YYYY.-', status: 'Draft', company: 'Selora Realty', project: projectUi.projectName, customer: 'Acme', currency: 'INR', exchangeRate: '1.5', employee: 'Rohan Mehta', note: 'n' };
  const { data: ts, error: e3 } = await sb.from('timesheets').insert(m.timesheetToRow(tsUi, idx)).select('*').single();
  check('timesheet insert', !e3, e3?.message); created.push(['timesheets', ts.id]);
  const entriesUi = [
    { activityType: 'Site Supervision', fromTime: '2026-11-03T08:00', hrs: 2, project: projectUi.projectName, isBillable: true },
    { activityType: 'Marketing', fromTime: '', hrs: '1.5', project: '', isBillable: false },
  ];
  const { error: e4 } = await sb.from('timesheet_entries').insert(m.entriesToRows(ts.id, entriesUi, idx));
  check('entries insert', !e4, e4?.message);
  const { data: tsFull } = await sb.from('timesheets').select('*, timesheet_entries(*)').eq('id', ts.id).single();
  const tsBack = m.timesheetFromRow(tsFull, idx);
  compare('timesheet round trip', tsBack, tsUi);
  check('entries round trip (order, hours, rates resolved)', tsBack.timeSheets.length === 2 && tsBack.timeSheets[0].activityType === 'Site Supervision' && tsBack.timeSheets[0].billingRate > 0 && tsBack.timeSheets[1].isBillable === false);
  check('totals = sum of entries', Number(tsBack.totalWorkingHours) === 3.5 && Number(tsBack.totalBillableHours) === 2);
  const { error: unk } = await sb.from('timesheet_entries').insert({ timesheet_id: ts.id, activity_type: 'No Such Activity', hours: 1 });
  check('unknown activity type is rejected (FK)', !!unk);
  const { error: neg } = await sb.from('timesheet_entries').insert({ timesheet_id: ts.id, activity_type: 'Marketing', hours: -1 });
  check('negative hours rejected (CHECK)', !!neg);
  const { error: badCo } = await sb.from('projects').update({ company: 'Nope Inc' }).eq('id', pRow.id);
  check('unknown company rejected (FK)', !!badCo);
  const { error: badDates } = await sb.from('projects').update({ expected_end_date: '2020-01-01' }).eq('id', pRow.id);
  check('end before start rejected (CHECK)', !!badDates);

  // deleting the project: users cascade, tasks are kept but unlinked
  const { error: delErr } = await sb.from('projects').delete().eq('id', pRow.id);
  check('project delete works with parent/child tasks', !delErr, delErr?.message);
  const { count: usersLeft } = await sb.from('project_users').select('id', { count: 'exact', head: true }).eq('project_id', pRow.id);
  check('project users cascade-deleted', usersLeft === 0);
  const { data: orphan } = await sb.from('project_tasks').select('project_id').eq('id', child.id).single();
  check('tasks survive project delete with project unset', orphan && orphan.project_id === null);

  // ── 4. create from template schedules the template's tasks ──────────────────
  {
    const { data: tpl } = await sb.from('project_templates').select('*, project_template_tasks(*)').eq('name', 'Marketing Launch Template').single();
    const { data: tp } = await sb.from('projects').insert({ project_name: `VERIFY tpl ${Date.now()}`, from_template: tpl.name, expected_start_date: '2026-11-01' }).select('id, company, expected_start_date').single();
    created.push(['projects', tp.id]);
    const rows = scheduleTemplateTasks(tp, tpl.project_template_tasks, '2026-01-01').map((r) => ({ ...r, subject: `verify ${r.subject}` }));
    const { data: made, error: tErr } = await sb.from('project_tasks').insert(rows).select('subject, expected_start_date, expected_end_date');
    check('template tasks inserted', !tErr && made.length === tpl.project_template_tasks.length, tErr?.message);
    const byName = Object.fromEntries(made.map((t) => [t.subject, t]));
    check('template schedule: start = project start + start_day, end inclusive',
      byName['verify Collateral and brochure']?.expected_start_date === '2026-11-01' && byName['verify Collateral and brochure']?.expected_end_date === '2026-11-30' &&
      byName['verify Launch event']?.expected_start_date === '2027-01-15' && byName['verify Launch event']?.expected_end_date === '2027-01-17');
    const { count } = await sb.from('project_tasks').select('id', { count: 'exact', head: true }).eq('project_id', tp.id);
    check('only the template tasks belong to the new project', count === tpl.project_template_tasks.length, `${count}`);
    await sb.from('project_tasks').delete().eq('project_id', tp.id);
  }

  // ── 5. settings behaviours (original values are restored in finally) ────────
  const { data: s0 } = await sb.from('pm_settings').select('*').single();
  settingsBackup = s0;
  const setFlags = (f) => sb.from('pm_settings').update(f).eq('id', true);

  {
    // limit timesheet
    const { data: lp } = await sb.from('projects').insert({ project_name: `VERIFY limit ${Date.now()}` }).select('id').single();
    created.push(['projects', lp.id]);
    const { data: openT } = await sb.from('project_tasks').insert({ subject: 'verify open', project_id: lp.id, status: 'Open' }).select('id').single();
    const { data: doneT } = await sb.from('project_tasks').insert({ subject: 'verify done', project_id: lp.id, status: 'Completed' }).select('id').single();
    const { data: lts } = await sb.from('timesheets').insert({ employee: 'verify', project_id: lp.id }).select('id').single();
    created.push(['timesheets', lts.id]);
    const entry = (extra) => sb.from('timesheet_entries').insert({ timesheet_id: lts.id, project_id: lp.id, activity_type: 'Marketing', hours: 1, ...extra });

    await setFlags({ limit_timesheet: false, auto_close_tasks: false });
    check('limit OFF: row without a task is allowed', !(await entry({})).error);
    check('limit OFF: row with an active task is allowed', !(await entry({ task_id: openT.id })).error);
    await setFlags({ limit_timesheet: true });
    check('limit ON: row without a task is rejected', !!(await entry({})).error);
    check('limit ON: row with a completed task is rejected', !!(await entry({ task_id: doneT.id })).error);
    check('limit ON: row with an active task is allowed', !(await entry({ task_id: openT.id })).error);
    const { data: other } = await sb.from('project_tasks').select('id').neq('project_id', lp.id).eq('status', 'Open').limit(1).single();
    check('task from another project is rejected', !!(await entry({ task_id: other.id })).error);
    await setFlags({ limit_timesheet: false });
  }

  {
    // auto close
    const mkProject = async (label) => {
      const { data } = await sb.from('projects').insert({ project_name: `VERIFY ${label} ${Date.now()}` }).select('id').single();
      created.push(['projects', data.id]);
      return data.id;
    };
    const mkTask = async (project_id, subject, extra = {}) =>
      (await sb.from('project_tasks').insert({ subject: `verify ${subject}`, project_id, ...extra }).select('id').single()).data.id;
    const status = async (table, id) => (await sb.from(table).select('status').eq('id', id).single()).data.status;

    await setFlags({ auto_close_tasks: true });
    const p1 = await mkProject('auto');
    const parent = await mkTask(p1, 'parent', { is_group: true });
    const c1 = await mkTask(p1, 'child1', { parent_task_id: parent });
    const c2 = await mkTask(p1, 'child2', { parent_task_id: parent });
    await sb.from('project_tasks').update({ status: 'Completed' }).eq('id', c1);
    check('auto close: parent stays open while a child is open', (await status('project_tasks', parent)) === 'Open');
    await sb.from('project_tasks').update({ status: 'Completed' }).eq('id', c2);
    check('auto close: parent completes with its last child', (await status('project_tasks', parent)) === 'Completed');
    check('auto close: project completes with its last task (cascade through the parent)', (await status('projects', p1)) === 'Completed');
    const { data: pe } = await sb.from('projects').select('actual_end_date').eq('id', p1).single();
    check('auto close: actual end date is set', !!pe.actual_end_date);

    const p2 = await mkProject('cancel');
    const t1 = await mkTask(p2, 'only');
    await sb.from('project_tasks').update({ status: 'Cancelled' }).eq('id', t1);
    check('auto close: cancelling every task does not complete the project', (await status('projects', p2)) === 'Open');

    const p3 = await mkProject('tpl');
    const tmpl = await mkTask(p3, 'template', { is_template: true });
    const real = await mkTask(p3, 'real');
    await sb.from('project_tasks').update({ status: 'Completed' }).eq('id', real);
    check('auto close: template tasks are ignored', (await status('projects', p3)) === 'Completed');

    await setFlags({ auto_close_tasks: false });
    const p4 = await mkProject('off');
    const o1 = await mkTask(p4, 'off1');
    await sb.from('project_tasks').update({ status: 'Completed' }).eq('id', o1);
    check('auto close OFF: nothing changes automatically', (await status('projects', p4)) === 'Open');
  }

} finally {
  if (settingsBackup) {
    const { limit_timesheet, auto_close_tasks, task_alerts } = settingsBackup;
    await sb.from('pm_settings').update({ limit_timesheet, auto_close_tasks, task_alerts }).eq('id', true);
    const { data: back } = await sb.from('pm_settings').select('limit_timesheet, auto_close_tasks, task_alerts').single();
    check('settings restored to their original values', JSON.stringify(back) === JSON.stringify({ limit_timesheet, auto_close_tasks, task_alerts }));
  }
  for (const [table, id] of created.reverse()) await sb.from(table).delete().eq('id', id);
  await sb.from('project_tasks').delete().like('subject', 'verify %'); // tasks outlive their (deleted) projects
  const { count } = await sb.from('project_tasks').select('id', { count: 'exact', head: true }).like('subject', 'verify %');
  check('temporary rows cleaned up', count === 0, `${count} left`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
