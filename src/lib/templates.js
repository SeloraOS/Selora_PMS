import { addDays } from './dates.js';

/**
 * Task rows for a project created From Template.
 * Each template task starts `start_day` days after the project's expected start date (today if unset)
 * and lasts `duration` days (inclusive end date).
 */
export function scheduleTemplateTasks(project, templateTasks, today) {
  const start = project.expected_start_date || today;
  return templateTasks
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({
      subject: t.subject,
      description: t.description,
      project_id: project.id,
      company: project.company,
      expected_start_date: addDays(start, t.start_day),
      expected_end_date: addDays(start, t.start_day + t.duration - 1),
    }));
}
