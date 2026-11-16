// /login อยู่หลัง Cloudflare Access: เมื่อผู้ใช้ยืนยันตัวตนสำเร็จ จะได้ Cookie แล้วเด้งกลับหน้าหลัก
export const onRequest = ({ request }) => Response.redirect(new URL('/', request.url).toString(), 302);
