import { delayedTasks, isClosed, daysBetween } from './reportData';

export const DUE_SOON_DAYS = 2;

/**
 * Task alerts for the notification drawer, sidebar badge and dashboard banner.
 * Returns nothing when alerts are switched off in the project settings.
 */
export function computeAlerts(tasks, today, enabled) {
  if (!enabled) return { enabled: false, overdue: [], dueSoon: [], count: 0 };
  const overdue = delayedTasks(tasks, today);
  const dueSoon = tasks
    .filter((t) => !isClosed(t) && t.expectedEndDate && t.expectedEndDate >= today && daysBetween(today, t.expectedEndDate) <= DUE_SOON_DAYS)
    .map((t) => ({ ...t, dueInDays: daysBetween(today, t.expectedEndDate) }))
    .sort((a, b) => a.dueInDays - b.dueInDays);
  return { enabled: true, overdue, dueSoon, count: overdue.length };
}
