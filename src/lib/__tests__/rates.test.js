import { describe, it, expect } from 'vitest';
import { resolveRates, previewTotals } from '../rates';

const lookups = {
  activityCosts: [{ employee: 'Rohan Mehta', billing_rate: 1500, costing_rate: 800, activity_types: { name: 'Site Supervision' } }],
  activityTypes: [{ name: 'Site Supervision', billing_rate: 1300, costing_rate: 700 }, { name: 'Marketing', billing_rate: 900, costing_rate: 500 }],
  settings: { default_billing_rate: 1000, default_costing_rate: 600 },
};

describe('resolveRates', () => {
  it('prefers the employee-specific rate (case-insensitive)', () => {
    expect(resolveRates({ activityType: 'Site Supervision' }, 'rohan mehta', lookups)).toEqual({ billing: 1500, costing: 800 });
  });
  it('falls back to the activity type, then settings defaults', () => {
    expect(resolveRates({ activityType: 'Site Supervision' }, 'Someone', lookups)).toEqual({ billing: 1300, costing: 700 });
    expect(resolveRates({ activityType: 'Unknown' }, 'Someone', lookups)).toEqual({ billing: 1000, costing: 600 });
  });
  it('keeps rates already stored on the entry', () => {
    expect(resolveRates({ activityType: 'Marketing', billingRate: 5, costingRate: 3 }, 'x', lookups)).toEqual({ billing: 5, costing: 3 });
  });
});

describe('previewTotals', () => {
  it('only bills billable hours but costs all hours', () => {
    const t = previewTotals([
      { activityType: 'Marketing', hrs: '2', isBillable: true },
      { activityType: 'Marketing', hrs: 3, isBillable: false },
    ], 'x', lookups);
    expect(t).toEqual({ hours: 5, billableHours: 2, billable: 1800, costing: 2500 });
  });
});
