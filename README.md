# Mousetrap Monitoring (SML)

ระบบติดตามจุดติดตั้งกรงดักหนูบนแผนผังพื้นที่จริง (พื้นที่ 1 = จุด 1–23, พื้นที่ 2 = จุด 24–32 ตามไฟล์ Mousetrap.pptx)
ทำงานบน **GitHub + Cloudflare Pages + D1 + Access** – ไม่ต้องมี Microsoft 365 ใครมีอีเมลก็ใช้ได้ (ได้รับอนุญาตแล้วเท่านั้น)

| ฟีเจอร์ | รายละเอียด |
|---|---|
| คลิกจุด | เปิดรูป สถานะ QR ประวัติ และฟอร์มบันทึกผลตรวจ (ถ่ายรูปจากมือถือได้) |
| เพิ่ม/ลด | เพิ่ม-ลบพื้นที่ (แผนผัง) และจุด, ลากย้ายจุด (Admin/Editor) |
| Export | Excel (สรุป/จุด/ประวัติ) และ JPEG แผนผังพร้อมสถานะ |
| แจ้งเตือน | ส่งอีเมลพร้อมไฟล์แนบ (Resend) และ LINE OA (Messaging API) |
| QR | พิมพ์ A4 ทุกจุด/เฉพาะพื้นที่/เฉพาะ Public – สแกนแล้วเปิดหน้าจุดนั้น |
| สิทธิ์ | Cloudflare Access (OTP ทางอีเมล) + บทบาท Admin / Editor / Viewer ในระบบ |
| สาธารณะ | ติ๊ก Public ต่อจุด – ผู้ไม่ล็อกอินเห็นเฉพาะชื่อ/พื้นที่/สถานะ/รูป/วันที่ตรวจล่าสุด |

## โครงสร้าง
```
public/        เว็บ (index.html, config.js, รูปแผนผัง)
functions/     API  (/api/* ต้องล็อกอิน · /pub/data สาธารณะ · /login)
lib/common.js  ตรวจสิทธิ์ (verify JWT ของ Access) + ตัวช่วย
schema.sql     โครงสร้างฐานข้อมูล D1
wrangler.toml  ตั้งค่า Pages + D1
docs/M365.md   (ทางเลือก) วิธีใช้กับ Microsoft 365/SharePoint
```

## ติดตั้งบน Cloudflare (ทำครั้งเดียว ~20 นาที)

### 1) สร้างโปรเจกต์ Pages จาก GitHub
Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → เลือก repo `Mousetrap_SML`
- Production branch: `main` (ถ้ายังทดสอบ ใช้ `add-mousetrap-system`)
- Framework preset: *None* · Build command: *(ว่าง)* · **Build output directory: `public`**

### 2) สร้างฐานข้อมูล D1
**Storage & Databases → D1 → Create database** ชื่อ `mousetrap` → แท็บ **Console** วางเนื้อหา `schema.sql` แล้ว Execute
กลับไปที่โปรเจกต์ Pages → **Settings → Bindings → Add → D1 database** ตั้ง Variable name = `DB` เลือก `mousetrap`

### 3) ตั้งค่า Cloudflare Access (ตัวควบคุมผู้เข้าใช้)
**Zero Trust → Settings → Authentication → Login methods**: เปิด **One-time PIN**
**Zero Trust → Access → Applications → Add → Self-hosted**
- Application domain = โดเมนของโปรเจกต์ (เช่น `mousetrap-sml.pages.dev` หรือโดเมนบริษัท) เพิ่ม 2 path: `api` และ `login`
  (หน้าเว็บหลัก และ `/pub/data` ต้อง **ไม่** ถูกป้องกัน เพื่อให้ QR สาธารณะใช้ได้)
- Policy: Allow → Include: *Emails* (รายชื่ออีเมลพนักงาน/คนนอกที่อนุญาต) หรือ *Email domain* ของบริษัท
- เก็บค่า **Application Audience (AUD) Tag** และ **Team domain** (`xxxx.cloudflareaccess.com`)

> แผนฟรีของ Access รองรับผู้ใช้ 50 คน หากเกินต้องใช้แผนเสียเงิน

### 4) ตั้งตัวแปร
โปรเจกต์ Pages → **Settings → Variables and Secrets** (Production)

| ชื่อ | ค่า |
|---|---|
| `TEAM_DOMAIN` | `xxxx.cloudflareaccess.com` |
| `POLICY_AUD` | AUD Tag จากข้อ 3 |
| `BOOTSTRAP_ADMINS` | อีเมล Admin คนแรก (คั่นหลายคนด้วย `,`) |
| `RESEND_API_KEY`, `MAIL_FROM` | *(ไม่บังคับ)* ส่งอีเมลจากระบบ – สมัคร resend.com และยืนยันโดเมนผู้ส่ง |
| `LINE_TOKEN`, `LINE_TO` | *(ไม่บังคับ)* Channel access token ของ LINE OA และ userId/groupId ปลายทาง |

แล้ว **Deployments → Retry deployment** ให้ตัวแปรมีผล

### 5) เริ่มใช้งาน
1. เปิดเว็บ → กด “เข้าสู่ระบบด้วยอีเมล” → กรอกอีเมล Admin → รับรหัส OTP
2. ระบบสร้างแผนผัง 2 พื้นที่และจุด 31 จุดให้อัตโนมัติ (ครั้งแรก)
3. เมนู **ผู้ใช้งาน** → เพิ่มอีเมลพนักงาน/คนนอก กำหนดสิทธิ์ Admin / Editor / Viewer
   (ต้องอยู่ทั้งในรายชื่อ Access *และ* รายชื่อในระบบ – ผู้ที่ไม่มีชื่อในระบบจะเห็นข้อความ “ยังไม่ได้รับอนุญาต”)
4. เมนู **พิมพ์ QR** → ติดที่หน้างาน

## ทดสอบในเครื่อง
```bash
npm i -D wrangler
npx wrangler d1 execute mousetrap --local --file schema.sql
npx wrangler pages dev public -b DEV_EMAIL=you@example.com -b BOOTSTRAP_ADMINS=you@example.com
```
`DEV_EMAIL` ข้ามการตรวจ Access – **ห้ามตั้งบน Production**
เปิด `public/index.html` ตรงๆ (file://) จะเข้าโหมดทดลอง เก็บข้อมูลในเบราว์เซอร์

## ข้อควรทราบ
- **รูปแผนผังเริ่มต้นเป็นไฟล์สาธารณะ**: `layouts-data.js` และ `layouts/` เปิดอ่านได้โดยไม่ล็อกอิน (เพื่อให้หน้า Public ทำงาน) – หากเป็นข้อมูลอ่อนไหว ให้ย้ายภาพไปเก็บใน D1 ผ่านเมนู “จัดการพื้นที่” แล้วลบไฟล์ออกจาก repo
- รูปถ่ายถูกย่อ (~900px) เก็บใน D1 แถวละไม่เกิน ~2MB; ถ้ามีรูปจำนวนมากควรย้ายไป R2
- รูปที่ใช้เป็นแผนผังมีวงรีเหลืองฝังอยู่ในภาพ ระบบวางจุดทับให้พอดี – ใช้ภาพที่ไม่มีวงรีจะสะอาดกว่า
- LINE Notify ปิดบริการแล้ว (31 มี.ค. 2568) ระบบใช้ LINE Messaging API แทน
- ใช้กับ Microsoft 365/SharePoint ได้ด้วย: ตั้ง `backend: ""` และใส่ `clientId` ใน `config.js` (ดู `docs/M365.md`)
