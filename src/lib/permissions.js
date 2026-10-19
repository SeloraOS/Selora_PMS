/**
 * UI permissions. These mirror the row level security policies (supabase/migrations/0005, 0021);
 * the database is the real enforcement.
 *
 * Roles: admin, manager (staff) | member (internal) | client, contractor (external, project members only).
 */
const STAFF = ['admin', 'manager'];
const INTERNAL = ['admin', 'manager', 'member'];
const EXTERNAL = ['client', 'contractor'];

export const isStaff = (profile) => STAFF.includes(profile?.role);
export const isInternal = (profile) => INTERNAL.includes(profile?.role);
export const isExternal = (profile) => EXTERNAL.includes(profile?.role);

export function can(profile, action, record) {
  const role = profile?.role;
  switch (action) {
    case 'editSetup':
    case 'editSettings':
    case 'manageMembers':
    case 'invite':
      return STAFF.includes(role);
    case 'manageUsers':
      return role === 'admin';
    case 'createRecords':
    case 'viewInternal': // timesheets, rates, cost data, internal comments/files
      return INTERNAL.includes(role);
    case 'delete':
      // staff can delete anything; other internal users only what they created; externals never
      return STAFF.includes(role) || (role === 'member' && !!record?.createdBy && record.createdBy === profile?.id);
    default:
      return false;
  }
}

export const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', member: 'Member (internal)', client: 'Client', contractor: 'Contractor' };
export const PROJECT_ROLE_LABELS = { owner: 'Owner', staff: 'Staff', contractor: 'Contractor', client: 'Client', viewer: 'Viewer' };
export const defaultProjectRole = (role) => ({ client: 'client', contractor: 'contractor', member: 'staff', manager: 'owner', admin: 'owner' }[role] || 'viewer');
