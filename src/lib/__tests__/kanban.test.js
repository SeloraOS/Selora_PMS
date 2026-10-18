import { describe, it, expect } from 'vitest';
import { PIPELINES, pipelineById, NONE } from '../kanban';

const ctx = { projects: [{ projectName: 'A' }, { projectName: 'B' }], projectTypes: [{ name: 'Residential' }] };

describe('pipelines', () => {
  it('each page offers the agreed pipelines, status first', () => {
    expect(PIPELINES.project.map((p) => p.id)).toEqual(['status', 'priority', 'type', 'department']);
    expect(PIPELINES.task.map((p) => p.id)).toEqual(['status', 'priority', 'project']);
    expect(PIPELINES.timesheet.map((p) => p.id)).toEqual(['status', 'employee', 'project', 'customer']);
  });
  it('unknown ids fall back to the first pipeline', () => {
    expect(pipelineById('task', 'nope').id).toBe('status');
  });
  it('status columns match the database values', () => {
    expect(pipelineById('task', 'status').columns([], ctx).map((c) => c.id)).toEqual(['Open', 'Working', 'Pending', 'Overdue', 'Completed', 'Cancelled']);
  });
  it('relation pipelines list every option plus Unassigned, and dropping on Unassigned clears the field', () => {
    const p = pipelineById('task', 'project');
    expect(p.columns([], ctx).map((c) => c.id)).toEqual(['A', 'B', NONE]);
    expect(p.column({ project: '' })).toBe(NONE);
    expect(p.patch(NONE)).toEqual({ project: '' });
    expect(p.patch('B')).toEqual({ project: 'B' });
  });
  it('free-text pipelines build their columns from the values in use', () => {
    const p = pipelineById('timesheet', 'employee');
    const items = [{ employee: 'Zed' }, { employee: 'Amy' }, { employee: 'Amy' }, { employee: '' }];
    expect(p.columns(items, ctx).map((c) => c.id)).toEqual(['Amy', 'Zed', NONE]);
    expect(p.columns([{ employee: 'Amy' }], ctx).map((c) => c.id)).toEqual(['Amy']); // no Unassigned when everything is set
  });
});
