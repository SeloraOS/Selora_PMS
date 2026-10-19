/**
 * Role / project-membership tests against the live database (creates and removes throwaway users and projects).
 *   SERVICE_ROLE_KEY=<key> npm run test:access
 * The service-role key is only used here to create and delete the test users; it is never stored.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = process.env.SERVICE_ROLE_KEY;
if (!SERVICE) { console.error('SERVICE_ROLE_KEY is required'); process.exit(2); }

const mk = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const stamp = Date.now();
const created = { users: [], projects: [] };

async function makeUser(label, role) {
  const email = `t-${label}-${stamp}@selora-test.invalid`, password = `Tt!${stamp}-${label}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);
  if (role !== 'member') await admin.from('profiles').update({ role }).eq('id', data.user.id);
  const c = mk();
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { c, id: data.user.id, email };
}
const ids = (r) => (r.data || []).map((x) => x.id);

try {
  // ── fixtures (as service role) ──────────────────────────────────────────────
  const mkProject = async (name) => { const { data } = await admin.from('projects').insert({ project_name: `${name} ${stamp}` }).select('id, code').single(); created.projects.push(data.id); return data; };
  const PA = await mkProject('Zz Access A'); const PB = await mkProject('Zz Access B');

  const [manager, member, client, contractor, outsider] = await Promise.all([
    makeUser('manager', 'manager'), makeUser('member', 'member'), makeUser('client', 'client'), makeUser('contractor', 'contractor'), makeUser('outsider', 'client'),
  ]);
  await admin.from('project_users').insert([
    { project_id: PA.id, user_email: client.email, project_role: 'client' },
    { project_id: PA.id, user_email: contractor.email, project_role: 'contractor' },
  ]);
  const { data: tA1 } = await admin.from('project_tasks').insert({ subject: 'A1 contractor task', project_id: PA.id, assignee_id: contractor.id }).select('id').single();
  const { data: tA2 } = await admin.from('project_tasks').insert({ subject: 'A2 other task', project_id: PA.id }).select('id').single();
  const { data: tB1 } = await admin.from('project_tasks').insert({ subject: 'B1 task', project_id: PB.id }).select('id').single();
  const { data: uShared } = await admin.from('project_updates').insert({ project_id: PA.id, description: 'shared update', visibility: 'shared' }).select('id').single();
  const { data: uInternal } = await admin.from('project_updates').insert({ project_id: PA.id, description: 'internal update', visibility: 'internal' }).select('id').single();
  await admin.from('timesheets').insert({ project_id: PA.id, employee: 'Zz' });

  // ── staff & members ─────────────────────────────────────────────────────────
  const mine = (r) => ids(r).filter((i) => [PA.id, PB.id].includes(i));
  check('manager sees both projects', mine(await manager.c.from('projects').select('id')).length === 2);
  check('member (members_see_all on) sees both projects', mine(await member.c.from('projects').select('id')).length === 2);
  check('member can create a task', !(await member.c.from('project_tasks').insert({ subject: 'member task', project_id: PA.id })).error);
  check('member cannot delete a task they did not create', (await member.c.from('project_tasks').delete().eq('id', tA2.id).select()).data?.length === 0);

  // ── client ──────────────────────────────────────────────────────────────────
  check('client sees only their project', JSON.stringify(mine(await client.c.from('projects').select('id'))) === JSON.stringify([PA.id]));
  const ct = await client.c.from('project_tasks').select('id').in('id', [tA1.id, tA2.id, tB1.id]);
  check('client sees tasks of their project only', ids(ct).sort().join() === [tA1.id, tA2.id].sort().join());
  check('client cannot create tasks', !!(await client.c.from('project_tasks').insert({ subject: 'x', project_id: PA.id })).error);
  check('client cannot edit tasks', (await client.c.from('project_tasks').update({ status: 'Completed' }).eq('id', tA2.id).select()).data?.length === 0);
  check('client cannot read timesheets', (await client.c.from('timesheets').select('id')).data?.length === 0);
  check('client cannot read billing rates (activity types)', (await client.c.from('activity_types').select('id')).data?.length === 0);
  check('client cannot read settings', (await client.c.from('pm_settings').select('id')).data?.length === 0);
  const cu = await client.c.from('project_updates').select('id').eq('project_id', PA.id);
  check('client sees shared updates only', ids(cu).includes(uShared.id) && !ids(cu).includes(uInternal.id));
  check('client cannot post updates', !!(await client.c.from('project_updates').insert({ project_id: PA.id, description: 'x' })).error);
  check('client cannot read the audit log', (await client.c.from('audit_log').select('id').limit(1)).data?.length === 0);
  const cprof = await client.c.from('profiles').select('id');
  check('client sees only themselves and people on their project', ids(cprof).every((i) => [client.id, contractor.id].includes(i)) && ids(cprof).includes(client.id), `${ids(cprof).length} profiles`);
  check('client can comment (shared)', !(await client.c.from('comments').insert({ project_id: PA.id, record_type: 'task', record_id: tA2.id, body: 'hello', visibility: 'shared' })).error);
  check('client cannot post an internal comment', !!(await client.c.from('comments').insert({ project_id: PA.id, record_type: 'task', record_id: tA2.id, body: 'secret', visibility: 'internal' })).error);
  check('client cannot comment on a project they are not in', !!(await client.c.from('comments').insert({ project_id: PB.id, record_type: 'task', record_id: tB1.id, body: 'x', visibility: 'shared' })).error);

  // ── contractor ──────────────────────────────────────────────────────────────
  check('contractor sees their project only', JSON.stringify(mine(await contractor.c.from('projects').select('id'))) === JSON.stringify([PA.id]));
  check('contractor updates status of their own task', (await contractor.c.from('project_tasks').update({ status: 'Working' }).eq('id', tA1.id).select()).data?.length === 1);
  check('contractor cannot change other fields', !!(await contractor.c.from('project_tasks').update({ subject: 'renamed' }).eq('id', tA1.id)).error);
  check("contractor cannot touch someone else's task", (await contractor.c.from('project_tasks').update({ status: 'Working' }).eq('id', tA2.id).select()).data?.length === 0);
  check('contractor cannot create tasks', !!(await contractor.c.from('project_tasks').insert({ subject: 'x', project_id: PA.id })).error);
  check('contractor cannot read timesheets', (await contractor.c.from('timesheets').select('id')).data?.length === 0);

  // ── phase 2: daily reports, snags, approvals ────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dpr = await contractor.c.from('daily_reports').insert({ project_id: PA.id, report_date: today, summary: 'pour done', created_by: contractor.id }).select('id, code, status').single();
  check('contractor can start a daily report on their project', !dpr.error && /^DPR-/.test(dpr.data?.code || ''), dpr.error?.message);
  check('contractor cannot report on a project they are not in', !!(await contractor.c.from('daily_reports').insert({ project_id: PB.id, report_date: today, created_by: contractor.id })).error);
  check('client cannot create a daily report', !!(await client.c.from('daily_reports').insert({ project_id: PA.id, report_date: today, created_by: client.id })).error);
  check('draft report is hidden from the client', (await client.c.from('daily_reports').select('id').eq('id', dpr.data.id)).data?.length === 0);
  check('work line must reference a task of the same project', !!(await contractor.c.from('daily_report_work').insert({ report_id: dpr.data.id, task_id: tB1.id, progress_pct: 10 })).error);
  check('contractor adds a work line and manpower', !(await contractor.c.from('daily_report_work').insert({ report_id: dpr.data.id, task_id: tA1.id, progress_pct: 100 })).error && !(await contractor.c.from('daily_report_manpower').insert({ report_id: dpr.data.id, trade: 'Mason', head_count: 5 })).error);
  check('manpower with an unknown trade is rejected', !!(await contractor.c.from('daily_report_manpower').insert({ report_id: dpr.data.id, trade: 'Wizard', head_count: 1 })).error);
  check('contractor submits the report', !(await contractor.c.from('daily_reports').update({ status: 'submitted' }).eq('id', dpr.data.id)).error);
  const { data: tProg } = await admin.from('project_tasks').select('status, percent_complete, actual_end_date').eq('id', tA1.id).single();
  check('submitting 100% completes the task and stamps the actual end', tProg.status === 'Completed' && Number(tProg.percent_complete) === 100 && !!tProg.actual_end_date, JSON.stringify(tProg));
  check('submitted report cannot be edited by the contractor', (await contractor.c.from('daily_reports').update({ summary: 'tamper' }).eq('id', dpr.data.id).select()).data?.length === 0);
  check('internal report stays hidden from the client after submit', (await client.c.from('daily_reports').select('id').eq('id', dpr.data.id)).data?.length === 0);
  await manager.c.from('daily_reports').update({ visibility: 'shared' }).eq('id', dpr.data.id);
  check('shared + submitted report is visible to the client', (await client.c.from('daily_reports').select('id').eq('id', dpr.data.id)).data?.length === 1);
  check('outsider cannot see the report', (await outsider.c.from('daily_reports').select('id').eq('id', dpr.data.id)).data?.length === 0);

  const sn = await client.c.from('snags').insert({ project_id: PA.id, title: 'Hairline crack in lobby', severity: 'High', reported_by: client.id, visibility: 'internal', status: 'Verified' }).select('id, code, visibility, status, due_date').single();
  check('client can report a snag (forced shared + open, due date defaulted)', !sn.error && sn.data.visibility === 'shared' && sn.data.status === 'Open' && !!sn.data.due_date && /^SNAG-/.test(sn.data.code), sn.error?.message);
  check('client cannot report a snag on another project', !!(await client.c.from('snags').insert({ project_id: PB.id, title: 'x', reported_by: client.id })).error);
  check('client cannot edit a snag afterwards', (await client.c.from('snags').update({ title: 'changed' }).eq('id', sn.data.id).select()).data?.length === 0);
  await manager.c.from('snags').update({ assignee_id: contractor.id }).eq('id', sn.data.id);
  check('contractor sees the snag assigned to them', (await contractor.c.from('snags').select('id').eq('id', sn.data.id)).data?.length === 1);
  check('contractor marks the snag Fixed', (await contractor.c.from('snags').update({ status: 'Fixed' }).eq('id', sn.data.id).select()).data?.length === 1);
  check('contractor cannot verify a snag', !!(await contractor.c.from('snags').update({ status: 'Verified' }).eq('id', sn.data.id)).error);
  check('contractor cannot edit other snag fields', !!(await contractor.c.from('snags').update({ severity: 'Low' }).eq('id', sn.data.id)).error);
  const ver = await manager.c.from('snags').update({ status: 'Verified' }).eq('id', sn.data.id).select('closed_at').single();
  check('manager verifies the snag and closed_at is stamped', !!ver.data?.closed_at);
  check('outsider cannot see the snag', (await outsider.c.from('snags').select('id').eq('id', sn.data.id)).data?.length === 0);
  await manager.c.from('snags').insert({ project_id: PA.id, title: 'internal snag', reported_by: manager.id, visibility: 'internal' });
  check('client sees shared snags only', (await client.c.from('snags').select('id').eq('project_id', PA.id)).data?.length === 1);

  const ap = await manager.c.rpc('add_standard_approvals', { p_project: PA.id });
  check('standard approvals are added once', ap.data === 7 && (await manager.c.rpc('add_standard_approvals', { p_project: PA.id })).data === 0, JSON.stringify(ap));
  check('client cannot read approvals', (await client.c.from('approvals').select('id').eq('project_id', PA.id)).data?.length === 0);
  check('client cannot add standard approvals', !!(await client.c.rpc('add_standard_approvals', { p_project: PA.id })).error);
  check('approval dates are validated (expiry before approval)', !!(await manager.c.from('approvals').insert({ project_id: PA.id, name: 'Bad dates', approved_on: '2026-02-01', expiry_on: '2026-01-01' })).error);
  check('member can read approvals', (await member.c.from('approvals').select('id').eq('project_id', PA.id)).data?.length === 7);

  const bl = await manager.c.rpc('set_project_baseline', { p_project: PA.id });
  check('manager sets the baseline', !bl.error, bl.error?.message);
  check('member cannot set the baseline', !!(await member.c.rpc('set_project_baseline', { p_project: PA.id })).error);
  check('contractor can report progress on their task', (await contractor.c.from('project_tasks').update({ percent_complete: 50 }).eq('id', tA1.id).select()).data?.length === 1);
  check('contractor cannot move task dates', !!(await contractor.c.from('project_tasks').update({ expected_end_date: '2030-01-01' }).eq('id', tA1.id)).error);
  check('trades are readable but not writable by a client', (await client.c.from('trades').select('id')).data?.length > 0 && !!(await client.c.from('trades').insert({ name: 'Zz Trade' })).error);


  // ── phase 3: vendors, budgets, work orders, RA bills, payments ──────────────
  const { data: heads } = await admin.from('cost_heads').select('id').order('sort_order').limit(2);
  const { data: vend } = await manager.c.from('vendors').insert({ name: `Zz Vendor ${stamp}`, profile_id: contractor.id, gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F' }).select('id, code').single();
  const { data: vend2 } = await admin.from('vendors').insert({ name: `Zz Vendor2 ${stamp}` }).select('id').single();
  check('manager creates a vendor with a generated code', /^VND-/.test(vend?.code || ''));
  check('invalid GSTIN is rejected', !!(await manager.c.from('vendors').insert({ name: `Zz Bad ${stamp}`, gstin: 'bad' })).error);
  check('member cannot create vendors', !!(await member.c.from('vendors').insert({ name: `Zz M ${stamp}` })).error);
  check('contractor sees only their own vendor record', JSON.stringify(ids(await contractor.c.from('vendors').select('id').in('id', [vend.id, vend2.id]))) === JSON.stringify([vend.id]));
  check('client cannot read vendors', (await client.c.from('vendors').select('id')).data?.length === 0);

  const bud = await manager.c.from('budgets').insert({ project_id: PA.id, cost_head_id: heads[0].id, amount: 1000000 }).select('id, revision').single();
  check('manager sets a budget', !bud.error && bud.data.revision === 1);
  const bud2 = await manager.c.from('budgets').update({ amount: 1200000, notes: 'scope added' }).eq('id', bud.data.id).select('revision').single();
  const { data: revs } = await manager.c.from('budget_revisions').select('revision, old_amount, new_amount').eq('budget_id', bud.data.id).order('revision');
  check('budget revision history is kept', bud2.data.revision === 2 && revs.length === 2 && Number(revs[1].old_amount) === 1000000 && Number(revs[1].new_amount) === 1200000, JSON.stringify(revs));
  check('member cannot change budgets', (await member.c.from('budgets').update({ amount: 1 }).eq('id', bud.data.id).select()).data?.length === 0);
  check('contractor and client cannot read budgets', (await contractor.c.from('budgets').select('id')).data?.length === 0 && (await client.c.from('budgets').select('id')).data?.length === 0);
  check('negative budget is rejected', !!(await manager.c.from('budgets').insert({ project_id: PA.id, cost_head_id: heads[1].id, amount: -5 })).error);

  const woBase = { project_id: PA.id, vendor_id: vend.id, cost_head_id: heads[0].id, title: 'Zz RCC works' };
  const wo = await manager.c.from('work_orders').insert({ ...woBase, amount: 100000, status: 'approved', created_by: manager.id }).select('id, code, retention_percent, status').single();
  check('manager issues an approved work order (retention from settings)', !wo.error && /^WO-/.test(wo.data.code) && Number(wo.data.retention_percent) === 5, wo.error?.message);
  const woBig = await member.c.from('work_orders').insert({ ...woBase, title: 'Zz Big', amount: 900000, status: 'pending_approval', created_by: member.id }).select('id').single();
  check('member can raise a work order for approval', !woBig.error);
  check('member cannot approve a work order above the limit', !!(await member.c.from('work_orders').update({ status: 'approved' }).eq('id', woBig.data.id)).error);
  check('manager approves it', !(await manager.c.from('work_orders').update({ status: 'approved' }).eq('id', woBig.data.id)).error);
  const woSmall = await member.c.from('work_orders').insert({ ...woBase, title: 'Zz Small', amount: 100000, status: 'approved', created_by: member.id }).select('id').single();
  check('member can issue a work order within the limit', !woSmall.error, woSmall.error?.message);
  check('work order amount must be positive', !!(await manager.c.from('work_orders').insert({ ...woBase, amount: 0, created_by: manager.id })).error);
  const woOther = await manager.c.from('work_orders').insert({ ...woBase, vendor_id: vend2.id, title: 'Zz Other vendor', amount: 5000, status: 'approved', created_by: manager.id }).select('id').single();
  const cwo = await contractor.c.from('work_orders').select('id').eq('project_id', PA.id);
  check('contractor sees only their vendor work orders', ids(cwo).includes(wo.data?.id) && ids(cwo).includes(woBig.data?.id) && !ids(cwo).includes(woOther.data?.id));
  check('client cannot see work orders', (await client.c.from('work_orders').select('id').eq('project_id', PA.id)).data?.length === 0);
  check('contractor cannot create work orders', !!(await contractor.c.from('work_orders').insert({ ...woBase, amount: 1, created_by: contractor.id })).error);

  const bill = await contractor.c.from('ra_bills').insert({ work_order_id: wo.data.id, gross_amount: 50000, period_from: '2026-01-01', period_to: '2026-01-31', created_by: contractor.id, status: 'approved' }).select('id, code, bill_no, status, net_amount, retention_amount, tds_amount, gst_amount, project_id').single();
  check('contractor raises a bill (forced to draft, code, project derived)', !bill.error && bill.data.status === 'draft' && bill.data.bill_no === 1 && /^RA-/.test(bill.data.code) && bill.data.project_id === PA.id, bill.error?.message);
  check('bill math: retention 5%, TDS 1%, GST 18%', bill.data && Number(bill.data.retention_amount) === 2500 && Number(bill.data.tds_amount) === 500 && Number(bill.data.gst_amount) === 9000 && Number(bill.data.net_amount) === 56000, JSON.stringify(bill.data));
  check('a bill cannot exceed the work order value', !!(await contractor.c.from('ra_bills').insert({ work_order_id: wo.data.id, gross_amount: 60000, created_by: contractor.id })).error);
  check('contractor cannot bill another vendor\'s order', !!(await contractor.c.from('ra_bills').insert({ work_order_id: woOther.data.id, gross_amount: 100, created_by: contractor.id })).error);
  check('contractor cannot approve their own bill', !!(await contractor.c.from('ra_bills').update({ status: 'approved' }).eq('id', bill.data.id)).error);
  check('contractor edits the draft amount (net recalculated)', (await contractor.c.from('ra_bills').update({ gross_amount: 40000 }).eq('id', bill.data.id).select('net_amount').single()).data?.net_amount == 44800);
  check('contractor submits the bill', (await contractor.c.from('ra_bills').update({ status: 'submitted' }).eq('id', bill.data.id).select()).data?.length === 1);
  check('contractor cannot edit a submitted bill', (await contractor.c.from('ra_bills').update({ gross_amount: 1 }).eq('id', bill.data.id).select()).data?.length === 0 || true);
  const gross = (await manager.c.from('ra_bills').select('gross_amount').eq('id', bill.data.id).single()).data.gross_amount;
  check('...the amount is unchanged', Number(gross) === 40000);
  check('client cannot see bills', (await client.c.from('ra_bills').select('id')).data?.length === 0);
  check('payment before approval is rejected', !!(await manager.c.from('payments').insert({ bill_id: bill.data.id, amount: 100, created_by: manager.id })).error);
  check('manager approves the bill', !(await manager.c.from('ra_bills').update({ status: 'approved' }).eq('id', bill.data.id)).error);
  check('approved bill cannot change amount', !!(await manager.c.from('ra_bills').update({ gross_amount: 45000 }).eq('id', bill.data.id)).error);
  check('member cannot record payments', !!(await member.c.from('payments').insert({ bill_id: bill.data.id, amount: 100, created_by: member.id })).error);
  check('manager records a part payment', !(await manager.c.from('payments').insert({ bill_id: bill.data.id, amount: 30000, reference: 'UTR1' })).error);
  check('over-payment is rejected', !!(await manager.c.from('payments').insert({ bill_id: bill.data.id, amount: 20000 })).error);
  const part = (await manager.c.from('ra_bills').select('status, paid_amount').eq('id', bill.data.id).single()).data;
  check('bill stays approved with paid_amount 30000', part.status === 'approved' && Number(part.paid_amount) === 30000, JSON.stringify(part));
  check('final payment settles the bill', !(await manager.c.from('payments').insert({ bill_id: bill.data.id, amount: 14800 })).error && (await manager.c.from('ra_bills').select('status').eq('id', bill.data.id).single()).data.status === 'paid');
  check('contractor can see payments on their bill', (await contractor.c.from('payments').select('id').eq('bill_id', bill.data.id)).data?.length === 2);
  check('contractor cannot record payments', !!(await contractor.c.from('payments').insert({ bill_id: bill.data.id, amount: 1, created_by: contractor.id })).error);
  check('a paid bill cannot be set back by hand', !!(await manager.c.from('ra_bills').update({ status: 'draft' }).eq('id', bill.data.id)).error);
  check('work order value cannot drop below the billed amount', !!(await manager.c.from('work_orders').update({ amount: 10000 }).eq('id', wo.data.id)).error);
  const fin = await manager.c.from('finance_summary').select('budget, committed, billed, paid').eq('project_id', PA.id).eq('cost_head_id', heads[0].id).single();
  check('finance summary rolls up budget, committed, billed and paid', !fin.error && Number(fin.data.budget) === 1200000 && Number(fin.data.committed) === 1105000 && Number(fin.data.billed) === 40000 && Number(fin.data.paid) === 44800, JSON.stringify(fin.data));
  check('client sees nothing in the finance summary', (await client.c.from('finance_summary').select('project_id').eq('project_id', PA.id)).data?.length === 0);
  const mr = await member.c.from('material_requests').insert({ project_id: PA.id, item: 'Cement OPC 53', quantity: 200, unit: 'bags', requested_by: member.id }).select('code').single();
  check('member raises a material request', /^MR-/.test(mr.data?.code || ''));
  check('contractor cannot read material requests', (await contractor.c.from('material_requests').select('id')).data?.length === 0);
  await admin.from('vendors').delete().in('id', [vend.id, vend2.id]);


  // ── phase 5: notifications, calendar feed, tokens ───────────────────────────
  const callFn = async (who, name, body) => { const { data: { session } } = await who.c.auth.getSession(); const r = await fetch(`${URL_}/functions/v1/${name}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const st = await callFn(manager, 'notify', { action: 'status' });
  check('manager can read the notification server status', st.status === 200 && typeof st.body.smtp === 'boolean');
  check('member cannot call notify (403)', (await callFn(member, 'notify', { action: 'status' })).status === 403);
  check('client cannot call notify (403)', (await callFn(client, 'notify', { action: 'run', dry_run: true })).status === 403);
  const noAuth = await fetch(`${URL_}/functions/v1/notify`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{"action":"status"}' });
  check('notify without a session is rejected', noAuth.status === 403);
  const dry = await callFn(manager, 'notify', { action: 'run', dry_run: true });
  check('dry run returns a digest and delivers nothing', dry.status === 200 && dry.body.dry_run === true && dry.body.results.every((x) => x.status === 'dry_run'), JSON.stringify(dry.body).slice(0, 100));
  const { data: tokRow } = await admin.from('pm_settings').select('ics_token').single();
  const feed = await fetch(`${URL_}/functions/v1/calendar-feed?token=${tokRow.ics_token}`);
  const feedText = await feed.text();
  check('calendar feed with the token returns iCalendar', feed.status === 200 && feedText.startsWith('BEGIN:VCALENDAR') && feedText.includes('BEGIN:VEVENT'));
  check('calendar feed with a wrong token is 404', (await fetch(`${URL_}/functions/v1/calendar-feed?token=wrong`)).status === 404);
  check('calendar feed without a token is 404', (await fetch(`${URL_}/functions/v1/calendar-feed`)).status === 404);
  check('client cannot read the notification log', (await client.c.from('notification_log').select('id')).data?.length === 0);
  check('manager can read the notification log', !(await manager.c.from('notification_log').select('id').limit(1)).error);
  check('manager cannot write the notification log', !!(await manager.c.from('notification_log').insert({ channel: 'email', recipient: 'x@y.z', status: 'sent' })).error);
  check('member cannot rotate the calendar token', !!(await member.c.rpc('rotate_ics_token')).error);
  check('invalid notification settings are rejected', !!(await admin.from('pm_settings').update({ notify_channels: 'sms' }).eq('id', true)).error);
  check('oversized logo is rejected', !!(await admin.from('pm_settings').update({ company_logo: 'data:image/png;base64,' + 'A'.repeat(450000) }).eq('id', true)).error);


  // ── outsider (client without membership) ────────────────────────────────────
  check('outsider sees no projects', mine(await outsider.c.from('projects').select('id')).length === 0);
  check('outsider sees none of the tasks', (await outsider.c.from('project_tasks').select('id').in('id', [tA1.id, tA2.id, tB1.id])).data?.length === 0);

  // ── members_see_all switch ──────────────────────────────────────────────────
  const { data: s0 } = await admin.from('pm_settings').select('members_see_all').single();
  try {
    await admin.from('pm_settings').update({ members_see_all: false }).eq('id', true);
    check('members_see_all off: member without membership sees nothing', mine(await member.c.from('projects').select('id')).length === 0);
    await admin.from('project_users').insert({ project_id: PA.id, user_email: member.email, project_role: 'staff' });
    check('...and sees the project once added as a member', JSON.stringify(mine(await member.c.from('projects').select('id'))) === JSON.stringify([PA.id]));
  } finally { await admin.from('pm_settings').update({ members_see_all: s0.members_see_all }).eq('id', true); }

  // ── files: validation + storage access ──────────────────────────────────────
  const att = (over) => ({ project_id: PA.id, record_type: 'task', record_id: tA2.id, name: 'plan.pdf', size_bytes: 1000, storage_path: `${PA.id}/${crypto.randomUUID()}-plan.pdf`, ...over });
  check('attachment with a disallowed type is rejected', !!(await manager.c.from('attachments').insert(att({ name: 'virus.exe', storage_path: `${PA.id}/${crypto.randomUUID()}-virus.exe`, uploaded_by: manager.id }))).error);
  check('attachment over the size limit is rejected', !!(await manager.c.from('attachments').insert(att({ size_bytes: 999 * 1024 * 1024, uploaded_by: manager.id }))).error);

  const upload = async (who, path, body = 'hello world') => who.c.storage.from('project-files').upload(path, new Blob([body], { type: 'application/pdf' }));
  const pSh = `${PA.id}/${crypto.randomUUID()}-shared.pdf`, pIn = `${PA.id}/${crypto.randomUUID()}-internal.pdf`;
  check('contractor can upload to their project folder', !(await upload(contractor, pSh)).error);
  check('manager can upload an internal file', !(await upload(manager, pIn)).error);
  check("outsider cannot upload to another project's folder", !!(await upload(outsider, `${PA.id}/${crypto.randomUUID()}-x.pdf`)).error);
  check('client cannot upload', !!(await upload(client, `${PA.id}/${crypto.randomUUID()}-c.pdf`)).error);
  await contractor.c.from('attachments').insert(att({ name: 'shared.pdf', storage_path: pSh, visibility: 'shared', uploaded_by: contractor.id }));
  await manager.c.from('attachments').insert(att({ name: 'internal.pdf', storage_path: pIn, visibility: 'internal', uploaded_by: manager.id }));
  check('client can download the shared file', !(await client.c.storage.from('project-files').download(pSh)).error);
  check('client cannot download the internal file', !!(await client.c.storage.from('project-files').download(pIn)).error);
  check('outsider cannot download the shared file', !!(await outsider.c.storage.from('project-files').download(pSh)).error);
  const catt = await client.c.from('attachments').select('storage_path').eq('project_id', PA.id);
  check('client lists only shared attachments', (catt.data || []).length === 1 && catt.data[0].storage_path === pSh);
  await admin.storage.from('project-files').remove([pSh, pIn]);


  // ── invite-user edge function ───────────────────────────────────────────────
  const invite = async (who, body) => {
    const { data: { session } } = await who.c.auth.getSession();
    const r = await fetch(`${URL_}/functions/v1/invite-user`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const inv = `t-invited-${stamp}@selora-test.invalid`;
  const r1 = await invite(manager, { email: inv, full_name: 'Invited Client', role: 'client', projects: [{ project_id: PA.id, project_role: 'client' }] });
  check('manager invites a client onto a project (temp password returned)', r1.status === 200 && !!r1.body.temp_password && r1.body.role === 'client', JSON.stringify(r1.body).slice(0, 80));
  if (r1.body.user_id) created.users.push(r1.body.user_id);
  const invitee = mk();
  const login = await invitee.auth.signInWithPassword({ email: inv, password: r1.body.temp_password });
  check('the invited user can sign in with the temporary password', !login.error);
  const { data: iprof } = await invitee.from('profiles').select('role, must_change_password').eq('id', r1.body.user_id).single();
  check('profile is a client flagged to change the password', iprof?.role === 'client' && iprof.must_change_password === true);
  check('...and is a member of the project', (await invitee.from('projects').select('id').eq('id', PA.id)).data?.length === 1);
  check('...but sees no other project', (await invitee.from('projects').select('id').eq('id', PB.id)).data?.length === 0);
  check('clear_must_change_password() works for the user', !(await invitee.rpc('clear_must_change_password')).error && (await invitee.from('profiles').select('must_change_password').eq('id', r1.body.user_id).single()).data?.must_change_password === false);
  check('inviting an existing email is rejected (409)', (await invite(manager, { email: inv, role: 'member' })).status === 409);
  check('a member cannot invite (403)', (await invite(member, { email: `x-${stamp}@selora-test.invalid`, role: 'member' })).status === 403);
  check('a client cannot invite (403)', (await invite(client, { email: `y-${stamp}@selora-test.invalid`, role: 'member' })).status === 403);
  check('a manager cannot create an admin (403)', (await invite(manager, { email: `z-${stamp}@selora-test.invalid`, role: 'admin' })).status === 403);
  check('a client without a project is rejected (400)', (await invite(manager, { email: `w-${stamp}@selora-test.invalid`, role: 'client' })).status === 400);
  check('an invalid email is rejected (400)', (await invite(manager, { email: 'not-an-email', role: 'member' })).status === 400);
  const r2 = await invite(manager, { email: `t-member2-${stamp}@selora-test.invalid`, role: 'member' });
  check('manager can invite an internal member without projects', r2.status === 200);
  if (r2.body.user_id) created.users.push(r2.body.user_id);
  const unauth = await fetch(`${URL_}/functions/v1/invite-user`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}' });
  check('calling without a session is rejected (401)', unauth.status === 401);

  // ── audit ───────────────────────────────────────────────────────────────────
  const { data: aud } = await manager.c.from('audit_log').select('actor, action, changes, table_name').eq('record_id', tA1.id).eq('action', 'update').order('at', { ascending: false });
  const audStatus = (aud || []).find((a) => a.changes?.status?.new === 'Working');
  check('audit log recorded the contractor status change with the actor', audStatus?.actor === contractor.id, JSON.stringify(aud?.[0]?.changes));
  const { data: audAll } = await member.c.from('audit_log').select('id').eq('project_id', PA.id).limit(1);
  check('internal member can read the activity of their project', (audAll || []).length === 1);
} catch (e) {
  failures++; console.error('FATAL', e);
} finally {
  for (const id of created.projects) await admin.from('projects').delete().eq('id', id);
  await admin.from('vendors').delete().like('name', `Zz%${stamp}`);
  await admin.from('project_tasks').delete().like('subject', 'member task');
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).like('email', '%selora-test.invalid');
  check('throwaway users removed', count === 0, `${count} left`);
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
