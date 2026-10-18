/**
 * Mirrors resolve_entry_rates() in supabase/migrations/0009_task_links_rates.sql so the timesheet form
 * can preview totals before saving. Priority: employee activity cost > activity type > settings default.
 */
export function resolveRates(row, employee, { activityCosts = [], activityTypes = [], settings } = {}) {
  if (row.billingRate != null && row.costingRate != null) {
    return { billing: Number(row.billingRate), costing: Number(row.costingRate) };
  }
  const name = row.activityType;
  const emp = (employee || '').toLowerCase();
  const own = activityCosts.find((c) => c.activity_types?.name === name && (c.employee || '').toLowerCase() === emp);
  if (own) return { billing: Number(own.billing_rate), costing: Number(own.costing_rate) };
  const type = activityTypes.find((a) => a.name === name);
  if (type) return { billing: Number(type.billing_rate), costing: Number(type.costing_rate) };
  return {
    billing: Number(settings?.default_billing_rate) || 0,
    costing: Number(settings?.default_costing_rate) || 0,
  };
}

export function previewTotals(entries, employee, lookups) {
  let hours = 0, billableHours = 0, billable = 0, costing = 0;
  for (const e of entries) {
    const h = parseFloat(e.hrs || 0) || 0;
    const r = resolveRates(e, employee, lookups);
    hours += h;
    costing += h * r.costing;
    if (e.isBillable) { billableHours += h; billable += h * r.billing; }
  }
  return { hours, billableHours, billable, costing };
}
