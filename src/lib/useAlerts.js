import { useMemo } from 'react';
import { useProjects } from '../context/ProjectsContext';
import { useSetup } from '../context/SetupContext';
import { useSite } from '../context/SiteContext';
import { computeAlerts } from './alerts';
import { siteAlerts } from './site';
import { todayStr } from './reportData';

/** Task alerts (count = overdue tasks, used by the banner) plus site alerts; `total` feeds the sidebar badge. */
export function useAlerts() {
  const { projectTasks, projects } = useProjects();
  const { settings } = useSetup();
  const { approvals, snags, reports } = useSite();
  const enabled = !!settings?.task_alerts;
  const today = todayStr();
  const nowHm = new Date().toTimeString().slice(0, 5);
  return useMemo(() => {
    const tasks = computeAlerts(projectTasks, today, enabled);
    const site = siteAlerts({ approvals, snags, reports, projects }, { today, nowHm, settings });
    return { ...tasks, site, total: tasks.count + (enabled ? site.count : 0) };
  }, [projectTasks, projects, approvals, snags, reports, settings, today, nowHm, enabled]);
}
