// ตัวช่วยร่วมของ API (Cloudflare Workers)
export const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

const te = new TextEncoder();
const toB64u = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const hmacKey = (secret) => crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

// ---------- Session (Cookie ที่เซ็นด้วย HMAC) ----------
export const COOKIE = 'mt_session';
export async function signSession(email, env, ttl = 43200) {
  const p = toB64u(te.encode(JSON.stringify({ e: email, exp: Math.floor(Date.now() / 1000) + ttl })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), te.encode(p));
  return p + '.' + toB64u(sig);
}
async function verifySession(tok, env) {
  const [p, s] = String(tok).split('.');
  if (!p || !s) throw new Error('bad');
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), fromB64u(s), te.encode(p));
  if (!ok) throw new Error('sig');
  const d = JSON.parse(new TextDecoder().decode(fromB64u(p)));
  if (!d.exp || d.exp < Date.now() / 1000 || !d.e) throw new Error('exp');
  return String(d.e).toLowerCase();
}
export const sessionCookie = (token, url, maxAge) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;

export async function identity(request, env) {
  if (env.DEV_EMAIL) return env.DEV_EMAIL.toLowerCase(); // ใช้ตอนพัฒนาในเครื่องเท่านั้น ห้ามตั้งบน Production
  if (!env.SESSION_SECRET) return null; // ยังไม่ตั้งค่า = ปฏิเสธทุกคำขอ (ปลอดภัยไว้ก่อน)
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  return verifySession(m[1], env);
}

// ---------- รหัสผ่าน (PBKDF2-SHA256) ----------
export const newSalt = () => toB64u(crypto.getRandomValues(new Uint8Array(16)));
export async function hashPassword(pw, saltB64u) {
  const key = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(saltB64u), iterations: 100000 }, key, 256);
  return toB64u(bits);
}
export function tempPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((x) => a[x % a.length]).join('');
}
export function safeEq(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

export const list = (v) => String(v || '').split(/[;,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

// หาสิทธิ์ผู้ใช้: อยู่ในตาราง mt_users หรืออยู่ใน BOOTSTRAP_ADMINS (Admin คนแรก)
export async function roleOf(email, env) {
  const u = await env.DB.prepare('SELECT email, role, name, must_change FROM mt_users WHERE email = ?').bind(email).first();
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
