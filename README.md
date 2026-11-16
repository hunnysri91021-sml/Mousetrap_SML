# Mousetrap Monitoring – คู่มือติดตั้ง

เว็บติดตามจุดติดตั้งกรงดักหนู (Layout ตามไฟล์ Mousetrap.pptx: พื้นที่ 1 = จุด 1–23, พื้นที่ 2 = จุด 24–32)

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | ตัวระบบทั้งหมด (ไฟล์เดียว) |
| `config.js` | ตั้งค่า M365 / Public / LINE / อีเมล |
| `layouts-data.js`, `layouts/` | รูปแผนผังเริ่มต้นจากเอกสาร |

## 1) ลองใช้งานทันที (Demo)
เปิด `index.html` → เลือกสิทธิ์ Admin / Editor / Viewer (ข้อมูลเก็บในเบราว์เซอร์เครื่องนั้น)

## 2) ใช้งานจริงกับ Microsoft 365
1. นำโฟลเดอร์นี้ขึ้นเว็บที่เป็น **https** (Azure Static Web Apps, IIS ภายใน, หรือ SharePoint Site Pages) – แนะนำ Azure Static Web Apps
2. **Entra ID → App registrations → New registration**
   - Supported account types: *Accounts in this organizational directory only* (ล็อกเฉพาะคนในบริษัท)
   - Redirect URI: ชนิด **Single-page application (SPA)** = URL เว็บของคุณ
   - API permissions (Delegated): `User.Read`, `Sites.ReadWrite.All`, `Mail.Send` → Grant admin consent
   - การติดตั้งครั้งแรกต้องใช้ `Sites.Manage.All` เพิ่ม (ระบบขอ consent เมื่อกดปุ่มติดตั้ง)
3. สร้าง SharePoint Site (เช่น `/sites/Facility`) แล้วใส่ค่าใน `config.js`: `clientId`, `tenantId`, `spHost`, `spPath`, `bootstrapAdmins`
4. เข้าเว็บด้วยบัญชี Admin → ระบบจะแสดงหน้า **“ติดตั้งระบบครั้งแรก”** กดปุ่มเดียว ระบบสร้าง List ให้ครบ:
   `MT_Stations`, `MT_Inspections`, `MT_Users`, `MT_Layouts` พร้อมแผนผังและจุด 31 จุดตามเอกสาร

## 3) สิทธิ์การใช้งาน (จำกัดผู้เข้าใช้)
- ด่านที่ 1: Entra ID – เฉพาะบัญชีในองค์กร
- ด่านที่ 2: ต้องมีชื่ออยู่ใน List `MT_Users` (เมนู “ผู้ใช้งาน” ในระบบ)
  - **Admin** ทุกอย่าง · **Editor** บันทึกผลตรวจ/แก้ไข/ย้ายจุด · **Viewer** ดูและ Export
- ผู้ไม่มีชื่อ = เข้าไม่ได้ (เห็นเฉพาะหน้า Public)

## 3.1) ให้คนนอก/พนักงานที่ไม่มี M365 ใช้งาน (แนะนำ: Entra B2B Guest)
ไม่ต้องซื้อไลเซนส์ M365 เพิ่ม – ผู้ใช้ภายนอกใช้อีเมลใดก็ได้ (Gmail, Hotmail, อีเมลบริษัทอื่น) รับรหัส OTP ทางอีเมลเพื่อเข้าสู่ระบบ
1. Entra admin center → **Users → Invite external user** ใส่อีเมล (ทำทีละคนหรือ Bulk invite CSV)
   - ตรวจ *External collaboration settings* ว่าอนุญาตเชิญ และเปิด *Email one-time passcode*
2. SharePoint Site `MT` → Share/Site permissions → เพิ่ม Guest เป็น **Members** (บันทึกผลตรวจ) หรือ **Visitors** (ดูอย่างเดียว)
3. ในเมนู “ผู้ใช้งาน” ของระบบ เพิ่มอีเมลจริงของคนนอกพร้อมสิทธิ์ Admin/Editor/Viewer
4. ใน `config.js` ตั้ง `tenantId` เป็น Tenant ID ของบริษัท (ห้ามใช้ `common`) เพื่อให้ Guest ที่ถูกเชิญเท่านั้นเข้าได้
- ข้อจำกัดของ Guest: ไม่มีกล่องจดหมายองค์กร → ปุ่มส่งอีเมลจะเปิดโปรแกรมอีเมลในเครื่องแทน (Excel/JPEG ให้ดาวน์โหลดแนบเอง)
- ถ้าไม่อยากเชิญเป็น Guest: ให้ติ๊ก “Public” เฉพาะจุดที่ต้องการ แล้วแจก QR (ดูแบบไม่ต้อง Login ได้ แต่บันทึกผลตรวจไม่ได้)

## 4) เปิดบางส่วนให้สาธารณะ
ติ๊ก “เปิดเผยจุดนี้ต่อสาธารณะ” ในแต่ละจุด – คนสแกน QR โดยไม่ Login จะเห็นเฉพาะ ชื่อ/พื้นที่/สถานะ/รูป/วันที่ตรวจล่าสุด (ไม่เห็นหมายเหตุ ผู้ตรวจ ประวัติ)
เพราะ Graph ต้อง Login เสมอ จึงใช้ **Power Automate** เป็นตัวกลาง:
1. Flow ใหม่ → trigger *When an HTTP request is received* (Who can trigger: Anyone)
2. *Get items* `MT_Stations` Filter Query: `IsPublic eq 1` และ *Get items* `MT_Layouts`
3. *Response* (200, Header `Access-Control-Allow-Origin: <URL เว็บ>`) Body:
```json
{"layouts":[{"id":"@{...LayoutId}","name":"...","url":"<URL รูปที่เข้าถึงสาธารณะได้>"}],
 "stations":[{"code":"Title","name":"StName","zone":"Zone","type":"StType","layoutId":"LayoutId","x":"PosX","y":"PosY","status":"StStatus","photo":"Photo"}]}
```
4. นำ URL ใส่ `publicApiUrl` ใน config.js (ถ้าไม่ระบุ `layouts` ระบบใช้รูปเริ่มต้นในเว็บ)

## 5) LINE
**LINE Notify ปิดบริการแล้ว (31 มี.ค. 2568)** ใช้ LINE Official Account (Messaging API) แทน:
Power Automate: trigger HTTP → *HTTP* POST `https://api.line.me/v2/bot/message/push` (Header `Authorization: Bearer <Channel access token>`, Body `{"to":"<groupId/userId>","messages":[{"type":"text","text":"@{triggerBody()?['text']}"}]}`) → ใส่ URL trigger ใน `lineWebhookUrl`
ระบบถามส่งอัตโนมัติเมื่อบันทึกผล “พบหนู” และมีปุ่มส่งสรุปรายวัน · ไม่ตั้งค่าก็ใช้ปุ่ม “เปิด LINE เพื่อแชร์” ได้

## 6) QR Code
เมนู “พิมพ์ QR” – พิมพ์ A4 2/3/4 คอลัมน์ (ทุกจุด/เฉพาะพื้นที่/เฉพาะ Public) QR ชี้ไป `…#/s/MT-05` ใช้เปิดหน้าจุดนั้นบนมือถือ + บันทึกผลตรวจ (ถ้า Login)

## 7) เปลี่ยน/เพิ่มแผนผัง
Admin: แท็บ “＋ เพิ่มพื้นที่” / “✎ จัดการพื้นที่นี้” (เปลี่ยนรูป ลบ) · “📍 เพิ่มจุด” คลิกบนแผนผัง · “✋ ย้ายตำแหน่งจุด” ลากวาง
หมายเหตุ: รูปจากเอกสารมีวงรีเหลืองฝังในภาพอยู่แล้ว ระบบวางจุดทับให้พอดี ถ้าใช้ภาพ Layout ที่ไม่มีวงรีเหลือง จะสะอาดกว่า

## ข้อควรทราบ
- Excel/QR/Microsoft Sign-in โหลดจาก CDN (cdnjs, alcdn) – ถ้าเครือข่ายบริษัทบล็อก ให้ดาวน์โหลดไฟล์ไลบรารีมาวางข้าง index.html แล้วแก้ `<script src>`
- รูปถ่ายจุด/ผลตรวจถูกย่อ (~900px) เก็บเป็นข้อความใน SharePoint List; ถ้ารูปมีจำนวนมากควรย้ายไป Document Library
- PDPA: ข้อมูลเป็นข้อมูลสถานที่ ไม่มีข้อมูลส่วนบุคคลยกเว้นชื่อผู้ตรวจ – ตั้งสิทธิ์ SharePoint Site ให้เหมาะสม
