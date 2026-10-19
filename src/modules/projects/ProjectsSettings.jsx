import React, { useEffect, useState } from 'react';
import { useSetup } from '../../context/SetupContext';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

const CURRENCIES = ['INR', 'USD', 'EUR', 'AED'];

const card = { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' };
const cardTitle = { fontSize: '14px', fontWeight: 600, color: 'var(--text-color)', margin: '0 0 16px 0', paddingBottom: '10px', borderBottom: '1px solid var(--divider-color)' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f9fafb' };
const control = { border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-color)', outline: 'none', backgroundColor: 'var(--card-bg)' };

function Toggle({ isOn, onToggle, disabled }) {
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

function Row({ title, hint, children }) {
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

export default function ProjectsSettings() {
  const { settings, companies, holidayLists, loaded, saveSettings } = useSetup();
  const { profile } = useAuth();
  const editable = can(profile, 'editSettings');
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!loaded || !form) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</div>;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setStatus(''); };
  const save = async () => {
    const { company, currency, holiday_list, default_billing_rate, default_costing_rate, limit_timesheet, auto_close_tasks, task_alerts,
      members_see_all, default_project_role, client_can_comment, max_upload_mb, allowed_file_types, audit_retention_days, invite_only,
      dpr_required, dpr_cutoff_time, approval_warning_days, snag_default_due_days, working_days,
      retention_percent, gst_rate, tds_rate, po_approval_limit, budget_overrun_alert_percent, payment_terms_days, fiscal_year_start_month, ra_bill_prefix } = form;
    const ok = await saveSettings({
      company, currency, holiday_list: holiday_list || null,
      default_billing_rate: Number(default_billing_rate) || 0,
      default_costing_rate: Number(default_costing_rate) || 0,
      limit_timesheet, auto_close_tasks, task_alerts,
      members_see_all, default_project_role, client_can_comment, invite_only,
      max_upload_mb: Math.min(200, Math.max(1, Number(max_upload_mb) || 25)),
      allowed_file_types: String(allowed_file_types || '').toLowerCase().replace(/[^a-z0-9,]/g, ''),
      audit_retention_days: Math.min(3650, Math.max(30, Number(audit_retention_days) || 365)),
      dpr_required, dpr_cutoff_time: String(dpr_cutoff_time || '18:00').slice(0, 5),
      approval_warning_days: Math.min(365, Math.max(1, Number(approval_warning_days) || 30)),
      snag_default_due_days: Math.min(90, Math.max(1, Number(snag_default_due_days) || 7)),
      retention_percent: Math.min(100, Math.max(0, Number(retention_percent) || 0)),
      gst_rate: Math.min(100, Math.max(0, Number(gst_rate) || 0)),
      tds_rate: Math.min(100, Math.max(0, Number(tds_rate) || 0)),
      po_approval_limit: Math.max(0, Number(po_approval_limit) || 0),
      budget_overrun_alert_percent: Math.min(200, Math.max(1, Number(budget_overrun_alert_percent) || 90)),
      payment_terms_days: Math.min(365, Math.max(0, Number(payment_terms_days) || 0)),
      fiscal_year_start_month: Math.min(12, Math.max(1, Number(fiscal_year_start_month) || 4)),
      ra_bill_prefix: String(ra_bill_prefix || 'RA').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'RA',
      working_days: String(working_days || '').split(',').filter(Boolean).join(',') || 'Mon,Tue,Wed,Thu,Fri,Sat',
    });
    setStatus(ok ? 'Settings saved.' : '');
  };

  return (
    <div style={{ padding: '24px 20px', fontFamily: 'Inter, sans-serif', color: 'var(--text-color)', backgroundColor: 'var(--surface-gray-1)', minHeight: '100%' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
        {!editable && (
          <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>Only admins and managers can change these settings.</div>
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

        <div style={card}>
          <h2 style={cardTitle}>Access &amp; Files</h2>
          <Row title="Members see all projects" hint="Off: internal members only see projects they have been added to (staff always see everything)">
            <Toggle isOn={form.members_see_all} disabled={!editable} onToggle={() => set('members_see_all', !form.members_see_all)} />
          </Row>
          <Row title="Default project role" hint="Role pre-selected when someone is added to a project">
            <select value={form.default_project_role} disabled={!editable} onChange={(e) => set('default_project_role', e.target.value)} style={control}>
              {['owner', 'staff', 'contractor', 'client', 'viewer'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </Row>
          <Row title="Clients can comment" hint="Clients may post comments on records shared with them">
            <Toggle isOn={form.client_can_comment} disabled={!editable} onToggle={() => set('client_can_comment', !form.client_can_comment)} />
          </Row>
          <Row title="Maximum upload size (MB)" hint="Per file, 1 to 200">
            <input type="number" min="1" max="200" value={form.max_upload_mb} disabled={!editable} onChange={(e) => set('max_upload_mb', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Allowed file types" hint="Comma separated extensions, e.g. pdf,png,docx">
            <input type="text" value={form.allowed_file_types} disabled={!editable} onChange={(e) => set('allowed_file_types', e.target.value)} style={{ ...control, width: '260px' }} />
          </Row>
          <Row title="Keep activity history (days)" hint="Older audit entries can be purged (30 to 3650)">
            <input type="number" min="30" max="3650" value={form.audit_retention_days} disabled={!editable} onChange={(e) => set('audit_retention_days', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Invitation-only accounts" hint="Policy flag. Public sign-up must also be switched off on the server (DISABLE_SIGNUP)">
            <Toggle isOn={form.invite_only} disabled={!editable} onToggle={() => set('invite_only', !form.invite_only)} />
          </Row>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Site</h2>
          <Row title="Daily reports required" hint="Open projects without a submitted report today are flagged after the cut-off time">
            <Toggle isOn={form.dpr_required} disabled={!editable} onToggle={() => set('dpr_required', !form.dpr_required)} />
          </Row>
          <Row title="Daily report cut-off" hint="Time of day after which a missing report is flagged">
            <input type="time" aria-label="Daily report cut-off" value={String(form.dpr_cutoff_time || '18:00').slice(0, 5)} disabled={!editable} onChange={(e) => set('dpr_cutoff_time', e.target.value)} style={control} />
          </Row>
          <Row title="Approval warning (days)" hint="Warn this many days before an approval expires (1 to 365)">
            <input type="number" min="1" max="365" value={form.approval_warning_days} disabled={!editable} onChange={(e) => set('approval_warning_days', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Snag due after (days)" hint="Default due date for new snags (1 to 90)">
            <input type="number" min="1" max="90" value={form.snag_default_due_days} disabled={!editable} onChange={(e) => set('snag_default_due_days', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Working days" hint="Days the site works">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
                const on = String(form.working_days || '').split(',').includes(d);
                return (
                  <label key={d} style={{ fontSize: '12px', display: 'flex', gap: '3px', alignItems: 'center', color: 'var(--text-light)' }}>
                    <input type="checkbox" checked={on} disabled={!editable} onChange={() => {
                      const cur = String(form.working_days || '').split(',').filter(Boolean);
                      const next = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((x) => (x === d ? !on : cur.includes(x)));
                      set('working_days', next.join(','));
                    }} /> {d}
                  </label>
                );
              })}
            </div>
          </Row>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Finance</h2>
          <Row title="Retention (%)" hint="Held back from each RA bill (default for new work orders)">
            <input type="number" min="0" max="100" aria-label="Retention (%)" value={form.retention_percent} disabled={!editable} onChange={(e) => set('retention_percent', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="GST rate (%)" hint="Added to the gross amount of each RA bill">
            <input type="number" min="0" max="100" aria-label="GST rate (%)" value={form.gst_rate} disabled={!editable} onChange={(e) => set('gst_rate', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="TDS rate (%)" hint="Deducted from the gross amount of each RA bill">
            <input type="number" min="0" max="100" aria-label="TDS rate (%)" value={form.tds_rate} disabled={!editable} onChange={(e) => set('tds_rate', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Approval limit (₹)" hint="Work orders and bills above this value need an admin or manager to approve">
            <input type="number" min="0" max="100000000000" aria-label="Approval limit (₹)" value={form.po_approval_limit} disabled={!editable} onChange={(e) => set('po_approval_limit', e.target.value)} style={{ ...control, width: '160px', textAlign: 'right' }} />
          </Row>
          <Row title="Budget warning (%)" hint="Flag a cost head when committed value reaches this share of its budget">
            <input type="number" min="1" max="200" aria-label="Budget warning (%)" value={form.budget_overrun_alert_percent} disabled={!editable} onChange={(e) => set('budget_overrun_alert_percent', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Payment terms (days)" hint="Default due date of a bill, counted from the end of its period">
            <input type="number" min="0" max="365" aria-label="Payment terms (days)" value={form.payment_terms_days} disabled={!editable} onChange={(e) => set('payment_terms_days', e.target.value)} style={{ ...control, width: '100px', textAlign: 'right' }} />
          </Row>
          <Row title="Financial year starts in" hint="Used for the finance dashboard">
            <select aria-label="Financial year starts in" value={form.fiscal_year_start_month} disabled={!editable} onChange={(e) => set('fiscal_year_start_month', e.target.value)} style={control}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Row>
          <Row title="RA bill prefix" hint="Letters only, e.g. RA gives RA-0001 (applies to new bills)">
            <input type="text" aria-label="RA bill prefix" maxLength={6} value={form.ra_bill_prefix} disabled={!editable} onChange={(e) => set('ra_bill_prefix', e.target.value)} style={{ ...control, width: '100px' }} />
          </Row>
        </div>

        {editable && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {status && <span style={{ fontSize: '12px', color: '#16a34a' }}>{status}</span>}
            <button onClick={save} style={{ background: 'var(--gray-900)', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
