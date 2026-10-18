import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SidebarBrand from './SidebarBrand';
import SidebarNavItem from './SidebarNavItem';
import SidebarFooter from './SidebarFooter';
import { PROJECTS_SIDEBAR_CONFIG } from './sidebar.config';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { useAlerts } from '../../lib/useAlerts';

function SidebarSectionLabel({ label, isOpen, onToggle, isCollapsed }) {
  if (isCollapsed) return null;

  return (
    <div
      onClick={onToggle}
      style={{
        padding: '10px 16px 4px',
        fontSize: '11px',
        fontWeight: 500,
        color: '#383838',
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      {label}
    </div>
  );
}

function SidebarGroup({ label, items, isCollapsed }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <SidebarSectionLabel
        label={label}
        isOpen={open}
        onToggle={() => setOpen(p => !p)}
        isCollapsed={isCollapsed}
      />
      <div
        style={{
          maxHeight: open ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        {items.map(item => (
          <SidebarNavItem key={item.key} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>
    </>
  );
}

export default function Sidebar({ isCollapsed, setIsCollapsed, onOpenNotifications }) {
  const config = PROJECTS_SIDEBAR_CONFIG;
  const { profile } = useAuth();
  const { count: overdueCount } = useAlerts();

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: isCollapsed ? '48px' : '220px',
        minWidth: isCollapsed ? '48px' : '220px',
        height: '100vh',
        background: '#0f0f0f',
        borderRight: '1px solid #1c1c1c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'width 0.2s ease, min-width 0.2s ease',
        zIndex: 40,
      }}
    >
      <SidebarBrand
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(prev => !prev)}
      />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0' }}>
        {config.main.filter(item => item.key === 'notifications').map(item => (
          <SidebarNavItem
            key={item.key}
            item={{ ...item, badge: overdueCount || undefined }}
            isCollapsed={isCollapsed}
            onClick={onOpenNotifications}
          />
        ))}

        <SidebarGroup label="ERP" items={config.erp} isCollapsed={isCollapsed} />
        <SidebarGroup label="Setup" items={config.setup} isCollapsed={isCollapsed} />
        <SidebarGroup label="Reports" items={config.reports} isCollapsed={isCollapsed} />

        {[...config.settings, ...config.footer]
          .filter(item => !item.adminOnly || can(profile, 'manageUsers'))
          .map(item => (
          <SidebarNavItem key={item.key} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>

      <SidebarFooter isCollapsed={isCollapsed} />
    </aside>
  );
}
