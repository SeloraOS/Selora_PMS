import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useViewMode } from '../../../lib/useViewMode';
import { useListPrefs } from '../../../lib/useListPrefs';
import { sortRows } from '../../../lib/sortRows';
import { useRowCtx } from '../../../lib/useRowCtx';
import { formatINR } from '../../../lib/reportData';
import { budgetHealth, totals } from '../../../lib/finance';
import ViewMenu from '../../../components/shared/ViewMenu';
import { SortMenu, ColumnsMenu, ExportMenu } from '../../../components/shared/ListMenus';
import KanbanBoard from '../../../components/shared/KanbanBoard';
import SearchBox from '../../../components/shared/SearchBox';
import { BudgetCard } from '../rowCards';
import { control, Pill } from './shared';

const HEALTH = { over: ['red', 'Over budget'], warn: ['amber', 'Near limit'], ok: ['green', 'On track'], unbudgeted: ['red', 'No budget'], none: ['gray', 'Nothing yet'] };
const BAR = { over: '#ef4444', warn: '#f59e0b', ok: '#22c55e', unbudgeted: '#ef4444', none: '#9ca3af' };
const COLUMNS = [
  { key: 'head', label: 'Cost head', required: true, sortValue: (r) => r.head.name },
  { key: 'projectName', label: 'Project', defaultVisible: false },
  { key: 'budget', label: 'Budget', sortType: 'number', align: 'right' },
  { key: 'committed', label: 'Committed', sortType: 'number', align: 'right' },
  { key: 'billed', label: 'Billed', sortType: 'number', align: 'right' },
  { key: 'paid', label: 'Paid', sortType: 'number', align: 'right' },
  { key: 'remaining', label: 'Remaining', sortType: 'number', align: 'right' },
  { key: 'used', label: 'Committed vs budget', sortType: 'number', sortValue: (r) => r.health.pct ?? -1 },
  { key: 'status', label: 'Status', sortValue: (r) => HEALTH[r.health.key][1] },
  { key: 'revision', label: 'Rev.', sortType: 'number', defaultVisible: false },
];
const th = { padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: '13px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--divider-color)', verticalAlign: 'middle' };
const btn = { ...control, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-muted)' };
const small = { fontSize: '12px', color: 'var(--text-muted)' };
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Summary({ label, value, hint, tone }) {
  return (
    <div style={{ flex: '1 1 170px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: tone || 'var(--text-color)' }}>{value}</div>
      <div style={{ ...small, marginTop: '2px' }}>{hint}</div>
    </div>
  );
}

function Progress({ line }) {
  const budget = Number(line.budget) || 0;
  const pct = budget > 0 ? Math.min(100, (Number(line.committed) / budget) * 100) : Number(line.committed) > 0 ? 100 : 0;
  return (
    <div style={{ minWidth: '170px' }}>
      <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: BAR[line.health.key] }} /></div>
      <div style={{ ...small, marginTop: '4px' }}>{line.health.pct == null ? (Number(line.committed) > 0 ? 'Committed without a budget' : 'No budget set') : `${line.health.pct}% committed`}</div>
    </div>
  );
}

/** Modal to set a budget (always saves a new revision with the reason). */
function EditBudget({ line, onClose, onSave }) {
  const [amount, setAmount] = useState(line.budget ? String(Number(line.budget)) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); const ok = await onSave(Number(amount) || 0, reason.trim() || null); setBusy(false); if (ok) onClose(); };
  return (
    <div role="dialog" aria-label="Set budget" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--control-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', width: '420px', maxWidth: '92%', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}><strong style={{ fontSize: '15px', flex: 1 }}>Set budget: {line.head.name}</strong><button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button></div>
        <div style={small}>{line.projectName} · already committed {formatINR(Number(line.committed))}</div>
        <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: '4px' }}>Budget amount (₹)<input aria-label="Budget amount" type="number" min="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...control, fontSize: '14px' }} /></label>
        <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: '4px' }}>Reason for the change (kept in the history)<textarea aria-label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...control, resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={btn}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...btn, background: 'var(--gray-900)', borderColor: 'var(--gray-900)', color: '#ffffff', fontWeight: 600 }}>{busy ? 'Saving…' : 'Save budget'}</button>
        </div>
      </div>
    </div>
  );
}

function History({ line, onClose }) {
  const { profiles } = useSetup();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('budget_revisions').select('*').eq('budget_id', line.budget_id).order('revision', { ascending: false }).then(({ data }) => setRows(data || []));
  }, [line.budget_id]);
  const who = (id) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || '';
  return (
    <div role="dialog" aria-label="Budget history" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--control-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', width: '480px', maxWidth: '92%', maxHeight: '80vh', overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}><strong style={{ fontSize: '15px', flex: 1 }}>History: {line.head.name}</strong><button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button></div>
        {!rows ? <div style={small}>Loading…</div> : rows.map((r) => (
          <div key={r.id} data-testid="revision" style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }}>
            <div style={{ fontSize: '13px' }}>Revision {r.revision}: {r.old_amount == null ? 'set to' : `${formatINR(Number(r.old_amount))} →`} <strong>{formatINR(Number(r.new_amount))}</strong></div>
            <div style={small}>{fmtDay(r.changed_at)}{who(r.changed_by) ? ` · ${who(r.changed_by)}` : ''}{r.reason ? ` · ${r.reason}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Budgets() {
  const { costHeads, budgets, summary, save, loaded } = useFinance();
  const { projects } = useProjects();
  const { settings } = useSetup();
  const { isStaff } = useAuth();
  const ctx = useRowCtx();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('budget');
  const prefs = useListPrefs('budget', COLUMNS, { key: 'head', order: 'asc' });
  const alertPct = settings?.budget_overrun_alert_percent ?? 90;
  const [projectId, setProjectId] = useState(() => { try { return localStorage.getItem('selora-budget-project') || ''; } catch { return ''; } });
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [fHealth, setFHealth] = useState('');
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const pickProject = (id) => { setProjectId(id); try { localStorage.setItem('selora-budget-project', id); } catch { /* storage unavailable */ } };
  const board = view === 'kanban';

  // one line per project and cost head (single project: every head, so a budget can be added; all projects: only lines with figures)
  const lines = useMemo(() => {
    const scope = projectId ? projects.filter((p) => p.dbId === projectId) : projects;
    const out = [];
    for (const p of scope) {
      for (const h of costHeads) {
        const b = budgets.find((x) => x.project_id === p.dbId && x.cost_head_id === h.id);
        const s = summary.find((x) => x.project_id === p.dbId && x.cost_head_id === h.id) || { budget: 0, committed: 0, billed: 0, paid: 0 };
        if (!projectId && !b && !Number(s.committed)) continue;
        const budget = Number(s.budget) || 0; const committed = Number(s.committed) || 0;
        out.push({
          id: `${p.dbId}:${h.id}`, head: h, projectId: p.dbId, projectName: p.projectName, budget_id: b?.id, budget, committed, billed: Number(s.billed) || 0, paid: Number(s.paid) || 0,
          remaining: budget - committed, revision: b?.revision ?? '', health: budgetHealth({ budget, committed }, alertPct),
        });
      }
    }
    return out;
  }, [projects, costHeads, budgets, summary, projectId, alertPct]);

  const q = search.trim().toLowerCase();
  const filtered = lines.filter((l) => ((board && pipeline.id === 'health') || !fHealth || l.health.key === fHealth) && (!q || `${l.head.name} ${l.projectName}`.toLowerCase().includes(q)));
  const sorted = sortRows(filtered, prefs.sortColumn, prefs.sort.order);
  const sum = totals(lines);
  const committedPct = sum.budget > 0 ? Math.round((sum.committed / sum.budget) * 100) : null;

  const render = {
    head: (l) => <strong style={{ fontWeight: 600, color: 'var(--text-color)' }}>{l.head.name}</strong>,
    projectName: (l) => l.projectName,
    budget: (l) => (l.budget ? formatINR(l.budget) : '—'),
    committed: (l) => formatINR(l.committed), billed: (l) => formatINR(l.billed), paid: (l) => formatINR(l.paid),
    remaining: (l) => <span style={{ color: l.remaining < 0 ? 'var(--st-red-fg)' : undefined, fontWeight: l.remaining < 0 ? 600 : 400 }}>{l.budget || l.committed ? formatINR(l.remaining) : '—'}</span>,
    used: (l) => <Progress line={l} />,
    status: (l) => <Pill color={HEALTH[l.health.key][0]} data-testid="budget-health">{HEALTH[l.health.key][1]}</Pill>,
    revision: (l) => l.revision || '—',
  };
  const exportColumns = prefs.visibleColumns.map((c) => ({ label: c.label, csv: (l) => ({ head: l.head.name, projectName: l.projectName, budget: l.budget, committed: l.committed, billed: l.billed, paid: l.paid, remaining: l.remaining, used: l.health.pct ?? '', status: HEALTH[l.health.key][1], revision: l.revision }[c.key]) }));

  const saveBudget = useCallback(async (line, amount, reason) => {
    const row = line.budget_id ? { amount, notes: reason } : { project_id: line.projectId, cost_head_id: line.head.id, amount, notes: reason };
    return !!(await save('budgets', row, line.budget_id));
  }, [save]);

  const empty = (
    <div style={{ ...small, padding: '40px', textAlign: 'center' }}>
      {projectId ? 'No cost heads match.' : 'No budgets yet. Pick a project to set its budget cost head by cost head.'}
    </div>
  );

  return (
    <div data-testid="budgets" style={{ color: 'var(--text-color)', fontFamily: 'var(--font-family)', backgroundColor: 'var(--bg-color)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color)', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ViewMenu view={view} setView={setView} pipelines={pipelines} pipeline={pipeline} setPipeline={setPipeline} />
          <SearchBox value={search} onChange={setSearch} placeholder="Search cost heads…" />
          <select aria-label="Project" value={projectId} onChange={(e) => pickProject(e.target.value)} style={{ ...control, color: 'var(--text-color)' }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowFilters(!showFilters)} style={{ ...btn, background: showFilters ? 'var(--surface-gray-2)' : 'var(--control-bg)' }}><Filter size={14} /> Filter</button>
          <SortMenu columns={COLUMNS} sort={prefs.sort} onChange={prefs.setSort} />
          <ColumnsMenu columns={COLUMNS} visibleSet={prefs.visibleSet} onToggle={prefs.toggleColumn} onReset={prefs.resetColumns} disabled={board} disabledHint="Columns apply to the table view" />
          <ExportMenu name="budgets" columns={exportColumns} rows={sorted} disabled={!sorted.length} />
        </div>
      </div>
      {showFilters && (
        <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-gray-1)', borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>
          <select aria-label="Filter by status" disabled={board && pipeline.id === 'health'} value={fHealth} onChange={(e) => setFHealth(e.target.value)} style={{ ...control, width: '200px' }}>
            <option value="">Status (All)</option>{Object.entries(HEALTH).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button onClick={() => setFHealth('')} style={btn}>Clear</button>
        </div>
      )}

      <div style={{ padding: '16px 24px 0', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Summary label="Total budget" value={formatINR(sum.budget)} hint={projectId ? 'For this project' : 'Across the projects listed'} />
        <Summary label="Committed" value={formatINR(sum.committed)} hint={committedPct == null ? 'Approved work orders' : `${committedPct}% of the budget in approved work orders`} tone={committedPct != null && committedPct > 100 ? 'var(--st-red-fg)' : undefined} />
        <Summary label="Billed" value={formatINR(sum.billed)} hint="Approved RA bills (before GST and deductions)" />
        <Summary label="Paid" value={formatINR(sum.paid)} hint="Payments made to vendors" />
        <Summary label="Still available" value={formatINR(sum.balance)} hint="Budget minus committed" tone={sum.balance < 0 ? 'var(--st-red-fg)' : undefined} />
      </div>

      <div style={{ flex: 1, paddingTop: '16px' }}>
        {!loaded ? <div style={{ ...small, padding: '40px', textAlign: 'center' }}>Loading…</div> : board ? (
          sorted.length === 0 ? empty : (
            <KanbanBoard key={pipeline.id} columns={pipeline.columns(sorted, ctx)} items={sorted} getColumn={(r) => pipeline.column(r, ctx)} getId={(r) => r.id} canMove={() => false}
              onOpen={(l) => (isStaff ? setEditing(l) : null)} renderCard={(l) => <BudgetCard line={l} showProject={!projectId} />} />
          )
        ) : sorted.length === 0 ? empty : (
          <div style={{ overflowX: 'auto', padding: '0 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {prefs.visibleColumns.map((c) => <th key={c.key} onClick={() => prefs.setSort({ key: c.key, order: prefs.sort.key === c.key && prefs.sort.order === 'asc' ? 'desc' : 'asc' })} style={{ ...th, textAlign: c.align || 'left', cursor: 'pointer' }}>{c.label}{prefs.sort.key === c.key ? (prefs.sort.order === 'asc' ? ' ↑' : ' ↓') : ''}</th>)}
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => (
                  <tr key={l.id} data-testid="budget-row">
                    {prefs.visibleColumns.map((c) => <td key={c.key} style={{ ...td, textAlign: c.align || 'left', whiteSpace: c.key === 'head' || c.key === 'used' ? 'normal' : 'nowrap' }}>{render[c.key](l)}</td>)}
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isStaff && <button type="button" aria-label={`Edit budget for ${l.head.name}`} onClick={() => setEditing(l)} style={btn}>{l.budget_id ? 'Edit budget' : 'Set budget'}</button>}{' '}
                      {l.budget_id && <button type="button" aria-label={`History for ${l.head.name}`} onClick={() => setHistory(l)} style={btn}>History</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ ...small, padding: '12px 24px 24px' }}>
          How to read this: <strong>Budget</strong> is what you plan to spend. <strong>Committed</strong> is the value of approved work orders. <strong>Billed</strong> is approved bills and <strong>Paid</strong> is what has left the bank. The bar turns amber at {alertPct}% committed and red above 100%.
          {!isStaff && ' Only admins and managers can change budgets.'}
        </div>
      </div>
      {editing && <EditBudget line={editing} onClose={() => setEditing(null)} onSave={(amount, reason) => saveBudget(editing, amount, reason)} />}
      {history && <History line={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
