import{aV as v,aW as k,aX as N}from"./index-C3VqOMEy.js";const S="https://glasstab-ai.glasstab.workers.dev".replace(/\/$/,"");async function P(){const t=v.currentUser;if(!t)throw new Error("Sign in with Google to use AI.");const i=await t.getIdTokenResult();if(i.signInProvider!=="google.com"||v.currentUser!==t)throw new Error("Sign in with Google to use AI.");return{user:t,token:i.token}}async function x(t,i){const{user:s,token:n}=await P();if(!S)throw new Error("GlassTab AI is awaiting setup. Configure VITE_AI_WORKER_URL and rebuild GlassTab.");const o=await fetch(S+t,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify(i),signal:AbortSignal.timeout(t==="/image"?12e4:t==="/text"?45e3:15e3)});if(!o.ok)throw new Error((await o.json().catch(()=>({}))).error||"The AI usage service is unavailable.");if(v.currentUser!==s)throw new Error("Your Google session changed. Please try again.");return o}const R=async t=>{await x("/usage",{feature:t})};async function B(t){return{image:await(await x("/image",{prompt:t})).blob(),text:"",modelUsed:"FLUX.1 Schnell"}}async function M(t,i,s){return(await x("/text",{prompt:t,history:i,instruction:s})).json()}const Q=k,Y=(t,i=null)=>N(t,i),W=[{id:"compact",label:"Compact Tile",width:240,height:135,desc:"Battery, speed, timer"},{id:"medium",label:"Medium Card",width:360,height:210,desc:"Scores, mirror, stats"},{id:"wide",label:"Wide Banner",width:620,height:150,desc:"Ticker, status bar"},{id:"tall",label:"Tall Feed",width:320,height:340,desc:"News, calendar"}],I=[{id:"scores",label:"🏏 Live Scores",defaultName:"Live Cricket Scoreboard",width:360,height:210,apiEndpoint:"https://static.cricinfo.com/rss/livescores.xml",defaultApiQuery:"filter=, limit=5",queryPlaceholder:"e.g. India or filter=IPL, limit=5",acceptedParams:[{name:"filter",aliases:["team","q","query"],valuesDesc:"optional team/match keyword (substring match)",example:"India"},{name:"limit",aliases:[],valuesDesc:"integer 1–20",example:"5"}],unsupportedCapabilities:["Non-cricket sports (football, NBA, F1, tennis, badminton)","Ball-by-ball commentary or full player career stats","Historical match scores from past dates or live video streams"],contract:'Confirmed API: `https://static.cricinfo.com/rss/livescores.xml` via `await WidgetAPI.sources.scores({ filter, limit, force })`.\nAccepted params: `filter` (optional string to filter live match titles, e.g. `"India"`, `"IPL"`), `limit` (1–20), `force` (boolean).\nReturns: `{ matches: [{ title: string, link: string }], totalCount: number, filter: string, fromCache: boolean, updatedAt: string }`.\nRefresh every 60s when `document.visibilityState === \'visible\'`, passing `force: true` on manual Refresh.',defaultCode:`<style>
  .wrap { padding: 14px 16px; height: 100%; display: flex; flex-direction: column; font-size: 12px; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #34d399; background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.3); padding: 3px 9px; border-radius: 999px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #34d399; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: #e5e7eb; padding: 3px 9px; border-radius: 6px; cursor: pointer; font-size: 11px; }
  .btn:hover { background: rgba(255,255,255,0.18); }
  .list { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; flex: 1; }
  .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 11px; text-decoration: none; color: #f9fafb; display: block; transition: border-color .15s; }
  .card:hover { border-color: rgba(52,211,153,0.45); }
  .ts { font-size: 10px; color: #9ca3af; margin-top: 6px; text-align: right; }
</style>
<div class="wrap">
  <div class="head">
    <span class="badge"><span class="dot"></span>Live Cricket<span id="filterTag"></span></span>
    <button class="btn" id="refreshBtn">Refresh</button>
  </div>
  <div class="list" id="list">Loading live scores...</div>
  <div class="ts" id="ts"></div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { filter: "", limit: 5 };
  /* __QUERY_END__ */
  const listEl = document.getElementById('list');
  const tsEl = document.getElementById('ts');
  const btn = document.getElementById('refreshBtn');
  const filterTag = document.getElementById('filterTag');
  if (QUERY_CONFIG.filter) filterTag.textContent = ' • ' + QUERY_CONFIG.filter;

  async function load(force = false) {
    if (!force && document.visibilityState !== 'visible') return;
    btn.textContent = '...';
    try {
      const data = await WidgetAPI.sources.scores({
        filter: QUERY_CONFIG.filter || '',
        limit: QUERY_CONFIG.limit || 5,
        force,
      });
      listEl.innerHTML = data.matches.map(m =>
        \`<a class="card" href="\${m.link || '#'}" target="_blank" rel="noreferrer">\${m.title}</a>\`
      ).join('') || \`<div style="color:#9ca3af">No live matches\${QUERY_CONFIG.filter ? ' for "' + QUERY_CONFIG.filter + '"' : ''}.</div>\`;
      tsEl.textContent = 'Updated: ' + data.updatedAt;
    } catch (e) {
      listEl.innerHTML = '<div style="color:#fca5a5">Error: ' + e.message + '</div>';
    } finally {
      btn.textContent = 'Refresh';
    }
  }
  btn.addEventListener('click', () => load(true));
  load(false);
  setInterval(() => load(false), 60000);
<\/script>`},{id:"news",label:"📰 Live News",defaultName:"Live Custom News",width:320,height:340,apiEndpoint:"https://news.google.com/rss/search?q={q}&hl=en-{region}&gl={region}&ceid={region}:en (or tech/india/world/sports feeds)",defaultApiQuery:"q=tech, region=IN, limit=8",queryPlaceholder:"e.g. Katrina Kaif or q=Katrina Kaif, region=IN, when=7d, limit=8",acceptedParams:[{name:"q",aliases:["query","topic"],valuesDesc:'any search keyword/person/topic string (e.g. "Katrina Kaif")',example:"Katrina Kaif"},{name:"category",aliases:[],valuesDesc:"tech | world | india | sports",example:"tech"},{name:"region",aliases:[],valuesDesc:"IN | US",example:"IN"},{name:"when",aliases:[],valuesDesc:"1h | 1d | 7d | 1y (Google News time window)",example:"7d"},{name:"limit",aliases:[],valuesDesc:"integer 1–20",example:"8"}],unsupportedCapabilities:["Full article body text or bypassing paywalls","Live stock quotes, crypto prices, weather forecasts, or match scorecards","Social media posts/tweets/comments or personal emails"],contract:"Confirmed APIs:\n1. Search RSS (any person/topic/keyword): `https://news.google.com/rss/search?q={q}&hl=en-{region}&gl={region}&ceid={region}:en`\n2. Preset Category Feeds: `tech` (HN Algolia + Google News Tech), `india`, `world`, `sports`.\nCall `await WidgetAPI.sources.news({ query, category, region, when, limit, force })`.\nAccepted params:\n- `query`: any topic/person search string (e.g. `\"Katrina Kaif\"`, `\"AI startups\"`) — ALWAYS set `query` when the user asks for news about a specific person, company, or topic!\n- `category`: `'tech'`, `'world'`, `'india'`, or `'sports'` (only when user wants general category headlines without a specific search topic)\n- `region`: `'IN'` or `'US'`\n- `when`: `''` | `'1h'` | `'1d'` | `'7d'` | `'1y'`\n- `limit`: integer `1`–`20`\nReturns: `{ query, category, region, when, limit, articles: [{ title, url, source, publishedAt }], emptyReason?, updatedAt }`.",defaultCode:`<style>
  .wrap { padding: 14px; height: 100%; display: flex; flex-direction: column; gap: 10px; font-size: 12px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; }
  .tab { padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: #d1d5db; font-size: 10px; cursor: pointer; }
  .tab.active { background: #3b82f6; border-color: #60a5fa; color: #fff; font-weight: 600; }
  .query-pill { padding: 4px 9px; border-radius: 999px; background: rgba(59,130,246,0.2); border: 1px solid rgba(96,165,250,0.45); color: #bfdbfe; font-size: 11px; font-weight: 600; max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; }
  .item { padding: 8px 10px; border-radius: 9px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); text-decoration: none; color: #f3f4f6; display: block; line-height: 1.35; }
  .item:hover { border-color: rgba(96,165,250,0.5); }
  .src { font-size: 10px; color: #93c5fd; margin-top: 3px; }
</style>
<div class="wrap">
  <div class="top">
    <div id="headerControls" class="tabs">
      <button class="tab active" data-cat="tech">Tech</button>
      <button class="tab" data-cat="world">World</button>
      <button class="tab" data-cat="india">India</button>
      <button class="tab" data-cat="sports">Sports</button>
    </div>
    <span id="ts" style="font-size:10px;color:#9ca3af"></span>
  </div>
  <div class="list" id="list">Loading headlines...</div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { q: "tech", category: "", region: "IN", when: "", limit: 8 };
  /* __QUERY_END__ */
  const presets = ['tech', 'world', 'india', 'sports'];
  const initialTopic = (QUERY_CONFIG.q || QUERY_CONFIG.category || 'tech').trim();
  const isCustomTopic = initialTopic && !presets.includes(initialTopic.toLowerCase());

  let activeTopic = isCustomTopic ? initialTopic : (WidgetAPI.storage.get('news_cat', initialTopic.toLowerCase()) || 'tech');
  const listEl = document.getElementById('list');
  const tsEl = document.getElementById('ts');
  const headerControls = document.getElementById('headerControls');

  if (isCustomTopic) {
    headerControls.innerHTML = \`<span class="query-pill" title="\${activeTopic}">🔍 \${activeTopic}</span><button class="tab" id="refreshTopicBtn">↻</button>\`;
    document.getElementById('refreshTopicBtn').addEventListener('click', () => load(true));
  }

  function syncTabs() {
    document.querySelectorAll('.tab[data-cat]').forEach(t => t.classList.toggle('active', t.dataset.cat === activeTopic));
  }

  async function load(force = false) {
    if (!isCustomTopic) syncTabs();
    listEl.innerHTML = '<div style="color:#9ca3af">Fetching ' + activeTopic + ' news...</div>';
    try {
      const payload = isCustomTopic
        ? { query: activeTopic, region: QUERY_CONFIG.region || 'IN', when: QUERY_CONFIG.when || '', limit: QUERY_CONFIG.limit || 8, force }
        : { category: activeTopic, region: QUERY_CONFIG.region || 'IN', limit: QUERY_CONFIG.limit || 8, force };
      const data = await WidgetAPI.sources.news(payload);
      if (!data.articles.length) {
        listEl.innerHTML = '<div style="color:#9ca3af">' + (data.emptyReason || 'No articles found.') + '</div>';
      } else {
        listEl.innerHTML = data.articles.map(a =>
          \`<a class="item" href="\${a.url}" target="_blank" rel="noreferrer">\${a.title}<div class="src">\${a.source}</div></a>\`
        ).join('');
      }
      tsEl.textContent = data.updatedAt;
    } catch (e) {
      listEl.innerHTML = '<div style="color:#fca5a5">' + e.message + '</div>';
    }
  }

  if (!isCustomTopic) {
    document.querySelectorAll('.tab[data-cat]').forEach(t => t.addEventListener('click', () => {
      activeTopic = t.dataset.cat;
      WidgetAPI.storage.set('news_cat', activeTopic);
      load(false);
    }));
  }
  load(false);
<\/script>`},{id:"calendar",label:"📅 Calendar",defaultName:"Monthly Calendar",width:300,height:290,apiEndpoint:"Local JavaScript Date() (offline)",defaultApiQuery:"monthOffset=0, weekStartsOn=0",queryPlaceholder:"e.g. monthOffset=0, weekStartsOn=1",acceptedParams:[{name:"monthOffset",aliases:[],valuesDesc:"integer -120..120 (0 = current month)",example:"0"},{name:"weekStartsOn",aliases:[],valuesDesc:"0 (Sunday) | 1 (Monday)",example:"0"}],unsupportedCapabilities:["Google Calendar, Outlook, or iCloud personal meetings/events","Cloud reminders, Zoom links, or external public holidays API"],contract:"Confirmed API: Local `Date()` via `WidgetAPI.sources.calendar({ monthOffset, weekStartsOn })` (synchronous).\nAccepted params: `monthOffset` (integer, default `0`), `weekStartsOn` (`0` for Sunday, `1` for Monday).\nReturns: `{ year, month, weekStartsOn, monthName, todayLabel, days: Array<{ day: number, isToday: boolean } | null> }`.",defaultCode:`<style>
  .cal { padding: 14px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .title { font-weight: 700; font-size: 14px; }
  .sub { font-size: 10px; color: #93c5fd; }
  .nav button { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: #fff; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
  .dow { font-size: 10px; color: #9ca3af; font-weight: 600; padding-bottom: 3px; }
  .day { padding: 5px 0; border-radius: 7px; font-size: 11px; color: #e5e7eb; }
  .today { background: #3b82f6; color: #fff; font-weight: 700; box-shadow: 0 0 10px rgba(59,130,246,0.5); }
</style>
<div class="cal">
  <div class="head">
    <div>
      <div class="title" id="monthLabel"></div>
      <div class="sub" id="todayLabel"></div>
    </div>
    <div class="nav">
      <button id="prev">‹</button>
      <button id="next">›</button>
    </div>
  </div>
  <div class="grid" id="grid"></div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { monthOffset: 0, weekStartsOn: 0 };
  /* __QUERY_END__ */
  let offset = Number(QUERY_CONFIG.monthOffset) || 0;
  const weekStartsOn = Number(QUERY_CONFIG.weekStartsOn) === 1 ? 1 : 0;
  const monthEl = document.getElementById('monthLabel');
  const todayEl = document.getElementById('todayLabel');
  const gridEl = document.getElementById('grid');

  function render() {
    const data = WidgetAPI.sources.calendar({ monthOffset: offset, weekStartsOn });
    monthEl.textContent = data.monthName + ' ' + data.year;
    todayEl.textContent = data.todayLabel;
    const labels = weekStartsOn === 1 ? ['Mo','Tu','We','Th','Fr','Sa','Su'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const dows = labels.map(d => \`<div class="dow">\${d}</div>\`).join('');
    const cells = data.days.map(cell => {
      if (!cell) return '<div></div>';
      return \`<div class="day \${cell.isToday ? 'today' : ''}">\${cell.day}</div>\`;
    }).join('');
    gridEl.innerHTML = dows + cells;
  }

  document.getElementById('prev').addEventListener('click', () => { offset--; render(); });
  document.getElementById('next').addEventListener('click', () => { offset++; render(); });
  render();
<\/script>`},{id:"battery",label:"🔋 Battery %",defaultName:"Battery Status",width:240,height:135,apiEndpoint:"navigator.getBattery() (browser hardware API)",defaultApiQuery:"pollSec=15",queryPlaceholder:"e.g. pollSec=15",acceptedParams:[{name:"pollSec",aliases:[],valuesDesc:"integer 5–300 seconds",example:"15"}],unsupportedCapabilities:["Battery temperature, charging wattage/voltage, health %, or cycle count","CPU usage, RAM/memory usage, or GPU stats"],contract:"Confirmed API: `navigator.getBattery()` via `await WidgetAPI.sources.battery()`.\nAccepted config: `pollSec` (poll interval in seconds, 5–300, when `document.visibilityState === 'visible'`).\nReturns ONLY: `{ supported: boolean, level: number (0-100), charging: boolean, chargingTime: number, dischargingTime: number }`.",defaultCode:`<style>
  .box { padding: 14px 16px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .top { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; }
  .pct { font-size: 30px; font-weight: 700; display: flex; align-items: baseline; gap: 6px; }
  .bar-bg { width: 100%; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.12); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #10b981, #34d399); transition: width 0.4s ease; }
</style>
<div class="box">
  <div class="top"><span>Battery</span><span id="state">--</span></div>
  <div class="pct"><span id="level">--%</span></div>
  <div class="bar-bg"><div class="bar-fill" id="fill" style="width:0%"></div></div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { pollSec: 15 };
  /* __QUERY_END__ */
  const levelEl = document.getElementById('level');
  const stateEl = document.getElementById('state');
  const fillEl = document.getElementById('fill');
  const pollMs = Math.max(5, Math.min(300, Number(QUERY_CONFIG.pollSec) || 15)) * 1000;

  async function refresh() {
    try {
      const b = await WidgetAPI.sources.battery();
      if (!b.supported) {
        levelEl.textContent = 'N/A';
        stateEl.textContent = 'Unsupported';
        return;
      }
      levelEl.textContent = b.level + '%';
      stateEl.textContent = b.charging ? '⚡ Charging' : 'On Battery';
      stateEl.style.color = b.charging ? '#34d399' : '#d1d5db';
      fillEl.style.width = b.level + '%';
      fillEl.style.background = b.level <= 20 && !b.charging
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : 'linear-gradient(90deg, #10b981, #34d399)';
    } catch (e) {
      stateEl.textContent = 'Error';
    }
  }
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, pollMs);
<\/script>`},{id:"internetSpeed",label:"⚡ Internet Speed",defaultName:"Live Internet Speed",width:260,height:150,apiEndpoint:"https://www.cloudflare.com/cdn-cgi/trace & https://speed.cloudflare.com/__down?bytes={bytes}",defaultApiQuery:"activeTest=true, bytes=500000",queryPlaceholder:"e.g. activeTest=true, bytes=500000",acceptedParams:[{name:"activeTest",aliases:[],valuesDesc:"true | false",example:"true"},{name:"bytes",aliases:[],valuesDesc:"integer 100000–2000000",example:"500000"}],unsupportedCapabilities:["Upload speed Mbps or packet loss percentage","Ping to custom IP addresses/domains or Wi-Fi SSID/signal dBm"],contract:"Confirmed API: Cloudflare ping + download probe via `await WidgetAPI.sources.internetSpeed({ activeTest, bytes })`.\nAccepted params: `activeTest` (boolean, default `true`), `bytes` (100000–2000000, default `500000`).\nReturns: `{ online: boolean, pingMs: number|null, downloadMbps: number|null, effectiveType: string, measuredAt: number }`.",defaultCode:`<style>
  .box { padding: 14px 16px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; }
  .btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #fff; font-size: 10px; padding: 3px 8px; border-radius: 6px; cursor: pointer; }
  .speed { font-size: 26px; font-weight: 700; color: #60a5fa; }
  .unit { font-size: 12px; color: #9ca3af; font-weight: 500; margin-left: 3px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #d1d5db; }
</style>
<div class="box">
  <div class="head"><span>Internet Speed</span><button class="btn" id="testBtn">Test</button></div>
  <div class="speed"><span id="mbps">--</span><span class="unit">Mbps</span></div>
  <div class="meta">
    <span>Ping: <strong id="ping">-- ms</strong></span>
    <span id="status">Checking...</span>
  </div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { activeTest: true, bytes: 500000 };
  /* __QUERY_END__ */
  const mbpsEl = document.getElementById('mbps');
  const pingEl = document.getElementById('ping');
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('testBtn');

  async function runTest(forceActive) {
    btn.textContent = 'Testing...';
    try {
      const s = await WidgetAPI.sources.internetSpeed({
        activeTest: forceActive !== undefined ? forceActive : QUERY_CONFIG.activeTest !== false,
        bytes: QUERY_CONFIG.bytes || 500000,
      });
      mbpsEl.textContent = s.downloadMbps !== null ? s.downloadMbps : '--';
      pingEl.textContent = (s.pingMs !== null ? s.pingMs : '--') + ' ms';
      statusEl.textContent = s.online ? (s.effectiveType || 'Online').toUpperCase() : 'Offline';
    } catch (e) {
      statusEl.textContent = 'Error';
    } finally {
      btn.textContent = 'Test';
    }
  }
  btn.addEventListener('click', () => runTest(true));
  runTest();
<\/script>`},{id:"mirror",label:"🪞 Camera Mirror",defaultName:"Quick Mirror",width:300,height:240,apiEndpoint:'navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })',defaultApiQuery:"flip=true, zoom=1, filter=none",queryPlaceholder:"e.g. flip=true, zoom=1.2, filter=brightness(1.15)",acceptedParams:[{name:"flip",aliases:[],valuesDesc:"true | false",example:"true"},{name:"zoom",aliases:[],valuesDesc:"number 1–3",example:"1"},{name:"filter",aliases:[],valuesDesc:"CSS filter string (e.g. none, brightness(1.18))",example:"none"}],unsupportedCapabilities:["Video/photo recording, file download, or audio/mic capture","AR face tracking/stickers or AI background blur"],contract:"Confirmed API: Live camera <video> behind transparent UI via:\n- `await WidgetAPI.sources.mirror.start({ flip, filter, zoom })`\n- `await WidgetAPI.sources.mirror.stop()`\n- `await WidgetAPI.sources.mirror.setOptions({ flip, filter, zoom })`\nAccepted params: `flip` (boolean), `zoom` (1–3), `filter` (valid CSS filter string).\nIMPORTANT: Keep root/container background `transparent` so the live video behind it is visible!",defaultCode:`<style>
  .overlay { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; background: transparent; }
  .bar { display: flex; justify-content: space-between; align-items: center; }
  .pill { font-size: 10px; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(6px); }
  .controls { display: flex; gap: 6px; justify-content: center; }
  button { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 11px; padding: 5px 10px; border-radius: 8px; cursor: pointer; backdrop-filter: blur(8px); }
  button:hover { background: rgba(59,130,246,0.65); }
  .ring { position: fixed; inset: 0; pointer-events: none; border-radius: 16px; border: 3px solid rgba(255,255,255,0.25); transition: box-shadow .25s; }
  .ring.glow { border-color: rgba(255,248,230,0.9); box-shadow: inset 0 0 28px rgba(255,245,220,0.55); }
</style>
<div class="ring" id="ring"></div>
<div class="overlay">
  <div class="bar">
    <span class="pill" id="status">Camera Off</span>
  </div>
  <div class="controls">
    <button id="powerBtn">Turn On Mirror</button>
    <button id="flipBtn">Flip</button>
    <button id="lightBtn">Ring Light</button>
  </div>
</div>
<script>
  /* __QUERY_START__ */
  const QUERY_CONFIG = { flip: true, zoom: 1, filter: "none" };
  /* __QUERY_END__ */
  let active = false, flip = QUERY_CONFIG.flip !== false, zoom = Number(QUERY_CONFIG.zoom) || 1, baseFilter = QUERY_CONFIG.filter || 'none', light = false;
  const statusEl = document.getElementById('status');
  const powerBtn = document.getElementById('powerBtn');
  const ringEl = document.getElementById('ring');

  powerBtn.addEventListener('click', async () => {
    try {
      if (!active) {
        await WidgetAPI.sources.mirror.start({ flip, zoom, filter: light ? 'brightness(1.18)' : baseFilter });
        active = true;
        powerBtn.textContent = 'Turn Off';
        statusEl.textContent = 'Live Mirror';
      } else {
        await WidgetAPI.sources.mirror.stop();
        active = false;
        powerBtn.textContent = 'Turn On Mirror';
        statusEl.textContent = 'Camera Off';
      }
    } catch (e) {
      statusEl.textContent = e.message || 'Camera blocked';
    }
  });

  document.getElementById('flipBtn').addEventListener('click', () => {
    flip = !flip;
    WidgetAPI.sources.mirror.setOptions({ flip });
  });

  document.getElementById('lightBtn').addEventListener('click', () => {
    light = !light;
    ringEl.classList.toggle('glow', light);
    WidgetAPI.sources.mirror.setOptions({ filter: light ? 'brightness(1.18) contrast(1.04)' : baseFilter });
  });
<\/script>`},{id:"diagnostics",label:"🧪 Test All APIs",defaultName:"API Diagnostics (All Sources)",width:380,height:310,apiEndpoint:"Internal 8-endpoint connectivity suite",defaultApiQuery:"",queryPlaceholder:"No query parameters (fixed diagnostic suite)",acceptedParams:[],unsupportedCapabilities:["Custom API queries (fixed self-test suite)"],contract:"Diagnostic test widget that verifies all 6 WidgetAPI.sources.* connectors live.",defaultCode:`<style>
  .wrap { padding: 12px 14px; height: 100%; display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  .title { font-weight: 700; font-size: 13px; color: #f9fafb; }
  .btn { background: #4f46e5; border: none; color: #fff; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
  .btn:hover { background: #6366f1; }
  .rows { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
  .name { font-weight: 600; color: #e5e7eb; white-space: nowrap; }
  .val { text-align: right; font-family: monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
  .ok { color: #34d399; }
  .err { color: #f87171; }
  .wait { color: #9ca3af; }
</style>
<div class="wrap">
  <div class="head">
    <span class="title">All Sources Live Test</span>
    <button class="btn" id="runBtn">Re-run All</button>
  </div>
  <div class="rows" id="rows"></div>
</div>
<script>
  const rowsEl = document.getElementById('rows');
  const runBtn = document.getElementById('runBtn');

  const tests = [
    { id: 'scores', label: '🏏 Cricket Scores', fn: async () => {
      const r = await WidgetAPI.sources.scores(true);
      return r.matches.length + ' items (' + (r.matches[0]?.title?.slice(0, 22) || 'empty') + ')';
    }},
    { id: 'news_in', label: '📰 News (India)', fn: async () => {
      const r = await WidgetAPI.sources.news('india', true);
      return r.articles.length + ' articles (' + (r.articles[0]?.title?.slice(0, 20) || 'empty') + ')';
    }},
    { id: 'news_wd', label: '🌍 News (World)', fn: async () => {
      const r = await WidgetAPI.sources.news('world', true);
      return r.articles.length + ' articles (' + (r.articles[0]?.title?.slice(0, 20) || 'empty') + ')';
    }},
    { id: 'news_tc', label: '💻 News (Tech)', fn: async () => {
      const r = await WidgetAPI.sources.news('tech', true);
      return r.articles.length + ' articles (' + (r.articles[0]?.title?.slice(0, 20) || 'empty') + ')';
    }},
    { id: 'cal', label: '📅 Calendar', fn: async () => {
      const r = WidgetAPI.sources.calendar(0);
      return r.monthName + ' ' + r.year + ' (' + r.days.filter(Boolean).length + 'd)';
    }},
    { id: 'bat', label: '🔋 Battery %', fn: async () => {
      const r = await WidgetAPI.sources.battery();
      return r.supported ? (r.level + '% ' + (r.charging ? 'Charging' : 'Battery')) : 'Not supported';
    }},
    { id: 'spd', label: '⚡ Internet Speed', fn: async () => {
      const r = await WidgetAPI.sources.internetSpeed(true);
      return (r.downloadMbps ?? '--') + ' Mbps / ' + (r.pingMs ?? '--') + 'ms';
    }},
    { id: 'mir', label: '🪞 Camera Mirror', fn: async () => {
      await WidgetAPI.sources.mirror.start();
      setTimeout(() => WidgetAPI.sources.mirror.stop(), 800);
      return 'Camera stream OK';
    }},
  ];

  async function runAll() {
    rowsEl.innerHTML = tests.map(t =>
      \`<div class="row"><span class="name">\${t.label}</span><span class="val wait" id="v_\${t.id}">Testing...</span></div>\`
    ).join('');

    await Promise.all(tests.map(async (t) => {
      const el = document.getElementById('v_' + t.id);
      try {
        const out = await t.fn();
        el.className = 'val ok';
        el.textContent = 'OK: ' + out;
        el.title = out;
      } catch (e) {
        el.className = 'val err';
        el.textContent = 'FAIL: ' + (e?.message || e);
        el.title = el.textContent;
      }
    }));
  }

  runBtn.addEventListener('click', runAll);
  runAll();
<\/script>`}];I.map(t=>({id:t.id,name:t.defaultName,width:t.width,height:t.height,code:t.defaultCode}));const O=(t,i="")=>{const s=I.find(r=>r.id===t);if(!s)return{ok:!0,config:{},raw:i};const n=String(i||"").trim();if(!n)return{ok:!0,config:{},raw:""};if(s.acceptedParams.length===0)return{ok:!1,error:`${s.label} does not accept custom API query parameters.`};const o=new Map;s.acceptedParams.forEach(r=>{o.set(r.name.toLowerCase(),r.name),(r.aliases||[]).forEach(d=>o.set(d.toLowerCase(),r.name))});const a={};if(!n.includes("=")){if(t==="news")return a.q=n,{ok:!0,config:a,raw:n};if(t==="scores")return a.filter=n,{ok:!0,config:a,raw:n};const r=s.acceptedParams.map(d=>d.name).join(", ");return{ok:!1,error:`${s.label} requires key=value format. Accepted parameters: ${r}.`}}const u=n.split(/[,&]+/).map(r=>r.trim()).filter(Boolean);for(const r of u){const d=r.indexOf("=");if(d<=0)return{ok:!1,error:`Invalid query segment "${r}". Use key=value pairs (e.g. ${s.defaultApiQuery}).`};const f=r.slice(0,d).trim(),l=r.slice(d+1).trim().replace(/^["']|["']$/g,""),c=o.get(f.toLowerCase());if(!c){const e=s.acceptedParams.map(m=>`${m.name} (${m.valuesDesc})`).join("; ");return{ok:!1,error:`${s.label} API does not accept "${f}". Accepted: ${e}.`}}if(c==="region"){const e=l.toUpperCase();if(e&&e!=="IN"&&e!=="US")return{ok:!1,error:'News API "region" only accepts IN or US.'};e&&(a.region=e)}else if(c==="when"){if(l&&!["1h","1d","7d","1y"].includes(l))return{ok:!1,error:'News API "when" only accepts 1h, 1d, 7d, or 1y.'};l&&(a.when=l)}else if(c==="limit"){const e=Number(l);if(!Number.isInteger(e)||e<1||e>20)return{ok:!1,error:`${s.label} "limit" must be an integer between 1 and 20.`};a.limit=e}else if(c==="category"){const e=l.toLowerCase();if(e&&!["tech","world","india","sports"].includes(e))return{ok:!1,error:'News "category" accepts tech, world, india, or sports (use q=... for custom topics).'};e&&(a.category=e)}else if(c==="monthOffset"){const e=Number(l);if(!Number.isInteger(e)||e<-120||e>120)return{ok:!1,error:'Calendar "monthOffset" must be an integer between -120 and 120.'};a.monthOffset=e}else if(c==="weekStartsOn"){const e=Number(l);if(e!==0&&e!==1)return{ok:!1,error:'Calendar "weekStartsOn" only accepts 0 (Sunday) or 1 (Monday).'};a.weekStartsOn=e}else if(c==="pollSec"){const e=Number(l);if(!Number.isFinite(e)||e<5||e>300)return{ok:!1,error:'Battery "pollSec" must be between 5 and 300 seconds.'};a.pollSec=Math.round(e)}else if(c==="activeTest"||c==="flip"){if(!["true","false"].includes(l.toLowerCase()))return{ok:!1,error:`"${c}" only accepts true or false.`};a[c]=l.toLowerCase()==="true"}else if(c==="bytes"){const e=Number(l);if(!Number.isFinite(e)||e<1e5||e>2e6)return{ok:!1,error:'Speed Test "bytes" must be between 100000 and 2000000.'};a.bytes=Math.round(e)}else if(c==="zoom"){const e=Number(l);if(!Number.isFinite(e)||e<1||e>3)return{ok:!1,error:'Mirror "zoom" must be a number between 1 and 3.'};a.zoom=e}else a[c]=l}return{ok:!0,config:a,raw:n}},F=(t,i="",s="")=>{const n=O(t,s);if(!n.ok)return n;const o=String(i||"").toLowerCase().trim();if(!o)return{ok:!0};const u={news:[{re:/\b(stock price|share price|nse|bse|nifty|sensex|bitcoin price|crypto price)\b/i,msg:"Live News API only provides news headlines/RSS — live stock or crypto price feeds are not supported."},{re:/\b(weather forecast|temperature outside|aqi|humidity)\b/i,msg:"Live News API cannot fetch live weather forecasts — use the built-in Weather widget or a Custom Weather URL."},{re:/\b(full article|entire article|scrape full text|bypass paywall)\b/i,msg:"News RSS API only returns headlines, links, sources, and timestamps — full article text or paywall scraping is not supported."}],scores:[{re:/\b(football|soccer|premier league|champions league|nba|basketball|f1|formula 1|tennis|badminton)\b/i,msg:"Live Scores API (Cricinfo RSS) only supports cricket matches — other sports are not supported."},{re:/\b(ball[- ]by[- ]ball|commentary|career stats|batting average|historical match)\b/i,msg:"Cricinfo live RSS only provides current match score summaries — ball-by-ball commentary, player career stats, and past match archives are not supported."}],calendar:[{re:/\b(google calendar|outlook|icloud|sync my events|my meetings|zoom link|holidays api)\b/i,msg:"Calendar source uses local Date() offline — Google Calendar/Outlook OAuth events and holiday APIs are not supported."}],battery:[{re:/\b(temperature|celsius|fahrenheit|wattage|voltage|battery health|cycle count|cpu usage|ram usage|memory usage|gpu)\b/i,msg:"Battery API (navigator.getBattery) only exposes percentage level, charging boolean, and charge/discharge time — temperature, wattage, health, CPU, and RAM are not supported."}],internetSpeed:[{re:/\b(upload speed|upload mbps|packet loss|jitter to custom|ping custom ip|wifi password|ssid|signal strength)\b/i,msg:"Internet Speed API (Cloudflare probe) only measures pingMs and downloadMbps — upload speed, packet loss, custom IP ping, and Wi-Fi SSID/signal are not supported."}],mirror:[{re:/\b(record video|save video|download photo|capture audio|microphone|face filter|snapchat|background blur)\b/i,msg:"Camera Mirror only renders a live video stream with CSS filters/flip/zoom — recording, file saving, audio capture, and AR face tracking are not supported."}],diagnostics:[{re:/./,msg:"Test All APIs is a fixed diagnostic widget and cannot be customized."}]}[t]||[];for(const r of u)if(r.re.test(o))return{ok:!1,error:r.msg};return{ok:!0}},_=(t="")=>{const i=String(t||"").trim().replace(/^```(?:json)?\s*\n?/i,"").replace(/\n?```\s*$/i,"").trim();if(!i.startsWith("{")||!i.endsWith("}"))return null;try{const s=JSON.parse(i);if(s&&s.unsupported===!0)return{unsupported:!0,reason:String(s.reason||"This request cannot be fulfilled by the selected API.")}}catch{}return null},$=({name:t="",sourceId:i="custom",prompt:s=""})=>{const n={scores:"Live cricket match scores from Cricinfo RSS",news:"Live headlines and topic search from Google News / Hacker News",calendar:"Monthly calendar grid with quick month navigation",battery:"Live device battery percentage and charging status monitor",internetSpeed:"Real-time internet download speed (Mbps) and ping monitor",mirror:"Live webcam mirror with flip and ring-light overlay controls",custom:"Custom live web dashboard widget"},o=n[i]||n.custom,a=String(s||"").trim();if(a){const u=a.length>110?`${a.slice(0,107)}...`:a;return`${o} — customized for: ${u}`}return t!=null&&t.trim()?`${t.trim()}: ${o}.`:`${o}.`},U=({description:t,sourceId:i="scores",dataSourceUrl:s="",width:n=360,height:o=210})=>{const a=I.find(r=>r.id===i),u=a?`CONFIRMED API & QUERY SPECIFICATION (DO NOT INVENT OTHER APIS OR FAKE DATA):
- Primary API Endpoint / Query Template: \`${a.apiEndpoint}\`
- Default Query Baseline: \`${a.defaultApiQuery||"(none)"}\`
- Accepted Query Parameters:
${a.acceptedParams.length>0?a.acceptedParams.map(r=>`  • ${r.name}: ${r.valuesDesc} (e.g. ${r.example})`).join(`
`):"  • None (fixed API)"}
- Unsupported by this API:
${a.unsupportedCapabilities.map(r=>`  • ${r}`).join(`
`)}

SDK CALL CONTRACT:
${a.contract}

QUERY CUSTOMIZATION RULE (PROMPT-DRIVEN — CRITICAL):
- Infer and customize the API query parameters **directly from USER REQUEST** inside the generated widget code, ONLY using parameters listed under "Accepted Query Parameters" above.
- Example: If USER REQUEST says "katrina kaif news", you MUST call \`WidgetAPI.sources.news({ query: 'Katrina Kaif', region: 'IN', limit: 8 }, force)\` (which hits Google News Search RSS \`?q=Katrina+Kaif\`), NEVER fall back to general/world headlines!
- NEVER write raw \`fetch()\` to unconfirmed URLs and NEVER hardcode fake/mock/sample data!`:`DATA LAYER:
${s.trim()?`Fetch ONLY from: ${s.trim()} via \`await WidgetAPI.fetch(url, { cacheTtlMs: 30000 })\`.`:"Use local browser state or a verified public API via `await WidgetAPI.fetch(url)`."}
NEVER hardcode fake/mock/sample data.`;return`You are generating a browser dashboard widget.

USER REQUEST (TOPIC / QUERY + VISUAL STYLING):
${t.trim()||"Clean modern dark glass widget UI"}

TARGET CONTAINER SIZE:
Width: ${n}px, Height: ${o}px (must fit cleanly without horizontal overflow; use subtle vertical scroll only if listing items).

${u}

CAPABILITY CHECK (MANDATORY BEFORE WRITING CODE):
- If ANY data, metric, filter, or feature required by USER REQUEST **cannot** be fulfilled by the Confirmed API & Accepted Query Parameters above (or requires an unsupported capability listed above), DO NOT invent another API, DO NOT substitute unrelated global/generic data, and DO NOT output HTML/CSS/JS.
- Instead, reply with ONLY this exact JSON and nothing else:
{"unsupported": true, "reason": "Short specific explanation of what this API cannot do and which parameters it accepts."}

VISUAL & SANDBOX RULES (WHEN SUPPORTED):
- Transparent root background (\`background: transparent\`) because it sits inside a frosted glass container.
- Do NOT load external CDN scripts (\`<script src="https://...">\`). Use vanilla HTML, CSS, and JS only.
- \`window.WidgetAPI.storage.get(key, fallback)\` and \`.set(key, val)\` are available for saving user UI preferences.

OUTPUT FORMAT:
Either return ONLY raw HTML/CSS/JS code (\`<style>...</style><div>...</div><script>...<\/script>\`) OR ONLY the \`{"unsupported": true, "reason": "..."}\` JSON with zero markdown explanations.`},G=async({apiKey:t,description:i,sourceId:s,dataSourceUrl:n,width:o,height:a})=>{var f,l,c,e,m,E;if(!(t!=null&&t.trim()))throw new Error("Please enter your Gemini API Key first (or copy the prompt to use any AI).");const u=U({description:i,sourceId:s,dataSourceUrl:n,width:o,height:a});await R("widget");const r=["gemini-3.5-flash-lite","gemini-3.8-flash","gemini-3.7-flash","gemini-3.5-flash"];let d=null;for(const y of r)try{const p=`https://generativelanguage.googleapis.com/v1beta/models/${y}:generateContent?key=${encodeURIComponent(t.trim())}`,A=new AbortController,T=setTimeout(()=>A.abort(),15e3),h=await fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},signal:A.signal,body:JSON.stringify({contents:[{parts:[{text:u}]}],generationConfig:{temperature:.2,maxOutputTokens:3e3}})});if(clearTimeout(T),!h.ok){const g=await h.json().catch(()=>({}));throw new Error(((f=g==null?void 0:g.error)==null?void 0:f.message)||`Gemini API error (${h.status})`)}const w=await h.json();let b=((E=(m=(e=(c=(l=w==null?void 0:w.candidates)==null?void 0:l[0])==null?void 0:c.content)==null?void 0:e.parts)==null?void 0:m[0])==null?void 0:E.text)||"";if(!b.trim())throw new Error("Gemini returned empty response. Try refining your prompt.");b=b.replace(/^```(?:html|xml|json)?\s*\n?/i,"").replace(/\n?```\s*$/i,"").trim();const C=_(b);if(C){const g=new Error(C.reason);throw g.isUnsupported=!0,g}return{code:b,modelUsed:y}}catch(p){if(console.warn(`Widget generation with ${y} failed:`,p.message),d=p,p.isUnsupported)throw p;if(p.message&&(p.message.includes("leaked")||p.message.includes("API_KEY_INVALID")||p.message.includes("API key not valid")))throw new Error("Your Gemini API key was rejected by Google as leaked or invalid.")}throw new Error((d==null?void 0:d.message)||"Failed to generate widget with Gemini.")};export{I as C,W,P as a,B as b,Y as c,$ as d,U as e,G as f,Q as g,_ as p,R as r,M as s,F as v};
