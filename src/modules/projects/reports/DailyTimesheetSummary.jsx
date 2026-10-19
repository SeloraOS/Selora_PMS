import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useChartTheme } from '../../../lib/useChartTheme';
import { useProjects } from '../../../context/ProjectsContext';
import { entryRows, hoursBy, todayStr } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv } from '../../../components/shared/ReportParts';

export default function DailyTimesheetSummary() {
  const chart = useChartTheme();
  const { timesheets } = useProjects();
  const entries = useMemo(() => entryRows(timesheets), [timesheets]);
  const latest = useMemo(() => entries.map((e) => e.date).filter(Boolean).sort().pop(), [entries]);
  const [picked, setPicked] = useState('');
  const date = picked || latest || todayStr();

  const day = useMemo(() => entries.filter((e) => e.date === date).map((e, i) => ({ ...e, key: i })), [entries, date]);
  const byEmployee = hoursBy(day, (e) => e.employee);
  const byProject = hoursBy(day, (e) => e.project);
  const total = day.reduce((t, e) => t + e.hours, 0);
  const billable = day.filter((e) => e.isBillable).reduce((t, e) => t + e.hours, 0);

  const columns = [
    { label: 'Employee', render: (r) => r.employee },
    { label: 'Project', render: (r) => r.project || '—' },
    { label: 'Activity', render: (r) => r.activityType || '—' },
    { label: 'Hours', align: 'right', render: (r) => r.hours },
    { label: 'Billable', render: (r) => (r.isBillable ? 'Yes' : 'No') },
    { label: 'Timesheet', render: (r) => r.timesheetId },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Daily Timesheet Summary" onExport={() => downloadCsv(`timesheets-${date}.csv`, columns, day)}>
        <input type="date" value={date} onChange={(e) => setPicked(e.target.value)} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', background: 'var(--card-bg)', color: 'var(--text-color)' }} />
      </ReportHeader>
      <StatRow>
        <StatCard label="Total Hours" value={total} />
        <StatCard label="Billable Hours" value={billable} />
        <StatCard label="Employees" value={byEmployee.length} />
        <StatCard label="Projects" value={byProject.length} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Hours by Employee" empty={!day.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byEmployee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--divider-color)' }} />
              <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Hours by Project" empty={!day.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProject} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--divider-color)' }} />
              <Bar dataKey="hours" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={day} empty="No time logged on this date." />
    </ReportPage>
  );
}
