// Edge Function: invite-user
// Lets an admin/manager create an account and add it to projects. Uses only fetch (no npm imports) so it starts fast
// and has nothing to download. The service-role key stays inside this function; the browser only sends its own session token.
//
// POST /functions/v1/invite-user
//   { email, full_name?, role: 'member'|'client'|'contractor'|'manager'|'admin',
//     projects?: [{ project_id, project_role }], send_email?: boolean }
// -> { user_id, email, role, temp_password? }      (temp_password only when no invitation e-mail is sent)

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') || 'https://pms.seloraos.online,http://localhost:5173').split(',').map((s) => s.trim());

const ROLES = ['member', 'client', 'contractor', 'manager', 'admin'];
const PROJECT_ROLES = ['owner', 'staff', 'contractor', 'client', 'viewer'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function tempPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 16) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

async function caller(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  const p = await fetch(`${URL_}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: svc });
  const rows = p.ok ? await p.json() : [];
  return rows[0] ? { id: user.id as string, role: rows[0].role as string } : null;
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

    const who = await caller(req);
    if (!who) return json(req, { error: 'Not signed in' }, 401);
    if (!['admin', 'manager'].includes(who.role)) return json(req, { error: 'Only admins and managers can invite users' }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json(req, { error: 'Invalid JSON' }, 400); }
    const email = String(body.email ?? '').trim().toLowerCase();
    const role = String(body.role ?? 'member');
    const fullName = String(body.full_name ?? '').trim() || email.split('@')[0];
    const projects = Array.isArray(body.projects) ? body.projects : [];
    const sendEmail = body.send_email === true;

    if (!EMAIL.test(email)) return json(req, { error: 'Enter a valid email address' }, 400);
    if (!ROLES.includes(role)) return json(req, { error: 'Unknown role' }, 400);
    if (['admin', 'manager'].includes(role) && who.role !== 'admin') return json(req, { error: 'Only admins can create admins or managers' }, 403);
    for (const p of projects) {
      if (!/^[0-9a-f-]{36}$/i.test(String(p.project_id)) || !PROJECT_ROLES.includes(p.project_role)) return json(req, { error: 'Invalid project membership' }, 400);
    }
    if (['client', 'contractor'].includes(role) && projects.length === 0) return json(req, { error: 'Clients and contractors need at least one project' }, 400);

    // 1. create the account
    const temp = sendEmail ? null : tempPassword();
    const created = sendEmail
      ? await fetch(`${URL_}/auth/v1/invite`, { method: 'POST', headers: svc, body: JSON.stringify({ email, data: { full_name: fullName } }) })
      : await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password: temp, email_confirm: true, user_metadata: { full_name: fullName } }) });
    const cj = await created.json().catch(() => ({}));
    if (!created.ok) {
      const exists = /already|registered|exists/i.test(JSON.stringify(cj));
      return json(req, { error: exists ? 'An account with this email already exists' : (cj.msg ?? cj.message ?? 'Could not create the account') }, exists ? 409 : 502);
    }
    const userId: string = cj.id ?? cj.user?.id;

    // 2. role + first-login password change (profile row is created by the auth trigger)
    const patch = await fetch(`${URL_}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
      body: JSON.stringify({ role, full_name: fullName, must_change_password: !sendEmail }),
    });
    if (!patch.ok) return json(req, { error: 'Account created but its role could not be set', user_id: userId }, 502);

    // 3. project memberships
    if (projects.length) {
      const rows = projects.map((p: any) => ({ project_id: p.project_id, user_email: email, full_name: fullName, profile_id: userId, project_role: p.project_role, invited_by: who.id }));
      const ins = await fetch(`${URL_}/rest/v1/project_users?on_conflict=project_id,user_email`, {
        method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
      });
      if (!ins.ok) return json(req, { error: 'Account created but project access could not be set', user_id: userId }, 502);
    }

    return json(req, { user_id: userId, email, role, ...(temp ? { temp_password: temp } : {}) });
  },
};
