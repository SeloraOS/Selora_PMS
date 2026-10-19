import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, WifiOff, Filter } from 'lucide-react';
import { useSelection } from '../../../lib/useSelection';
import { useViewMode } from '../../../lib/useViewMode';
import { useListPrefs } from '../../../lib/useListPrefs';
import { sortRows } from '../../../lib/sortRows';
import { useRowCtx } from '../../../lib/useRowCtx';
import ViewMenu from '../../../components/shared/ViewMenu';
import { SortMenu, ColumnsMenu, ExportMenu } from '../../../components/shared/ListMenus';
import RecordTable from '../../../components/shared/RecordTable';
import KanbanBoard from '../../../components/shared/KanbanBoard';
import { ReportCard } from '../rowCards';
import { useSite } from '../../../context/SiteContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useProjects } from '../../../context/ProjectsContext';
import { totalManpower } from '../../../lib/site';
import { todayStr } from '../../../lib/reportData';
import { FilesPanel } from '../../../components/shared/RecordPanels';

const page = { padding: '20px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' };
const card = { border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--card-bg)', padding: '16px' };
const input = { width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '14px', fontFamily: 'inherit' };
const btn = { padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' };
const primary = { ...btn, background: 'var(--gray-900)', borderColor: 'var(--gray-900)', color: '#ffffff', fontWeight: 600 };
const muted = { fontSize: '12px', color: 'var(--text-muted)' };
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');

const REPORT_COLUMNS = [
  { key: 'code', label: 'ID', sortType: 'code', required: true },
  { key: 'project', label: 'Project' },
  { key: 'report_date', label: 'Date', sortType: 'date' },
  { key: 'people', label: 'On site', sortType: 'number', align: 'right' },
  { key: 'lines', label: 'Work lines', sortType: 'number', align: 'right', defaultVisible: false },
  { key: 'weather', label: 'Weather', defaultVisible: false },
  { key: 'blockers', label: 'Blockers' },
  { key: 'status', label: 'Status' },
];

export function DailyReportList() {
  const { reports, pending, loaded } = useSite();
  const { projects } = useProjects();
  const ctx = useRowCtx();
  const navigate = useNavigate();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('dailyReport');
  const prefs = useListPrefs('dailyReport', REPORT_COLUMNS, { key: 'report_date', order: 'desc' });
  const selection = useSelection();
  const [showFilters, setShowFilters] = useState(false);
  const [fProject, setFProject] = useState('');
  const [fStatus, setFStatus] = useState('');
  const board = view === 'kanban';

  // table rows carry the computed fields so sort, columns and export all read plain values
  const rows = useMemo(() => reports.map((r) => ({
    ...r, id: r.id, project: ctx.projectName(r.project_id), people: totalManpower(r.daily_report_manpower), lines: r.daily_report_work?.length || 0,
  })), [reports, ctx]);
  const filtered = rows.filter((r) => (!fProject || r.project_id === fProject) && ((board && pipeline.id === 'status') || !fStatus || r.status === fStatus));
  const sorted = sortRows(filtered, prefs.sortColumn, prefs.sort.order);
  const columns = prefs.visibleColumns.map((c) => ({
    ...c,
    render: (r) => (c.key === 'report_date' ? fmt(r.report_date) : c.key === 'status' ? (
      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: r.status === 'submitted' ? 'var(--st-green-bg)' : 'var(--st-amber-bg)', color: r.status === 'submitted' ? 'var(--st-green-fg)' : 'var(--st-amber-fg)' }}>{r.status === 'submitted' ? 'Submitted' : 'Draft'}</span>
    ) : (r[c.key] === '' || r[c.key] == null ? '—' : r[c.key])),
    csv: (r) => (c.key === 'report_date' ? r.report_date : r[c.key] ?? ''),
  }));
  const btn = { backgroundColor: 'var(--control-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit' };
  const field = { ...btn, cursor: 'default', color: 'var(--text-color)' };

  return (
    <div data-testid="dpr-list" style={{ fontFamily: 'var(--font-family)', color: 'var(--text-color)', backgroundColor: 'var(--bg-color)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color)', gap: '8px', flexWrap: 'wrap' }}>
        <ViewMenu view={view} setView={setView} pipelines={pipelines} pipeline={pipeline} setPipeline={setPipeline} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {pending > 0 && <span style={{ ...muted, display: 'inline-flex', gap: '4px', alignItems: 'center' }}><WifiOff size={12} /> {pending} waiting to send</span>}
          <button onClick={() => setShowFilters(!showFilters)} style={{ ...btn, backgroundColor: showFilters ? 'var(--surface-gray-2)' : 'var(--control-bg)' }}><Filter size={14} /> Filter</button>
          <SortMenu columns={REPORT_COLUMNS} sort={prefs.sort} onChange={prefs.setSort} />
          <ColumnsMenu columns={REPORT_COLUMNS} visibleSet={prefs.visibleSet} onToggle={prefs.toggleColumn} onReset={prefs.resetColumns} disabled={board} disabledHint="Columns apply to the list view" />
          <ExportMenu name="daily-reports" columns={columns} rows={sorted} disabled={!sorted.length} />
          <button style={{ ...btn, backgroundColor: 'var(--gray-900)', borderColor: 'var(--gray-900)', color: '#ffffff', fontWeight: 600 }} onClick={() => navigate('/projects/daily-report/new')}><Plus size={14} /> New report</button>
        </div>
      </div>
      {showFilters && (
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surface-gray-1)', borderBottom: '1px solid var(--border-color)', padding: '12px 24px', flexWrap: 'wrap' }}>
          <select aria-label="Filter by project" value={fProject} onChange={(e) => setFProject(e.target.value)} style={{ ...field, width: '220px' }}>
            <option value="">Project (All)</option>{projects.map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}
          </select>
          <select aria-label="Filter by status" disabled={board && pipeline.id === 'status'} value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ ...field, width: '180px' }}>
            <option value="">Status (All)</option><option value="draft">Draft</option><option value="submitted">Submitted</option>
          </select>
          <button onClick={() => { setFProject(''); setFStatus(''); }} style={btn}>Clear</button>
        </div>
      )}
      <div style={{ flex: 1 }}>
        {!loaded ? <div style={{ ...muted, padding: '40px', textAlign: 'center' }}>Loading…</div> : board ? (
          <KanbanBoard key={pipeline.id} columns={pipeline.columns(sorted, ctx)} items={sorted} getColumn={(r) => pipeline.column(r, ctx)} getId={(r) => r.id}
            onOpen={(r) => navigate(`/projects/daily-report/${r.id}`)} canMove={() => false}
            renderCard={(r) => <ReportCard report={r} ctx={ctx} headCount={r.people} />} />
        ) : sorted.length === 0 ? <div style={{ ...muted, padding: '40px', textAlign: 'center' }}>No daily reports found.</div> : (
          <RecordTable columns={columns} rows={sorted} selection={selection} onOpen={(r) => navigate(`/projects/daily-report/${r.id}`)} sort={prefs.sort}
            onSort={(key) => prefs.setSort({ key, order: prefs.sort.key === key && prefs.sort.order === 'asc' ? 'desc' : 'asc' })} />
        )}
      </div>
    </div>
  );
}

export function DailyReportForm() {
  const { id } = useParams();
  const [qs] = useSearchParams();
  const navigate = useNavigate();
  const { reports, trades, saveReport, remove } = useSite();
  const { projectTasks, projects } = useProjects();
  const { settings } = useSetup();
  const { user, isStaff } = useAuth();
  const existing = id !== 'new' ? reports.find((r) => r.id === id) : null;

  const [form, setForm] = useState(() => ({
    project_id: existing?.project_id || qs.get('project') || '',
    report_date: existing?.report_date || qs.get('date') || todayStr(),
    weather: existing?.weather || '', summary: existing?.summary || '', blockers: existing?.blockers || '',
    visibility: existing?.visibility || 'internal',
    work: (existing?.daily_report_work || []).map((w) => ({ task_id: w.task_id, progress_pct: Number(w.progress_pct), note: w.note || '' })),
    manpower: (existing?.daily_report_manpower || []).map((m) => ({ trade: m.trade, head_count: m.head_count })),
  }));
  const [msg, setMsg] = useState({ text: '', error: false });
  const [busy, setBusy] = useState(false);
  const locked = existing?.status === 'submitted' && !isStaff;
  const tasks = useMemo(() => projectTasks.filter((t) => t.project === projects.find((p) => p.dbId === form.project_id)?.projectName && t.status !== 'Cancelled'), [projectTasks, projects, form.project_id]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (key, i, patch) => setForm((f) => ({ ...f, [key]: f[key].map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const delRow = (key, i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

  const send = async (status) => {
    if (!form.project_id) return setMsg({ text: 'Choose a project', error: true });
    setBusy(true);
    const { work, manpower, ...head } = form;
    const r = await saveReport({ ...head, status, created_by: existing ? undefined : user.id, work, manpower });
    setBusy(false);
    if (!r.ok) return setMsg({ text: r.error, error: true });
    setMsg({ text: r.queued ? 'No connection: saved on this device and will be sent automatically.' : status === 'submitted' ? 'Report submitted.' : 'Draft saved.', error: false });
    if (!r.queued && status === 'submitted') navigate('/projects/daily-report');
  };

  return (
    <div style={page} data-testid="dpr-form">
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{existing ? `Daily report ${existing.code}` : 'New daily report'}</h1>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <label style={muted}>Project
          <select aria-label="Project" style={input} disabled={!!existing || locked} value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value, work: [] }))}>
            <option value="">Select…</option>
            {projects.filter((p) => p.status === 'Open' || p.dbId === form.project_id).map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}
          </select>
        </label>
        <label style={muted}>Date<input aria-label="Date" type="date" style={input} disabled={!!existing || locked} value={form.report_date} onChange={(e) => set('report_date', e.target.value)} /></label>
        <label style={muted}>Weather<input aria-label="Weather" style={input} disabled={locked} value={form.weather} onChange={(e) => set('weather', e.target.value)} placeholder="Clear, rain, …" /></label>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '14px' }}>Work done today</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {form.work.map((w, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 2fr) 90px minmax(120px, 2fr) 32px', gap: '6px', alignItems: 'center' }}>
              <select aria-label="Task" style={input} disabled={locked} value={w.task_id || ''} onChange={(e) => setRow('work', i, { task_id: e.target.value })}>
                <option value="">Task…</option>
                {tasks.map((t) => <option key={t.dbId} value={t.dbId}>{t.subject}</option>)}
              </select>
              <input aria-label="Progress %" type="number" min="0" max="100" style={input} disabled={locked} value={w.progress_pct} onChange={(e) => setRow('work', i, { progress_pct: e.target.value })} placeholder="%" />
              <input aria-label="Note" style={input} disabled={locked} value={w.note} onChange={(e) => setRow('work', i, { note: e.target.value })} placeholder="Note" />
              {!locked && <button type="button" aria-label="Remove work line" onClick={() => delRow('work', i)} style={{ ...btn, padding: '8px' }}><Trash2 size={14} /></button>}
            </div>
          ))}
          {!locked && <button type="button" style={{ ...btn, alignSelf: 'flex-start' }} disabled={!form.project_id} onClick={() => set('work', [...form.work, { task_id: '', progress_pct: 0, note: '' }])}>+ Add work line</button>}
          <div style={muted}>Progress is the task's total percent complete; 100 marks the task completed when the report is submitted.</div>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '14px' }}>Manpower on site ({totalManpower(form.manpower)})</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {form.manpower.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 32px', gap: '6px', alignItems: 'center' }}>
              <select aria-label="Trade" style={input} disabled={locked} value={m.trade} onChange={(e) => setRow('manpower', i, { trade: e.target.value })}>
                <option value="">Trade…</option>
                {trades.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <input aria-label="Head count" type="number" min="0" style={input} disabled={locked} value={m.head_count} onChange={(e) => setRow('manpower', i, { head_count: e.target.value })} />
              {!locked && <button type="button" aria-label="Remove trade" onClick={() => delRow('manpower', i)} style={{ ...btn, padding: '8px' }}><Trash2 size={14} /></button>}
            </div>
          ))}
          {!locked && <button type="button" style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => set('manpower', [...form.manpower, { trade: '', head_count: 1 }])}>+ Add trade</button>}
        </div>
      </div>

      <div style={{ ...card, display: 'grid', gap: '12px' }}>
        <label style={muted}>Summary<textarea aria-label="Summary" style={{ ...input, minHeight: '70px' }} disabled={locked} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <label style={muted}>Blockers / issues<textarea aria-label="Blockers" style={{ ...input, minHeight: '60px' }} disabled={locked} value={form.blockers} onChange={(e) => set('blockers', e.target.value)} /></label>
        {isStaff && (
          <label style={{ ...muted, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={form.visibility === 'shared'} onChange={(e) => set('visibility', e.target.checked ? 'shared' : 'internal')} /> Share with the client once submitted
          </label>
        )}
      </div>

      {existing && <FilesPanel projectId={existing.project_id} recordType="daily_report" recordId={existing.id} />}
      {!existing && <div style={muted}>Save the report first, then add site photos.</div>}

      {msg.text && <div role={msg.error ? 'alert' : 'status'} style={{ fontSize: '13px', color: msg.error ? 'var(--st-red-fg)' : 'var(--st-green-fg)' }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => navigate('/projects/daily-report')}>Back</button>
        <div style={{ flex: 1 }} />
        {existing && (isStaff || existing.status === 'draft') && <button style={{ ...btn, color: 'var(--st-red-fg)' }} onClick={async () => { if (window.confirm('Delete this report?') && await remove('daily_reports', existing.id)) navigate('/projects/daily-report'); }}>Delete</button>}
        {!locked && existing?.status !== 'submitted' && <button style={btn} disabled={busy} onClick={() => send('draft')}>Save draft</button>}
        {!locked && <button style={primary} disabled={busy} onClick={() => send('submitted')}>{existing?.status === 'submitted' ? 'Save changes' : 'Submit report'}</button>}
      </div>
      {settings?.dpr_required && <div style={muted}>Daily reports are required for open projects after {String(settings.dpr_cutoff_time).slice(0, 5)}.</div>}
    </div>
  );
}
