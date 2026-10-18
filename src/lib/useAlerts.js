import { useMemo } from 'react';
import { useProjects } from '../context/ProjectsContext';
import { useSetup } from '../context/SetupContext';
import { computeAlerts } from './alerts';
import { todayStr } from './reportData';

export function useAlerts() {
  const { projectTasks } = useProjects();
  const { settings } = useSetup();
  const enabled = !!settings?.task_alerts;
  const today = todayStr();
  return useMemo(() => computeAlerts(projectTasks, today, enabled), [projectTasks, today, enabled]);
}
