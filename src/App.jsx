import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import { ProjectsProvider } from './context/ProjectsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="projects" element={<ProjectsDashboard />} />
            <Route path="projects/project" element={<ProjectList />} />
            <Route path="projects/project/:id" element={<ProjectDetail />} />
            <Route path="projects/task" element={<TaskList />} />
            <Route path="projects/task/:id" element={<TaskDetail />} />
            <Route path="projects/timesheet" element={<TimesheetList />} />
            <Route path="projects/timesheet/:id" element={<TimesheetDetail />} />
            <Route path="projects/setup/activity-type" element={<ActivityType />} />
            <Route path="projects/setup/activity-cost" element={<ActivityCost />} />
            <Route path="projects/setup/project-template" element={<ProjectTemplate />} />
            <Route path="projects/setup/project-type" element={<ProjectType />} />
            <Route path="projects/setup/project-update" element={<ProjectUpdate />} />
            <Route path="projects/setup/holiday-list" element={<HolidayList />} />
            <Route path="projects/reports/project-summary" element={<ProjectSummary />} />
            <Route path="projects/reports/daily-timesheet-summary" element={<DailyTimesheetSummary />} />
            <Route path="projects/reports/timesheet-billing-summary" element={<TimesheetBillingSummary />} />
            <Route path="projects/reports/project-wise-cost" element={<ProjectWiseCost />} />
            <Route path="projects/reports/project-wise-stock-tracking" element={<Navigate to="/projects/reports/project-wise-cost" replace />} />
            <Route path="projects/users" element={<Users />} />
            <Route path="projects/calendar" element={<Calendar />} />
            <Route path="projects/reports/delayed-tasks-summary" element={<DelayedTasksSummary />} />
            <Route path="projects/settings" element={<ProjectsSettings />} />
            <Route path="projects/getting-started" element={<GettingStarted />} />
            <Route path="projects/search" element={<ProjectsSearch />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
