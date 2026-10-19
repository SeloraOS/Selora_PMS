import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import { ProjectsProvider } from './context/ProjectsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ChangePassword from './pages/ChangePassword';
import { PortalHome, PortalProject, PortalTask } from './modules/projects/Portal';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import ProjectsDashboard from './modules/projects';
import ProjectList from './modules/projects/ProjectList';
import ProjectDetail from './modules/projects/ProjectDetail';
import TaskList from './modules/projects/TaskList';
import TaskDetail from './modules/projects/TaskDetail';
import TimesheetList from './modules/projects/TimesheetList';
import TimesheetDetail from './modules/projects/TimesheetDetail';
import ActivityType from './modules/projects/setup/ActivityType';
import ActivityCost from './modules/projects/setup/ActivityCost';
import ProjectTemplate from './modules/projects/setup/ProjectTemplate';
import ProjectType from './modules/projects/setup/ProjectType';
import ProjectUpdate from './modules/projects/setup/ProjectUpdate';
import HolidayList from './modules/projects/setup/HolidayList';
import ProjectSummary from './modules/projects/reports/ProjectSummary';
import DailyTimesheetSummary from './modules/projects/reports/DailyTimesheetSummary';
import TimesheetBillingSummary from './modules/projects/reports/TimesheetBillingSummary';
import ProjectWiseCost from './modules/projects/reports/ProjectWiseCost';
import Users from './modules/projects/Users';
import Calendar from './modules/projects/Calendar';
import { SetupProvider } from './context/SetupContext';
import DelayedTasksSummary from './modules/projects/reports/DelayedTasksSummary';
import ProjectsSearch from './modules/projects/ProjectsSearch';
import ProjectsSettings from './modules/projects/ProjectsSettings';
import GettingStarted from './modules/projects/GettingStarted';

const Placeholder = ({ title }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: '#0f0f0f',
    color: 'var(--text-faint)',
    gap: 12,
  }}>
    <Construction size={40} strokeWidth={1} />
    <p style={{ fontSize: 14 }}>
      {title} — Coming Soon
    </p>
  </div>
);

function RequireAuth({ children }) {
  const { user, loading, profile, profileLoading } = useAuth();
  const location = useLocation();
  if (loading || (user && profileLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.must_change_password && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return children;
}

/** Routes that clients and contractors must not reach (also enforced by row level security). */
function InternalOnly({ children }) {
  const { isExternal } = useAuth();
  return isExternal ? <Navigate to="/projects" replace /> : children;
}

/** One URL, two screens: the internal page for staff/members, the portal page for clients/contractors. */
function ByRole({ internal, external }) {
  const { isExternal } = useAuth();
  return isExternal ? external : internal;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <SetupProvider>
                  <ProjectsProvider>
                    <AppShell />
                  </ProjectsProvider>
                </SetupProvider>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="notifications" element={<Placeholder title="Notifications" />} />
            <Route path="projects" element={<ByRole internal={<ProjectsDashboard />} external={<PortalHome />} />} />
            <Route path="projects/project" element={<InternalOnly><ProjectList /></InternalOnly>} />
            <Route path="projects/project/:id" element={<ByRole internal={<ProjectDetail />} external={<PortalProject />} />} />
            <Route path="projects/task" element={<InternalOnly><TaskList /></InternalOnly>} />
            <Route path="projects/task/:id" element={<ByRole internal={<TaskDetail />} external={<PortalTask />} />} />
            <Route path="projects/timesheet" element={<InternalOnly><TimesheetList /></InternalOnly>} />
            <Route path="projects/timesheet/:id" element={<InternalOnly><TimesheetDetail /></InternalOnly>} />
            <Route path="projects/setup/activity-type" element={<InternalOnly><ActivityType /></InternalOnly>} />
            <Route path="projects/setup/activity-cost" element={<InternalOnly><ActivityCost /></InternalOnly>} />
            <Route path="projects/setup/project-template" element={<InternalOnly><ProjectTemplate /></InternalOnly>} />
            <Route path="projects/setup/project-type" element={<InternalOnly><ProjectType /></InternalOnly>} />
            <Route path="projects/setup/project-update" element={<InternalOnly><ProjectUpdate /></InternalOnly>} />
            <Route path="projects/setup/holiday-list" element={<InternalOnly><HolidayList /></InternalOnly>} />
            <Route path="projects/reports/project-summary" element={<InternalOnly><ProjectSummary /></InternalOnly>} />
            <Route path="projects/reports/daily-timesheet-summary" element={<InternalOnly><DailyTimesheetSummary /></InternalOnly>} />
            <Route path="projects/reports/timesheet-billing-summary" element={<InternalOnly><TimesheetBillingSummary /></InternalOnly>} />
            <Route path="projects/reports/project-wise-cost" element={<InternalOnly><ProjectWiseCost /></InternalOnly>} />
            <Route path="projects/reports/project-wise-stock-tracking" element={<Navigate to="/projects/reports/project-wise-cost" replace />} />
            <Route path="projects/users" element={<InternalOnly><Users /></InternalOnly>} />
            <Route path="projects/calendar" element={<Calendar />} />
            <Route path="projects/reports/delayed-tasks-summary" element={<InternalOnly><DelayedTasksSummary /></InternalOnly>} />
            <Route path="projects/settings" element={<InternalOnly><ProjectsSettings /></InternalOnly>} />
            <Route path="projects/getting-started" element={<InternalOnly><GettingStarted /></InternalOnly>} />
            <Route path="projects/search" element={<InternalOnly><ProjectsSearch /></InternalOnly>} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
