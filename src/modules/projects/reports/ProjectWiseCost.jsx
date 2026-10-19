import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useChartTheme } from '../../../lib/useChartTheme';
import { useProjects } from '../../../context/ProjectsContext';
import { useFinance } from '../../../context/FinanceContext';
import { totals } from '../../../lib/finance';
import { entryRows, projectCosts, formatINR, compactINR } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv, downloadXls } from '../../../components/shared/ReportParts';

export default function ProjectWiseCost() {
  const chart = useChartTheme();
  const { projects, timesheets } = useProjects();
  const { summary } = useFinance();
  const rows = useMemo(() => projectCosts(projects, entryRows(timesheets)).map((r) => {
    const p = projects.find((x) => x.id === r.id);
    const fin = totals(summary.filter((s) => s.project_id === p?.dbId));
    return { ...r, key: r.id, budget: fin.budget, committed: fin.committed, billedRA: fin.billed, paidOut: fin.paid };
  }), [projects, timesheets, summary]);

  const estimated = rows.reduce((t, r) => t + r.estimated, 0);
  const costing = rows.reduce((t, r) => t + r.costing, 0);
  const billing = rows.reduce((t, r) => t + r.billing, 0);
  const over = rows.filter((r) => r.estimated > 0 && r.costing > r.estimated);

  const columns = [
    { label: 'Project', render: (r) => r.name },
    { label: 'Status', render: (r) => r.status },
    { label: 'Hours Logged', align: 'right', render: (r) => r.hours },
    { label: 'Estimated Cost', align: 'right', render: (r) => formatINR(r.estimated), csv: (r) => r.estimated },
    { label: 'Actual Costing', align: 'right', render: (r) => formatINR(r.costing), csv: (r) => r.costing },
    { label: 'Billed', align: 'right', render: (r) => formatINR(r.billing), csv: (r) => r.billing },
    { label: 'Budget', align: 'right', render: (r) => formatINR(r.budget), csv: (r) => r.budget },
    { label: 'Committed', align: 'right', render: (r) => formatINR(r.committed), csv: (r) => r.committed },
    { label: 'Bills approved', align: 'right', render: (r) => formatINR(r.billedRA), csv: (r) => r.billedRA },
    { label: 'Paid out', align: 'right', render: (r) => formatINR(r.paidOut), csv: (r) => r.paidOut },
    { label: 'Variance', align: 'right', render: (r) => formatINR(r.variance), csv: (r) => r.variance, color: (r) => (r.variance < 0 ? '#dc2626' : 'var(--st-green-fg)') },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Project wise Cost" onExport={() => downloadCsv('project-wise-cost.csv', columns, rows)} onExcel={() => downloadXls('project-wise-cost.csv', columns, rows)} />
      {over.length > 0 && (
        <div style={{ background: 'var(--st-amber-bg)', border: '1px solid var(--st-amber-fg)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--st-amber-fg)' }}>
          <AlertTriangle size={16} /> {over.length} project{over.length > 1 ? 's are' : ' is'} over the estimated cost: {over.map((o) => o.name).join(', ')}
        </div>
      )}
      <StatRow>
        <StatCard label="Estimated Cost" value={formatINR(estimated)} />
        <StatCard label="Actual Costing (timesheets)" value={formatINR(costing)} />
        <StatCard label="Billed" value={formatINR(billing)} />
        <StatCard label="Committed (work orders)" value={formatINR(rows.reduce((t, r) => t + r.committed, 0))} />
        <StatCard label="Projects Over Budget" value={over.length} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Timesheet Costing vs Billed" height="300px" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} angle={-20} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} cursor={{ fill: 'var(--divider-color)' }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
              <Bar dataKey="costing" name="Costing" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="billing" name="Billed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={rows} empty="No projects yet." />
    </ReportPage>
  );
}
