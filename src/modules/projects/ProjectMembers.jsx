import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { watchTables } from '../../lib/realtime';
import { useAuth } from '../../context/AuthContext';
import { useSetup } from '../../context/SetupContext';
import { can, PROJECT_ROLE_LABELS, ROLE_LABELS } from '../../lib/permissions';
import InviteUserModal from '../../components/shared/InviteUserModal';

const field = { padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', fontFamily: 'inherit' };

/** Members tab on a project: who can see it and in what capacity. Staff manage; everyone with access can read. */
export default function ProjectMembers({ projectId }) {
  const { profile, user } = useAuth();
  const { profiles } = useSetup();
  const editable = can(profile, 'manageMembers');
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('project_users').select('*').eq('project_id', projectId).order('sort_order');
    setRows(data || []);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => watchTables(`members-${projectId}`, { project_users: load }), [projectId, load]);

  const who = (r) => profiles.find((p) => p.id === r.profile_id);
  const add = async () => {
    setError('');
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    const { error: err } = await supabase.from('project_users').insert({ project_id: projectId, user_email: clean, project_role: role, sort_order: rows.length, invited_by: user.id });
    if (err) return setError(err.code === '23505' ? 'That person is already a member.' : err.message);
    setEmail(''); load();
  };
  const changeRole = async (id, project_role) => { const { error: err } = await supabase.from('project_users').update({ project_role }).eq('id', id); if (err) setError(err.message); load(); };
  const remove = async (r) => { if (!window.confirm(`Remove ${r.user_email} from this project?`)) return; const { error: err } = await supabase.from('project_users').delete().eq('id', r.id); if (err) setError(err.message); load(); };

  return (
    <div data-testid="members-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Clients and contractors only see projects they are members of. Staff and internal members see projects according to the access settings.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ padding: '8px' }}>Person</th><th style={{ padding: '8px' }}>Account</th><th style={{ padding: '8px' }}>Role on this project</th><th style={{ padding: '8px' }} />
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} style={{ padding: '16px', color: 'var(--text-muted)' }}>No members yet.</td></tr>}
          {rows.map((r) => {
            const p = who(r);
            return (
              <tr key={r.id} data-testid="member-row" style={{ borderBottom: '1px solid var(--divider-color)' }}>
                <td style={{ padding: '8px' }}><div style={{ color: 'var(--text-color)' }}>{r.full_name || p?.full_name || r.user_email}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.user_email}</div></td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{p ? ROLE_LABELS[p.role] || p.role : r.profile_id ? 'Account' : 'No account yet'}</td>
                <td style={{ padding: '8px' }}>
                  {editable ? (
                    <select aria-label={`Role of ${r.user_email}`} value={r.project_role} onChange={(e) => changeRole(r.id, e.target.value)} style={field}>
                      {Object.entries(PROJECT_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : PROJECT_ROLE_LABELS[r.project_role]}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{editable && <button type="button" aria-label={`Remove ${r.user_email}`} onClick={() => remove(r)} style={{ ...field, color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input list="member-emails" aria-label="Member email" placeholder="Email of an existing user" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ ...field, minWidth: '260px' }} />
          <datalist id="member-emails">{profiles.map((p) => <option key={p.id} value={p.email} />)}</datalist>
          <select aria-label="Project role" value={role} onChange={(e) => setRole(e.target.value)} style={field}>{Object.entries(PROJECT_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button type="button" onClick={add} style={{ ...field, cursor: 'pointer', background: 'var(--gray-900)', color: '#ffffff', border: 'none', fontWeight: 600 }}>Add member</button>
          <button type="button" onClick={() => setInviting(true)} style={{ ...field, cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}><UserPlus size={14} /> Invite new person</button>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
      {inviting && <InviteUserModal projectId={projectId} onClose={() => setInviting(false)} onDone={load} />}
    </div>
  );
}
