import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useProjects } from '../../../context/ProjectsContext';
import { entryRows, projectCosts, formatINR, compactINR } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv } from '../../../components/shared/ReportParts';

export default function ProjectWiseCost() {
  const { projects, timesheets } = useProjects();
  const rows = useMemo(() => projectCosts(projects, entryRows(timesheets)).map((r) => ({ ...r, key: r.id })), [projects, timesheets]);

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
    { label: 'Variance', align: 'right', render: (r) => formatINR(r.variance), csv: (r) => r.variance, color: (r) => (r.variance < 0 ? '#dc2626' : '#15803d') },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Project wise Cost" onExport={() => downloadCsv('project-wise-cost.csv', columns, rows)} />
      {over.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#92400e' }}>
          <AlertTriangle size={16} /> {over.length} project{over.length > 1 ? 's are' : ' is'} over the estimated cost: {over.map((o) => o.name).join(', ')}
        </div>
      )}
      <StatRow>
        <StatCard label="Estimated Cost" value={formatINR(estimated)} />
        <StatCard label="Actual Costing (timesheets)" value={formatINR(costing)} />
        <StatCard label="Billed" value={formatINR(billing)} />
        <StatCard label="Projects Over Budget" value={over.length} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Timesheet Costing vs Billed" height="300px" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} angle={-20} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} cursor={{ fill: '#f3f4f6' }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px', color: '#6b7280' }} />
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
