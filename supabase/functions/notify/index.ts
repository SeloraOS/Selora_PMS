// Edge Function: notify
// Builds the daily digest (overdue tasks, expiring approvals, bills due, missing daily reports) and delivers it by e-mail
// and/or a WhatsApp webhook. Fetch-only (no npm imports). Everything is OFF until configured:
//   - channels and recipients come from pm_settings (Projects Settings > Notifications)
//   - secrets come from this function's environment (never the database or the browser):
//       NOTIFY_SMTP_HOST, NOTIFY_SMTP_PORT (465 = TLS, otherwise STARTTLS), NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS, NOTIFY_SMTP_FROM
//       NOTIFY_WHATSAPP_URL, NOTIFY_WHATSAPP_TOKEN   (POST {to, message} with "Authorization: Bearer <token>")
//       NOTIFY_TZ_OFFSET_MINUTES (default 330 = IST)
//
// POST /functions/v1/notify  { action: 'status' | 'run', dry_run?: boolean }
//   caller: a signed-in admin/manager (Settings buttons) or the service-role key (scheduled job)
// -> status: { smtp, whatsapp }      run: { dry_run, items, messages: [...], results: [...] }

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') || 'https://pms.seloraos.online,http://localhost:5173').split(',').map((s) => s.trim());
const env = (k: string) => Deno.env.get(k) ?? '';

const smtpCfg = () => ({ host: env('NOTIFY_SMTP_HOST'), port: Number(env('NOTIFY_SMTP_PORT') || 465), user: env('NOTIFY_SMTP_USER'), pass: env('NOTIFY_SMTP_PASS'), from: env('NOTIFY_SMTP_FROM') });
const smtpConfigured = () => { const c = smtpCfg(); return !!(c.host && c.user && c.pass); };
const whatsappConfigured = () => !!(env('NOTIFY_WHATSAPP_URL') && env('NOTIFY_WHATSAPP_TOKEN'));

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : await r.json();
}

async function caller(req: Request): Promise<'cron' | 'staff' | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token === SERVICE) return 'cron';
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const { id } = await u.json();
  const rows = await rest(`profiles?select=role&id=eq.${id}`);
  return rows?.[0] && ['admin', 'manager'].includes(rows[0].role) ? 'staff' : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s: string, n: number) => ymd(new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000));
const inr = (n: number) => `Rs ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ── digest ──────────────────────────────────────────────────────────────────
async function buildDigest(settings: Record<string, any>) {
  const offset = Number(env('NOTIFY_TZ_OFFSET_MINUTES') || 330);
  const local = new Date(Date.now() + offset * 60000);
  const today = ymd(local);
  const nowHm = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  const projects: any[] = await rest('projects?select=id,project_name,status');
  const name = (id: string) => projects.find((p) => p.id === id)?.project_name ?? '';
  const sections: { title: string; lines: string[] }[] = [];

  if (settings.notify_overdue_tasks) {
    const rows = await rest(`project_tasks?select=code,subject,expected_end_date,project_id&status=not.in.(Completed,Cancelled)&is_template=eq.false&expected_end_date=lt.${today}&order=expected_end_date&limit=200`);
    if (rows.length) sections.push({ title: `Overdue tasks (${rows.length})`, lines: rows.slice(0, 15).map((t: any) => `${t.code} ${t.subject} - ${name(t.project_id)} - due ${t.expected_end_date}`) });
  }
  if (settings.notify_approvals) {
    const rows = await rest(`approvals?select=name,expiry_on,project_id&status=eq.Approved&expiry_on=lte.${addDays(today, Number(settings.approval_warning_days) || 30)}&order=expiry_on&limit=200`);
    if (rows.length) sections.push({ title: `Approvals expiring or expired (${rows.length})`, lines: rows.slice(0, 15).map((a: any) => `${a.name} - ${name(a.project_id)} - ${a.expiry_on < today ? 'expired' : 'expires'} ${a.expiry_on}`) });
  }
  if (settings.notify_bills) {
    const rows = (await rest(`ra_bills?select=code,net_amount,paid_amount,due_date,vendor_id,project_id&status=eq.approved&due_date=lte.${addDays(today, 3)}&order=due_date&limit=200`)).filter((b: any) => Number(b.net_amount) > Number(b.paid_amount));
    if (rows.length) {
      const vendors: any[] = await rest('vendors?select=id,name');
      sections.push({ title: `Bills due or overdue (${rows.length})`, lines: rows.slice(0, 15).map((b: any) => `${b.code} ${vendors.find((v) => v.id === b.vendor_id)?.name ?? ''} - ${inr(Number(b.net_amount) - Number(b.paid_amount))} - due ${b.due_date}`) });
    }
  }
  if (settings.notify_dpr && settings.dpr_required) {
    const day = nowHm >= String(settings.dpr_cutoff_time).slice(0, 5) ? today : addDays(today, -1);
    const done = new Set((await rest(`daily_reports?select=project_id&report_date=eq.${day}&status=eq.submitted`)).map((r: any) => r.project_id));
    const missing = projects.filter((p) => p.status === 'Open' && !done.has(p.id));
    if (missing.length) sections.push({ title: `No daily report for ${day} (${missing.length})`, lines: missing.slice(0, 15).map((p: any) => p.project_name) });
  }
  const items = sections.reduce((n, s) => n + Number(/\((\d+)\)$/.exec(s.title)?.[1] ?? 0), 0);
  const body = sections.map((s) => `${s.title}\n${s.lines.map((l) => `  - ${l}`).join('\n')}`).join('\n\n');
  return { today, items, subject: `Selora PMS digest ${today}: ${items} item${items === 1 ? '' : 's'} need attention`, body: `${body}\n\nOpen https://pms.seloraos.online to act on these.` };
}

// ── delivery ────────────────────────────────────────────────────────────────
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const wrap = (s: string) => s.replace(/(.{76})/g, '$1\r\n');

async function smtpSend(to: string, subject: string, text: string, fromSetting: string) {
  const c = smtpCfg();
  const from = c.from || fromSetting || c.user;
  const enc = new TextEncoder(); const dec = new TextDecoder();
  let conn: Deno.Conn = c.port === 465 ? await Deno.connectTls({ hostname: c.host, port: c.port }) : await Deno.connect({ hostname: c.host, port: c.port });
  let buf = '';
  const read = async (): Promise<string> => {
    for (;;) {
      const lines = buf.split('\r\n');
      if (lines.length > 1 && /^\d{3} /.test(lines[lines.length - 2] ?? '')) { const out = buf; buf = ''; return out; }
      const chunk = new Uint8Array(4096); const n = await conn.read(chunk);
      if (n === null) throw new Error('SMTP connection closed');
      buf += dec.decode(chunk.subarray(0, n));
    }
  };
  const cmd = async (line: string, ok: number[]) => {
    await conn.write(enc.encode(`${line}\r\n`));
    const reply = await read();
    if (!ok.includes(Number(reply.slice(0, 3)))) throw new Error(`SMTP ${line.split(' ')[0]} failed: ${reply.trim().slice(0, 120)}`);
    return reply;
  };
  try {
    const greet = await read(); if (!greet.startsWith('220')) throw new Error(`SMTP greeting: ${greet.trim().slice(0, 80)}`);
    let ehlo = await cmd(`EHLO selora-pms`, [250]);
    if (c.port !== 465 && /STARTTLS/i.test(ehlo)) {
      await cmd('STARTTLS', [220]);
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: c.host });
      ehlo = await cmd('EHLO selora-pms', [250]);
    }
    await cmd('AUTH LOGIN', [334]); await cmd(b64(c.user), [334]); await cmd(b64(c.pass), [235]);
    await cmd(`MAIL FROM:<${from}>`, [250]);
    await cmd(`RCPT TO:<${to}>`, [250, 251]);
    await cmd('DATA', [354]);
    const msg = [
      `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@selora-pms>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
      wrap(b64(text)),
    ].join('\r\n');
    await conn.write(enc.encode(`${msg}\r\n.\r\n`));
    const done = await read(); if (!done.startsWith('250')) throw new Error(`SMTP DATA failed: ${done.trim().slice(0, 120)}`);
    await cmd('QUIT', [221]).catch(() => {});
  } finally { try { conn.close(); } catch { /* already closed */ } }
}

async function whatsappSend(to: string, message: string) {
  const r = await fetch(env('NOTIFY_WHATSAPP_URL'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('NOTIFY_WHATSAPP_TOKEN')}` }, body: JSON.stringify({ to, message }) });
  if (!r.ok) throw new Error(`WhatsApp webhook ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

async function run(dryRunRequested: boolean | undefined) {
  const [settings] = await rest('pm_settings?select=*&limit=1');
  const channels = String(settings.notify_channels).split(',');
  const dryRun = dryRunRequested ?? !!settings.notify_dry_run;
  const digest = await buildDigest(settings);
  const messages: { channel: 'email' | 'whatsapp'; recipient: string }[] = [];
  if (channels.includes('email')) {
    const roles = String(settings.notify_roles).split(',').join(',');
    const people: any[] = await rest(`profiles?select=email&role=in.(${roles})&email=not.is.null`);
    for (const p of people) messages.push({ channel: 'email', recipient: p.email });
  }
  if (channels.includes('whatsapp') && settings.whatsapp_enabled) {
    for (const n of String(settings.whatsapp_numbers).split(',').map((s) => s.trim()).filter(Boolean)) messages.push({ channel: 'whatsapp', recipient: n });
  }
  const results: { channel: string; recipient: string; status: string; error?: string }[] = [];
  if (!digest.items) return { dry_run: dryRun, items: 0, subject: digest.subject, messages, results, note: 'Nothing needs attention, so nothing was sent.' };

  const log = (row: Record<string, unknown>) => rest('notification_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ subject: digest.subject, body: digest.body, ...row }) }).catch(() => {});
  for (const m of messages) {
    let status = 'sent'; let error: string | undefined;
    if (dryRun) status = 'dry_run';
    else {
      const already = await rest(`notification_log?select=id&sent_on=eq.${digest.today}&channel=eq.${m.channel}&recipient=eq.${encodeURIComponent(m.recipient)}&status=eq.sent&limit=1`);
      if (already.length) { status = 'skipped'; error = 'Already sent today'; }
      else if (m.channel === 'email' && !smtpConfigured()) { status = 'skipped'; error = 'SMTP is not configured on the server'; }
      else if (m.channel === 'whatsapp' && !whatsappConfigured()) { status = 'skipped'; error = 'WhatsApp webhook is not configured on the server'; }
      else {
        try { if (m.channel === 'email') await smtpSend(m.recipient, digest.subject, digest.body, settings.email_from); else await whatsappSend(m.recipient, `${digest.subject}\n\n${digest.body}`); }
        catch (e) { status = 'failed'; error = (e as Error).message; }
      }
    }
    results.push({ channel: m.channel, recipient: m.recipient, status, ...(error ? { error } : {}) });
    await log({ sent_on: digest.today, channel: m.channel, recipient: m.recipient, status, error: error ?? null });
  }
  return { dry_run: dryRun, items: digest.items, subject: digest.subject, body: digest.body, messages, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  try {
    const who = await caller(req);
    if (!who) return json(req, { error: 'Only admins and managers can do this' }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'status') return json(req, { smtp: smtpConfigured(), whatsapp: whatsappConfigured() });
    if (body.action === 'run') return json(req, await run(typeof body.dry_run === 'boolean' ? body.dry_run : undefined));
    return json(req, { error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('notify failed', e);
    return json(req, { error: (e as Error).message }, 500);
  }
});
