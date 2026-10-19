import React, { useMemo, useState } from 'react';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../lib/reportData';
import { budgetHealth, totals } from '../../../lib/finance';
import { control, Pill } from './shared';

const HEALTH = { over: ['red', 'Over budget'], warn: ['amber', 'Near limit'], ok: ['green', 'On track'], unbudgeted: ['red', 'No budget'], none: ['gray', '—'] };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' };
const td = { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid var(--divider-color)' };

export default function Budgets() {
  const { costHeads, budgets, summary, save, loaded } = useFinance();
  const { projects } = useProjects();
  const { settings } = useSetup();
  const { isStaff } = useAuth();
  const [projectId, setProjectId] = useState('');
  const pid = projectId || projects[0]?.dbId || '';
  const alert = settings?.budget_overrun_alert_percent ?? 90;
  const [draft, setDraft] = useState({});

  const rows = useMemo(() => costHeads.map((h) => {
    const b = budgets.find((x) => x.project_id === pid && x.cost_head_id === h.id);
    const s = summary.find((x) => x.project_id === pid && x.cost_head_id === h.id) || { budget: 0, committed: 0, billed: 0, paid: 0 };
    return { head: h, budget: b, ...s, health: budgetHealth(s, alert) };
  }), [costHeads, budgets, summary, pid, alert]);
  const sum = totals(rows);

  const commit = async (row) => {
    const raw = draft[row.head.id];
    if (raw === undefined) return;
    const amount = Number(raw);
    setDraft((d) => { const { [row.head.id]: _, ...rest } = d; return rest; });
    if (Number.isNaN(amount) || amount < 0 || amount === Number(row.budget?.amount ?? 0)) return;
    await save('budgets', row.budget ? { amount } : { project_id: pid, cost_head_id: row.head.id, amount }, row.budget?.id);
  };

  return (
    <div data-testid="budgets" style={{ padding: '20px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--surface-gray-1)', minHeight: '100%' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0, flex: 1 }}>Budgets</h1>
        <select aria-label="Project" value={pid} onChange={(e) => setProjectId(e.target.value)} style={control}>{projects.map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}</select>
      </div>
      {!isStaff && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Only admins and managers can change budgets.</div>}
      <div style={{ overflowX: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Cost head', 'Budget (₹)', 'Committed', 'Billed', 'Paid', 'Used', 'Rev.'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {!loaded ? <tr><td style={td} colSpan={7}>Loading…</td></tr> : rows.map((r) => {
              const [color, label] = HEALTH[r.health.key];
              return (
                <tr key={r.head.id} data-testid="budget-row">
                  <td style={td}>{r.head.name}</td>
                  <td style={td}>
                    <input aria-label={`Budget for ${r.head.name}`} type="number" min="0" disabled={!isStaff} style={{ ...control, width: '140px', textAlign: 'right' }}
                      value={draft[r.head.id] ?? (r.budget ? String(Number(r.budget.amount) || 0) : '')} placeholder="0"
                      onChange={(e) => setDraft((d) => ({ ...d, [r.head.id]: e.target.value }))} onBlur={() => commit(r)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                  </td>
                  <td style={td}>{formatINR(Number(r.committed))}</td>
                  <td style={td}>{formatINR(Number(r.billed))}</td>
                  <td style={td}>{formatINR(Number(r.paid))}</td>
                  <td style={td}>{r.health.pct != null ? `${r.health.pct}% ` : ''}<Pill color={color} data-testid="budget-health">{label}</Pill></td>
                  <td style={td}>{r.budget?.revision ?? '—'}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>Total</td><td style={td}>{formatINR(sum.budget)}</td><td style={td}>{formatINR(sum.committed)}</td><td style={td}>{formatINR(sum.billed)}</td><td style={td}>{formatINR(sum.paid)}</td>
              <td style={td} colSpan={2}>Balance {formatINR(sum.balance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Committed = approved work orders. Billed = approved bills (gross). Each change to a budget is stored as a new revision. Warning at {alert}% of the budget.</div>
    </div>
  );
}
