/**
 * UI permissions. These mirror the row level security policies in
 * supabase/migrations/0005_rls.sql; the database is the real enforcement.
 */
const MANAGERS = ['admin', 'manager'];

export function can(profile, action, record) {
  const role = profile?.role;
  switch (action) {
    case 'editSetup':
    case 'editSettings':
      return MANAGERS.includes(role);
    case 'manageUsers':
      return role === 'admin';
    case 'delete':
      // managers can delete anything; others only what they created
      return MANAGERS.includes(role) || (!!record?.createdBy && record.createdBy === profile?.id);
    default:
      return false;
  }
}
