import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { card, cardTitle, control, Toggle, Row } from './settingsParts';

const CHANNELS = [['email', 'E-mail'], ['whatsapp', 'WhatsApp']];
const ROLES = [['admin', 'Admins'], ['manager', 'Managers'], ['member', 'Members']];
const list = (v) => String(v || '').split(',').filter(Boolean);
const MAX_LOGO = 300 * 1024;
const small = { fontSize: '12px', color: 'var(--text-muted)' };
const pill = (ok) => ({ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: ok ? 'var(--st-green-bg)' : 'var(--surface-gray-2)', color: ok ? 'var(--st-green-fg)' : 'var(--text-light)' });
const btn = { ...control, cursor: 'pointer' };

function Check({ checked, onChange, disabled, children }) {
  return <label style={{ fontSize: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: 'var(--text-light)' }}><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /> {children}</label>;
}

/** Notifications, branding and calendar-feed settings. Secrets live on the server (see README); this page only shows whether they are set. */
export default function NotificationPanel({ form, set, editable }) {
  const [server, setServer] = useState(null); // { smtp, whatsapp } | { error }
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [copied, setCopied] = useState(false);

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('notify', { body });
    if (error) throw new Error(data?.error || error.message);
    return data;
  }, []);
  const loadLog = useCallback(async () => {
    const { data } = await supabase.from('notification_log').select('*').order('created_at', { ascending: false }).limit(8);
    setLog(data || []);
  }, []);
  useEffect(() => {
    if (!editable) return;
    invoke({ action: 'status' }).then(setServer).catch((e) => setServer({ error: e.message }));
    loadLog();
  }, [editable, invoke, loadLog]);

  const channels = list(form.notify_channels);
  const toggleList = (key, value, current, always = []) => {
    const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    set(key, [...new Set([...always, ...next])].join(','));
  };
  const run = async (dry) => {
    if (!dry && !window.confirm('Send the digest now to all selected recipients?')) return;
    setBusy(dry ? 'preview' : 'send'); setResult(null);
    try { setResult(await invoke({ action: 'run', dry_run: dry })); } catch (e) { setResult({ error: e.message }); }
    setBusy(''); loadLog();
  };

  const onLogo = (file) => {
    setLogoError('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setLogoError('Use a PNG, JPG or WebP image.');
    if (file.size > MAX_LOGO) return setLogoError('The logo must be smaller than 300 KB.');
    const reader = new FileReader();
    reader.onload = () => set('company_logo', reader.result);
    reader.readAsDataURL(file);
  };
  const feedUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${form.ics_token}`;
  const rotate = async () => {
    if (!window.confirm('Create a new link? Calendars subscribed to the old link will stop updating.')) return;
    const { data, error } = await supabase.rpc('rotate_ics_token');
    if (error) return window.alert(error.message);
    set('ics_token', data);
  };

  return (
    <>
      <div style={card}>
        <h2 style={cardTitle}>Notifications</h2>
        <Row title="Channels" hint="In-app alerts are always on. E-mail and WhatsApp need server credentials and stay off until configured">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Check checked disabled>In-app</Check>
            {CHANNELS.map(([k, l]) => <Check key={k} checked={channels.includes(k)} disabled={!editable} onChange={() => toggleList('notify_channels', k, channels, ['inapp'])}>{l}</Check>)}
          </div>
        </Row>
        <Row title="E-mail recipients" hint="Roles that receive the daily digest">
          <div style={{ display: 'flex', gap: '12px' }}>
            {ROLES.map(([k, l]) => <Check key={k} checked={list(form.notify_roles).includes(k)} disabled={!editable} onChange={() => { const cur = list(form.notify_roles); const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]; set('notify_roles', (next.length ? next : ['admin']).join(',')); }}>{l}</Check>)}
          </div>
        </Row>
        <Row title="Send e-mail from" hint="Sender address (the server may override it)">
          <input type="email" aria-label="Send e-mail from" value={form.email_from} disabled={!editable} onChange={(e) => set('email_from', e.target.value)} style={{ ...control, width: '240px' }} />
        </Row>
        <Row title="Digest time" hint="When the scheduled job sends the daily digest (the schedule itself is set on the server)">
          <input type="time" aria-label="Digest time" value={String(form.digest_time).slice(0, 5)} disabled={!editable} onChange={(e) => set('digest_time', e.target.value)} style={control} />
        </Row>
        <Row title="Overdue tasks" hint="Include tasks past their end date"><Toggle isOn={form.notify_overdue_tasks} disabled={!editable} onToggle={() => set('notify_overdue_tasks', !form.notify_overdue_tasks)} /></Row>
        <Row title="Expiring approvals" hint="Include approvals expiring within the warning period"><Toggle isOn={form.notify_approvals} disabled={!editable} onToggle={() => set('notify_approvals', !form.notify_approvals)} /></Row>
        <Row title="Bills due" hint="Include approved bills due within 3 days or overdue"><Toggle isOn={form.notify_bills} disabled={!editable} onToggle={() => set('notify_bills', !form.notify_bills)} /></Row>
        <Row title="Missing daily reports" hint="Include open projects without a report (needs 'Daily reports required' in Site)"><Toggle isOn={form.notify_dpr} disabled={!editable} onToggle={() => set('notify_dpr', !form.notify_dpr)} /></Row>
        <Row title="WhatsApp" hint="Send the digest to these numbers through the server's webhook">
          <Toggle isOn={form.whatsapp_enabled} disabled={!editable} onToggle={() => set('whatsapp_enabled', !form.whatsapp_enabled)} />
        </Row>
        <Row title="WhatsApp numbers" hint="Comma separated, with country code">
          <input type="text" aria-label="WhatsApp numbers" value={form.whatsapp_numbers} disabled={!editable} onChange={(e) => set('whatsapp_numbers', e.target.value)} style={{ ...control, width: '260px' }} placeholder="+919800000000, +919800000001" />
        </Row>
        <Row title="Dry run" hint="On: scheduled runs only record what they would send, nothing is delivered">
          <Toggle isOn={form.notify_dry_run} disabled={!editable} onToggle={() => set('notify_dry_run', !form.notify_dry_run)} />
        </Row>
        {editable && (
          <div data-testid="notify-server" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={small}>Server:</span>
              {!server ? <span style={small}>checking…</span> : server.error ? <span style={{ ...small, color: 'var(--st-red-fg)' }}>function unreachable ({server.error})</span> : (
                <><span style={pill(server.smtp)}>E-mail {server.smtp ? 'configured' : 'not configured'}</span><span style={pill(server.whatsapp)}>WhatsApp {server.whatsapp ? 'configured' : 'not configured'}</span></>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" style={btn} disabled={!!busy} onClick={() => run(true)}>{busy === 'preview' ? 'Checking…' : 'Preview (dry run)'}</button>
              <button type="button" style={btn} disabled={!!busy} onClick={() => run(false)}>{busy === 'send' ? 'Sending…' : 'Send now'}</button>
            </div>
            <div style={small}>Settings above apply after you press Save Settings. Preview and Send now use the saved settings.</div>
            {result && (
              <div data-testid="notify-result" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-light)' }}>
                {result.error ? <span style={{ color: 'var(--st-red-fg)' }}>{result.error}</span> : (
                  <>
                    <div><strong>{result.items}</strong> item{result.items === 1 ? '' : 's'} · {result.dry_run ? 'dry run, nothing sent' : 'delivery attempted'} · {result.messages.length} recipient{result.messages.length === 1 ? '' : 's'}</div>
                    {result.note && <div>{result.note}</div>}
                    {result.results.map((r, i) => <div key={i}>{r.channel} → {r.recipient}: {r.status}{r.error ? ` (${r.error})` : ''}</div>)}
                    {result.body && <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontFamily: 'inherit', color: 'var(--text-muted)', maxHeight: '160px', overflow: 'auto' }}>{result.body}</pre>}
                  </>
                )}
              </div>
            )}
            {log.length > 0 && (
              <div style={small}>
                Recent: {log.map((l) => `${new Date(l.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ${l.channel} ${l.status}`).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={cardTitle}>Branding &amp; integrations</h2>
        <Row title="Company logo" hint="Printed on RA bills and demand letters (PNG, JPG or WebP under 300 KB)">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {form.company_logo && <img src={form.company_logo} alt="Company logo" style={{ maxHeight: '36px', maxWidth: '120px', background: '#ffffff', padding: '2px', borderRadius: '4px' }} />}
            {editable && <label style={{ ...btn, display: 'inline-block' }}>Choose<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ''; }} /></label>}
            {editable && form.company_logo && <button type="button" style={btn} onClick={() => set('company_logo', null)}>Remove</button>}
          </div>
        </Row>
        {logoError && <div role="alert" style={{ ...small, color: 'var(--st-red-fg)' }}>{logoError}</div>}
        <Row title="Letterhead" hint="Address and registration lines printed under the company name">
          <textarea aria-label="Letterhead" value={form.letterhead} disabled={!editable} onChange={(e) => set('letterhead', e.target.value)} rows={3} style={{ ...control, width: '300px', resize: 'vertical' }} />
        </Row>
        {editable && (
          <Row title="Calendar feed" hint="Subscribe to this link from Google Calendar, Outlook or Apple Calendar. Anyone with the link can read it: treat it like a password">
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input readOnly aria-label="Calendar feed link" value={feedUrl} onFocus={(e) => e.target.select()} style={{ ...control, width: '240px' }} />
              <button type="button" style={btn} onClick={() => { navigator.clipboard?.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy'}</button>
              <button type="button" style={btn} onClick={rotate}>New link</button>
            </div>
          </Row>
        )}
      </div>
    </>
  );
}
