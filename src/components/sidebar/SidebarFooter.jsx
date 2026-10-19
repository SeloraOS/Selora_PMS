import React, { useState } from 'react';
import { Search, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function SidebarFooter({ isCollapsed }) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const [profileHovered, setProfileHovered] = useState(false);
  const [searchHovered, setSearchHovered] = useState(false);

  return (
    <div
      style={{
        borderTop: '1px solid #1c1c1c',
        padding: '8px 6px',
        flexShrink: 0,
      }}
    >
      <div
        onMouseEnter={() => setProfileHovered(true)}
        onMouseLeave={() => setProfileHovered(false)}
        style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          padding: isCollapsed ? '0' : '0 10px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '8px',
          borderRadius: '6px',
          cursor: 'pointer',
          background: profileHovered ? '#171717' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#a352cc',
            fontSize: '10px',
            fontWeight: 600,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        {!isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#f8f8f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {displayName}
            </span>
            <span style={{ fontSize: '10px', color: '#7c7c7c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
              {user?.email}
            </span>
          </div>
        )}
        {!isCollapsed && (
          <LogOut
            size={14}
            color="#7c7c7c"
            role="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
            style={{ flexShrink: 0 }}
          />
        )}
      </div>


      {!isCollapsed && (
        <div
          onClick={() => navigate('/projects/search')}
          onMouseEnter={() => setSearchHovered(true)}
          onMouseLeave={() => setSearchHovered(false)}
          style={{
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginTop: '2px',
            background: searchHovered ? '#171717' : 'transparent',
            transition: 'background 0.1s',
          }}
        >
          <Search size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-faint)', flex: 1, whiteSpace: 'nowrap' }}>
            Search
          </span>
          <div
            style={{
              background: '#1c1c1c',
              border: '1px solid #2b2b2b',
              borderRadius: '4px',
              fontSize: '10px',
              padding: '1px 5px',
              color: 'var(--text-faint)',
              flexShrink: 0,
            }}
          >
            Ctrl K
          </div>
        </div>
      )}
    </div>
  );
}
