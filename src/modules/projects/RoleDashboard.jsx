import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectsContext';
import { useFinance } from '../../context/FinanceContext';
import { useSite } from '../../context/SiteContext';
import { useSetup } from '../../context/SetupContext';
import { useAlerts } from '../../lib/useAlerts';
import { totals, budgetHealth, cashFlow } from '../../lib/finance';
import { snagOverdue } from '../../lib/site';
import { formatINR, todayStr } from '../../lib/reportData';

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' };
const tile = { display: 'block', textDecoration: 'none', color: 'var(--text-color)', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px' };
const TONES = { red: 'var(--st-red-fg)', amber: 'var(--st-amber-fg)', green: 'var(--st-green-fg)' };

function Tile({ to, label, value, tone, testId }) {
  return (
    <Link to={to} data-testid={testId} style={tile}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: tone ? TONES[tone] : 'var(--text-color)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </Link>
  );
}
const Heading = ({ children }) => <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>{children}</div>;

/** Owner view for admins and managers (money and schedule health), site view for internal members (my work today). */
export default function RoleDashboard() {
  const { user, isStaff } = useAuth();
  const { projects, projectTasks } = useProjects();
  const { summary, bills } = useFinance();
  const { snags, reports } = useSite();
  const { settings } = useSetup();
  const alerts = useAlerts();
  const today = todayStr();

  const money = useMemo(() => {
    const t = totals(summary);
    const lines = summary.filter((s) => ['over', 'warn'].includes(budgetHealth(s, settings?.budget_overrun_alert_percent ?? 90).key)).length;
    return { ...t, lines, overdue: cashFlow(bills, today).overdue };
  }, [summary, bills, settings, today]);
  const openSnags = snags.filter((s) => s.status === 'Open' || s.status === 'Fixed');

  if (isStaff) {
    const used = money.budget > 0 ? Math.round((money.committed / money.budget) * 100) : null;
    return (
      <div data-testid="owner-dashboard" style={{ marginBottom: '8px' }}>
        <Heading>Money</Heading>
        <div style={grid}>
          <Tile testId="od-budget" to="/projects/finance" label="Budget committed" value={used == null ? '—' : `${used}%`} tone={used != null && used > 100 ? 'red' : used != null && used >= (settings?.budget_overrun_alert_percent ?? 90) ? 'amber' : undefined} />
          <Tile to="/projects/finance" label="Billed, not yet paid" value={formatINR(money.payable)} />
          <Tile to="/projects/ra-bills" label="Overdue payables" value={formatINR(money.overdue)} tone={money.overdue > 0 ? 'red' : undefined} />
          <Tile to="/projects/budgets" label="Budget lines at risk" value={money.lines} tone={money.lines > 0 ? 'amber' : undefined} />
        </div>
        <Heading>Schedule and site</Heading>
        <div style={grid}>
          <Tile to="/projects/reports/delayed-tasks-summary" label="Overdue tasks" value={alerts.count} tone={alerts.count > 0 ? 'red' : undefined} />
          <Tile to="/projects/approvals" label="Approvals expiring or expired" value={alerts.site.approvals.length} tone={alerts.site.approvals.length ? 'amber' : undefined} />
          <Tile to="/projects/snags" label="Open snags (overdue)" value={`${openSnags.length} (${openSnags.filter((s) => snagOverdue(s, today)).length})`} />
          <Tile to="/projects/daily-report" label="Projects without today's report" value={alerts.site.missingReports.length} tone={alerts.site.missingReports.length ? 'amber' : undefined} />
        </div>
      </div>
    );
  }

  const mine = projectTasks.filter((t) => t.assigneeId === user?.id && !['Completed', 'Cancelled'].includes(t.status));
  const mySnags = openSnags.filter((s) => s.assignee_id === user?.id);
  const submitted = new Set(reports.filter((r) => r.report_date === today && r.status === 'submitted').map((r) => r.project_id));
  const dprDue = projects.filter((p) => p.status === 'Open' && !submitted.has(p.dbId)).length;
  return (
    <div data-testid="site-dashboard" style={{ marginBottom: '8px' }}>
      <Heading>My work</Heading>
      <div style={grid}>
        <Tile to="/projects/task" label="My open tasks" value={mine.length} />
        <Tile to="/projects/task" label="Of which overdue" value={mine.filter((t) => t.expectedEndDate && t.expectedEndDate < today).length} tone={mine.some((t) => t.expectedEndDate && t.expectedEndDate < today) ? 'red' : undefined} />
        <Tile to="/projects/snags" label="Snags assigned to me" value={mySnags.length} />
        <Tile to="/projects/daily-report/new" label="Reports still to file today" value={dprDue} tone={dprDue ? 'amber' : 'green'} />
      </div>
    </div>
  );
}
