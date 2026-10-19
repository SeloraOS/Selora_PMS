import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const OPTIONS = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

/** Light / Dark / System switch (dropdown). The icon shows the theme currently in effect. */
export default function ThemeToggle({ align = 'right' }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const Current = resolved === 'dark' ? Moon : Sun;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Theme: ${preference}`}
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--control-bg)', color: 'var(--text-light)', cursor: 'pointer' }}
      >
        <Current size={14} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 200, minWidth: '150px', background: 'var(--control-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: '4px' }}>
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={preference === id}
              onClick={() => { setPreference(id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', border: 'none', borderRadius: '6px', background: preference === id ? 'var(--surface-gray-2)' : 'transparent', color: 'var(--text-color)', fontSize: '13px', fontWeight: preference === id ? 600 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <Icon size={14} /> {label} {preference === id && <Check size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
