// จุดเข้าของ Cloudflare Worker: ส่ง /api, /auth, /pub ไปยังโค้ด และให้ไฟล์เว็บ (public/) เสิร์ฟผ่าน Assets
import { handleApi } from './api.js';
import { handlePub } from './pub.js';
import { handleAuth } from './auth.js';

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      const msg = String((e && e.message) || e);
      // ตอบเป็น JSON เสมอ (ไม่เปิดเผยรายละเอียดภายใน) เพื่อให้หน้าเว็บบอกสาเหตุที่แก้ได้
      const hint = /no such table|no such column/i.test(msg) ? 'database_not_initialized' : /D1|binding|undefined/i.test(msg) ? 'database_not_bound' : 'server_error';
      return new Response(JSON.stringify({ error: hint }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.startsWith('/auth/')) return handleAuth(request, env, p.split('/').slice(2).filter(Boolean));
  if (p === '/pub/data' && request.method === 'GET') return handlePub(env);
  if (p === '/api' || p.startsWith('/api/')) return handleApi(request, env, p.split('/').slice(2).filter(Boolean));
  return env.ASSETS.fetch(request);
}
