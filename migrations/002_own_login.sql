-- ใช้เฉพาะกรณีเคยรัน schema.sql รุ่นเก่า (ที่ใช้ Cloudflare Access) ไปแล้ว
-- ยังไม่มีผู้ใช้จริงในตาราง จึงสร้าง mt_users ใหม่ได้อย่างปลอดภัย
DROP TABLE IF EXISTS mt_users;
CREATE TABLE mt_users (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('Admin','Editor','Viewer')),
  name        TEXT NOT NULL DEFAULT '',
  pass_hash   TEXT NOT NULL DEFAULT '',
  salt        TEXT NOT NULL DEFAULT '',
  must_change INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mt_login_fail (
  email TEXT PRIMARY KEY,
  n     INTEGER NOT NULL DEFAULT 0,
  until INTEGER NOT NULL DEFAULT 0
);
