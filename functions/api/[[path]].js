// API ของระบบ Mousetrap (Cloudflare Pages Functions + D1)
// เส้นทาง /api/* ต้องอยู่หลัง Cloudflare Access (ดู README)
import { json, identity, roleOf, isEditor, isAdmin, mapStation, mapInsp, STATUSES, ROLES, clip, num } from '../../lib/common.js';

const MAX_IMG = 1_900_000; // D1 จำกัดแถวละ ~2MB

export async function onRequest({ request, env, params }) {
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [a, b] = seg;
  const m = request.method;

  let email = null;
  try { email = await identity(request, env); } catch (e) { email = null; }
  if (!email) return json({ error: 'unauthorized' }, 401);
  const user = await roleOf(email, env);
  if (!user) return json({ error: 'no_access', email }, 403);

  const db = env.DB;
  const body = async () => { try { return await request.json(); } catch (e) { return null; } };
  const bad = (msg = 'bad_request', s = 400) => json({ error: msg }, s);
  const needEditor = () => (isEditor(user) ? null : bad('forbidden', 403));
  const needAdmin = () => (isAdmin(user) ? null : bad('forbidden', 403));

  try {
    // ---------- ผู้ใช้ปัจจุบัน ----------
    if (a === 'me' && m === 'GET') return json({ email, role: user.role, name: user.name || '' });

    // ---------- โหลดข้อมูลทั้งหมด ----------
    if (a === 'data' && m === 'GET') {
      const [L, S, I] = await Promise.all([
        db.prepare('SELECT id, name, src, w, h FROM mt_layouts ORDER BY rowid').all(),
        db.prepare('SELECT * FROM mt_stations').all(),
        db.prepare('SELECT * FROM mt_inspections ORDER BY date DESC').all()
      ]);
      const out = { layouts: L.results, stations: S.results.map(mapStation), insps: I.results.map(mapInsp) };
      if (isAdmin(user)) out.users = (await db.prepare('SELECT email, role, name FROM mt_users ORDER BY email').all()).results;
      return json(out);
    }

    // ---------- จุดติดตั้ง ----------
    if (a === 'stations' && m === 'POST') {
      const f = needEditor(); if (f) return f;
      const s = await body(); if (!s) return bad();
      const id = clip(s._id, 64), code = clip(s.code, 40).trim();
      if (!id || !code) return bad('missing_id_or_code');
      if (!STATUSES.includes(s.status)) return bad('bad_status');
      const photo = clip(s.photo, MAX_IMG);
      const old = await db.prepare('SELECT code FROM mt_stations WHERE id = ?').bind(id).first();
      const dup = await db.prepare('SELECT id FROM mt_stations WHERE code = ? AND id <> ?').bind(code, id).first();
      if (dup) return bad('duplicate_code', 409);
      const st = [db.prepare(
        `INSERT INTO mt_stations(id,code,name,zone,type,layout_id,x,y,status,is_public,note,photo,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,zone=excluded.zone,type=excluded.type,layout_id=excluded.layout_id,
           x=excluded.x,y=excluded.y,status=excluded.status,is_public=excluded.is_public,note=excluded.note,photo=excluded.photo,updated_at=excluded.updated_at`
      ).bind(id, code, clip(s.name, 120), clip(s.zone, 120), clip(s.type, 60), clip(s.layoutId, 64),
        Math.max(0, Math.min(100, num(s.x))), Math.max(0, Math.min(100, num(s.y))), s.status, s.isPublic ? 1 : 0, clip(s.note, 2000), photo, new Date().toISOString())];
      if (old && old.code !== code) st.push(db.prepare('UPDATE mt_inspections SET code = ? WHERE code = ?').bind(code, old.code));
      await db.batch(st);
      return json({ ok: true });
    }
    if (a === 'stations' && m === 'DELETE' && b) {
      const f = needAdmin(); if (f) return f;
      await db.prepare('DELETE FROM mt_stations WHERE id = ?').bind(decodeURIComponent(b)).run();
      return json({ ok: true });
    }

    // ---------- ประวัติการตรวจ ----------
    if (a === 'insps' && m === 'POST') {
      const f = needEditor(); if (f) return f;
      const i = await body(); if (!i) return bad();
      if (!clip(i._id, 64) || !clip(i.code, 40)) return bad('missing_id_or_code');
      if (!STATUSES.includes(i.status)) return bad('bad_status');
      await db.prepare('INSERT OR REPLACE INTO mt_inspections(id,code,date,status,count,inspector,note,photo) VALUES(?,?,?,?,?,?,?,?)')
        .bind(clip(i._id, 64), clip(i.code, 40), clip(i.date, 40), i.status, Math.max(0, Math.floor(num(i.count))), clip(i.inspector, 120), clip(i.note, 2000), clip(i.photo, MAX_IMG)).run();
      return json({ ok: true });
    }

    // ---------- แผนผัง ----------
    if (a === 'layouts' && m === 'POST') {
      const f = needAdmin(); if (f) return f;
      const l = await body(); if (!l || !clip(l.id, 64) || !clip(l.name, 120)) return bad();
      await db.prepare(`INSERT INTO mt_layouts(id,name,src,w,h) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,src=excluded.src,w=excluded.w,h=excluded.h`)
        .bind(clip(l.id, 64), clip(l.name, 120), clip(l.src, MAX_IMG), Math.floor(num(l.w)), Math.floor(num(l.h))).run();
      return json({ ok: true });
    }
    if (a === 'layouts' && m === 'DELETE' && b) {
      const f = needAdmin(); if (f) return f;
      const id = decodeURIComponent(b);
      await db.batch([db.prepare('DELETE FROM mt_stations WHERE layout_id = ?').bind(id), db.prepare('DELETE FROM mt_layouts WHERE id = ?').bind(id)]);
      return json({ ok: true });
    }

    // ---------- ผู้ใช้งาน (Admin) ----------
    if (a === 'users' && m === 'POST') {
      const f = needAdmin(); if (f) return f;
      const u = await body(); const em = clip(u && u.email, 200).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(em) || !ROLES.includes(u.role)) return bad('bad_user');
      await db.prepare(`INSERT INTO mt_users(email,role,name) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,name=excluded.name`)
        .bind(em, u.role, clip(u.name, 120)).run();
      return json({ ok: true });
    }
    if (a === 'users' && m === 'DELETE' && b) {
      const f = needAdmin(); if (f) return f;
      const em = decodeURIComponent(b).toLowerCase();
      const t = await db.prepare('SELECT role FROM mt_users WHERE email = ?').bind(em).first();
      if (t && t.role === 'Admin') {
        const c = await db.prepare("SELECT COUNT(*) n FROM mt_users WHERE role = 'Admin'").first();
        if (c.n <= 1) return bad('last_admin', 409);
      }
      await db.prepare('DELETE FROM mt_users WHERE email = ?').bind(em).run();
      return json({ ok: true });
    }

    // ---------- ข้อมูลตั้งต้น (ครั้งแรก) ----------
    if (a === 'seed' && m === 'POST') {
      const f = needAdmin(); if (f) return f;
      const c = await db.prepare('SELECT COUNT(*) n FROM mt_layouts').first();
      if (c.n > 0) return bad('already_seeded', 409);
      const d = await body(); if (!d) return bad();
      const st = [];
      (d.layouts || []).slice(0, 20).forEach((l) => st.push(db.prepare('INSERT INTO mt_layouts(id,name,src,w,h) VALUES(?,?,?,?,?)').bind(clip(l.id, 64), clip(l.name, 120), clip(l.src, 200), Math.floor(num(l.w)), Math.floor(num(l.h)))));
      (d.stations || []).slice(0, 500).forEach((s) => st.push(db.prepare(
        'INSERT INTO mt_stations(id,code,name,zone,type,layout_id,x,y,status,is_public,note,photo,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(clip(s._id, 64), clip(s.code, 40), clip(s.name, 120), clip(s.zone, 120), clip(s.type, 60), clip(s.layoutId, 64), num(s.x), num(s.y),
          STATUSES.includes(s.status) ? s.status : 'new', 0, '', '', new Date().toISOString())));
      if (st.length) await db.batch(st);
      return json({ ok: true });
    }

    // ---------- ส่งอีเมล (Resend) ----------
    if (a === 'mail' && m === 'POST') {
      if (!env.RESEND_API_KEY || !env.MAIL_FROM) return bad('mail_not_configured', 501);
      const d = await body(); if (!d) return bad();
      const to = (d.to || []).map((x) => String(x).trim()).filter((x) => /^\S+@\S+\.\S+$/.test(x)).slice(0, 20);
      if (!to.length) return bad('no_recipient');
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject: clip(d.subject, 300), html: clip(d.html, 200000),
          attachments: (d.attachments || []).slice(0, 8).map((x) => ({ filename: clip(x.filename, 120), content: String(x.content || '') })) })
      });
      if (!r.ok) return bad('mail_failed_' + r.status, 502);
      return json({ ok: true });
    }

    // ---------- ส่ง LINE (Messaging API) ----------
    if (a === 'line' && m === 'POST') {
      const f = needEditor(); if (f) return f;
      if (!env.LINE_TOKEN || !env.LINE_TO) return bad('line_not_configured', 501);
      const d = await body(); if (!d || !d.text) return bad();
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.LINE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: env.LINE_TO, messages: [{ type: 'text', text: clip(d.text, 4900) }] })
      });
      if (!r.ok) return bad('line_failed_' + r.status, 502);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: 'server_error', detail: String(e && e.message || e).slice(0, 200) }, 500);
  }
  return json({ error: 'not_found' }, 404);
}
