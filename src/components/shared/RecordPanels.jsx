/**
 * Files, discussion and activity panels for a record (project, task, ...).
 * Data access is enforced by row level security (migrations 0020/0021): clients only see "shared" items,
 * only internal users see the activity feed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Paperclip, Download, Trash2, Send, Lock, Users, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { watchTables } from '../../lib/realtime';
import { summarizeAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import { useSetup } from '../../context/SetupContext';

const DEFAULT_TYPES = 'pdf,png,jpg,jpeg,webp,doc,docx,xls,xlsx,csv,dwg,zip';
const card = { border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--card-bg)' };
const muted = { fontSize: '12px', color: 'var(--text-muted)' };
const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' };
const primary = { ...btn, background: 'var(--gray-900)', borderColor: 'var(--gray-900)', color: '#ffffff', fontWeight: 600 };

const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmtWhen = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const safeName = (name) => name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_');

function useNames() {
  const { profiles } = useSetup();
  return useCallback((id) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || 'Someone', [profiles]);
}

function VisibilityBadge({ visibility }) {
  const shared = visibility === 'shared';
  return (
    <span title={shared ? 'Visible to clients and contractors on this project' : 'Internal only'} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '1px 8px', borderRadius: '10px', background: shared ? 'var(--st-green-bg)' : 'var(--surface-gray-2)', color: shared ? 'var(--st-green-fg)' : 'var(--text-muted)' }}>
      {shared ? <Users size={10} /> : <Lock size={10} />} {shared ? 'Shared' : 'Internal'}
    </span>
  );
}

function ShareToggle({ checked, onChange, label }) {
  const { isInternal } = useAuth();
  if (!isInternal) return null; // external users' items are always shared
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: 'var(--gray-900)' }} /> {label}
    </label>
  );
}

// ── Files ────────────────────────────────────────────────────────────────────
export function FilesPanel({ projectId, recordType, recordId }) {
  const { user, isStaff, isInternal, isExternal, role } = useAuth();
  const { settings } = useSetup();
  const nameOf = useNames();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);
  const canUpload = role && role !== 'client';
  const maxMb = settings?.max_upload_mb ?? 25;
  const allowed = (settings?.allowed_file_types ?? DEFAULT_TYPES).toLowerCase().replace(/\s/g, '').split(',');

  const load = useCallback(async () => {
    const { data } = await supabase.from('attachments').select('*').eq('record_type', recordType).eq('record_id', recordId).order('created_at', { ascending: false });
    setRows(data || []);
  }, [recordType, recordId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => watchTables(`files-${recordId}`, { attachments: load }), [recordId, load]);

  const upload = async (fileList) => {
    setError(''); setBusy(true);
    for (const file of fileList) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowed.includes(ext)) { setError(`".${ext}" files are not allowed (allowed: ${allowed.join(', ')})`); continue; }
      if (file.size > maxMb * 1024 * 1024) { setError(`${file.name} is larger than ${maxMb} MB`); continue; }
      const path = `${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from('project-files').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) { setError(up.error.message); continue; }
      const { error: insErr } = await supabase.from('attachments').insert({
        project_id: projectId, record_type: recordType, record_id: recordId, storage_path: path, name: file.name, mime: file.type || null,
        size_bytes: file.size, visibility: isExternal || shared ? 'shared' : 'internal', uploaded_by: user.id,
      });
      if (insErr) { setError(insErr.message); await supabase.storage.from('project-files').remove([path]); }
    }
    setBusy(false); load();
  };

  const open = async (row) => {
    const { data, error: e } = await supabase.storage.from('project-files').createSignedUrl(row.storage_path, 60);
    if (e) return setError(e.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    const { error: e } = await supabase.from('attachments').delete().eq('id', row.id);
    if (e) return setError(e.message);
    await supabase.storage.from('project-files').remove([row.storage_path]);
    load();
  };

  return (
    <div data-testid="files-panel" style={{ ...card, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><Paperclip size={14} /> Files ({rows.length})</strong>
        {canUpload && (
          <>
            <label style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Uploading…' : 'Upload files'}
              <input type="file" multiple hidden disabled={busy} onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
            </label>
            <ShareToggle checked={shared} onChange={setShared} label="Share with clients and contractors" />
            <span style={muted}>Max {maxMb} MB · {allowed.join(', ')}</span>
          </>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>{error}</div>}
      {rows.length === 0 ? <div style={muted}>No files yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((r) => (
            <div key={r.id} data-testid="file-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <FileText size={16} color="var(--text-muted)" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={muted}>{fmtSize(r.size_bytes)} · {nameOf(r.uploaded_by)} · {fmtWhen(r.created_at)}</div>
              </div>
              {isInternal && <VisibilityBadge visibility={r.visibility} />}
              <button type="button" aria-label={`Download ${r.name}`} onClick={() => open(r)} style={btn}><Download size={13} /></button>
              {(isStaff || r.uploaded_by === user?.id) && <button type="button" aria-label={`Delete ${r.name}`} onClick={() => remove(r)} style={{ ...btn, color: '#ef4444' }}><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Discussion ───────────────────────────────────────────────────────────────
export function CommentsPanel({ projectId, recordType, recordId }) {
  const { user, role, isStaff, isInternal } = useAuth();
  const { settings } = useSetup();
  const nameOf = useNames();
  const [rows, setRows] = useState([]);
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(false);
  const [error, setError] = useState('');
  const canPost = isInternal || role === 'contractor' || (role === 'client' && (settings?.client_can_comment ?? true));

  const load = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*').eq('record_type', recordType).eq('record_id', recordId).order('created_at', { ascending: true });
    setRows(data || []);
  }, [recordType, recordId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => watchTables(`comments-${recordId}`, { comments: load }), [recordId, load]);

  const post = async () => {
    if (!body.trim()) return;
    setError('');
    const { error: err } = await supabase.from('comments').insert({ project_id: projectId, record_type: recordType, record_id: recordId, body: body.trim(), visibility: isInternal ? (shared ? 'shared' : 'internal') : 'shared', author: user.id });
    if (err) return setError(err.message);
    setBody(''); load();
  };
  const remove = async (id) => { if (window.confirm('Delete this comment?')) { await supabase.from('comments').delete().eq('id', id); load(); } };

  return (
    <div data-testid="comments-panel" style={{ ...card, padding: '16px 20px' }}>
      <strong style={{ fontSize: '14px' }}>Discussion ({rows.length})</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '12px 0' }}>
        {rows.length === 0 && <div style={muted}>No comments yet.</div>}
        {rows.map((c) => (
          <div key={c.id} data-testid="comment-row" style={{ padding: '10px 12px', background: c.author === user?.id ? 'var(--surface-blue-1)' : 'var(--surface-gray-1)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-color)' }}>{nameOf(c.author)}</strong>
              <span style={muted}>{fmtWhen(c.created_at)}</span>
              {isInternal && <VisibilityBadge visibility={c.visibility} />}
              {(isStaff || c.author === user?.id) && <button type="button" aria-label="Delete comment" onClick={() => remove(c.id)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={12} /></button>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
          </div>
        ))}
      </div>
      {canPost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea aria-label="Write a comment" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" onClick={post} style={primary}><Send size={13} /> Post</button>
            <ShareToggle checked={shared} onChange={setShared} label="Share with clients and contractors" />
          </div>
          {error && <div role="alert" style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
        </div>
      ) : <div style={muted}>Commenting is turned off for your account.</div>}
    </div>
  );
}

// ── Activity (internal only; row level security hides it from clients) ───────
export function ActivityPanel({ projectId, recordId }) {
  const nameOf = useNames();
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(60);
    q = recordId ? q.eq('record_id', recordId) : q.eq('project_id', projectId);
    const { data } = await q;
    setRows(data || []);
  }, [projectId, recordId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => watchTables(`audit-${recordId || projectId}`, { audit_log: load }), [recordId, projectId, load]);

  return (
    <div data-testid="activity-panel" style={{ ...card, padding: '16px 20px' }}>
      <strong style={{ fontSize: '14px' }}>Activity</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        {rows.length === 0 && <div style={muted}>No activity recorded yet.</div>}
        {rows.map((r) => {
          const s = summarizeAudit(r);
          return (
            <div key={r.id} data-testid="activity-row" style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-color)' }}><strong>{r.actor ? nameOf(r.actor) : 'System'}</strong> · {s.title} <span style={muted}>{fmtWhen(r.at)}</span></div>
              {s.details.map((d, i) => <div key={i} style={muted}>{d}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
