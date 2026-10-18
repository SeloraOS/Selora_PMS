import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar';
import Topbar from './Topbar';
import { TopbarProvider } from '../../context/TopbarContext';
import NotificationDrawer from './NotificationDrawer';

export default function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const navigate = useNavigate();

  // Ctrl/Cmd+K opens search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/projects/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
  return (
    <TopbarProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        <div
          style={{
            marginLeft: isCollapsed ? '48px' : '220px',
            transition: 'margin-left 0.2s ease',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
            background: '#0f0f0f'
          }}
        >
          <Topbar />

          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </main>
        </div>
        
        <NotificationDrawer 
          isOpen={isNotificationsOpen} 
          onClose={() => setIsNotificationsOpen(false)} 
          />
      </div>
    </TopbarProvider>
  );
}
