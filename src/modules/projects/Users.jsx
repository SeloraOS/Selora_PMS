import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import SetupListPage from '../../components/shared/SetupListPage';
import { useSetup } from '../../context/SetupContext';
import { useAuth } from '../../context/AuthContext';
import { can, ROLE_LABELS } from '../../lib/permissions';
import InviteUserModal from '../../components/shared/InviteUserModal';
import { UserPlus } from 'lucide-react';

const ROLES = ['admin', 'manager', 'member', 'client', 'contractor'];

export default function Users() {
  const { profiles, loaded, updateRole } = useSetup();
  const { profile, loading } = useAuth();

  const [inviting, setInviting] = useState(false);
  if (!loading && profile && !can(profile, 'manageUsers') && !can(profile, 'invite')) return <Navigate to="/projects" replace />;

  return (
    <>
    {inviting && <InviteUserModal onClose={() => setInviting(false)} />}
    <SetupListPage
      title="User"
      rows={profiles}
      loading={!loaded}
      canEdit={can(profile, 'manageUsers')}
      extraActions={can(profile, 'invite') && (
        <button type="button" onClick={() => setInviting(true)} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={14} /> Invite user</button>
      )}
      canCreate={false}
      canDelete={() => false}
      searchText={(r) => `${r.full_name || ''} ${r.email || ''} ${r.role}`}
      filters={[{ key: 'role', label: 'Role', options: ROLES, get: (r) => r.role }]}
      columns={[
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => ROLE_LABELS[r.role] || r.role },
        { key: 'created_at', label: 'Joined', render: (r) => new Date(r.created_at).toLocaleDateString('en-GB') },
      ]}
      fields={[
        { name: 'role', label: 'Role', type: 'select', required: true, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
      ]}
      toForm={(r) => ({ role: r.role })}
      onSave={async (values, row) => {
        if (!row) return false; // accounts are created through sign-up
        if (row.id === profile?.id && values.role !== 'admin' && !window.confirm('You are about to remove your own admin access. Continue?')) return false;
        return updateRole(row.id, values.role);
      }}
      onDelete={async () => false}
    />
    </>
  );
}
