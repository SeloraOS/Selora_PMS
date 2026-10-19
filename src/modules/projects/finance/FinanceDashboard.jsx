import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useChartTheme } from '../../../lib/useChartTheme';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { formatINR, compactINR, todayStr } from '../../../lib/reportData';
import { budgetHealth, totals, sCurve, cashFlow, fiscalYear } from '../../../lib/finance';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv, downloadXls } from '../../../components/shared/ReportParts';
import { control } from './shared';

export default function FinanceDashboard() {
  const chart = useChartTheme();
  const { summary, costHeads, bills } = useFinance();
  const { projects, projectTasks } = useProjects();
  const { settings } = useSetup();
  const [projectId, setProjectId] = useState('');
  const today = todayStr();
  const alertPct = settings?.budget_overrun_alert_percent ?? 90;
  const fy = fiscalYear(today, settings?.fiscal_year_start_month ?? 4);
  const project = projects.find((p) => p.dbId === projectId);

  const scoped = useMemo(() => summary.filter((s) => !projectId || s.project_id === projectId), [summary, projectId]);
  const sum = totals(scoped);
  const byProject = useMemo(() => projects.map((p) => {
    const rows = summary.filter((s) => s.project_id === p.dbId);
    const t = totals(rows);
    return { key: p.dbId, name: p.projectName, ...t, health: budgetHealth(t, alertPct) };
  }).filter((r) => r.budget || r.committed), [projects, summary, alertPct]);
  const overruns = useMemo(() => summary.map((s) => ({ s, h: budgetHealth(s, alertPct) })).filter(({ h }) => h.key === 'over' || h.key === 'warn')
    .map(({ s, h }) => ({ name: `${projects.find((p) => p.dbId === s.project_id)?.projectName || ''} · ${costHeads.find((c) => c.id === s.cost_head_id)?.name || ''} (${h.pct}%)` })), [summary, projects, costHeads, alertPct]);
  const byHead = useMemo(() => costHeads.map((h) => ({ name: h.name, ...totals(scoped.filter((s) => s.cost_head_id === h.id)) })).filter((r) => r.budget || r.committed), [costHeads, scoped]);
  const curve = useMemo(() => (project ? sCurve(projectTasks.filter((t) => t.project === project.projectName), today) : []), [project, projectTasks, today]);
  const flow = useMemo(() => cashFlow(bills.filter((b) => !projectId || b.project_id === projectId), today), [bills, projectId, today]);

  const columns = [
    { label: 'Project', render: (r) => r.name },
    { label: 'Budget', align: 'right', render: (r) => formatINR(r.budget), csv: (r) => r.budget },
    { label: 'Committed', align: 'right', render: (r) => formatINR(r.committed), csv: (r) => r.committed },
    { label: 'Billed', align: 'right', render: (r) => formatINR(r.billed), csv: (r) => r.billed },
    { label: 'Paid', align: 'right', render: (r) => formatINR(r.paid), csv: (r) => r.paid },
    { label: 'Used', align: 'right', render: (r) => (r.health.pct != null ? `${r.health.pct}%` : '—'), csv: (r) => r.health.pct ?? '' },
    { label: 'Status', render: (r) => ({ over: 'Over budget', warn: 'Near limit', ok: 'On track', unbudgeted: 'No budget', none: '—' }[r.health.key]) },
  ];

  return (
    <ReportPage>
      <ReportHeader title={`Finance · ${fy.label}`} onExport={() => downloadCsv('finance-by-project.csv', columns, byProject)} onExcel={() => downloadXls('finance-by-project.csv', columns, byProject)}>
        <select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={control}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}
        </select>
      </ReportHeader>
      {overruns.length > 0 && (
        <div data-testid="overrun-banner" style={{ background: 'var(--st-amber-bg)', border: '1px solid var(--st-amber-fg)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--st-amber-fg)' }}>
          <AlertTriangle size={16} /> {overruns.length} budget line{overruns.length > 1 ? 's are' : ' is'} at or over {alertPct}% of budget: {overruns.map((o) => o.name).join('; ')}
        </div>
      )}
      <StatRow>
        <StatCard label="Budget" value={formatINR(sum.budget)} />
        <StatCard label="Committed (work orders)" value={formatINR(sum.committed)} />
        <StatCard label="Billed (approved bills)" value={formatINR(sum.billed)} />
        <StatCard label="Paid" value={formatINR(sum.paid)} />
        <StatCard label="Overdue payables" value={formatINR(flow.overdue)} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Budget vs committed vs billed vs paid, by cost head" height="300px" empty={!byHead.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHead} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} interval={0} angle={-15} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} cursor={{ fill: 'var(--divider-color)' }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
              <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="committed" name="Committed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="billed" name="Billed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cash-flow forecast (approved bills by due month)" height="300px" empty={!flow.months.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flow.months} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} cursor={{ fill: 'var(--divider-color)' }} />
              <Bar dataKey="amount" name="Due" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ChartRow>
        <ChartCard title={project ? `S-curve: planned vs actual progress (${project.projectName})` : 'S-curve (choose a project)'} height="280px" empty={!curve.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} />
              <YAxis axisLine={false} tickLine={false} domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
              <Line type="monotone" dataKey="planned" name="Planned" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={byProject} empty="No budgets or work orders yet." />
    </ReportPage>
  );
}
