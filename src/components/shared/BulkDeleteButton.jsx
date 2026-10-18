import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

/**
 * Deletes the selected records the user is allowed to delete (managers: all, others: their own).
 * `rows` are the selected UI records; `onDelete(id)` must resolve null on failure (see ProjectsContext).
 */
export default function BulkDeleteButton({ rows, label, onDelete, onDone }) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!rows.length) return null;

  const allowed = rows.filter((r) => can(profile, 'delete', r));
  const skipped = rows.length - allowed.length;

  const click = async () => {
    if (!allowed.length) return window.alert(`You can only delete ${label}s you created.`);
    const note = skipped ? `\n${skipped} selected ${label}(s) will be skipped (not yours).` : '';
    if (!window.confirm(`Delete ${allowed.length} ${label}${allowed.length > 1 ? 's' : ''}? This cannot be undone.${note}`)) return;
    setBusy(true);
    for (const r of allowed) {
      if ((await onDelete(r.id)) === null) break; // stop at the first failure (an alert was shown)
    }
    setBusy(false);
    onDone();
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
    >
      <Trash2 size={13} /> Delete ({rows.length})
    </button>
  );
}
