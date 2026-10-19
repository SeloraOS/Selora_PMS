import { useMemo } from 'react';
import { useProjects } from '../context/ProjectsContext';
import { useSetup } from '../context/SetupContext';
import { useSite } from '../context/SiteContext';
import { useFinance } from '../context/FinanceContext';
import { todayStr } from './reportData';

/** Lookups the kanban pipelines and cards need for database-row pages (names for ids, today, warning days). */
export function useRowCtx() {
  const { projects } = useProjects();
  const { settings } = useSetup();
  const { snagCategories } = useSite();
  const { vendors, costHeads } = useFinance();
  const today = todayStr();
  return useMemo(() => {
    const pById = new Map(projects.map((p) => [p.dbId, p.projectName]));
    const vById = new Map(vendors.map((v) => [v.id, v.name]));
    const hById = new Map(costHeads.map((c) => [c.id, c.name]));
    return {
      projects, categories: snagCategories, vendors, costHeads, today, warnDays: settings?.approval_warning_days ?? 30,
      projectName: (id) => pById.get(id) || '', vendorName: (id) => vById.get(id) || '', headName: (id) => hById.get(id) || '',
    };
  }, [projects, snagCategories, vendors, costHeads, settings, today]);
}
