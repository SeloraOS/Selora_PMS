import React from 'react';

export const card = { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' };
export const cardTitle = { fontSize: '14px', fontWeight: 600, color: 'var(--text-color)', margin: '0 0 16px 0', paddingBottom: '10px', borderBottom: '1px solid var(--divider-color)' };
export const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f9fafb' };
export const control = { border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-color)', outline: 'none', backgroundColor: 'var(--card-bg)' };

export function Toggle({ isOn, onToggle, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      role="switch"
      aria-checked={isOn}
      style={{ width: '40px', height: '22px', borderRadius: '11px', background: isOn ? '#3b82f6' : 'var(--surface-gray-4)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, display: 'flex', alignItems: 'center', padding: '0 2px', transition: 'background 0.2s', boxSizing: 'border-box' }}
    >
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--card-bg)', transform: `translateX(${isOn ? '18px' : '0'})`, transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
    </div>
  );
}

export function Row({ title, hint, children }) {
  return (
    <div style={row}>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{title}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</div>
      </div>
      {children}
    </div>
  );
}

