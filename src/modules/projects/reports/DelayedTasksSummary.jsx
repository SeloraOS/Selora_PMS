import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useProjects } from '../../../context/ProjectsContext';
import { delayedTasks, delayBuckets, countBy, todayStr } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv } from '../../../components/shared/ReportParts';

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const delayColor = (days) => (days > 7 ? '#7c3aed' : days >= 4 ? '#ef4444' : '#f59e0b');

export default function DelayedTasksSummary() {
  const { projectTasks } = useProjects();
  const today = todayStr();
  const delayed = useMemo(() => delayedTasks(projectTasks, today).map((t) => ({ ...t, key: t.id })), [projectTasks, today]);
  const byProject = countBy(delayed, (t) => t.project || 'No project').map((d) => ({ name: d.name, delayed: d.value }));
  const buckets = delayBuckets(delayed);
  const avg = delayed.length ? (delayed.reduce((t, d) => t + d.delayDays, 0) / delayed.length).toFixed(1) : '0';

  const columns = [
    { label: 'Task', render: (r) => r.subject },
    { label: 'Project', render: (r) => r.project || '—' },
    { label: 'Due Date', render: (r) => fmtDate(r.expectedEndDate), csv: (r) => r.expectedEndDate },
    { label: 'Days Delayed', render: (r) => `${r.delayDays} days`, csv: (r) => r.delayDays, color: (r) => delayColor(r.delayDays) },
    { label: 'Status', render: (r) => r.status },
    { label: 'Priority', render: (r) => r.priority || '—' },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Delayed Tasks Summary" onExport={() => downloadCsv('delayed-tasks.csv', columns, delayed)} />
      <StatRow>
        <StatCard label="Total Delayed" value={delayed.length} />
        <StatCard label="Critical (>7 days)" value={delayed.filter((d) => d.delayDays > 7).length} />
        <StatCard label="Avg Delay" value={`${avg} days`} />
        <StatCard label="Affected Projects" value={byProject.length} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Delays by Project" empty={!delayed.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProject} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} angle={-20} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="delayed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Delay Duration" empty={!delayed.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={buckets} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {buckets.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#6b7280' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={delayed} empty="No delayed tasks. Everything is on schedule." />
    </ReportPage>
  );
}
