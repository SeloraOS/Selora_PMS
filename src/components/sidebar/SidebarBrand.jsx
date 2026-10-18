import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Folder } from 'lucide-react';

export default function SidebarBrand({ isCollapsed, onToggleCollapse }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1c1c1c',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px',
        flexShrink: 0,
        height: '52px',
        boxSizing: 'border-box',
      }}
    >
      <Link
        to="/projects"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textDecoration: 'none',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: '#0289f7',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Folder size={15} color="#ffffff" />
        </div>

        {!isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8f8f8', whiteSpace: 'nowrap' }}>
                Selora PMS
              </span>
              <ChevronDown size={12} color="#7c7c7c" style={{ marginTop: '2px' }} />
            </div>
            <span style={{ fontSize: '11px', color: '#7c7c7c', whiteSpace: 'nowrap', marginTop: '-2px' }}>
              Project Management
            </span>
          </div>
        )}
      </Link>

      {!isCollapsed && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleCollapse();
          }}
          aria-label="Collapse sidebar"
          style={{
            marginLeft: 'auto',
            color: '#424242',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.1s',
            flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#7c7c7c'}
          onMouseLeave={e => e.currentTarget.style.color = '#424242'}
        >
          <ChevronLeft size={14} />
        </button>
      )}
    </div>
  );
}

