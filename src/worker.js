// จุดเข้าของ Cloudflare Worker: ส่ง /api, /auth, /pub ไปยังโค้ด และให้ไฟล์เว็บ (public/) เสิร์ฟผ่าน Assets
import { handleApi } from './api.js';
import { handlePub } from './pub.js';
import { handleAuth } from './auth.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p.startsWith('/auth/')) return handleAuth(request, env, p.split('/').slice(2).filter(Boolean));
    if (p === '/pub/data' && request.method === 'GET') return handlePub(env);
    if (p === '/api' || p.startsWith('/api/')) return handleApi(request, env, p.split('/').slice(2).filter(Boolean));
    return env.ASSETS.fetch(request);
  }
};
