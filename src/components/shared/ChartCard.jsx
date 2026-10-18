/**
 * ChartCard.jsx
 * Reusable wrapper card for all CRM chart sections.
 * Props:
 *   title        — card heading
 *   lastSynced   — subtitle string (e.g. "Last synced 8 minutes ago")
 *   showPeriod   — show period dropdown (bool)
 *   periodValue  — label for period dropdown
 *   showInterval — show interval dropdown (bool)
 *   intervalValue — label for interval dropdown
 *   children     — chart or empty state content
 */
import React, { useState } from 'react';
import { Filter, MoreHorizontal, ChevronDown } from 'lucide-react';

function IconBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#2b2b2b' : '#232323',
        border: '1px solid #343434',
        borderRadius: '6px',
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: '#7c7c7c',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function DropdownBtn({ label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#2b2b2b' : '#232323',
        border: '1px solid #343434',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '14px',
        color: '#afafaf',
        fontFamily: 'inherit',
        transition: 'background 0.1s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <ChevronDown size={12} style={{ color: '#7c7c7c' }} />
    </button>
  );
}

export default function ChartCard({
  title,
  lastSynced = 'Last synced 8 minutes ago',
  showPeriod = false,
  periodValue = 'Last Quarter',
  showInterval = false,
  intervalValue = 'Weekly',
  children,
}) {
  return (
    <div
      style={{
        backgroundColor: '#1c1c1c',
        border: '1px solid #232323',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '16px',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: title + subtitle */}
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8f8f8' }}>
            {title}
          </div>
          <div style={{ fontSize: '13px', color: '#7c7c7c', marginTop: '2px' }}>
            {lastSynced}
          </div>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <IconBtn><Filter size={13} /></IconBtn>
          {showPeriod && <DropdownBtn label={periodValue} />}
          {showInterval && <DropdownBtn label={intervalValue} />}
          <IconBtn><MoreHorizontal size={14} /></IconBtn>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
