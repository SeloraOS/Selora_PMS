import { describe, it, expect } from 'vitest';
import { computeBill, budgetHealth, totals, fiscalYear, sCurve, cashFlow } from '../finance';

describe('finance', () => {
  it('computes a bill like the database', () => {
    expect(computeBill(100000, { retention: 5, tds: 1, gst: 18 })).toEqual({ gross: 100000, retentionAmount: 5000, tdsAmount: 1000, gstAmount: 18000, net: 112000 });
    expect(computeBill('333.33', { retention: 5, tds: 2, gst: 18 }).net).toBe(369.99);
    expect(computeBill(0)).toMatchObject({ net: 0 });
  });
  it('rates budgets against committed value', () => {
    expect(budgetHealth({ budget: 100, committed: 120 })).toEqual({ key: 'over', pct: 120 });
    expect(budgetHealth({ budget: 100, committed: 92 }, 90)).toEqual({ key: 'warn', pct: 92 });
    expect(budgetHealth({ budget: 100, committed: 10 }).key).toBe('ok');
    expect(budgetHealth({ budget: 0, committed: 10 }).key).toBe('unbudgeted');
    expect(budgetHealth({ budget: 0, committed: 0 }).key).toBe('none');
  });
  it('sums totals', () => {
    expect(totals([{ budget: 100, committed: 60, billed: 40, paid: 10 }, { budget: 50, committed: 0, billed: 0, paid: 0 }])).toEqual({ budget: 150, committed: 60, billed: 40, paid: 10, balance: 90, payable: 30 });
  });
  it('finds the fiscal year', () => {
    expect(fiscalYear('2026-02-10', 4)).toEqual({ label: 'FY 2025-26', from: '2025-04-01', to: '2026-03-31' });
    expect(fiscalYear('2026-04-01', 4).label).toBe('FY 2026-27');
    expect(fiscalYear('2026-06-01', 1)).toEqual({ label: 'FY 2026', from: '2026-01-01', to: '2026-12-31' });
  });
  it('builds an S-curve from planned spans and completion', () => {
    const tasks = [
      { id: 'a', expectedStartDate: '2026-01-01', expectedEndDate: '2026-01-10', status: 'Completed', actualEndDate: '2026-01-10' },
      { id: 'b', expectedStartDate: '2026-01-11', expectedEndDate: '2026-01-20', status: 'Working', percentComplete: 50 },
    ];
    const c = sCurve(tasks, '2026-01-15', 4);
    expect(c[0].planned).toBeGreaterThanOrEqual(0);
    expect(c[c.length - 1].planned).toBe(100);
    expect(c[c.length - 1].actual).toBeNull();
    expect(sCurve([], '2026-01-01')).toEqual([]);
    expect(c.every((p, i) => i === 0 || p.planned >= c[i - 1].planned)).toBe(true);
  });
  it('groups outstanding bills by due month', () => {
    const bills = [
      { status: 'approved', net_amount: 1000, paid_amount: 400, due_date: '2026-02-10' },
      { status: 'approved', net_amount: 500, paid_amount: 0, due_date: '2026-03-05' },
      { status: 'approved', net_amount: 200, paid_amount: 0, due_date: '2026-01-01' },
      { status: 'paid', net_amount: 900, paid_amount: 900, due_date: '2026-02-10' },
      { status: 'draft', net_amount: 900, paid_amount: 0, due_date: '2026-02-10' },
    ];
    expect(cashFlow(bills, '2026-01-20')).toEqual({ overdue: 200, months: [{ month: '2026-02', amount: 600 }, { month: '2026-03', amount: 500 }] });
  });
});
