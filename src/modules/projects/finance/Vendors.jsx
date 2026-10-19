import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useFinance } from '../../../context/FinanceContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';
import { Pill } from './shared';

export default function Vendors() {
  const { vendors, workOrders, loaded, save, remove } = useFinance();
  const { profiles } = useSetup();
  const { profile } = useAuth();
  const login = (r) => profiles.find((p) => p.id === r.profile_id);
  const orders = (r) => workOrders.filter((w) => w.vendor_id === r.id).length;

  return (
    <SetupListPage
      title="Vendor"
      rows={vendors}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => `${r.code} ${r.name} ${r.category || ''} ${r.gstin || ''} ${r.contact_name || ''}`}
      filters={[{ key: 'active', label: 'Status', options: ['Active', 'Inactive'], get: (r) => (r.is_active ? 'Active' : 'Inactive') }]}
      columns={[
        { key: 'code', label: 'ID', sortType: 'code' },
        { key: 'name', label: 'Vendor' },
        { key: 'category', label: 'Category' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'contact', label: 'Contact', sortValue: (r) => r.contact_name, render: (r) => [r.contact_name, r.phone].filter(Boolean).join(' · ') || '—' },
        { key: 'orders', label: 'Work orders', sortType: 'number', sortValue: orders, render: orders },
        { key: 'status', label: 'Status', sortValue: (r) => (r.is_active ? 'Active' : 'Inactive'), render: (r) => <Pill color={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Inactive'}</Pill> },
      ]}
      fields={[
        { name: 'name', label: 'Vendor name', required: true },
        { name: 'category', label: 'Category (e.g. Civil, Electrical)' },
        { name: 'gstin', label: 'GSTIN (15 characters)' },
        { name: 'pan', label: 'PAN' },
        { name: 'contact_name', label: 'Contact person' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
        { name: 'bank_name', label: 'Bank' },
        { name: 'bank_account', label: 'Account number' },
        { name: 'ifsc', label: 'IFSC' },
        { name: 'profile_id', label: 'Portal login (contractor user)', type: 'select', placeholder: 'None', options: profiles.filter((p) => p.role === 'contractor').map((p) => ({ value: p.id, label: p.full_name || p.email })) },
        { name: 'is_active', label: 'Status', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] },
      ]}
      toForm={(r) => ({ ...r, profile_id: r.profile_id || '', is_active: r.is_active ? 'yes' : 'no' })}
      fromForm={(v) => ({
        name: v.name.trim(), category: v.category || null, gstin: v.gstin ? v.gstin.trim().toUpperCase() : null, pan: v.pan ? v.pan.trim().toUpperCase() : null,
        contact_name: v.contact_name || null, phone: v.phone || null, email: v.email || null, bank_name: v.bank_name || null, bank_account: v.bank_account || null,
        ifsc: v.ifsc ? v.ifsc.toUpperCase() : null, profile_id: v.profile_id || null, is_active: v.is_active !== 'no',
      })}
      onSave={(values, row) => save('vendors', values, row?.id)}
      onDelete={(row) => remove('vendors', row.id)}
      canDelete={(r) => can(profile, 'editSetup') && orders(r) === 0}
    />
  );
}
