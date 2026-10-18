import { describe, it, expect } from 'vitest';
import { SPECS, projectToRow, projectFromRow, taskToRow, taskFromRow, dependencyRows, projectUserRows, indexProjects } from '../mappers';

const types = [{ id: 't1', name: 'Residential Development' }];
const tasks = [
  { id: 'a', code: 'TASK-1', subject: 'A' },
  { id: 'b', code: 'TASK-2', subject: 'B' },
];
const idx = indexProjects([{ id: 'p1', project_name: 'Proj' }], types, tasks);

describe('field specs', () => {
  it('have unique UI keys and unique columns', () => {
    for (const spec of Object.values(SPECS)) {
      expect(new Set(spec.map((f) => f[0])).size).toBe(spec.length);
      expect(new Set(spec.map((f) => f[1])).size).toBe(spec.length);
    }
  });
});

describe('projects', () => {
  it('maps Yes/No, numbers, dates and the project type relation', () => {
    const row = projectToRow({ projectName: 'X', isActive: 'No', estimatedCost: '10.5', projectType: 'Residential Development', expectedStartDate: '', fromTime: '09:30' }, idx);
    expect(row).toMatchObject({ project_name: 'X', is_active: false, estimated_cost: 10.5, project_type_id: 't1', expected_start_date: null, from_time: '09:30' });
  });
  it('partial updates only touch the given fields', () => {
    expect(projectToRow({ status: 'Completed' }, idx)).toEqual({ status: 'Completed' });
  });
  it('reads rows back into UI shape with users', () => {
    const ui = projectFromRow({ code: 'PROJ-1', id: 'p1', project_name: 'X', is_active: true, project_type_id: 't1', from_time: '09:30:00', estimated_cost: '10.50',
      project_users: [{ user_email: 'b@x', full_name: 'B', sort_order: 1 }, { user_email: 'a@x', full_name: null, sort_order: 0 }] }, idx);
    expect(ui).toMatchObject({ id: 'PROJ-1', dbId: 'p1', isActive: 'Yes', projectType: 'Residential Development', fromTime: '09:30', estimatedCost: '10.50' });
    expect(ui.users.map((u) => u.user)).toEqual(['a@x', 'b@x']);
  });
  it('unknown project type clears the relation', () => {
    expect(projectToRow({ projectType: 'Nope' }, idx).project_type_id).toBeNull();
  });
});

describe('tasks', () => {
  it('stores Yes/No flags as booleans ("No" must be false)', () => {
    const row = taskToRow({ subject: 's', isTemplate: 'No', isGroup: 'Yes' }, idx);
    expect(row).toMatchObject({ is_template: false, is_group: true });
  });
  it('resolves parent code and project name to ids and back', () => {
    const row = taskToRow({ subject: 's', project: 'Proj', parentTask: 'TASK-2' }, idx);
    expect(row).toMatchObject({ project_id: 'p1', parent_task_id: 'b' });
    const ui = taskFromRow({ code: 'TASK-3', id: 'c', subject: 's', project_id: 'p1', parent_task_id: 'b', is_template: false, is_group: true,
      task_dependencies: [{ depends_on_id: 'a' }] }, idx);
    expect(ui).toMatchObject({ parentTask: 'TASK-2', project: 'Proj', isTemplate: 'No', isGroup: 'Yes' });
    expect(ui.dependencies).toEqual([{ taskId: 'TASK-1', subject: 'A', selected: false }]);
  });
});

describe('link rows', () => {
  it('dependencyRows drops blanks, unknown codes, duplicates and self links', () => {
    expect(dependencyRows('a', [{ taskId: 'TASK-1' }, { taskId: 'TASK-2' }, { taskId: 'TASK-2' }, { taskId: '' }, { taskId: 'NOPE' }], idx))
      .toEqual([{ task_id: 'a', depends_on_id: 'b' }]);
  });
  it('projectUserRows drops blanks and case-insensitive duplicates and keeps order', () => {
    expect(projectUserRows('p', [{ user: ' A@x.com ', fullName: 'A' }, { user: 'a@X.com', fullName: 'dup' }, { user: '' }, { user: 'b@x.com', fullName: '' }]))
      .toEqual([
        { project_id: 'p', user_email: 'A@x.com', full_name: 'A', sort_order: 0 },
        { project_id: 'p', user_email: 'b@x.com', full_name: null, sort_order: 1 },
      ]);
  });
});

describe('timesheet entries', () => {
  it('maps the task code to task_id and back', async () => {
    const { entriesToRows, timesheetFromRow } = await import('../mappers');
    const rows = entriesToRows('ts', [{ activityType: 'X', hrs: 2, isBillable: true, taskId: 'TASK-2' }, { activityType: 'Y', hrs: 1, taskId: 'NOPE' }], idx);
    expect(rows[0].task_id).toBe('b');
    expect(rows[1].task_id).toBeNull();
    const ui = timesheetFromRow({ code: 'TS-1', total_working_hours: 2, total_billable_hours: 2, total_billable_amount: 0, total_costing_amount: 0,
      timesheet_entries: [{ task_id: 'a', hours: 2, is_billable: true, sort_order: 0 }] }, idx);
    expect(ui.timeSheets[0].taskId).toBe('TASK-1');
  });
});
