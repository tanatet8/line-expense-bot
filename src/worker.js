// ============================
// worker.js (Full Version)
// ============================

// ===== Config =====
const TZ_OFFSET_MIN = 420; // +07:00 ไทย

// ===== DICTS (แก้ตรงนี้ทีเดียว) =====

// 1) เส้นทางเดินทาง (จับ จาก-ถึง)
const ROUTE_RULES = [
  { re: /(?:ค่าเดินทาง\s*)?BTS\s+(.+?)\s*[-–]\s*(.+)\b/i,
    category: 'transport', merchant: 'BTS', account: 'rabbit_card', noteTemplate: '$1 → $2' },
  { re: /(?:ค่าเดินทาง\s*)?MRT\s+(.+?)\s*[-–]\s*(.+)\b/i,
    category: 'transport', merchant: 'MRT', account: 'rabbit_card', noteTemplate: '$1 → $2' },
  { re: /(?:ค่าเดินทาง\s*)?(?:ค่า?แท[กก]ซี่|taxi)\s+(.+?)\s*[-–]\s*(.+)\b/i,
    category: 'transport', merchant: 'Taxi', account: 'bank_transfer', noteTemplate: '$1 → $2' },
  { re: /(?:ค่าเดินทาง\s*)?(?:ค่า?มอไซค์|วิน)\s+(.+?)\s*[-–]\s*(.+)\b/i,
    category: 'transport', merchant: 'Motorcycle', account: 'bank_transfer', noteTemplate: '$1 → $2' },
];

// 2) คำนำหน้าประเภท (prefix)
const CATEGORY_PREFIX = [
  { re: /^ค่าเดินทาง\b/i,      category: 'transport' },
  { re: /^ค่าอาหาร\b/i,        category: 'food',           takeParenthesisAs: 'merchant' },
  { re: /^ค่าขนม\b/i,          category: 'snack',          takeParenthesisAs: 'merchant' },
  { re: /^ค่าเกม\b/i,           category: 'entertainment',  takeParenthesisAs: 'merchant' },
  { re: /^ค่าบริการ\b/i,       category: 'service',        takeParenthesisAs: 'merchant' },
  { re: /^ค่าช้อปปิ้ง\b/i,      category: 'shopping',       takeParenthesisAs: 'merchant' },
  { re: /^ค่าสุขภาพ\b/i,        category: 'health_beauty',  takeParenthesisAs: 'merchant' },
  { re: /^ค่าหมอ\b/i,          category: 'medical',        takeParenthesisAs: 'merchant' },
  { re: /^ค่ายา\b/i,           category: 'medical',        takeParenthesisAs: 'merchant' },
  { re: /^ค่าอุปกรณ์\b/i,       category: 'equipment',      takeParenthesisAs: 'merchant' },
  { re: /^ค่า(?:ของ)?ขวัญ\b/i,  category: 'gift',           takeParenthesisAs: 'merchant' },
  { re: /^ค่า(?:เบ็ดเตล็ด|อื่นๆ|misc)\b/i, category: 'misc', takeParenthesisAs: 'merchant' },
];

// 3) แบรนด์/ร้าน/คำเฉพาะ (aliases/keywords)
const ALIAS_RULES = [
  // อาหาร/ขนม
  { kw: /ยาโยอิ|yayoi/i,               category:'food',           merchant:'Yayoi' },
  { kw: /mixue/i,                       category:'snack',          merchant:'Mixue' },
  { kw: /lotus\s*express/i,             category:'snack',          merchant:'Lotus Express' },
  { kw: /ข้าวมันไก่/i,                 category:'food',           merchant:'ข้าวมันไก่' },
  { kw: /ข้าวราดแกง/i,                 category:'food',           merchant:'ข้าวราดแกง' },

  // บันเทิง/เกม
  { kw: /steam|สตีม|สตรีม|สตีม์/i,     category:'entertainment',  merchant:'Steam' },
  { kw: /hollow\s*knight\s*silksong/i,  category:'entertainment',  merchant:'Steam' },

  // e-commerce
  { kw: /shopee/i,                      category:'shopping',       merchant:'Shopee' },
  { kw: /lazada|ลาซาด้า/i,             category:'shopping',       merchant:'Lazada' },
  { kw: /facebook|เฟส|fb|marketplace/i, category:'shopping',       merchant:'Facebook' },

  // สุขภาพ/ความงาม
  { kw: /ยาสีฟัน|ไหมขัดฟัน|ลิปมัน/i,  category:'health_beauty' },

  // การแพทย์
  { kw: /หมอฟัน|ขูดหินปูน/i,          category:'medical',        merchant:'หมอฟัน' },
  { kw: /ภูมิแพ้/i,                    category:'medical',        merchant:'หมอภูมิแพ้' },
  { kw: /น้ำตาเทียม|natear/i,          category:'medical',        merchant:'ยา/เวชภัณฑ์' },

  // gadget / equipment
  { kw: /logitech|เมาส์|คีย์บอร์ด|หูฟัง|ไมค์|webcam|c922/i, category:'gadget' },
  { kw: /pc|desktop|คอมพ์|คอมพิวเตอร์|จอ|monitor|โต๊ะทำงาน/i, category:'equipment' },

  // gift
  { kw: /ของขวัญ|กิฟต์|gift/i,        category:'gift' },
];

// 4) วิธีจ่าย (account hints)
const ACCOUNT_HINTS = [
  { kw: /โอน|พร้อม.?เพย์|scb|kbank|ktb|bbl|ttb|krungthai/i, account:'bank_transfer' },
  { kw: /บัตรเครดิต|เครดิต|visa|master/i,                   account:'credit_card' },
  { kw: /เงินสด|cash/i,                                      account:'cash' },
  { kw: /rabbit\s*card/i,                                     account:'rabbit_card' },
];

// ===== Helpers: time/number/text =====
const _localNow = (tzMin)=> new Date(Date.now() - (new Date().getTimezoneOffset()-tzMin)*60000);
const _startUTC = (d)=> new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function extractCommand(text, sourceType) {
  const t = (text || "").trim();
  if (t.startsWith("!co:")) return t.slice(4).trim(); // group: ต้องใส่ !co:
  if (sourceType === "user") return t;                 // 1–1: ไม่ต้องใส่ !co:
  return null;
}

function parseAmountSmart(text) {
  const matches = Array.from((text || "")
    .matchAll(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(บาท|บ[.]?)?/gi));
  if (!matches.length) return null;
  matches.sort((a, b) => ((b[2]?1:0)-(a[2]?1:0)) || ((b.index??0)-(a.index??0)));
  const raw = matches[0][1].replace(/,/g,"");
  const v = parseFloat(raw);
  return isFinite(v) ? Math.round(v*100)/100 : null;
}

// ===== Parse Date (Thai natural language) =====
const TH_WEEKDAY = {"อาทิตย์":0,"จันทร์":1,"อังคาร":2,"พุธ":3,"พฤหัส":4,"พฤหัสบดี":4,"ศุกร์":5,"เสาร์":6};
const TH_MONTHS = {
  "มกราคม":0,"ม.ค.":0,"มค":0,"jan":0,
  "กุมภาพันธ์":1,"ก.พ.":1,"กพ":1,"feb":1,
  "มีนาคม":2,"มี.ค.":2,"มีค":2,"mar":2,
  "เมษายน":3,"เม.ย.":3,"เมย":3,"apr":3,
  "พฤษภาคม":4,"พ.ค.":4,"พค":4,"may":4,
  "มิถุนายน":5,"มิ.ย.":5,"มิย":5,"jun":5,
  "กรกฎาคม":6,"ก.ค.":6,"กค":6,"jul":6,
  "สิงหาคม":7,"ส.ค.":7,"สค":7,"aug":7,
  "กันยายน":8,"ก.ย.":8,"กย":8,"sep":8,
  "ตุลาคม":9,"ต.ค.":9,"ตค":9,"oct":9,
  "พฤศจิกายน":10,"พ.ย.":10,"พย":10,"nov":10,
  "ธันวาคม":11,"ธ.ค.":11,"ธค":11,"dec":11
};

function parseThaiDateToken(token, tzMin = TZ_OFFSET_MIN) {
  const base = _localNow(tzMin);
  if (/วันนี้/.test(token))      return _startUTC(base).toISOString();
  if (/เมื่อวานซืน/.test(token)) return _startUTC(new Date(base-2*864e5)).toISOString();
  if (/เมื่อวาน/.test(token))    return _startUTC(new Date(base-1*864e5)).toISOString();
  if (/พรุ่งนี้/.test(token))    return _startUTC(new Date(+base+1*864e5)).toISOString();

  const mWk = token.match(/วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)(?:ที่แล้ว|ที่ผ่านมา)?/);
  if (mWk) {
    const target = TH_WEEKDAY[mWk[1].replace("พฤหัสบดี","พฤหัส")];
    const diff = (base.getDay()-target+7)%7 || 7; // วันเดียวกัน → ย้อน 7 วัน
    return _startUTC(new Date(base - diff*864e5)).toISOString();
  }

  let m = token.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let dd=+m[1], mm=+m[2]-1, yy=+m[3]; yy = yy<100 ? 2000+yy : yy; if (yy>2400) yy-=543;
    return new Date(Date.UTC(yy,mm,dd)).toISOString();
  }
  m = token.match(/(\d{1,2})\s*([A-Za-zก-๙.]+)\s*(\d{2,4})?/);
  if (m && TH_MONTHS[(m[2]||"").toLowerCase()] !== undefined) {
    let dd=+m[1], mm=TH_MONTHS[m[2].toLowerCase()], yy=m[3]?+m[3]:base.getFullYear();
    yy = yy<100 ? 2000+yy : yy; if (yy>2400) yy-=543;
    return new Date(Date.UTC(yy,mm,dd)).toISOString();
  }
  return _startUTC(base).toISOString(); // default = วันนี้
}

function extractDateFromText(text, tzMin=TZ_OFFSET_MIN) {
  const m = (text||"").match(
    /(วันนี้|เมื่อวานซืน|เมื่อวาน|พรุ่งนี้|วัน[ก-๙]+(?:ที่ผ่านมา|ที่แล้ว)?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s*[A-Za-zก-๙.]+\s*\d{2,4}?)/i
  );
  return parseThaiDateToken(m?m[0]:"วันนี้", tzMin);
}

// ===== Category / Merchant / Account inference =====
function pickParenthesisAs(text) {
  const m = (text||"").match(/\((.+?)\)\s*$/);
  return m ? m[1].trim() : null;
}

function fromRouteRules(text) {
  for (const r of ROUTE_RULES) {
    const m = text.match(r.re);
    if (m) {
      const note = r.noteTemplate.replace('$1', m[1].trim()).replace('$2', m[2].trim());
      return { category: r.category, merchant: r.merchant, account: r.account, note };
    }
  }
  return null;
}

function fromCategoryPrefix(text) {
  for (const rule of CATEGORY_PREFIX) {
    if (rule.re.test(text)) {
      let merchant = null, note = null;
      const inParen = pickParenthesisAs(text);
      if (inParen && rule.takeParenthesisAs === 'merchant') merchant = inParen;
      else if (inParen) note = inParen;
      return { category: rule.category, merchant, note };
    }
  }
  return null;
}

function fromAliasRules(text) {
  for (const a of ALIAS_RULES) {
    if (a.kw.test(text)) {
      return { category: a.category, merchant: a.merchant || null };
    }
  }
  return null;
}

function inferCategoryAndMerchant(text) {
  const t = (text||"").trim();

  // 1) เส้นทาง
  const route = fromRouteRules(t);
  if (route) return route;

  // 2) prefix
  const pref = fromCategoryPrefix(t);
  if (pref) return pref;

  // 3) alias
  const ali = fromAliasRules(t);
  if (ali) return ali;

  // 4) กรณี "ซื้อ ..." ไม่มีวงเล็บ
  if (/^\s*ซื้อ\s+/i.test(t)) {
    // default shopping; ถ้าเจอคีย์เวิร์ดเฉพาะ dict จะ override อยู่แล้วใน alias
    return { category: 'shopping', merchant: null };
  }

  return { category: 'uncategorized', merchant: null };
}

function inferAccount(text, initialAccount) {
  if (initialAccount) return initialAccount; // จาก ROUTE_RULES
  const t = (text||"");
  for (const h of ACCOUNT_HINTS) if (h.kw.test(t)) return h.account;
  return 'unknown';
}

// ===== MessageId (fallback) =====
async function ensureMessageId(evt, rawText){
  const mid = evt?.message?.id || evt?.webhookEventId;
  if (mid) return String(mid);
  const base = `${evt?.source?.userId||'unknown'}|${evt?.timestamp||Date.now()}|${rawText||''}`;
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(base));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ===== Supabase upsert =====
async function upsertLedger(env, evt, content){
  const base = (env.SUPABASE_URL||"").replace(/\/+$/,'');
  const url  = `${base}/rest/v1/ledger_entries?on_conflict=message_id`;
  console.log('POSTGREST URL =', url);

  const amount = parseAmountSmart(content);                         // number | null
  const occurredAt = extractDateFromText(content);                  // ISO string
  const cm = inferCategoryAndMerchant(content);                     // {category, merchant?, note?, account?}
  const account = inferAccount(content, cm.account);                // final account
  const message_id = await ensureMessageId(evt, content);
  const parenMerchant = pickParenthesisAs(content);                 // เผื่อเติม merchant ถ้ายังว่าง

  const payload = {
    message_id,
    line_user_id: evt?.source?.userId ?? null,
    kind: 'expense',
    raw_text: content,
    amount: amount ?? undefined,
    category: cm.category || 'uncategorized',
    account,
    merchant: cm.merchant ?? undefined,                              // จาก prefix/alias/route
    note: cm.note ?? undefined,
    occurred_at: occurredAt,
    recorded_at: new Date().toISOString(),
    source: 'line',
    status: 'ok'
  };

  // ถ้าเป็นข้อความพวกค่าอาหาร/ค่าขนม...ที่เราอยากดึงวงเล็บเป็น merchant
  if (!payload.merchant && /\((.+?)\)\s*$/.test(content)) {
    payload.merchant = parenMerchant;
  }

  const res = await fetch(url, {
    method:'POST',
    headers:{
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify([payload])
  });

  const text = await res.text();
  if(!res.ok){ console.log('UPSERT FAILED', res.status, text); throw new Error(text); }
  console.log('UPSERT OK', text);
  return JSON.parse(text)?.[0] ?? null;
}

// ===== LINE reply =====
async function reply(env, replyToken, text){
  if(!replyToken) return;
  try{
    await fetch('https://api.line.me/v2/bot/message/reply',{
      method:'POST',
      headers:{ Authorization:`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ replyToken, messages:[{ type:'text', text }] })
    });
  }catch(e){ console.log('REPLY FAIL', String(e)); }
}

function formatReply(row){
  const amt = row?.amount != null ? `${row.amount} บาท` : '(ยังไม่ระบุจำนวนเงิน)';
  const dt  = row?.occurred_at ? new Date(row.occurred_at).toLocaleDateString('th-TH',{ timeZone:'UTC'}) : '-';
  const cat = row?.category ?? '(ไม่ระบุ)'; 
  const acc = row?.account ?? '(ไม่ระบุ)';
  const mer = row?.merchant ?? '';
  const merLine = mer ? `\nร้าน/รายการ: ${mer}` : '';
  return `บันทึกแล้ว: ${amt}\nหมวด: ${cat} | บัญชี: ${acc}${merLine}\nวันที่: ${dt}`;
}

// ===== Worker entry =====
export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('OK');
    const body = await req.json().catch(()=>({}));
    const events = body?.events || [];
    const results = [];

    for (const evt of events) {
      if (evt.type !== 'message' || evt.message?.type !== 'text') continue;
      const raw = String(evt.message.text || '');
      const cmd = extractCommand(raw, evt?.source?.type);
      if (!cmd) continue;

      try {
        const row = await upsertLedger(env, evt, cmd);
        await reply(env, evt.replyToken, formatReply(row));
        results.push({ ok:true, id: row?.id, message_id: row?.message_id });
      } catch (e) {
        await reply(env, evt.replyToken, `บันทึกไม่สำเร็จ: ${e?.message || e}`);
        results.push({ ok:false, error: String(e) });
      }
    }
    return new Response(JSON.stringify({ results }), {
      status:200,
      headers:{'content-type':'application/json'}
    });
  }
};

