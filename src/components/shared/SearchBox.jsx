import React from 'react';
import { Search } from 'lucide-react';

/** Search field used in list toolbars. */
export default function SearchBox({ value, onChange, placeholder = 'Search…', width = 220 }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Search size={13} style={{ position: 'absolute', left: 9, color: 'var(--text-muted, #9ca3af)', pointerEvents: 'none' }} />
      <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', padding: '6px 10px 6px 28px', fontSize: '13px', color: 'var(--text-color, #1a1a1a)', width, boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );
}
