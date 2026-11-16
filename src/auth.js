// ล็อกอินของระบบเอง: อีเมล + รหัสผ่าน (PBKDF2) -> Cookie session (HttpOnly)
import { json, identity, sessionCookie, signSession, hashPassword, newSalt, safeEq, list, clip } from '../lib/common.js';

const MAX_FAIL = 5, LOCK_MS = 15 * 60 * 1000;

export async function handleAuth(request, env, seg) {
  const url = new URL(request.url);
  const act = seg[0];
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
  if (!env.SESSION_SECRET) return json({ error: 'not_configured' }, 500);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return json({ error: 'forbidden' }, 403);
  let b; try { b = await request.json(); } catch (e) { b = {}; }
  const db = env.DB;

  if (act === 'logout') return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', url, 0) });

  if (act === 'login') {
    const email = clip(b.email, 200).trim().toLowerCase();
    const pw = String(b.password || '').slice(0, 200);
    if (!email || !pw) return json({ error: 'invalid_credentials' }, 401);
    const f = await db.prepare('SELECT n, until FROM mt_login_fail WHERE email = ?').bind(email).first();
    if (f && f.until > Date.now()) return json({ error: 'too_many_attempts' }, 429);

    let u = await db.prepare('SELECT * FROM mt_users WHERE email = ?').bind(email).first();
    let ok = false;
    if (u && u.pass_hash) {
      ok = safeEq(await hashPassword(pw, u.salt), u.pass_hash);
    } else {
      await hashPassword(pw, newSalt()); // ใช้เวลาใกล้เคียงกัน ไม่บอกว่าอีเมลมีอยู่หรือไม่
      // Admin คนแรก: เข้าด้วย BOOTSTRAP_PASSWORD แล้วระบบบังคับให้ตั้งรหัสใหม่
      if (list(env.BOOTSTRAP_ADMINS).includes(email) && env.BOOTSTRAP_PASSWORD && safeEq(pw, env.BOOTSTRAP_PASSWORD)) {
        if (!u) await db.prepare("INSERT INTO mt_users(email,role,name,must_change) VALUES(?, 'Admin', '', 1)").bind(email).run();
        else await db.prepare('UPDATE mt_users SET must_change = 1 WHERE email = ?').bind(email).run();
        u = { email, must_change: 1 };
        ok = true;
      }
    }
    if (!ok) {
      const n = (f ? f.n : 0) + 1;
      await db.prepare('INSERT OR REPLACE INTO mt_login_fail(email,n,until) VALUES(?,?,?)')
        .bind(email, n >= MAX_FAIL ? 0 : n, n >= MAX_FAIL ? Date.now() + LOCK_MS : 0).run();
      return json({ error: 'invalid_credentials' }, 401);
    }
    await db.prepare('DELETE FROM mt_login_fail WHERE email = ?').bind(email).run();
    return json({ ok: true, mustChange: !!u.must_change }, 200, { 'set-cookie': sessionCookie(await signSession(email, env), url, 43200) });
  }

  if (act === 'password') {
    let email = null;
    try { email = await identity(request, env); } catch (e) { email = null; }
    if (!email) return json({ error: 'unauthorized' }, 401);
    const u = await db.prepare('SELECT * FROM mt_users WHERE email = ?').bind(email).first();
    if (!u) return json({ error: 'no_access' }, 403);
    const np = String(b.newPassword || '');
    if (np.length < 8 || np.length > 100) return json({ error: 'weak_password' }, 400);
    let ok = false;
    if (u.pass_hash) ok = safeEq(await hashPassword(String(b.oldPassword || ''), u.salt), u.pass_hash);
    else ok = !!env.BOOTSTRAP_PASSWORD && safeEq(String(b.oldPassword || ''), env.BOOTSTRAP_PASSWORD);
    if (!ok) return json({ error: 'invalid_credentials' }, 401);
    const salt = newSalt();
    await db.prepare('UPDATE mt_users SET pass_hash = ?, salt = ?, must_change = 0 WHERE email = ?').bind(await hashPassword(np, salt), salt, email).run();
    return json({ ok: true });
  }
  return json({ error: 'not_found' }, 404);
}
