import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectsContext';
import { ROLE_LABELS, PROJECT_ROLE_LABELS, defaultProjectRole } from '../../lib/permissions';

const field = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', fontFamily: 'inherit' };
const label = { display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' };

/** Invite someone via the invite-user edge function. `projectId` pre-selects one project (used from the Members tab). */
export default function InviteUserModal({ onClose, onDone, projectId }) {
  const { isStaff, role: myRole } = useAuth();
  const { projects } = useProjects();
  const roles = useMemo(() => (myRole === 'admin' ? ['member', 'client', 'contractor', 'manager', 'admin'] : ['member', 'client', 'contractor']), [myRole]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(projectId ? 'client' : 'member');
  const [picked, setPicked] = useState(() => (projectId ? { [projectId]: defaultProjectRole('client') } : {}));
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isStaff) return null;
  const external = role === 'client' || role === 'contractor';

  const changeRole = (r) => {
    setRole(r);
    setPicked((prev) => Object.fromEntries(Object.keys(prev).map((id) => [id, defaultProjectRole(r)])));
  };
  const toggleProject = (id) => setPicked((prev) => { const next = { ...prev }; if (id in next) delete next[id]; else next[id] = defaultProjectRole(role); return next; });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (external && Object.keys(picked).length === 0) return setError('Choose at least one project for a client or contractor.');
    setBusy(true);
    const { data, error: err } = await supabase.functions.invoke('invite-user', {
      body: { email, full_name: name, role, send_email: sendEmail, projects: Object.entries(picked).map(([project_id, project_role]) => ({ project_id, project_role })) },
    });
    setBusy(false);
    if (err) {
      let msg = err.message;
      try { const j = await err.context.json(); msg = j.error || msg; } catch { /* keep generic message */ }
      return setError(msg);
    }
    setResult(data);
    onDone && onDone(data);
  };

  const copy = async () => { try { await navigator.clipboard.writeText(result.temp_password); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };

  return createPortal(
    <div role="dialog" aria-label="Invite user" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '10px', width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <strong style={{ fontSize: '15px' }}>Invite user</strong>
          <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {result ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '14px' }}><strong>{result.email}</strong> was added as {ROLE_LABELS[result.role] || result.role}.</div>
            {result.temp_password ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share this temporary password securely. It is shown only once, and they must choose their own password at first sign-in.</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code data-testid="temp-password" style={{ flex: 1, padding: '10px 12px', background: 'var(--surface-gray-2)', borderRadius: '6px', fontSize: '14px', letterSpacing: '0.04em' }}>{result.temp_password}</code>
                  <button type="button" onClick={copy} style={{ ...field, width: 'auto', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
                </div>
              </>
            ) : <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>An invitation email has been sent.</div>}
            <button type="button" onClick={onClose} style={{ ...field, width: 'auto', alignSelf: 'flex-end', cursor: 'pointer', background: 'var(--gray-900)', color: '#ffffff', border: 'none', fontWeight: 600 }}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label style={label}>Email *</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={field} autoFocus /></div>
            <div><label style={label}>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} style={field} /></div>
            <div>
              <label style={label}>Role</label>
              <select value={role} onChange={(e) => changeRole(e.target.value)} style={field}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {external ? 'Sees only the projects selected below. Cannot see timesheets, rates or internal notes.' : role === 'member' ? 'Internal employee. Sees all projects unless restricted in Settings.' : 'Staff: full access.'}
              </div>
            </div>
            <div>
              <label style={label}>Projects {external ? '*' : '(optional)'}</label>
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px' }}>
                {projects.map((p) => (
                  <div key={p.dbId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px' }}>
                    <input type="checkbox" id={`inv-${p.dbId}`} checked={p.dbId in picked} onChange={() => toggleProject(p.dbId)} style={{ accentColor: 'var(--gray-900)' }} />
                    <label htmlFor={`inv-${p.dbId}`} style={{ flex: 1, fontSize: '13px', cursor: 'pointer' }}>{p.projectName}</label>
                    {p.dbId in picked && (
                      <select aria-label={`Role on ${p.projectName}`} value={picked[p.dbId]} onChange={(e) => setPicked((prev) => ({ ...prev, [p.dbId]: e.target.value }))} style={{ ...field, width: 'auto', padding: '3px 6px', fontSize: '12px' }}>
                        {Object.entries(PROJECT_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} style={{ accentColor: 'var(--gray-900)' }} />
              Send an invitation email instead of a temporary password (needs working SMTP on the server)
            </label>
            {error && <div role="alert" style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={{ ...field, width: 'auto', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={busy} style={{ ...field, width: 'auto', cursor: 'pointer', background: 'var(--gray-900)', color: '#ffffff', border: 'none', fontWeight: 600, opacity: busy ? 0.7 : 1 }}>{busy ? 'Inviting…' : 'Invite'}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
