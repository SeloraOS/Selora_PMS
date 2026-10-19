/**
 * Projects Dashboard — client/src/modules/projects/index.jsx
 * Replicates the Projects home page layout with live context/mock data.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer as ChartContainer,
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid
} from 'recharts';
import './projects.css';
import { useProjects } from '../../context/ProjectsContext';
import { useAlerts } from '../../lib/useAlerts';
import { useChartTheme } from '../../lib/useChartTheme';
import { entryRows, dashboardStats, monthlyHours, todayStr, formatINR } from '../../lib/reportData';
import StatCard from '../../components/shared/StatCard';
import ChartCard from '../../components/shared/ChartCard';

// ─── Shared line chart component ──────────────────────────────────────────────
function ProjectsLineChart({ data }) {
  const chart = useChartTheme();
  return (
    <ChartContainer width="100%" height={220}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <RechartsCartesianGrid vertical={false} stroke={chart.grid} />
        <RechartsXAxis
          dataKey="date"
          tick={{ fontSize: 13, fill: chart.axis, fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <RechartsYAxis
          allowDecimals={false}
          tick={{ fontSize: 13, fill: chart.axis, fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsLine
          type="monotone"
          dataKey="value"
          stroke={chart.line}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </RechartsLineChart>
    </ChartContainer>
  );
}

// ─── Reusable Master/Settings Link Card ───────────────────────────────────────
function MasterCard({ title, links }) {
  return (
    <div
      style={{
        backgroundColor: '#1c1c1c',
        border: '1px solid #232323',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#7c7c7c',
          marginBottom: '12px',
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map((link, idx) => (
          <Link
            key={idx}
            to={link.route}
            style={{
              fontSize: '14px',
              color: '#f8f8f8',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 0',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#0289f7';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#f8f8f8';
            }}
          >
            <span>{link.label}</span>
            {link.arrow && (
              <ArrowUpRight size={13} style={{ color: '#7c7c7c', marginLeft: '6px' }} />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsDashboard() {
  const { projects, projectTasks, timesheets } = useProjects();
  const alerts = useAlerts();
  const today = todayStr();
  const stats = useMemo(() => dashboardStats(projects, projectTasks, timesheets, today), [projects, projectTasks, timesheets, today]);
  const hoursData = useMemo(() => monthlyHours(entryRows(timesheets), today, 7), [timesheets, today]);

  const projectsLinks = [
    { label: 'Project', route: '/projects/project', arrow: true },
    { label: 'Task', route: '/projects/task', arrow: true },
    { label: 'Project Template', route: '/projects/setup/project-template', arrow: true },
    { label: 'Project Type', route: '/projects/setup/project-type', arrow: true },
    { label: 'Project Update', route: '/projects/setup/project-update', arrow: false },
  ];

  const timeTrackingLinks = [
    { label: 'Timesheet', route: '/projects/timesheet', arrow: true },
    { label: 'Calendar', route: '/projects/calendar', arrow: true },
    { label: 'Activity Type', route: '/projects/setup/activity-type', arrow: true },
    { label: 'Activity Cost', route: '/projects/setup/activity-cost', arrow: true },
  ];

  const reportsLinks = [
    { label: 'Daily Timesheet Summary', route: '/projects/reports/daily-timesheet-summary', arrow: false },
    { label: 'Project Summary', route: '/projects/reports/project-summary', arrow: false },
    { label: 'Project wise Cost', route: '/projects/reports/project-wise-cost', arrow: false },
    { label: 'Timesheet Billing Summary', route: '/projects/reports/timesheet-billing-summary', arrow: false },
    { label: 'Delayed Tasks Summary', route: '/projects/reports/delayed-tasks-summary', arrow: false },
  ];

  const settingsLinks = [
    { label: 'Projects Settings', route: '/projects/settings', arrow: true },
  ];

  return (
    <div style={{ padding: '24px', fontFamily: 'var(--font-family)', backgroundColor: 'var(--bg-color)', minHeight: '100%' }}>
      
      {alerts.count > 0 && (
        <Link
          to="/projects/reports/delayed-tasks-summary"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #7f1d1d', background: '#2a1215', color: '#fca5a5', textDecoration: 'none', fontSize: '14px' }}
        >
          <AlertTriangle size={16} />
          <span>{alerts.count} task{alerts.count > 1 ? 's are' : ' is'} overdue. View the Delayed Tasks Summary.</span>
          <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
        </Link>
      )}

      {/* Working hours per month */}
      <ChartCard
        title="Working Hours"
        lastSynced="Hours logged on timesheets, last 7 months"
      >
        <ProjectsLineChart data={hoursData} />
      </ChartCard>

      {/* Row of stats cards */}
      <div
        className="projects-stat-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <StatCard title="Open Projects" value={stats.openProjects} />
        <StatCard title="Non Completed Tasks" value={stats.openTasks} />
        <StatCard title="Delayed Tasks" value={stats.delayedTasks} />
        <StatCard title="Completed Projects" value={stats.completedProjects} />
        <StatCard title="Working Hours (this month)" value={stats.hoursThisMonth.toFixed(1)} />
        <StatCard title="Billable (this month)" value={formatINR(stats.billableThisMonth)} />
      </div>

      {/* Reports & Masters Section */}
      <h2
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#afafaf',
          marginBottom: '16px',
          marginTop: '8px',
        }}
      >
        Reports & Masters
      </h2>

      <div
        className="projects-masters-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* Column 1: Projects & Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <MasterCard title="Projects" links={projectsLinks} />
          <MasterCard title="Settings" links={settingsLinks} />
        </div>

        {/* Column 2: Time Tracking */}
        <div>
          <MasterCard title="Time Tracking" links={timeTrackingLinks} />
        </div>

        {/* Column 3: Reports */}
        <div>
          <MasterCard title="Reports" links={reportsLinks} />
        </div>
      </div>
    </div>
  );
}
