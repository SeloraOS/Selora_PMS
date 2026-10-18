import React, { useEffect, useState } from 'react';
import { useSetup } from '../../context/SetupContext';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

const CURRENCIES = ['INR', 'USD', 'EUR', 'AED'];

const card = { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' };
const cardTitle = { fontSize: '14px', fontWeight: 600, color: '#1a1a2e', margin: '0 0 16px 0', paddingBottom: '10px', borderBottom: '1px solid #f3f4f6' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f9fafb' };
const control = { border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#ffffff' };

function Toggle({ isOn, onToggle, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      role="switch"
      aria-checked={isOn}
      style={{ width: '40px', height: '22px', borderRadius: '11px', background: isOn ? '#3b82f6' : '#e5e7eb', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, display: 'flex', alignItems: 'center', padding: '0 2px', transition: 'background 0.2s', boxSizing: 'border-box' }}
    >
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff', transform: `translateX(${isOn ? '18px' : '0'})`, transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
    </div>
  );
}

function Row({ title, hint, children }) {
  return (
    <div style={row}>
      <div>
        <div style={{ fontSize: '13px', color: '#374151' }}>{title}</div>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{hint}</div>
      </div>
      {children}
    </div>
  );
}

export default function ProjectsSettings() {
  const { settings, companies, holidayLists, loaded, saveSettings } = useSetup();
  const { profile } = useAuth();
  const editable = can(profile, 'editSettings');
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!loaded || !form) return <div style={{ padding: '40px', color: '#6b7280', fontSize: '14px' }}>Loading…</div>;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setStatus(''); };
  const save = async () => {
    const { company, currency, holiday_list, default_billing_rate, default_costing_rate, limit_timesheet, auto_close_tasks, task_alerts } = form;
    const ok = await saveSettings({
      company, currency, holiday_list: holiday_list || null,
      default_billing_rate: Number(default_billing_rate) || 0,
      default_costing_rate: Number(default_costing_rate) || 0,
      limit_timesheet, auto_close_tasks, task_alerts,
    });
    setStatus(ok ? 'Settings saved.' : '');
  };

  return (
    <div style={{ padding: '24px 20px', fontFamily: 'Inter, sans-serif', color: '#1a1a2e', backgroundColor: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
        {!editable && (
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6b7280' }}>Only admins and managers can change these settings.</div>
        )}

        <div style={card}>
          <h2 style={cardTitle}>General</h2>
          <Row title="Company" hint="Default company on new projects and tasks">
            <select value={form.company} disabled={!editable} onChange={(e) => set('company', e.target.value)} style={control}>
              {[...new Set([form.company, ...companies.map((c) => c.name)])].map((n) => <option key={n}>{n}</option>)}
            </select>
          </Row>
          <Row title="Holiday List" hint="Default holiday list for projects">
            <select value={form.holiday_list || ''} disabled={!editable} onChange={(e) => set('holiday_list', e.target.value)} style={control}>
              <option value="">None</option>
              {holidayLists.map((h) => <option key={h.id}>{h.name}</option>)}
            </select>
          </Row>
          <Row title="Limit Timesheet Creation" hint="Every timesheet row needs a task, and the task must be active (Open, Working, Pending, Overdue)">
            <Toggle isOn={form.limit_timesheet} disabled={!editable} onToggle={() => set('limit_timesheet', !form.limit_timesheet)} />
          </Row>
          <Row title="Auto Close Tasks" hint="Complete a parent task when all its subtasks are done, and the project when all tasks are done">
            <Toggle isOn={form.auto_close_tasks} disabled={!editable} onToggle={() => set('auto_close_tasks', !form.auto_close_tasks)} />
          </Row>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Billing</h2>
          <Row title="Default Billing Rate" hint="Used when an activity has no rate (per hour)">
            <input type="number" min="0" value={form.default_billing_rate} disabled={!editable} onChange={(e) => set('default_billing_rate', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Default Costing Rate" hint="Used when an activity has no rate (per hour)">
            <input type="number" min="0" value={form.default_costing_rate} disabled={!editable} onChange={(e) => set('default_costing_rate', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Currency" hint="System currency">
            <select value={form.currency} disabled={!editable} onChange={(e) => set('currency', e.target.value)} style={control}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Row>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Notifications</h2>
          <Row title="Task Overdue Alerts" hint="Show overdue and due-soon tasks in the notification drawer, sidebar badge and dashboard">
            <Toggle isOn={form.task_alerts} disabled={!editable} onToggle={() => set('task_alerts', !form.task_alerts)} />
          </Row>
        </div>

        {editable && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {status && <span style={{ fontSize: '12px', color: '#16a34a' }}>{status}</span>}
            <button onClick={save} style={{ background: '#111111', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
