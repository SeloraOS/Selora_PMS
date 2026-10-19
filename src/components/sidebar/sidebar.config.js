export const PROJECTS_SIDEBAR_CONFIG = {
  main: [
    {
      key: 'notifications',
      label: 'Notification',
      icon: 'Bell',
      route: '/notifications',
    },
  ],
  erp: [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      route: '/projects',
    },
    {
      key: 'project',
      label: 'Project',
      icon: 'Folder',
      route: '/projects/project',
    },
    {
      key: 'task',
      label: 'Task',
      icon: 'CheckSquare',
      route: '/projects/task',
    },
    {
      key: 'timesheet',
      label: 'Timesheet',
      icon: 'Clock',
      route: '/projects/timesheet',
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: 'CalendarDays',
      route: '/projects/calendar',
    },
  ],
  setup: [
    {
      key: 'activityType',
      label: 'Activity Type',
      icon: 'Activity',
      route: '/projects/setup/activity-type',
    },
    {
      key: 'activityCost',
      label: 'Activity Cost',
      icon: 'DollarSign',
      route: '/projects/setup/activity-cost',
    },
    {
      key: 'projectTemplate',
      label: 'Project Template',
      icon: 'LayoutGrid',
      route: '/projects/setup/project-template',
    },
    {
      key: 'projectType',
      label: 'Project Type',
      icon: 'Tag',
      route: '/projects/setup/project-type',
    },
    {
      key: 'projectUpdate',
      label: 'Project Update',
      icon: 'RefreshCw',
      route: '/projects/setup/project-update',
    },
    {
      key: 'holidayList',
      label: 'Holiday List',
      icon: 'CalendarDays',
      route: '/projects/setup/holiday-list',
    },
  ],
  reports: [
    {
      key: 'projectSummary',
      label: 'Project Summary',
      icon: 'FileText',
      route: '/projects/reports/project-summary',
    },
    {
      key: 'dailyTimesheetSummary',
      label: 'Daily Timesheet Summary',
      icon: 'Calendar',
      route: '/projects/reports/daily-timesheet-summary',
    },
    {
      key: 'timesheetBillingSummary',
      label: 'Timesheet Billing Summary',
      icon: 'Receipt',
      route: '/projects/reports/timesheet-billing-summary',
    },
    {
      key: 'projectWiseCost',
      label: 'Project wise Cost',
      icon: 'DollarSign',
      route: '/projects/reports/project-wise-cost',
    },
    {
      key: 'delayedTasksSummary',
      label: 'Delayed Tasks Summary',
      icon: 'AlarmClock',
      route: '/projects/reports/delayed-tasks-summary',
    },
  ],
  settings: [
    {
      key: 'projectsSettings',
      label: 'Projects Settings',
      icon: 'Settings',
      route: '/projects/settings',
    },
    {
      key: 'users',
      label: 'Users',
      icon: 'Users',
      route: '/projects/users',
      adminOnly: true,
    },
  ],
  footer: [
    {
      key: 'gettingStarted',
      label: 'Getting Started',
      icon: 'Compass',
      route: '/projects/getting-started',
    },
  ],
};
