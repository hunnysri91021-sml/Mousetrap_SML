-- Mousetrap: โครงสร้างฐานข้อมูล Cloudflare D1
CREATE TABLE IF NOT EXISTS mt_layouts (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  src  TEXT NOT NULL DEFAULT '',   -- 'builtin:area1' หรือ data URL ของรูปแผนผัง
  w    INTEGER NOT NULL DEFAULT 0,
  h    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mt_stations (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  zone       TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT '',
  layout_id  TEXT NOT NULL DEFAULT '',
  x          REAL NOT NULL DEFAULT 0,   -- ตำแหน่งเป็น % ของรูป
  y          REAL NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'new',
  is_public  INTEGER NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',
  photo      TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_st_layout ON mt_stations(layout_id);
CREATE TABLE IF NOT EXISTS mt_inspections (
  id        TEXT PRIMARY KEY,
  code      TEXT NOT NULL,
  date      TEXT NOT NULL,
  status    TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  inspector TEXT NOT NULL DEFAULT '',
  note      TEXT NOT NULL DEFAULT '',
  photo     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_insp_code ON mt_inspections(code, date);
CREATE TABLE IF NOT EXISTS mt_users (
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
