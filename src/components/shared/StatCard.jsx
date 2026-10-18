/**
 * StatCard.jsx
 * Single metric stat card for the CRM dashboard top row.
 */
import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function StatCard({ title, value }) {
  const [moreHovered, setMoreHovered] = useState(false);

  return (
    <div
      style={{
        backgroundColor: '#1c1c1c',
        border: '1px solid #232323',
        borderRadius: '8px',
        padding: '16px 20px',
        position: 'relative',
      }}
    >
      {/* Top row: title + more icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '15px', color: '#afafaf', fontWeight: 500, lineHeight: 1.4 }}>
          {title}
        </span>
        <button
          onMouseEnter={() => setMoreHovered(true)}
          onMouseLeave={() => setMoreHovered(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            color: moreHovered ? '#7c7c7c' : '#383838',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'color 0.1s',
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '32px',
          fontWeight: 600,
          color: '#f8f8f8',
          marginTop: '12px',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
