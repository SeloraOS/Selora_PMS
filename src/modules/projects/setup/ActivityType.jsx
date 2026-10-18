import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';
import { formatINR } from '../../../lib/reportData';

const BILLING_TYPES = ['Hourly', 'Daily', 'Fixed Rate'];
const unit = { Hourly: '/hr', Daily: '/day', 'Fixed Rate': '' };
const rate = (v, type) => `${formatINR(v)}${unit[type] ?? ''}`;

export default function ActivityType() {
  const { activityTypes, loaded, save, remove } = useSetup();
  const { profile } = useAuth();

  return (
    <SetupListPage
      title="Activity Type"
      rows={activityTypes}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => r.name}
      filters={[{ key: 'billing', label: 'Billing Type', options: BILLING_TYPES, get: (r) => r.billing_type }]}
      columns={[
        { key: 'name', label: 'Activity Type' },
        { key: 'billing_type', label: 'Billing Type' },
        { key: 'billing_rate', label: 'Billing Rate', render: (r) => rate(r.billing_rate, r.billing_type) },
        { key: 'costing_rate', label: 'Costing Rate', render: (r) => rate(r.costing_rate, r.billing_type) },
      ]}
      fields={[
        { name: 'name', label: 'Activity Type Name', required: true },
        { name: 'billing_type', label: 'Billing Type', type: 'select', default: 'Hourly', options: BILLING_TYPES.map((v) => ({ value: v, label: v })) },
        { name: 'billing_rate', label: 'Billing Rate (₹)', type: 'number', default: 0 },
        { name: 'costing_rate', label: 'Costing Rate (₹)', type: 'number', default: 0 },
      ]}
      fromForm={(v) => ({ ...v, name: v.name.trim(), billing_rate: Number(v.billing_rate) || 0, costing_rate: Number(v.costing_rate) || 0 })}
      onSave={(values, row) => save('activity_types', values, row?.id)}
      onDelete={(row) => remove('activity_types', row.id)}
    />
  );
}
