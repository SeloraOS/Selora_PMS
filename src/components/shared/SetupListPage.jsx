/**
 * Shared list + create/edit modal used by the Projects setup pages
 * (Activity Type, Activity Cost, Project Type, Project Template, Project Update).
 *
 * fields: [{ name, label, type: 'text'|'number'|'date'|'textarea'|'select'|'rowlist' (+ columns),
 *            options?: [{value,label}], required?, default? }]
 * Row values are database rows; `toForm(row)` / `fromForm(values)` adapt them when needed.
 */
import React, { useMemo, useState } from 'react';
import { Plus, X, RefreshCw, Filter, FileText, Trash2 } from 'lucide-react';

const buttonStyle = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #4b5563)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' };
const inputStyle = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-color, #1a1a1a)', width: '100%', boxSizing: 'border-box' };
const labelStyle = { fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4b5563)', display: 'block', marginBottom: '6px' };
const thStyle = { padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };

/** Editable list of sub-rows. `columns`: [{ key, placeholder, type?, width?, default? }] */
function RowListField({ value, onChange, disabled, columns }) {
  const rows = value || [];
  const blank = () => Object.fromEntries(columns.map((c) => [c.key, c.default ?? '']));
  const set = (i, key, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const template = columns.map((c) => c.width || '1fr').join(' ') + ' 24px';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: template, gap: '6px', alignItems: 'center' }}>
          {columns.map((c) => (
            <input
              key={c.key}
              style={inputStyle}
              type={c.type || 'text'}
              min={c.type === 'number' ? 0 : undefined}
              placeholder={c.placeholder}
              title={c.placeholder}
              value={r[c.key] ?? ''}
              disabled={disabled}
              onChange={(e) => set(i, c.key, e.target.value)}
            />
          ))}
          {!disabled && (
            <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #6b7280)' }}><X size={14} /></button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={() => onChange([...rows, blank()])} style={{ ...buttonStyle, alignSelf: 'flex-start', padding: '4px 10px' }}>
          <Plus size={12} /> Add row
        </button>
      )}
    </div>
  );
}

export default function SetupListPage({
  title, addLabel, rows, columns, searchText, filters = [], fields,
  canEdit, canCreate = canEdit, canDelete = () => canEdit, onSave, onDelete, toForm, fromForm, loading, extraActions,
}) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null); // null | { row: object|null, values }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visible = useMemo(() => rows.filter((r) =>
    (!search || searchText(r).toLowerCase().includes(search.toLowerCase())) &&
    filters.every((f) => !filterValues[f.key] || f.get(r) === filterValues[f.key])
  ), [rows, search, filterValues, filters, searchText]);

  const blank = () => Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'rowlist' ? [] : '')]));
  const openNew = () => { setError(''); setEditing({ row: null, values: blank() }); };
  const openEdit = (row) => { setError(''); setEditing({ row, values: { ...blank(), ...(toForm ? toForm(row) : row) } }); };
  const close = () => setEditing(null);
  const setValue = (name, v) => setEditing((e) => ({ ...e, values: { ...e.values, [name]: v } }));

  const submit = async () => {
    const missing = fields.find((f) => f.required && !String(editing.values[f.name] ?? '').trim());
    if (missing) return setError(`${missing.label} is required`);
    setBusy(true);
    const ok = await onSave(fromForm ? fromForm(editing.values) : editing.values, editing.row);
    setBusy(false);
    if (ok) close();
  };

  const remove = async () => {
    if (!window.confirm(`Delete this ${title.toLowerCase()}? This cannot be undone.`)) return;
    setBusy(true);
    const ok = await onDelete(editing.row);
    setBusy(false);
    if (ok) close();
  };

  const readOnly = editing && (editing.row ? !canEdit : !canEdit);

  return (
    <div style={{ fontFamily: 'var(--font-family, Inter, sans-serif)', color: 'var(--text-color, #1a1a1a)', backgroundColor: 'var(--bg-color, #ffffff)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color, #e5e7eb)', gap: '8px', flexWrap: 'wrap' }}>
        <input placeholder={`Search ${title.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, width: '260px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => window.location.reload()} style={{ ...buttonStyle, padding: '6px 8px' }} title="Reload"><RefreshCw size={14} /></button>
          {filters.length > 0 && (
            <button onClick={() => setShowFilters(!showFilters)} style={{ ...buttonStyle, backgroundColor: showFilters ? 'var(--surface-gray-2, #f3f4f6)' : 'var(--control-bg, #ffffff)' }}>
              <Filter size={14} /> Filter
            </button>
          )}
          {extraActions}
          {canCreate && (
            <button onClick={openNew} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> {addLabel || `Add ${title}`}
            </button>
          )}
        </div>
      </div>

      {showFilters && filters.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '12px 24px' }}>
          {filters.map((f) => (
            <select key={f.key} value={filterValues[f.key] || ''} onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))} style={{ ...inputStyle, width: '200px' }}>
              <option value="">{f.label} (All)</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <button onClick={() => setFilterValues({})} style={buttonStyle}>Clear</button>
        </div>
      )}

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #6b7280)', fontSize: '14px' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '40px' }}>
            <FileText size={48} strokeWidth={1} style={{ color: 'var(--gray-400, #9ca3af)', marginBottom: '16px' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-muted, #6b7280)', marginBottom: '16px' }}>No {title} found.</p>
            {canCreate && <button onClick={openNew} style={buttonStyle}>Create a new {title}</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
                  {columns.map((c) => <th key={c.key} style={thStyle}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} onClick={() => openEdit(row)} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1, #f9fafb)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    {columns.map((c, i) => (
                      <td key={c.key} style={{ padding: '12px 16px', color: i === 0 ? 'var(--text-color, #1a1a1a)' : 'var(--text-muted, #4b5563)', fontWeight: i === 0 ? 500 : 400 }}>
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--control-bg, #ffffff)', borderRadius: '10px', width: '460px', maxWidth: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{editing.row ? (readOnly ? title : `Edit ${title}`) : `New ${title}`}</h2>
              <button onClick={close} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #6b7280)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {fields.map((f) => (
                <div key={f.name}>
                  <label style={labelStyle}>{f.label}{f.required ? ' *' : ''}</label>
                  {f.type === 'select' ? (
                    <select style={inputStyle} value={editing.values[f.name] ?? ''} disabled={readOnly} onChange={(e) => setValue(f.name, e.target.value)}>
                      <option value="">{f.placeholder || 'Select…'}</option>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={editing.values[f.name] ?? ''} disabled={readOnly} onChange={(e) => setValue(f.name, e.target.value)} />
                  ) : f.type === 'rowlist' ? (
                    <RowListField columns={f.columns} value={editing.values[f.name]} disabled={readOnly} onChange={(v) => setValue(f.name, v)} />
                  ) : (
                    <input style={inputStyle} type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} value={editing.values[f.name] ?? ''} disabled={readOnly} onChange={(e) => setValue(f.name, e.target.value)} />
                  )}
                </div>
              ))}
              {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color, #e5e7eb)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {editing.row && canDelete(editing.row) && (
                <button onClick={remove} disabled={busy} style={{ ...buttonStyle, color: '#ef4444', borderColor: '#ef4444' }}><Trash2 size={13} /> Delete</button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={close} style={buttonStyle}>{readOnly ? 'Close' : 'Cancel'}</button>
              {!readOnly && (
                <button onClick={submit} disabled={busy} style={{ backgroundColor: 'var(--gray-900, #111827)', border: 'none', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'Saving…' : editing.row ? 'Save' : 'Create'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
