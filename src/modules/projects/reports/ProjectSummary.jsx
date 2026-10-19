import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useChartTheme } from '../../../lib/useChartTheme';
import { useProjects } from '../../../context/ProjectsContext';
import { countBy, projectProgress, isClosed, formatINR } from '../../../lib/reportData';
import { ReportPage, ReportHeader, StatRow, StatCard, ChartRow, ChartCard, ReportTable, tooltipStyle, downloadCsv, downloadXls } from '../../../components/shared/ReportParts';

const STATUS_COLORS = { Open: '#3b82f6', Completed: '#22c55e', Cancelled: '#ef4444' };
const FALLBACK = ['#f59e0b', '#7c3aed', '#14b8a6', '#ec4899'];

export default function ProjectSummary() {
  const chart = useChartTheme();
  const { projects, projectTasks } = useProjects();

  const rows = useMemo(() => projects.map((p) => {
    const mine = projectTasks.filter((t) => t.project === p.projectName);
    return {
      key: p.id, id: p.id, name: p.projectName, type: p.projectType || '—', status: p.status, priority: p.priority,
      progress: projectProgress(p.projectName, projectTasks),
      done: mine.filter((t) => t.status === 'Completed').length,
      open: mine.filter((t) => !isClosed(t)).length,
      total: mine.length,
      estimated: Number(p.estimatedCost) || 0,
    };
  }), [projects, projectTasks]);

  const byStatus = countBy(projects, (p) => p.status).map((d, i) => ({ ...d, color: STATUS_COLORS[d.name] || FALLBACK[i % FALLBACK.length] }));
  const avg = rows.length ? Math.round(rows.reduce((t, r) => t + r.progress, 0) / rows.length) : 0;

  const columns = [
    { label: 'Project', render: (r) => r.name },
    { label: 'Type', render: (r) => r.type },
    { label: 'Status', render: (r) => r.status },
    { label: 'Priority', render: (r) => r.priority || '—' },
    { label: 'Progress', render: (r) => `${r.progress}%` },
    { label: 'Tasks (done/total)', render: (r) => `${r.done}/${r.total}` },
    { label: 'Estimated Cost', align: 'right', render: (r) => formatINR(r.estimated), csv: (r) => r.estimated },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Project Summary" onExport={() => downloadCsv('project-summary.csv', columns, rows)} onExcel={() => downloadXls('project-summary.csv', columns, rows)} />
      <StatRow>
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Open" value={projects.filter((p) => p.status === 'Open').length} />
        <StatCard label="Completed" value={projects.filter((p) => p.status === 'Completed').length} />
        <StatCard label="Avg Progress" value={`${avg}%`} />
      </StatRow>
      <ChartRow>
        <ChartCard title="Projects by Status" empty={!projects.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={byStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                {byStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tasks per Project" empty={!rows.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chart.axis }} angle={-20} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: chart.axis }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--divider-color)' }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '12px' }} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
              <Bar dataKey="done" name="Completed" stackId="a" fill="#22c55e" />
              <Bar dataKey="open" name="Open" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartRow>
      <ReportTable columns={columns} rows={rows} empty="No projects yet." />
    </ReportPage>
  );
}
