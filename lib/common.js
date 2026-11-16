// ตัวช่วยร่วมของ API (Cloudflare Pages Functions)
export const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const txt = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));

// ตรวจ JWT ของ Cloudflare Access (ป้องกันซ้ำอีกชั้น) แล้วคืนอีเมลผู้ใช้
async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const header = txt(h), payload = txt(p);
  if (!payload.exp || payload.exp < Date.now() / 1000) throw new Error('expired');
  if (env.POLICY_AUD && ![].concat(payload.aud || []).includes(env.POLICY_AUD)) throw new Error('aud');
  if (payload.iss !== `https://${env.TEAM_DOMAIN}`) throw new Error('iss');
  const jwks = await (await fetch(`https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p));
  if (!ok || !payload.email) throw new Error('sig');
  return String(payload.email).toLowerCase();
}

export async function identity(request, env) {
  if (env.DEV_EMAIL) return env.DEV_EMAIL.toLowerCase(); // ใช้ตอนพัฒนาในเครื่องเท่านั้น ห้ามตั้งบน Production
  if (!env.TEAM_DOMAIN) return null; // ยังไม่ตั้งค่า Access = ปฏิเสธทุกคำขอ (ปลอดภัยไว้ก่อน)
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get('cf-access-jwt-assertion') || (cookie && cookie[1]);
  if (!token) return null;
  return verifyAccessJwt(token, env);
}

const list = (v) => String(v || '').split(/[;,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

// หาสิทธิ์ผู้ใช้: อยู่ในตาราง mt_users หรืออยู่ใน BOOTSTRAP_ADMINS (Admin คนแรก)
export async function roleOf(email, env) {
  const u = await env.DB.prepare('SELECT email, role, name FROM mt_users WHERE email = ?').bind(email).first();
  if (u) return u;
  if (list(env.BOOTSTRAP_ADMINS).includes(email)) {
    await env.DB.prepare('INSERT OR IGNORE INTO mt_users(email, role, name) VALUES(?,?,?)').bind(email, 'Admin', '').run();
    return { email, role: 'Admin', name: '' };
  }
  return null;
}

export const isEditor = (u) => u && (u.role === 'Admin' || u.role === 'Editor');
export const isAdmin = (u) => u && u.role === 'Admin';

export const mapStation = (r) => ({
  _id: r.id, code: r.code, name: r.name || '', zone: r.zone || '', type: r.type || '', layoutId: r.layout_id || '',
  x: r.x, y: r.y, status: r.status || 'new', isPublic: !!r.is_public, note: r.note || '', photo: r.photo || ''
});
export const mapInsp = (r) => ({
  _id: r.id, code: r.code, date: r.date, status: r.status, count: r.count || 0, inspector: r.inspector || '', note: r.note || '', photo: r.photo || ''
});

export const STATUSES = ['new', 'ok', 'activity', 'service', 'missing'];
export const ROLES = ['Admin', 'Editor', 'Viewer'];
export const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
export const num = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };
