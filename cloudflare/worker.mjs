const SEAT_KEY = "seat-alert";
const NOTICE_KEY = "daily-notice";
const NOTE_KEY = "little-note";
const MAX_NOTE_LENGTH = 2000;
const OPENING_PREFIX = "opening:";
const SEAT_TTL = 3600;
const ORIGIN = "https://nichinichi-cafe.github.io";
const MAX_NOTICE_LENGTH = 220;

const seatMessages = {
  "indoor-limited": {
    de: "Zurzeit sind nur wenige Innenplätze frei.",
    en: "Only a few indoor seats are available right now."
  },
  "garden-only": {
    de: "Drinnen sind zurzeit alle Plätze belegt. Im Garten sind noch Plätze frei.",
    en: "Indoor seating is currently full. Seats are still available in the garden."
  },
  full: {
    de: "Zurzeit sind alle verfügbaren Plätze belegt.",
    en: "All available seats are currently occupied."
  }
};

const noticePresets = {
  "cake-drinks-only": {
    de: "Heute gibt es nur Kuchen und Getränke.",
    en: "Today we are serving cakes and drinks only."
  },
  "tagesteller-off": {
    de: "Tagesteller ist heute nicht verfügbar.",
    en: "Tagesteller is not available today."
  },
  "special-soldout": {
    de: "Das Wochen-Special ist ausverkauft.",
    en: "This week’s special is sold out."
  },
  "evening-private": {
    de: "Heute Abend findet eine geschlossene Veranstaltung statt.",
    en: "A private event is taking place this evening."
  },
  "garden-closed": {
    de: "Der Garten ist heute wetterbedingt geschlossen.",
    en: "The garden is closed today due to the weather."
  }
};

const PUBLIC_GET_PATHS = new Set([
  "/status",
  "/notice",
  "/opening-exceptions",
  "/state",
  "/little-note"
]);

function json(data, status = 200, cors = false) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (cors) {
    headers["Access-Control-Allow-Origin"] = ORIGIN;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function authorized(request, env) {
  return request.headers.get("Authorization") === "Bearer " + env.ADMIN_TOKEN;
}

function berlinDateString(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return values.year + "-" + values.month + "-" + values.day;
}

function validDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || "");
}

function normalizePeriods(periods) {
  if (!Array.isArray(periods) || periods.length < 1 || periods.length > 2) {
    return null;
  }

  const clean = [];

  for (const period of periods) {
    if (!period || !validTime(period.start) || !validTime(period.end)) {
      return null;
    }

    if (period.start >= period.end) return null;

    const kind = period.kind === "mondstube" ? "mondstube" : "cafe";
    clean.push({ start: period.start, end: period.end, kind });
  }

  clean.sort((a, b) => a.start.localeCompare(b.start));

  if (clean.length === 2 && clean[0].end > clean[1].start) {
    return null;
  }

  return clean;
}

async function readSeatStatus(env) {
  const value = await env.STATUS_KV.get(SEAT_KEY, "json");

  if (!value || !seatMessages[value.status]) return null;

  if (!Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
    await env.STATUS_KV.delete(SEAT_KEY);
    return null;
  }

  return value;
}

async function readNotice(env) {
  const value = await env.STATUS_KV.get(NOTICE_KEY, "json");

  if (!value || !value.messages) return null;

  if (!Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
    await env.STATUS_KV.delete(NOTICE_KEY);
    return null;
  }

  return value;
}

async function readLittleNote(env) {
  const text = await env.STATUS_KV.get(NOTE_KEY);
  return typeof text === "string" ? text : "";
}

async function readOpeningExceptions(env) {
  const list = await env.STATUS_KV.list({ prefix: OPENING_PREFIX });
  const today = berlinDateString();
  const entries = [];

  for (const key of list.keys) {
    const value = await env.STATUS_KV.get(key.name, "json");

    if (!value || !validDateString(value.date)) continue;

    if (value.date < today) {
      await env.STATUS_KV.delete(key.name);
      continue;
    }

    if (value.type !== "closed" && value.type !== "special") continue;

    entries.push(value);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

function openingKey(date) {
  return OPENING_PREFIX + date;
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && PUBLIC_GET_PATHS.has(url.pathname)) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        }
      });
    }

    // Backwards-compatible seat-status API.
    if (request.method === "GET" && url.pathname === "/status") {
      const value = await readSeatStatus(env);
      return json({ active: Boolean(value), status: value }, 200, true);
    }

    if (request.method === "POST" && url.pathname === "/status") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await parseJson(request);

      if (!body || !seatMessages[body.status]) {
        return json({ error: "Invalid status" }, 400);
      }

      const now = Date.now();
      const value = {
        status: body.status,
        messages: seatMessages[body.status],
        updatedAt: now,
        expiresAt: now + SEAT_TTL * 1000
      };

      await env.STATUS_KV.put(SEAT_KEY, JSON.stringify(value), {
        expirationTtl: SEAT_TTL
      });

      return json({ ok: true, status: value });
    }

    if (request.method === "DELETE" && url.pathname === "/status") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      await env.STATUS_KV.delete(SEAT_KEY);
      return json({ ok: true });
    }

    // Daily / temporary notice API.
    if (request.method === "GET" && url.pathname === "/notice") {
      const value = await readNotice(env);
      return json({ active: Boolean(value), notice: value }, 200, true);
    }

    if (request.method === "POST" && url.pathname === "/notice") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await parseJson(request);
      if (!body) return json({ error: "Invalid JSON" }, 400);

      let messages;
      let kind;
      let preset = null;

      if (body.preset && noticePresets[body.preset]) {
        preset = body.preset;
        kind = "preset";
        messages = noticePresets[body.preset];
      } else {
        const text = String(body.text || "").trim();

        if (!text || text.length > MAX_NOTICE_LENGTH) {
          return json({ error: "Invalid notice text" }, 400);
        }

        kind = "custom";
        messages = { de: text, en: text };
      }

      const now = Date.now();
      const expiresAt = Number(body.expiresAt || now + 3600 * 1000);

      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        return json({ error: "Invalid expiry" }, 400);
      }

      const maxExpiry = now + 366 * 24 * 3600 * 1000;
      if (expiresAt > maxExpiry) {
        return json({ error: "Expiry too far in the future" }, 400);
      }

      const ttl = Math.max(60, Math.ceil((expiresAt - now) / 1000));
      const value = {
        kind,
        preset,
        messages,
        updatedAt: now,
        expiresAt
      };

      await env.STATUS_KV.put(NOTICE_KEY, JSON.stringify(value), {
        expirationTtl: ttl
      });

      return json({ ok: true, notice: value });
    }

    if (request.method === "DELETE" && url.pathname === "/notice") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      await env.STATUS_KV.delete(NOTICE_KEY);
      return json({ ok: true });
    }

    // One-day opening-hours exceptions.
    if (request.method === "GET" && url.pathname === "/opening-exceptions") {
      const entries = await readOpeningExceptions(env);
      return json({ exceptions: entries }, 200, true);
    }

    if (request.method === "POST" && url.pathname === "/opening-exceptions") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await parseJson(request);
      if (!body || !validDateString(body.date)) {
        return json({ error: "Invalid date" }, 400);
      }

      if (body.date < berlinDateString()) {
        return json({ error: "Date is in the past" }, 400);
      }

      if (body.type !== "closed" && body.type !== "special") {
        return json({ error: "Invalid exception type" }, 400);
      }

      let periods = [];

      if (body.type === "special") {
        periods = normalizePeriods(body.periods);
        if (!periods) {
          return json({ error: "Invalid opening periods" }, 400);
        }
      }

      const value = {
        date: body.date,
        type: body.type,
        periods,
        updatedAt: Date.now()
      };

      await env.STATUS_KV.put(openingKey(body.date), JSON.stringify(value));
      return json({ ok: true, exception: value });
    }

    if (request.method === "DELETE" && url.pathname === "/opening-exceptions") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const date = url.searchParams.get("date");
      if (!validDateString(date)) {
        return json({ error: "Invalid date" }, 400);
      }

      await env.STATUS_KV.delete(openingKey(date));
      return json({ ok: true });
    }

    // Independent, persistent note. Never part of reset-current or notice expiry.
    if (url.pathname === "/little-note") {
      if (request.method === "GET") return json({ text: await readLittleNote(env) }, 200, true);
      if (request.method === "POST" || request.method === "DELETE") {
        if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
        if (request.method === "DELETE") {
          await env.STATUS_KV.delete(NOTE_KEY);
          return json({ ok: true, text: "" });
        }
        const body = await parseJson(request);
        if (!body || typeof body.text !== "string" || body.text.length > MAX_NOTE_LENGTH) {
          return json({ error: "Invalid note text" }, 400);
        }
        const text = body.text.trim();
        if (text) await env.STATUS_KV.put(NOTE_KEY, text);
        else await env.STATUS_KV.delete(NOTE_KEY);
        return json({ ok: true, text });
      }
      return json({ error: "Method not allowed" }, 405);
    }

    // One public call the website can use for all live information.
    if (request.method === "GET" && url.pathname === "/state") {
      const [seat, notice, openingExceptions, littleNote] = await Promise.all([
        readSeatStatus(env),
        readNotice(env),
        readOpeningExceptions(env),
        readLittleNote(env)
      ]);

      return json({
        seat: { active: Boolean(seat), status: seat },
        notice: { active: Boolean(notice), notice },
        openingExceptions,
        littleNote
      }, 200, true);
    }

    // Reset only live hints; scheduled opening exceptions are kept safe.
    if (request.method === "POST" && url.pathname === "/reset-current") {
      if (!authorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      await Promise.all([
        env.STATUS_KV.delete(SEAT_KEY),
        env.STATUS_KV.delete(NOTICE_KEY)
      ]);

      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      return new Response(ADMIN_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer"
        }
      });
    }

    return new Response("NichiNichi status service is running.", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
};

const ADMIN_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>NichiNichi · 控制台</title>
<style>
:root{
  --ink:#171310;
  --paper:#f4efe4;
  --cream:#faf7f0;
  --stone:#72685f;
  --matcha:#56634b;
  --line:#d8d0c3;
  --soft:#eef0e8;
  --error:#983f35
}
*{box-sizing:border-box}
body{
  min-height:100vh;
  margin:0;
  color:var(--ink);
  background:var(--paper);
  font-family:"Microsoft JhengHei","PingFang TC","Noto Sans TC",system-ui,sans-serif;
  line-height:1.6
}
button,input,select,textarea{font:inherit}
button,a.button{cursor:pointer}
.shell{
  width:min(720px,calc(100% - 32px));
  margin-inline:auto
}
header{
  padding:22px 0;
  color:var(--paper);
  background:var(--ink)
}
.brand{
  margin:0;
  font-family:"Microsoft JhengHei","PingFang TC","Noto Serif TC",Georgia,serif;
  font-size:22px;
  letter-spacing:.08em
}
main{padding:32px 0 80px}
.hero{
  padding:clamp(24px,5vw,40px);
  border:1px solid var(--line);
  background:var(--cream)
}
h1,h2{
  margin:0;
  font-family:"Microsoft JhengHei","PingFang TC","Noto Serif TC",Georgia,serif;
  font-weight:400;
  line-height:1.15
}
h1{font-size:clamp(30px,7vw,46px)}
h2{font-size:25px}
.lead{
  margin:14px 0 26px;
  color:var(--stone)
}
.token-box{
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  margin-bottom:8px
}
.token-box input,
.field input,
.field select,
.field textarea{
  width:100%;
  min-width:0;
  min-height:46px;
  padding:10px 12px;
  border:1px solid var(--line);
  border-radius:0;
  color:var(--ink);
  background:white
}
.field textarea{
  min-height:92px;
  resize:vertical
}
.token-box button,
.primary-button{
  min-height:46px;
  padding:10px 15px;
  border:1px solid var(--matcha);
  color:var(--paper);
  background:var(--matcha)
}
.section{
  margin-top:16px;
  padding:24px;
  border:1px solid var(--line);
  background:var(--cream)
}
.section-head{
  margin-bottom:16px
}
.section-head p{
  margin:6px 0 0;
  color:var(--stone);
  font-size:13px
}
.active{
  margin:0 0 16px;
  padding:12px 14px;
  border-left:4px solid #738163;
  background:var(--soft);
  font-size:13px
}
.button-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px
}
.action-button,
.secondary-button,
.danger-button,
a.button{
  min-height:50px;
  padding:11px 13px;
  border:1px solid #b7aea4;
  color:var(--ink);
  background:var(--paper);
  text-align:center;
  text-decoration:none
}
.action-button{min-height:62px}
.secondary-button{
  width:100%;
  margin-top:10px;
  border-color:var(--ink)
}
.danger-button{
  width:100%;
  margin-top:10px;
  color:var(--paper);
  background:var(--ink);
  border-color:var(--ink)
}
.field{
  margin-top:12px
}
.field label,
.label{
  display:block;
  margin-bottom:5px;
  color:var(--stone);
  font-size:12px
}
.hours-grid{
  display:grid;
  grid-template-columns:120px 1fr 1fr;
  gap:10px
}
.inline-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-top:12px
}
.exception-list{
  display:grid;
  gap:8px;
  margin-top:16px
}
.exception-item{
  display:grid;
  grid-template-columns:1fr auto;
  gap:10px;
  align-items:center;
  padding:10px 12px;
  border:1px solid var(--line);
  background:white;
  font-size:13px
}
.exception-item button{
  padding:7px 9px;
  border:1px solid var(--line);
  background:var(--paper)
}
.result{
  min-height:26px;
  margin:18px 0 0;
  color:var(--matcha);
  font-size:13px
}
.result.error{color:var(--error)}
.footer-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-top:16px
}
.hidden{display:none!important}
.small-note{
  margin:10px 0 0;
  color:var(--stone);
  font-size:12px
}
@media(max-width:560px){
  .token-box,
  .button-grid,
  .hours-grid,
  .inline-actions,
  .footer-actions{grid-template-columns:1fr}
}
</style>
</head>
<body>
<header>
  <div class="shell">
    <p class="brand">日日珈琲 · NichiNichi Café</p>
  </div>
</header>

<main class="shell">
  <section class="hero">
    <h1>NichiNichi 控制台</h1>
    <p class="lead">只更新客人在出發來日日之前需要知道的資訊。</p>

    <div class="token-box" id="token-box">
      <input
        id="token"
        type="password"
        autocomplete="current-password"
        placeholder="管理密碼">
      <button id="save-token" type="button">儲存</button>
    </div>

    <p class="small-note" id="token-note"></p>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>座位狀態</h2>
      <p>座位提示會在 60 分鐘後自動消失。</p>
    </div>

    <p class="active" id="active-seat">正在讀取狀態…</p>

    <div class="button-grid">
      <button class="action-button" data-seat="indoor-limited" type="button">
        室內座位不多
      </button>
      <button class="action-button" data-seat="garden-only" type="button">
        室內滿席 · 花園有位
      </button>
      <button class="action-button" data-seat="full" type="button">
        目前滿席
      </button>
    </div>

    <button class="secondary-button" id="clear-seat" type="button">
      移除座位提示
    </button>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>營業時間</h2>
      <p>設定單日例外，不會改動平常的固定營業時間。</p>
    </div>

    <div class="inline-actions">
      <button class="action-button" id="close-today" type="button">
        今天休息
      </button>
      <button class="action-button" id="close-tomorrow" type="button">
        明天休息
      </button>
    </div>

    <div class="field">
      <label for="opening-date">日期</label>
      <input id="opening-date" type="date">
    </div>

    <button class="secondary-button" id="close-date" type="button">
      將這一天設為休息
    </button>

    <div class="field">
      <span class="label">特殊營業時間 · 時段 1</span>
      <div class="hours-grid">
        <select id="hours-kind-1" aria-label="類型 1">
          <option value="cafe">Café</option>
          <option value="mondstube">Mondstube</option>
        </select>
        <input id="hours-start-1" type="time" value="12:00" aria-label="開始時間 1">
        <input id="hours-end-1" type="time" value="18:00" aria-label="結束時間 1">
      </div>
    </div>

    <div class="field">
      <span class="label">選填 · 時段 2</span>
      <div class="hours-grid">
        <select id="hours-kind-2" aria-label="類型 2">
          <option value="mondstube">Mondstube</option>
          <option value="cafe">Café</option>
        </select>
        <input id="hours-start-2" type="time" aria-label="開始時間 2">
        <input id="hours-end-2" type="time" aria-label="結束時間 2">
      </div>
    </div>

    <button class="primary-button secondary-button" id="save-special-hours" type="button">
      儲存特殊營業時間
    </button>

    <div class="exception-list" id="exception-list">
      <p class="small-note">正在讀取已設定的例外日期…</p>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>今日公告</h2>
      <p>可以直接按常用公告，也可以自己輸入短訊息。</p>
    </div>

    <p class="active" id="active-notice">正在讀取公告…</p>

    <div class="button-grid">
      <button class="action-button" data-preset="cake-drinks-only" type="button">
        今天只供應蛋糕與飲料
      </button>
      <button class="action-button" data-preset="tagesteller-off" type="button">
        今天沒有 Tagesteller
      </button>
      <button class="action-button" data-preset="special-soldout" type="button">
        本週 Special 已售完
      </button>
      <button class="action-button" data-preset="evening-private" type="button">
        今晚有包場活動
      </button>
      <button class="action-button" data-preset="garden-closed" type="button">
        花園因天候關閉
      </button>
    </div>

    <div class="field">
      <label for="notice-custom">自由輸入公告</label>
      <textarea
        id="notice-custom"
        maxlength="220"
        placeholder="例如：Heute gibt es nur eine kleine Auswahl an warmen Speisen."></textarea>
    </div>

    <div class="field">
      <label for="notice-expiry">公告有效時間</label>
      <select id="notice-expiry">
        <option value="60">60 分鐘</option>
        <option value="endday">到今天 23:59</option>
        <option value="24h">24 小時</option>
        <option value="custom">自訂日期與時間…</option>
      </select>
    </div>

    <div class="field hidden" id="notice-custom-expiry-wrap">
      <label for="notice-custom-expiry">日期與時間</label>
      <input id="notice-custom-expiry" type="datetime-local">
    </div>

    <button class="primary-button secondary-button" id="publish-custom" type="button">
      發布自訂公告
    </button>

    <button class="secondary-button" id="clear-notice" type="button">
      移除今日公告
    </button>
  </section>

  <section class="section">
    <div class="section-head"><h2>日日小筆記</h2><p>想寫再寫，沒有期限。清空後儲存即可隱藏，不會影響今日公告。</p></div>
    <div class="field"><label for="little-note">給訪客的小筆記（最多 2000 字元）</label><textarea id="little-note" maxlength="2000" disabled></textarea></div>
    <button class="primary-button secondary-button" id="save-little-note" type="button" disabled>儲存小筆記</button>
    <p class="small-note" id="little-note-result" aria-live="polite">正在讀取小筆記…</p>
    <button class="secondary-button" id="reload-little-note" type="button">重新讀取小筆記</button>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>工具</h2>
      <p>重設目前提示時，不會刪除已排好的未來休店／特殊營業日期。</p>
    </div>

    <div class="footer-actions">
      <button class="danger-button" id="reset-current" type="button">
        重設目前提示
      </button>
      <a class="button" href="${ORIGIN}" target="_blank" rel="noopener">
        查看官網
      </a>
    </div>

    <p class="result" id="result" aria-live="polite"></p>
  </section>
</main>

<script>
(function(){
  "use strict";

  var tokenKey = "nichinichi-status-admin-token";
  var tokenInput = document.getElementById("token");
  var tokenBox = document.getElementById("token-box");
  var tokenNote = document.getElementById("token-note");
  var result = document.getElementById("result");
  var activeSeat = document.getElementById("active-seat");
  var activeNotice = document.getElementById("active-notice");
  var exceptionList = document.getElementById("exception-list");
  var openingDate = document.getElementById("opening-date");
  var noticeExpiry = document.getElementById("notice-expiry");
  var noticeCustomExpiryWrap = document.getElementById("notice-custom-expiry-wrap");
  var noticeCustomExpiry = document.getElementById("notice-custom-expiry");
  var token = localStorage.getItem(tokenKey) || "";

  var seatLabels = {
    "indoor-limited": "室內座位不多",
    "garden-only": "室內滿席 · 花園有位",
    "full": "目前滿席"
  };

  var noticeLabels = {
    "cake-drinks-only": "今天只供應蛋糕與飲料",
    "tagesteller-off": "今天沒有 Tagesteller",
    "special-soldout": "本週 Special 已售完",
    "evening-private": "今晚有包場活動",
    "garden-closed": "花園因天候關閉"
  };

  if(token){
    tokenInput.value = token;
    tokenBox.hidden = true;
    tokenNote.textContent = "管理密碼已儲存在這台裝置。";
  }

  function show(message,error){
    result.textContent = message;
    result.classList.toggle("error",Boolean(error));
  }

  function pad(number){
    return String(number).padStart(2,"0");
  }

  function localDateString(date){
    return date.getFullYear() + "-" + pad(date.getMonth()+1) + "-" + pad(date.getDate());
  }

  function datePlusDays(days){
    var date = new Date();
    date.setHours(12,0,0,0);
    date.setDate(date.getDate()+days);
    return localDateString(date);
  }

  function formatTime(timestamp){
    return new Intl.DateTimeFormat("zh-TW",{
      hour:"2-digit",
      minute:"2-digit",
      timeZone:"Europe/Berlin"
    }).format(new Date(timestamp));
  }

  function formatDate(dateString){
    var bits = dateString.split("-");
    var date = new Date(Number(bits[0]),Number(bits[1])-1,Number(bits[2]),12,0,0);
    return new Intl.DateTimeFormat("zh-TW",{
      weekday:"short",
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }).format(date);
  }

  function expiryTimestamp(){
    var choice = noticeExpiry.value;
    var now = new Date();

    if(choice === "60") return Date.now() + 60*60*1000;
    if(choice === "24h") return Date.now() + 24*60*60*1000;

    if(choice === "endday"){
      var end = new Date();
      end.setHours(23,59,59,999);
      return end.getTime();
    }

    if(choice === "custom"){
      if(!noticeCustomExpiry.value) return null;
      var custom = new Date(noticeCustomExpiry.value);
      return Number.isNaN(custom.getTime()) ? null : custom.getTime();
    }

    return null;
  }

  async function request(path,method,body){
    var options = {
      method:method || "GET",
      cache:"no-store",
      headers:{}
    };

    if(method && method !== "GET"){
      if(!token){
        throw new Error("NO_TOKEN");
      }

      options.headers["Authorization"] = "Bearer " + token;
      options.headers["Content-Type"] = "application/json";
      if(body !== undefined) options.body = JSON.stringify(body);
    }

    var response = await fetch(path,options);

    if(response.status === 401){
      localStorage.removeItem(tokenKey);
      token = "";
      tokenBox.hidden = false;
      tokenNote.textContent = "";
      throw new Error("UNAUTHORIZED");
    }

    var data = await response.json();
    if(!response.ok){
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function loadSeat(){
    try{
      var data = await request("/status","GET");
      activeSeat.textContent = data.active
        ? (seatLabels[data.status.status] || "座位提示已啟用") + " · 有效至 " + formatTime(data.status.expiresAt)
        : "目前沒有座位提示。";
    }catch(error){
      activeSeat.textContent = "無法讀取座位狀態。";
    }
  }

  async function loadNotice(){
    try{
      var data = await request("/notice","GET");
      if(data.active){
        var label = data.notice.preset
          ? (noticeLabels[data.notice.preset] || data.notice.messages.de)
          : data.notice.messages.de;
        activeNotice.textContent = label + " · 有效至 " + formatTime(data.notice.expiresAt);
      }else{
        activeNotice.textContent = "目前沒有今日公告。";
      }
    }catch(error){
      activeNotice.textContent = "無法讀取今日公告。";
    }
  }

  async function loadExceptions(){
    try{
      var data = await request("/opening-exceptions","GET");
      exceptionList.textContent = "";

      if(!data.exceptions.length){
        var empty = document.createElement("p");
        empty.className = "small-note";
        empty.textContent = "目前沒有已設定的未來例外日期。";
        exceptionList.appendChild(empty);
        return;
      }

      data.exceptions.forEach(function(item){
        var row = document.createElement("div");
        row.className = "exception-item";

        var text = document.createElement("span");
        var label = formatDate(item.date) + " · ";

        if(item.type === "closed"){
          label += "休息";
        }else{
          label += item.periods.map(function(period){
            return period.start + "–" + period.end;
          }).join(" · ");
        }

        text.textContent = label;

        var remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "刪除";
        remove.addEventListener("click",function(){
          removeException(item.date);
        });

        row.appendChild(text);
        row.appendChild(remove);
        exceptionList.appendChild(row);
      });
    }catch(error){
      exceptionList.textContent = "無法讀取例外日期。";
    }
  }

  function friendlyError(error){
    if(error.message === "NO_TOKEN") return "請先儲存管理密碼。";
    if(error.message === "UNAUTHORIZED") return "管理密碼不正確。";
    if(error.message === "Invalid opening periods") return "請檢查特殊營業時間。";
    if(error.message === "Invalid expiry") return "請選擇未來的到期時間。";
    return "更新失敗，請再試一次。";
  }

  async function setSeat(status){
    show("正在更新…",false);
    try{
      await request("/status","POST",{status:status});
      show("座位提示已發布，60 分鐘後會自動消失。",false);
      await loadSeat();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function clearSeat(){
    show("正在更新…",false);
    try{
      await request("/status","DELETE");
      show("座位提示已移除。",false);
      await loadSeat();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function saveClosed(date){
    if(!date){
      show("請選擇日期。",true);
      return;
    }

    show("正在儲存…",false);
    try{
      await request("/opening-exceptions","POST",{
        date:date,
        type:"closed"
      });
      show(formatDate(date) + " 已設為休息日。",false);
      await loadExceptions();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function saveSpecialHours(){
    var date = openingDate.value;
    var kind1 = document.getElementById("hours-kind-1").value;
    var start1 = document.getElementById("hours-start-1").value;
    var end1 = document.getElementById("hours-end-1").value;
    var kind2 = document.getElementById("hours-kind-2").value;
    var start2 = document.getElementById("hours-start-2").value;
    var end2 = document.getElementById("hours-end-2").value;

    if(!date || !start1 || !end1){
      show("請填寫日期和第一個時段。",true);
      return;
    }

    var periods = [{start:start1,end:end1,kind:kind1}];

    if(start2 || end2){
      if(!start2 || !end2){
        show("第二個時段請同時填寫開始與結束時間。",true);
        return;
      }
      periods.push({start:start2,end:end2,kind:kind2});
    }

    show("正在儲存…",false);
    try{
      await request("/opening-exceptions","POST",{
        date:date,
        type:"special",
        periods:periods
      });
      show("已儲存 " + formatDate(date) + " 的特殊營業時間。",false);
      await loadExceptions();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function removeException(date){
    show("正在移除…",false);
    try{
      await request("/opening-exceptions?date=" + encodeURIComponent(date),"DELETE");
      show("營業時間例外已移除。",false);
      await loadExceptions();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function publishNotice(payload){
    var expiresAt = expiryTimestamp();

    if(!expiresAt || expiresAt <= Date.now()){
      show("請選擇未來的到期時間。",true);
      return;
    }

    payload.expiresAt = expiresAt;
    show("正在發布…",false);

    try{
      await request("/notice","POST",payload);
      show("今日公告已發布。",false);
      await loadNotice();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function clearNotice(){
    show("正在更新…",false);
    try{
      await request("/notice","DELETE");
      show("今日公告已移除。",false);
      await loadNotice();
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  async function resetCurrent(){
    if(!confirm("確定要移除目前的座位提示和今日公告嗎？")) return;

    show("正在重設…",false);
    try{
      await request("/reset-current","POST",{});
      show("目前提示已重設。",false);
      await Promise.all([loadSeat(),loadNotice()]);
    }catch(error){
      show(friendlyError(error),true);
    }
  }

  document.getElementById("save-token").addEventListener("click",function(){
    token = tokenInput.value.trim();

    if(!token){
      show("請輸入管理密碼。",true);
      return;
    }

    localStorage.setItem(tokenKey,token);
    tokenBox.hidden = true;
    tokenNote.textContent = "管理密碼已儲存在這台裝置。";
    show("管理密碼已儲存。",false);
  });

  document.querySelectorAll("[data-seat]").forEach(function(button){
    button.addEventListener("click",function(){
      setSeat(button.dataset.seat);
    });
  });

  document.getElementById("clear-seat").addEventListener("click",clearSeat);

  document.getElementById("close-today").addEventListener("click",function(){
    var date = datePlusDays(0);
    openingDate.value = date;
    saveClosed(date);
  });

  document.getElementById("close-tomorrow").addEventListener("click",function(){
    var date = datePlusDays(1);
    openingDate.value = date;
    saveClosed(date);
  });

  document.getElementById("close-date").addEventListener("click",function(){
    saveClosed(openingDate.value);
  });

  document.getElementById("save-special-hours").addEventListener("click",saveSpecialHours);

  document.querySelectorAll("[data-preset]").forEach(function(button){
    button.addEventListener("click",function(){
      publishNotice({preset:button.dataset.preset});
    });
  });

  noticeExpiry.addEventListener("change",function(){
    noticeCustomExpiryWrap.classList.toggle("hidden",noticeExpiry.value !== "custom");
  });

  document.getElementById("publish-custom").addEventListener("click",function(){
    var text = document.getElementById("notice-custom").value.trim();
    if(!text){
      show("請輸入公告內容。",true);
      return;
    }
    publishNotice({text:text});
  });

  document.getElementById("clear-notice").addEventListener("click",clearNotice);
  document.getElementById("reset-current").addEventListener("click",resetCurrent);

  var littleNoteInput = document.getElementById("little-note");
  var saveLittleNote = document.getElementById("save-little-note");
  var littleNoteResult = document.getElementById("little-note-result");
  async function loadLittleNote(){
    littleNoteInput.disabled = true;
    saveLittleNote.disabled = true;
    try{
      var data = await request("/little-note","GET");
      if(typeof data.text !== "string") throw new Error("Invalid note response");
      littleNoteInput.value = data.text;
      littleNoteInput.disabled = false;
      saveLittleNote.disabled = false;
      littleNoteResult.textContent = "已讀取。修改後按儲存，才會更新官網。";
    }catch(error){
      littleNoteResult.textContent = "無法讀取小筆記，請重新讀取後再編輯。";
    }
  }
  document.getElementById("reload-little-note").addEventListener("click",loadLittleNote);
  saveLittleNote.addEventListener("click",async function(){
    if(littleNoteInput.disabled) return;
    saveLittleNote.disabled = true;
    try{
      var data = await request("/little-note","POST",{text:littleNoteInput.value});
      littleNoteInput.value = data.text;
      littleNoteResult.textContent = data.text ? "小筆記已儲存。" : "小筆記已清除。";
    }catch(error){
      littleNoteResult.textContent = friendlyError(error);
    }finally{ saveLittleNote.disabled = false; }
  });
  loadLittleNote();

  openingDate.value = datePlusDays(0);

  var oneHourLater = new Date(Date.now()+60*60*1000);
  noticeCustomExpiry.value =
    localDateString(oneHourLater) + "T" + pad(oneHourLater.getHours()) + ":" + pad(oneHourLater.getMinutes());

  Promise.all([loadSeat(),loadNotice(),loadExceptions()]);
})();
<\/script>
</body>
</html>`;
