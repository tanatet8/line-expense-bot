# 🚀 LINE Expense Bot — Quick Start (5 นาที)

## 1) สิ่งที่ต้องมี
- Supabase Project (Project URL + Service Role Key)
- Cloudflare Worker Account
- LINE Messaging API Channel (Access Token + Secret)

---

## 2) ตั้งค่า Supabase
1. Supabase → SQL Editor → Run:
   ```sql
   create table if not exists public.ledger_entries (
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
3) ตั้งค่า Cloudflare Worker
Create Worker → Settings → Variables:

ini
คัดลอกโค้ด
SUPABASE_URL = https://<project>.supabase.co
SERVICE_ROLE_KEY = <service_role_key>
LINE_CHANNEL_ACCESS_TOKEN = <token>
LINE_CHANNEL_SECRET = <secret>
Quick Edit → วางโค้ด src/worker.js

Save & Deploy

4) ตั้งค่า LINE
LINE Developer Console → Webhook URL = https://<worker>.workers.dev

Verify → Success

เปิด Use Webhook = Enabled

5) ทดสอบ
ใน LINE DM: กาแฟ 95 บาท เมื่อวาน

ใน Group: !co: กาแฟ 95 บาท เมื่อวาน

ตรวจผลที่ Supabase Table Editor → ledger_entries

✅ เสร็จแล้ว ใช้งานได้ทันที!

yaml
คัดลอกโค้ด

---

## `/docs/CHANGELOG.md`

```markdown
# 📜 CHANGELOG — LINE Expense Bot

## [2025-09-09]
### Added
- Initial release of Supabase schema: `ledger_entries`
- Cloudflare Worker integration
- LINE command prefix `!co:`
- Dictionary rules for:
  - Food (Yayoi, Starbucks)
  - Transport (BTS, MRT, Taxi, Motorbike)
  - Entertainment (Steam/Stream, Games)
  - Medical (หมอฟัน, ค่ายา Natear)
  - Misc

### Fixed
- Prevent duplicate records with `on_conflict=message_id`
- Normalize Thai/English spelling variations (e.g. แท็กซี่/แท๊กซี่, Stream/Steam)

---

## [2025-09-10] (Planned)
- Add category `equipment`
- Add category `gift`
- Extend dictionary with Shopee/Lazada
- Prepare migration guide to Supabase Edge Functions
