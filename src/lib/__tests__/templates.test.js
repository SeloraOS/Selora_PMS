import { describe, it, expect } from 'vitest';
import { scheduleTemplateTasks } from '../templates';

const tasks = [
  { subject: 'B', description: null, start_day: 15, duration: 60, sort_order: 1 },
  { subject: 'A', description: 'd', start_day: 0, duration: 30, sort_order: 0 },
  { subject: 'C', description: null, start_day: 75, duration: 1, sort_order: 2 },
];

describe('scheduleTemplateTasks', () => {
  it('orders tasks and schedules from the project start date', () => {
    const rows = scheduleTemplateTasks({ id: 'p', company: 'Co', expected_start_date: '2026-11-01' }, tasks, '2026-01-01');
    expect(rows.map((r) => r.subject)).toEqual(['A', 'B', 'C']);
    expect(rows[0]).toMatchObject({ project_id: 'p', company: 'Co', expected_start_date: '2026-11-01', expected_end_date: '2026-11-30' });
    expect(rows[1]).toMatchObject({ expected_start_date: '2026-11-16', expected_end_date: '2027-01-14' });
    expect(rows[2]).toMatchObject({ expected_start_date: '2027-01-15', expected_end_date: '2027-01-15' }); // 1 day: ends the day it starts
  });
  it('falls back to today when the project has no start date', () => {
    const [r] = scheduleTemplateTasks({ id: 'p', company: 'Co', expected_start_date: null }, tasks, '2026-02-27');
    expect(r.expected_start_date).toBe('2026-02-27');
    expect(r.expected_end_date).toBe('2026-03-28');
  });
  it('returns nothing for an empty template', () => {
    expect(scheduleTemplateTasks({ id: 'p' }, [], '2026-01-01')).toEqual([]);
  });
});
