// Edge Function: calendar-feed
// Read-only iCalendar (ICS) feed of tasks, project dates, approval expiries, snag due dates and holidays,
// for Google Calendar / Outlook / Apple Calendar "subscribe by URL".
// The link carries a secret token (pm_settings.ics_token, regenerate it in Projects Settings > Notifications).
//
// GET /functions/v1/calendar-feed?token=<token>[&project=<project code or name>]

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
async function rest(path: string) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: svc });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status}`);
  return await r.json();
}

const esc = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (d: string) => d.replace(/-/g, '');
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const fold = (line: string) => { const out: string[] = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join('\r\n'); };

function event(uid: string, start: string, end: string, summary: string, description = '') {
  const last = end < start ? start : end;
  return ['BEGIN:VEVENT', `UID:${uid}@selora-pms`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
    `DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(nextDay(last))}`, `SUMMARY:${esc(summary)}`, ...(description ? [`DESCRIPTION:${esc(description)}`] : []), 'END:VEVENT'].map(fold).join('\r\n');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  try {
    const [settings] = await rest('pm_settings?select=ics_token,holiday_list,company&limit=1');
    if (!token || !settings || token !== settings.ics_token) return new Response('Not found', { status: 404 });
    const projects: any[] = await rest('projects?select=id,code,project_name,expected_start_date,expected_end_date,status');
    const filter = url.searchParams.get('project');
    const scope = filter ? projects.filter((p) => p.code === filter || p.project_name === filter) : projects;
    const ids = new Set(scope.map((p) => p.id));
    const name = (id: string) => projects.find((p) => p.id === id)?.project_name ?? '';
    const events: string[] = [];

    for (const t of await rest('project_tasks?select=id,code,subject,project_id,expected_start_date,expected_end_date,status&is_template=eq.false&status=neq.Cancelled&limit=2000')) {
      if (!ids.has(t.project_id)) continue;
      const s = t.expected_start_date || t.expected_end_date; const e = t.expected_end_date || t.expected_start_date;
      if (s) events.push(event(`task-${t.id}`, s, e, `${t.subject} (${name(t.project_id)})`, `${t.code} - ${t.status}`));
    }
    for (const p of scope) {
      if (p.expected_start_date) events.push(event(`pstart-${p.id}`, p.expected_start_date, p.expected_start_date, `Start: ${p.project_name}`));
      if (p.expected_end_date) events.push(event(`pend-${p.id}`, p.expected_end_date, p.expected_end_date, `Due: ${p.project_name}`));
    }
    for (const a of await rest('approvals?select=id,name,project_id,expiry_on&status=eq.Approved&expiry_on=not.is.null&limit=1000')) {
      if (ids.has(a.project_id)) events.push(event(`appr-${a.id}`, a.expiry_on, a.expiry_on, `${a.name} expires (${name(a.project_id)})`));
    }
    for (const s of await rest('snags?select=id,code,title,project_id,due_date,status&due_date=not.is.null&status=in.(Open,Fixed)&limit=1000')) {
      if (ids.has(s.project_id)) events.push(event(`snag-${s.id}`, s.due_date, s.due_date, `Snag due: ${s.title} (${name(s.project_id)})`, s.code));
    }
    if (settings.holiday_list) {
      const lists = await rest(`holiday_lists?select=id&name=eq.${encodeURIComponent(settings.holiday_list)}`);
      if (lists[0]) for (const h of await rest(`holidays?select=holiday_date,description&list_id=eq.${lists[0].id}`)) events.push(event(`hol-${h.holiday_date}`, h.holiday_date, h.holiday_date, h.description || 'Holiday'));
    }
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Selora PMS//Calendar feed//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`${settings.company || 'Selora'} projects`)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', ...events, 'END:VCALENDAR'].join('\r\n');
    return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900' } });
  } catch (e) {
    console.error('calendar-feed failed', e);
    return new Response('Error', { status: 500 });
  }
});
