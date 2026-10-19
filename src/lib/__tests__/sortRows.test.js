import { describe, it, expect } from 'vitest';
import { sortRows } from '../sortRows';

const rows = [
  { id: 'PROJ-0010', name: 'beta', cost: '200', due: '2026-11-02', prio: 'High', createdAt: '2026-10-19T10:00:00Z' },
  { id: 'PROJ-0009', name: 'Alpha', cost: '1000', due: '', prio: 'Low', createdAt: '2026-10-19T11:00:00Z' },
  { id: 'PROJ-0100', name: 'gamma', cost: '', due: '2026-10-01', prio: 'Urgent', createdAt: '2026-10-18T09:00:00Z' },
  { id: 'PROJ-0011', name: 'Delta', cost: '30', due: '2026-12-01', prio: 'Medium', createdAt: '2026-10-20T08:00:00Z' },
];
const ids = (r) => r.map((x) => x.id);

describe('sortRows', () => {
  it('sorts codes naturally, not alphabetically', () => {
    expect(ids(sortRows(rows, { key: 'id', sortType: 'code' }, 'asc'))).toEqual(['PROJ-0009', 'PROJ-0010', 'PROJ-0011', 'PROJ-0100']);
    expect(ids(sortRows(rows, { key: 'id', sortType: 'code' }, 'desc'))).toEqual(['PROJ-0100', 'PROJ-0011', 'PROJ-0010', 'PROJ-0009']);
  });
  it('text sort ignores case', () => {
    expect(sortRows(rows, { key: 'name' }, 'asc').map((r) => r.name)).toEqual(['Alpha', 'beta', 'Delta', 'gamma']);
  });
  it('numbers compare numerically and empty values go last in both directions', () => {
    const col = { key: 'cost', sortType: 'number' };
    expect(sortRows(rows, col, 'asc').map((r) => r.cost)).toEqual(['30', '200', '1000', '']);
    expect(sortRows(rows, col, 'desc').map((r) => r.cost)).toEqual(['1000', '200', '30', '']);
  });
  it('dates, with empties last', () => {
    expect(ids(sortRows(rows, { key: 'due', sortType: 'date' }, 'asc'))).toEqual(['PROJ-0100', 'PROJ-0010', 'PROJ-0011', 'PROJ-0009']);
    expect(ids(sortRows(rows, { key: 'due', sortType: 'date' }, 'desc'))).toEqual(['PROJ-0011', 'PROJ-0010', 'PROJ-0100', 'PROJ-0009']);
  });
  it('rank order (Low < Medium < High < Urgent)', () => {
    const col = { key: 'prio', sortType: 'rank', rank: ['Low', 'Medium', 'High', 'Urgent'] };
    expect(sortRows(rows, col, 'asc').map((r) => r.prio)).toEqual(['Low', 'Medium', 'High', 'Urgent']);
  });
  it('custom sortValue (created timestamp) and stable ties', () => {
    const col = { key: 'createdOn', sortType: 'date', sortValue: (r) => r.createdAt };
    expect(ids(sortRows(rows, col, 'desc'))).toEqual(['PROJ-0011', 'PROJ-0009', 'PROJ-0010', 'PROJ-0100']);
    const same = [{ id: 'a', k: 1 }, { id: 'b', k: 1 }, { id: 'c', k: 1 }];
    expect(ids(sortRows(same, { key: 'k', sortType: 'number' }, 'desc'))).toEqual(['a', 'b', 'c']);
  });
  it('does not mutate and tolerates a missing column', () => {
    const copy = [...rows];
    sortRows(rows, { key: 'name' }, 'asc');
    expect(rows).toEqual(copy);
    expect(sortRows(rows, undefined)).toBe(rows);
  });
});
