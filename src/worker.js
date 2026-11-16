// จุดเข้าของ Cloudflare Worker: ส่ง /api, /pub, /login ไปยังโค้ด และให้ไฟล์เว็บ (public/) เสิร์ฟผ่าน Assets
import { handleApi } from './api.js';
import { handlePub } from './pub.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    // /login อยู่หลัง Cloudflare Access: ล็อกอินสำเร็จแล้วเด้งกลับหน้าหลัก
    if (p === '/login') return Response.redirect(new URL('/', url).toString(), 302);
    if (p === '/pub/data' && request.method === 'GET') return handlePub(env);
    if (p === '/api' || p.startsWith('/api/')) return handleApi(request, env, p.split('/').slice(2).filter(Boolean));
    return env.ASSETS.fetch(request);
  }
};
