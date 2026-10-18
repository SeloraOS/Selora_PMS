/**
 * Topbar Component
 * Dynamic breadcrumb from URL + right-side slot from TopbarContext.
 */
import React, { useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { TopbarContext } from '../../context/TopbarContext';

/* ─── Label map ───────────────────────────────────────────────── */
const formatLabel = (segment) => {
  const map = {
    projects: 'Projects',
    project: 'Project',
    task: 'Task',
    timesheet: 'Timesheet',
    setup: 'Setup',
    reports: 'Reports',
    settings: 'Settings',
    'activity-type': 'Activity Type',
    'activity-cost': 'Activity Cost',
    'project-template': 'Project Template',
    'project-type': 'Project Type',
    'project-update': 'Project Update',
    'holiday-list': 'Holiday List',
    'project-summary': 'Project Summary',
    'daily-timesheet-summary': 'Daily Timesheet Summary',
    'timesheet-billing-summary': 'Timesheet Billing Summary',
    'project-wise-cost': 'Project wise Cost',
    users: 'Users',
    'delayed-tasks-summary': 'Delayed Tasks Summary',
    'getting-started': 'Getting Started',
  };

  return map[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
};

/* ─── Component ───────────────────────────────────────────────── */
export default function Topbar() {
  const location = useLocation();
  const { rightActions } = useContext(TopbarContext);

  const pathSegments = location.pathname.split('/').filter(Boolean);

  const sep = <span style={{ color: '#383838', margin: '0 4px' }}>/</span>;

  return (
    <header
      style={{
        backgroundColor: '#000000',
        height: '40px',
        minHeight: '40px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid #232323',
        zIndex: 100,
        justifyContent: 'space-between',
      }}
    >
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#7c7c7c' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', color: '#7c7c7c', textDecoration: 'none' }}>
          <Home size={14} style={{ color: '#7c7c7c' }} />
        </Link>

        {/* Static "Dashboard" crumb */}
        {sep}
        <Link to="/" style={{ color: '#7c7c7c', fontSize: '13px', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#afafaf')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7c7c7c')}>
          Dashboard
        </Link>

        {/* Dynamic path segments */}
        {pathSegments.map((segment, index) => {
          const path = '/' + pathSegments.slice(0, index + 1).join('/');
          const isLast = index === pathSegments.length - 1;
          const label = formatLabel(segment);

          return (
            <React.Fragment key={path}>
              {sep}
              {isLast ? (
                <span style={{ color: '#f8f8f8', fontSize: '13px', fontWeight: 600 }}>
                  {label}
                </span>
              ) : (
                <Link
                  to={path}
                  style={{ color: '#7c7c7c', fontSize: '13px', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#afafaf')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#7c7c7c')}
                >
                  {label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── Right-side slot (injected by current page) ─────────── */}
      {rightActions && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {rightActions}
        </div>
      )}
    </header>
  );
}
