import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

/** Confirm-then-delete button, shown only to users the delete policy allows (managers, or the record's creator). */
export default function DeleteButton({ record, label, onDelete, style }) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!record || !can(profile, 'delete', record)) return null;

  const click = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      title={`Delete ${label}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, ...style }}
    >
      <Trash2 size={13} /> Delete
    </button>
  );
}
