import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useChartTheme } from '../../../lib/useChartTheme';
import { useProjects } from '../../../context/ProjectsContext';
import { entryRows, hoursBy, monthlyTotals, todayStr, formatINR, compactINR } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv, downloadXls } from '../../../components/shared/ReportParts';

export default function TimesheetBillingSummary() {
  const chart = useChartTheme();
  const { timesheets } = useProjects();
  const entries = useMemo(() => entryRows(timesheets), [timesheets]);
  const rows = useMemo(() => hoursBy(entries, (e) => e.project).map((r) => ({ ...r, key: r.name, margin: r.billingAmount - r.costingAmount })), [entries]);
  const monthly = useMemo(() => monthlyTotals(entries, todayStr(), 6, (e) => e.billingAmount), [entries]);

  const billing = rows.reduce((t, r) => t + r.billingAmount, 0);
  const costing = rows.reduce((t, r) => t + r.costingAmount, 0);
  const billableHours = rows.reduce((t, r) => t + r.billable, 0);

  const columns = [
    { label: 'Project', render: (r) => r.name },
    { label: 'Hours', align: 'right', render: (r) => r.hours },
    { label: 'Billable Hours', align: 'right', render: (r) => r.billable },
    { label: 'Billing', align: 'right', render: (r) => formatINR(r.billingAmount), csv: (r) => r.billingAmount },
    { label: 'Costing', align: 'right', render: (r) => formatINR(r.costingAmount), csv: (r) => r.costingAmount },
    { label: 'Margin', align: 'right', render: (r) => formatINR(r.margin), csv: (r) => r.margin, color: (r) => (r.margin < 0 ? '#dc2626' : 'var(--st-green-fg)') },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Timesheet Billing Summary" onExport={() => downloadCsv('timesheet-billing.csv', columns, rows)} onExcel={() => downloadXls('timesheet-billing.csv', columns, rows)} />
      <StatRow>
        <StatCard label="Total Billing" value={formatINR(billing)} />
        <StatCard label="Total Costing" value={formatINR(costing)} />
        <StatCard label="Margin" value={formatINR(billing - costing)} />
        <StatCard label="Billable Hours" value={billableHours} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Billing vs Costing by Project" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} angle={-20} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} cursor={{ fill: 'var(--divider-color)' }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
              <Bar dataKey="billingAmount" name="Billing" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costingAmount" name="Costing" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Billing by Month" empty={!billing}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactINR} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatINR(v)} />
              <Line type="monotone" dataKey="value" name="Billing" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={rows} empty="No timesheets yet." />
    </ReportPage>
  );
}
