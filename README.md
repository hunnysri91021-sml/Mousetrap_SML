# Mousetrap Monitoring (SML)

ระบบติดตามจุดติดตั้งกรงดักหนูบนแผนผังพื้นที่จริง (พื้นที่ 1 = จุด 1–23, พื้นที่ 2 = จุด 24–32 ตามไฟล์ Mousetrap.pptx)
ทำงานบน **GitHub + Cloudflare Workers + D1** ล็อกอินด้วยอีเมล + รหัสผ่านของระบบเอง – **ไม่ต้องมี Microsoft 365 และไม่ต้องใช้ Cloudflare Zero Trust (ไม่ต้องกรอกบัตร)**

| ฟีเจอร์ | รายละเอียด |
|---|---|
| คลิกจุด | เปิดรูป สถานะ QR ประวัติ และฟอร์มบันทึกผลตรวจ (ถ่ายรูปจากมือถือได้) |
| เพิ่ม/ลด | เพิ่ม-ลบพื้นที่ (แผนผัง) และจุด, ลากย้ายจุด (Admin/Editor) |
| Export | Excel (สรุป/จุด/ประวัติ) และ JPEG แผนผังพร้อมสถานะ |
| แจ้งเตือน | ส่งอีเมลพร้อมไฟล์แนบ (Resend) และ LINE OA (Messaging API) |
| QR | พิมพ์ A4 ทุกจุด/เฉพาะพื้นที่/เฉพาะ Public – สแกนแล้วเปิดหน้าจุดนั้น |
| สิทธิ์ | ล็อกอินอีเมล+รหัสผ่าน, บทบาท Admin / Editor / Viewer, Admin เพิ่มผู้ใช้และรีเซ็ตรหัสได้ |
| สาธารณะ | ติ๊ก Public ต่อจุด – ผู้ไม่ล็อกอินเห็นเฉพาะชื่อ/พื้นที่/สถานะ/รูป/วันที่ตรวจล่าสุด |

## โครงสร้าง
```
public/        เว็บ (index.html, config.js, รูปแผนผัง)
src/           Worker: worker.js (ตัวส่งต่อ), auth.js (ล็อกอิน), api.js (/api/* ต้องล็อกอิน), pub.js (/pub/data สาธารณะ)
lib/common.js  session, รหัสผ่าน (PBKDF2), ตัวช่วย
schema.sql     โครงสร้างฐานข้อมูล D1
migrations/    ตัวช่วยย้ายฐานข้อมูลรุ่นเก่า
wrangler.toml  ตั้งค่า Worker + Assets + D1
docs/M365.md   (ทางเลือก) วิธีใช้กับ Microsoft 365/SharePoint
```

## ติดตั้งบน Cloudflare (ทำครั้งเดียว ~15 นาที)

### 1) สร้างฐานข้อมูล D1
**Storage & Databases → D1 → Create database** ชื่อ `mousetrap` → แท็บ **Console** วางเนื้อหา `schema.sql` แล้ว Execute
คัดลอก **Database ID** ใส่ใน `wrangler.toml` (`database_id`) แล้ว commit
> เคยรัน `schema.sql` รุ่นเก่าไปแล้ว? ให้รัน `migrations/002_own_login.sql` เพิ่มอีกหนึ่งไฟล์ (สร้างตารางผู้ใช้ใหม่ ซึ่งยังว่างอยู่)

### 2) สร้างโปรเจกต์จาก GitHub
**Workers & Pages → Create application → Import a repository** → เลือก `Mousetrap_SML` (branch `main`)
- Build command: เว้นว่าง · Deploy command: `npx wrangler deploy` (ค่าเริ่มต้น)
- ชื่อโปรเจกต์ต้องตรงกับ `name` ใน `wrangler.toml` (`mousetrap-sml`)
- หลัง deploy ได้ URL `mousetrap-sml.<บัญชี>.workers.dev` (ผูกโดเมนบริษัทได้ที่แท็บ Domains)

### 3) ตั้งตัวแปร (Settings → Variables and Secrets)

| ชื่อ | ชนิด | ค่า |
|---|---|---|
| `SESSION_SECRET` | **Secret** | ข้อความสุ่มยาว 32 ตัวอักษรขึ้นไป (ใช้เซ็น Cookie – ห้ามเปิดเผย) |
| `BOOTSTRAP_ADMINS` | Text | อีเมล Admin คนแรก (คั่นหลายคนด้วย `,`) |
| `BOOTSTRAP_PASSWORD` | **Secret** | รหัสผ่านชั่วคราวสำหรับเข้าครั้งแรก (ระบบบังคับให้เปลี่ยนทันที) |
| `RESEND_API_KEY`, `MAIL_FROM` | Secret / Text | *(ไม่บังคับ)* ส่งอีเมลจากระบบ – สมัคร resend.com และยืนยันโดเมนผู้ส่ง |
| `LINE_TOKEN`, `LINE_TO` | Secret / Text | *(ไม่บังคับ)* Channel access token ของ LINE OA และ userId/groupId ปลายทาง |

ตัวอย่างสร้าง `SESSION_SECRET` (รันในเครื่อง): `openssl rand -base64 32`
ตัวแปรไม่หายเมื่อ deploy ใหม่ (`keep_vars = true`)

### 4) เริ่มใช้งาน
1. เปิดเว็บ → ล็อกอินด้วยอีเมลใน `BOOTSTRAP_ADMINS` + `BOOTSTRAP_PASSWORD` → ตั้งรหัสผ่านใหม่ของตัวเอง
2. ระบบสร้างแผนผัง 2 พื้นที่และจุด 31 จุดให้อัตโนมัติ (ครั้งแรก)
3. เมนู **ผู้ใช้งาน** → เพิ่มอีเมลพนักงาน/คนนอก เลือกสิทธิ์ → ระบบสร้าง **รหัสผ่านชั่วคราว** ให้ (แสดงครั้งเดียว) แจ้งผู้ใช้เอง
   ผู้ใช้เข้าครั้งแรกจะถูกบังคับเปลี่ยนรหัส · ลืมรหัส → Admin กด “รีเซ็ตรหัส”
4. เมนู **พิมพ์ QR** → ติดที่หน้างาน

เมื่อ Admin คนแรกตั้งรหัสแล้ว แนะนำให้ลบ `BOOTSTRAP_PASSWORD` ออก

## ความปลอดภัย
- รหัสผ่านเก็บเป็น PBKDF2-SHA256 (100,000 รอบ + salt) ไม่เก็บรหัสจริง
- Session = Cookie `HttpOnly` + `SameSite=Lax` (+`Secure` บน https) เซ็นด้วย HMAC หมดอายุ 12 ชั่วโมง
- พิมพ์รหัสผิดครบ 5 ครั้ง ล็อกบัญชีนั้น 15 นาที · ปฏิเสธคำขอแก้ไขที่มาจากเว็บอื่น (กัน CSRF)
- สิทธิ์ถูกตรวจฝั่งเซิร์ฟเวอร์ทุกคำขอ (Viewer แก้ไขข้อมูลไม่ได้แม้เรียก API ตรง)
- ผู้ใช้ภายนอกใช้ได้เหมือนพนักงาน เพียงให้ Admin เพิ่มอีเมลของเขา

## ทดสอบในเครื่อง
```bash
npm i -D wrangler
npx wrangler d1 execute mousetrap --local --file schema.sql
npx wrangler dev --var SESSION_SECRET:dev-secret-change-me-0123456789 --var BOOTSTRAP_ADMINS:you@example.com --var BOOTSTRAP_PASSWORD:Start-1234
```
ทางลัดข้ามล็อกอิน: `--var DEV_EMAIL:you@example.com` (**ห้ามตั้งบน Production**)
เปิด `public/index.html` ตรงๆ (file://) จะเข้าโหมดทดลอง เก็บข้อมูลในเบราว์เซอร์

## ข้อควรทราบ
- **รูปแผนผังเริ่มต้นเป็นไฟล์สาธารณะ**: `layouts-data.js` และ `layouts/` เปิดอ่านได้โดยไม่ล็อกอิน (เพื่อให้หน้า Public ทำงาน) – หากเป็นข้อมูลอ่อนไหว ให้ย้ายภาพไปเก็บใน D1 ผ่านเมนู “จัดการพื้นที่” แล้วลบไฟล์ออกจาก repo
- รูปถ่ายถูกย่อ (~900px) เก็บใน D1 แถวละไม่เกิน ~2MB; ถ้ามีรูปจำนวนมากควรย้ายไป R2
- รูปที่ใช้เป็นแผนผังมีวงรีเหลืองฝังอยู่ในภาพ ระบบวางจุดทับให้พอดี – ใช้ภาพที่ไม่มีวงรีจะสะอาดกว่า
- LINE Notify ปิดบริการแล้ว (31 มี.ค. 2568) ระบบใช้ LINE Messaging API แทน
- ใช้กับ Microsoft 365/SharePoint ได้ด้วย: ตั้ง `backend: ""` และใส่ `clientId` ใน `config.js` (ดู `docs/M365.md`)
