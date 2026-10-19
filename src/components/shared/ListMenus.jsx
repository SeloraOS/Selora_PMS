import React from 'react';
import { ArrowUpDown, Columns, ChevronDown, Check, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { downloadCsvFile, downloadXlsFile } from '../../lib/exportRows';
import { useDropdown } from '../../lib/useDropdown';

const button = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #4b5563)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit' };
const menu = { position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, minWidth: '230px', background: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', padding: '6px', color: 'var(--text-color, #1a1a1a)' };
const heading = { padding: '4px 10px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #6b7280)' };
const row = (active) => ({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', border: 'none', borderRadius: '6px', background: active ? 'var(--surface-gray-2, #f3f4f6)' : 'transparent', color: 'inherit', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontWeight: active ? 600 : 400 });

/** "Sort" button: pick the column and the direction. `columns` are the sortable ones. */
export function SortMenu({ columns, sort, onChange }) {
  const { open, setOpen, ref } = useDropdown();
  const active = columns.find((c) => c.key === sort.key);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={button}>
        <ArrowUpDown size={14} /> Sort{active ? <span style={{ color: 'var(--text-color, #1a1a1a)', fontWeight: 600 }}>· {active.label} {sort.order === 'asc' ? '↑' : '↓'}</span> : null}
        <ChevronDown size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
      </button>
      {open && (
        <div role="menu" aria-label="Sort" style={menu}>
          <div style={heading}>Sort by</div>
          {columns.map((c) => (
            <button key={c.key} type="button" role="menuitemradio" aria-checked={c.key === sort.key} style={row(c.key === sort.key)} onClick={() => onChange({ key: c.key, order: c.key === sort.key ? sort.order : 'asc' })}>
              {c.label} {c.key === sort.key && <Check size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
          <div style={{ display: 'flex', gap: '6px', padding: '8px 4px 2px', marginTop: '6px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
            {[['asc', 'Ascending', ArrowUp], ['desc', 'Descending', ArrowDown]].map(([order, label, Icon]) => (
              <button key={order} type="button" aria-pressed={sort.order === order} onClick={() => onChange({ key: sort.key, order })} style={{ ...row(sort.order === order), justifyContent: 'center', border: '1px solid var(--border-color, #e5e7eb)' }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Columns" button: a checklist of the columns to display. Required columns stay on. */
export function ColumnsMenu({ columns, visibleSet, onToggle, onReset, disabled, disabledHint }) {
  const { open, setOpen, ref } = useDropdown();
  const shown = columns.filter((c) => visibleSet.has(c.key)).length;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} title={disabled ? disabledHint : undefined} onClick={() => setOpen(!open)} style={{ ...button, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
        <Columns size={14} /> Columns <span style={{ color: 'var(--text-muted, #6b7280)' }}>{shown}/{columns.length}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
      </button>
      {open && !disabled && (
        <div role="menu" aria-label="Columns" style={menu}>
          <div style={heading}>Show columns</div>
          {columns.map((c) => (
            <label key={c.key} style={{ ...row(false), cursor: c.required ? 'default' : 'pointer', opacity: c.required ? 0.7 : 1 }}>
              <input type="checkbox" checked={visibleSet.has(c.key)} disabled={c.required} onChange={() => onToggle(c.key)} style={{ accentColor: 'var(--gray-900, #111827)', cursor: 'inherit' }} />
              {c.label}
            </label>
          ))}
          <div style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', marginTop: '6px', padding: '6px 4px 2px' }}>
            <button type="button" onClick={onReset} style={{ ...row(false), color: 'var(--text-muted, #6b7280)' }}>Reset to default</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Export" button: the rows currently shown, as CSV or Excel. */
export function ExportMenu({ name, columns, rows, disabled }) {
  const { open, setOpen, ref } = useDropdown();
  const run = (fn) => { fn(name, columns, rows); setOpen(false); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)} style={{ ...button, opacity: disabled ? 0.6 : 1 }}>
        <Download size={14} /> Export <ChevronDown size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
      </button>
      {open && (
        <div role="menu" aria-label="Export" style={{ ...menu, minWidth: '170px' }}>
          <div style={heading}>{rows.length} row{rows.length === 1 ? '' : 's'}</div>
          <button type="button" role="menuitem" style={row(false)} onClick={() => run(downloadCsvFile)}>CSV (.csv)</button>
          <button type="button" role="menuitem" style={row(false)} onClick={() => run(downloadXlsFile)}>Excel (.xls)</button>
        </div>
      )}
    </div>
  );
}
