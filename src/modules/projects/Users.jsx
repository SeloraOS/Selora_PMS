import React from 'react';
import { Navigate } from 'react-router-dom';
import SetupListPage from '../../components/shared/SetupListPage';
import { useSetup } from '../../context/SetupContext';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

const ROLES = ['admin', 'manager', 'member'];

export default function Users() {
  const { profiles, loaded, updateRole } = useSetup();
  const { profile, loading } = useAuth();

  if (!loading && profile && !can(profile, 'manageUsers')) return <Navigate to="/projects" replace />;

  return (
    <SetupListPage
      title="User"
      rows={profiles}
      loading={!loaded}
      canEdit={can(profile, 'manageUsers')}
      canCreate={false}
      canDelete={() => false}
      searchText={(r) => `${r.full_name || ''} ${r.email || ''} ${r.role}`}
      filters={[{ key: 'role', label: 'Role', options: ROLES, get: (r) => r.role }]}
      columns={[
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'created_at', label: 'Joined', render: (r) => new Date(r.created_at).toLocaleDateString('en-GB') },
      ]}
      fields={[
        { name: 'role', label: 'Role', type: 'select', required: true, options: ROLES.map((r) => ({ value: r, label: r })) },
      ]}
      toForm={(r) => ({ role: r.role })}
      onSave={async (values, row) => {
        if (!row) return false; // accounts are created through sign-up
        if (row.id === profile?.id && values.role !== 'admin' && !window.confirm('You are about to remove your own admin access. Continue?')) return false;
        return updateRole(row.id, values.role);
      }}
      onDelete={async () => false}
    />
  );
}
