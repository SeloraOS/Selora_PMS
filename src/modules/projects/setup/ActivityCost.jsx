import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';
import { formatINR } from '../../../lib/reportData';

export default function ActivityCost() {
  const { activityCosts, activityTypes, loaded, save, remove } = useSetup();
  const { profile } = useAuth();
  const typeName = (r) => r.activity_types?.name || '—';

  return (
    <SetupListPage
      title="Activity Cost"
      rows={activityCosts}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => `${r.employee || ''} ${typeName(r)}`}
      filters={[{ key: 'type', label: 'Activity Type', options: activityTypes.map((a) => a.name), get: typeName }]}
      columns={[
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Activity Type', render: typeName },
        { key: 'billing_rate', label: 'Billing Rate', render: (r) => formatINR(r.billing_rate) },
        { key: 'costing_rate', label: 'Costing Rate', render: (r) => formatINR(r.costing_rate) },
      ]}
      fields={[
        { name: 'employee', label: 'Employee', required: true },
        { name: 'activity_type_id', label: 'Activity Type', type: 'select', required: true, options: activityTypes.map((a) => ({ value: a.id, label: a.name })) },
        { name: 'billing_rate', label: 'Billing Rate (₹)', type: 'number', default: 0 },
        { name: 'costing_rate', label: 'Costing Rate (₹)', type: 'number', default: 0 },
      ]}
      fromForm={(v) => ({ employee: v.employee.trim(), activity_type_id: v.activity_type_id, billing_rate: Number(v.billing_rate) || 0, costing_rate: Number(v.costing_rate) || 0 })}
      onSave={(values, row) => save('activity_costs', values, row?.id)}
      onDelete={(row) => remove('activity_costs', row.id)}
    />
  );
}
