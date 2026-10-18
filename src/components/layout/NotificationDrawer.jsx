import React from 'react';
import { Link } from 'react-router-dom';
import { X, Bell, AlertTriangle, Clock } from 'lucide-react';
import { useAlerts } from '../../lib/useAlerts';

const when = (days, overdue) => {
  if (overdue) return days === 1 ? '1 day overdue' : `${days} days overdue`;
  return days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
};

function Item({ task, icon: Icon, color, text, onClose }) {
  return (
    <Link
      to={`/projects/task/${task.id}`}
      onClick={onClose}
      style={{ padding: '14px 16px', background: 'var(--surface-gray-1)', borderRadius: '8px', border: '1px solid var(--border-color)', textDecoration: 'none', display: 'flex', gap: '12px' }}
    >
      <Icon size={16} color={color} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-color)', fontWeight: 600 }}>{task.subject}</p>
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)' }}>{task.id} · {task.project || 'No project'} · {task.priority}</p>
        <span style={{ fontSize: '12px', color, fontWeight: 600 }}>{text}</span>
      </div>
    </Link>
  );
}

const Section = ({ title, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
    {children}
  </div>
);

export default function NotificationDrawer({ isOpen, onClose }) {
  const { enabled, overdue, dueSoon, count } = useAlerts();
  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}
      />

      <div
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100vw', background: 'var(--bg-color)', borderLeft: '1px solid var(--border-color)', zIndex: 101, boxShadow: '-4px 0 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--heading-color)" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--heading-color)' }}>Notifications</h2>
            {count > 0 && <span style={{ background: '#e03636', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' }}>{count} overdue</span>}
          </div>
          <button onClick={onClose} aria-label="Close notifications" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px' }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!enabled ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
              Task alerts are turned off in <Link to="/projects/settings" onClick={onClose}>Project Settings</Link>.
            </p>
          ) : !overdue.length && !dueSoon.length ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>You're all caught up. No overdue or upcoming tasks.</p>
          ) : (
            <>
              {overdue.length > 0 && (
                <Section title={`Overdue (${overdue.length})`}>
                  {overdue.map((t) => <Item key={t.id} task={t} icon={AlertTriangle} color="#ef4444" text={when(t.delayDays, true)} onClose={onClose} />)}
                </Section>
              )}
              {dueSoon.length > 0 && (
                <Section title={`Due soon (${dueSoon.length})`}>
                  {dueSoon.map((t) => <Item key={t.id} task={t} icon={Clock} color="#f59e0b" text={when(t.dueInDays, false)} onClose={onClose} />)}
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
