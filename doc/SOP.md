# 📝 คู่มือติดตั้ง LINE Expense Bot (สำหรับผู้ไม่ใช่นักพัฒนา)

## 🎯 ภาพรวม
บอทนี้จะช่วยบันทึกค่าใช้จ่ายผ่าน LINE โดยใช้คำสั่ง `!co: กาแฟ 95 บาท เมื่อวาน` แล้วเก็บข้อมูลลงฐานข้อมูล Supabase

---

## 1️⃣ เตรียมความพร้อม

### บัญชีที่ต้องมี:
- 🗂️ **Supabase** → [https://supabase.com](https://supabase.com)
- ☁️ **Cloudflare** → [https://dash.cloudflare.com](https://dash.cloudflare.com)
- 💬 **LINE Developer Console** → [https://developers.line.biz/console](https://developers.line.biz/console)
- 🔧 **Postman** (แนะนำใช้ Desktop App)

### ข้อความทดสอบ:
```
!co: กาแฟ 95 บาท เมื่อวาน
```

---

## 2️⃣ ตั้งค่า Supabase

### 2.1 สร้างโปรเจกต์
1. เข้า Supabase → คลิก **New Project**
2. ตั้งชื่อ (เช่น `line-expense`) และตั้งรหัสผ่าน
3. **จดข้อมูลสำคัญ 2 อย่างนี้:**
   - **Project URL** (เช่น `https://xxxxx.supabase.co`)
   - **Service Role Key**

> ⚠️ **สำคัญ:** Project URL ต้องก๊อปจาก Settings เท่านั้น ห้ามพิมพ์เอง

### 2.2 สร้างตารางเก็บข้อมูล
1. ไปที่ **SQL Editor**
2. วางโค้ดนี้แล้วกด **Run:**

```sql
create extension if not exists pgcrypto;

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,
  line_user_id text,
  kind text default 'expense',
  amount numeric(12,2),
  currency text default 'THB',
  category text,
  account text,
  merchant text,
  note text,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  source text default 'line',
  status text default 'ok',
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_le_user_time on public.ledger_entries(line_user_id, occurred_at desc);
alter table public.ledger_entries enable row level security;
```

3. กด **Refresh** → จะเห็นตาราง `ledger_entries`

### 2.3 ทดสอบด้วย Postman
1. เปิด Postman → **New Request** → Method = **POST**
2. **URL:**
   ```
   https://<PROJECT>.supabase.co/rest/v1/ledger_entries?on_conflict=message_id
   ```

3. **Headers:**
   ```
   apikey: <SERVICE_ROLE_KEY>
   Authorization: Bearer <SERVICE_ROLE_KEY>
   Content-Type: application/json
   Prefer: resolution=merge-duplicates,return=representation
   ```

4. **Body (raw JSON):**
   ```json
   [{
     "message_id": "postman-001",
     "line_user_id": "Udebug",
     "raw_text": "insert via postman",
     "amount": 100,
     "occurred_at": "2025-09-09T00:00:00Z",
     "recorded_at": "2025-09-09T00:00:00Z",
     "source": "line",
     "status": "ok"
   }]
   ```

5. กด **Send** → ถ้าสำเร็จจะได้ **201 Created** และเห็นข้อมูลใน Table Editor

#### 🚨 Error ที่พบบ่อย:
- **404** = URL ผิด
- **403** = Key ผิด
- **ENOTFOUND** = Project URL สะกดผิด

---

## 3️⃣ ตั้งค่า Cloudflare Worker

### 3.1 สร้าง Worker
1. ไป Cloudflare Dashboard → **Workers & Pages** → **Create Application** → **Create Worker**
2. ตั้งชื่อ เช่น `line-expense-worker`

### 3.2 ใส่ Environment Variables
1. ไปที่ **Settings** → **Variables & Secrets** → เพิ่ม:
   ```
   SUPABASE_URL = https://<project>.supabase.co
   SERVICE_ROLE_KEY = Service Role Key
   LINE_CHANNEL_ACCESS_TOKEN = Token จาก LINE Developer
   LINE_CHANNEL_SECRET = Secret จาก LINE Developer
   ```

### 3.3 อัปโหลดโค้ด Worker
1. เปิด **Quick Edit**
2. วางโค้ด `worker.js` (เวอร์ชันที่มี Dictionary พร้อมใช้)
3. กด **Save & Deploy**

### 3.4 เชื่อมกับ LINE
1. ไป LINE Developer Console → **Messaging API** → **Webhook URL**
2. ใส่ URL ของ Worker (เช่น `https://<worker>.workers.dev`)
3. กด **Verify** → ต้องขึ้น **Success**
4. เปิด **Use webhook** = **Enabled**

---

## 4️⃣ ทดสอบ End-to-End

1. เข้ากลุ่ม LINE ที่เพิ่ม Bot
2. พิมพ์: `!co: กาแฟ 95 บาท เมื่อวาน`
3. บอทต้องตอบกลับ: "บันทึกแล้ว: 95 บาท …"
4. ไปดูใน Supabase → **Table Editor** → จะเห็นข้อมูลเพิ่มเข้ามา

---

## 8️⃣ ปรับแต่ง Dictionary (เปลี่ยนร้าน/หมวดหมู่)

### 8.1 เปิดแก้ไขโค้ด
1. **Cloudflare** → **Workers & Pages** → เลือก Worker → **Quick Edit**

[Screenshot: Quick Edit interface ที่เปิด worker.js]

### 8.2 หา Dictionary Section
1. กดค้นหา `ALIAS_RULES` หรือ `CATEGORY_PREFIX`
2. จะเห็นโครงสร้างแบบนี้:

```javascript
const ALIAS_RULES = [
  { kw: /ยาโยอิ|yayoi/i, category:'food', merchant:'Yayoi' },
  { kw: /สตาร์บัค|starbucks/i, category:'food', merchant:'Starbucks' },
  // เพิ่มที่นี่
];
```

### 8.3 เพิ่มร้าน/หมวดใหม่
**ตัวอย่างการเพิ่ม:**
```javascript
{ kw: /แมค|mcdonald/i, category:'food', merchant:'McDonalds' },
{ kw: /ปตท|ptt/i, category:'fuel', merchant:'PTT' },
{ kw: /ร้านหนังสือ/i, category:'education', merchant:'Bookstore' },
```

### 8.4 Deploy การเปลี่ยนแปลง
1. คลิก **Save and deploy**
2. รอสักครู่ → ทดสอบใหม่

**✅ เกณฑ์สำเร็จ:** ส่งข้อความใหม่แล้วระบบจัดหมวดหมู่ได้ถูกต้อง

[Screenshot: ตัวอย่างข้อมูลใน Table Editor ที่แสดงหมวดหมู่ใหม่]

---

## 9️⃣ ทำความสะอาดข้อมูลทดสอบ

### 9.1 ผ่าน UI (ง่าย)
1. **Supabase** → **Table Editor** → **ledger_entries**
2. **Filter** → พิมพ์ `raw_text ilike %test%`
3. เลือกแถวที่ต้องการลบ → คลิก **Delete**

[Screenshot: Table Editor พร้อม Filter และปุ่ม Delete]

### 9.2 ผ่าน SQL (ลบหมด)
1. **SQL Editor** → **New query**
2. วางโค้ด:
```sql
delete from public.ledger_entries
where raw_text ilike '%test%' or raw_text ilike '%postman%';
```
3. คลิก **Run**

**✅ เกณฑ์สำเร็จ:** ข้อมูลทดสอบถูกลบออกจากตาราง---

## 🔟 ย้ายไป Supabase Edge Functions (แผนอนาคต)

### 10.1 เตรียม CLI
1. ติดตั้ง Node.js (ถ้ายังไม่มี)
2. เปิด Terminal/Command Prompt
3. รันคำสั่ง:
```bash
npm install -g supabase
supabase login
```

[Screenshot: Terminal แสดงการติดตั้ง Supabase CLI]

### 10.2 สร้างฟังก์ชัน
1. ใน Terminal:
```bash
supabase functions new line-expense
```
2. จะได้โฟลเดอร์ `supabase/functions/line-expense/index.ts`

### 10.3 ย้ายโค้ดจาก Worker → Function
1. เปิดไฟล์ `index.ts`
2. นำ logic พาร์ส/insert เดิมจาก Worker ไปใส่ใน Deno handler
3. ปรับ syntax เล็กน้อย (fetch API ใช้ได้เหมือนเดิม)

### 10.4 ตั้ง Secrets
```bash
supabase secrets set \
  SUPABASE_URL=https://<project>.supabase.co \
  SERVICE_ROLE_KEY=<key> \
  LINE_CHANNEL_ACCESS_TOKEN=<token> \
  LINE_CHANNEL_SECRET=<secret>
```

### 10.5 Deploy
```bash
supabase functions deploy line-expense
```

จะได้ URL: `https://<project>.functions.supabase.co/line-expense`

### 10.6 อัปเดต Webhook URL
1. นำ URL ใหม่ไปตั้งใน **LINE Developer Console**
2. ทดสอบ Verify → Success

**✅ ข้อดี Edge Functions:**
- Latency ต่ำกว่า Cloudflare
- Logs รวมกับ Supabase
- จัดการง่ายกว่า

---

## 1️⃣1️⃣ Troubleshooting ฉบับเร็ว

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| 🔴 **LINE Verify Failed** | Worker URL ผิด/Worker offline | เช็ค Worker Status และ URL |
| 🔴 **Cloudflare 404/PGRST125** | Path Supabase ผิด | ต้องโพสต์ที่ `/rest/v1/ledger_entries` |
| 🔴 **403 Forbidden** | ใช้ anon key/key หมดอายุ | ใช้ Service Role Key ที่ถูกต้อง |
| 🔴 **บอทตอบแต่ไม่เข้า DB** | Database connection ผิด | ดู Cloudflare Logs หา PostgREST error |
| 🔴 **ข้อความในกลุ่มเงียบ** | ลืมใส่ `!co:` | ต้องขึ้นต้นด้วย `!co:` ในกลุ่ม |
| 🔴 **amount = null** | Bot parse ราคาไม่ออก | ต้องมีตัวเลขชัดเจนในข้อความ |
| 🔴 **duplicate error** | ส่งข้อความซ้ำ | ปกติ - ป้องกัน duplicate record |

### วิธีดู Logs เพื่อ Debug:
1. **Cloudflare** → **Workers & Pages** → Worker → **Logs**
2. ส่งข้อความทดสอบ → ดู Error ที่เกิดขึ้น
3. หา Error Code และแก้ตามตารางข้างบน

---

## 📦 โครงสร้าง Project ที่แนะนำ

### สำหรับ Cloudflare Worker:
```
line-copilot-ledger/
├── src/
│   ├── worker.js          # โค้ดหลัก + Dictionary
│   └── dict.js           # (ทางเลือก) แยก Dictionary
├── config/
│   ├── .env.example      # ตัวอย่างตัวแปร Environment
│   └── wrangler.toml     # Cloudflare config (ถ้าใช้ CLI)
├── docs/
│   ├── SOP.md            # เอกสารนี้
│   ├── README.md         # วิธีติดตั้งแบบสั้น 5 นาที
│   └── CHANGELOG.md      # บันทึกการอัปเดต
└── tests/
    └── postman/
        └── LINE-Expense.postman_collection.json
```

### สำหรับ Supabase Edge Functions:
```
line-copilot-ledger/
├── supabase/
│   ├── functions/
│   │   └── line-expense/
│   │       ├── index.ts       # Function หลัก
│   │       ├── deno.json      # Deno config
│   │       └── dict.ts        # Dictionary module
│   ├── migrations/
│   │   └── 001_create_ledger.sql  # สคริปต์สร้างตาราง
│   └── config.toml            # Supabase config
├── docs/
│   └── ... (เหมือนข้างบน)
└── src/
    └── legacy-worker.js       # Worker เก่า (สำรองไว้)
```

### ไฟล์ `.env.example`:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your-service-role-key

# LINE
LINE_CHANNEL_ACCESS_TOKEN=your-access-token
LINE_CHANNEL_SECRET=your-channel-secret

# Cloudflare (ถ้าใช้)
WORKER_URL=https://your-worker.workers.dev
```

### สคริปต์ Package.json (ทางเลือก):
```json
{
  "name": "line-expense-bot",
  "version": "1.0.0",
  "scripts": {
    "dev": "supabase functions serve",
    "deploy": "supabase functions deploy line-expense",
    "test": "deno test --allow-all",
    "setup": "supabase start && supabase db reset"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

### 📂 ตำแหน่งไฟล์สุดท้าย:
```
line-copilot-ledger/
├── src/
│   └── worker.js                    # ✅ ตัวจริงที่ deploy
├── docs/
│   ├── SOP.md                       # ✅ เอกสารฉบับนี้
│   ├── README.md                    # ✅ ฉบับย่อ 5 นาที
│   └── CHANGELOG.md                 # ✅ บันทึก Dict/โค้ด
├── tests/
│   └── postman/
│       ├── LINE-Expense.postman_collection.json     # ✅ Import ได้ทันที
│       └── LINE-Expense.postman_environment.json    # ✅ ตัวแปรพร้อมใช้
└── config/
    └── .env.example                 # ✅ Template สำหรับทีม
```

---

## ✅ สรุป

เมื่อทำตามขั้นตอนครบแล้ว คุณจะได้บอท LINE ที่:

### 🎯 **ความสามารถหลัก:**
- บันทึกค่าใช้จ่ายอัตโนมัติผ่าน LINE
- จัดหมวดหมู่ตามร้านค้า (ปรับแต่งได้)
- เก็บข้อมูลใน Supabase Database
- ใช้งานได้ทั้งแชทส่วนตัวและกลุ่ม

### 💬 **วิธีใช้งาน:**
- **แชทส่วนตัว:** `กาแฟ 95 บาท เมื่อวาน`
- **ในกลุ่ม:** `!co: กาแฟ 95 บาท เมื่อวาน`

### 🔧 **การดูแลรักษา:**
- แก้ Dictionary ใน Cloudflare Worker → Deploy ใหม่
- ดูข้อมูลใน Supabase Table Editor
- อัปเกรดเป็น Edge Functions เมื่อพร้อม

### 🚀 **ขั้นตอนถัดไป:**
1. สำรองข้อมูล Dictionary
2. เพิ่มฟีเจอร์ส่งออกข้อมูล (CSV/Excel)
3. ย้ายไป Supabase Edge Functions
4. เพิ่มการวิเคราะห์รายจ่าย

**🎉 ขอแสดงความยินดี! บอท LINE Expense ของคุณพร้อมใช้งานแล้ว**

---

*📝 หมายเหตุ: เอกสารนี้อัปเดตล่าสุด กันยายน 2025 - หากมีปัญหาหรือข้อสงสัย สามารถดู Logs ใน Cloudflare หรือ Supabase เพื่อ Debug ได้*
