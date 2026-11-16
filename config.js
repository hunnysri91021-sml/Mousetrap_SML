// ===== ตั้งค่าระบบ Mousetrap Monitoring =====
// เว้น clientId ว่าง = โหมดทดลอง (Demo) เก็บข้อมูลในเบราว์เซอร์เครื่องนี้เท่านั้น
window.MT_CONFIG = {
  company: "บริษัท ตัวอย่าง จำกัด",

  // --- Microsoft 365 (Entra ID App Registration) ---
  clientId: "",            // Application (client) ID
  tenantId: "",            // Directory (tenant) ID -> ล็อกให้เฉพาะผู้ใช้ในองค์กรเข้าสู่ระบบได้
  spHost: "",              // เช่น contoso.sharepoint.com
  spPath: "",              // เช่น /sites/Facility
  bootstrapAdmins: [],     // อีเมล Admin คนแรก เช่น ["hr.admin@contoso.com"]

  // --- ส่วนสาธารณะ (ไม่ต้อง Login) ---
  publicApiUrl: "",        // URL Power Automate (HTTP Request) คืนเฉพาะจุดที่เปิด Public
  publicBaseUrl: "",       // URL เว็บจริง ใช้สร้าง QR (ว่าง = ใช้ URL ปัจจุบัน)

  // --- แจ้งเตือน ---
  lineWebhookUrl: "",      // URL Power Automate -> LINE Official Account (Messaging API)
  defaultMailTo: ""        // อีเมลผู้รับเริ่มต้น คั่นด้วย ;
};
