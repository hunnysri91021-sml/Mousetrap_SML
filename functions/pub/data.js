// ข้อมูลสาธารณะ: ไม่ต้องล็อกอิน คืนเฉพาะจุดที่ติ๊ก Public (ไม่มีหมายเหตุ/ผู้ตรวจ/ประวัติ)
import { json } from '../../lib/common.js';

export async function onRequestGet({ env }) {
  const S = await env.DB.prepare(
    `SELECT s.code, s.name, s.zone, s.type, s.layout_id, s.x, s.y, s.status, s.photo,
            (SELECT MAX(date) FROM mt_inspections i WHERE i.code = s.code) AS last_date
       FROM mt_stations s WHERE s.is_public = 1`).all();
  const ids = [...new Set(S.results.map((r) => r.layout_id))];
  let layouts = [];
  if (ids.length) {
    const q = await env.DB.prepare(`SELECT id, name, src, w, h FROM mt_layouts WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    layouts = q.results;
  }
  return json({
    layouts,
    stations: S.results.map((r) => ({ code: r.code, name: r.name, zone: r.zone, type: r.type, layoutId: r.layout_id, x: r.x, y: r.y, status: r.status, photo: r.photo || '', lastDate: r.last_date || '' }))
  }, 200, { 'cache-control': 'public, max-age=60' });
}
