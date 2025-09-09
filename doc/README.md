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
