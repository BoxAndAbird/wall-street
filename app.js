/* Wall Street - a personal finance ledger that lives on your machine (or your phone).
   Plain HTML, CSS and JS. No build step, no accounts, no network.
   Data is stored in this browser's localStorage; Backup / Restore moves it as a JSON file. */
(function () {
'use strict';

/* ======================================================================
   constants
   ====================================================================== */
const STORE_KEY = 'wallstreet.v1';
const LEGACY_KEY = 'tally.v1'; /* the app used to be called Tally; data saved under that name is picked up once */
const MINUS = '−', DOT = '·', UP = '▲', DOWN = '▼', DASH = '—', ARROW = '→';

const TYPES = {
  checking:    { label: 'Checking',           tag: 'CHK',  side: 'asset',     group: 'cash' },
  savings:     { label: 'Savings',            tag: 'SAV',  side: 'asset',     group: 'cash' },
  cash:        { label: 'Cash',               tag: 'CASH', side: 'asset',     group: 'cash' },
  brokerage:   { label: 'Brokerage',          tag: 'BRK',  side: 'asset',     group: 'invest' },
  retirement:  { label: 'Retirement',         tag: 'RET',  side: 'asset',     group: 'invest' },
  crypto:      { label: 'Crypto',             tag: 'CRY',  side: 'asset',     group: 'invest' },
  property:    { label: 'Property / vehicle', tag: 'PROP', side: 'asset',     group: 'property' },
  other_asset: { label: 'Other asset',        tag: 'AST',  side: 'asset',     group: 'property' },
  credit:      { label: 'Credit card',        tag: 'CC',   side: 'liability', group: 'debt' },
  auto_loan:   { label: 'Car loan',           tag: 'AUTO', side: 'liability', group: 'debt' },
  student:     { label: 'Student loan',       tag: 'STU',  side: 'liability', group: 'debt' },
  mortgage:    { label: 'Mortgage',           tag: 'MTG',  side: 'liability', group: 'debt' },
  other_debt:  { label: 'Other debt',         tag: 'DEBT', side: 'liability', group: 'debt' },
};
const GROUPS = { cash: 'Cash', invest: 'Investments', property: 'Property', debt: 'Debt' };
const GROUP_ORDER = ['cash', 'invest', 'property', 'debt'];
const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'plan',     label: 'Plan' },
  { id: 'goals',    label: 'Goals' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history',  label: 'History' },
];
/* looks. Each is a stylesheet block keyed on data-theme, plus a few flavoured labels; functions never change. */
const THEME_INFO = {
  dark:     { name: 'Dark ledger',  desc: 'The original. Quiet, purple, monospace.',                 color: '#0e0e12', sw: ['#0e0e12', '#a88cf6', '#63c78d'], emblem: 'art/emblem-dark.png' },
  heist:    { name: 'Heist',        desc: 'Pause-menu black, white tabs, orange highlights, green cash.', color: '#0c0c0e', sw: ['#0c0c0e', '#f0a53a', '#7bd66a'], emblem: 'art/heist-shield.png' },
  arcade:   { name: 'Arcade',       desc: 'Neon HUD. Brackets, glow, XP bars, your level.',         color: '#07080f', sw: ['#07080f', '#b388ff', '#7cf2ff'], emblem: 'art/emblem-arcade.png' },
  tycoon:   { name: 'Tycoon',       desc: 'Glossy board-game HUD. Ribbons, gold coins, big green buttons.', color: '#1f8fe0', sw: ['#1f8fe0', '#ffc531', '#ff3d3d'], emblem: 'art/tycoon-shield.png' },
  comic:    { name: 'Comic Pop',    desc: 'Halftone, thick outlines, big shadows. Ka-ching.',       color: '#fff3c4', sw: ['#fff3c4', '#111111', '#ff3b6b'], emblem: 'art/emblem-comic.png' },
  casino:   { name: 'Casino Night', desc: 'Black and gold, poker-chip tags, velvet glow.',          color: '#0b0b0d', sw: ['#0b0b0d', '#d4af37', '#3fd68c'], emblem: 'art/emblem-casino.png' },
  passbook: { name: 'Passbook',     desc: 'Kraft paper, navy ink, typewriter numbers, stamps.',     color: '#e9dfcc', sw: ['#e9dfcc', '#1e2a44', '#b3342e'], emblem: 'art/emblem-passbook.png' },
  light:    { name: 'Paper',        desc: 'The original, in daylight.',                             color: '#f2f1f6', sw: ['#f2f1f6', '#6b4fd8', '#1f8a4c'], emblem: 'art/emblem-light.png' },
};
const THEMES = Object.keys(THEME_INFO);
const WORDS = {
  heist:    { 'Net worth': 'Cash', 'Main goal': 'The score', 'Coming up': 'Incoming', 'Bills left': 'Debts', 'Where it sits': 'Assets', 'Funded': 'Done', 'Plan drift': 'Rebalance', 'LVL': 'RANK' },
  arcade:   { 'Net worth': 'Bankroll', 'Main goal': 'Main quest', 'Coming up': 'Incoming', 'Bills left': 'Debts due', 'Where it sits': 'Inventory', 'Funded': 'Unlocked', 'Plan drift': 'Loadout' },
  tycoon:   { 'Net worth': 'Cash', 'Main goal': 'Next landmark', 'Coming up': 'Up next', 'Bills left': 'Rent due', 'Where it sits': 'Your board', 'Funded': 'Built!', 'Plan drift': 'Rebalance' },
  comic:    { 'Main goal': 'The big one', 'Coming up': 'Up next!', 'Where it sits': 'The stash', 'Funded': 'Done!', 'Plan drift': 'Shuffle' },
  casino:   { 'Net worth': 'Chips', 'Main goal': 'Jackpot', 'Coming up': 'On the table', 'Bills left': 'House take', 'Where it sits': 'The vault', 'Funded': 'Cashed out', 'Plan drift': 'Reshuffle' },
  passbook: { 'Net worth': 'Balance', 'Main goal': 'Savings goal', 'Coming up': 'Due soon', 'Where it sits': 'Accounts', 'Funded': 'Complete', 'Plan drift': 'Allocation' },
};
const word = s => (WORDS[S.settings.theme] || {})[s] || s;
/* the desktop's labels: the phone's, except where a flavoured word would clash with a real one on the same screen
   (tycoon's 'Cash' for net worth beside the real cash group, 'Rent due' for every bill, 'Debts' beside the debt total) */
const DESK_WORDS = { tycoon: { 'Net worth': 'Fortune', 'Bills left': 'Bills due' }, heist: { 'Net worth': 'Net worth', 'Bills left': 'Bills due', 'Coming up': 'Up next' }, arcade: { 'Bills left': 'Bills due', 'Coming up': 'Up next' } };
const dword = s => (DESK_WORDS[S.settings.theme] || {})[s] || word(s);
/* help: how to put the app on a phone's home screen, with a picture per step, and the link to share */
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const IS_STANDALONE = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
let helpOS = IS_IOS ? 'ios' : 'android';
const APP_URL = 'https://boxandabird.github.io/wall-street/';
const PHONE = (inner) => `<svg viewBox="0 0 80 150" class="phone"><rect x="4" y="2" width="72" height="146" rx="10" class="frame"/><rect x="9" y="12" width="62" height="126" rx="4" class="screen"/>${inner}</svg>`;
/* the app as seen in a browser: brand square, a big number, two cards */
const APP_AT = (y) => `<rect x="13" y="${y}" width="5" height="5" rx="1" class="app"/><rect x="21" y="${y + 1}" width="22" height="3" rx="1" class="dim"/><rect x="13" y="${y + 12}" width="30" height="3" rx="1" class="dim"/><rect x="13" y="${y + 18}" width="44" height="10" rx="2" class="big"/><rect x="13" y="${y + 34}" width="26" height="3" rx="1" class="dim"/><rect x="13" y="${y + 42}" width="52" height="16" rx="2" class="card"/><rect x="13" y="${y + 62}" width="52" height="16" rx="2" class="card"/>`;
const HOME = `<g class="icons">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${13 + (i % 4) * 14}" y="${18 + Math.floor(i / 4) * 16}" width="10" height="10" rx="2" class="dim"/>`).join('')}</g><rect x="13" y="50" width="12" height="12" rx="3" class="app"/><path d="M15.5 53.5l2 6 1.5-4 1.5 4 2-6" class="appw"/><circle cx="19" cy="56" r="9" class="ring"/>`;
/* a sheet of menu rows with one highlighted; glyph = 'share' | 'dots' | 'plus' */
const SHEET = (top, hlIndex, glyph, apps) => {
  const rows = []; let y = top + 8;
  if (apps) { rows.push([0, 1, 2, 3].map(i => `<circle cx="${20 + i * 13.5}" cy="${y + 5}" r="5" class="dim"/>`).join('')); y += 16; }
  for (let i = 0; i < 4; i++) {
    const on = i === hlIndex, h = on ? 11 : 9;
    let g = '';
    if (on) {
      if (glyph === 'share') g = `<path d="M20.5 ${y + 2.5}v5M18.5 ${y + 4.5}l2-2 2 2M17.5 ${y + 6}v3h6v-3" class="glyphl"/>`;
      else if (glyph === 'dots') g = `<circle cx="18.5" cy="${y + 5.5}" r="1" class="glyphd"/><circle cx="21" cy="${y + 5.5}" r="1" class="glyphd"/><circle cx="23.5" cy="${y + 5.5}" r="1" class="glyphd"/>`;
      else g = `<rect x="18" y="${y + 3}" width="5" height="5" class="glyph"/><path d="M20.5 ${y + 3.5}v4M18.5 ${y + 5.5}h4" class="glyphl"/>`;
      rows.push(`<rect x="14" y="${y}" width="52" height="${h}" rx="2" class="hl"/>${g}<rect x="27" y="${y + 4}" width="32" height="3" rx="1" class="glyphbar"/>`);
    } else rows.push(`<rect x="14" y="${y}" width="52" height="${h}" rx="2" class="dim"/>`);
    y += h + 4;
  }
  return `<rect x="9" y="12" width="62" height="126" rx="4" class="dimfill"/><rect x="9" y="${top}" width="62" height="${138 - top}" rx="6" class="sheet"/>${rows.join('')}`;
};
const HELP_ART = {
  ios: [
    /* 1: the three dots at the bottom right of Safari */
    PHONE(`${APP_AT(16)}<rect x="9" y="118" width="62" height="20" class="bar"/><rect x="14" y="124" width="36" height="8" rx="4" class="dim"/><circle cx="62" cy="128" r="6" class="ring"/><circle cx="59.5" cy="128" r="1" class="glyphd"/><circle cx="62" cy="128" r="1" class="glyphd"/><circle cx="64.5" cy="128" r="1" class="glyphd"/>`),
    /* 2: Share in that menu */
    PHONE(SHEET(70, 1, 'share', false)),
    /* 3: View more in the share sheet */
    PHONE(SHEET(56, 3, 'dots', true)),
    /* 4: Add to Home Screen */
    PHONE(SHEET(56, 1, 'plus', false)),
  ],
  android: [
    PHONE(`<rect x="9" y="12" width="62" height="14" class="bar"/><rect x="13" y="16" width="34" height="6" rx="3" class="dim"/><circle cx="62" cy="19" r="6" class="ring"/><circle cx="62" cy="16" r="1" class="glyphd"/><circle cx="62" cy="19" r="1" class="glyphd"/><circle cx="62" cy="22" r="1" class="glyphd"/>${APP_AT(30)}`),
    PHONE(`<rect x="9" y="12" width="62" height="126" rx="4" class="dimfill"/><rect x="24" y="16" width="46" height="70" rx="3" class="sheet"/><rect x="28" y="21" width="38" height="7" rx="2" class="dim"/><rect x="28" y="32" width="38" height="7" rx="2" class="dim"/><rect x="28" y="43" width="38" height="7" rx="2" class="dim"/><rect x="28" y="54" width="38" height="9" rx="2" class="hl"/><rect x="31" y="56" width="5" height="5" class="glyph"/><path d="M33.5 56.5v4M31.5 58.5h4" class="glyphl"/><rect x="39" y="57" width="24" height="3" rx="1" class="glyphbar"/><rect x="28" y="67" width="38" height="7" rx="2" class="dim"/>`),
    PHONE(HOME),
  ],
};
const HELP_STEPS = {
  ios: ['Tap the <b>three dots</b> at the bottom right of Safari.', 'Tap <b>Share</b>.', 'Tap <b>View more</b>.', 'Tap <b>Add to Home Screen</b>, then <b>Add</b>. The icon lands on your home screen; open it from there from now on.'],
  android: ['Open the link in <b>Chrome</b> and tap the <b>three dots</b> menu at the top right.', 'Tap <b>Add to Home screen</b> (on some phones it says <b>Install app</b>).', 'Tap <b>Add</b>. The icon lands on your home screen; open it from there from now on.'],
};
/* Android Chrome offers a real install dialog; keep its prompt for the Install button */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; const b = document.querySelector('[data-action="install"]'); if (b) b.style.display = ''; });
window.addEventListener('appinstalled', () => { installPrompt = null; toast('Installed. Open Wall Street from your home screen from now on.'); });
function helpHTML() {
  const steps = HELP_STEPS[helpOS], art = HELP_ART[helpOS];
  return `<div class="mform help-box"><h3>Put it on your home screen</h3>
    ${IS_STANDALONE ? `<p class="muted small intro"><span class="pos">You are already running it from the home screen.</span> These steps are for another phone.</p>` : `<p class="muted small intro">Then it opens full screen like an app, with its own icon.</p>`}
    <div class="seg help-os"><button type="button" class="${helpOS === 'ios' ? 'on' : ''}" data-action="help-os" data-os="ios">iPhone</button><button type="button" class="${helpOS === 'android' ? 'on' : ''}" data-action="help-os" data-os="android">Android</button></div>
    ${helpOS === 'android' && !IS_STANDALONE ? `<button type="button" class="btn btn-primary install" data-action="install" style="${installPrompt ? '' : 'display:none'}">Install with one tap</button>` : ''}
    <div class="help-steps${steps.length === 4 ? ' four' : ''}">${steps.map((s, i) => `<div class="step">${art[i]}<div class="small"><b>${i + 1}.</b> ${s}</div></div>`).join('')}</div>
    <div class="help-share"><div class="label">Send it to a friend</div><div class="row"><input class="inp num" readonly value="${APP_URL}"><button type="button" class="btn" data-action="copy-link">Copy</button></div><p class="muted small">They get their own empty copy. Share the link, never your sync code: the code is what opens your numbers.</p></div>
    <div class="mactions"><span class="grow"></span><button type="button" class="btn btn-primary" data-close>Done</button></div></div>`;
}
/* a level for the game looks: one per $2,500 of net worth */
const level = n => Math.floor(Math.max(0, n) / 2500) + 1;
function looksHTML() {
  return `<div class="mform"><h3>Pick a look</h3><p class="muted small intro">Same app, same numbers. Only the outfit changes.</p>
    <div class="looks">${THEMES.map(t => { const i = THEME_INFO[t]; return `<button type="button" class="look${t === S.settings.theme ? ' on' : ''}" data-action="set-theme" data-theme="${t}">${i.emblem ? `<img class="emblem" src="${i.emblem}" alt="">` : `<span class="sw">${i.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>`}<span class="grow"><b>${esc(i.name)}</b><span class="muted small">${esc(i.desc)}</span></span></button>`; }).join('')}</div>
    <div class="mactions"><span class="grow"></span><button type="button" class="btn btn-primary" data-close>Done</button></div></div>`;
}
const ICONS = {
  overview: '<path d="M3 10.5 10 4l7 6.5V17h-5v-4H8v4H3z"/>',
  accounts: '<path d="M3 8l7-4 7 4H3zM5 8v6M9 8v6M13 8v6M17 8v6M3 17h14"/>',
  plan:     '<path d="M10 3a7 7 0 1 0 7 7h-7z"/><path d="M12 2a6 6 0 0 1 6 6h-6z"/>',
  goals:    '<path d="M5 17V3M5 4h10l-2 3 2 3H5"/>',
  upcoming: '<rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/>',
  history:  '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
};
const icon = id => `<i class="ico"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${ICONS[id] || ''}</svg></i>`;
const KIND_TAG = { update: 'SET', transfer: 'XFER', payment: 'PAID', income: 'IN', expense: 'OUT', goal: 'GOAL', add: 'NEW', remove: 'DEL', reverse: 'UNDO', note: 'NOTE' };

/* ======================================================================
   state + persistence
   ====================================================================== */
const fresh = () => ({
  version: 1,
  settings: { theme: 'dark', income: 0, lastBackup: null, mainGoalId: null, view: 'now' },
  accounts: [], snapshots: [], txns: [], goals: [], buckets: [], bills: [], upcoming: [], ticks: [],
});
/* if saved data cannot be read, the app must never write an empty ledger over it, here or in the cloud */
let loadFailed = false;
let S = load();
let view = 'overview', histFilter = 'all', shownNet = null, modalResolve = null;
let chartRange = '1m'; try { chartRange = localStorage.getItem('ws.range') || '1m'; } catch (e) {}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) localStorage.setItem(STORE_KEY, raw);
    }
    if (!raw) return fresh();
    const out = hydrate(JSON.parse(raw));
    loadFailed = false;
    return out;
  } catch (e) {
    console.warn('Wall Street: could not load saved data', e);
    loadFailed = !!raw;
    if (raw) setTimeout(() => toast('Saved numbers could not be read. Nothing will be overwritten; reload, or restore a backup.'), 500);
    return fresh();
  }
}
function hydrate(d) {
  const base = fresh();
  const out = Object.assign(base, d);
  out.settings = Object.assign(fresh().settings, d.settings || {});
  if (!THEMES.includes(out.settings.theme)) out.settings.theme = 'dark';
  for (const k of ['accounts', 'snapshots', 'txns', 'goals', 'buckets', 'bills', 'upcoming', 'ticks']) if (!Array.isArray(out[k])) out[k] = [];
  out.buckets.forEach(b => { if (!Array.isArray(b.accountIds)) b.accountIds = []; });
  out.bills.forEach(b => { if (!b.paid || typeof b.paid !== 'object') b.paid = {}; if (!['month', 'week', '2weeks', 'year'].includes(b.every)) b.every = 'month'; });
  out.goals.forEach(g => { if (g.kind !== 'net') g.kind = 'manual'; if (typeof g.saved !== 'number') g.saved = 0; });
  out.upcoming.forEach(u => { if (u.kind !== 'in') u.kind = 'out'; if (!u.done || typeof u.done !== 'object') u.done = null; });
  return out;
}
function save(o) {
  if (loadFailed) { toast('Not saved: the numbers already here could not be read. Reload, or restore a backup.'); return; }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { console.error(e); toast('Could not save. Is storage blocked?'); }
  if (sync.code && !(o && o.local)) schedulePush();
}

/* ======================================================================
   sync across devices (optional). The whole ledger is kept in a small
   cloud store under a private code; every device that has the code
   sees the same numbers. The code lives outside the ledger so a backup
   file never contains it.
   ====================================================================== */
const SYNC = { url: 'https://gbivjaggzpmccfxoqrnu.supabase.co', key: 'sb_publishable_WF36AphLIFeQrk4kXcCfgg_WZ-SDkRF' };
const SYNC_KEY = 'wallstreet.sync';
let sync = loadSync(), pushTimer = null, lastPullAt = 0;

function loadSync() {
  const base = { code: null, version: 0, last: null, status: 'idle' };
  try { return Object.assign(base, JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {}, { status: 'idle' }); }
  catch (e) { return base; }
}
function saveSync() { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ code: sync.code, version: sync.version, last: sync.last })); } catch (e) { console.error(e); } }
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; /* no 0/O, 1/I/L: easy to read off a screen and type on a phone */
function newCode() {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return prettyCode(Array.from(a, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''));
}
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const prettyCode = s => (normCode(s).match(/.{1,4}/g) || []).join('-');
async function rpc(fn, args) {
  const res = await fetch(SYNC.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SYNC.key }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error('sync ' + res.status + ' ' + (await res.text()).slice(0, 160));
  return res.json();
}
function setSyncStatus(st) { sync.status = st; renderNav(); }
/* the cloud copy wins: replace this device's ledger with it. Never with an empty one, though:
   if the cloud copy has no accounts and this device does, this device's numbers are kept and sent up instead. */
function adoptRemote(r, msg) {
  const incoming = (r.data && Array.isArray(r.data.accounts)) ? r.data.accounts.length : 0;
  if (!incoming && S.accounts.length) {
    G.silent = false;   /* the game: nothing was replaced, so the next change here is celebrated as usual */
    sync.version = r.version; saveSync();
    toast('The cloud copy was empty, so this device\'s numbers were kept.');
    syncPush();
    return;
  }
  keepCopy('before syncing');
  S = hydrate(r.data); sync.version = r.version; sync.last = nowISO(); sync.status = 'idle'; saveSync();
  save({ local: true }); shownNet = null; render();
  if (msg) toast(msg);
}

/* safety copies: the last few ledgers this device had, kept outside the ledger itself, so a bad restore,
   a bad sync or a stray "erase" can be undone from History. Newest first, capped by size. */
const PREV_KEY = 'wallstreet.prev';
function prevCopies() { try { return JSON.parse(localStorage.getItem(PREV_KEY) || '[]') || []; } catch (e) { return []; } }
function keepCopy(reason) {
  if (!S.accounts.length && !S.goals.length && !S.bills.length && !S.upcoming.length) return;
  const list = prevCopies();
  list.unshift({ at: nowISO(), reason, accounts: S.accounts.length, data: S });
  let total = 0; const kept = [];
  for (const c of list) { const size = JSON.stringify(c).length; if (kept.length >= 6 || total + size > 1500000) break; kept.push(c); total += size; }
  try { localStorage.setItem(PREV_KEY, JSON.stringify(kept)); } catch (e) { console.warn('could not keep a safety copy', e); }
}
function dailyCopy() {
  const list = prevCopies();
  if (list.length && list[0].at.slice(0, 10) === todayStr()) return;
  keepCopy('daily');
}
async function syncPull(o) {
  o = o || {};
  if (!sync.code || !SYNC.url || !navigator.onLine) return;
  if (!o.force && Date.now() - lastPullAt < 15000) return;
  lastPullAt = Date.now();
  setSyncStatus('syncing');
  try {
    const r = await rpc('ws_get', { code: normCode(sync.code) });
    if (r && r.version !== sync.version) adoptRemote(r, o.quiet ? '' : 'Updated from another device');
    else if (!r) { await syncPush(); return; }   /* nothing in the cloud yet: this device seeds it */
    sync.last = nowISO(); saveSync(); setSyncStatus('idle');
  } catch (e) { console.warn(e); setSyncStatus('error'); }
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(syncPush, 800); }
async function syncPush() {
  if (!sync.code || !SYNC.url || loadFailed) return;
  if (!navigator.onLine) { setSyncStatus('error'); return; }
  setSyncStatus('syncing');
  try {
    const r = await rpc('ws_put', { code: normCode(sync.code), payload: S, expected: sync.version || null });
    if (r && r.ok) { sync.version = r.version; sync.last = nowISO(); saveSync(); setSyncStatus('idle'); }
    else if (r && r.conflict) { G.fixNext = true; adoptRemote(r, 'Another device changed things first. Reloaded, so redo your last change.'); }
    else setSyncStatus('error');
  } catch (e) { console.warn(e); setSyncStatus('error'); }
}
function syncLine() {
  if (!sync.code) return 'Stored in this browser only';
  if (sync.status === 'syncing') return 'Syncing';
  if (sync.status === 'error') return 'Sync paused ' + DOT + ' cannot reach the cloud';
  return 'Synced across devices' + (sync.last ? ' ' + DOT + ' ' + fmtTime(sync.last) : '');
}

/* ======================================================================
   helpers
   ====================================================================== */
const $ = (sel, root) => (root || document).querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad2 = n => String(n).padStart(2, '0');
const localISO = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => localISO(new Date());
const nowISO = () => new Date().toISOString();
const parseISO = s => { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const ym = d => localISO(d || new Date()).slice(0, 7);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x), 0);
const pctStr = (n, d) => (isFinite(n) ? n : 0).toFixed(d || 0) + '%';
function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

function money(n, o) {
  o = o || {};
  const cents = o.cents !== false;
  n = +n || 0;
  if (!cents) n = Math.round(n);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return (n < 0 ? MINUS : (o.sign && n > 0 ? '+' : '')) + '$' + s;
}
function fmtDate(s, opts) {
  if (!s) return '';
  const d = s instanceof Date ? s : (String(s).length > 10 ? new Date(s) : parseISO(s));
  return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(s) { return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function relDays(n) { if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; return n > 0 ? 'in ' + n + ' days' : (-n) + ' days ago'; }
function relShort(n) { if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; return n > 0 ? 'in ' + n + 'd' : (-n) + 'd ago'; }
const daysUntil = s => Math.round((parseISO(s) - parseISO(todayStr())) / 864e5);
function compact(n) {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
          : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k'
          : a.toFixed(0);
  return (n < 0 ? MINUS : '') + '$' + s;
}

/* ======================================================================
   computations
   ====================================================================== */
const acct = id => S.accounts.find(a => a.id === id);
const typeOf = a => TYPES[a.type] || TYPES.other_asset;
const isAsset = a => typeOf(a).side === 'asset';
const assets = () => S.accounts.filter(isAsset);
const liabilities = () => S.accounts.filter(a => !isAsset(a));
const byGroup = (a, b) => GROUP_ORDER.indexOf(typeOf(a).group) - GROUP_ORDER.indexOf(typeOf(b).group) || b.balance - a.balance;
function totals() {
  const A = sum(assets(), a => a.balance), L = sum(liabilities(), a => a.balance);
  return { A, L, N: A - L };
}

function snapshot() {
  const T = totals(), date = todayStr();
  /* net = assets minus debt; after = the same with this month's withdrawals (unpaid bills, planned expenses) taken out */
  const after = T.N - withdrawals().total;
  const snap = { date, assets: T.A, liabilities: T.L, net: T.N, after };
  const i = S.snapshots.findIndex(s => s.date === date);
  if (i >= 0) S.snapshots[i] = snap; else S.snapshots.push(snap);
  S.snapshots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /* the intraday line: one tick per change (opening the app with nothing changed adds none) */
  if (!Array.isArray(S.ticks)) S.ticks = [];
  const last = S.ticks[S.ticks.length - 1];
  if (!last || last.net !== T.N || last.after !== after) { S.ticks.push({ t: nowISO(), net: T.N, after }); if (S.ticks.length > 3000) S.ticks.splice(0, S.ticks.length - 3000); }
}
function txn(t) {
  S.txns.unshift({ id: t.id || uid(), date: nowISO(), kind: t.kind, amount: +t.amount || 0, from: t.from || null, to: t.to || null, desc: t.desc || '', note: t.note || '' });
  if (S.txns.length > 3000) S.txns.length = 3000;
}
/* every balance change goes through here: snapshot, persist, redraw, say so */
function commit(msg) { G.seq++; snapshot(); save(); render(); if (msg) toast(msg); }

/* money moving out of / into an account. For debts the sign flips: paying into a loan lowers what's owed. */
function applyOut(a, amt) { a.balance += isAsset(a) ? -amt : amt; a.updatedAt = nowISO(); }
function applyIn(a, amt)  { a.balance += isAsset(a) ? amt : -amt; a.updatedAt = nowISO(); }

/* the value a snapshot charts, following the chosen view; older snapshots only carry plain net */
const snapVal = s => (viewAfter() && s.after != null ? s.after : s.net);
/* ---------- net worth over time ---------- */
const RANGES = [['1d', '1D', 'Today'], ['1w', '1W', 'Past week'], ['1m', '1M', 'Past month'], ['3m', '3M', 'Past 3 months'], ['ytd', 'YTD', 'This year'], ['1y', '1Y', 'Past year'], ['all', 'ALL', 'All time']];
const rangeLabel = r => (RANGES.find(x => x[0] === r) || RANGES[2])[2];
function rangeStart(r) {
  const now = new Date();
  switch (r) {
    case '1d': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case '1w': return Date.now() - 7 * 864e5;
    case '1m': return Date.now() - 30 * 864e5;
    case '3m': return Date.now() - 91 * 864e5;
    case 'ytd': return new Date(now.getFullYear(), 0, 1).getTime();
    case '1y': return Date.now() - 365 * 864e5;
    default: return 0;
  }
}
/* the whole line, oldest first: a tick for every change, the daily snapshots for days before ticks existed, and right now */
function netSeries() {
  const tv = t => (viewAfter() && t.after != null ? t.after : t.net);
  const pts = (S.ticks || []).map(t => ({ t: new Date(t.t).getTime(), v: tv(t) })).filter(p => !isNaN(p.t) && isFinite(p.v));
  const tickDays = new Set((S.ticks || []).map(t => String(t.t).slice(0, 10)));
  for (const sn of S.snapshots) if (!tickDays.has(sn.date)) pts.push({ t: parseISO(sn.date).getTime() + 12 * 36e5, v: snapVal(sn) });
  pts.sort((a, b) => a.t - b.t);
  pts.push({ t: Date.now(), v: netShown() });
  return pts;
}
/* the part of the line inside a range, starting from where the line stood when the range began */
function rangeSeries(r) {
  const all = netSeries(), start = rangeStart(r);
  if (!start) return all.length > 1 ? all : [{ t: all[0].t - 864e5, v: all[0].v }].concat(all);
  const before = all.filter(p => p.t < start), inside = all.filter(p => p.t >= start);
  const first = before.length ? before[before.length - 1].v : inside[0].v;
  return [{ t: start, v: first }].concat(inside);
}
/* the change line under the big number: amount, percent, and what span it covers */
function deltaHTML(from, to, label) {
  const amt = to - from, pct = from ? amt / Math.abs(from) * 100 : 0;
  const cls = amt > 0 ? 'pos' : amt < 0 ? 'neg' : 'muted';
  return `<span class="${cls} num">${amt > 0 ? UP : amt < 0 ? DOWN : ''} ${money(Math.abs(amt), { cents: false })} (${pctStr(Math.abs(pct), 2)})</span> <span class="muted">${label}</span>`;
}
function netDelta(days) {
  const snaps = S.snapshots;
  if (snaps.length < 2) return null;
  const cutoff = localISO(new Date(Date.now() - days * 864e5));
  let base = null;
  for (const s of snaps) { if (s.date <= cutoff) base = s; else break; }
  if (!base) base = snaps[0];
  const cur = snaps[snaps.length - 1];
  if (base === cur) return null;
  const b = snapVal(base), c = snapVal(cur);
  return { amt: c - b, pct: b ? (c - b) / Math.abs(b) * 100 : 0, since: base.date };
}

/* goals. A manual goal tracks money set aside for it; a net goal tracks net worth itself and moves on its own. */
const gsaved = g => (g.kind === 'net' ? Math.max(0, netShown()) : g.saved);
const gdone = g => gsaved(g) >= g.target;
const goalPct = g => g.target > 0 ? Math.max(0, Math.min(100, gsaved(g) / g.target * 100)) : 0;
function goalPace(g) {
  if (!g.due || gdone(g)) return null;
  const days = Math.round((parseISO(g.due) - parseISO(todayStr())) / 864e5);
  if (days < 0) return { overdue: true };
  return { perMonth: (g.target - gsaved(g)) / Math.max(1, days / 30.44), days };
}
const earmarked = accountId => sum(S.goals.filter(g => g.kind !== 'net' && g.accountId === accountId), g => Math.min(g.saved, g.target));
/* the goal shown on the overview: the one picked as main, else the nearest unfunded one, else the first */
function mainGoal() {
  if (!S.goals.length) return null;
  const pick = S.goals.find(g => g.id === S.settings.mainGoalId);
  if (pick) return pick;
  const open = S.goals.filter(g => !gdone(g)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return open[0] || S.goals[0];
}
const isMainGoal = g => { const m = mainGoal(); return !!m && m.id === g.id; };

/* repeating items ("bills"): every month on a day, or every week / 2 weeks / year counted from a start date.
   Each occurrence has a key in b.paid: 'YYYY-MM' for monthly (as it always was), the due date for the others. */
const EVERY = { month: 'Every month', week: 'Every week', '2weeks': 'Every 2 weeks', year: 'Every year' };
const EVERY_TAG = { month: 'MONTHLY', week: 'WEEKLY', '2weeks': '2 WEEKS', year: 'YEARLY' };
const PER_MONTH = { month: 1, week: 52 / 12, '2weeks': 26 / 12, year: 1 / 12 };
const MD = { month: 'short', day: 'numeric' };
const dayDiff = (a, b) => Math.round((a - b) / 864e5);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function billDue(b, ref) {
  ref = ref || new Date();
  const y = ref.getFullYear(), m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(Math.max(1, b.day | 0), last));
}
/* the occurrence whose window holds ref: the calendar month, the calendar year, or the 7 / 14 day cycle that the start date sits in.
   Nothing is due before the start date: an item that starts in the future waits for its first date. */
function occAt(b, ref) {
  const every = b.every || 'month', start = b.start ? parseISO(b.start) : null;
  let occ;
  if (every === 'month') occ = { due: billDue(b, ref), key: ym(ref) };
  else if (every === 'year') {
    const a = start || ref, last = new Date(ref.getFullYear(), a.getMonth() + 1, 0).getDate();
    occ = { due: new Date(ref.getFullYear(), a.getMonth(), Math.min(a.getDate(), last)), key: String(ref.getFullYear()) };
  } else {
    const L = every === '2weeks' ? 14 : 7, a = start || ref, w0 = addDays(a, -((a.getDay() + 6) % 7));
    const due = addDays(w0, Math.floor(dayDiff(ref, w0) / L) * L + dayDiff(a, w0));
    occ = { due, key: localISO(due) };
  }
  return start && occ.due < start ? occAt(b, start) : occ;
}
/* the occurrence after this one */
function occAfter(b, occ) {
  const every = b.every || 'month', d = occ.due;
  const ref = every === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : every === 'year' ? new Date(d.getFullYear() + 1, 0, 1) : addDays(d, every === '2weeks' ? 14 : 7);
  return occAt(b, ref);
}
function billStatus(b) {
  const today = parseISO(todayStr()), occ = occAt(b, today), paid = b.paid && b.paid[occ.key], next = occAfter(b, occ).due;
  if (paid) return { state: 'paid', date: paid.date, amount: paid.amount, key: occ.key, next };
  const days = dayDiff(occ.due, today);
  return { state: days < 0 ? 'overdue' : 'due', days, due: occ.due, key: occ.key, next };
}
/* unpaid occurrences due within `days` days, overdue ones included */
function billsDue(days) {
  const today = parseISO(todayStr()), out = [];
  for (const b of S.bills) {
    let occ = occAt(b, today);
    for (let i = 0; i < 60; i++) {
      const d = dayDiff(occ.due, today);
      if (d > days) break;
      if (!(b.paid && b.paid[occ.key])) out.push({ bill: b, due: occ.due, days: d, key: occ.key });
      occ = occAfter(b, occ);
    }
  }
  return out.sort((a, b) => a.due - b.due);
}
/* what the repeating items add up to per month, for the plan page */
const billsMonthly = () => sum(S.bills, b => b.amount * (PER_MONTH[b.every] || 1));
/* still to be paid this month: every unpaid occurrence that falls in the current month, overdue ones included */
function billsLeft() {
  const today = parseISO(todayStr()), first = new Date(today.getFullYear(), today.getMonth(), 1), last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let total = 0;
  for (const b of S.bills) {
    let occ = occAt(b, first);
    for (let i = 0; i < 6 && occ.due <= last; i++) { if (occ.due >= first && !(b.paid && b.paid[occ.key])) total += b.amount; occ = occAfter(b, occ); }
  }
  return total;
}
/* money that is still going to leave this month: bills not yet paid, plus planned one-time expenses.
   The overview shows net worth as it is, or with these already taken out; the switch is remembered. */
function withdrawals() {
  const E = expected(), bills = billsLeft();
  return { bills, out: E.out, inn: E.inn, total: bills + E.out };
}
const viewAfter = () => S.settings.view === 'after';
/* the headline number in the chosen view */
const netShown = () => totals().N - (viewAfter() ? withdrawals().total : 0);

/* upcoming: one-time money in or out. Pending items do not touch balances; marking one done does. */
const pending = () => S.upcoming.filter(u => !u.done);
const sortUpcoming = list => list.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''));
function expected() {
  const p = pending();
  const inn = sum(p.filter(u => u.kind === 'in'), u => u.amount), out = sum(p.filter(u => u.kind !== 'in'), u => u.amount);
  return { inn, out, net: inn - out, count: p.length };
}
/* bills due plus dated one-time items, in date order, for the overview */
function upNext(days) {
  const out = billsDue(days).map(u => ({ date: u.due, days: u.days, name: u.bill.name, amount: u.bill.amount, kind: 'bill' }));
  for (const u of pending()) {
    if (!u.date) continue;
    const d = daysUntil(u.date);
    if (d <= days) out.push({ date: parseISO(u.date), days: d, name: u.name, amount: u.amount, kind: u.kind });
  }
  return out.sort((a, b) => a.date - b.date);
}

/* plan */
function planRows() {
  const base = totals().A, assigned = new Set();
  const rows = S.buckets.map(b => {
    const accts = b.accountIds.map(acct).filter(a => a && isAsset(a));
    accts.forEach(a => assigned.add(a.id));
    const actual = sum(accts, a => a.balance), target = base * b.pct / 100;
    return { b, accts, actual, target, actualPct: base ? actual / base * 100 : 0, diff: actual - target };
  });
  const unassigned = assets().filter(a => !assigned.has(a.id));
  return { base, rows, unassigned, unassignedTotal: sum(unassigned, a => a.balance), pctTotal: sum(S.buckets, b => +b.pct || 0) };
}
function suggestMoves(rows) {
  const over = rows.filter(r => r.diff > 1).map(r => ({ r, amt: r.diff })).sort((a, b) => b.amt - a.amt);
  const under = rows.filter(r => r.diff < -1).map(r => ({ r, amt: -r.diff })).sort((a, b) => b.amt - a.amt);
  const moves = []; let i = 0, j = 0;
  while (i < over.length && j < under.length) {
    const m = Math.min(over[i].amt, under[j].amt);
    moves.push({ from: over[i].r, to: under[j].r, amt: m });
    over[i].amt -= m; under[j].amt -= m;
    if (over[i].amt < 1) i++;
    if (under[j].amt < 1) j++;
  }
  return moves;
}
function movesMsg(P) {
  if (!P.rows.some(r => Math.abs(r.diff) > 1)) return 'On target.';
  if (P.unassignedTotal > 1 && !P.rows.some(r => r.diff > 1)) return 'Assign the ' + money(P.unassignedTotal, { cents: false }) + ' that is not in a bucket yet.';
  if (Math.round(P.pctTotal) !== 100) return 'Targets need to add up to 100% before moves make sense.';
  return 'Nothing to move.';
}

/* ======================================================================
   views
   ====================================================================== */
const VIEW_FN = { overview: vOverview, accounts: vAccounts, plan: vPlan, goals: vGoals, upcoming: vUpcoming, history: vHistory };

function render() {
  G.st = isDesk() ? gameState() : null;   /* the game's player, once per render (desktop), read by the rail, the views and afterRender */
  document.documentElement.dataset.theme = S.settings.theme;
  $('#themeBtn').textContent = 'Looks';
  const tc = $('meta[name="theme-color"]');
  if (tc) tc.content = (THEME_INFO[S.settings.theme] || THEME_INFO.dark).color;
  G.inRender = true;
  try { renderNav(); } finally { G.inRender = false; }
  $('#main').dataset.view = view;
  /* 861px and up gets the desktop layout (see "desktop" below); phones keep the views as they are */
  $('#main').innerHTML = ((isDesk() && DK_FN[view]) || VIEW_FN[view] || vOverview)();
  afterRender();
}
function renderNav() {
  const counts = { accounts: S.accounts.length, goals: S.goals.length, plan: S.buckets.length, upcoming: pending().length + S.bills.filter(b => billStatus(b).state !== 'paid').length };
  /* desk-only bits (hidden below 861px): the shortcut digit, and a hot badge when something is due within a week */
  const hot = upNext(7).some(u => u.kind !== 'in');
  const navFrom = isDesk() && G.navView && G.navView !== view ? (() => { const o = $('#nav .nav-item.on'); return o ? o.getBoundingClientRect() : null; })() : null;
  $('#nav').innerHTML = VIEWS.map((v, i) => '<a href="#' + v.id + '" class="nav-item' + (v.id === view ? ' on' : '') + '"' + (isDesk() ? ' title="' + v.label + ' (' + (i + 1) + ')"' : '') + '>' + icon(v.id) + '<span class="nav-label">' + v.label + '</span>' + (counts[v.id] ? '<span class="nav-n num' + (v.id === 'upcoming' && hot ? ' hot' : '') + '">' + counts[v.id] + '</span>' : '') + '<span class="desk-only dk-k">' + (i + 1) + '</span></a>').join('');
  const lb = S.settings.lastBackup;
  $('#sideStatus').innerHTML = esc(syncLine()) + '<br>' + (lb ? 'Backed up ' + fmtDate(lb, { month: 'short', day: 'numeric' }) : 'Never backed up');
  const tk = $('#dkTicker');
  if (tk) tk.innerHTML = S.accounts.length ? dkTickerHTML() : '';
  gameNav();
  if (isDesk()) { if (navFrom) gNavSlide(navFrom); G.navView = view; } else G.navView = null;
}
function afterRender() {
  if (isDesk()) { drawChart(); gameAfterRender(); return; }
  const hero = $('[data-count]');
  if (hero) countUp(hero, parseFloat(hero.dataset.count));
  drawChart();
}
function countUp(el, to) {
  const from = shownNet == null ? 0 : shownNet;
  shownNet = to;
  if (Math.abs(from - to) < 1) { el.textContent = money(to, { cents: false }); return; }
  const t0 = performance.now(), dur = 650;
  const step = now => {
    const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    el.textContent = money(from + (to - from) * e, { cents: false });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- overview ---------- */
function vOverview() {
  if (!S.accounts.length) return vWelcome();
  const T = totals(), d = netDelta(30);
  const up = upNext(30).slice(0, 7), W = withdrawals(), after = viewAfter(), NW = netShown(), mg = mainGoal();
  const parts = [W.bills ? `<span class="num neg">${MINUS}${money(W.bills, { cents: false })}</span> bills` : '', W.out ? `<span class="num neg">${MINUS}${money(W.out, { cents: false })}</span> planned` : ''].filter(Boolean).join(' ' + DOT + ' ');
  const P = planRows();
  const drift = P.rows.filter(r => Math.abs(r.diff) > 1).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 4);
  const pts = rangeSeries(chartRange), firstV = pts[0].v, lastV = pts[pts.length - 1].v;
  const deltaHtml = d
    ? `<span class="${d.amt >= 0 ? 'pos' : 'neg'} num">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })} ${DOT} ${pctStr(Math.abs(d.pct), 1)}</span> <span class="muted">since ${fmtDate(d.since, { month: 'short', day: 'numeric' })}</span>`
    : `<span class="muted">No movement recorded yet. Update a balance on another day and this fills in.</span>`;
  return `
  <header class="hero">
    <div>
      <div class="hero-top">
        <span class="label">${word('Net worth')}${after ? ` <span class="muted">${DOT} after withdrawals</span>` : ''} <span class="lvl">${word('LVL')} ${level(NW)}</span></span>
        <div class="seg"><button class="${after ? '' : 'on'}" data-action="view" data-view="now">As is</button><button class="${after ? 'on' : ''}" data-action="view" data-view="after">After withdrawals</button></div>
      </div>
      <div class="hero-num num" data-count="${NW}">${money(NW, { cents: false })}</div>
      <div class="hero-delta">${deltaHtml}</div>
      ${W.total > 0
        ? `<div class="hero-note small muted">${after ? `<span class="num">${money(T.N, { cents: false })}</span> before withdrawals ${DOT} ` : 'Still to come out this month: '}${parts}</div>`
        : `<div class="hero-note small muted">Nothing left to come out this month.</div>`}
      ${W.inn ? `<div class="hero-note small muted">Expected in: <span class="num pos">+${money(W.inn, { cents: false })}</span>, not counted until it lands</div>` : ''}
    </div>
    <div class="hero-r">
      <div class="stat"><div class="label">Assets</div><div class="num pos">${money(T.A, { cents: false })}</div></div>
      <div class="stat"><div class="label">Debt</div><div class="num${T.L ? ' neg' : ''}">${T.L ? MINUS : ''}${money(T.L, { cents: false })}</div></div>
      <div class="stat"><div class="label">${word('Bills left')}</div><div class="num${W.bills ? ' neg' : ''}">${W.bills ? MINUS : ''}${money(W.bills, { cents: false })}</div></div>
    </div>
  </header>
  ${mg ? mainGoalPanel(mg) : ''}
  <section class="panel chart-panel${lastV >= firstV ? ' up' : ' down'}">
    <div class="panel-head"><span class="label">Net worth over time${after ? ` ${DOT} after withdrawals` : ''}</span><span class="small">${deltaHTML(firstV, lastV, rangeLabel(chartRange))}</span></div>
    <div class="chart-wrap" id="chart"></div>
    <div class="ranges"><span class="live"><i></i>LIVE</span>${RANGES.map(r => `<button class="${chartRange === r[0] ? 'on' : ''}" data-action="range" data-range="${r[0]}">${r[1]}</button>`).join('')}</div>
  </section>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-head"><span class="label">${word('Where it sits')}</span><a class="link" href="#accounts">All accounts</a></div>
      ${accountGroups()}
    </section>
    <div class="stack">
      <section class="panel">
        <div class="panel-head"><span class="label">${word('Coming up')}</span><a class="link" href="#upcoming">All upcoming</a></div>
        ${up.length
          ? `<ul class="list">${up.map(u => `<li><span class="num muted w-date">${fmtDate(u.date, { month: 'short', day: 'numeric' })}</span>${u.kind !== 'bill' ? `<span class="tag ${u.kind === 'in' ? 'pos-tag' : 'neg-tag'}">${u.kind === 'in' ? 'IN' : 'OUT'}</span>` : ''}<span class="grow">${esc(u.name)}</span>${u.days < 0 && u.kind === 'bill' ? '<span class="tag neg-tag">late</span>' : ''}<span class="num ${u.kind === 'in' ? 'pos' : 'neg'}">${u.kind === 'in' ? '+' : MINUS}${money(u.amount)}</span></li>`).join('')}</ul>`
          : `<p class="empty">${S.bills.length || S.upcoming.length ? 'Nothing in the next 30 days.' : 'No bills or upcoming items yet.'}</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><span class="label">Goals</span><a class="link" href="#goals">All goals</a></div>
        ${S.goals.length
          ? S.goals.slice(0, 4).map(g => `<div class="mini-goal"><div class="row"><span class="grow">${esc(g.name)}${isMainGoal(g) ? ' <span class="tag">MAIN</span>' : ''}</span><span class="num muted small">${money(gsaved(g), { cents: false })} / ${money(g.target, { cents: false })}</span></div><div class="bar"><i class="${gdone(g) ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div></div>`).join('')
          : `<p class="empty">No goals yet.</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><span class="label">${word('Plan drift')}</span><a class="link" href="#plan">Plan</a></div>
        ${drift.length
          ? `<ul class="list">${drift.map(r => `<li><span class="grow">${esc(r.b.name)}</span><span class="muted small">${r.diff > 0 ? 'over' : 'under'}</span><span class="num">${money(Math.abs(r.diff), { cents: false })}</span></li>`).join('')}</ul>`
          : `<p class="empty">${S.buckets.length ? 'On target.' : 'No plan set.'}</p>`}
      </section>
    </div>
  </div>`;
}
/* a segmented meter: 24 blocks, filled left to right, the partial block filled in proportion */
function meterHTML(pct, done) {
  const n = 24, f = pct / 100 * n;
  return `<div class="meter${done ? ' done' : ''}">${Array.from({ length: n }, (_, i) => `<i><b style="width:${Math.round(Math.max(0, Math.min(1, f - i)) * 100)}%"></b></i>`).join('')}<s class="token" style="left:${Math.max(2, Math.min(98, pct)).toFixed(1)}%"></s></div>`;
}
function mainGoalPanel(g) {
  const net = g.kind === 'net', saved = gsaved(g), done = saved >= g.target, pct = goalPct(g), a = !net && g.accountId && acct(g.accountId), p = goalPace(g);
  const d = net && !done ? netDelta(30) : null;
  const bits = [net ? 'Follows your net worth' : a ? 'Held in ' + esc(a.name) : '', g.due ? (done ? 'Target date ' : 'By ') + fmtDate(g.due) : ''].filter(Boolean);
  const toGo = money(g.target - saved, { cents: false }) + ' to go';
  const pace = done ? '<span class="pos">Funded. Pick the next one on the Goals page.</span>'
    : p ? (p.overdue ? '<span class="warn">Past the target date</span> ' + DOT + ' ' + toGo
                     : `<b class="num">${money(p.perMonth, { cents: false })}</b>/mo to make it ${DOT} ${p.days} day${p.days === 1 ? '' : 's'} left`)
    : toGo;
  const trend = d ? `<div class="small"><span class="${d.amt >= 0 ? 'pos' : 'neg'} num">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })}</span> <span class="muted">since ${fmtDate(d.since, { month: 'short', day: 'numeric' })}</span></div>` : '';
  return `<section class="panel">
    <div class="panel-head"><span class="label">${word('Main goal')}</span><span class="links">${S.goals.length > 1 ? '<a class="link" href="#goals">Change</a>' : ''}<a class="link" href="#goals">All goals</a></span></div>
    <div class="mg">
      <div>
        <div class="mg-name">${esc(g.name)}</div>
        <div class="goal-nums"><span class="num big">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span></div>
        ${bits.length ? `<div class="muted small">${bits.join(' ' + DOT + ' ')}</div>` : ''}
      </div>
      <div>
        <div class="row"><span class="mg-pct num${done ? ' pos' : ''}">${pctStr(pct)}</span><span class="grow"></span><span class="small muted">${done ? 'funded' : 'of the way there'}</span></div>
        ${meterHTML(pct, done)}
        <div class="stars">${[1, 2, 3, 4, 5].map(i => `<i class="${pct >= i * 20 - 0.5 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="small muted">${pace}</div>
        ${trend}
      </div>
      <div class="mg-act">${done ? '' : net ? `<a class="btn btn-primary" href="#accounts">Update balances</a>` : `<button class="btn btn-primary" data-action="fund-goal" data-id="${g.id}">Add funds</button>`}</div>
    </div>
  </section>`;
}
function vWelcome() {
  return `
  <header class="hero"><div><div class="label">Net worth</div><div class="hero-num num">$0</div><div class="hero-delta muted">Nothing tracked yet.</div></div></header>
  <section class="panel welcome">
    <h2>Start with the accounts.</h2>
    <p>Add every place money lives or is owed: checking, savings, brokerage, retirement, credit cards, the car loan. Wall Street adds it up, keeps a running history, and the plan, goals and bills all hang off those balances.</p>
    <div class="row"><button class="btn btn-primary" data-action="add-account">Add an account</button><button class="btn" data-action="demo">Load example data</button>${SYNC.url ? '<button class="btn" data-action="sync-join">I have a sync code</button>' : ''}</div>
    <p class="small" style="margin:14px 0 0">Example data is made up. Wipe it any time from History.${SYNC.url ? ' Already using Wall Street on another device or in another browser? Turn on sync there (History) and enter its code here.' : ''}</p>
  </section>`;
}
function accountGroups() {
  return GROUP_ORDER.map(g => {
    const list = S.accounts.filter(a => typeOf(a).group === g).sort((a, b) => b.balance - a.balance);
    if (!list.length) return '';
    const t = sum(list, a => a.balance), debt = g === 'debt';
    return `<div class="group">
      <div class="group-head"><span>${GROUPS[g]}</span><span class="num ${debt ? 'neg' : 'pos'}">${debt ? MINUS : ''}${money(t, { cents: false })}</span></div>
      ${list.map(a => `<div class="row acct-row" data-action="update-balance" data-id="${a.id}" title="Update balance"><span class="tag">${typeOf(a).tag}</span><span class="grow">${esc(a.name)}${a.inst ? `<span class="muted"> ${DOT} ${esc(a.inst)}</span>` : ''}</span><span class="num ${debt ? 'neg' : 'pos'}">${debt ? MINUS : ''}${money(a.balance)}</span></div>`).join('')}
    </div>`;
  }).join('');
}

/* ---------- accounts ---------- */
function vAccounts() {
  const T = totals();
  const head = `<header class="page-head"><div><h1>Accounts</h1><p class="sub">Every place money lives or is owed. Update a balance whenever it changes; history is kept automatically.</p></div>
    <div class="row"><button class="btn" data-action="transfer"${S.accounts.length < 2 ? ' disabled' : ''}>Transfer</button><button class="btn btn-primary" data-action="add-account">Add account</button></div></header>`;
  if (!S.accounts.length) return head + `<section class="panel"><p class="empty">No accounts yet.</p></section>`;
  const block = side => {
    const list = S.accounts.filter(a => typeOf(a).side === side).sort(byGroup);
    if (!list.length) return '';
    const debt = side === 'liability';
    return `<section class="panel"><div class="panel-head"><span class="label">${debt ? 'Debt' : 'Assets'}</span><span class="num ${debt ? 'neg' : 'pos'}">${debt ? MINUS : ''}${money(sum(list, a => a.balance))}</span></div>
    ${list.map(a => { const em = earmarked(a.id); return `<div class="rrow">
      <span class="tag">${typeOf(a).tag}</span>
      <div class="what"><div class="strong">${esc(a.name)}</div><div class="sub">${typeOf(a).label}${a.inst ? ` ${DOT} ${esc(a.inst)}` : ''}${a.updatedAt ? ` ${DOT} updated ${fmtDate(a.updatedAt, { month: 'short', day: 'numeric' })}` : ''}</div></div>
      <div class="amt"><div class="num ${debt ? 'neg' : 'pos'}">${debt ? MINUS : ''}${money(a.balance)}</div>${em ? `<div class="muted small">${money(em, { cents: false })} earmarked</div>` : ''}</div>
      <div class="acts"><button class="btn btn-sm" data-action="update-balance" data-id="${a.id}">Update</button><button class="btn btn-sm btn-ghost" data-action="edit-account" data-id="${a.id}">Edit</button></div>
    </div>`; }).join('')}
    </section>`;
  };
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Assets</div><div class="num big pos">${money(T.A, { cents: false })}</div></div>
      <div class="stat"><div class="label">Debt</div><div class="num big${T.L ? ' neg' : ''}">${T.L ? MINUS : ''}${money(T.L, { cents: false })}</div></div>
      <div class="stat"><div class="label">Net worth</div><div class="num big">${money(T.N, { cents: false })}</div></div>
    </div>` + block('asset') + block('liability');
}

/* ---------- plan ---------- */
function vPlan() {
  const P = planRows(), moves = suggestMoves(P.rows);
  const income = +S.settings.income || 0, billsTotal = billsMonthly(), free = income - billsTotal;
  const head = `<header class="page-head"><div><h1>Plan</h1><p class="sub">Where your money should sit. Give each bucket a share of total assets, assign accounts to it, and Wall Street shows the gap.</p></div>
    <div class="row"><button class="btn btn-primary" data-action="add-bucket">Add bucket</button></div></header>`;
  if (!S.buckets.length) return head + `<section class="panel welcome"><h2>No plan yet.</h2><p>A plan is a few buckets with a target percentage each: say 10% cash on hand, 25% emergency fund, 65% invested. Start from the template or build your own.</p><div class="row"><button class="btn btn-primary" data-action="plan-template">Use the template</button><button class="btn" data-action="add-bucket">Add a bucket</button></div></section>`;
  const warn = Math.round(P.pctTotal) !== 100 ? ` <span class="warn">Targets add up to ${pctStr(P.pctTotal)}, aim for 100%.</span>` : '';
  return head + `
  <section class="panel">
    <div class="panel-head"><span class="label">Holdings vs target</span><span class="muted small">of ${money(P.base, { cents: false })} in assets${warn}</span></div>
    ${P.rows.map(r => `<div class="bucket" data-action="edit-bucket" data-id="${r.b.id}">
      <div class="row"><span class="strong grow">${esc(r.b.name)}</span><span class="num">${money(r.actual, { cents: false })}</span></div>
      <div class="row small muted"><span class="grow">${r.accts.length ? r.accts.map(a => esc(a.name)).join(', ') : 'No accounts assigned'}</span><span class="num">${pctStr(r.actualPct, 1)} of ${pctStr(r.b.pct, 0)}</span></div>
      <div class="tbar"><i class="fill" style="width:${Math.min(100, r.actualPct)}%"></i><i class="mark" style="left:${Math.min(100, r.b.pct)}%"></i></div>
      <div class="row small"><span class="grow muted">target ${money(r.target, { cents: false })}</span><span class="num${Math.abs(r.diff) <= 1 ? ' muted' : ''}">${Math.abs(r.diff) <= 1 ? 'on target' : (r.diff > 0 ? 'over by ' : 'under by ') + money(Math.abs(r.diff), { cents: false })}</span></div>
    </div>`).join('')}
    ${P.unassigned.length ? `<div class="bucket unassigned"><div class="row"><span class="strong grow muted">Unassigned</span><span class="num muted">${money(P.unassignedTotal, { cents: false })}</span></div><div class="row small muted"><span class="grow">${P.unassigned.map(a => esc(a.name)).join(', ')}</span><span class="num">${pctStr(P.base ? P.unassignedTotal / P.base * 100 : 0, 1)}</span></div></div>` : ''}
  </section>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-head"><span class="label">To get on target</span></div>
      ${moves.length
        ? `<ul class="list">${moves.map(m => `<li><span class="grow">Move <b class="num">${money(m.amt, { cents: false })}</b> from ${esc(m.from.b.name)} to ${esc(m.to.b.name)}</span></li>`).join('')}</ul>`
        : `<p class="empty">${movesMsg(P)}</p>`}
      ${moves.length && P.unassignedTotal > 1 ? `<p class="muted small pad">${money(P.unassignedTotal, { cents: false })} is unassigned and not counted toward any bucket.</p>` : ''}
    </section>
    <section class="panel">
      <div class="panel-head"><span class="label">New money each month</span></div>
      <div class="income-row"><label class="label" for="income">Monthly take-home</label><div class="inp-money"><span>$</span><input id="income" class="inp num" type="text" inputmode="decimal" value="${income ? income : ''}" placeholder="0" data-action="set-income"></div></div>
      ${income > 0
        ? `<div class="kv"><span class="muted">Bills</span><span class="num neg">${MINUS}${money(billsTotal, { cents: false })}</span></div><div class="kv strong"><span>Free to allocate</span><span class="num ${free < 0 ? 'neg' : 'pos'}">${money(free, { cents: false })}</span></div>
           ${free > 0
             ? `<ul class="list">${P.rows.map(r => `<li><span class="grow">${esc(r.b.name)}</span><span class="muted small">${pctStr(r.b.pct)}</span><span class="num w-amt">${money(free * r.b.pct / 100, { cents: false })}</span></li>`).join('')}</ul>`
             : `<p class="empty">Bills exceed income.</p>`}`
        : `<p class="empty">Enter take-home pay to see how to split what is left after bills, using the same targets.</p>`}
    </section>
  </div>`;
}

/* ---------- goals ---------- */
function goalLine(g) {
  if (!g.due) return '';
  if (gdone(g)) return `<div class="goal-line">Target date ${fmtDate(g.due)}</div>`;
  const p = goalPace(g);
  if (p.overdue) return `<div class="goal-line"><span class="warn">Past ${fmtDate(g.due)}</span> ${DOT} ${money(g.target - gsaved(g), { cents: false })} to go</div>`;
  return `<div class="goal-line">By ${fmtDate(g.due)} ${DOT} <span class="num">${money(p.perMonth, { cents: false })}</span>/mo to make it</div>`;
}
function vGoals() {
  const gT = sum(S.goals, g => g.target), gS = sum(S.goals, g => Math.min(gsaved(g), g.target));
  const head = `<header class="page-head"><div><h1>Goals</h1><p class="sub">Money set aside for something specific. The funds live in an account; a goal just earmarks them. The main goal is the one the overview tracks.</p></div>
    <div class="row"><button class="btn btn-primary" data-action="add-goal">Add goal</button></div></header>`;
  if (!S.goals.length) return head + `<section class="panel"><p class="empty">No goals yet. A goal is a name, a target, and optionally a date and the account the money sits in.</p></section>`;
  const sorted = S.goals.slice().sort((a, b) => (gdone(a) - gdone(b)) || (isMainGoal(b) - isMainGoal(a)) || (a.due || '9999').localeCompare(b.due || '9999'));
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Saved toward goals</div><div class="num big">${money(gS, { cents: false })}</div></div>
      <div class="stat"><div class="label">Total targets</div><div class="num big">${money(gT, { cents: false })}</div></div>
      <div class="stat"><div class="label">Funded</div><div class="num big">${gT ? pctStr(gS / gT * 100) : DASH}</div></div>
    </div>
  <div class="goal-grid">${sorted.map(g => {
    const net = g.kind === 'net', saved = gsaved(g), done = saved >= g.target, a = !net && g.accountId && acct(g.accountId), main = isMainGoal(g);
    return `<section class="panel goal${done ? ' done' : ''}">
      <div class="row"><span class="strong grow">${esc(g.name)}</span>${main ? '<span class="tag">MAIN</span>' : ''}${done ? `<span class="tag pos-tag">${word('Funded')}</span>` : ''}</div>
      <div class="goal-nums"><span class="num big">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span></div>
      <div class="bar"><i class="${done ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div>
      <div class="row small muted"><span class="grow">${net ? 'Follows your net worth' : a ? 'Held in ' + esc(a.name) : 'Not linked to an account'}</span><span class="num">${pctStr(goalPct(g))}</span></div>
      ${goalLine(g)}
      <div class="row top">${net ? `<a class="btn btn-sm btn-primary" href="#accounts">Update balances</a>` : `<button class="btn btn-sm btn-primary" data-action="fund-goal" data-id="${g.id}">Add funds</button>`}<button class="btn btn-sm btn-ghost" data-action="edit-goal" data-id="${g.id}">Edit</button>${main || S.goals.length < 2 ? '' : `<button class="btn btn-sm btn-ghost" data-action="main-goal" data-id="${g.id}">Make main</button>`}</div>
    </section>`; }).join('')}</div>`;
}

/* ---------- upcoming: repeating items and one-time money, in one list ---------- */
function vUpcoming() {
  const E = expected(), T = totals(), today = parseISO(todayStr());
  const head = `<header class="page-head"><div><h1>Upcoming</h1><p class="sub">Everything on the horizon: bills that come back on their day, and one-time money in or out. Nothing touches a balance until you mark it paid or received.</p></div>
    <div class="row"><button class="btn btn-primary" data-action="add-upcoming">Add</button></div></header>`;
  if (!S.bills.length && !S.upcoming.length) return head + `<section class="panel"><p class="empty">Nothing yet. Add rent, the car payment, a subscription, a refund you are waiting on, or a purchase you are planning.</p></section>`;
  const dateCol = (due, d) => `<div class="w-date"><div class="num small">${fmtDate(due, MD)}</div><div class="small ${d < 0 ? 'neg' : 'muted'}">${d < 0 ? (-d) + 'd late' : relShort(d)}</div></div>`;
  const rowOne = u => {
    const inn = u.kind === 'in', a = acct(u.accountId), d = u.date ? daysUntil(u.date) : null;
    const sub = [a ? (inn ? 'into ' : 'from ') + esc(a.name) : '', u.note ? esc(u.note) : ''].filter(Boolean).join(' ' + DOT + ' ');
    return `<div class="rrow">
      ${u.date ? dateCol(u.date, d) : `<div class="w-date"><div class="small muted">no date</div></div>`}
      <span class="tag ${inn ? 'pos-tag' : 'neg-tag'}">${inn ? 'IN' : 'OUT'}</span>
      <div class="what"><div class="strong">${esc(u.name)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <div class="amt"><div class="num ${inn ? 'pos' : 'neg'}">${inn ? '+' : MINUS}${money(u.amount)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-primary" data-action="done-upcoming" data-id="${u.id}">${inn ? 'Received' : 'Paid'}</button><button class="btn btn-sm btn-ghost" data-action="edit-upcoming" data-id="${u.id}">Edit</button></div>
    </div>`;
  };
  const rowBill = (b, st) => {
    const from = acct(b.from), to = acct(b.to), paid = st.state === 'paid', due = paid ? st.next : st.due, d = dayDiff(due, today);
    const sub = [from ? 'from ' + esc(from.name) : '<span class="warn">no account</span>', to ? 'pays down ' + esc(to.name) : '', b.note ? esc(b.note) : '', paid ? `<span class="pos">paid ${fmtDate(st.date, MD)}</span>` : ''].filter(Boolean).join(' ' + DOT + ' ');
    return `<div class="rrow">
      ${dateCol(due, d)}
      <span class="tag rep">${EVERY_TAG[b.every] || 'MONTHLY'}</span>
      <div class="what"><div class="strong">${esc(b.name)}</div><div class="sub">${sub}</div></div>
      <div class="amt"><div class="num neg">${MINUS}${money(b.amount)}</div></div>
      <div class="acts">${paid ? '' : `<button class="btn btn-sm btn-primary" data-action="pay-bill" data-id="${b.id}">Pay</button>`}<button class="btn btn-sm btn-ghost" data-action="edit-upcoming" data-type="bill" data-id="${b.id}">Edit</button></div>
    </div>`;
  };
  const doneOne = u => {
    const inn = u.kind === 'in', a = acct(u.done.accountId);
    return `<div class="rrow dim">
      <div class="w-date"><div class="num small">${fmtDate(u.done.date, MD)}</div></div>
      <span class="tag">${inn ? 'IN' : 'OUT'}</span>
      <div class="what"><div class="strong">${esc(u.name)}</div><div class="sub">${inn ? 'Received' : 'Paid'}${a ? (inn ? ' into ' : ' from ') + esc(a.name) : ''}</div></div>
      <div class="amt"><div class="num">${inn ? '+' : MINUS}${money(u.done.amount)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-ghost" data-action="undo-upcoming" data-id="${u.id}">Undo</button><button class="btn btn-sm btn-ghost" data-action="edit-upcoming" data-id="${u.id}">Edit</button></div>
    </div>`;
  };
  const doneBill = (b, st) => {
    const p = b.paid[st.key] || {}, from = acct(p.from), to = acct(p.to);
    return `<div class="rrow dim">
      <div class="w-date"><div class="num small">${fmtDate(st.date, MD)}</div></div>
      <span class="tag">${EVERY_TAG[b.every] || 'MONTHLY'}</span>
      <div class="what"><div class="strong">${esc(b.name)}</div><div class="sub">Paid${from ? ' from ' + esc(from.name) : ''}${to ? ' ' + DOT + ' paid down ' + esc(to.name) : ''}</div></div>
      <div class="amt"><div class="num">${MINUS}${money(st.amount)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-ghost" data-action="unpay-bill" data-id="${b.id}">Undo</button></div>
    </div>`;
  };
  /* pending: one-time items by date, and each repeating item at its next unpaid occurrence (or the one after, once this one is paid) */
  const items = pending().map(u => ({ date: u.date ? +parseISO(u.date) : Infinity, sub: u.createdAt || '', html: rowOne(u) }));
  const done = S.upcoming.filter(u => u.done).map(u => ({ date: u.done.date || '', html: doneOne(u) }));
  for (const b of S.bills) {
    const st = billStatus(b);
    items.push({ date: +(st.state === 'paid' ? st.next : st.due), sub: '', html: rowBill(b, st) });
    if (st.state === 'paid') done.push({ date: st.date || '', html: doneBill(b, st) });
  }
  items.sort((a, b) => a.date - b.date || a.sub.localeCompare(b.sub));
  done.sort((a, b) => b.date.localeCompare(a.date));
  const bills = billsLeft(), afterAll = T.N + E.inn - E.out - bills;
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Coming in</div><div class="num big${E.inn ? ' pos' : ''}">${E.inn ? '+' : ''}${money(E.inn, { cents: false })}</div></div>
      <div class="stat"><div class="label">Going out</div><div class="num big${E.out ? ' neg' : ''}">${E.out ? MINUS : ''}${money(E.out, { cents: false })}</div></div>
      <div class="stat"><div class="label">${word('Bills left')} this month</div><div class="num big${bills ? ' neg' : ''}">${bills ? MINUS : ''}${money(bills, { cents: false })}</div></div>
      <div class="stat"><div class="label">${word('Net worth')} now</div><div class="num big">${money(T.N, { cents: false })}</div></div>
      <div class="stat"><div class="label">After everything pending</div><div class="num big${afterAll < T.N ? ' neg' : afterAll > T.N ? ' pos' : ''}">${money(afterAll, { cents: false })}</div></div>
    </div>
  <section class="panel"><div class="panel-head"><span class="label">Pending</span><span class="muted small">${items.length} item${items.length === 1 ? '' : 's'} ${DOT} date order</span></div>
    ${items.length ? items.map(i => i.html).join('') : `<p class="empty">Everything here is done.</p>`}
  </section>
  ${done.length ? `<section class="panel"><div class="panel-head"><span class="label">Done</span><span class="muted small">newest first</span></div>${done.slice(0, 20).map(i => i.html).join('')}</section>` : ''}`;
}

/* ---------- history ---------- */
function amtText(t) {
  switch (t.kind) {
    case 'update': case 'add': case 'remove': case 'reverse': return money(t.amount, { sign: true });
    case 'payment': case 'expense': return MINUS + money(t.amount);
    case 'income': return '+' + money(t.amount);
    default: return money(t.amount);
  }
}
function amtClass(t) {
  switch (t.kind) {
    case 'update': case 'add': case 'remove': case 'reverse': return t.amount > 0 ? 'pos' : t.amount < 0 ? 'neg' : 'muted';
    case 'payment': case 'expense': return 'neg';
    case 'income': return 'pos';
    case 'goal': return 'accent';
    default: return '';
  }
}
function vHistory() {
  const kinds = { all: 'All', update: 'Updates', transfer: 'Transfers', payment: 'Payments', oneoff: 'One-time', goal: 'Goals', add: 'Accounts' };
  const match = t => histFilter === 'all' || t.kind === histFilter
    || (histFilter === 'add' && t.kind === 'remove') || (histFilter === 'payment' && t.kind === 'reverse')
    || (histFilter === 'oneoff' && (t.kind === 'income' || t.kind === 'expense'));
  const list = S.txns.filter(match).slice(0, 300);
  const head = `<header class="page-head"><div><h1>History</h1><p class="sub">Every change, newest first. A net worth snapshot is taken automatically each day you open the app or change something.</p></div></header>`;
  return head + `
  <section class="panel">
    <div class="panel-head"><span class="label">Changes</span><div class="seg wrap">${Object.keys(kinds).map(k => `<button class="${histFilter === k ? 'on' : ''}" data-action="hist-filter" data-k="${k}">${kinds[k]}</button>`).join('')}</div></div>
    ${list.length
      ? `<table class="tbl compact"><thead><tr><th>When</th><th class="w-tag hide-sm"></th><th>What</th><th class="r">Amount</th></tr></thead><tbody>
         ${list.map(t => `<tr><td class="muted small num" style="white-space:nowrap">${fmtDate(t.date, { month: 'short', day: 'numeric' })} <span class="hide-sm" style="opacity:.6">${fmtTime(t.date)}</span></td><td class="hide-sm"><span class="tag">${KIND_TAG[t.kind] || t.kind}</span></td><td>${esc(t.desc)}${t.note ? `<span class="muted small"> ${DOT} ${esc(t.note)}</span>` : ''}</td><td class="r num ${amtClass(t)}">${amtText(t)}</td></tr>`).join('')}
         </tbody></table>`
      : `<p class="empty">Nothing here yet.</p>`}
  </section>
  <section class="panel">
    <div class="panel-head"><span class="label">Snapshots</span><span class="muted small">${S.snapshots.length} day${S.snapshots.length === 1 ? '' : 's'} recorded</span></div>
    ${S.snapshots.length
      ? `<table class="tbl compact"><thead><tr><th>Date</th><th class="r hide-sm">Assets</th><th class="r hide-sm">Debt</th><th class="r">Net worth</th></tr></thead><tbody>
         ${S.snapshots.slice().reverse().slice(0, 30).map(s => `<tr><td class="muted">${fmtDate(s.date)}</td><td class="r num pos hide-sm">${money(s.assets, { cents: false })}</td><td class="r num neg hide-sm">${s.liabilities ? MINUS : ''}${money(s.liabilities, { cents: false })}</td><td class="r num strong">${money(snapVal(s), { cents: false })}</td></tr>`).join('')}
         </tbody></table>`
      : `<p class="empty">No snapshots yet.</p>`}
  </section>
  <section class="panel">
    <div class="panel-head"><span class="label">Settings</span></div>
    <div class="data-row"><div><div class="strong">Look</div><div class="muted small">Now: <b>${esc((THEME_INFO[S.settings.theme] || THEME_INFO.dark).name)}</b>. ${THEMES.length} to choose from; the choice follows you to every synced device.</div></div><div class="row acts"><button class="btn" data-action="toggle-theme">Choose a look</button></div></div>
    ${SYNC.url ? `<div class="data-row"><div><div class="strong">Sync across devices</div><div class="muted small">${sync.code
      ? `On. Your code is <b class="num">${prettyCode(sync.code)}</b>. Enter it on another device to see the same numbers there.${sync.last ? ' Last synced ' + fmtDate(sync.last, { month: 'short', day: 'numeric' }) + ' ' + fmtTime(sync.last) + '.' : ''}${sync.status === 'error' ? ' <span class="warn">Cannot reach the cloud right now.</span>' : ''}`
      : 'Keep the same numbers on your computer, laptop and phone. Turn it on here, then enter the code it gives you on each other device.'}</div></div>
      <div class="row acts">${sync.code
        ? `<button class="btn" data-action="sync-copy">Copy code</button><button class="btn" data-action="sync-now">Sync now</button><button class="btn btn-ghost" data-action="sync-off">Turn off</button>`
        : `<button class="btn btn-primary" data-action="sync-on">Turn on sync</button><button class="btn" data-action="sync-join">I have a code</button>`}</div></div>` : ''}
    <div class="data-row"><div><div class="strong">Backup</div><div class="muted small">Download everything as one JSON file. This app keeps its data in this browser only, so keep a copy somewhere safe.</div></div><button class="btn" data-action="export">Download backup</button></div>
    <div class="data-row"><div><div class="strong">Restore</div><div class="muted small">Load a backup file. Replaces what is here.</div></div><button class="btn" data-action="import">Choose file</button></div>
    ${prevCopies().length ? `<div class="data-row"><div><div class="strong">Previous copies</div><div class="muted small">Safety copies this device kept before anything replaced its numbers, plus one a day. Going back to one replaces what is here now.</div>
      <ul class="list copies">${prevCopies().map((c, i) => `<li><span class="num muted w-date">${fmtDate(c.at, { month: 'short', day: 'numeric' })}</span><span class="grow">${esc(c.reason)} <span class="muted small">${DOT} ${fmtTime(c.at)} ${DOT} ${c.accounts} account${c.accounts === 1 ? '' : 's'}</span></span><button class="btn btn-sm btn-ghost" data-action="restore-copy" data-i="${i}">Go back</button></li>`).join('')}</ul></div></div>` : ''}
    <div class="data-row"><div><div class="strong">Start over</div><div class="muted small">Wipe all accounts, goals, bills, upcoming, plan and history${sync.code ? ', here and on every synced device' : ''}.</div></div><button class="btn btn-danger" data-action="reset">Erase everything</button></div>
  </section>`;
}

/* ======================================================================
   desktop (861px and up): the pro layout. Every page gets a sticky bar with its actions, a summary strip,
   sortable tables, and a detail panel beside the list for the selected row; the keyboard drives it all.
   Below 861px none of this renders: render() uses the phone views above, untouched.
   ====================================================================== */
const DESK = window.matchMedia ? window.matchMedia('(min-width: 861px)') : null;
function isDesk() { return !!(DESK && DESK.matches); }
const DK_FN = { overview: dkOverview, accounts: dkAccounts, plan: dkPlan, goals: dkGoals, upcoming: dkUpcoming, history: dkHistory };
const DK_INSP = { accounts: inspAccount, plan: inspBucket, goals: inspGoal, upcoming: inspUpcoming, history: inspHistory };
const dkSel = {};                 /* the selected row per page: its data-sel key */
const DK_SORT_DEF = { accounts: { k: 'group', dir: 1 }, upcoming: { k: 'date', dir: 1 }, changes: { k: 'date', dir: -1 }, snaps: { k: 'date', dir: -1 }, goals: { k: 'order', dir: 1 }, plan: { k: 'order', dir: 1 }, seasons: { k: 'month', dir: -1 } };
let dkSort = {}; try { dkSort = JSON.parse(localStorage.getItem('ws.dk.sort') || '{}') || {}; } catch (e) { dkSort = {}; }
const sortOf = t => (dkSort[t] && dkSort[t].k ? dkSort[t] : DK_SORT_DEF[t]);
const cmp = (x, y) => (typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y);
function sortList(t, list, keys, tie) {
  const s = sortOf(t), f = keys[s.k];
  if (!f) return list;
  return list.slice().sort((a, b) => cmp(f(a), f(b)) * s.dir || (tie ? tie(a, b) : 0));
}
const kbd = k => `<kbd class="dk-kbd">${k}</kbd>`;
/* a compact edit button for table rows: the pencil, with the words for screen readers and a tooltip */
const PENCIL = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/></svg>';
const editBtn = attrs => `<button class="btn btn-sm btn-ghost dk-edit" ${attrs} title="Edit" aria-label="Edit">${PENCIL}</button>`;
const MDY = { month: 'short', day: 'numeric', year: 'numeric' };
/* a sortable column head; d is the direction a first click sorts in */
function thS(t, k, label, cls, d) {
  const s = sortOf(t), on = s.k === k;
  return `<th class="dk-th${cls ? ' ' + cls : ''}${on ? ' on' : ''}" aria-sort="${on ? (s.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="dk-sort" data-action="dk-sort" data-t="${t}" data-k="${k}" data-d="${d || 1}">${label}<i>${on ? (s.dir > 0 ? UP : DOWN) : ''}</i></button></th>`;
}
function dkBar(title, sub, acts) {
  return `<header class="page-head dk-bar"><div class="dk-title"><h1>${title}</h1>${sub ? `<div class="dk-sub">${sub}</div>` : ''}</div><div class="dk-actions">${acts || ''}</div></header>`;
}
const kpi = (label, val, cls, note, big) => `<div class="stat dk-kpi${big ? ' big' : ''}"><div class="label">${label}</div><div class="num${cls ? ' ' + cls : ''}">${val}</div>${note ? `<div class="dk-note">${note}</div>` : ''}</div>`;
const kpis = cells => `<div class="summary-row dk-kpis">${cells.join('')}</div>`;
/* the row to show: the remembered one if it still exists, else the first */
function dkPick(v, keys, auto) {
  if (dkSel[v] != null && keys.includes(dkSel[v])) return dkSel[v];
  dkSel[v] = auto === false || !keys.length ? null : keys[0];
  return dkSel[v];
}
const selc = (v, key) => (dkSel[v] === key ? ' sel' : '');
function dkSplit(listHTML, inspHTML) {
  return `<div class="dk-split"><div class="dk-list">${listHTML}</div><aside class="dk-side"><div class="panel dk-insp" id="dkInsp">${inspHTML}</div></aside></div>`;
}
function inspHead(title, tag) {
  return `<div class="panel-head"><span class="label">${title}</span>${tag || `<span class="dk-hint">${kbd('J')}${kbd('K')} move</span>`}</div>`;
}
const kv = (k, v) => `<div class="kv"><span class="muted">${k}</span><span class="dk-kv-v">${v}</span></div>`;
const signed = (n, o) => `<span class="num ${n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted'}">${n > 0 ? '+' : n < 0 ? MINUS : ''}${money(Math.abs(n), o)}</span>`;
const shareBar = (pct, cls) => `<span class="dk-share${cls ? ' ' + cls : ''}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></span>`;
const updatedAgo = a => { if (!a.updatedAt) return ''; const n = daysUntil(localISO(new Date(a.updatedAt))); return n === 0 ? 'today' : n === -1 ? 'yesterday' : (-n) + 'd ago'; };
const txnSigned = t => (t.kind === 'payment' || t.kind === 'expense' ? -t.amount : t.amount);
const txnRow = t => `<li><span class="num muted w-date">${fmtDate(t.date, MD)}</span><span class="grow">${esc(t.desc)}</span><span class="num ${amtClass(t)}">${amtText(t)}</span></li>`;

/* the rail: net worth and what is due, on every page */
function dkTickerHTML() {
  const NW = netShown(), d = netDelta(30), wk = upNext(7).filter(u => u.kind !== 'in'), due = sum(wk, u => u.amount);
  /* the first tile is the player card: the level badge, the cash counter, and the XP board to the next level */
  const st = isDesk() && (G.st || (G.st = gameState())), label = `<span class="label">${dword('Net worth')}</span>`;
  return `<a class="dk-tick${st ? ' gm-tile' : ''}" href="#overview" title="${st ? esc(gTitle(st)) : 'Overview'}">${st ? `<span class="gm-tick-top">${label}${gBadgeHTML(st)}</span>` : label}<span class="num dk-tick-n"${st ? gRollAttr('rail', NW) : ''}>${money(NW, { cents: false })}</span>${d ? `<span class="dk-tick-d num ${d.amt >= 0 ? 'pos' : 'neg'}">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })} <span class="muted">30d</span></span>` : ''}${st ? gXpHTML(st) : ''}</a>
    <a class="dk-tick dk-tick-due${st && !due ? ' gm-clear' : ''}${st && (st.over.length || st.lateOne.length) ? ' gm-late-tile' : ''}" href="#upcoming" title="Upcoming">${st ? `<span class="gm-tick-top"><span class="label">Due in 7 days</span>${gDueTop(st)}</span>` : '<span class="label">Due in 7 days</span>'}<span class="num dk-tick-n${due ? ' neg' : ''}">${due ? MINUS : ''}${money(due, { cents: false })}</span><span class="dk-tick-d muted">${wk.length ? wk.length + ' item' + (wk.length === 1 ? '' : 's') + ', next ' + fmtDate(wk[0].date, MD) : st ? (() => { const nx = gNextOut(); return esc(gword('allClear')) + ' ' + DOT + ' ' + (nx ? 'next ' + fmtDate(nx, MD) : 'nothing scheduled'); })() : 'nothing due'}</span></a>${st ? gNextHTML(st) : ''}`;
}

/* ---------- desktop: overview ---------- */
function dkOverview() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const acts = `<button class="btn" data-action="transfer" data-key="t"${S.accounts.length < 2 ? ' disabled' : ''}>Transfer ${kbd('T')}</button><button class="btn btn-primary" data-action="add-upcoming" data-key="n">Add upcoming ${kbd('N')}</button>`;
  if (!S.accounts.length) return dkBar('Overview', today, '') + `<div class="dk-welcome">${vWelcome()}</div>`;
  const T = totals(), d = netDelta(30), W = withdrawals(), after = viewAfter(), NW = netShown(), mg = mainGoal();
  const deltaHtml = d
    ? `<span class="${d.amt >= 0 ? 'pos' : 'neg'} num">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })} ${DOT} ${pctStr(Math.abs(d.pct), 1)}</span> <span class="muted">since ${fmtDate(d.since, MD)}</span>`
    : `<span class="muted">No movement recorded yet. Update a balance on another day and this fills in.</span>`;
  const parts = [W.bills ? `<span class="num neg">${MINUS}${money(W.bills, { cents: false })}</span> bills` : '', W.out ? `<span class="num neg">${MINUS}${money(W.out, { cents: false })}</span> planned` : ''].filter(Boolean).join(' ' + DOT + ' ');
  const pts = rangeSeries(chartRange), firstV = pts[0].v, lastV = pts[pts.length - 1].v;
  const P = planRows(), drift = P.rows.filter(r => Math.abs(r.diff) > 1).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  /* what is due: bills and dated one-time items in the next 30 days, each with its button */
  const due = [];
  for (const x of billsDue(30)) {
    const st = billStatus(x.bill);
    due.push({ key: 'b:' + x.bill.id + ':' + x.key, date: x.due, days: x.days, name: x.bill.name, amount: x.bill.amount, kind: 'bill', act: x.key === st.key ? `<button class="btn btn-sm" data-action="pay-bill" data-id="${x.bill.id}" data-primary>Pay</button>` : '' });
  }
  for (const u of pending()) {
    if (!u.date) continue;
    const n = daysUntil(u.date);
    if (n <= 30) due.push({ key: 'u:' + u.id, date: parseISO(u.date), days: n, name: u.name, amount: u.amount, kind: u.kind, act: `<button class="btn btn-sm" data-action="done-upcoming" data-id="${u.id}" data-primary>${u.kind === 'in' ? 'Got it' : 'Pay'}</button>` });
  }
  due.sort((a, b) => a.date - b.date);
  const wk = due.filter(u => u.days <= 7 && u.kind !== 'in'), wkOut = sum(wk, u => u.amount), moOut = sum(due.filter(u => u.kind !== 'in'), u => u.amount);
  dkPick('overview', S.accounts.map(a => 'a:' + a.id).concat(due.map(u => u.key)), false);
  /* the game rides on the as-is total whichever view is picked: the level chip, the record ribbon, the board under the number */
  const st = G.st || (G.st = gameState());
  const hero = `<header class="hero dk-hero">
    <div class="dk-hero-main">
      <div class="hero-top"><span class="label">${dword('Net worth')}${after ? ` <span class="muted">${DOT} after withdrawals</span>` : ''} <span class="lvl" title="${esc(gDatesTitle(st))}" data-action="gm-trophies">${esc(gLvl(st.level))}</span></span>${gRibbonHTML(st, after)}
        <div class="seg"><button class="${after ? '' : 'on'}" data-action="view" data-view="now">As is</button><button class="${after ? 'on' : ''}" data-action="view" data-view="after">After withdrawals</button></div></div>
      <div class="hero-num num" data-count="${NW}"${gRollAttr('hero', NW)}>${money(NW, { cents: false })}</div>
      <div class="hero-delta">${deltaHtml}${gTodayHTML(st, after)}</div>
      ${gTrackHTML(st, after)}
      ${W.total > 0
        ? `<div class="hero-note small muted">${after ? `<span class="num">${money(T.N, { cents: false })}</span> before withdrawals ${DOT} ` : 'Still to come out this month: '}${parts}</div>`
        : `<div class="hero-note small muted">Nothing left to come out this month.</div>`}
    </div>
    <div class="dk-hero-stats">
      ${gRankHTML(st)}
      <div class="stat"><div class="label">Assets</div><div class="num pos">${money(T.A, { cents: false })}</div></div>
      <div class="stat"><div class="label">Debt</div><div class="num dk-debt-n${T.L ? ' neg' : ''}">${T.L ? MINUS : ''}${money(T.L, { cents: false })}</div></div>
      <div class="stat"><div class="label">${dword('Bills left')}</div><div class="num${W.bills ? ' neg' : ''}">${W.bills ? MINUS : ''}${money(W.bills, { cents: false })}</div></div>
      <div class="stat"><div class="label">Expected in</div><div class="num${W.inn ? ' pos' : ''}">${W.inn ? '+' : ''}${money(W.inn, { cents: false })}</div></div>
      <div class="stat dk-xxl"><div class="label">Planned out</div><div class="num${W.out ? ' neg' : ''}">${W.out ? MINUS : ''}${money(W.out, { cents: false })}</div></div>
      <div class="stat dk-xxl"><div class="label">After all pending</div><div class="num">${money(T.N + W.inn - W.total, { cents: false })}</div></div>
    </div>
  </header>`;
  const chart = `<section class="panel chart-panel dk-chart rib-green${lastV >= firstV ? ' up' : ' down'}">
    <div class="panel-head"><span class="label">Net worth over time${after ? ` ${DOT} after withdrawals` : ''}</span><span class="small">${deltaHTML(firstV, lastV, rangeLabel(chartRange))}</span></div>
    <div class="chart-wrap" id="chart" data-fill="1"></div>
    <div class="ranges"><span class="live"><i></i>LIVE</span>${RANGES.map(r => `<button class="${chartRange === r[0] ? 'on' : ''}" data-action="range" data-range="${r[0]}">${r[1]}</button>`).join('')}</div>
  </section>`;
  const dueP = `<section class="panel dk-due rib-red">
    <div class="panel-head"><span class="label">${dword('Coming up')}${gLateMark(st)}</span><a class="link" href="#upcoming">All upcoming</a></div>
    <div class="dk-due-top">
      <div><div class="label">Due in 7 days</div><div class="num dk-big${wkOut ? ' neg' : ''}">${wkOut ? MINUS : ''}${money(wkOut, { cents: false })}</div></div>
      <div class="dk-due-30"><div class="label">30 days</div><div class="num${moOut ? ' neg' : ''}">${moOut ? MINUS : ''}${money(moOut, { cents: false })}</div><div class="dk-note">${due.length} item${due.length === 1 ? '' : 's'}</div></div>
    </div>
    ${due.length
      ? `<ul class="list dk-due-list">${due.slice(0, 7).map(u => `<li class="dk-row${selc('overview', u.key)}" data-sel="${u.key}"><span class="dk-when"><span class="num">${fmtDate(u.date, MD)}</span><span class="small ${u.days < 0 ? 'neg' : 'muted'}">${u.days < 0 ? (-u.days) + 'd late' : relShort(u.days)}</span></span>${u.kind !== 'bill' ? `<span class="tag ${u.kind === 'in' ? 'pos-tag' : 'neg-tag'}">${u.kind === 'in' ? 'IN' : 'OUT'}</span>` : ''}<span class="grow dk-ell">${esc(u.name)}</span><span class="num ${u.kind === 'in' ? 'pos' : 'neg'}">${u.kind === 'in' ? '+' : MINUS}${money(u.amount, { cents: false })}</span><span class="dk-due-act">${u.act}</span></li>`).join('')}</ul>`
      : `<p class="empty">${S.bills.length || S.upcoming.length ? 'Nothing in the next 30 days.' : 'No bills or upcoming items yet.'}</p>`}
  </section>`;
  const accts = `<section class="panel dk-o-accts rib-gold">
    <div class="panel-head"><span class="label">${dword('Where it sits')}</span><a class="link" href="#accounts">All accounts</a></div>
    ${GROUP_ORDER.map(g => {
      const list = S.accounts.filter(a => typeOf(a).group === g).sort((a, b) => b.balance - a.balance);
      if (!list.length) return '';
      const t = sum(list, a => a.balance), debt = g === 'debt', base = debt ? T.L : T.A;
      return `<div class="group"><div class="group-head"><span>${GROUPS[g]}</span><span class="num ${debt ? 'neg' : 'pos'}">${debt && t > 0.005 ? MINUS : ''}${money(t, { cents: false })}</span></div>
        ${list.map(a => `<div class="row acct-row dk-row${selc('overview', 'a:' + a.id)}" data-sel="a:${a.id}" data-action="update-balance" data-id="${a.id}" title="Update balance"><span class="tag">${typeOf(a).tag}</span><span class="grow dk-ell">${gPip(a)}${esc(a.name)}${a.inst ? `<span class="muted"> ${DOT} ${esc(a.inst)}</span>` : ''}</span>${shareBar(base ? a.balance / base * 100 : 0, debt ? 'neg' : '')}<span class="num ${debt ? 'neg' : 'pos'} dk-amt">${debt && a.balance > 0.005 ? MINUS : ''}${money(a.balance)}</span></div>`).join('')}
      </div>`;
    }).join('')}
  </section>`;
  const goals = `<section class="panel dk-o-goals rib-teal">
    <div class="panel-head"><span class="label">Goals</span><a class="link" href="#goals">All goals</a></div>
    ${S.goals.length
      ? S.goals.slice(0, 5).map(g => `<div class="mini-goal"><div class="row"><span class="grow dk-ell">${esc(g.name)}${isMainGoal(g) ? ' <span class="tag">MAIN</span>' : ''}</span><span class="num small">${pctStr(goalPct(g))}</span></div><div class="bar"><i class="${gdone(g) ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div><div class="row small muted"><span class="grow num">${money(gsaved(g), { cents: false })} of ${money(g.target, { cents: false })}</span><span>${gdone(g) ? dword('Funded') : g.due ? 'by ' + fmtDate(g.due, { month: 'short', year: 'numeric' }) : ''}</span></div></div>`).join('')
      : `<p class="empty">No goals yet.</p>`}
  </section>`;
  const driftP = `<section class="panel dk-o-drift rib-purple">
    <div class="panel-head"><span class="label">${dword('Plan drift')}</span><a class="link" href="#plan">Plan</a></div>
    ${drift.length
      ? `<ul class="list">${drift.map(r => `<li><span class="grow"><span class="dk-ell">${esc(r.b.name)}</span><span class="small muted dk-blk">${pctStr(r.actualPct, 1)} of ${pctStr(r.b.pct)} target</span></span><span class="dk-r"><span class="num">${money(Math.abs(r.diff), { cents: false })}</span><span class="small ${r.diff > 0 ? 'warn' : 'muted'} dk-blk">${r.diff > 0 ? 'over' : 'under'}</span></span></li>`).join('')}</ul>`
      : `<p class="empty">${S.buckets.length ? 'On target.' : 'No plan set.'}</p>`}
  </section>`;
  return dkBar('Overview', today, acts) + `<div class="dk-ov">
    ${hero}
    ${gQwHTML(st)}
    ${chart}
    <div class="dk-ov-side">${dueP}${mg ? dkMainGoal(mg) : ''}</div>
    ${accts}${goals}${driftP}
  </div>`;
}
/* the goal's landmark in the card's spare room (the card stretches to the column): the building as it stands, and the real
   distance to its next stage */
function gMgLandmark(g) {
  const st = G.st || (G.st = gameState()), sg = gStage(g, st), saved = gGoalSaved(g, st);
  if (!(g.target > 0)) return '';
  const nextAt = g.target * (sg + 1) / 5, left = Math.max(0, nextAt - saved);
  const cap = sg >= 5 ? `<b>${esc(dword('Funded'))}</b> ${DOT} all five stages` : `stage ${sg} of 5 ${DOT} stage ${sg + 1} at <span class="num">${gMoney(nextAt)}</span><br><span class="num">${gMoney(Math.max(1, left))}</span> to go`;
  return `<div class="gm-mg-lm">${gLandmarkSVG(g, st)}<span class="gm-mg-cap">${cap}</span></div>`;
}
function dkMainGoal(g) {
  const net = g.kind === 'net', saved = gsaved(g), done = saved >= g.target, pct = goalPct(g), p = goalPace(g);
  const pace = done ? `<span class="pos">Funded. Pick the next one on the Goals page.</span>`
    : p ? (p.overdue ? `<span class="warn">Past the target date</span> ${DOT} ${money(g.target - saved, { cents: false })} to go`
                     : `<b class="num">${money(p.perMonth, { cents: false })}</b>/mo ${DOT} ${p.days} day${p.days === 1 ? '' : 's'} left`)
    : money(g.target - saved, { cents: false }) + ' to go';
  return `<section class="panel dk-mg rib-gold" data-gid="${esc(g.id)}">
    <div class="panel-head"><span class="label">${dword('Main goal')}</span><a class="link" href="#goals">${S.goals.length > 1 ? 'Change' : 'Goals'}</a></div>
    <div class="dk-mg-body">
      <div class="row"><span class="mg-name grow dk-ell">${esc(g.name)}</span><span class="mg-pct num${done ? ' pos' : ''}">${pctStr(pct)}</span></div>
      <div class="goal-nums"><span class="num big">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span></div>
      ${meterHTML(pct, done)}
      ${(() => { const sg = gStage(g, G.st || (G.st = gameState())); return `<div class="stars gm-stages" title="Stage ${sg} of 5" aria-label="Stage ${sg} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= sg ? 'on' : ''}"></i>`).join('')}</div>`; })()}
      ${gMgLandmark(g)}
      <div class="row dk-mg-foot"><span class="small muted grow">${pace}</span>${done ? '' : net ? `<a class="btn btn-sm btn-primary" href="#accounts">Update balances</a>` : `<button class="btn btn-sm btn-primary" data-action="fund-goal" data-id="${g.id}">Add funds</button>`}</div>
    </div>
  </section>`;
}

/* ---------- desktop: accounts ---------- */
function dkAccounts() {
  const T = totals();
  const ageing = S.accounts.some(a => gFreshOf(a).state !== 'fresh');
  const acts = `${ageing ? `<button class="btn gm-ci-btn" data-action="checkin-run" title="Check-in round: update each balance older than a week, oldest first. It collects fresh numbers, never money.">${esc(gw('collect'))} ${kbd('U')}</button>` : ''}<button class="btn" data-action="transfer" data-key="t"${S.accounts.length < 2 ? ' disabled' : ''}>Transfer ${kbd('T')}</button><button class="btn btn-primary" data-action="add-account" data-key="n">Add account ${kbd('N')}</button>`;
  const bar = dkBar('Accounts', 'Every place money lives or is owed. Update a balance whenever it changes.', acts);
  if (!S.accounts.length) return bar + `<section class="panel welcome"><h2>No accounts yet.</h2><p>Add checking, savings, brokerage, cards and loans; everything else hangs off these balances.</p><div class="row"><button class="btn btn-primary" data-action="add-account">Add an account</button></div></section>`;
  const s = sortOf('accounts');
  const ordered = side => {
    const list = S.accounts.filter(a => typeOf(a).side === side);
    if (s.k === 'group') { const g = list.slice().sort(byGroup); return s.dir > 0 ? g : g.reverse(); }
    return sortList('accounts', list, { name: a => a.name.toLowerCase(), type: a => typeOf(a).label, updated: a => a.updatedAt || '', balance: a => a.balance }, byGroup);
  };
  const A = ordered('asset'), L = ordered('liability');
  const sel = dkPick('accounts', A.concat(L).map(a => a.id));
  const em = sum(S.accounts, a => earmarked(a.id));
  const stale = S.accounts.slice().sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))[0];
  const mix = GROUP_ORDER.filter(g => g !== 'debt').map(g => ({ g, v: sum(S.accounts.filter(a => typeOf(a).group === g), a => a.balance) })).filter(x => x.v > 0);
  const table = (list, debt) => {
    if (!list.length) return '';
    const tot = sum(list, a => a.balance);
    const frN = S.accounts.filter(a => gFreshOf(a).state === 'fresh').length;
    return `<section class="panel dk-tpanel ${debt ? 'rib-red' : 'rib-green'}"><div class="panel-head"><span class="label">${debt ? 'Debt' : 'Assets'}${debt ? '' : `<span class="gm-fresh-n${frN === S.accounts.length ? ' all' : ''}" title="Balances checked in the last 7 days">Fresh ${frN}/${S.accounts.length}</span>`}</span>${debt ? gBossTotHTML(G.st || (G.st = gameState())) : ''}<span class="num">${debt && tot > 0.005 ? MINUS : ''}${money(tot)}</span></div>
      <table class="tbl dk-tbl"><thead><tr><th class="dk-c-tag"></th>${thS('accounts', 'name', 'Account')}${thS('accounts', 'updated', 'Updated', 'dk-xl', -1)}<th class="dk-c-share dk-xl">${debt ? 'Of debt' : 'Of assets'}</th>${thS('accounts', 'balance', 'Balance', 'r', -1)}<th class="dk-c-act"></th></tr></thead><tbody>
      ${list.map(a => { const e = earmarked(a.id), pct = tot ? a.balance / tot * 100 : 0; return `<tr class="dk-row${sel === a.id ? ' sel' : ''}" data-sel="${a.id}">
        <td class="dk-c-tag"><span class="tag">${typeOf(a).tag}</span></td>
        <td class="dk-c-main"><div class="gm-nm">${gTheme() === 'passbook' ? '' : gAgeBadge(a)}<div class="strong">${esc(a.name)}</div></div><div class="dk-rsub">${gTheme() === 'passbook' ? `<span class="gm-age-in">${gAgeBadge(a)}</span>` : ''}${[a.inst ? esc(a.inst) : '', typeOf(a).label].filter(Boolean).join(' ' + DOT + ' ')}<span class="dk-nx">${a.updatedAt ? ' ' + DOT + ' ' + gPip(a) + 'updated ' + updatedAgo(a) : ''}</span></div></td>
        <td class="muted dk-xl">${gPip(a)}${updatedAgo(a)}</td>
        <td class="dk-c-share dk-xl">${shareBar(pct, debt ? 'neg' : '')}<span class="num small muted">${pctStr(pct, 1)}</span></td>
        <td class="r"><div class="num strong ${debt ? 'neg' : 'pos'}">${debt && a.balance > 0.005 ? MINUS : ''}${money(a.balance)}</div>${e ? `<div class="dk-rsub num">${money(e, { cents: false })} earmarked</div>` : ''}</td>
        <td class="dk-c-act"><button class="btn btn-sm" data-action="update-balance" data-id="${a.id}">Update</button>${editBtn(`data-action="edit-account" data-id="${a.id}"`)}</td>
      </tr>`; }).join('')}
      </tbody></table></section>`;
  };
  return bar + kpis([
    kpi(dword('Net worth'), money(T.N, { cents: false }), '', `${S.accounts.length} account${S.accounts.length === 1 ? '' : 's'}`, true),
    kpi('Assets', money(T.A, { cents: false }), 'pos', `${A.length} account${A.length === 1 ? '' : 's'}`),
    kpi('Debt', (T.L ? MINUS : '') + money(T.L, { cents: false }), T.L ? 'neg' : '', `${L.length} account${L.length === 1 ? '' : 's'}`),
    kpi('Earmarked', money(em, { cents: false }), '', 'set aside for goals'),
    `<div class="stat dk-kpi dk-mix"><div class="label">Asset mix</div><div class="dk-stack">${mix.map((x, i) => `<i class="s${i + 1}" style="width:${T.A ? x.v / T.A * 100 : 0}%"></i>`).join('')}</div><div class="dk-legend">${mix.map((x, i) => `<span><i class="s${i + 1}"></i>${GROUPS[x.g]} <b class="num">${pctStr(T.A ? x.v / T.A * 100 : 0)}</b></span>`).join('')}</div></div>`,
    stale && stale.updatedAt ? kpi('Oldest update', esc(stale.name), 'dk-kpi-txt', 'updated ' + updatedAgo(stale)) : '',
  ]) + dkSplit(table(A, false) + table(L, true), inspAccount(sel));
}
function inspAccount(id) {
  const a = acct(id);
  if (!a) return inspHead('Account') + `<p class="empty">Pick an account.</p>`;
  const debt = !isAsset(a), side = debt ? liabilities() : assets(), tot = sum(side, x => x.balance);
  const bucket = S.buckets.find(b => b.accountIds.includes(a.id));
  const goals = S.goals.filter(g => g.kind !== 'net' && g.accountId === a.id);
  const from = S.bills.filter(b => b.from === a.id), down = S.bills.filter(b => b.to === a.id), pend = pending().filter(u => u.accountId === a.id);
  const em = earmarked(a.id), acts = S.txns.filter(t => t.from === a.id || t.to === a.id).slice(0, 6);
  const gst = G.st || (G.st = gameState());
  return inspHead(typeOf(a).label) + `<div class="dk-ib${debt ? ' gm-deed-debt' : ' gm-deed'}">
    ${debt ? '' : gDeedBand(a)}<div class="dk-it"><span class="tag">${typeOf(a).tag}</span><h2>${esc(a.name)}</h2></div>
    <div class="muted small">${[a.inst ? esc(a.inst) : '', typeOf(a).label, a.updatedAt ? 'updated ' + updatedAgo(a) : ''].filter(Boolean).join(' ' + DOT + ' ')}</div>
    <div class="dk-ibig num ${debt ? 'neg' : 'pos'}"${gRollAttr('insp:' + a.id, debt ? -a.balance : a.balance)}>${debt && a.balance > 0.005 ? MINUS : ''}${money(a.balance)}</div>
    <div class="dk-iacts"><button class="btn btn-primary" data-action="update-balance" data-id="${a.id}" data-primary>Update balance ${kbd('Enter')}</button><button class="btn" data-action="transfer" data-from="${a.id}"${S.accounts.length < 2 ? ' disabled' : ''}>Transfer</button><button class="btn btn-ghost" data-action="edit-account" data-id="${a.id}" data-edit>Edit ${kbd('E')}</button></div>
  </div>
  ${debt ? gBossHTML(a, gst) : ''}
  <div class="dk-isec">
    ${kv(debt ? 'Share of debt' : 'Share of assets', `<span class="num">${pctStr(tot ? a.balance / tot * 100 : 0, 1)}</span>`)}
    ${debt ? '' : kv('Plan bucket', bucket ? esc(bucket.name) : '<span class="muted">none</span>')}
    ${debt ? '' : kv('Earmarked', em ? `<span class="num">${money(em, { cents: false })}</span> for ${goals.map(g => esc(g.name)).join(', ')}` : '<span class="muted">nothing</span>')}
    ${from.length ? kv('Bills paid from here', `<span class="num">${money(sum(from, b => b.amount * (PER_MONTH[b.every] || 1)), { cents: false })}</span>/mo ${DOT} ${from.length}`) : ''}
    ${down.length ? kv('Paid down by', down.map(b => esc(b.name) + ` <span class="num">${money(b.amount, { cents: false })}</span>`).join(', ')) : ''}
    ${pend.length ? kv('Pending one-time', pend.map(u => esc(u.name)).join(', ')) : ''}
  </div>
  <div class="dk-isec"><div class="label dk-il">Recent activity</div>${acts.length ? `<ul class="list dk-mini">${acts.map(txnRow).join('')}</ul>` : `<p class="empty">Nothing recorded for this account yet.</p>`}</div>`;
}

/* ---------- desktop: plan ---------- */
function dkPlan() {
  const P = planRows(), moves = suggestMoves(P.rows);
  const income = +S.settings.income || 0, billsTotal = billsMonthly(), free = income - billsTotal;
  const acts = `<button class="btn btn-primary" data-action="add-bucket" data-key="n">Add bucket ${kbd('N')}</button>`;
  const bar = dkBar('Plan', 'Where your money should sit: each bucket gets a share of total assets.', acts);
  if (!S.buckets.length) return bar + `<section class="panel welcome"><h2>No plan yet.</h2><p>A plan is a few buckets with a target percentage each: say 10% cash on hand, 25% emergency fund, 65% invested. Start from the template or build your own.</p><div class="row"><button class="btn btn-primary" data-action="plan-template">Use the template</button><button class="btn" data-action="add-bucket">Add a bucket</button></div></section>`;
  const rows = sortList('plan', P.rows.map((r, i) => Object.assign({ i }, r)), { order: r => r.i, name: r => r.b.name.toLowerCase(), actual: r => r.actual, now: r => r.actualPct, target: r => +r.b.pct, drift: r => r.diff });
  const sel = dkPick('plan', rows.map(r => r.b.id));
  const off = sum(P.rows.filter(r => r.diff > 1), r => r.diff), ok = Math.round(P.pctTotal) === 100;
  const ci = r => ' s' + (P.rows.indexOf(P.rows.find(x => x.b.id === r.b.id)) % 5 + 1);
  const alloc = `<section class="panel dk-alloc rib-teal"><div class="panel-head"><span class="label">Holdings vs target</span><span class="muted small">of ${money(P.base, { cents: false })} in assets${ok ? '' : ` ${DOT} <span class="warn">targets add up to ${pctStr(P.pctTotal)}</span>`}</span></div>
    <div class="dk-alloc-body">
      <div class="dk-alloc-row"><span class="label">Now</span><div class="dk-stack big">${P.rows.map(r => `<i class="${ci(r).trim()}" style="width:${r.actualPct}%" title="${esc(r.b.name)} ${pctStr(r.actualPct, 1)}"></i>`).join('')}${P.unassignedTotal > 1 ? `<i class="s0" style="width:${P.base ? P.unassignedTotal / P.base * 100 : 0}%" title="Unassigned"></i>` : ''}</div></div>
      <div class="dk-alloc-row"><span class="label">Target</span><div class="dk-stack big">${P.rows.map(r => `<i class="${ci(r).trim()}" style="width:${Math.max(0, r.b.pct)}%" title="${esc(r.b.name)} ${pctStr(r.b.pct)}"></i>`).join('')}</div></div>
      <div class="dk-legend">${P.rows.map(r => `<span><i class="${ci(r).trim()}"></i>${esc(r.b.name)} <b class="num">${pctStr(r.actualPct, 1)}</b> <span class="muted num">/ ${pctStr(r.b.pct)}</span></span>`).join('')}${P.unassignedTotal > 1 ? `<span><i class="s0"></i>Unassigned <b class="num">${pctStr(P.base ? P.unassignedTotal / P.base * 100 : 0, 1)}</b></span>` : ''}</div>
    </div></section>`;
  const table = `<section class="panel dk-tpanel rib-green"><div class="panel-head"><span class="label">Buckets</span><span class="muted small">click a row for its accounts and moves</span></div>
    <table class="tbl dk-tbl"><thead><tr>${thS('plan', 'name', 'Bucket')}${thS('plan', 'actual', 'Holding', 'r', -1)}${thS('plan', 'now', 'Now', 'r', -1)}${thS('plan', 'target', 'Target', 'r', -1)}<th class="dk-c-drift dk-xl">Now vs target</th>${thS('plan', 'drift', 'Gap', 'r', -1)}<th class="dk-c-act"></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="dk-row${sel === r.b.id ? ' sel' : ''}" data-sel="${r.b.id}">
      <td class="dk-c-main"><div class="strong"><i class="dk-dot${ci(r)}"></i>${esc(r.b.name)}</div><div class="dk-rsub">${r.accts.length ? r.accts.map(a => esc(a.name)).join(', ') : 'No accounts assigned'}</div></td>
      <td class="r num">${money(r.actual, { cents: false })}</td>
      <td class="r num">${pctStr(r.actualPct, 1)}</td>
      <td class="r num muted">${pctStr(r.b.pct, 0)}</td>
      <td class="dk-c-drift dk-xl"><div class="tbar"><i class="fill" style="width:${Math.min(100, r.actualPct)}%"></i><i class="mark" style="left:${Math.min(100, r.b.pct)}%"></i></div></td>
      <td class="r num${Math.abs(r.diff) <= 1 ? ' muted' : r.diff > 0 ? ' warn' : ''}">${Math.abs(r.diff) <= 1 ? 'on target' : (r.diff > 0 ? '+' : MINUS) + money(Math.abs(r.diff), { cents: false })}</td>
      <td class="dk-c-act">${editBtn(`data-action="edit-bucket" data-id="${r.b.id}"`)}</td>
    </tr>`).join('')}
    ${P.unassigned.length ? `<tr class="dk-unassigned"><td><div class="strong muted">Unassigned</div><div class="dk-rsub">${P.unassigned.map(a => esc(a.name)).join(', ')}</div></td><td class="r num muted">${money(P.unassignedTotal, { cents: false })}</td><td class="r num muted">${pctStr(P.base ? P.unassignedTotal / P.base * 100 : 0, 1)}</td><td></td><td class="dk-xl"></td><td></td><td></td></tr>` : ''}
    </tbody></table></section>`;
  const movesP = `<section class="panel rib-purple"><div class="panel-head"><span class="label">To get on target</span></div>
    ${moves.length
      ? `<ul class="list gm-moves">${moves.map(m => { const f = m.from.accts.slice().sort((a, b) => b.balance - a.balance)[0], to = m.to.accts[0]; return `<li><span class="grow">Move <b class="num">${money(m.amt, { cents: false })}</b> from ${esc(m.from.b.name)} to ${esc(m.to.b.name)}</span>${f && to && f.id !== to.id ? `<button class="btn btn-sm" data-action="transfer" data-from="${esc(f.id)}" data-to="${esc(to.id)}" data-amount="${Math.round(m.amt)}" title="Transfer ${money(Math.round(m.amt), { cents: false })} from ${esc(f.name)} to ${esc(to.name)}">Transfer</button>` : ''}</li>`; }).join('')}</ul>`
      : `<p class="empty">${movesMsg(P)}</p>`}
    ${moves.length && P.unassignedTotal > 1 ? `<p class="muted small pad">${money(P.unassignedTotal, { cents: false })} is unassigned and not counted toward any bucket.</p>` : ''}
  </section>`;
  const incomeP = `<section class="panel rib-orange"><div class="panel-head"><span class="label">New money each month</span></div>
    <div class="income-row"><label class="label" for="income">Monthly take-home</label><div class="inp-money"><span>$</span><input id="income" class="inp num" type="text" inputmode="decimal" value="${income ? income : ''}" placeholder="0" data-action="set-income"></div></div>
    ${income > 0
      ? `<div class="kv"><span class="muted">Bills</span><span class="num neg">${MINUS}${money(billsTotal, { cents: false })}</span></div><div class="kv strong"><span>Free to allocate</span><span class="num ${free < 0 ? 'neg' : 'pos'}">${money(free, { cents: false })}</span></div>
         ${free > 0 ? `<ul class="list">${P.rows.map(r => `<li><span class="grow">${esc(r.b.name)}</span><span class="muted small">${pctStr(r.b.pct)}</span><span class="num w-amt">${money(free * r.b.pct / 100, { cents: false })}</span></li>`).join('')}</ul>` : `<p class="empty">Bills exceed income.</p>`}`
      : `<p class="empty">Enter take-home pay to see how to split what is left after bills, using the same targets.</p>`}
  </section>`;
  return bar + kpis([
    kpi('Assets in the plan', money(P.base, { cents: false }), '', `${S.buckets.length} bucket${S.buckets.length === 1 ? '' : 's'}`, true),
    kpi('Targets add up to', pctStr(P.pctTotal), ok ? 'pos' : 'warn', ok ? 'ready' : 'aim for 100%'),
    kpi('To move', money(off, { cents: false }), off > 1 ? 'warn' : '', moves.length ? moves.length + ' move' + (moves.length === 1 ? '' : 's') : 'on target'),
    kpi('Unassigned', money(P.unassignedTotal, { cents: false }), P.unassignedTotal > 1 ? 'warn' : '', P.unassigned.length ? P.unassigned.length + ' account' + (P.unassigned.length === 1 ? '' : 's') : 'every account is in a bucket'),
    kpi('Free each month', income ? money(free, { cents: false }) : DASH, income ? (free < 0 ? 'neg' : 'pos') : '', income ? 'after ' + money(billsTotal, { cents: false }) + ' of bills' : 'set take-home pay below'),
  ]) + dkSplit(alloc + table + `<div class="dk-2">${movesP}${incomeP}</div>`, inspBucket(sel));
}
function inspBucket(id) {
  const P = planRows(), r = P.rows.find(x => x.b.id === id);
  if (!r) return inspHead('Bucket') + `<p class="empty">Pick a bucket.</p>`;
  const moves = suggestMoves(P.rows).filter(m => m.from === r || m.to === r);
  const income = +S.settings.income || 0, free = income - billsMonthly();
  return inspHead('Bucket') + `<div class="dk-ib">
    <div class="dk-it"><h2>${esc(r.b.name)}</h2></div>
    <div class="muted small">target ${pctStr(r.b.pct)} of assets ${DOT} now ${pctStr(r.actualPct, 1)}</div>
    <div class="dk-ibig num"${gRollAttr('insp:' + r.b.id, r.actual)}>${money(r.actual, { cents: false })}</div>
    <div class="tbar"><i class="fill" style="width:${Math.min(100, r.actualPct)}%"></i><i class="mark" style="left:${Math.min(100, r.b.pct)}%"></i></div>
    <div class="dk-iacts"><button class="btn btn-primary" data-action="edit-bucket" data-id="${r.b.id}" data-primary>Edit bucket ${kbd('Enter')}</button></div>
  </div>
  <div class="dk-isec">
    ${kv('Target', `<span class="num">${money(r.target, { cents: false })}</span>`)}
    ${kv('Gap', Math.abs(r.diff) <= 1 ? '<span class="muted">on target</span>' : `<span class="num ${r.diff > 0 ? 'warn' : ''}">${r.diff > 0 ? 'over by ' : 'under by '}${money(Math.abs(r.diff), { cents: false })}</span>`)}
    ${income > 0 && free > 0 ? kv('Monthly share', `<span class="num">${money(free * r.b.pct / 100, { cents: false })}</span>/mo`) : ''}
  </div>
  <div class="dk-isec"><div class="label dk-il">Accounts in it</div>${r.accts.length ? `<ul class="list dk-mini">${r.accts.map(a => `<li><span class="tag">${typeOf(a).tag}</span><span class="grow">${esc(a.name)}</span><span class="num pos">${money(a.balance, { cents: false })}</span></li>`).join('')}</ul>` : `<p class="empty">None yet. Edit the bucket to assign accounts.</p>`}</div>
  ${moves.length ? `<div class="dk-isec"><div class="label dk-il">Moves</div><ul class="list dk-mini">${moves.map(m => `<li><span class="grow">${m.from === r ? 'Move out to ' + esc(m.to.b.name) : 'Move in from ' + esc(m.from.b.name)}</span><b class="num">${money(m.amt, { cents: false })}</b></li>`).join('')}</ul></div>` : ''}`;
}

/* ---------- desktop: goals ---------- */
function dkGoals() {
  const gT = sum(S.goals, g => g.target), gS = sum(S.goals, g => Math.min(gsaved(g), g.target));
  const acts = `<button class="btn btn-primary" data-action="add-goal" data-key="n">Add goal ${kbd('N')}</button>`;
  const bar = dkBar('Goals', 'Money set aside for something specific. The main goal is the one the overview tracks.', acts);
  if (!S.goals.length) return bar + `<section class="panel welcome"><h2>No goals yet.</h2><p>A goal is a name, a target, and optionally a date and the account the money sits in.</p><div class="row"><button class="btn btn-primary" data-action="add-goal">Add a goal</button></div></section>`;
  const base = S.goals.slice().sort((a, b) => (gdone(a) - gdone(b)) || (isMainGoal(b) - isMainGoal(a)) || (a.due || '9999').localeCompare(b.due || '9999'));
  const pace = g => { const p = goalPace(g); return p && !p.overdue ? p.perMonth : 0; };
  const list = sortList('goals', base.map((g, i) => ({ g, i })), { order: x => x.i, name: x => x.g.name.toLowerCase(), pct: x => goalPct(x.g), saved: x => gsaved(x.g), target: x => x.g.target, due: x => x.g.due || '9999', pace: x => pace(x.g) }).map(x => x.g);
  const sel = dkPick('goals', list.map(g => g.id));
  const gst = G.st || (G.st = gameState());
  const perMo = sum(S.goals.filter(g => !gdone(g)), pace);
  const next = S.goals.filter(g => g.due && !gdone(g)).sort((a, b) => a.due.localeCompare(b.due))[0];
  const table = `<section class="panel dk-tpanel rib-teal"><div class="panel-head"><span class="label">All goals</span><span class="muted small">${S.goals.filter(gdone).length} of ${S.goals.length} ${dword('Funded').toLowerCase().replace('!', '')}</span></div>
    <table class="tbl dk-tbl"><thead><tr>${thS('goals', 'name', 'Goal')}${thS('goals', 'pct', 'Progress', 'dk-c-prog', -1)}${thS('goals', 'saved', 'Saved', 'r', -1)}${thS('goals', 'due', 'By', 'dk-xl')}${thS('goals', 'pace', 'Per month', 'r dk-hide-lg', -1)}<th class="dk-c-act"></th></tr></thead><tbody>
    ${list.map(g => { const net = g.kind === 'net', a = !net && g.accountId && acct(g.accountId), done = gdone(g), p = goalPace(g), main = isMainGoal(g); return `<tr class="dk-row${sel === g.id ? ' sel' : ''}${done ? ' dk-done' : ''}" data-sel="${g.id}">
      <td class="dk-c-main"><div class="strong">${esc(g.name)}${main ? ' <span class="tag">MAIN</span>' : ''}${done ? ` <span class="tag pos-tag">${dword('Funded')}</span>` : ''}</div><div class="dk-rsub">${net ? 'Follows your net worth' : a ? 'Held in ' + esc(a.name) : 'Not linked to an account'}${g.due ? `<span class="dk-nx"> ${DOT} by ${fmtDate(g.due, { month: 'short', year: 'numeric' })}</span>` : ''}</div></td>
      <td class="dk-c-prog"><div class="bar"><i class="${done ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div>${gPipsHTML(gst.stages[g.id] || 0)}<span class="num small">${pctStr(goalPct(g))}</span></td>
      <td class="r"><div class="num">${money(gsaved(g), { cents: false })}</div><div class="dk-rsub num">of ${money(g.target, { cents: false })}</div></td>
      <td class="dk-xl">${g.due ? `<div class="num">${fmtDate(g.due, { month: 'short', year: 'numeric' })}</div>${!done && p && p.overdue ? '<div class="small warn">past due</div>' : !done && p ? `<div class="small muted">${p.days}d left</div>` : ''}` : '<span class="muted">no date</span>'}</td>
      <td class="r num dk-hide-lg">${!done && p && !p.overdue ? money(p.perMonth, { cents: false }) : '<span class="muted">' + DASH + '</span>'}</td>
      <td class="dk-c-act">${net ? `<a class="btn btn-sm" href="#accounts">Balances</a>` : done ? '' : `<button class="btn btn-sm" data-action="fund-goal" data-id="${g.id}">Add funds</button>`}${editBtn(`data-action="edit-goal" data-id="${g.id}"`)}</td>
    </tr>`; }).join('')}
    </tbody></table></section>`;
  return bar + kpis([
    kpi('Saved toward goals', money(gS, { cents: false }), '', `of ${money(gT, { cents: false })} in targets`, true),
    kpi(dword('Funded'), gT ? pctStr(gS / gT * 100) : DASH, '', `${S.goals.filter(gdone).length} of ${S.goals.length} done`),
    kpi('Needed per month', money(perMo, { cents: false }), '', 'to hit every dated goal'),
    kpi('Next deadline', next ? esc(next.name) : DASH, 'dk-kpi-txt', next ? fmtDate(next.due) + ' ' + DOT + ' ' + relDays(daysUntil(next.due)) : 'no dates set'),
    kpi(dword('Main goal'), mainGoal() ? esc(mainGoal().name) : DASH, 'dk-kpi-txt', mainGoal() ? pctStr(goalPct(mainGoal())) + ' of the way' : ''),
  ]) + dkSplit(table + gCityHTML(gst, sel), inspGoal(sel));
}
function inspGoal(id) {
  const g = S.goals.find(x => x.id === id);
  if (!g) return inspHead('Goal') + `<p class="empty">Pick a goal.</p>`;
  const net = g.kind === 'net', saved = gsaved(g), done = saved >= g.target, pct = goalPct(g), a = !net && g.accountId && acct(g.accountId), p = goalPace(g), main = isMainGoal(g);
  const d = net && !done ? netDelta(30) : null;
  const gst = G.st || (G.st = gameState()), sg = gStage(g, gst);
  return inspHead(main ? dword('Main goal') : 'Goal') + `<div class="dk-ib">
    <div class="gm-lm-big">${gLandmarkSVG(g, gst, true)}</div>
    <div class="dk-it"><h2 class="mg-name">${esc(g.name)}</h2>${done ? `<span class="tag pos-tag">${dword('Funded')}</span>` : ''}</div>
    <div class="goal-nums"><span class="num dk-ibig2">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span><span class="grow"></span><span class="mg-pct num${done ? ' pos' : ''}">${pctStr(pct)}</span></div>
    ${meterHTML(pct, done)}
    <div class="stars gm-stages" title="Stage ${sg} of 5" aria-label="Stage ${sg} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= sg ? 'on' : ''}"></i>`).join('')}</div>
    <div class="dk-iacts">${done ? '' : net ? `<a class="btn btn-primary" href="#accounts" data-primary>Update balances ${kbd('Enter')}</a>` : `<button class="btn btn-primary" data-action="fund-goal" data-id="${g.id}" data-primary>Add funds ${kbd('Enter')}</button>`}<button class="btn btn-ghost" data-action="edit-goal" data-id="${g.id}" data-edit>Edit ${kbd('E')}</button>${main || S.goals.length < 2 ? '' : `<button class="btn btn-ghost" data-action="main-goal" data-id="${g.id}">Make main</button>`}</div>
  </div>
  <div class="dk-isec">
    ${kv('Progress from', net ? 'your net worth' : a ? esc(a.name) : '<span class="muted">not linked</span>')}
    ${kv('To go', done ? `<span class="pos">nothing</span>` : `<span class="num">${money(g.target - saved, { cents: false })}</span>`)}
    ${kv('By', g.due ? fmtDate(g.due) + (done ? '' : p && p.overdue ? ' <span class="warn">past</span>' : ` <span class="muted">${DOT} ${relDays(daysUntil(g.due))}</span>`) : '<span class="muted">no date</span>')}
    ${!done && p && !p.overdue ? kv('Pace', `<span class="num">${money(p.perMonth, { cents: false })}</span>/mo`) : ''}
    ${d ? kv('Last 30 days', `<span class="num ${d.amt >= 0 ? 'pos' : 'neg'}">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })}</span>`) : ''}
  </div>
  ${!net ? (() => { const t = S.txns.filter(x => x.kind === 'goal' && x.desc.endsWith(' toward ' + g.name)).slice(0, 5); return t.length ? `<div class="dk-isec"><div class="label dk-il">Added</div><ul class="list dk-mini">${t.map(txnRow).join('')}</ul></div>` : ''; })() : ''}`;
}

/* ---------- desktop: upcoming ---------- */
function dkUpcoming() {
  const E = expected(), T = totals(), today = parseISO(todayStr());
  const acts = `<button class="btn btn-primary" data-action="add-upcoming" data-key="n">Add ${kbd('N')}</button>`;
  const bar = dkBar('Upcoming', 'Bills that come back on their day, and one-time money in or out. Nothing moves until it is marked paid.', acts);
  if (!S.bills.length && !S.upcoming.length) return bar + `<section class="panel welcome"><h2>Nothing coming up yet.</h2><p>Add rent, the car payment, a subscription, a refund you are waiting on, or a purchase you are planning.</p><div class="row"><button class="btn btn-primary" data-action="add-upcoming">Add something</button></div></section>`;
  const pend = [], done = [];
  for (const u of pending()) pend.push({ key: 'u:' + u.id, u, date: u.date ? +parseISO(u.date) : Infinity, name: u.name.toLowerCase(), amt: u.kind === 'in' ? u.amount : -u.amount, ac: ((acct(u.accountId) || {}).name || '~').toLowerCase(), sub: u.createdAt || '' });
  for (const b of S.bills) {
    const st = billStatus(b);
    pend.push({ key: 'b:' + b.id, b, st, date: +(st.state === 'paid' ? st.next : st.due), name: b.name.toLowerCase(), amt: -b.amount, ac: ((acct(b.from) || {}).name || '~').toLowerCase(), sub: '' });
    if (st.state === 'paid') done.push({ key: 'p:' + b.id, b, st, date: st.date || '' });
  }
  for (const u of S.upcoming.filter(x => x.done)) done.push({ key: 'd:' + u.id, u, date: u.done.date || '' });
  const rows = sortList('upcoming', pend, { date: x => x.date, name: x => x.name, ac: x => x.ac, amt: x => x.amt }, (a, b) => a.date - b.date || a.sub.localeCompare(b.sub));
  done.sort((a, b) => b.date.localeCompare(a.date));
  const doneRows = done.slice(0, 20);
  const sel = dkPick('upcoming', rows.map(x => x.key).concat(doneRows.map(x => x.key)));
  const wk = upNext(7), wkOut = wk.filter(u => u.kind !== 'in'), wkSum = sum(wkOut, u => u.amount), late = wkOut.filter(u => u.days < 0).length;
  const bills = billsLeft(), afterAll = T.N + E.inn - E.out - bills;
  const when = (due, d) => `<td class="dk-c-date"><div class="num">${fmtDate(due, MD)}</div><div class="small ${d < 0 ? 'neg' : d === 0 ? 'warn' : 'muted'}">${d < 0 ? (-d) + 'd late' : relShort(d)}</div></td>`;
  const rowHTML = x => {
    if (x.u) {
      const u = x.u, inn = u.kind === 'in', a = acct(u.accountId), d = u.date ? daysUntil(u.date) : null;
      return `<tr class="dk-row${sel === x.key ? ' sel' : ''}" data-sel="${x.key}">
        ${u.date ? when(u.date, d) : `<td class="dk-c-date"><div class="small muted">no date</div></td>`}
        <td class="dk-c-tag"><span class="tag ${inn ? 'pos-tag' : 'neg-tag'}">${inn ? 'IN' : 'OUT'}</span></td>
        <td class="dk-c-main"><div class="strong">${esc(u.name)}</div>${u.note || a ? `<div class="dk-rsub">${a ? `<span class="dk-nx">${inn ? 'into ' : 'from '}${esc(a.name)}${u.note ? ' ' + DOT + ' ' : ''}</span>` : ''}${u.note ? esc(u.note) : ''}</div>` : ''}</td>
        <td class="muted dk-xl dk-c-acct">${a ? (inn ? 'into ' : 'from ') + esc(a.name) : '<span class="dk-faint">no account yet</span>'}</td>
        <td class="r num strong ${inn ? 'pos' : 'neg'}">${inn ? '+' : MINUS}${money(u.amount)}</td>
        <td class="dk-c-act"><button class="btn btn-sm btn-primary" data-action="done-upcoming" data-id="${u.id}">${inn ? 'Received' : 'Pay'}</button>${editBtn(`data-action="edit-upcoming" data-id="${u.id}"`)}</td>
      </tr>`;
    }
    const b = x.b, st = x.st, paid = st.state === 'paid', due = paid ? st.next : st.due, d = dayDiff(due, today), from = acct(b.from), to = acct(b.to);
    const sub = [from ? `<span class="dk-nx">from ${esc(from.name)}</span>` : '', to ? 'pays down ' + esc(to.name) : '', b.note ? esc(b.note) : '', paid ? `<span class="pos">paid ${fmtDate(st.date, MD)}</span>` : ''].filter(Boolean).join(`<span class="dk-sep"> ${DOT} </span>`);
    return `<tr class="dk-row${sel === x.key ? ' sel' : ''}" data-sel="${x.key}">
      ${when(due, d)}
      <td class="dk-c-tag"><span class="tag rep">${EVERY_TAG[b.every] || 'MONTHLY'}</span></td>
      <td class="dk-c-main"><div class="strong">${esc(b.name)}</div>${sub ? `<div class="dk-rsub">${sub}</div>` : ''}</td>
      <td class="muted dk-xl dk-c-acct">${from ? 'from ' + esc(from.name) : '<span class="warn">no account</span>'}</td>
      <td class="r num strong neg">${MINUS}${money(b.amount)}</td>
      <td class="dk-c-act">${paid ? '' : `<button class="btn btn-sm btn-primary" data-action="pay-bill" data-id="${b.id}">Pay</button>`}${editBtn(`data-action="edit-upcoming" data-type="bill" data-id="${b.id}"`)}</td>
    </tr>`;
  };
  const doneHTML = x => {
    if (x.u) {
      const u = x.u, inn = u.kind === 'in', a = acct(u.done.accountId);
      return `<tr class="dk-row dim${sel === x.key ? ' sel' : ''}" data-sel="${x.key}"><td class="dk-c-date"><div class="num">${fmtDate(u.done.date, MD)}</div></td><td class="dk-c-tag"><span class="tag">${inn ? 'IN' : 'OUT'}</span></td><td><div class="strong">${esc(u.name)}</div></td><td class="muted dk-c-acct dk-hide-md">${inn ? 'Received' : 'Paid'}${a ? (inn ? ' into ' : ' from ') + esc(a.name) : ''}</td><td class="r num">${inn ? '+' : MINUS}${money(u.done.amount)}</td><td class="dk-c-act"><button class="btn btn-sm btn-ghost" data-action="undo-upcoming" data-id="${u.id}">Undo</button>${editBtn(`data-action="edit-upcoming" data-id="${u.id}"`)}</td></tr>`;
    }
    const b = x.b, st = x.st, p = b.paid[st.key] || {}, from = acct(p.from), to = acct(p.to);
    const chip = p.date ? gPayChip(gJudge(b, st.key, p)) : '';
    return `<tr class="dk-row dim${sel === x.key ? ' sel' : ''}" data-sel="${x.key}"><td class="dk-c-date"><div class="num">${fmtDate(st.date, MD)}</div></td><td class="dk-c-tag"><span class="tag">${EVERY_TAG[b.every] || 'MONTHLY'}</span></td><td><div class="strong">${esc(b.name)}${chip}</div>${to ? `<div class="dk-rsub">paid down ${esc(to.name)}</div>` : ''}</td><td class="muted dk-c-acct dk-hide-md">Paid${from ? ' from ' + esc(from.name) : ''}</td><td class="r num">${MINUS}${money(st.amount)}</td><td class="dk-c-act"><button class="btn btn-sm btn-ghost" data-action="unpay-bill" data-id="${b.id}">Undo</button></td></tr>`;
  };
  /* the next 30 days as a strip: a column per day, money in rises, money out drops; a day with items selects its first one */
  const days = Array.from({ length: 31 }, (_, i) => ({ i, date: addDays(today, i), inn: 0, out: 0, items: [], keys: [] }));
  for (const x of billsDue(30)) { const d = days[Math.max(0, x.days)]; d.out += x.bill.amount; d.items.push(esc(x.bill.name) + ' ' + MINUS + money(x.bill.amount, { cents: false }) + (x.days < 0 ? ' (late)' : '')); d.keys.push('b:' + x.bill.id); if (x.days < 0) d.late = true; if (d.bill == null) d.bill = gHash('ws.lc:' + x.bill.id) % 8; }
  for (const u of pending()) {
    if (!u.date) continue;
    const n = daysUntil(u.date); if (n > 30) continue;
    const d = days[Math.max(0, n)]; if (u.kind === 'in') d.inn += u.amount; else d.out += u.amount;
    d.items.push(esc(u.name) + ' ' + (u.kind === 'in' ? '+' : MINUS) + money(u.amount, { cents: false })); d.keys.push('u:' + u.id);
  }
  const cfMax = Math.max(1, ...days.map(d => Math.max(d.inn, d.out))), cfOut = sum(days, d => d.out), cfIn = sum(days, d => d.inn);
  const strip = `<div class="dk-cf dk-hide-md" aria-label="Next 30 days">
    <div class="dk-cf-grid">${days.map(d => { const dow = d.date.getDay(); return `<div class="dk-cf-d${dow === 0 || dow === 6 ? ' we' : ''}${d.i === 0 ? ' today' : ''}${d.keys.length ? ' dk-pin' : ''}${d.late ? ' late' : ''}"${d.keys.length ? ` data-sel="${d.keys[0]}"` : ''} title="${fmtDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}${d.items.length ? ': ' + d.items.join(', ') : ''}">${d.i === 0 ? '<b class="gm-cf-hat" aria-hidden="true"></b>' : ''}${d.date.getDate() === 1 ? '<b class="gm-cf-go" aria-hidden="true">GO</b>' : ''}${d.bill != null ? `<b class="gm-cf-cap gm-c${d.bill}" aria-hidden="true"></b><b class="gm-cf-blip" aria-hidden="true"></b>` : ''}<span class="up">${d.inn ? `<i style="height:${Math.max(8, d.inn / cfMax * 100).toFixed(0)}%"></i>` : ''}</span><span class="dn">${d.out ? `<i style="height:${Math.max(8, d.out / cfMax * 100).toFixed(0)}%"></i>` : ''}</span></div>`; }).join('')}</div>
    <div class="dk-cf-axis">${days.map(d => `<span>${d.i === 0 ? 'Today' : d.date.getDay() === 1 && d.i > 2 ? fmtDate(d.date, MD) : ''}</span>`).join('')}</div>
  </div>`;
  const head = `<thead><tr>${thS('upcoming', 'date', 'Due')}<th class="dk-c-tag"></th>${thS('upcoming', 'name', 'What')}${thS('upcoming', 'ac', 'Account', 'dk-xl')}${thS('upcoming', 'amt', 'Amount', 'r', 1)}<th class="dk-c-act"></th></tr></thead>`;
  const list = `<section class="panel dk-tpanel rib-red"><div class="panel-head"><span class="label">Pending</span><span class="muted small">${rows.length} item${rows.length === 1 ? '' : 's'} ${DOT} next 30 days: <span class="num">${MINUS}${money(cfOut, { cents: false })}</span> out${cfIn ? `, <span class="num">+${money(cfIn, { cents: false })}</span> in` : ''}</span></div>
      ${rows.length ? strip : ''}
      ${rows.length ? `<table class="tbl dk-tbl">${head}<tbody>${rows.map(rowHTML).join('')}</tbody></table>` : `<p class="empty">Everything here is done.</p>`}
    </section>
    ${doneRows.length ? `<section class="panel dk-tpanel rib-green"><div class="panel-head"><span class="label">Done</span><span class="muted small">newest first</span></div><table class="tbl dk-tbl dk-tbl-done"><tbody>${doneRows.map(doneHTML).join('')}</tbody></table></section>` : ''}`;
  return bar + kpis([
    kpi('Due in 7 days', (wkSum ? MINUS : '') + money(wkSum, { cents: false }), wkSum ? 'neg' : '', (late ? `<span class="neg">${late} late</span>` : wkOut.length ? `${wkOut.length} item${wkOut.length === 1 ? '' : 's'}` : 'nothing due') + gStreakNote(), true),
    kpi(dword('Bills left') + ' this month', (bills ? MINUS : '') + money(bills, { cents: false }), bills ? 'neg' : ''),
    kpi('Going out', (E.out ? MINUS : '') + money(E.out, { cents: false }), E.out ? 'neg' : '', 'one-time, planned'),
    kpi('Coming in', (E.inn ? '+' : '') + money(E.inn, { cents: false }), E.inn ? 'pos' : '', 'not counted until it lands'),
    kpi('After all pending', money(afterAll, { cents: false }), afterAll < T.N ? 'neg' : afterAll > T.N ? 'pos' : '', `${dword('Net worth').toLowerCase()} now ${money(T.N, { cents: false })}`),
  ]) + dkSplit(list, inspUpcoming(sel));
}
function inspUpcoming(key) {
  const k = String(key || ''), id = k.slice(2), t = k[0];
  if ((t === 'u' || t === 'd') && S.upcoming.find(x => x.id === id)) {
    const u = S.upcoming.find(x => x.id === id), inn = u.kind === 'in', a = acct(u.done ? u.done.accountId : u.accountId), d = u.date ? daysUntil(u.date) : null;
    return inspHead(inn ? 'Money coming in' : 'Money going out', `<span class="tag ${inn ? 'pos-tag' : 'neg-tag'}">${inn ? 'IN' : 'OUT'}</span>`) + `<div class="dk-ib">
      <div class="dk-it"><h2>${esc(u.name)}</h2></div>
      <div class="muted small">${u.done ? (inn ? 'Received ' : 'Paid ') + fmtDate(u.done.date, MDY) : u.date ? 'Expected ' + fmtDate(u.date, MDY) + ` ${DOT} ` + relDays(d) : 'No date yet'}</div>
      <div class="dk-ibig num ${u.done ? '' : inn ? 'pos' : 'neg'}"${gRollAttr('insp:' + k, (inn ? 1 : -1) * (u.done ? u.done.amount : u.amount))}>${inn ? '+' : MINUS}${money(u.done ? u.done.amount : u.amount)}</div>
      <div class="dk-iacts">${u.done
        ? `<button class="btn btn-primary" data-action="undo-upcoming" data-id="${u.id}" data-primary>Undo ${kbd('Enter')}</button><button class="btn btn-ghost" data-action="edit-upcoming" data-id="${u.id}" data-edit>Edit ${kbd('E')}</button>`
        : `<button class="btn btn-primary" data-action="done-upcoming" data-id="${u.id}" data-primary>${inn ? 'Mark received' : 'Mark paid'} ${kbd('Enter')}</button><button class="btn btn-ghost" data-action="edit-upcoming" data-id="${u.id}" data-edit>Edit ${kbd('E')}</button>`}</div>
    </div>
    <div class="dk-isec">
      ${kv(inn ? 'Into' : 'From', a ? `${esc(a.name)} <span class="num muted">${money(a.balance, { cents: false })}</span>` : '<span class="muted">decide later</span>')}
      ${kv('Repeats', 'one time')}
      ${u.note ? kv('Note', esc(u.note)) : ''}
      ${u.createdAt ? kv('Added', fmtDate(u.createdAt, MDY)) : ''}
    </div>`;
  }
  const b = (t === 'b' || t === 'p') && S.bills.find(x => x.id === id);
  if (!b) return inspHead('Details') + `<p class="empty">Pick an item.</p>`;
  const st = billStatus(b), paid = st.state === 'paid', due = paid ? st.next : st.due, d = dayDiff(due, parseISO(todayStr())), from = acct(b.from), to = acct(b.to);
  const every = b.every === 'month' ? `every month on the ${b.day}${ordinal(b.day)}` : EVERY[b.every].toLowerCase();
  const hist = Object.keys(b.paid || {}).map(k2 => Object.assign({ k: k2 }, b.paid[k2])).filter(p => p && p.date).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
  const br = gBillRun(b.id, G.st || (G.st = gameState()));
  return inspHead('Repeating', `<span class="tag rep">${EVERY_TAG[b.every] || 'MONTHLY'}</span>`) + `<div class="dk-ib">
    <div class="dk-it"><h2>${esc(b.name)}</h2></div>
    <div class="muted small">${paid ? `<span class="pos">Paid ${fmtDate(st.date, MD)}</span> ${DOT} next ` : 'Due '}${fmtDate(due, MDY)} ${DOT} <span class="${d < 0 ? 'neg' : ''}">${d < 0 ? (-d) + ' days late' : relDays(d)}</span></div>
    <div class="dk-ibig num neg"${gRollAttr('insp:' + k, -b.amount)}>${MINUS}${money(b.amount)}</div>
    <div class="dk-iacts">${paid
      ? `<button class="btn" data-action="unpay-bill" data-id="${b.id}">Undo payment</button>`
      : `<button class="btn btn-primary" data-action="pay-bill" data-id="${b.id}" data-primary>Pay ${kbd('Enter')}</button>`}<button class="btn btn-ghost" data-action="edit-upcoming" data-type="bill" data-id="${b.id}" data-edit>Edit ${kbd('E')}</button></div>
  </div>
  <div class="dk-isec">
    ${kv('Repeats', every)}
    ${kv('From', from ? `${esc(from.name)} <span class="num muted">${money(from.balance, { cents: false })}</span>` : '<span class="warn">no account</span>')}
    ${to ? kv('Pays down', `${esc(to.name)} <span class="num muted">owes ${money(to.balance, { cents: false })}</span>`) : ''}
    ${b.every !== 'month' ? kv('Per month', `<span class="num">${money(b.amount * (PER_MONTH[b.every] || 1), { cents: false })}</span>`) : ''}
    ${b.note ? kv('Note', esc(b.note)) : ''}
  </div>
  <div class="dk-isec"><div class="label dk-il">Payments</div>${hist.length ? `<div class="gm-bstreak">${br.run ? `This bill: on time ${br.run} in a row` : 'This bill: a new streak starts with the next on-time payment'}</div><ul class="list dk-mini">${hist.map(p => `<li><span class="num muted w-date">${fmtDate(p.date, MD)}</span><span class="grow muted">${p.from && acct(p.from) ? 'from ' + esc(acct(p.from).name) : ''}</span>${gPayChip(gJudge(b, p.k, p))}<span class="num">${MINUS}${money(p.amount)}</span></li>`).join('')}</ul>` : `<p class="empty">No payments marked yet.</p>`}</div>`;
}

/* ---------- desktop: history ---------- */
function dkHistory() {
  const kinds = { all: 'All', update: 'Updates', transfer: 'Transfers', payment: 'Payments', oneoff: 'One-time', goal: 'Goals', add: 'Accounts' };
  const match = t => histFilter === 'all' || t.kind === histFilter
    || (histFilter === 'add' && t.kind === 'remove') || (histFilter === 'payment' && t.kind === 'reverse')
    || (histFilter === 'oneoff' && (t.kind === 'income' || t.kind === 'expense'));
  const list = sortList('changes', S.txns.filter(match).slice(0, 300), { date: t => t.date, kind: t => KIND_TAG[t.kind] || t.kind, desc: t => t.desc.toLowerCase(), amt: txnSigned });
  const chron = S.snapshots, recent = chron.slice(-90).map((s, i, arr) => { const j = chron.length - arr.length + i, prev = chron[j - 1]; return { s, chg: prev ? snapVal(s) - snapVal(prev) : null }; });
  const snaps = sortList('snaps', recent, { date: x => x.s.date, assets: x => x.s.assets, debt: x => x.s.liabilities, net: x => snapVal(x.s), chg: x => x.chg == null ? 0 : x.chg });
  const gst = G.st || (G.st = gameState()), srows = gSeasonRows(gst);
  const sel = dkPick('history', list.map(t => 't:' + t.id).concat(srows.map(r => 'm:' + r.m)).concat(snaps.map(x => 's:' + x.s.date)));
  const month = ym(), thisMonth = S.txns.filter(t => String(t.date).slice(0, 7) === month || localISO(new Date(t.date)).slice(0, 7) === month).length;
  const first = chron[0], last = chron[chron.length - 1], lb = S.settings.lastBackup;
  const bar = dkBar('History', 'Every change, newest first, and a net worth snapshot for each day the numbers moved.', `<button class="btn" data-action="export">Backup</button><button class="btn" data-action="toggle-theme" data-key="l">Looks ${kbd('L')}</button>`);
  const changes = `<section class="panel dk-tpanel rib-red"><div class="panel-head"><span class="label">Changes</span><div class="seg wrap">${Object.keys(kinds).map(k => `<button class="${histFilter === k ? 'on' : ''}" data-action="hist-filter" data-k="${k}">${kinds[k]}</button>`).join('')}</div></div>
    ${list.length
      ? `<div class="dk-scroll dk-scroll-tall"><table class="tbl dk-tbl"><thead><tr>${thS('changes', 'date', 'When', '', -1)}${thS('changes', 'kind', 'Kind', 'dk-c-tag')}${thS('changes', 'desc', 'What')}${thS('changes', 'amt', 'Amount', 'r', -1)}</tr></thead><tbody>
        ${list.map(t => `<tr class="dk-row${sel === 't:' + t.id ? ' sel' : ''}" data-sel="t:${t.id}"><td class="num muted dk-nowrap">${fmtDate(t.date, MD)} <span class="dk-faint">${fmtTime(t.date)}</span></td><td class="dk-c-tag"><span class="tag">${KIND_TAG[t.kind] || t.kind}</span></td><td class="dk-c-main">${esc(t.desc)}${t.note ? `<span class="muted small"> ${DOT} ${esc(t.note)}</span>` : ''}</td><td class="r num ${amtClass(t)}">${amtText(t)}</td></tr>`).join('')}
        </tbody></table></div>`
      : `<p class="empty">Nothing here yet.</p>`}
  </section>`;
  const snapP = `<section class="panel dk-tpanel rib-green"><div class="panel-head"><span class="label">Snapshots</span><span class="muted small">${chron.length} day${chron.length === 1 ? '' : 's'} recorded${chron.length > 90 ? ' ' + DOT + ' latest 90' : ''}</span></div>
    ${snaps.length
      ? `<div class="dk-scroll"><table class="tbl dk-tbl"><thead><tr>${thS('snaps', 'date', 'Date', '', -1)}${thS('snaps', 'assets', 'Assets', 'r', -1)}${thS('snaps', 'debt', 'Debt', 'r', -1)}${thS('snaps', 'net', dword('Net worth'), 'r', -1)}${thS('snaps', 'chg', 'Change', 'r', -1)}</tr></thead><tbody>
        ${snaps.map(x => `<tr class="dk-row${sel === 's:' + x.s.date ? ' sel' : ''}" data-sel="s:${x.s.date}"><td class="muted">${fmtDate(x.s.date)}</td><td class="r num pos">${money(x.s.assets, { cents: false })}</td><td class="r num neg">${x.s.liabilities ? MINUS : ''}${money(x.s.liabilities, { cents: false })}</td><td class="r num strong">${money(snapVal(x.s), { cents: false })}</td><td class="r">${x.chg == null ? '<span class="muted">' + DASH + '</span>' : signed(x.chg, { cents: false })}</td></tr>`).join('')}
        </tbody></table></div>`
      : `<p class="empty">No snapshots yet.</p>`}
  </section>`;
  return bar + kpis([
    kpi('Changes recorded', String(S.txns.length), '', `${thisMonth} this month`, true),
    kpi('Snapshots', String(chron.length), '', first ? 'since ' + fmtDate(first.date, MDY) : 'none yet'),
    kpi('Since the first one', first && last ? (snapVal(last) - snapVal(first) >= 0 ? '+' : MINUS) + money(Math.abs(snapVal(last) - snapVal(first)), { cents: false }) : DASH, first && last ? (snapVal(last) >= snapVal(first) ? 'pos' : 'neg') : '', first ? fmtDate(first.date, MD) + ' ' + ARROW + ' ' + fmtDate(last.date, MD) : ''),
    kpi('Last backup', lb ? fmtDate(lb, MD) : 'Never', lb ? '' : 'warn', lb ? fmtTime(lb) : 'download one below'),
    kpi('Sync', sync.code ? (sync.status === 'error' ? 'Paused' : 'On') : 'Off', sync.code ? (sync.status === 'error' ? 'warn' : 'pos') : '', sync.code ? (sync.last ? 'last ' + fmtDate(sync.last, MD) + ' ' + fmtTime(sync.last) : 'not yet') : 'this browser only'),
  ]) + dkSplit(changes + gSeasonsHTML(srows, sel) + snapP, inspHistory(sel)) + dkSettings();
}
function inspHistory(key) {
  const k = String(key || '');
  if (k.startsWith('m:')) return gInspSeason(k.slice(2), G.st || (G.st = gameState()));
  if (k.startsWith('t:')) {
    const t = S.txns.find(x => x.id === k.slice(2));
    if (t) {
      const f = acct(t.from), to = acct(t.to);
      const KIND = { update: 'Balance update', transfer: 'Transfer', payment: 'Bill payment', income: 'Money received', expense: 'Money paid out', goal: 'Goal funding', add: 'Account added', remove: 'Account removed', reverse: 'Undo', note: 'Note' };
      return inspHead(KIND[t.kind] || 'Change', `<span class="tag">${KIND_TAG[t.kind] || t.kind}</span>`) + `<div class="dk-ib">
        <div class="dk-it"><h2>${esc(t.desc)}</h2></div>
        <div class="muted small">${fmtDate(t.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} ${DOT} ${fmtTime(t.date)}</div>
        <div class="dk-ibig num ${amtClass(t)}"${gRollAttr('insp:' + k, txnSigned(t))}>${amtText(t)}</div>
      </div>
      <div class="dk-isec">
        ${t.from ? kv('From', f ? esc(f.name) : '<span class="muted">an account since removed</span>') : ''}
        ${t.to ? kv(t.kind === 'goal' ? 'Held in' : 'To', to ? esc(to.name) : '<span class="muted">an account since removed</span>') : ''}
        ${t.note ? kv('Note', esc(t.note)) : ''}
        ${kv('Kind', KIND[t.kind] || t.kind)}
      </div>`;
    }
  }
  if (k.startsWith('s:')) {
    const i = S.snapshots.findIndex(s => s.date === k.slice(2));
    if (i >= 0) {
      const s = S.snapshots[i], prev = S.snapshots[i - 1], v = snapVal(s);
      const back = S.snapshots.filter(x => x.date <= localISO(addDays(parseISO(s.date), -30))).pop();
      return inspHead('Snapshot') + `<div class="dk-ib">
        <div class="dk-it"><h2>${fmtDate(s.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h2></div>
        <div class="muted small">${dword('Net worth')} at the end of that day${viewAfter() ? ', after withdrawals' : ''}</div>
        <div class="dk-ibig num"${gRollAttr('insp:' + k, v)}>${money(v, { cents: false })}</div>
      </div>
      <div class="dk-isec">
        ${kv('Assets', `<span class="num pos">${money(s.assets, { cents: false })}</span>`)}
        ${kv('Debt', `<span class="num neg">${s.liabilities ? MINUS : ''}${money(s.liabilities, { cents: false })}</span>`)}
        ${s.after != null ? kv('After withdrawals', `<span class="num">${money(s.after, { cents: false })}</span>`) : ''}
        ${prev ? kv('Since ' + fmtDate(prev.date, MD), signed(v - snapVal(prev), { cents: false })) : ''}
        ${back ? kv('Since ' + fmtDate(back.date, MD), signed(v - snapVal(back), { cents: false })) : ''}
      </div>`;
    }
  }
  return inspHead('Details') + `<p class="empty">Pick a change or a snapshot.</p>`;
}
function dkSettings() {
  const copies = prevCopies();
  return `<section class="panel dk-settings rib-gold"><div class="panel-head"><span class="label">Settings</span><span class="muted small">Stored in this browser${sync.code ? ' and synced' : ''}</span></div>
    <div class="dk-set-grid">
      <div class="dk-set"><div class="strong">Look</div><div class="muted small">Now: <b>${esc((THEME_INFO[S.settings.theme] || THEME_INFO.dark).name)}</b>. ${THEMES.length} to choose from; the choice follows you to every synced device.</div><div class="row acts"><button class="btn" data-action="toggle-theme">Choose a look</button></div></div>
      ${SYNC.url ? `<div class="dk-set"><div class="strong">Sync across devices</div><div class="muted small">${sync.code
        ? `On. Your code is <b class="num">${prettyCode(sync.code)}</b>. Enter it on another device to see the same numbers there.${sync.status === 'error' ? ' <span class="warn">Cannot reach the cloud right now.</span>' : ''}`
        : 'Keep the same numbers on your computer, laptop and phone. Turn it on here, then enter the code on each other device.'}</div>
        <div class="row acts">${sync.code
          ? `<button class="btn" data-action="sync-copy">Copy code</button><button class="btn" data-action="sync-now">Sync now</button><button class="btn btn-ghost" data-action="sync-off">Turn off</button>`
          : `<button class="btn btn-primary" data-action="sync-on">Turn on sync</button><button class="btn" data-action="sync-join">I have a code</button>`}</div></div>` : ''}
      <div class="dk-set"><div class="strong">Backup and restore</div><div class="muted small">Download everything as one JSON file, or load one back. Restoring replaces what is here; a safety copy is kept first.</div><div class="row acts"><button class="btn" data-action="export">Download backup</button><button class="btn" data-action="import">Restore a file</button></div></div>
      ${copies.length ? `<div class="dk-set dk-set-wide"><div class="strong">Previous copies</div><div class="muted small">Safety copies this device kept before anything replaced its numbers, plus one a day.</div>
        <ul class="list copies">${copies.map((c, i) => `<li><span class="num muted w-date">${fmtDate(c.at, MD)}</span><span class="grow">${esc(c.reason)} <span class="muted small">${DOT} ${fmtTime(c.at)} ${DOT} ${c.accounts} account${c.accounts === 1 ? '' : 's'}</span></span><button class="btn btn-sm btn-ghost" data-action="restore-copy" data-i="${i}">Go back</button></li>`).join('')}</ul></div>` : ''}
      <div class="dk-set"><div class="strong">Start over</div><div class="muted small">Wipe all accounts, goals, bills, upcoming, plan and history${sync.code ? ', here and on every synced device' : ''}.</div><div class="row acts"><button class="btn btn-danger" data-action="reset">Erase everything</button></div></div>
    </div></section>`;
}

/* ---------- desktop: selection and keys ---------- */
const dkRows = () => Array.from(document.querySelectorAll('#main .dk-row'));
function dkSelect(key, o) {
  dkSel[view] = key;
  let hit = null;
  dkRows().forEach(r => { const on = r.dataset.sel === key; r.classList.toggle('sel', on); if (on) hit = r; });
  const insp = $('#dkInsp');
  if (insp && DK_INSP[view]) { insp.innerHTML = DK_INSP[view](key); gInspAfter(insp); }
  if (hit && o && o.scroll) hit.scrollIntoView({ block: 'nearest' });
  if (isDesk()) { document.querySelectorAll('#main .gm-lot').forEach(l => l.classList.toggle('on', l.dataset.sel === key)); gCursor(true); }
}
function dkMove(d) {
  const rows = dkRows(); if (!rows.length) return;
  let i = rows.findIndex(r => r.classList.contains('sel'));
  i = i < 0 ? (d > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + d));
  dkSelect(rows[i].dataset.sel, { scroll: true });
}
function dkPrimary(attr) {
  const row = $('#main .dk-row.sel');
  const b = $('#dkInsp [' + attr + ']') || (row && row.querySelector('[' + attr + ']'));
  G.viaKey = true;
  try {
    if (b) { if (!b.disabled) b.click(); return; }
    if (attr === 'data-primary' && row && row.dataset.action) row.click();
  } finally { G.viaKey = false; }
}
function keysHTML() {
  const or = ' <span class="muted small">or</span> ';
  const K = [[kbd('1') + ' ' + DASH + ' ' + kbd('6'), 'Go to a page: ' + VIEWS.map((v, i) => (i + 1) + ' ' + v.label).join(', ')], [kbd('J') + ' ' + kbd('K') + or + kbd(DOWN) + ' ' + kbd(UP), 'Move through the rows of a list'], [kbd('Enter'), 'The main action for the selected row: update, pay, add funds'], [kbd('E'), 'Edit the selected row'], [kbd('N'), 'Add something new on this page'], [kbd('T'), 'Transfer between accounts'], [kbd('Q'), '<b>Quick Wins</b>: this week\'s money jobs'], [kbd('U'), '<b>Check in</b>: update each balance older than a week'], [kbd('A'), '<b>Trophies</b>: awards and personal records'], [kbd('R'), '<b>Recap</b>: last month, in stars'], [kbd('M'), '<b>Sound</b>: on or off'], [kbd('L'), 'Pick a look'], [kbd('?'), 'This list'], [kbd('Esc'), 'Close a dialog']];
  return `<div class="mform dk-keys-dlg"><h3>Keyboard shortcuts</h3><p class="muted small intro">They work anywhere on the desktop layout, except while typing in a box or with a dialog open.</p>
    <table class="tbl compact"><tbody>${K.map(k => `<tr><td class="dk-nowrap">${k[0]}</td><td>${k[1]}</td></tr>`).join('')}</tbody></table>
    <p class="muted small" style="margin-top:12px">Click a column heading to sort by it; click again to flip the order. Double-click a row for its main action.</p>
    <div class="mactions"><span class="grow"></span><button type="button" class="btn btn-primary" data-close>Done</button></div></div>`;
}
function dkKeys(e) {
  if (!isDesk() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('#modalRoot').classList.contains('open')) return;   /* Esc is handled by the dialog code */
  const t = e.target;
  if (t && t.closest && t.closest('input, select, textarea, [contenteditable="true"]')) return;
  const onControl = t && t.closest && t.closest('button, a, summary');
  const k = e.key;
  if (/^[1-6]$/.test(k)) { e.preventDefault(); gFlash(k); location.hash = '#' + VIEWS[+k - 1].id; return; }
  if (k === 'j' || k === 'ArrowDown') { if (dkRows().length) { e.preventDefault(); dkMove(1); } return; }
  if (k === 'k' || k === 'ArrowUp') { if (dkRows().length) { e.preventDefault(); dkMove(-1); } return; }
  if (k === 'Enter') { if (!onControl) { e.preventDefault(); gFlash('Enter'); dkPrimary('data-primary'); } return; }
  if (k === 'e' || k === 'E') { e.preventDefault(); gFlash('E'); dkPrimary('data-edit'); return; }
  if (k === 'n' || k === 'N') { const b = $('#main [data-key="n"]'); if (b && !b.disabled) { e.preventDefault(); gFlash('N'); b.click(); } return; }
  if (k === 't' || k === 'T') {
    e.preventDefault(); gFlash('T');
    const b = $('#main [data-key="t"]');
    if (b) { if (!b.disabled) b.click(); }
    else { G.act = { name: 'transfer', id: null, rect: null, rowRect: null, sel: null, seq: G.seq, dlg: false, key: true }; actions.transfer({ dataset: {} }).catch(err => { console.error(err); toast('Something went wrong. See the console.'); }); }
    return;
  }
  if (k === 'l' || k === 'L') { e.preventDefault(); gFlash('L'); actions['toggle-theme'](); return; }
  if (k === 'm' || k === 'M') { e.preventDefault(); gFlash('M'); gToggleSound(); return; }
  /* the game's keys: Quick Wins, the check-in round, trophies, last month's recap */
  const gk = { q: 'gm-jobs', u: 'checkin-run', a: 'gm-trophies', r: 'gm-recap' }[k.toLowerCase()];
  if (gk && k.length === 1 && S.accounts.length) {
    e.preventDefault(); gFlash(k);
    G.act = { name: gk, rect: null, sel: null, seq: G.seq };
    Promise.resolve(actions[gk]({ dataset: {} })).catch(err => { console.error(err); toast('Something went wrong. See the console.'); });
    return;
  }
  if (k === '?') { e.preventDefault(); actions['dk-keys'](); return; }
}

/* ======================================================================
   game (desktop only): Wall Street: The Board. The score is the real net worth, as is:
   every $2,500 is a level, walked as a board of ten $250 spaces toward the next GO.
   All of it is worked out from the synced ledger (snapshots, ticks), so every desktop agrees.
   Only what this browser already celebrated, the last visit, the last recap shown and mute live
   outside the ledger, under ws.game.* and ws.sound. Nothing here runs, renders, stores or plays
   at 860px and below, and no figure is ever changed: presentation only.
   ====================================================================== */
const LEVEL_STEP = 2500, BOARD_SPACES = 10, SPACE_STEP = LEVEL_STEP / BOARD_SPACES;
const G = {
  st: null,             /* gameState() for the current render (render() sets it on desktop) */
  seq: 0, seqSeen: 0,   /* commit() bumps seq: a render whose seq moved is a local commit, where juice is allowed */
  act: null,            /* the last clicked action: { name, rect, sel, seq } */
  silent: false,        /* one shot: the next evaluation records what is already earned without showing it */
  prevNet: null,        /* the as-is net at the previous desktop render: a local commit that raised it gets a pickup */
  shown: new Map(),     /* roll key -> { v, text } last on screen */
  rolls: new Map(),     /* roll key -> the odometer in flight */
  timers: new Set(), pending: false,
  bigQ: [], popQ: [], big: null, pops: new Set(),   /* GO! moments: banners one at a time, pops up to three */
  checked: new Set(), recapWait: null, modalOpen: false,   /* accounts checked in this session; a recap waiting for a dialog to close */
  lastVisit: null,
  prev: null, hpShown: new Map(), skipKeys: null, flash: null, flashT: 0, navView: null, rollDelay: 0, heroFrom: null, welcomeChecked: false,   /* part 3 */
};
/* flavoured labels for the game bits. A table of its own, so the phone's labels (WORDS) never change. */
const GAME_WORDS = {
  dark:     { level: 'Level', levelUp: 'Level up', record: 'New high', paid: 'Paid on time', goalBuilt: 'Goal funded', debtCleared: 'Debt paid off', jobs: 'This week', boardCleared: 'All done this week', trophies: 'Trophies', season: 'Month', allClear: 'All clear', welcome: 'Welcome back',
              best: '▲ High', oldBest: '▲ Old high', newBest: '▲ New high' },
  tycoon:   { level: 'LVL', levelUp: 'LEVEL UP!', record: 'NEW RECORD!', paid: 'PAID!', goalBuilt: 'LANDMARK BUILT!', debtCleared: 'UNMORTGAGED!', jobs: 'Quick Wins', boardCleared: 'BOARD CLEARED!', trophies: 'Album', season: 'Season', allClear: 'Shield up', welcome: 'WELCOME BACK, TYCOON!',
              best: 'Best', oldBest: 'Old best', newBest: 'NEW RECORD' },
  heist:    { level: 'RANK', levelUp: 'RANK UP', record: 'NEW PERSONAL BEST', paid: 'BILL CLEARED', goalBuilt: 'MISSION PASSED', debtCleared: 'TARGET ELIMINATED', jobs: 'Jobs', boardCleared: 'ALL JOBS PASSED', trophies: 'Awards', season: 'Heist', allClear: 'Clean', welcome: 'WELCOME BACK',
              best: 'PB', oldBest: 'OLD PB', newBest: 'NEW PB' },
  arcade:   { level: 'LV', levelUp: 'LEVEL UP!', record: 'HI-SCORE!', paid: 'COMBO!', goalBuilt: 'QUEST COMPLETE', debtCleared: 'BOSS DEFEATED', jobs: 'Weekly quests', boardCleared: 'STAGE CLEAR', trophies: 'Achievements', season: 'Stage', allClear: 'Shield 100%', welcome: 'CONTINUE?',
              best: 'HI', oldBest: 'OLD HI', newBest: 'HI-SCORE' },
  comic:    { level: 'LVL', levelUp: 'LEVEL UP!', record: 'NEW HIGH!', paid: 'KA-CHING!', goalBuilt: 'FUNDED!', debtCleared: 'PAID OFF!', jobs: 'To-do!', boardCleared: 'DONE AND DONE!', trophies: 'Badges', season: 'Issue', allClear: 'All clear!', welcome: 'Previously...',
              best: 'Best', oldBest: 'Old best', newBest: 'NEW HIGH!' },
  casino:   { level: 'VIP', levelUp: 'VIP UPGRADE', record: 'HOUSE RECORD', paid: 'SETTLED', goalBuilt: 'JACKPOT!', debtCleared: 'MARKER SETTLED', jobs: "Tonight's table", boardCleared: 'TABLE CLEARED', trophies: 'Trophy case', season: 'Session', allClear: 'House paid', welcome: 'Welcome back to the table',
              best: 'House best', oldBest: 'Old house best', newBest: 'HOUSE RECORD' },
  passbook: { level: 'Level', levelUp: 'New level', record: 'Highest balance to date', paid: 'PAID ON TIME', goalBuilt: 'COMPLETE', debtCleared: 'PAID IN FULL', jobs: "This week's entries", boardCleared: 'Week posted', trophies: 'Merit stamps', season: 'Statement', allClear: 'Nothing owing', welcome: 'Balance brought forward',
              best: 'highest balance', oldBest: 'previous highest balance', newBest: 'Highest balance' },
};
GAME_WORDS.light = GAME_WORDS.dark;
const gword = k => (GAME_WORDS[S.settings.theme] || GAME_WORDS.dark)[k] || word(k);
/* dark and paper stay slim: they say L13 where a caption is tight */
const gQuiet = () => S.settings.theme === 'dark' || S.settings.theme === 'light';
const gLvl = (n, short) => (short && gQuiet() ? 'L' + n : gword('level') + ' ' + n);
/* casino: the VIP tier is the chip colour of the level */
const gTier = n => (n <= 5 ? 'white' : n <= 10 ? 'red' : n <= 15 ? 'green' : n <= 20 ? 'black' : 'purple');
const r2 = n => Math.round(n * 100) / 100;
const gMoney = n => money(n, { cents: false });

/* ---------- per-browser memory: only these keys, never inside the ledger ---------- */
const GK = { seen: 'ws.game.seen', last: 'ws.game.last', recap: 'ws.game.recap', recent: 'ws.game.recent', sound: 'ws.sound' };
const gMem = {};   /* when storage is blocked, the session still remembers */
function gGet(k) {
  try { const v = localStorage.getItem(k); if (v != null) return v; } catch (e) {}
  return Object.prototype.hasOwnProperty.call(gMem, k) ? gMem[k] : null;
}
function gSet(k, v) { gMem[k] = String(v); try { localStorage.setItem(k, String(v)); } catch (e) {} }
function gSeen() { try { const a = JSON.parse(gGet(GK.seen) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
/* celebrated keys, deduped. Past 2000 the oldest keys that are no longer earned go first, so nothing still earned can fire twice */
/* milestones first celebrated today, [key, date]: a correction made today gives them back */
function gRecent() {
  let a = []; try { a = JSON.parse(gGet(GK.recent) || '[]'); } catch (e) {}
  const d = todayStr();
  return Array.isArray(a) ? a.filter(x => Array.isArray(x) && x[1] === d) : [];
}
const G_UNDOABLE = /^(goal|stage|debt0|tro):/;
function gMarkSeen(keys, earned) {
  const nk = keys.filter(k => G_UNDOABLE.test(k));
  if (nk.length) { const d = todayStr(), r = gRecent().filter(x => !nk.includes(x[0])).concat(nk.map(k => [k, d])); gSet(GK.recent, JSON.stringify(r.slice(-400))); }
  const add = new Set(keys);
  let list = gSeen().filter(k => !add.has(k)).concat(Array.from(add));
  if (list.length > 2000 && earned) {
    let drop = list.length - 2000;
    list = list.filter(k => { if (drop > 0 && !add.has(k) && !(earned && earned.has(k)) && !k.startsWith('hint:')) { drop--; return false; } return true; }).slice(-4000);
  }
  gSet(GK.seen, JSON.stringify(list));
}
G.lastVisit = (() => { try { return JSON.parse(gGet(GK.last) || 'null'); } catch (e) { return null; } })();

const motionOK = () => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function gLater(fn, ms) { const t = setTimeout(() => { G.timers.delete(t); fn(); }, ms); G.timers.add(t); return t; }

/* ---------- the player, worked out from the ledger alone ----------
   Always the as-is total: the After-withdrawals switch can never move a level, a record or a trophy.
   Closes are the daily snapshots' net (never their after), so a same-day correction cannot leave a fake record. */
/* an account's balance walked back from today through the history, newest first: one step for each entry that moved it,
   with the balance before and after (what is owed, for a debt). An undone one-time item and its undo cancel out.
   With `adds`, the entry that added the account closes the walk as a step from nothing. */
function gAcctSteps(a, adds) {
  const debt = !isAsset(a), steps = [], live = new Set(S.upcoming.filter(u => u.done && u.done.txnId).map(u => u.done.txnId)), undo = [];
  let bal = +a.balance || 0;
  for (const t of S.txns) {
    if (t.kind === 'add' && t.to === a.id) { if (adds) steps.push({ t, before: 0, after: r2(bal), add: true }); break; }
    const amt = +t.amount || 0;
    /* an undone one-time item: its 'reverse' carries no account, so pair it with the income or expense it took back */
    if (t.kind === 'reverse' && !t.from && !t.to) { undo.push(amt); continue; }
    if ((t.kind === 'income' || t.kind === 'expense') && !live.has(t.id)) {
      const want = t.kind === 'income' ? -amt : amt, i = undo.findIndex(v => Math.abs(v - want) < 0.005);
      if (i >= 0) { undo.splice(i, 1); continue; }
    }
    let d = null;   /* how far this entry raised the balance (what is owed, for a debt) */
    if (t.kind === 'update') { if (t.from === a.id) d = debt ? -amt : amt; }
    else if (t.to === a.id && (t.kind === 'payment' || t.kind === 'transfer' || t.kind === 'income' || t.kind === 'reverse')) d = debt ? -amt : amt;
    else if (t.from === a.id && (t.kind === 'payment' || t.kind === 'transfer' || t.kind === 'expense' || t.kind === 'reverse')) d = debt ? amt : -amt;
    if (d == null) continue;
    steps.push({ t, before: r2(bal - d), after: r2(bal) });
    bal -= d;
  }
  return steps;
}
/* a real balance typo: an update that jumped the balance by $1,000 or more and five times up or down (a zero too many or too few),
   put right by the next update of the same account within two days: back to within 2% of where it stood, or to the number that
   was meant, the typo's digits off by a power of ten (39,182.20 for 3,918.22). A payday and the rent after it are neither. */
function gTypoPair(x, y) {
  const B = x.before, A = x.after, xm = Date.parse(x.t.date), ym2 = Date.parse(y.t.date);
  if (!(Math.abs(A - B) >= 1000) || !isFinite(xm) || !isFinite(ym2) || ym2 < xm || ym2 - xm > 2 * 864e5) return false;
  const k = (Math.abs(A) + 1) / (Math.abs(B) + 1);
  if (!(k >= 5 || k <= 0.2)) return false;
  if (Math.abs(y.after - B) <= Math.max(50, 0.02 * Math.abs(B))) return true;
  const e = Math.log10((Math.abs(A) + 0.01) / (Math.abs(y.after) + 0.01)), n = Math.round(e);
  return n !== 0 && Math.abs(e - n) < 0.02;
}
/* the stretches a typo stood: its days are left out of the game's closes (records, levels, months) and its ticks out of today's
   baseline. The chart still shows the ledger as it is. */
function gTypos() {
  const out = { days: new Set(), wins: [] };
  for (const a of S.accounts) {
    const ups = gAcctSteps(a).filter(s => s.t.kind === 'update');   /* newest first */
    for (let i = ups.length - 1; i >= 1; i--) {
      if (!gTypoPair(ups[i], ups[i - 1])) continue;
      const xm = Date.parse(ups[i].t.date), ym2 = Date.parse(ups[i - 1].t.date), end = localISO(new Date(ym2));
      out.wins.push([xm, ym2]);
      for (let d = parseISO(localISO(new Date(xm))); localISO(d) < end; d = addDays(d, 1)) out.days.add(localISO(d));
    }
  }
  return out;
}
function gameState() {
  const net = r2(totals().N), lvl = level(net), today = todayStr(), typo = gTypos(), spikes = typo.days;
  const lo = (lvl - 1) * LEVEL_STEP, hi = lvl * LEVEL_STEP;
  const band = net <= 0
    ? { lo: 0, hi: LEVEL_STEP, xp: 0, toNext: r2(LEVEL_STEP - net), pct: 0, spaces: 0, breakEven: r2(-net) }
    : { lo, hi, xp: r2(net - lo), toNext: r2(hi - net), pct: (net - lo) / LEVEL_STEP * 100, spaces: Math.min(BOARD_SPACES - 1, Math.floor((net - lo) / SPACE_STEP)) };
  const closes = S.snapshots.filter(s => s && s.date && isFinite(s.net) && !spikes.has(String(s.date).slice(0, 10))).map(s => ({ date: String(s.date).slice(0, 10), net: r2(s.net) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /* the record to beat: the best close on any day before today */
  const prior = closes.filter(c => c.date < today);
  let prevBest = null, prevDate = null;
  for (const c of prior) if (prevBest == null || c.net > prevBest) { prevBest = c.net; prevDate = c.date; }
  const record = { prevBest, prevDate, isNew: prior.length > 0 && net >= prevBest + 1, gap: prevBest == null ? null : r2(prevBest - net) };
  const bestEver = closes.reduce((m, c) => Math.max(m, c.net), net);
  /* the first day each level was reached; the levels at or under the first snapshot date from when tracking began */
  const began = level(closes.length ? closes[0].net : net), levelDates = {};
  for (let L = 1; L <= began; L++) levelDates[L] = closes.length ? closes[0].date : today;
  let top = began;
  for (const c of closes.concat([{ date: today, net }])) { const L = level(c.net); while (top < L) levelDates[++top] = c.date; }
  /* today so far: against the last change before midnight, else the last close before today */
  const midnight = parseISO(today).getTime();
  let base = null, bt = -Infinity;
  for (const t of S.ticks || []) { const ms = Date.parse(t.t); if (ms < midnight && ms >= bt && isFinite(t.net) && !typo.wins.some(w => ms >= w[0] && ms < w[1])) { bt = ms; base = t.net; } }
  if (base == null && prior.length) base = prior[prior.length - 1].net;
  const st = {
    date: today, net, level: lvl, band, closes, record,
    bestEver: r2(bestEver), bestLevel: level(bestEver), levelDates, levelBegan: began, spikes: Array.from(spikes),
    today: { base: base == null ? null : r2(base), delta: base == null ? 0 : r2(net - base) },
  };
  gBosses(st); gStages(st);   /* every debt's recorded peak, every goal's stage (part 3); the trophies read them */
  gHabits(st);   /* streaks, this week's jobs, the months, trophies (part 2, below) */
  return st;
}
/* shared for later features: the due date of a repeating item's occurrence key, and calendar helpers */
function occDue(b, key) {
  const k = String(key);
  if (/^\d{4}-\d{2}$/.test(k)) { const p = k.split('-').map(Number); return billDue(b, new Date(p[0], p[1] - 1, 1)); }
  if (/^\d{4}$/.test(k)) return occAt(b, new Date(+k, 0, 1)).due;
  return parseISO(k);
}
function weekStart(d) { const x = new Date(d || new Date()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
const monthOf = d => ym(d instanceof Date ? d : d ? parseISO(d) : new Date());

/* ---------- the player card: words and markup ---------- */
/* whole dollars that always agree with the counter on screen (money() rounds the same way) */
function gShown(st) {
  const N = Math.round(st.net), best = st.record.prevBest == null ? null : Math.round(st.record.prevBest);
  return { net: N, xp: N - st.band.lo, toNext: st.band.hi - N, breakEven: -N, over: best == null ? 0 : N - best, gap: best == null ? 0 : best - N };
}
function gTitle(st) {
  const d = gShown(st), rk = gRankOf(st.bestLevel);
  if (st.net <= 0) return `Level 1 ${DOT} ${gMoney(st.net)} as is ${DOT} ${gMoney(d.breakEven)} to break even`;
  return `Level ${st.level} ${DOT} ${gMoney(st.net)} as is ${DOT} ${gMoney(d.xp)} of ${gMoney(LEVEL_STEP)} into this level ${DOT} ${gLvl(st.level + 1)} at ${gMoney(st.band.hi)}`
    + (st.level < st.bestLevel ? ` ${DOT} best ${gLvl(st.bestLevel)}` : '') + ` ${DOT} title: ${rk.title}` + (rk.next ? ` ${DOT} next unlock at ${gLvl(rk.next.at)}: ${rk.next.title}, ${rk.next.frame.toLowerCase()} frame` : '');
}
/* ---------- titles: every few levels the player earns a title and a frame for the level badge. Worked out from the best level
   alone (the same on every device), cosmetic only, and never taken away by a dip ---------- */
const RANK_AT = [1, 5, 10, 15, 20, 30, 40];
const RANK_FRAMES = ['Plain', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Ruby', 'Diamond'];
const RANK_TITLES = {
  tycoon: ['Newcomer', 'Homeowner', 'Landlord', 'Property Baron', 'Mogul', 'Tycoon', 'Monopolist'],
  heist: ['Street Hustler', 'Crew Member', 'Wheelman', 'Enforcer', 'Crew Boss', 'Kingpin', 'Mastermind'],
  arcade: ['Rookie', 'Challenger', 'Veteran', 'Elite', 'Champion', 'Master', 'Grandmaster'],
  comic: ['Sidekick', 'Rookie Hero', 'Hero', 'Super Hero', 'Legend', 'Icon', 'Myth'],
  casino: ['Guest', 'Regular', 'High Roller', 'Whale', 'VIP Suite', 'Penthouse', 'The House'],
  passbook: ['Account holder', 'Saver', 'Steady saver', 'Prudent saver', 'Patron', 'Benefactor', 'Founder'],
  dark: ['Starter', 'Builder', 'Steady', 'Established', 'Seasoned', 'Veteran', 'Summit'],
};
function gRankOf(n) {
  let i = 0; while (i + 1 < RANK_AT.length && n >= RANK_AT[i + 1]) i++;
  const T = RANK_TITLES[gTheme()] || RANK_TITLES.dark;
  return { i, title: T[i], frame: RANK_FRAMES[i], next: i + 1 < RANK_AT.length ? { at: RANK_AT[i + 1], title: T[i + 1], frame: RANK_FRAMES[i + 1] } : null };
}
/* the hero's medallion (1400px and up): the title, and what the next one unlocks, with the real distance to it */
function gRankHTML(st) {
  const rk = gRankOf(st.bestLevel), nx = rk.next, to = nx ? Math.max(1, (nx.at - 1) * LEVEL_STEP - gShown(st).net) : 0;
  return `<div class="gm-rank gm-fr-${rk.i}" data-action="gm-trophies" title="${esc(`${rk.title}: the title for reaching ${gLvl(RANK_AT[rk.i])}${nx ? `. Next: ${nx.title} and a ${nx.frame.toLowerCase()} frame at ${gLvl(nx.at)}, ${gMoney((nx.at - 1) * LEVEL_STEP)} as is` : ''}`)}">
      <span class="gm-rank-medal" aria-hidden="true"><b>${st.bestLevel}</b></span>
      <span class="gm-rank-txt"><span class="gm-rank-k">${esc(rk.frame === 'Plain' ? 'Your title' : rk.frame + ' frame')}</span><span class="gm-rank-t">${esc(rk.title)}</span>${nx ? `<span class="gm-rank-n">Next: ${esc(nx.title)} at ${esc(gLvl(nx.at))} ${DOT} <span class="num">${gMoney(to)}</span> to go</span>` : '<span class="gm-rank-n">Every title unlocked</span>'}</span>
    </div>`;
}
function gCaption(st, where) {
  const t = S.settings.theme, next = st.level + 1, d = gShown(st);
  if (st.net <= 0) return `${gLvl(1, true)} ${DOT} ${gMoney(d.breakEven)} to break even`;
  /* below the best level: neutral, the way back, never a demotion */
  if (st.level < st.bestLevel) return `Best ${gLvl(st.bestLevel, true)} ${DOT} back at ${gMoney((st.bestLevel - 1) * LEVEL_STEP)}`;
  if (gQuiet()) return `L${st.level} ${DOT} ${gMoney(d.toNext)} to L${next}`;
  if (where === 'hero' && t === 'heist') return `RP ${gMoney(d.xp)} / ${gMoney(LEVEL_STEP)} ${DOT} ${gLvl(next)} at ${gMoney(st.band.hi)}`;
  if (where === 'hero' && t === 'arcade') return `EXP ${gMoney(d.xp)}/${gMoney(LEVEL_STEP)}`;
  if (where === 'hero' && t === 'passbook') return `${gMoney(d.toNext)} to go`;
  if (where === 'hero') return `${gMoney(d.toNext)} to go`;   /* the board's end cap already names the next level */
  return `${gMoney(d.toNext)} to ${gLvl(next)}`;
}
/* first-reached dates, newest first, at most five */
function gDatesTitle(st) {
  const out = [];
  for (let L = st.bestLevel; L >= st.levelBegan && out.length < 5; L--) {
    if (st.levelDates[L]) out.push(`${gLvl(L)} ${fmtDate(st.levelDates[L])}${L === st.levelBegan ? ' (tracking began)' : ''}`);
  }
  return out.join(` ${DOT} `);
}
const gRollAttr = (key, v) => ` data-roll="${esc(key)}" data-v="${+v || 0}"`;
function gBadgeHTML(st) { return `<span class="gm-badge gm-tier-${gTier(st.level)} gm-fr-${gRankOf(st.bestLevel).i}" aria-label="${esc(gLvl(st.level))}">${st.level}</span>`; }
function gXpHTML(st) {
  const below = st.net > 0 && st.level < st.bestLevel;
  /* the rail is narrow: below the best level it shows "LVL 13 back at $30,000"; the full caption stays in its text for screen readers */
  const cap = below ? `<span class="gm-sr">Best </span>${esc(gLvl(st.bestLevel, true))}<span class="gm-sr"> ${DOT}</span> back at ${gMoney((st.bestLevel - 1) * LEVEL_STEP)}` : esc(gCaption(st, 'rail'));
  return `<span class="gm-xp gm-tier-${gTier(st.level)}${below ? ' gm-below' : ''}"><span class="gm-xpbar"><i style="width:${st.band.pct.toFixed(2)}%"></i></span><span class="gm-xpcap">${cap}</span></span>`;
}
/* the hero's board: ten $250 spaces, the token on the one being walked, the next level at the end */
function gTrackHTML(st, after) {
  const b = st.band, live = st.net > 0;
  const spaces = Array.from({ length: BOARD_SPACES }, (_, i) => {
    const lo = b.lo + i * SPACE_STEP, own = live && i < b.spaces, cur = live ? i === b.spaces : i === 0;
    const part = cur && live ? Math.max(0, Math.min(100, (b.xp - i * SPACE_STEP) / SPACE_STEP * 100)) : 0;
    return `<i class="gm-sp${own ? ' own' : ''}${cur ? ' cur' : ''}" title="${gMoney(lo)} – ${gMoney(lo + SPACE_STEP)}"${cur ? ` style="--sp:${part.toFixed(1)}%"` : ''}>${cur ? '<b class="gm-tok"></b>' : ''}</i>`;
  }).join('');
  return `<div class="gm-track gm-tier-${gTier(st.level)}${b.pct >= 90 ? ' gm-near' : ''}${st.level < st.bestLevel ? ' gm-below' : ''}" title="${esc(gDatesTitle(st))}" data-action="gm-trophies">
        <span class="gm-lv" data-n="${st.level}"></span><span class="gm-spaces" style="--pct:${b.pct.toFixed(2)}%">${spaces}<s class="gm-fill"></s></span><span class="gm-cap" data-n="${st.level + 1}">${esc(gLvl(st.level + 1))}</span>
        <span class="gm-cap-line">${esc(gCaption(st, 'hero'))}${after ? ` ${DOT} as is` : ''}</span>
      </div>`;
}
/* the record ribbon: a new high over the best close before today, or how far off it is */
function gRibbonHTML(st, after) {
  const r = st.record;
  if (r.prevBest == null) return '';
  const asIs = after ? ' (as is)' : '';
  const d = gShown(st);
  if (r.isNew) {
    const over = gMoney(d.over);
    return `<span class="gm-rib gm-rib-new" title="${esc(`${gword('record')}: ${gMoney(st.net)}${asIs}, ${over} over the best close of ${gMoney(r.prevBest)} on ${fmtDate(r.prevDate)}`)}"><span class="gm-rib-t">${esc(gword('record'))}</span><span class="gm-rib-amt"> ${DOT} +${over} over ${fmtDate(r.prevDate, MD)}</span></span>`;
  }
  if (d.gap < 1) return `<span class="gm-rib gm-rib-best gm-rib-tie" title="${esc(`Level with the best close, ${gMoney(r.prevBest)} on ${fmtDate(r.prevDate)}${asIs}. Any gain sets a record.`)}">Tied best ${gMoney(r.prevBest)} ${DOT} any gain sets a record</span>`;
  const gap = gMoney(d.gap);
  return `<span class="gm-rib gm-rib-best" title="${esc(`Best close ${gMoney(r.prevBest)} on ${fmtDate(r.prevDate)}${asIs}. ${gap} more beats it.`)}">Best ${gMoney(r.prevBest)} ${DOT} ${gap} to beat</span>`;
}
function gTodayHTML(st, after) {
  const d = st.today.delta;
  if (Math.abs(d) < 1) return '';
  return `<span class="gm-today"> ${DOT} today <span class="num ${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : MINUS}${gMoney(Math.abs(d))}</span>${after ? ' <span class="muted">as is</span>' : ''}</span>`;
}
/* the emblem at 861-1199px, where the rail folds: an XP ring and the level, with the rail tile's title */
function gameNav() {
  const bm = $('.brand-mark'), br = $('.brand');
  if (!bm || !br) return;
  if (!isDesk() || !S.accounts.length) {
    if (bm.dataset.lvl) { bm.style.removeProperty('--xp'); if (!bm.getAttribute('style')) bm.removeAttribute('style'); delete bm.dataset.lvl; br.removeAttribute('title'); }
    const tb = $('.side-foot .gm-tro-btn'); if (tb) tb.remove();
    gSoundBtn();
    return;
  }
  const st = G.st || (G.st = gameState());
  let tb = $('.side-foot .gm-tro-btn');
  if (!tb) {
    tb = document.createElement('button');
    tb.type = 'button'; tb.className = 'link desk-only gm-tro-btn'; tb.dataset.action = 'gm-trophies';
    tb.innerHTML = `<i class="gm-tro-ico" aria-hidden="true"></i><span class="gm-tro-cnt num"></span>`;
    const help = $('.side-foot .help'); if (help) help.after(tb); else $('.side-foot').appendChild(tb);
  }
  const T = st.trophies;
  tb.title = `${gword('trophies')} (A) ${DOT} ${T.earned} of ${T.of} tiers`; tb.setAttribute('aria-label', tb.title);
  tb.querySelector('.gm-tro-cnt').textContent = '★' + T.earned;
  gSoundBtn();
  bm.style.setProperty('--xp', st.band.pct.toFixed(2) + '%');
  bm.dataset.lvl = st.level;
  br.title = gTitle(st);
  if (!G.inRender) gameBindRolls($('#dkTicker'));   /* inside render(), gameAfterRender binds it once the visit and the coin wait are known */
}

/* ---------- the scoreboard chart: level lanes, the best close, the new-record flag (As-is view only) ---------- */
function gChartLayer(c) {
  const st = G.st, r = st.record, out = [], x0 = c.PL, x1 = c.W - c.PR, top = c.PT, bot = c.H - c.PB;
  const inPlot = y => y >= top - 0.5 && y <= bot + 0.5;
  let lanes = [];
  for (let v = Math.ceil(c.yMin / LEVEL_STEP) * LEVEL_STEP; v <= c.yMax; v += LEVEL_STEP) if (v > 0) lanes.push(v);
  while (lanes.length > 4) lanes = lanes.filter((_, i) => i % 2 === 0);
  const recY = r.prevBest != null ? +c.Y(r.prevBest).toFixed(1) : null;
  for (const v of lanes) {
    const y = +c.Y(v).toFixed(1), L = level(v);
    out.push(`<g class="gm-lane gm-c${(L - 1) % 8}"><line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><rect class="gm-band" x="${x0}" y="${(y - 1.5).toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="3"/><g class="gm-tag gm-lane-tag" transform="translate(${x0 + 4} ${y})"><rect class="gm-tag-bg"/><text x="5" y="${y - 20 < top ? 14 : -6}">${esc(gLvl(L, true))}</text></g></g>`);
  }
  if (recY != null && inPlot(recY)) {
    /* the tag steps right of a level label that sits at the same height */
    const nudge = lanes.some(v => Math.abs(c.Y(v) - recY) < 22) ? 74 : 0;
    const lbl = `${gword(r.isNew ? 'oldBest' : 'best')} ${gMoney(r.prevBest)} ${DOT} ${fmtDate(r.prevDate, MD)}`;
    out.push(`<g class="gm-rec${r.isNew ? ' beaten' : ''}"><line x1="${x0}" x2="${x1}" y1="${recY}" y2="${recY}"/>${S.settings.theme === 'passbook' ? `<line class="gm-rec2" x1="${x0}" x2="${x1}" y1="${recY + 3}" y2="${recY + 3}"/>` : ''}<g class="gm-tag gm-rec-tag" transform="translate(${x0 + 4 + nudge} ${recY})"><rect class="gm-tag-bg"/><text x="5" y="${recY - 20 < top ? 16 : -7}">${esc(lbl)}</text></g></g>`);
  }
  let cls = '';
  if (r.isNew) {
    const x = c.last[0], y = c.last[1];
    cls = ' gm-rec-now';
    out.push(`<g class="gm-endmk" transform="translate(${x} ${y})"><path class="gm-burst" d="M0 -17L4 -8 13 -11 8 -3 16 3 6 4 7 14 0 7-7 14-6 4-16 3-8-3-13-11-4-8Z"/><line class="gm-pole" x1="0" y1="0" x2="0" y2="-27"/><path class="gm-flag" d="M0 -27h16v11H0z"/><path class="gm-flag-ck" d="M0 -27h4v3.67H0zM8 -27h4v3.67H8zM4 -23.33h4v3.67H4zM12 -23.33h4v3.67h-4zM0 -19.67h4v3.67H0zM8 -19.67h4v3.67H8z"/><circle class="gm-coin" r="6"/><g class="gm-tag gm-end-tag" transform="translate(-8 -21)"><rect class="gm-tag-bg"/><text x="-4" y="4" text-anchor="end">${esc(gword('newBest'))} ${gMoney(st.net)}</text></g></g>`);
  }
  return { svg: `<g class="gm-chart" aria-hidden="true">${out.join('')}</g>`, cls };
}
/* the hero's game rows settle once the web fonts arrive, which can shrink the chart after it was drawn: redraw when its box really changes */
let gChartRO = null;
function gWatchChart() {
  const wrap = $('#chart');
  if (!wrap || !wrap.dataset.fill || typeof ResizeObserver === 'undefined') return;
  if (!gChartRO) gChartRO = new ResizeObserver(entries => {
    for (const e of entries) {
      const w = e.target, svg = w.querySelector('svg');
      if (!w.isConnected || !svg || !isDesk()) continue;
      const cs = getComputedStyle(w), vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
      const H = Math.max(160, Math.floor(w.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2)), W = Math.max(280, w.clientWidth - 24);
      if (Math.abs(vb[3] - H) > 2 || Math.abs(vb[2] - W) > 2) { drawChart(); gCursor(false); }
    }
  });
  gChartRO.disconnect();
  gChartRO.observe(wrap);
}
/* SVG text cannot size its own backdrop: fit each tag's rect to its text once it is on screen */
function gChartFit(wrap) {
  wrap.querySelectorAll('.gm-tag').forEach(g => {
    const t = g.querySelector('text'), bg = g.querySelector('.gm-tag-bg');
    let b = null; try { b = t.getBBox(); } catch (e) { return; }
    if (!b || !b.width) return;
    bg.setAttribute('x', (b.x - 5).toFixed(1)); bg.setAttribute('y', (b.y - 2).toFixed(1));
    bg.setAttribute('width', (b.width + 10).toFixed(1)); bg.setAttribute('height', (b.height + 4).toFixed(1));
  });
}

/* ---------- the counter: numbers roll to their new value like an odometer ----------
   Anything marked data-roll="key" data-v="value" rolls whenever its key comes back with a different value,
   whatever the cause (a change here, a sync pull, another tab). The first time in a page load it just shows,
   except the Overview hero, which counts up from $0 as it always has. */
function gameBindRolls(root) { (root || document).querySelectorAll('[data-roll]').forEach(gRollBind); }
function gRollBind(el) {
  const key = el.dataset.roll;
  if (!key || el.__gRoll) return;
  const text = el.textContent, v = +el.dataset.v || 0, prev = G.shown.get(key), act = G.rolls.get(key);
  if (act) gRollEnd(act, act.el.isConnected);   /* a render replaced the rolling number: it is over, the new one shows its value */
  G.shown.set(key, { v, text });
  if (!prev) { if (key === 'hero') { if (G.heroFrom != null) { shownNet = G.heroFrom; G.heroFrom = null; } const from = shownNet == null ? 0 : shownNet; if (Math.abs(from - v) >= 1) el.textContent = money(from, { cents: false }); countUp(el, v); } return; }
  if (key === 'hero') shownNet = v;   /* the phone's count-up (and a later first bind) starts from what the desktop last showed */
  if (prev.text === text || !motionOK()) return;
  gRoll(el, key, prev.text, text, v > prev.v);
}
function gRoll(el, key, from, to, rising) {
  const fd = from.replace(/\D/g, ''), td = to.replace(/\D/g, '');
  if (!td) return;
  const total = fd.length === td.length ? 700 : 900;
  /* bigger digits roll up, smaller roll down, like a real counter */
  const up = fd.length !== td.length ? td.length > fd.length : td >= fd;
  const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
  let lh = parseFloat(cs.lineHeight); if (!(lh > 0)) lh = Math.round(fs * 1.2);
  el.textContent = '';
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:0;top:0';
  el.appendChild(probe);
  const wd = [];
  for (let d = 0; d < 10; d++) { probe.textContent = String(d); wd.push(probe.getBoundingClientRect().width); }
  probe.remove();
  const n = td.length, stag = n > 1 ? Math.min(60, total * 0.4 / (n - 1)) : 0, dur = Math.round(total - stag * (n - 1)), base = key === 'rail' || key === 'hero' ? G.rollDelay || 0 : 0;
  /* the element's text stays the exact new value the whole time (a hidden span); the reels and separators are drawn by CSS */
  const frag = document.createDocumentFragment(), cols = [], sr = document.createElement('span');
  sr.className = 'rl-sr'; sr.textContent = to; frag.appendChild(sr);
  let j = n;
  for (const ch of to) {
    /* a separator stands in a one-glyph window of the same height as the reels, so every character sits on one line */
    if (ch < '0' || ch > '9') { const w = document.createElement('span'), c = document.createElement('span'); w.className = 'rl-w rl-sep'; w.setAttribute('aria-hidden', 'true'); w.style.height = lh + 'px'; c.className = 'rl-col rl-s'; c.dataset.c = ch; c.style.lineHeight = lh + 'px'; w.appendChild(c); frag.appendChild(w); continue; }
    j--;   /* this digit's place, counted from the right */
    const t = +ch, fc = fd[fd.length - 1 - j], f = fc == null ? 0 : +fc;
    let a = f, b = t;
    if (up) { if (b < a) b += 10; } else if (a < b) a += 10;
    const w = document.createElement('span'), c = document.createElement('span');
    w.className = 'rl-w' + (a === b ? ' rl-still' : ''); w.setAttribute('aria-hidden', 'true');
    w.style.width = wd[t].toFixed(2) + 'px'; w.style.height = lh + 'px';
    const delay = Math.round(stag * j) + base;
    w.style.setProperty('--rl-end', (delay + dur) + 'ms');
    c.className = 'rl-col';
    c.style.lineHeight = lh + 'px'; c.style.setProperty('--rl-lh', lh + 'px');
    c.style.transform = `translateY(${(-a * lh).toFixed(2)}px)`;
    w.appendChild(c); frag.appendChild(w);
    cols.push({ c, b, delay, steps: Math.max(1, Math.abs(b - a)) });
  }
  el.setAttribute('aria-label', to);
  el.classList.add('rl-on'); if (rising) el.classList.add('rl-rise');
  el.__gRoll = true;
  el.appendChild(frag);
  void el.offsetWidth;   /* lay out the old digits first, so the move is seen */
  for (const x of cols) {
    const s = x.c.style;
    s.transitionDuration = dur + 'ms'; s.transitionDelay = x.delay + 'ms'; s.setProperty('--rl-steps', x.steps);
    s.transform = `translateY(${(-x.b * lh).toFixed(2)}px)`;
  }
  const r = { key, el, to, timer: 0 };
  /* a timer, not transitionend: with transitions switched off the number must still end up plain */
  r.timer = gLater(() => gRollEnd(r, true), total + base + 40);
  G.rolls.set(key, r);
}
function gRollEnd(r, show) {
  clearTimeout(r.timer); G.timers.delete(r.timer);
  if (G.rolls.get(r.key) === r) G.rolls.delete(r.key);
  r.el.__gRoll = false;
  if (show) { r.el.textContent = r.to; r.el.removeAttribute('aria-label'); r.el.classList.remove('rl-on', 'rl-rise'); }
}

/* ---------- the fx layer: pickups and one-time moments, above the page, never in the way ---------- */
function fxRoot() {
  let r = document.getElementById('fxRoot');
  if (!r) {
    r = document.createElement('div');
    r.id = 'fxRoot'; r.className = 'desk-only fx-root'; r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  return r;
}
/* the real amount the as-is net just rose by: in the rail it sits beside the cash counter, inside its tile (never on the
   label above it); without the rail, it floats up from the hero's number or the emblem */
function gPickup(amount) {
  if (!motionOK()) return;
  const vis = el => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0;
  const rail = $('#dkTicker [data-roll="rail"]'), hero = $('#main [data-roll="hero"]'), mark = $('.brand-mark');
  const a = vis(rail) ? rail : vis(hero) ? hero : vis(mark) ? mark : null;
  const rc = a && a !== mark ? gTextRect(a) : a ? a.getBoundingClientRect() : G.act && G.act.rect;
  if (!rc) return;
  const p = document.createElement('div');
  p.className = 'fx-pick' + (a === hero ? ' fx-pick-hero' : a === rail ? ' fx-pick-rail' : '');
  p.innerHTML = `<span class="fx-pick-v">+${gMoney(amount)}</span>`;
  p.style.cssText = `--cx:${(rc.left + rc.width / 2).toFixed(1)}px;--ty:${rc.top.toFixed(1)}px;--rx:${rc.right.toFixed(1)}px;--my:${(rc.top + rc.height / 2).toFixed(1)}px`;
  fxRoot().appendChild(p);
  if (a === rail) {
    /* the tile is narrow: the amount takes the label row's place for a moment (never over the rolling number or beside the rail) */
    const tile = rail.closest('.dk-tick'), top = tile && tile.querySelector('.gm-tick-top'), tr = top ? top.getBoundingClientRect() : rc, w = p.offsetWidth, er = tile ? tile.getBoundingClientRect() : rc;
    p.style.setProperty('--rx', Math.max(er.left + 6, Math.min(rc.left, er.right - 6 - w)).toFixed(1) + 'px');
    p.style.setProperty('--my', (tr.top + tr.height / 2).toFixed(1) + 'px');
    if (tile) { tile.classList.add('gm-picking'); gLater(() => tile.classList.remove('gm-picking'), 900); }
  }
  gLater(() => p.remove(), 1150);
}
/* one-time moments: gEarned() (part 2) lists every key the ledger has earned; a key is celebrated once per browser.
   A first run in a browser, example data, a reset, a restore, Go back and joining sync record what is there without showing it. */
/* commits that raise the net without being a good habit: entering or deleting an account, undoing a payment.
   The numbers still roll to their true values; there is just no pickup, and any moment is recorded quietly. */
const G_QUIET_ACTS = new Set(['add-account', 'edit-account', 'unpay-bill', 'undo-upcoming']);
/* goals, bills, buckets and pay typed in or edited (save + render, no commit): what they earn is recorded, never celebrated */
const gTyped = () => { if (isDesk()) G.quietNext = true; };
const gQuietCommit = () => !!G.act && G.act.seq === G.seq - 1 && G_QUIET_ACTS.has(G.act.name);
/* only a correction gives anything back (an undo, a quiet edit, an update reversing a recent one): levels above the best
   close and the Levels tiers above it, and goals, stages, cleared debts and trophy tiers first celebrated today.
   An ordinary dip (a bill paid, a market move) takes nothing back, so nothing is celebrated twice for it. */
function gUnsee(st, ek, fix) {
  if (!fix) return;
  const lvT = (st.trophies.fams.find(f => f.id === 'levels') || { tier: 0 }).tier, rec = new Set(gRecent().map(x => x[0]));
  const seen = gSeen(), drop = new Set(seen.filter(k => !ek.has(k) && (/^lvl:\d+$/.test(k) ? +k.slice(4) > st.bestLevel : /^tro:levels:\d$/.test(k) ? +k.slice(11) > lvT : rec.has(k))));
  if (!drop.size) return;
  gSet(GK.seen, JSON.stringify(seen.filter(k => !drop.has(k))));
  gSet(GK.recent, JSON.stringify(gRecent().filter(x => !drop.has(x[0]))));
}
/* a change that takes something back: an undo, a quiet edit, or an update that puts a real typo right (gTypoPair) */
function gIsFix(quiet) {
  if (quiet) return true;
  const t0 = S.txns[0];
  if (!t0) return false;
  if (t0.kind === 'reverse' || t0.kind === 'remove') return true;
  if (t0.kind !== 'update') return false;
  const a = acct(t0.from);
  if (!a) return false;
  const ups = gAcctSteps(a).filter(s => s.t.kind === 'update');
  return ups.length >= 2 && ups[0].t === t0 && gTypoPair(ups[1], ups[0]);
}
function gMoments(st, quiet, local, fix) {
  if (!S.accounts.length) return;
  if (document.hidden) { G.pending = true; G.pendingQuiet = G.pendingQuiet || !!quiet; return; }   /* wait until the tab is looked at */
  G.pending = false; G.pendingQuiet = false;
  fix = !!fix || (!!local && gIsFix(quiet));
  const first = gGet(GK.seen) == null, silent = G.silent || first;
  G.silent = false;
  const earned = gEarned(st);
  gUnsee(st, new Set(earned.map(m => m.key)), fix);
  const seen = new Set(gSeen()), fresh = earned.filter(m => !seen.has(m.key));
  if (!fresh.length) { if (first) gSet(GK.seen, '[]'); return; }
  gMarkSeen(fresh.map(m => m.key), new Set(earned.map(m => m.key)));
  if (silent || quiet) return;
  gQueue(fresh, st, !!local);
}
/* after every desktop render: rolls, the pickup on a local commit, moments, the visit */
function gameAfterRender() {
  const st = G.st || (G.st = gameState());
  fxRoot();
  const local = G.seq !== G.seqSeen, quiet = local && gQuietCommit(), typed = !!G.quietNext, fixNext = !!G.fixNext;
  G.seqSeen = G.seq; G.quietNext = false; G.fixNext = false;
  /* an undo or a correction takes its reward back at once: no stamp, coins, pickup or damage stays on screen for what it undid */
  if (local && gIsFix(quiet)) { document.querySelectorAll('#fxRoot .fx-stamp, #fxRoot .fx-pick, #fxRoot .fx-fly, #fxRoot .fx-dmg').forEach(e => e.remove()); G.popQ = G.popQ.filter(p => p.kind !== 'work'); if (G.big && !G.big.classList.contains('fx-wb-wrap')) gBigEnd(G.big, true); }
  const rose = local && !quiet && G.prevNet != null ? st.net - G.prevNet : 0;
  G.prevNet = st.net;
  gWatchChart();
  gWatchModal();
  /* part 3: what a change made here earned, decided before the numbers roll (the counter waits for the coins) */
  const plan = local && !quiet && !G.silent ? gJuicePlan(st, G.prev) : null;
  G.skipKeys = null;
  G.rollDelay = plan && plan.dest === 'net' && motionOK() ? 320 : 0;
  /* the first desktop render of a page load: the counters start from the last visit, not from $0 */
  if (!G.welcomeChecked && S.accounts.length) {
    G.welcomeChecked = true;
    const lv = G.lastVisit;
    if (lv && isFinite(+lv.net) && !viewAfter()) { if (!G.shown.has('rail')) G.shown.set('rail', { v: +lv.net, text: money(+lv.net, { cents: false }) }); if (!G.shown.has('hero')) G.heroFrom = +lv.net; }
    if (lv && isFinite(+lv.net) && G.boardAt == null) G.boardAt = +lv.net;
    gLater(() => { if (isDesk() && G.st) gWelcome(G.st); }, 120);
  }
  gameBindRolls(document);
  G.rollDelay = 0;
  if (rose >= 1) { if (plan && plan.dest === 'net' && motionOK()) gLater(() => { if (isDesk()) gPickup(rose); }, 300); else gPickup(rose); }   /* with the coins: as they land */
  if (plan) gJuiceRun(plan, st);
  gHpAfter(document, !!plan);
  /* the walk: after a change here that raised the net, or on landing on the Overview after it rose elsewhere (another page,
     another device, since the last visit): the hero's board replays the walk once, from what it last showed */
  let walkEnd = 0;
  if (plan && plan.dNet >= 1 && G.prev) walkEnd = gBoardWalk(G.prev.net, st);
  else if (!local && view === 'overview' && G.boardAt != null && st.net - G.boardAt >= 1) walkEnd = gBoardWalk(G.boardAt, st, { rail: false });
  if ($('#main .gm-track')) G.boardAt = st.net;
  /* a banner waits for the coins, the counter and the walk: the moment lands after the number it celebrates */
  G.bigHold = plan && plan.dNet >= 1 && motionOK() ? performance.now() + Math.max(1400, walkEnd + 150) : 0;
  gFontsWatch();
  if (plan && plan.cleared.length && motionOK()) plan.cleared.forEach(id => document.querySelectorAll(`.gm-boss[data-boss="${gSelEsc(id)}"]`).forEach(el => el.classList.add('gm-flip')));
  gRecapCheck(st, G.silent);
  /* a change made here is judged at once; one that arrived (sync, another tab) waits a moment,
     so another tab's own record of what it already celebrated has landed first */
  clearTimeout(G.momentTimer); G.timers.delete(G.momentTimer);
  if (local) gMoments(st, quiet, true);
  else if (typed || fixNext) gMoments(st, true, true, true);   /* typed in, or a change of ours thrown away by a sync conflict: what it earned is given back */
  else G.momentTimer = gLater(() => { if (isDesk() && G.st) gMoments(G.st); }, 350);
  gRemember(st);
  gCursor(false);
  gFlashApply();
}
function gNoteAction(el) {
  const dlg = !!el.closest('#modalRoot'), insp = el.closest('#dkInsp');
  let row = el.closest('.dk-row[data-sel], .dk-pin[data-sel]');
  if (!row && insp) row = $('#main .dk-row.sel');
  const job = el.closest('.gm-job');
  G.act = { name: el.dataset.action, id: el.dataset.id || null, rect: dlg ? null : el.getBoundingClientRect(), rowRect: row ? row.getBoundingClientRect() : null, sel: row ? row.dataset.sel : null, seq: G.seq, dlg,
    key: !!G.viaKey, job: job ? Array.from(job.classList).find(c => /^gm-job-(?!go|3$)/.test(c)) || null : null,
    panel: row && row.closest('.panel') ? Array.from(document.querySelectorAll('#main .panel')).indexOf(row.closest('.panel')) : -1 };
}
/* the board walks: on a change here that raised the net, the hat hops from where it stood to where the true net now puts it.
   A level crossed walks the rest of the old board, lands on GO (a flash and a burst of coins), clears the board and walks on
   into the new level. The rail's XP bar walks with it (tycoon's in hops, a space at a time), and the level badge, the hero's
   level chip and the caption keep the old level until the bar passes GO, so they never run ahead of the counter.
   The numbers are already the true ones; only the walk is shown. Returns when the walk ends (ms from now). */
function gBoardWalk(was, st, o) {
  o = o || {};
  if (!motionOK() || !(was > 0) || !(st.net > was)) return 0;
  const lw = level(was), lo = (lw - 1) * LEVEL_STEP, up = st.level > lw, sw = Math.min(BOARD_SPACES - 1, Math.floor((was - lo) / SPACE_STEP));
  const track = $('#main .gm-track'), tok = track && track.querySelector('.gm-tok'), sps = track ? Array.from(track.querySelectorAll('.gm-sp')) : [];
  const walks = !!tok && getComputedStyle(tok).display !== 'none' && sps.length === BOARD_SPACES && (up || st.band.spaces > sw);
  const chip = $('#main .dk-hero .lvl'), lv = track && track.querySelector('.gm-lv');
  const railEnd = o.rail === false ? 0 : gXpRoll((was - lo) / LEVEL_STEP * 100, st, up, lw, walks);
  if (!walks) {
    /* no hat to walk (the look draws none): the hero's level chip still waits for the counter */
    if (up && chip && o.rail === false) { const v = chip.textContent; chip.textContent = gLvl(lw); gLater(() => { if (chip.isConnected) chip.textContent = v; }, 1100); }
    return railEnd;
  }
  const to = st.band.spaces, cap = track.querySelector('.gm-cap'), home = tok.parentNode;
  const saved = sps.map(s => [s.className, s.getAttribute('style')]), capWas = cap ? [cap.dataset.n, cap.textContent] : null;
  const bump = () => { tok.classList.remove('gm-hop'); void tok.offsetWidth; tok.classList.add('gm-hop'); };
  const at = (fn, ms) => gLater(() => { if (tok.isConnected && track.isConnected) fn(); }, ms);
  const hopTo = (i, ms, own) => at(() => { if (own != null && sps[own]) sps[own].classList.add('own'); sps[i].appendChild(tok); bump(); gSound('hop'); }, ms);
  let t = 350;
  if (up) {
    /* the old board first: the spaces it owned, the hat where it stood, the old GO */
    sps.forEach((s, i) => { s.classList.toggle('own', i < sw); s.classList.toggle('cur', i === sw); s.style.removeProperty('--sp'); });
    sps[sw].appendChild(tok);
    if (cap) { cap.dataset.n = lw + 1; cap.textContent = gLvl(lw + 1); }
    if (lv) lv.dataset.n = lw;
    const holdChip = chip ? chip.textContent : null; if (chip) chip.textContent = gLvl(lw);
    const medal = $('#main .gm-rank-medal b'), holdMedal = medal && +medal.textContent === st.bestLevel && st.bestLevel > lw ? medal.textContent : null; if (holdMedal) medal.textContent = lw;
    /* the rest of the old board, paced so the hat lands on GO as the counter passes the level */
    const n = BOARD_SPACES - 1 - sw, step = Math.max(110, Math.min(170, 650 / (n + 1)));
    for (let i = sw + 1; i < BOARD_SPACES; i++) { hopTo(i, t, i - 1); t += step; }
    at(() => {
      sps[BOARD_SPACES - 1].classList.add('own');
      if (cap) { cap.appendChild(tok); bump(); cap.classList.add('gm-go-flash'); gGoBurst(cap); }
      if (chip && holdChip != null) chip.textContent = holdChip;
      if (holdMedal) medal.textContent = holdMedal;
      if (lv) lv.dataset.n = st.level;
      gSound('hop');
    }, t);
    t += 520;
    /* the board clears, GO names the next level, and the walk goes on from the start */
    at(() => {
      if (cap) { cap.classList.remove('gm-go-flash'); if (capWas) { cap.dataset.n = capWas[0]; cap.textContent = capWas[1]; } }
      sps.forEach((s, i) => gLater(() => { if (s.isConnected) s.classList.remove('own', 'cur'); }, i * 22));
      sps[0].appendChild(tok); bump();
    }, t);
    t += 260;
    for (let i = 1; i <= to; i++) { hopTo(i, t, i - 1); t += 110; }
  } else {
    for (let i = sw + 1; i <= to; i++) { hopTo(i, t, null); t += 110; }
  }
  /* the board as rendered: the true spaces owned, the hat on its space */
  at(() => { sps.forEach((s, i) => { s.className = saved[i][0]; if (saved[i][1] == null) s.removeAttribute('style'); else s.setAttribute('style', saved[i][1]); }); if (tok.parentNode !== home) home.appendChild(tok); }, t + 60);
  return Math.max(railEnd, t + 60);
}
/* a burst of the look's coins off the GO corner */
function gGoBurst(el) {
  if (!motionOK() || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, root = fxRoot();
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('i'), a = (i / 8) * Math.PI * 2 - Math.PI / 2, d = 38 + (i % 3) * 10;
    c.className = 'fx-coin fx-fly fx-burst';
    root.appendChild(c);
    let an = null;
    try { an = c.animate([{ opacity: 0, transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(.4)` }, { opacity: 1, offset: 0.25 }, { opacity: 0, transform: `translate(${(cx + Math.cos(a) * d).toFixed(1)}px, ${(cy + Math.sin(a) * d).toFixed(1)}px) translate(-50%, -50%) scale(.9)` }], { duration: 520, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'both' }); } catch (e) { c.remove(); continue; }
    an.onfinish = () => c.remove();
    gLater(() => c.remove(), 700);
  }
}
/* the rail's XP bar: it walks from the old value (tycoon: hop by hop, a space every 10%); a level crossed fills to the top,
   flashes, then rolls over. The badge, caption, emblem bubble (and the hero's chip, when no hat walks) keep the old level until then. */
function gXpRoll(pctWas, st, up, lw, heroWalks) {
  const bar = $('#dkTicker .gm-xpbar'), fill = bar && bar.querySelector('i'), cap = $('#dkTicker .gm-xpcap'), badge = $('#dkTicker .gm-badge');
  const holds = [];
  const hold = (el, v, k) => { if (!el) return; if (k) { holds.push([el, el.dataset[k], k]); el.dataset[k] = v; } else { holds.push([el, el.textContent]); el.textContent = v; } };
  const release = () => holds.splice(0).forEach(([el, v, k]) => { if (!el.isConnected) return; if (k) el.dataset[k] = v; else el.textContent = v; });
  if (up) {
    const bm = $('.brand-mark'), tl = $('#main .gm-track .gm-lv'), tc = $('#main .gm-track .gm-cap');
    if (bm && bm.dataset.lvl) hold(bm, lw, 'lvl');
    if (!heroWalks) { hold($('#main .dk-hero .lvl'), gLvl(lw)); if (tl) hold(tl, lw, 'n'); if (tc) { hold(tc, lw + 1, 'n'); hold(tc, gLvl(lw + 1)); } const md = $('#main .gm-rank-medal b'); if (md && +md.textContent === st.bestLevel && st.bestLevel > lw) hold(md, String(lw)); }
  }
  if (!fill || !bar.getClientRects().length) { if (holds.length) gLater(release, 1100); return holds.length ? 1100 : 0; }
  const now = parseFloat(fill.style.width) || 0, hops = gTheme() === 'tycoon';
  const go = (w, ms, snap) => { fill.style.transition = ms ? `width ${ms}ms ${snap ? 'cubic-bezier(.3, 1.3, .5, 1)' : 'cubic-bezier(.3, .7, .3, 1)'}` : 'none'; fill.style.width = w.toFixed(2) + '%'; };
  const walk = (from, to, t0) => {
    if (!hops) { gLater(() => go(to, 420), t0); return t0 + 440; }
    const pts = []; for (let b = (Math.floor(from / 10 + 1e-9) + 1) * 10; b < to - 0.01; b += 10) pts.push(b); pts.push(to);
    pts.forEach((w, k) => gLater(() => { go(w, 100, true); bar.classList.remove('gm-xp-hop'); void bar.offsetWidth; bar.classList.add('gm-xp-hop'); }, t0 + k * 110));
    return t0 + pts.length * 110;
  };
  go(pctWas, 0); void fill.offsetWidth;
  if (!up) { const end = walk(pctWas, now, 320); gLater(() => { fill.style.transition = ''; bar.classList.remove('gm-xp-hop'); }, end + 200); return end; }
  hold(badge, String(lw));
  if (cap) { cap.style.transition = 'none'; cap.classList.add('gm-xp-hold'); }
  let t = walk(pctWas, 100, 320);
  t = Math.max(t, 760);
  gLater(() => bar.classList.add('gm-xp-flash'), t);
  t += 300;
  gLater(() => { release(); if (badge) badge.classList.add('gm-xp-pop'); go(0, 0); void fill.offsetWidth; if (cap) { cap.style.transition = ''; cap.classList.remove('gm-xp-hold'); } }, t);
  const end = walk(0, now, t + 20);
  gLater(() => { bar.classList.remove('gm-xp-flash', 'gm-xp-hop'); if (badge) badge.classList.remove('gm-xp-pop'); fill.style.transition = ''; }, end + 300);
  return end;
}
/* web fonts can land after the first measure: the cursor and the chart's tags are measured again when they do,
   and whenever the page's box changes size */
let gMainRO = null;
function gFontsWatch() {
  const redo = () => { if (!isDesk()) return; gCursor(false); const w = $('#chart'); if (w) gChartFit(w); };
  if (!gFontsWatch.on && document.fonts) {
    gFontsWatch.on = true;
    try { document.fonts.ready.then(redo); document.fonts.addEventListener('loadingdone', redo); } catch (e) {}
  }
  if (!gMainRO && typeof ResizeObserver !== 'undefined') {
    let raf = 0;
    gMainRO = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (isDesk()) gCursor(false); }); });
    gMainRO.observe($('#main'));
  }
}
/* leaving the desktop layout: nothing keeps running */
function gameStop() {
  G.rolls.forEach(r => gRollEnd(r, true));
  G.timers.forEach(t => clearTimeout(t)); G.timers.clear();
  G.rolls.clear(); G.shown.clear(); G.bigQ = []; G.popQ = []; G.big = null; G.pops.clear(); G.recapWait = null;
  if ($('#modalRoot .gm-dlg') || $('#modalRoot .gm-skip')) closeModal();   /* the game's own dialogs, and a check-in round's step, are desktop only */
  G.prevNet = null; G.seqSeen = G.seq; G.bigHold = 0; G.boardAt = null;
  G.prev = null; G.hpShown.clear(); G.skipKeys = null; G.flash = null; G.navView = null; G.rollDelay = 0; G.heroFrom = null;
  if (gCur) gCur.classList.remove('on');
  document.querySelectorAll('.dk-flash').forEach(e => e.classList.remove('dk-flash'));
  const sb = $('.side-foot .gm-snd-btn'); if (sb) sb.remove();
  if (gChartRO) gChartRO.disconnect();
  const r = document.getElementById('fxRoot'); if (r) r.remove();
  if (gCur) { gCur.remove(); gCur = null; }
}
if (DESK) { const off = () => { if (!DESK.matches) gameStop(); }; if (DESK.addEventListener) DESK.addEventListener('change', off); else if (DESK.addListener) DESK.addListener(off); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && G.pending && isDesk() && G.st) gMoments(G.st, G.pendingQuiet); });
/* read-only hooks for the tests */
window.__wsGame = Object.freeze({
  state: () => JSON.parse(JSON.stringify(G.st || gameState())),
  seen: () => gSeen(),
  fx: () => { const r = document.getElementById('fxRoot'); return r ? r.childElementCount : 0; },
  audio: () => SND.ctx || null,
  sounds: () => Object.assign({}, SND.counts),
});

/* ======================================================================
   game, part 2 (desktop only): the habits. Streaks, the weekly Quick Wins, the check-in round, trophies,
   every month scored in stars, and the two tiers of GO! moments. All of it is worked out from the synced
   ledger on every desktop render, so undoing something un-ticks it. Spending never scores; a late bill
   only pauses a streak.
   ====================================================================== */
const GAME_WORDS2 = {
  dark:     { work: 'Put to work', fresh: 'Books fresh', onTarget: 'On target', award: 'Award unlocked', collect: 'Check in', stale: '', checked: '', seasons: 'Months', recap: 'Month in review', recapSoft: 'Month in review', recapBtn: 'Done', recapTotal: 'Change' },
  tycoon:   { work: 'MONEY AT WORK!', fresh: 'Books fresh!', onTarget: 'On target!', award: 'NEW STICKER!', collect: 'Check in all', stale: '', checked: 'Checked in!', seasons: 'Seasons', recap: 'BOARD COMPLETE!', recapSoft: 'SEASON RECAP', recapBtn: 'GO!', recapTotal: 'Total' },
  heist:    { work: 'STASHED', fresh: 'Books fresh', onTarget: 'On target', award: 'AWARD UNLOCKED', collect: 'Update intel', stale: 'INTEL OUT OF DATE', checked: 'INTEL UPDATED', seasons: 'Heists', recap: 'HEIST PASSED', recapSoft: 'HEIST DEBRIEF', recapBtn: 'Continue', recapTotal: 'Take' },
  arcade:   { work: '+XP BANKED', fresh: 'Books fresh!', onTarget: 'On target', award: 'ACHIEVEMENT UNLOCKED', collect: 'Sync all', stale: 'SYNC!', checked: 'SYNCED', seasons: 'Stages', recap: 'STAGE CLEAR', recapSoft: 'STAGE RESULTS', recapBtn: 'Continue', recapTotal: 'Score' },
  comic:    { work: 'STASHED!', fresh: 'Books fresh!', onTarget: 'Right on target!', award: 'NEW BADGE!', collect: 'Check in!', stale: '?!', checked: 'FRESH!', seasons: 'Issues', recap: 'THE END...', recapSoft: 'THE END...', recapBtn: 'Next issue!', recapTotal: 'Total' },
  casino:   { work: 'Banked', fresh: 'Books fresh', onTarget: 'On target', award: 'TROPHY WON', collect: 'Recount the chips', stale: 'Recount', checked: 'Counted', seasons: 'Sessions', recap: 'Session results', recapSoft: 'Session results', recapBtn: 'Back to the table', recapTotal: 'Net result' },
  passbook: { work: 'Deposit posted', fresh: 'Books fresh', onTarget: 'On target', award: 'Merit stamp awarded', collect: 'Post balances', stale: 'unposted', checked: 'posted', seasons: 'Statements', recap: 'Monthly statement', recapSoft: 'Monthly statement', recapBtn: 'File it', recapTotal: 'Net change' },
};
for (const k in GAME_WORDS2) Object.assign(GAME_WORDS[k], GAME_WORDS2[k]);
/* a word that may be deliberately empty for a look (gword falls back to the phone words on empty) */
const gw = k => { const t = GAME_WORDS[S.settings.theme] || GAME_WORDS.dark; return Object.prototype.hasOwnProperty.call(t, k) ? t[k] : gword(k); };
const gTheme = () => S.settings.theme;
const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mLong = m => MONTHS_LONG[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const mShort = m => fmtDate(m + '-01', { month: 'short', year: 'numeric' });
const gIco = (d, cls) => `<svg class="${cls || 'gm-svg'}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
const JOB_ICONS = {
  bills: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2.5v3M13 2.5v3M7.5 12.5l2 2 3.5-4"/>',
  fresh: '<path d="M16 6.5A7 7 0 0 0 4.2 7.5M4 13.5a7 7 0 0 0 11.8-.9"/><path d="M16.2 2.8v4h-4M3.8 17.2v-4h4"/>',
  backup: '<path d="M10 3v9M6 8l4 4 4-4M3 14v3h14v-3"/>',
  pyf: '<rect x="3" y="9" width="14" height="8" rx="2"/><path d="M10 2v5M7.5 4.5 10 7l2.5-2.5M7 13h6"/>',
  goal: '<path d="M5 17V3M5 4h10l-2 3 2 3H5"/>',
  rebal: '<path d="M10 3v14M6 17h8M4 6h12M4 6l-2.2 5h4.4zM16 6l-2.2 5h4.4z"/>',
};
const TRO_ICONS = {
  ontime: '<circle cx="10" cy="10.5" r="7"/><path d="M10 6.5v4l2.6 1.6"/>',
  early: '<path d="M11.2 2 4.5 11h5l-1 7 6.7-9h-5z"/>',
  green: '<path d="M3 15l5-5 3 3 6-6M12.2 7H17v4.8"/>',
  checkin: '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M6.5 10.5 9 13l4.5-5"/>',
  levels: '<path d="M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2L2.5 8l5.2-.7z"/>',
  landmarks: '<path d="M2.5 17h15M4.5 17V8.5L10 4l5.5 4.5V17M8.3 17v-4h3.4v4"/>',
  deposits: '<ellipse cx="10" cy="5" rx="6" ry="2.4"/><path d="M4 5v4c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5M4 9v4c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V9"/>',
  debt: '<path d="M8.2 11.8 5.4 14.6a2.5 2.5 0 0 1-3.5-3.5l2.8-2.8M11.8 8.2l2.8-2.8a2.5 2.5 0 0 1 3.5 3.5l-2.8 2.8M7.3 7.3 5.6 5.6M12.7 12.7l1.7 1.7"/>',
  safety: '<path d="M10 2.5 16 5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5z"/><path d="M7.4 10l2 2 3.4-4"/>',
};

/* ---------- ledger facts the habits read ---------- */
const SAVE_TYPES = new Set(['savings', 'brokerage', 'retirement', 'crypto']);
const gSaveAcct = a => !!a && (SAVE_TYPES.has(a.type) || !isAsset(a));
const CHECKIN_KINDS = new Set(['update', 'transfer', 'payment', 'goal', 'income', 'expense', 'add']);
const txDate = t => { const d = new Date(t && t.date); return isNaN(d) ? null : d; };
/* how fresh a balance is, by local date: fresh within 7 days, ageing to 30, stale after */
function gFreshOf(a) {
  const d = a && a.updatedAt ? new Date(a.updatedAt) : null;
  if (!d || isNaN(d)) return { days: null, state: 'stale' };
  const n = Math.max(0, -daysUntil(localISO(d)));
  return { days: n, state: n <= 7 ? 'fresh' : n <= 30 ? 'ageing' : 'stale' };
}
/* how one payment landed: early (+) or late (-) in whole days against occDue(). An occurrence due before the bill's
   start date belongs to an older schedule (its day was edited since, which moves the start): it is never re-judged
   against the new day, so editing a date can neither break a streak nor hand out an early award. */
function gJudge(b, k, p) {
  if (!p || !p.date) return null;
  const due = occDue(b, k), pd = parseISO(p.date);
  if (isNaN(due) || isNaN(pd)) return null;
  const old = !!b.start && due < parseISO(b.start), early = old ? 0 : dayDiff(due, pd);
  return { due, pd, early, onTime: early >= 0, old };
}
/* every bill payment marked with a date, judged by gJudge */
function gPayEvents() {
  const ev = [];
  for (const b of S.bills) for (const k of Object.keys(b.paid || {})) {
    const p = b.paid[k], j = gJudge(b, k, p);
    if (!j) continue;
    ev.push({ id: b.id, name: b.name, key: k, due: localISO(j.due), date: localISO(j.pd), early: j.early, onTime: j.onTime, old: j.old, amount: r2(+p.amount || 0) });
  }
  return ev.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
/* money put to work, per month, counted as real movement only and netted: into savings or investments from outside
   them (money moved for a goal counts as goals), anything that pays a debt down (a transfer from any asset, a bill paid
   into it), and savings balances changing. Money going back out subtracts: a transfer out of savings, borrowing on a
   card or loan, an undone payment. An earmark that moves nothing counts nothing. The total never goes below zero. */
function gPlacedByMonth() {
  const out = new Map(), add = (m, k, v) => { let r = out.get(m); if (!r) out.set(m, r = { goals: 0, savings: 0, debt: 0, total: 0 }); r[k] = r2(r[k] + v); };
  const save = a => !!a && isAsset(a) && SAVE_TYPES.has(a.type), debt = a => !!a && !isAsset(a);
  const inB = id => S.buckets.some(b => b.accountIds.includes(id)), pairIn = new Map();
  for (const t of S.txns.slice().reverse()) {   /* oldest first */
    const d = txDate(t), amt = +t.amount || 0;
    if (!d || !amt) continue;
    const m = ym(d);
    if (t.kind === 'transfer') {
      const f = acct(t.from), to = acct(t.to);
      if (!f || !to || !(amt > 0)) continue;
      if (debt(to) && !debt(f)) add(m, 'debt', amt);
      else if (debt(f) && !debt(to)) add(m, 'debt', -amt);
      else if (save(to) && !save(f) && !debt(f)) {
        add(m, /^for /.test(t.note || '') ? 'goals' : 'savings', amt);
        if (inB(f.id) && inB(to.id)) { const k = m + '|' + f.id + '>' + to.id; pairIn.set(k, (pairIn.get(k) || 0) + amt); }
      }
      else if (save(f) && !save(to) && !debt(to)) {
        /* out of savings into another bucket's account: a rebalance between buckets, not money spent. It only takes back
           what the same month moved the other way between the same two accounts, so a round trip never counts as saving */
        if (inB(f.id) && inB(to.id)) { const k = m + '|' + to.id + '>' + f.id, back = Math.min(amt, pairIn.get(k) || 0); if (back) { pairIn.set(k, pairIn.get(k) - back); add(m, 'savings', -back); } }
        else add(m, 'savings', -amt);
      }
    }
    /* a bill paid into a debt counts when real money paid it: paying a loan with a card only moves the debt */
    else if (t.kind === 'payment') { if (debt(acct(t.to)) && !debt(acct(t.from)) && amt > 0) add(m, 'debt', amt); }
    else if (t.kind === 'reverse') { if (debt(acct(t.from)) && !debt(acct(t.to)) && amt > 0) add(m, 'debt', -amt); }
    else if (t.kind === 'update') { const a = acct(t.from); if (a && a.type === 'savings') add(m, 'savings', amt); }
  }
  for (const r of out.values()) r.total = r2(Math.max(0, r.goals + r.savings + r.debt));
  return out;
}
/* a goal's opening amount, typed in when it was added, is not a deposit. It is the goal entry written the moment the goal
   was made, and a goal's id starts with the time it was made (uid()), so nothing extra is kept in the ledger for it. */
const gIdTime = id => { const s = String(id || ''); if (s.length < 10) return NaN; const n = parseInt(s.slice(0, -5), 36); return n > 1.2e12 && n < 4.2e12 ? n : NaN; };
function gOpening(t) {
  const ms = Date.parse(t.date);
  if (!isFinite(ms)) return false;
  for (const g of S.goals) { const at = gIdTime(g.id); if (isFinite(at) && Math.abs(ms - at) < 5000) return true; }
  return false;
}
const gDeposit = t => t.kind === 'goal' && !gOpening(t);
/* Monday-start weeks with a real entry: a change of kind update, transfer, payment, goal, income, expense or add, or a tick that moved the net */
let gCWmemo = null;
function gCheckWeeks() {
  const tk = S.ticks || [], key = S.txns.length + ':' + (S.txns[0] || {}).id + ':' + tk.length + ':' + (tk.length ? tk[tk.length - 1].t : '') + ':' + todayStr();
  if (gCWmemo && gCWmemo.key === key && gCWmemo.txns === S.txns) return gCWmemo.set;   /* only txns and ticks decide it: a sort or a chart range reuses it */
  const set = new Set();
  for (const t of S.txns) if (CHECKIN_KINDS.has(t.kind)) { const d = txDate(t); if (d) set.add(localISO(weekStart(d))); }
  let prev;
  for (const t of S.ticks || []) {
    const d = new Date(t.t);
    if (!isNaN(d) && isFinite(t.net) && (prev === undefined || Math.abs(t.net - prev) >= 0.005)) set.add(localISO(weekStart(d)));
    if (isFinite(t.net)) prev = t.net;
  }
  gCWmemo = { key, txns: S.txns, set };
  return set;
}

/* ---------- the habits, added to gameState() ---------- */
function gHabits(st) {
  const today = parseISO(st.date), ws = weekStart(today), we = addDays(ws, 6), wk = localISO(ws), mNow = st.date.slice(0, 7);
  /* on time: every dated payment by due date; the run from the newest back to the first late one. A bill still unpaid past
     its day ends the run on that day, as a late payment would: paying it late later changes nothing, and the next on-time bill starts a new run */
  const pays = gPayEvents();
  const over = [];
  for (const b of S.bills) { const s = billStatus(b); if (s.state === 'overdue') over.push({ id: b.id, name: b.name, days: -s.days, key: s.key, due: localISO(s.due), amount: b.amount }); }
  over.sort((a, b) => b.days - a.days);
  const evs = pays.map(e => ({ due: e.due, date: e.date, on: e.onTime })).concat(over.map(o => ({ due: o.due, date: '9999', on: false })))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let run = 0, best = 0, endedAt = 0;
  for (const e of evs) { if (e.on) { run++; if (run > best) best = run; } else { if (run) endedAt = run; run = 0; } }
  const risk = billsDue(1).find(x => x.days >= 0);
  const lateOne = pending().filter(u => u.kind !== 'in' && u.date && daysUntil(u.date) < 0).map(u => ({ id: u.id, name: u.name, days: -daysUntil(u.date), one: true }));
  const onTime = {
    cur: run, run, best, endedAt, total: pays.filter(e => e.onTime).length, early: pays.filter(e => e.early >= 1).length, count: pays.length,
    paused: over.length ? `${over[0].name} is ${over[0].days} day${over[0].days === 1 ? '' : 's'} late` : '',
    lost: run === 0 && best > 0,
    atRisk: risk ? { id: risk.bill.id, name: risk.bill.name, days: risk.days, amount: risk.bill.amount } : null,
  };
  /* the months: start from the last close before the month (or its own first close), end at its last close (this month: now) */
  const placed = gPlacedByMonth(), closes = st.closes, ms = [];
  const firstPlaced = Array.from(placed.keys()).sort()[0] || null;
  for (const c of closes) { const m = c.date.slice(0, 7); if (ms[ms.length - 1] !== m) ms.push(m); }
  if (closes.length && (!ms.length || ms[ms.length - 1] < mNow)) ms.push(mNow);
  const months = [];
  for (const m of ms) {
    const cur = m === mNow, inM = closes.filter(c => c.date.slice(0, 7) === m).map(c => ({ date: c.date, net: c.net }));
    let before = null; for (const c of closes) { if (c.date < m + '-01') before = c; else break; }
    if (cur) { if (inM.length && inM[inM.length - 1].date === st.date) inM[inM.length - 1].net = st.net; else inM.push({ date: st.date, net: st.net }); }
    if (!inM.length) continue;
    /* the change is the difference of the whole dollars shown for start and end, so a row always adds up on screen */
    const start = before ? before.net : inM[0].net, end = inM[inM.length - 1].net, change = Math.round(end) - Math.round(start);
    let bestDay = null, prev = before ? before.net : null;
    for (const c of inM) { if (prev != null && c.net - prev > 0.5 && (!bestDay || c.net - prev > bestDay.amt)) bestDay = { date: c.date, amt: r2(c.net - prev) }; prev = c.net; }
    const ev = pays.filter(e => e.due.slice(0, 7) === m), lateOver = over.filter(o => o.due.slice(0, 7) === m).length;
    const onN = ev.filter(e => e.onTime).length, late = ev.length - onN + lateOver;
    const p = placed.get(m) || { goals: 0, savings: 0, debt: 0, total: 0 };
    /* a star that cannot apply is not scored (null): no bill was due, or nothing had ever been put to work yet */
    const stars = [change > 0, ev.length + lateOver > 0 ? late === 0 : null, p.total > 0 ? true : cur || (firstPlaced && m >= firstPlaced) ? false : null];
    months.push({ m, cur, skip: !cur && !before && inM.length < 2, start: r2(start), end: r2(end), change, green: change > 0, stars, n: stars.filter(x => x === true).length, of: stars.filter(x => x != null).length,
      onTime: onN, due: ev.length + lateOver, late, placed: p, bestDay, lvlStart: level(start), lvlEnd: level(end), closes: inM.length });
  }
  const done = months.filter(r => !r.cur && !r.skip);
  let gc = 0; for (let i = done.length - 1; i >= 0 && done[i].green; i--) gc++;
  let gb = 0, gr = 0; for (const r of done) { gr = r.green ? gr + 1 : 0; if (gr > gb) gb = gr; }
  const curRow = months.find(r => r.cur);
  const green = { cur: gc, best: gb, thisMonth: curRow ? curRow.change : 0, month: mNow };
  /* check-in weeks: this week counts once it has an entry; until then the run is counted from last week */
  const wset = gCheckWeeks();
  let w = wset.has(wk) ? ws : addDays(ws, -7), cc = 0;
  while (wset.has(localISO(w))) { cc++; w = addDays(w, -7); }
  let cb = 0, cr = 0, pw = null;
  for (const k of Array.from(wset).sort()) { cr = pw && localISO(addDays(parseISO(pw), 7)) === k ? cr + 1 : 1; if (cr > cb) cb = cr; pw = k; }
  const checkin = { cur: cc, best: cb, thisWeek: wset.has(wk) };
  st.pays = pays; st.over = over; st.lateOne = lateOne; st.months = months;
  st.streaks = { onTime, green, checkin };
  st.week = { start: wk, end: localISO(we) };
  st.fresh = S.accounts.map(a => Object.assign({ id: a.id, name: a.name }, gFreshOf(a)));
  st.jobs = gJobs(st, { today, ws, we, mNow, placed });
  const mCur = months.find(r => r.cur), MN = MONTHS_LONG[+mNow.slice(5) - 1];
  for (const j of st.jobs) j.reward = j.done ? '' : {
    bills: over.length ? 'clears the late bill; the next on-time one starts a new streak' : `keeps your on-time streak going (${onTime.run})`,
    fresh: checkin.thisWeek ? 'every balance true to the week' : `earns this week's check-in (${checkin.cur + 1} in a row)`,
    backup: 'keeps every streak and record safe',
    pyf: mCur && mCur.stars[2] ? `${MN}'s saved star is in; this fills the month` : `earns ${MN}'s saved star`,
    goal: 'keeps the goal on pace for its date',
    rebal: 'puts every bucket on target',
  }[j.id] || '';
  const J = st.jobs;
  st.weekClear = J.length >= 2 && J.every(j => j.done);
  st.freshWeek = S.accounts.length > 0 && st.fresh.every(f => f.state === 'fresh') && S.txns.some(t => t.kind === 'update' && txDate(t) >= ws);
  st.planWeek = !!st.planOk;
  st.trophies = gTrophies(st);
}

/* ---------- Quick Wins: this week's money chores, worked out fresh on every render ---------- */
function gJobs(st, c) {
  const { today, ws, we, mNow, placed } = c, jobs = [], heist = gTheme() === 'heist';
  const T = (plain, h) => (heist ? h : plain);
  /* 1. bills due this week (or overdue), paid on or before their day */
  const occ = [];
  for (const b of S.bills) {
    let o = occAt(b, ws);
    for (let i = 0; i < 16 && o.due <= we; i++) {
      if (o.due >= ws) { const p = b.paid && b.paid[o.key], j = p && gJudge(b, o.key, p); occ.push({ b, key: o.key, due: o.due, paid: !!p, onTime: !!(j && j.onTime) }); }
      o = occAfter(b, o);
    }
  }
  if (occ.length || st.over.length) {
    const on = occ.filter(o => o.onTime).length, paidN = occ.filter(o => o.paid).length;
    const next = billsDue(Math.max(0, dayDiff(we, today))).find(x => x.key === billStatus(x.bill).key);
    const s = st.streaks.onTime;
    const why = s.paused ? `${s.paused} ${DOT} the next on-time bill starts a new streak` : s.lost ? 'New streak starts with the next one' : `keeps your streak${s.cur ? ' of ' + s.cur : ''}`;
    jobs.push({ id: 'bills', title: T('Bills', 'Clear the bills'), done: !next && paidN === occ.length && !st.over.length,
      pct: occ.length ? on / occ.length * 100 : 0, count: occ.length ? `${on} of ${occ.length}` : `${st.over.length} late`, unit: occ.length ? 'on time' : '',
      amt: next ? gMoney(next.bill.amount) : '', sub: next ? `Next: ${next.bill.name} ${gMoney(next.bill.amount)} ${next.days < 0 ? (-next.days) + 'd late' : relShort(next.days)} ${DOT} ${why}` : `Every bill this week is paid ${DOT} ${why}`,
      btn: next ? { label: 'Pay', attrs: `data-action="pay-bill" data-id="${esc(next.bill.id)}"` } : null });
  }
  /* 2. fresh books: every balance checked within 7 days */
  if (S.accounts.length) {
    const fr = st.fresh.filter(f => f.state === 'fresh').length, n = st.fresh.length;
    const old = st.fresh.slice().sort((a, b) => (b.days == null ? 1e9 : b.days) - (a.days == null ? 1e9 : a.days))[0];
    jobs.push({ id: 'fresh', title: T('Fresh books', 'Update the intel'), done: fr === n, pct: fr / n * 100, count: `${fr} of ${n}`, unit: 'fresh',
      sub: fr === n ? 'Every balance checked in the last 7 days' : `${old.name} ${old.days == null ? 'was never updated' : 'last updated ' + old.days + 'd ago'}`,
      btn: fr === n ? null : { label: gw('collect'), attrs: 'data-action="checkin-run"', key: 'U' } });
  }
  /* 3. backup: when there is none, or the last is over 30 days old; one taken this week shows done */
  const lb = S.settings.lastBackup, lbd = lb ? new Date(lb) : null, ok = lbd && !isNaN(lbd), age = ok ? Math.max(0, -daysUntil(localISO(lbd))) : null, thisWk = ok && lbd >= ws;
  if (!ok || age > 30 || thisWk) {
    jobs.push({ id: 'backup', title: T('Backup', 'Secure a backup'), nobar: true, done: !!thisWk, pct: thisWk ? 100 : 0, count: !ok ? 'never backed up' : thisWk ? 'backed up ' + fmtDate(lbd, MD) : 'last one ' + age + 'd ago', unit: '',
      sub: 'One JSON file with everything, kept somewhere safe', btn: thisWk ? null : { label: 'Backup', attrs: 'data-action="export"' } });
  }
  /* 4. pay yourself first: what is left of take-home pay after bills, placed this month */
  const income = +S.settings.income || 0, bm = billsMonthly(), target = income - bm, saveAccts = S.accounts.filter(a => SAVE_TYPES.has(a.type));
  if (income > bm && saveAccts.length) {
    const got = (placed.get(mNow) || { total: 0 }).total;
    const src = S.accounts.filter(a => a.type === 'checking' || a.type === 'cash').sort((a, b) => b.balance - a.balance)[0];
    const P = planRows();
    let dst = null;
    for (const r of P.rows.filter(r => r.diff < -1).sort((a, b) => a.diff - b.diff)) { dst = r.accts.find(a => !src || a.id !== src.id); if (dst) break; }
    /* never into a bucket that is already over its target: the Rebalance job would only move it back */
    const overB = new Set(P.rows.filter(r => r.diff > 1).flatMap(r => r.accts.map(a => a.id))), okTo = a => (!src || a.id !== src.id) && !overB.has(a.id);
    if (!dst) dst = S.accounts.find(a => a.type === 'savings' && okTo(a)) || saveAccts.find(okTo) || null;
    jobs.push({ id: 'pyf', got, target, title: T('Pay yourself first', 'Stash the take'), done: got >= target - 0.5, pct: Math.min(100, got / target * 100), count: `${gMoney(got)} of ${gMoney(target)}`, unit: 'this month',
      sub: `Take-home ${gMoney(income)} less ${gMoney(bm)} of bills, into savings, investments, goals or debt`,
      btn: got >= target - 0.5 ? null : { label: 'Transfer', attrs: `data-action="transfer"${src ? ` data-from="${esc(src.id)}"` : ''}${dst ? ` data-to="${esc(dst.id)}"` : ''}` } });
  }
  /* 5. goal pace: the nearest dated goal, this month's deposits against the monthly pace it needs */
  const gl = S.goals.filter(g => g.kind !== 'net' && g.due && g.target > 0 && g.saved < g.target && daysUntil(g.due) >= 0).sort((a, b) => a.due.localeCompare(b.due))[0];
  if (gl) {
    const got = sum(S.txns.filter(t => gDeposit(t) && t.desc && t.desc.endsWith(' toward ' + gl.name) && txDate(t) && ym(txDate(t)) === mNow), t => +t.amount || 0);
    const need = Math.max(0, (gl.target - (gl.saved - got)) / Math.max(1, daysUntil(gl.due) / 30.44));
    jobs.push({ id: 'goal', title: T('Goal pace', 'Fund the score'), done: got >= need - 0.5, pct: need ? Math.min(100, got / need * 100) : 100, count: `${gMoney(got)} of ${gMoney(need)}`, unit: `toward ${gl.name} this month`,
      sub: `${gMoney(gl.target - gl.saved)} to go by ${fmtDate(gl.due, MD)}`, btn: got >= need - 0.5 ? null : { label: 'Add funds', attrs: `data-action="fund-goal" data-id="${esc(gl.id)}"` } });
  }
  /* 6. rebalance: the biggest move the plan suggests, when it is $50 or more */
  const P = planRows(), ok100 = S.buckets.length > 0 && Math.round(P.pctTotal) === 100, moves = ok100 ? suggestMoves(P.rows) : [];
  const big = moves.slice().sort((a, b) => b.amt - a.amt)[0];
  const inB = id => S.buckets.some(b => b.accountIds.includes(id));
  const touched = S.txns.some(t => t.kind === 'transfer' && txDate(t) >= ws && (inB(t.from) || inB(t.to)));
  st.planOk = ok100 && !(big && big.amt >= 50) && touched;
  if (ok100 && big && big.amt >= 50) {
    const from = big.from.accts.slice().sort((a, b) => b.balance - a.balance)[0], to = big.to.accts[0];
    jobs.push({ id: 'rebal', title: T('Rebalance', 'Move the money'), nobar: true, done: false, pct: 0, count: `move ${gMoney(big.amt)} to ${big.to.b.name}`, unit: '',
      sub: `${big.from.b.name} is ${gMoney(big.from.diff)} over`, btn: { label: 'Transfer', attrs: `data-action="transfer"${from ? ` data-from="${esc(from.id)}"` : ''}${to ? ` data-to="${esc(to.id)}"` : ''} data-amount="${Math.round(big.amt)}"` } });
  } else if (st.planOk) {
    jobs.push({ id: 'rebal', title: T('Rebalance', 'Move the money'), done: true, pct: 100, count: 'every bucket within $50', unit: '', sub: 'On target after this week\'s transfers', btn: null });
  }
  return jobs.slice(0, 6);
}

/* ---------- trophies: tiered awards, recomputed from the ledger every time ---------- */
const TRO_FAMS = [
  { id: 'ontime', name: 'On time', tiers: [5, 25, 100, 250] },
  { id: 'early', name: 'Paid early', tiers: [3, 10, 25, 50] },
  { id: 'green', name: 'Green months', tiers: [3, 6, 12, 24] },
  { id: 'checkin', name: 'Check-ins', tiers: [4, 12, 26, 52] },
  { id: 'levels', name: 'Levels', tiers: [5, 10, 20, 40] },
  { id: 'landmarks', name: 'Landmarks', tiers: [1, 3, 5, 10] },
  { id: 'deposits', name: 'Goal deposits', tiers: [5, 20, 50, 100] },
  { id: 'debt', name: 'Debt slayer', tiers: [10, 25, 50, 100] },
  { id: 'safety', name: 'Safety net', tiers: [1, 3, 6, 12] },
];
function gTrophies(st) {
  const s = st.streaks, T = totals(), bm = billsMonthly(), cash = sum(S.accounts.filter(a => typeOf(a).group === 'cash'), a => a.balance);
  const DT = st.debtTot, peak = DT.peak;
  const funded = S.goals.filter(g => g.target > 0 && (g.kind === 'net' ? st.net >= g.target : g.saved >= g.target)).length;
  const deps = S.txns.filter(gDeposit).length;
  const debtPct = peak > 0.005 ? Math.max(0, DT.paid / peak * 100) : 0, months = bm > 0 ? cash / bm : 0;
  const NB = ' ', lv = n => gLvl(n).replace(' ', NB);   /* a level and its number, or 'at' and a number, never split over two lines */
  const V = { ontime: s.onTime.total, early: s.onTime.early, green: s.green.best, checkin: s.checkin.best, levels: st.bestLevel, landmarks: funded, deposits: deps, debt: debtPct, safety: months };
  const fams = [];
  for (const f of TRO_FAMS) {
    if (f.id === 'debt' && !(peak > 0.005)) continue;
    if (f.id === 'safety' && !(bm > 0)) continue;
    const v = V[f.id], tier = f.tiers.filter(x => v >= x - 1e-9).length, next = f.tiers[tier], nm = TIER_NAMES[tier];
    const lastAt = tier ? f.tiers[tier - 1] : 0, pct = next == null ? 100 : Math.max(0, Math.min(100, v / next * 100));
    let prog = '', why = '', how = '';
    switch (f.id) {
      case 'ontime': prog = next ? `${v} of ${next} ${DOT} ${next - v} more for ${nm}` : `${v} paid on time`; why = `${v} bills paid on or before their day`; how = 'Pay bills on or before their day'; break;
      case 'early': prog = next ? `${v} of ${next} ${DOT} ${next - v} more for ${nm}` : `${v} paid early`; why = `${v} bills paid a day or more early`; how = 'Pay a bill at least a day before it is due'; break;
      case 'green': prog = next ? `best run ${v} of ${next} months ${DOT} ${nm} at${NB}${next}` : `best run ${v} months`; why = `${v} green months in a row`; how = 'End months higher than they started, in a row'; break;
      case 'checkin': prog = next ? `best run ${v} of ${next} weeks ${DOT} ${nm} at${NB}${next}` : `best run ${v} weeks`; why = `${v} check-in weeks in a row`; how = 'Update a balance or log money every week'; break;
      case 'levels': prog = (next ? `${lv(v)} ${DOT} ${nm} at${NB}${lv(next)} ${DOT} ${gMoney((next - 1) * LEVEL_STEP)}` : lv(v)) + (() => { const rk = gRankOf(v); return rk.next ? ` ${DOT} title ${rk.title}, next unlock at${NB}${lv(rk.next.at)}: ${rk.next.title}` : ` ${DOT} title ${rk.title}`; })(); why = `reached ${lv(v)}, ${gMoney((v - 1) * LEVEL_STEP)} as is`; how = `Reach ${lv(5)}, ${gMoney(4 * LEVEL_STEP)} of net worth`; break;
      case 'landmarks': prog = next ? `${v} goal${v === 1 ? '' : 's'} funded ${DOT} ${nm} at${NB}${next}` : `${v} goals funded`; why = `${v} goal${v === 1 ? '' : 's'} funded`; how = 'Fund a goal all the way'; break;
      case 'deposits': prog = next ? `${v} of ${next} deposits ${DOT} ${next - v} more for ${nm}` : `${v} deposits`; why = `${v} deposits toward goals`; how = 'Add funds to a goal'; break;
      case 'debt': prog = next ? `${debtPct.toFixed(0)}% of the ${gMoney(peak)} peak paid down ${DOT} ${gMoney(Math.max(1, next / 100 * peak - DT.paid))} more for ${nm}` : 'Debt-free'; why = `debt down ${debtPct.toFixed(0)}% from its ${gMoney(peak)} peak`; how = `Pay debt down 10% from its ${gMoney(peak)} peak`; break;
      case 'safety': prog = next ? `${months.toFixed(1)} of ${next} month${next === 1 ? '' : 's'} ${DOT} ${gMoney(Math.max(1, next * bm - cash))} more cash for ${nm}` : `${months.toFixed(1)} months`; why = `cash covers ${months.toFixed(1)} months of bills`; how = `Keep a month of bills (${gMoney(bm)}) in cash`; break;
    }
    const left = next == null ? 0 : Math.max(1, Math.ceil(next - v - 1e-9)), pl = (n, w) => `${n} more ${w}${n === 1 ? '' : 's'}`;
    const near = next == null ? prog : {
      ontime: pl(left, 'on-time bill'), early: pl(left, 'early payment'), green: `best run ${v} of ${next} green months`, checkin: `best run ${v} of ${next} check-in weeks`,
      levels: `${gMoney(Math.max(1, (next - 1) * LEVEL_STEP - st.net))} to ${gLvl(next, true).replace(' ', NB)}`, landmarks: pl(left, 'goal') + ' funded', deposits: pl(left, 'deposit'),
      debt: `${gMoney(Math.max(1, next / 100 * peak - DT.paid))} more paid down`, safety: `${gMoney(Math.max(1, next * bm - cash))} more cash`,
    }[f.id];
    fams.push({ id: f.id, name: f.name, tiers: f.tiers, v: r2(v), tier, pct, prog, why, how, near });
  }
  const earned = sum(fams, f => f.tier);
  /* personal records */
  let hi = { v: st.net, date: st.date };
  for (const c of st.closes) if (c.date !== st.date && c.net > hi.v) hi = { v: c.net, date: c.date };
  const bestM = st.months.filter(r => !r.cur && !r.skip).sort((a, b) => b.change - a.change)[0];
  return { fams, earned, of: fams.length * 4,
    records: { net: hi, month: bestM && bestM.change > 0 ? { m: bestM.m, change: bestM.change } : null, level: { n: st.bestLevel, date: st.levelDates[st.bestLevel] || null },
      onTime: s.onTime.best, green: s.green.best, checkin: s.checkin.best } };
}

/* ---------- streak chips, in each look's words ---------- */
function gStreakChip(kind, s, o) {
  o = o || {};
  const t = gTheme(), paused = false, ended = kind === 'ontime' && !!s.paused, n = s.cur;
  const W = {
    ontime: { tycoon: ['', '×', 'on time'], heist: ['Clean record', '', ''], arcade: ['Combo', '×', ''], comic: ['', '', 'in a row!'], casino: ['Hot streak', '', ''], passbook: ['', '', 'on time'], dark: ['', '', 'on time'] },
    green: { tycoon: ['', '×', 'green'], heist: ['Green months', '', ''], arcade: ['Green', '×', ''], comic: ['', '', 'green months!'], casino: ['Green run', '', ''], passbook: ['', '', 'green'], dark: ['', '', 'green months'] },
    checkin: { tycoon: ['', '×', 'weeks'], heist: ['On the grid', '', 'wks'], arcade: ['Sync', '×', ''], comic: ['', '', 'weeks checked!'], casino: ['Regular', '', 'wks'], passbook: ['', '', 'weeks'], dark: ['', '', 'wk check-ins'] },
  }[kind];
  const w = W[t] || W.dark;
  const full = { ontime: 'On-time streak', green: 'Green months', checkin: 'Check-in weeks' }[kind];
  const SH = { ontime: { heist: 'Clean', arcade: 'Combo', casino: 'Hot', comic: 'in a row', def: 'on time' }, green: { def: 'green' }, checkin: { heist: 'Grid', arcade: 'Sync', casino: 'Reg', def: 'wks' } }[kind];
  const pre = t === 'heist' || t === 'arcade' || t === 'casino', sh = `<span class="gm-sk-sh">${pre ? '' : ' '}${esc(SH[t] || SH.def)}${pre ? ' ' : ''}</span>`;
  const title = ended ? `${full} ${n}${s.endedAt && !n ? ` ${DOT} ended at ${s.endedAt}` : ''}: ${s.paused} ${DOT} best ${s.best} ${DOT} a new one starts with your next on-time bill` : `${full} ${n}${kind === 'green' ? ' completed months' : ''} ${DOT} best ${s.best}${kind === 'ontime' && s.lost ? ` ${DOT} ${s.endedAt ? `ended at ${s.endedAt} ${DOT} ` : ''}a new one starts with your next on-time bill` : ''}${kind === 'green' && Math.abs(s.thisMonth) >= 1 ? ` ${DOT} ${MONTHS_LONG[+s.month.slice(5) - 1]} so far ${s.thisMonth > 0 ? UP : DOWN} ${gMoney(Math.abs(s.thisMonth))}` : ''}`;
  const ticks = t === 'passbook' ? `<span class="gm-sk-ticks" aria-hidden="true">${'<i></i>'.repeat(Math.min(4, n))}${n > 4 ? '<b>+' + (n - 4) + '</b>' : ''}</span>` : '';
  const best = n === 0 && s.best > 0 && !paused ? `<span class="gm-sk-best">best ${s.best}</span>` : '';
  return `<span class="gm-sk gm-sk-${kind}${n ? '' : ' zero'}${paused ? ' paused' : ''}" title="${esc(title)}"><i class="gm-sk-i" aria-hidden="true"></i>${w[0] ? `<span class="gm-sk-pre">${esc(w[0])}</span>` : ''}${ticks}${pre && !o.mini ? sh : ''}<b class="gm-sk-n num">${o.mini ? '' : w[1]}${n}</b>${!pre && !o.mini ? sh : ''}${w[2] ? `<span class="gm-sk-post">${esc(w[2])}</span>` : ''}${paused && !o.mini ? '<span class="gm-sk-best gm-sk-pause">paused</span>' : best}</span>`;
}
function gStreaksHTML(st) { const s = st.streaks; return `<span class="gm-streaks">${gStreakChip('ontime', s.onTime)}${gStreakChip('green', s.green)}${gStreakChip('checkin', s.checkin)}</span>`; }
/* overdue bills: heist raises one wanted star per bill (at most five); the other looks show a quiet amber chip */
function gLateMark(st) {
  const all = st.over.concat(st.lateOne || []), n = all.length;
  if (!n) return '';
  const t = `${n} overdue: ${all.map(o => `${o.name} ${o.days}d`).join(', ')}. Paying clears it.`;
  if (gTheme() === 'heist') return `<span class="gm-wanted" title="${esc(t)}" aria-label="${esc(t)}">${'<i></i>'.repeat(Math.min(5, n))}</span>`;
  return `<span class="gm-late" title="${esc(t)}">${n} late</span>`;
}
/* the nearest trophy tier still to earn, for the rail's Next tile: the family furthest along toward its next tier */
function gNextTro(st) {
  let best = null;
  for (const f of st.trophies.fams) if (f.tier < 4 && (!best || f.pct > best.pct)) best = f;
  return best;
}
function gNextHTML(st) {
  const f = gNextTro(st);
  if (!f) return '';
  const nm = TIER_NAMES[f.tier];
  return `<button type="button" class="dk-tick gm-next desk-only" data-action="gm-trophies" title="${esc(`${gword('trophies')} (A): next up, ${f.name} ${nm}. ${f.prog}`)}"><span class="gm-tick-top"><span class="label">Next ${esc(gTheme() === 'tycoon' ? 'sticker' : 'award')}</span><span class="gm-next-t">${esc(nm)}</span></span>
    <span class="gm-next-row"><i class="gm-medal t${f.tier + 1}" aria-hidden="true">${gIco(TRO_ICONS[f.id])}</i><span class="gm-next-nm">${esc(f.name)}</span></span>
    <span class="gm-next-bar"><i style="width:${f.pct.toFixed(1)}%"></i></span><span class="gm-next-p">${esc(f.near)}</span></button>`;
}
/* the next money going out, for the all-clear line */
function gNextOut() { const u = upNext(60).filter(x => x.kind !== 'in' && x.days >= 0)[0]; return u ? u.date : null; }

/* ---------- the Overview strip ---------- */
function gGift(open) {
  return `<svg class="gm-gift${open ? ' open' : ''}" viewBox="0 0 28 28" aria-hidden="true"><path class="gm-gift-lid" d="M3 9h22v5H3z"/><path class="gm-gift-box" d="M5 14h18v11H5z"/><path class="gm-gift-rib" d="M12.5 9h3v16h-3z"/><path class="gm-gift-bow" d="M14 9c-3-5-8-4-7-1 1 2 5 1 7 1 2 0 6 1 7-1 1-3-4-4-7 1z"/></svg>`;
}
/* a compact card: icon, title, the real figure and its button on one line under it, progress along the bottom edge */
function gJobCard(j, i) {
  const btn = j.btn ? `<button class="btn btn-sm btn-primary gm-job-go" ${j.btn.attrs}>${esc(j.btn.label)}</button>` : '';
  return `<div class="gm-job gm-job-${j.id}${i >= 2 ? ' gm-job-3' : ''}${i >= 3 ? ' gm-job-4' : ''}${j.done ? ' done' : ''}" title="${esc(j.title + ': ' + j.count + (j.unit ? ' ' + j.unit : '') + (j.sub ? ' · ' + j.sub : ''))}">
      <i class="gm-job-ico">${gIco(JOB_ICONS[j.id])}</i>
      <div class="gm-job-main"><div class="gm-job-t">${esc(j.title)}</div>
        <div class="gm-job-r"><span class="gm-job-c"><b class="num">${esc(j.count)}</b>${j.unit ? `<span class="gm-job-u"> ${esc(j.unit)}</span>` : ''}</span>${btn}</div></div>
      ${j.nobar ? '' : `<span class="gm-job-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, j.pct)).toFixed(1)}%"></i></span>`}</div>`;
}
function gQwHTML(st) {
  const J = st.jobs, dn = J.filter(j => j.done).length, open = J.filter(j => !j.done);
  const nx4 = J.length - Math.min(4, open.length), nw = J.length - Math.min(3, open.length), nn = J.length - Math.min(2, open.length);
  const more = open.length && (nw || nn || nx4) ? `<button class="link gm-qw-more${nw ? '' : ' gm-nw0'}${nn ? '' : ' gm-nn0'}${nx4 ? '' : ' gm-nx0'}" data-action="gm-jobs" title="${esc(gword('jobs'))}: every job this week (Q)"><span class="gm-x">+${nx4} more</span><span class="gm-w">+${nw} more</span><span class="gm-n">+${nn} more</span> ${DOT} Q</button>` : '';
  /* the meter: one segment per job, each filled as far as its job has got (a third of the bills paid is a third of a segment) */
  const segs = J.slice().sort((a, b) => (b.done - a.done) || (b.pct - a.pct));
  const head = `<div class="panel-head gm-qw-head"><span class="label">${esc(gword('jobs'))}<span class="gm-qw-wk"> ${DOT} week of ${fmtDate(st.week.start, MD)}</span></span>
      <span class="gm-qw-meter" title="${dn} of ${J.length} done this week">${segs.map(j => `<i class="${j.done ? 'on' : j.pct >= 1 ? 'part' : ''}"${!j.done && j.pct >= 1 ? ` style="--f:${Math.min(92, Math.max(12, j.pct)).toFixed(0)}%"` : ''}></i>`).join('')}${gGift(st.weekClear)}</span><span class="gm-qw-n num">${dn}/${J.length}</span>
      <span class="grow"></span>${gStreaksHTML(st)}${more}</div>`;
  let body;
  if (!J.length) body = `<div class="gm-qw-line muted">Nothing to do this week. Add accounts, bills or a goal and jobs show up here.</div>`;
  else if (!open.length) {
    /* the board cleared: the week's jobs, stamped, and what comes next */
    const nx = billsDue(60).find(x => x.due > parseISO(st.week.end)), ck = st.streaks.checkin;
    body = `<div class="gm-qw-line gm-qw-clear"><span class="gm-qw-rib">${esc(gword('boardCleared'))}</span><span class="gm-qw-done">${J.map(j => `<span class="gm-qw-dj" title="${esc(j.title + ': ' + j.count + (j.unit ? ' ' + j.unit : ''))}"><i aria-hidden="true"></i>${esc(j.title)}</span>`).join('')}</span><span class="gm-qw-nx">${ck.cur ? `<b class="num">${ck.cur}</b> week${ck.cur === 1 ? '' : 's'} checked in a row` : ''}${nx ? `${ck.cur ? ` ${DOT} ` : ''}next: ${esc(nx.bill.name)} ${fmtDate(nx.due, MD)}` : ''}</span><button class="link gm-qw-more" data-action="gm-jobs">See the board ${kbd('Q')}</button></div>`;
  } else body = `<div class="gm-qw-body">${open.slice(0, 4).map((j, i) => gJobCard(j, i)).join('')}</div>`;
  return `<div class="panel dk-qw rib-orange${!J.length || !open.length ? ' gm-qw-done' : ''}">${head}${body}</div>`;
}
/* the Q dialog: every job, its bar and its button; done ones crossed through and stamped */
function gJobsDlgHTML(st) {
  const J = st.jobs, dn = J.filter(j => j.done).length, s = st.streaks;
  const line = (lbl, x, extra) => `<li><span class="gm-sl-l">${lbl}</span><b class="num">${x.cur}</b><span class="muted small">best ${x.best}${extra || ''}</span></li>`;
  return `<div class="mform gm-dlg gm-jobs-dlg"><h3>${esc(gword('jobs'))}</h3>
    <p class="muted small intro">Week of ${fmtDate(st.week.start, MD)} ${DOT} <b class="num">${dn} of ${J.length}</b> done ${DOT} worked out from your numbers, so undoing something un-ticks it.</p>
    <div class="gm-dlg-streaks">${gStreaksHTML(st)}</div>
    <ul class="gm-sl">${line('On-time bills', s.onTime, s.onTime.paused ? ` ${DOT} ${esc(s.onTime.paused)}` : s.onTime.lost ? ` ${DOT} New streak starts with the next one` : '')}${line('Green months', s.green, Math.abs(s.green.thisMonth) >= 1 ? ` ${DOT} ${MONTHS_LONG[+s.green.month.slice(5) - 1]} so far ${s.green.thisMonth > 0 ? UP : DOWN} ${gMoney(Math.abs(s.green.thisMonth))}` : '')}${line('Check-in weeks', s.checkin, s.checkin.thisWeek ? '' : ` ${DOT} this week not yet`)}</ul>
    ${J.length ? `<ul class="gm-joblist">${J.map(j => `<li class="gm-job gm-job-${j.id}${j.done ? ' done' : ''}"><i class="gm-job-ico">${gIco(JOB_ICONS[j.id])}</i>
      <div class="gm-job-main"><div class="gm-job-t"><span class="gm-job-tt">${esc(j.title)}</span>${j.done ? '<span class="gm-stamp">Done</span>' : ''}</div>
        <div class="gm-job-p"><span class="gm-job-bar"><i style="width:${Math.max(0, Math.min(100, j.pct)).toFixed(1)}%"></i></span><span class="gm-job-c"><b class="num">${esc(j.count)}</b>${j.unit ? ' ' + esc(j.unit) : ''}</span>${j.reward ? `<span class="gm-job-rw" title="${esc(j.reward)}">${esc(j.reward)}</span>` : ''}</div>
        ${j.sub ? `<div class="gm-job-s">${esc(j.sub)}</div>` : ''}</div>
      ${j.btn ? `<button class="btn btn-sm gm-job-go" ${j.btn.attrs}>${esc(j.btn.label)}${j.btn.key ? kbd(j.btn.key) : ''}</button>` : ''}</li>`).join('')}</ul>` : `<p class="empty">Nothing on the board this week.</p>`}
    <div class="mactions"><span class="grow"></span><button type="button" class="btn btn-primary" data-close>Done</button></div></div>`;
}

/* ---------- accounts: how fresh each balance is ---------- */
function gPip(a, f) {
  f = f || gFreshOf(a);
  return `<i class="gm-pip gm-pip-${f.state}" title="${f.days == null ? 'Never updated' : 'Updated ' + (f.days === 0 ? 'today' : f.days + ' day' + (f.days === 1 ? '' : 's') + ' ago')} ${DOT} ${f.state === 'fresh' ? 'fresh' : f.state === 'ageing' ? 'ageing: older than a week' : 'stale: older than 30 days'}"></i>`;
}
function gAgeBadge(a) {
  const f = gFreshOf(a);
  if (f.state === 'fresh') {
    const txt = G.checked.has(a.id) ? gw('checked') : '';
    return txt ? `<span class="gm-age gm-age-done" title="Checked in">${esc(txt)}</span>` : '';
  }
  const t = gTheme(), txt = gw('stale');
  const d = f.days == null ? 'never' : f.days + 'd';
  return `<span class="gm-age gm-age-${f.state}" title="${esc(f.days == null ? 'Never updated' : 'Last updated ' + f.days + ' days ago')}">${t === 'tycoon' ? `<i class="gm-clock"></i>${d}` : txt ? esc(txt) : ''}</span>`;
}

/* ---------- the rail's due tile and the Up next head ---------- */
function gDueTop(st, due) {
  const late = gLateMark(st);
  return late || (st.streaks.onTime.best || st.streaks.onTime.cur ? gStreakChip('ontime', st.streaks.onTime, { mini: true }) : '');
}

/* ---------- bills: how each payment landed ---------- */
function gPayChip(j) {
  if (!j) return '';
  if (j.old) return `<span class="gm-pchip ok" title="Paid under an earlier due date">paid</span>`;
  const early = j.early;
  return `<span class="gm-pchip ${early > 0 ? 'early' : early === 0 ? 'ok' : 'late'}">${early > 0 ? early + 'd early' : early === 0 ? 'on time' : (-early) + 'd late'}</span>`;
}
function gBillRun(billId, st) {
  const ev = st.pays.filter(e => e.id === billId);
  let run = 0; for (let i = ev.length - 1; i >= 0 && ev[i].onTime; i--) run++;
  return { run, count: ev.length, byKey: new Map(ev.map(e => [e.key, e])) };
}

/* ---------- History: every month scored in stars ---------- */
function gStarsHTML(r, big) {
  const w = ['Green', 'No late bills', 'Saved'];
  return `<span class="gm-stars${big ? ' big' : ''}" title="${esc(r.stars.map((on, i) => (on == null ? '– ' + w[i] + ' (not scored)' : (on ? '★ ' : '☆ ') + w[i])).join(' · '))}">${r.stars.map(on => `<i class="${on ? 'on' : on == null ? 'na' : ''}"></i>`).join('')}</span>`;
}
function gSeasonsHTML(rows, sel) {
  if (!rows.length) return '';
  return `<div class="panel dk-tpanel gm-seasons rib-gold"><div class="panel-head"><span class="label">${esc(gw('seasons'))}</span><span class="muted small">three stars a month: green, no late bills, money saved <span class="dk-hint">${kbd('R')} recap</span></span></div>
    <table class="tbl dk-tbl"><thead><tr>${thS('seasons', 'month', 'Month', '', -1)}<th class="r">Start</th><th class="r">End</th>${thS('seasons', 'change', 'Change', 'r', -1)}${thS('seasons', 'stars', 'Stars', 'gm-c-stars', -1)}</tr></thead><tbody>
    ${rows.map(r => `<tr class="dk-row${sel === 'm:' + r.m ? ' sel' : ''}${r.cur ? ' gm-cur' : ''}" data-sel="m:${r.m}"><td class="dk-nowrap"><span class="strong">${mShort(r.m)}</span>${r.cur ? ' <span class="muted small">so far</span>' : ''}</td><td class="r num muted">${gMoney(r.start)}</td><td class="r num">${gMoney(r.end)}</td><td class="r">${signed(r.change, { cents: false })}</td><td class="gm-c-stars">${gStarsHTML(r)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function gSeasonWhy(r) {
  const p = r.placed;
  return [
    r.stars[0] ? `Green: ended ${gMoney(r.change)} above where it started` : r.cur ? `Green: finish above ${gMoney(r.start)} to earn it` : `Green: it ended ${gMoney(Math.abs(r.change))} ${r.change < 0 ? 'below' : 'level with'} where it started`,
    r.stars[1] ? `No late bills: ${r.onTime} paid on or before their day` : r.due ? `No late bills: ${r.late} late ${DOT} pay every bill on or before its day to earn it` : `No late bills: no tracked bill was due ${r.cur ? 'yet' : 'that month'}, so it is not scored`,
    r.stars[2] ? `Saved: ${gMoney(p.total)} put to work` : r.stars[2] == null ? 'Saved: nothing had been put to work yet, so it is not scored' : 'Put money toward a goal, savings or debt to earn the third',
  ];
}
const gSgn = n => (n < -0.5 ? MINUS : '') + gMoney(Math.abs(n));
function gInspSeason(m, st) {
  const r = st.months.find(x => x.m === m);
  if (!r) return inspHead('Details') + `<p class="empty">Pick a row.</p>`;
  const why = gSeasonWhy(r), p = r.placed;
  return inspHead(esc(gword('season')), `<span class="tag">${r.n} of ${r.of} ★</span>`) + `<div class="dk-ib">
    <div class="dk-it"><h2>${mLong(r.m)}</h2></div>
    <div class="muted small">${r.cur ? 'so far ' + DOT + ' ' : ''}${gMoney(r.start)} ${ARROW} ${gMoney(r.end)}</div>
    <div class="dk-ibig num ${r.change > 0 ? 'pos' : r.change < 0 ? 'neg' : ''}"${gRollAttr('insp:m:' + r.m, r.change)}>${r.change > 0 ? '+' : r.change < 0 ? MINUS : ''}${gMoney(Math.abs(r.change))}</div>
    ${gStarsHTML(r, true)}
    <div class="dk-iacts"><button class="btn btn-primary" data-action="gm-recap" data-m="${r.m}" data-primary>Recap ${kbd('Enter')}</button></div>
  </div>
  <div class="dk-isec">
    ${kv(dword('Net worth'), `<span class="num">${gMoney(r.start)} ${ARROW} ${gMoney(r.end)}</span>`)}
    ${kv('Change', signed(r.change, { cents: false }))}
    ${kv(esc(gword('level')), esc(gLvlRun(r)))}
    ${kv('Bills on time', `<span class="num">${r.onTime}/${r.due}</span> ${DOT} ${r.late} late`)}
    ${kv('Saved', `<span class="num">${gMoney(p.total)}</span>${p.goals || p.savings || p.debt ? ` <span class="muted small">goals ${gSgn(p.goals)} ${DOT} savings ${gSgn(p.savings)} ${DOT} debt ${gSgn(p.debt)}</span>` : ''}`)}
    ${kv('Best day', r.bestDay ? `${fmtDate(r.bestDay.date, MD)} <span class="num pos">+${gMoney(r.bestDay.amt)}</span>` : '<span class="muted">none up</span>')}
  </div>
  <div class="dk-isec"><div class="label dk-il">Stars</div><ul class="list dk-mini gm-why">${why.map((w, i) => `<li class="${r.stars[i] ? 'on' : r.stars[i] == null ? 'na' : ''}"><i class="gm-star-g" aria-hidden="true"></i><span class="grow">${esc(w)}</span></li>`).join('')}</ul></div>`;
}
/* the recap: lines count up one by one, then the stars stamp in */
const gLvlRun = r => (r.lvlEnd > r.lvlStart ? `${gLvl(r.lvlStart)} ${ARROW} ${r.lvlEnd}` : r.lvlEnd < r.lvlStart ? `${gLvl(r.lvlEnd)} (from ${r.lvlStart})` : `${gLvl(r.lvlEnd)} ${DOT} held`);
function gRecapHTML(r) {
  const t = gTheme(), why = gSeasonWhy(r), p = r.placed;
  const title = t === 'comic' ? `THE END... OF ${MONTHS_LONG[+r.m.slice(5) - 1].toUpperCase()}!` : r.n >= 2 || (r.of && r.n === r.of) ? gw('recap') : gw('recapSoft');
  const lines = [
    ['Started at', gMoney(r.start), r.start],
    [r.cur ? 'So far' : 'Ended at', gMoney(r.end), r.end],
    [gword('level'), gLvlRun(r)],
    ['Bills on time', r.due ? `${r.onTime} of ${r.due}${r.late ? ` ${DOT} ${r.late} late` : ''}` : 'none marked'],
    ['Saved', gMoney(p.total), p.total],
    ['Best day', r.bestDay ? `${fmtDate(r.bestDay.date, MD)} +${gMoney(r.bestDay.amt)}` : DASH],
  ];
  const grade = !r.of ? 'B' : r.n === r.of ? 'S' : r.n / r.of >= 0.6 ? 'A' : r.n ? 'B' : 'C';
  return `<div class="mform gm-dlg gm-recap" data-n="${r.n}">
    <div class="gm-rc-top"><div class="gm-rc-kick">${esc(gword('season'))} ${DOT} ${mLong(r.m)}${r.cur ? ' so far' : ''}</div><h3 class="gm-rc-title">${esc(title)}</h3>${t === 'arcade' ? `<div class="gm-rc-grade" aria-label="Grade ${grade}">${grade}</div>` : ''}</div>
    <ul class="gm-rc-lines">${lines.map((l, i) => `<li style="--i:${i}"><span>${esc(l[0])}</span><b class="num"${l[2] != null ? ` data-cu="${l[2]}"` : ''}>${esc(l[1])}</b></li>`).join('')}
      <li class="gm-rc-total" style="--i:${lines.length}"><span>${esc(gw('recapTotal'))}</span><b class="num ${r.change > 0 ? 'pos' : r.change < 0 ? 'neg' : ''}" data-cu="${r.change}" data-sign="1">${r.change > 0 ? '+' : r.change < 0 ? MINUS : ''}${gMoney(Math.abs(r.change))}</b></li></ul>
    <div class="gm-rc-stars" style="--i:${lines.length + 1}">${r.stars.map((on, i) => `<i class="${on ? 'on' : on == null ? 'na' : ''}" style="--s:${i}"></i>`).join('')}</div>
    <ul class="gm-rc-why">${why.map((w, i) => `<li class="${r.stars[i] ? 'on' : r.stars[i] == null ? 'na' : ''}">${esc(w)}</li>`).join('')}</ul>
    <div class="mactions"><span class="grow"></span><button type="button" class="btn btn-primary gm-rc-go" data-close>${esc(gw('recapBtn'))}</button></div></div>`;
}
function gRecapPlay() {
  const box = $('#modalRoot .gm-recap');
  if (!box) return;
  const stars = box.querySelectorAll('.gm-rc-stars i.on').length;
  const notes = at => gLater(() => { if (!box.isConnected) return; for (let i = 0; i < stars; i++) gSound('star', i * 0.08, i); }, at);
  if (!motionOK()) { box.classList.add('gm-rc-now'); notes(200); return; }
  notes(120 + 7 * 170 + 250 + 120);
  box.classList.add('gm-rc-play');
  box.querySelectorAll('[data-cu]').forEach(el => {
    const to = +el.dataset.cu, fin = el.textContent, sign = !!el.dataset.sign, i = +(el.closest('li') || el).style.getPropertyValue('--i') || 0;
    el.textContent = sign ? '+$0' : '$0';
    const t0 = 120 + i * 170;
    const step = k => { if (!el.isConnected) return; const e = 1 - Math.pow(1 - k, 3), v = to * e; el.textContent = k >= 1 ? fin : (sign ? (v < 0 ? MINUS : '+') : '') + gMoney(Math.abs(v)); };
    for (let f = 1; f <= 10; f++) gLater(() => step(f / 10), t0 + f * 42);
  });
}
function gOpenRecap(m) {
  const st = G.st || (G.st = gameState());
  const r = st.months.find(x => x.m === m);
  if (!r) { toast('No months to look back on yet'); return; }
  openModal(gRecapHTML(r));
  gRecapPlay();
}
/* once, on the first desktop render of a new month: last month's recap, if it had two snapshots or more */
function gRecapCheck(st, silent) {
  if (!S.accounts.length) return;
  const d = parseISO(st.date), last = ym(new Date(d.getFullYear(), d.getMonth(), 0)), seen = gGet(GK.recap);
  if (seen == null || silent) { if (seen == null || seen < last) gSet(GK.recap, last); return; }
  if (seen >= last) return;
  const r = st.months.find(x => x.m === last);
  if (!r || r.closes < 2) { gSet(GK.recap, last); return; }
  if ($('#modalRoot').classList.contains('open')) { G.recapWait = last; return; }
  gSet(GK.recap, last); G.recapWait = null;
  gOpenRecap(last);
}

/* ---------- trophies dialog ---------- */
function gTrophiesHTML(st) {
  const T = st.trophies, R = T.records;
  const recs = [
    ['Highest net worth', `${gMoney(R.net.v)}`, fmtDate(R.net.date, MD)],
    ['Best month', R.month ? `+${gMoney(R.month.change)}` : DASH, R.month ? MONTHS_LONG[+R.month.m.slice(5) - 1] : 'none completed yet'],
    ['Highest level', gLvl(R.level.n), gRankOf(R.level.n).title],
    ['On-time streak', String(R.onTime), 'longest'],
    ['Green run', `${R.green} month${R.green === 1 ? '' : 's'}`, 'longest'],
    ['Check-in run', `${R.checkin} week${R.checkin === 1 ? '' : 's'}`, 'longest'],
  ];
  return `<div class="mform gm-dlg gm-tro"><h3>${esc(gword('trophies'))}</h3>
    <p class="muted small intro"><b class="num gm-tro-n">${T.earned} of ${T.of}</b> tiers earned ${DOT} worked out from your numbers, so every figure is the real one.</p>
    <div class="gm-pr">${recs.map(r => `<div class="gm-pr-c"><div class="label">${esc(r[0])}</div><div class="num gm-pr-v">${esc(r[1])}</div><div class="muted small">${esc(r[2])}</div></div>`).join('')}</div>
    <div class="gm-tro-grid">${T.fams.map(f => `<div class="gm-tc t${f.tier}${f.tier ? '' : ' locked'}" data-fam="${f.id}">
      <span class="gm-medal t${f.tier}" aria-hidden="true">${gIco(TRO_ICONS[f.id])}</span>
      <div class="gm-tc-main"><div class="gm-tc-name">${esc(f.name)}<span class="gm-tc-tier">${f.tier ? TIER_NAMES[f.tier - 1] : 'Locked'}</span></div>
        <div class="gm-tdots" aria-label="${f.tier} of 4 tiers">${[0, 1, 2, 3].map(i => `<i class="${i < f.tier ? 'on' : ''}"></i>`).join('')}</div>
        <div class="gm-tc-bar"><i style="width:${f.pct.toFixed(1)}%"></i></div>
        <div class="gm-tc-txt">${esc(f.prog)}</div>${f.tier ? '' : `<div class="gm-tc-how">${esc(f.how)}</div>`}</div></div>`).join('')}</div>
    <div class="mactions"><span class="muted small">${kbd('A')} opens this any time</span><span class="grow"></span><button type="button" class="btn btn-primary" data-close>Done</button></div></div>`;
}

/* ---------- GO! moments: everything the ledger has earned, as keys; each is celebrated once per browser ---------- */
function gEarned(st) {
  const out = [];
  for (let L = 2; L <= st.bestLevel; L++) out.push({ key: 'lvl:' + L, big: true, kind: 'lvl', level: L, rank: 90 });
  for (const g of S.goals) {
    if (!(g.target > 0)) continue;
    const saved = gGoalSaved(g, st), stage = gStage(g, st);
    if (stage >= 5) out.push({ key: 'goal:' + g.id, big: true, kind: 'goal', gid: g.id, name: g.name, net: g.kind === 'net', target: g.target, rank: 70 });
    for (let n = 1; n <= 4; n++) if (stage >= n) out.push({ key: `stage:${g.id}:${n}`, kind: 'stage', gid: g.id, name: g.name, n, saved, target: g.target, rank: 20 });
  }
  /* a debt at $0 whose recorded peak was above it */
  for (const a of liabilities()) {
    const d = st.debts && st.debts[a.id];
    if (d && d.cleared) out.push({ key: 'debt0:' + a.id, big: true, kind: 'debt0', id: a.id, name: a.name, peak: d.peak, rank: 80 });
  }
  if (st.record.isNew) out.push({ key: 'ath:' + st.date, kind: 'ath', rank: 40 });
  for (const e of st.pays) if (e.onTime) out.push({ key: `paid:${e.id}:${e.key}`, kind: 'paid', e, rank: 50 });
  if (st.freshWeek) out.push({ key: 'fresh:' + st.week.start, kind: 'fresh', rank: 30 });
  if (st.planWeek) out.push({ key: 'plan:' + st.week.start, kind: 'plan', rank: 25 });
  if (st.weekClear) out.push({ key: 'week:' + st.week.start, big: true, kind: 'week', n: st.jobs.length, rank: 60 });
  for (const f of st.trophies.fams) for (let t = 1; t <= f.tier; t++) out.push({ key: `tro:${f.id}:${t}`, big: true, kind: 'tro', fam: f, t, rank: 50 });
  return out;
}
/* the new keys become banners (big) and pops (small), built from this render's numbers */
function gQueue(fresh, st, snd) {
  if (G.skipKeys && G.skipKeys.size) fresh = fresh.filter(m => !G.skipKeys.has(m.key));
  const bigs = [], pops = [], of = k => fresh.filter(m => m.kind === k);
  const lv = of('lvl').map(m => m.level);
  if (lv.length) bigs.push({ kind: 'lvl', lo: Math.min.apply(null, lv), hi: Math.max.apply(null, lv), rank: 90 });
  of('debt0').forEach(m => bigs.push(m));
  of('goal').forEach(m => bigs.push(m));
  of('week').forEach(m => bigs.push(m));
  const tro = new Map(); of('tro').forEach(m => { if (!tro.has(m.fam.id) || tro.get(m.fam.id).t < m.t) tro.set(m.fam.id, m); });
  tro.forEach(m => bigs.push(m));
  bigs.sort((a, b) => b.rank - a.rank);
  const show = bigs.length > 4 ? bigs.slice(0, 3).concat([{ kind: 'more', n: bigs.length - 3, items: bigs.slice(3) }]) : bigs;
  const paid = of('paid');
  if (paid.length >= 3) pops.push({ kind: 'paidN', n: paid.length, amt: sum(paid, m => m.e.amount), keys: paid.map(m => m.key) });
  else paid.forEach(m => pops.push(m));
  of('ath').slice(0, 1).forEach(m => pops.push(m));
  const funded = new Set(of('goal').map(m => m.gid)), stg = new Map();
  of('stage').filter(m => !funded.has(m.gid)).forEach(m => { if (!stg.has(m.gid) || stg.get(m.gid).n < m.n) stg.set(m.gid, m); });
  stg.forEach(m => pops.push(m));
  of('fresh').forEach(m => pops.push(m));
  of('plan').forEach(m => pops.push(m));
  for (const b of show) G.bigQ.push({ kind: b.kind, m: b, big: true, snd });
  for (const p of pops.slice(0, 6)) G.popQ.push({ kind: p.kind, m: p, snd });
  if (G.bigQ.length || G.popQ.length) gLater(gPump, 450);
}
function gKicker(kind) {
  const t = gTheme(), win = kind === 'goal' || kind === 'week';
  if (t === 'tycoon') return 'GO!';
  if (t === 'comic') return win ? 'KA-CHING!' : 'POW!';
  if (t === 'casino') return kind === 'goal' ? 'CASHED OUT' : win ? 'JACKPOT' : 'WINNER';
  if (t === 'passbook') return { lvl: 'NEW LEVEL', goal: 'COMPLETE', debt0: 'PAID IN FULL', week: 'WEEK POSTED', tro: 'MERIT', more: 'POSTED' }[kind] || 'POSTED';
  if (t === 'arcade') return kind === 'lvl' ? 'LV UP' : '1UP';
  if (t === 'heist') return '';
  return '✦';
}
function gBigHTML(m, st) {
  let title = '', head = '', sub = '';
  switch (m.kind) {
    case 'lvl': title = gword('levelUp'); head = m.lo === m.hi ? gLvl(m.hi) : `${gLvl(m.lo - 1)} ${ARROW} ${m.hi}`; sub = `${dword('Net worth')} ${gMoney(st.net)} ${DOT} ${gLvl(st.level + 1)} at ${gMoney(st.band.hi)}`; break;
    case 'goal': title = gword('goalBuilt'); head = m.name; sub = m.net ? `${dword('Net worth')} ${gMoney(st.net)} ${DOT} target ${gMoney(m.target)}` : (gTheme() === 'heist' ? `${gMoney(m.target)} set aside` : gMoney(m.target)); break;
    case 'debt0': title = gword('debtCleared'); head = gTheme() === 'comic' ? m.name : `${m.name} paid off`; sub = `${gMoney(m.peak)} paid down since the peak`; break;
    case 'week': title = gword('boardCleared'); head = `${m.n} of ${m.n}`; sub = `Every job on this week's board, done`; break;
    case 'tro': title = gw('award'); head = `${m.fam.name} ${DOT} ${TIER_NAMES[m.t - 1]}`; sub = m.fam.why; break;
    case 'more': title = `+${m.n} more`; head = m.items.map(x => x.kind === 'tro' ? x.fam.name : x.kind === 'goal' ? x.name : x.kind === 'week' ? gword('boardCleared') : x.kind === 'debt0' ? x.name : gword('levelUp')).join(` ${DOT} `); sub = `${kbd('A')} awards ${DOT} ${kbd('Q')} this week`; break;
  }
  if (m.kind === 'lvl') {
    /* a title reached on the way: say what it unlocked */
    const a = gRankOf(m.lo - 1), b = gRankOf(m.hi);
    if (b.i > a.i) sub = `Unlocked: ${b.title} ${DOT} ${b.frame.toLowerCase()} frame ${DOT} ${dword('Net worth')} ${gMoney(st.net)}`;
  }
  const t = gTheme(), mo = motionOK(), stk = t === 'tycoon' && m.kind === 'tro', k = stk ? '★'.repeat(m.t) : m.kind === 'more' && t === 'arcade' ? `+${m.n}` : gKicker(m.kind);
  let bits = '';
  if (mo && t === 'tycoon') bits = Array.from({ length: 14 }, (_, i) => `<i class="fx-coin" style="--x:${(6 + (i * 37) % 88)}%;--d:${(i * 83) % 700}ms;--r:${(i * 47) % 360}deg;--s:${0.7 + (i % 4) * 0.12}"></i>`).join('') + (m.kind === 'lvl' ? '<i class="fx-dice a"></i><i class="fx-dice b"></i>' : '');
  if (mo && t === 'casino') bits = Array.from({ length: 12 }, (_, i) => `<i class="fx-chip" style="--x:${(4 + (i * 41) % 92)}%;--d:${(i * 97) % 800}ms;--r:${(i * 61) % 360}deg"></i>`).join('');
  if (mo && t === 'arcade') bits = Array.from({ length: 16 }, (_, i) => `<i class="fx-spark" style="--x:${(3 + (i * 29) % 94)}%;--y:${(10 + (i * 53) % 80)}%;--d:${(i * 71) % 600}ms"></i>`).join('');
  return `${t === 'heist' ? '<i class="fx-lb fx-lb-t"></i><i class="fx-lb fx-lb-b"></i>' : ''}<div class="fx-b-band">${stk ? `<div class="fx-b-mark fx-stk t${m.t}"><i class="gm-medal fx-stk-disc t${m.t}">${gIco(TRO_ICONS[m.fam.id])}</i><b class="fx-stk-stars">${esc(k)}</b></div>` : k ? `<div class="fx-b-mark"><b>${esc(k)}</b></div>` : ''}<div class="fx-b-text"><div class="fx-b-title">${esc(title)}</div><div class="fx-b-head">${esc(head)}</div><div class="fx-b-sub">${m.kind === 'more' ? sub : esc(sub)}</div>${t === 'arcade' && m.kind === 'lvl' ? '<span class="fx-b-xp"><i></i></span>' : ''}</div></div>${bits ? `<div class="fx-b-fx">${bits}</div>` : ''}`;
}
function gPopHTML(p, st) {
  let title = '', text = '';
  switch (p.kind) {
    case 'paid': title = gword('paid'); text = `${p.e.name} ${p.e.early > 0 ? p.e.early + ' day' + (p.e.early === 1 ? '' : 's') + ' early' : 'on time'} ${DOT} ${gMoney(p.e.amount)} ${DOT} streak ${st.streaks.onTime.cur}`; break;
    case 'paidN': title = gword('paid'); text = `${p.n} bills paid on time ${DOT} ${gMoney(p.amt)}`; break;
    case 'ath': title = gword('record'); text = `${gMoney(st.net)} ${DOT} +${gMoney(gShown(st).over)} over ${fmtDate(st.record.prevDate, MD)}`; break;
    case 'stage': title = p.name; text = `stage ${p.n} of 5 ${DOT} ${gMoney(p.saved)} of ${gMoney(p.target)}`; break;
    case 'fresh': title = gw('fresh'); text = `${S.accounts.length} of ${S.accounts.length} balances checked`; break;
    case 'plan': title = gw('onTarget'); text = 'every bucket within $50'; break;
  }
  return `<i class="fx-p-ico" aria-hidden="true"></i><span class="fx-p-body"><b class="fx-p-t">${esc(title)}</b><span class="fx-p-s">${esc(text)}</span></span>`;
}
/* a queued moment is checked again when its turn comes: what an undo or a correction took back is dropped,
   and what is left is written from the numbers as they are now */
function gLiveM(m, st, E) {
  if (m.kind === 'lvl') { const hi = Math.min(m.hi, st.bestLevel); return hi >= m.lo ? Object.assign({}, m, { hi }) : null; }
  if (m.kind === 'more') { const items = m.items.map(x => gLiveM(x, st, E)).filter(Boolean); return items.length > 1 ? Object.assign({}, m, { n: items.length, items }) : items[0] || null; }
  if (m.kind === 'paidN') { const es = m.keys.map(k => E.get(k)).filter(Boolean); return es.length ? Object.assign({}, m, { n: es.length, amt: sum(es, x => x.e.amount) }) : null; }
  return (m.key && E.get(m.key)) || null;
}
function gLive(item) {
  if (!item.m) return item;   /* a plain notice: the sound hint, a money-put-to-work pop */
  const st = G.st;
  if (!st) return null;
  const m = gLiveM(item.m, st, new Map(gEarned(st).map(x => [x.key, x])));
  if (!m) return null;
  return Object.assign({}, item, { kind: m.kind, m, html: item.big ? gBigHTML(m, st) : gPopHTML(m, st) });
}
/* one banner at a time, pops up to three at once; nothing while a dialog is open */
function gPump() {
  if (!isDesk()) return;
  if ($('#modalRoot').classList.contains('open')) return;
  if (G.big) return;
  const wait = (G.bigHold || 0) - performance.now();
  if (G.bigQ.length && wait > 0) { clearTimeout(G.holdT); G.timers.delete(G.holdT); G.holdT = gLater(gPump, wait + 30); }
  else while (G.bigQ.length) { const it = gLive(G.bigQ.shift()); if (it) { gShowBig(it); return; } }
  /* pops in the page bar come one at a time (there is room for one); under the strip, up to three stack */
  const cap = () => (document.querySelector('#fxRoot .fx-pops.fx-in-bar') && G.pops.size ? 1 : 3);
  while (G.popQ.length && G.pops.size < cap()) { const it = gLive(G.popQ.shift()); if (it) gShowPop(it); }
}
/* ---------- where the fx sit: never on the figures a page leads with ---------- */
/* the drawn extent of an element's text (a block's own box can be much wider than its number) */
function gTextRect(el) {
  try { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); if (b.width > 0) return b; } catch (e) {}
  return el.getBoundingClientRect();
}
/* the empty middle of the page bar, between the title (and the line beside it) and the bar's buttons */
function gBarSlot(need) {
  const bar = $('#main .dk-bar');
  if (!bar || !bar.getClientRects().length) return null;
  const br = bar.getBoundingClientRect(), t = bar.querySelector('.dk-title'), a = bar.querySelector('.dk-actions'), h1 = t && t.querySelector('h1');
  let left = br.left + 24;
  if (t) for (const c of t.children) if (c.getClientRects().length) left = Math.max(left, gTextRect(c).right);
  const btns = a ? Array.from(a.children).filter(x => x.getClientRects().length) : [];
  const right = btns.length ? Math.min(...btns.map(x => x.getBoundingClientRect().left)) : br.right - 24;
  /* a page's long help line under its title is words, not figures: when the middle is too narrow, the fx may sit over it */
  if (need && right - left - 40 < need && h1) left = Math.min(left, gTextRect(h1).right);
  return { left: left + 20, right: right - 20, width: right - left - 40, top: br.top, bottom: br.bottom, mid: br.top + br.height / 2 };
}
/* a banner arriving lets the pops sharing its place go at once */
function gClearPops(inBar) {
  const box = document.querySelector('#fxRoot .fx-pops');
  if (!box || box.classList.contains('fx-in-bar') !== inBar) return;
  box.querySelectorAll('.fx-pop').forEach(p => { p.classList.add('out'); gLater(() => { p.remove(); G.pops.delete(p); }, 220); });
}
/* a banner's top: under the Overview hero (the number it celebrates stays in view), else under the page's summary strip, else under the bar */
function gFxBelow(h) {
  const bb = gBarBottom(), on = el => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().bottom > bb + 8;
  const hero = $('#main .dk-hero'), kp = $('#main .dk-kpis');
  let top = bb + 20;
  if (on(hero)) top = hero.getBoundingClientRect().bottom + 14;
  else if (on(kp)) top = kp.getBoundingClientRect().bottom + 14;
  return Math.round(Math.max(bb + 12, Math.min(top, innerHeight - h - 16)));
}
function gShowBig(item) {
  const main = $('#main');
  if (!main) return;
  const mr = main.getBoundingClientRect(), slot = gQuiet() ? gBarSlot(360) : null;
  const el = document.createElement('div');
  el.className = 'fx-moment fx-big fx-k-' + item.kind + (motionOK() ? '' : ' fx-still');
  el.setAttribute('role', 'status');
  el.style.cssText = `left:${Math.max(0, mr.left).toFixed(0)}px;visibility:hidden`;
  el.innerHTML = item.html;
  fxRoot().appendChild(el);
  const band = el.querySelector('.fx-b-band'), h = band ? band.offsetHeight : 60;
  /* dark and paper: in the page bar's empty middle, where no figure sits; the other looks: under the hero or the summary strip */
  if (slot && slot.width >= 360) { el.classList.add('fx-in-bar'); el.style.cssText = `left:${slot.left.toFixed(0)}px;right:auto;width:${slot.width.toFixed(0)}px;--fx-top:${(slot.mid - h / 2).toFixed(0)}px`; }
  else el.style.cssText = `left:${Math.max(0, mr.left).toFixed(0)}px;--fx-top:${gFxBelow(h)}px`;
  gClearPops(el.classList.contains('fx-in-bar'));
  G.big = el;
  el.__t = gLater(() => gBigEnd(el), 250 + 2200);
  if (item.snd) gSound(item.kind === 'lvl' || item.kind === 'week' ? 'levelUp' : item.kind === 'more' ? '' : 'sting');
}
function gBigEnd(el, quick) {
  if (!el || el.__ending) return;
  el.__ending = true;
  clearTimeout(el.__t); G.timers.delete(el.__t);
  el.classList.add('out');
  if (quick) el.classList.add('quick');
  gLater(() => { el.remove(); if (G.big === el) G.big = null; gLater(gPump, 160); }, quick ? 160 : 300);
}
function gShowPop(item) {
  let box = document.querySelector('#fxRoot .fx-pops');
  const main = $('#main');
  const first = !box || !box.children.length;
  if (!box) { box = document.createElement('div'); box.className = 'fx-pops'; fxRoot().appendChild(box); }
  const el = document.createElement('div');
  el.className = 'fx-pop fx-k-' + item.kind;
  el.setAttribute('role', 'status');
  el.innerHTML = item.html;
  box.appendChild(el);
  /* in the page bar's empty middle when there is room (no label or figure there), else under the summary strip */
  if (first && main) {
    const slot = gBarSlot(300), mr = main.getBoundingClientRect();
    if (slot && slot.width >= 300) { box.classList.add('fx-in-bar'); box.style.left = ((slot.left + slot.right) / 2).toFixed(0) + 'px'; box.style.top = (slot.mid - el.offsetHeight / 2).toFixed(0) + 'px'; box.style.setProperty('--pop-max', slot.width.toFixed(0) + 'px'); }
    else { box.classList.remove('fx-in-bar'); box.style.left = (mr.left + mr.width / 2).toFixed(0) + 'px'; box.style.top = (gFxBelow(el.offsetHeight) - 6).toFixed(0) + 'px'; box.style.removeProperty('--pop-max'); }
  }
  G.pops.add(el);
  if (item.snd && item.kind !== 'hint') gSound('pop');
  gLater(() => el.classList.add('out'), 2350);
  gLater(() => { el.remove(); G.pops.delete(el); gPump(); }, 2600);
}
/* a click or a key anywhere lets the banner go at once (it never blocks anything: pointer-events are off) */
function gDismiss() { if (G.big) gBigEnd(G.big, true); }
document.addEventListener('pointerdown', gDismiss, true);
document.addEventListener('keydown', gDismiss, true);
/* dialogs pause the moments; they carry on 400ms after the last one closes. The recap waits the same way. */
let gModalMO = null;
function gWatchModal() {
  if (gModalMO || typeof MutationObserver === 'undefined') return;
  const root = $('#modalRoot');
  G.modalOpen = root.classList.contains('open');
  gModalMO = new MutationObserver(() => {
    const open = root.classList.contains('open');
    if (open === G.modalOpen) return;
    G.modalOpen = open;
    if (open) { if (G.big) gBigEnd(G.big, true); document.querySelectorAll('#fxRoot .fx-fly, #fxRoot .fx-dmg, #fxRoot .fx-pick').forEach(e => e.remove()); return; }   /* nothing flies over a dialog */
    gLater(() => {
      if (!isDesk() || root.classList.contains('open')) return;
      if (G.recapWait && G.st) { gRecapCheck(G.st, false); if (root.classList.contains('open')) return; }
      gPump();
    }, 400);
  });
  gModalMO.observe(root, { attributes: true, attributeFilter: ['class'] });
}

/* ---------- actions the game adds (desktop only) ---------- */
async function gCheckinRun() {
  if (!isDesk()) return;
  const list = S.accounts.map(a => ({ a, f: gFreshOf(a) })).filter(x => x.f.days == null || x.f.days > 7)
    .sort((x, y) => (x.a.updatedAt || '').localeCompare(y.a.updatedAt || ''));
  if (!list.length) { toast('Every balance is fresh: all checked within the last 7 days'); return; }
  const n = list.length;
  G.roundStop = false;
  for (let i = 0; i < n; i++) {
    if (!isDesk()) break;   /* the round is a desktop thing: it ends if the window drops to phone width */
    if (!acct(list[i].a.id)) continue;
    if (view === 'accounts') dkSelect(list[i].a.id, { scroll: true });
    G.act = { name: 'update-balance', id: list[i].a.id, rect: null, rowRect: null, sel: null, seq: G.seq, round: true };
    const res = await actions['update-balance']({ dataset: { id: list[i].a.id } }, { round: { i: i + 1, n, days: list[i].f.days } });
    if (res === 'stop') break;
    if (res === 'done' && i < n - 1) {
      /* a pause so the roll lands before the next dialog; Enter goes on at once, Esc ends the round */
      await new Promise(r => {
        const done = () => { clearTimeout(t); document.removeEventListener('keydown', kd, true); r(); };
        const kd = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } else if (e.key === 'Escape') { G.roundStop = true; done(); } };
        const t = setTimeout(done, motionOK() ? 1100 : 150);
        document.addEventListener('keydown', kd, true);
      });
      if (G.roundStop || $('#modalRoot').classList.contains('open') || !isDesk()) break;   /* Esc in the pause, or another dialog opened: the round ends */
    }
  }
}
/* the stakes, before the click (desktop only; the phone's dialogs never change): one true line of what the action earns */
function gStakes(kind, x) {
  if (!isDesk() || !x) return '';
  const st = G.st || (G.st = gameState());
  let t = '';
  if (kind === 'pay') {
    const bs = billStatus(x), d = bs.due ? dayDiff(bs.due, parseISO(todayStr())) : null, s = st.streaks.onTime;
    const f = st.trophies.fams.find(z => z.id === 'ontime'), nx = f && f.tier < 4 ? f.tiers[f.tier] - f.v : 0;
    if (d == null) return '';
    t = d < 0 ? `${-d} day${d === -1 ? '' : 's'} past its day ${DOT} paying it clears it` : `${d > 0 ? `${d} day${d === 1 ? '' : 's'} early` : 'On time today'} ${DOT} streak ${s.cur} ${ARROW} ${s.cur + 1}${nx === 1 ? ` ${DOT} 1 more for ${f.name} ${TIER_NAMES[f.tier]}` : ''}`;
  } else if (kind === 'fund') {
    const sg = gStage(x, st), saved = gGoalSaved(x, st);
    if (sg >= 5 || !(x.target > 0)) return '';
    t = `Stage ${sg} of 5 ${DOT} ${gMoney(Math.max(1, x.target * (sg + 1) / 5 - saved))} more reaches stage ${sg + 1}`;
  } else if (kind === 'update') {
    if (!(st.net > 0)) return '';
    t = `${gLvl(st.level)} ${DOT} ${gMoney(gShown(st).toNext)} to ${gLvl(st.level + 1)}, as is`;
  }
  return t ? ` <span class="gm-stake">${esc(t)}</span>` : '';
}
/* the on-time streak for the Upcoming KPI note */
function gStreakNote() {
  const st = G.st || (G.st = gameState()), s = st.streaks.onTime;
  return ` ${DOT} on-time streak ${s.cur}${s.cur === 0 && s.best ? ` (best ${s.best})` : ''}`;
}
function gSeasonRows(st) { return sortList('seasons', st.months.slice().reverse(), { month: r => r.m, change: r => r.change, stars: r => r.n * 1e9 + r.change }); }

/* ======================================================================
   game, part 3 (desktop only): the juice. Coins fly to where the money went, a PAID stamp lands on the bill,
   a debt takes damage, quiet synthesized sounds (with a mute), every goal is a landmark built in five stages,
   debts are bosses with a recorded peak, a welcome-back score, and the game-menu polish: a sliding cursor,
   controller prompts, the board on the 30-day strip. Juice only follows a change made here (a local commit),
   only on the desktop layout, and only for good habits. Every figure shown is the real one.
   ====================================================================== */

/* ---------- landmarks: a goal's stage, one per 20%, and its silhouette ---------- */
const LM_SILS = ['tower', 'house', 'dome', 'lighthouse', 'stadium'];
function gHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* the same goal id gives the same building on every device */
const gSil = id => LM_SILS[gHash('ws.lm:' + id) % LM_SILS.length];
/* net goals read the as-is total, like the rest of the game */
const gGoalSaved = (g, st) => (g.kind === 'net' ? Math.max(0, st ? st.net : r2(totals().N)) : Math.max(0, +g.saved || 0));
const gGoalPct = (g, st) => (g.target > 0 ? Math.min(100, gGoalSaved(g, st) / g.target * 100) : 0);
function gStage(g, st) {
  if (!(g.target > 0)) return gGoalSaved(g, st) >= (+g.target || 0) ? 5 : 0;
  return gGoalSaved(g, st) >= g.target ? 5 : Math.min(4, Math.floor(gGoalPct(g, st) / 20 + 1e-9));
}
function gStages(st) { st.stages = {}; for (const g of S.goals) st.stages[g.id] = gStage(g, st); }

/* ---------- bosses: every debt's recorded peak, walked back from today through the history ---------- */
function gDebtWalk(a, steps) {
  steps = steps || gAcctSteps(a);
  let peak = +a.balance || 0;
  const trail = [];
  for (const s of steps) {
    if (s.add) continue;
    if (s.before > -0.005) trail.push({ date: s.t.date, before: s.before, after: s.after });   /* a debt never owed less than nothing */
    if (s.before > peak) peak = s.before;
  }
  return { peak: r2(Math.max(peak, +a.balance || 0)), trail };
}
/* every debt there is now, and what they owed together at their highest: the history walked back for all of them at once,
   so money moved from one debt to another never counts as paid down, and a debt deleted or added is not a payment either */
function gBosses(st) {
  const debts = {}, list = liabilities(), at = new Map(S.txns.map((t, i) => [t, i])), moves = new Map();
  /* a payment still stands while its bill still points at it: an undone one is not a hit */
  const livePay = new Set(); for (const b of S.bills) for (const k of Object.keys(b.paid || {})) { const p = b.paid[k]; if (p && p.txnId) livePay.add(p.txnId); }
  for (const a of list) {
    const steps = gAcctSteps(a, true), w = gDebtWalk(a, steps), owed = r2(+a.balance || 0), peak = w.peak;
    for (const s of steps) { const i = at.get(s.t); moves.set(i, (moves.get(i) || 0) + (s.before - s.after)); }
    const monthly = r2(sum(S.bills.filter(b => b.to === a.id), b => (+b.amount || 0) * (PER_MONTH[b.every] || 1)));
    const hits = steps.filter(s => !s.add && s.after < s.before - 0.005 && ((s.t.kind === 'payment' && livePay.has(s.t.id)) || s.t.kind === 'transfer')).slice(0, 5)
      .map(s => ({ date: s.t.date, amount: r2(s.before - s.after), from: s.t.from, kind: s.t.kind, desc: s.t.desc }));
    debts[a.id] = { peak, owed, paid: r2(Math.max(0, peak - Math.max(0, owed))), hp: peak > 0.005 ? Math.max(0, Math.min(100, owed / peak * 100)) : (owed > 0.005 ? 100 : 0),
      monthly, left: monthly > 0.005 && owed > 0.005 ? Math.ceil(owed / monthly - 1e-9) : null, hits, trail: w.trail.slice(0, 4), cleared: owed <= 0.005 && peak > 0.005, card: a.type === 'credit' };
  }
  const L = r2(sum(list, a => +a.balance || 0));
  let tot = L, tp = L;
  for (const i of Array.from(moves.keys()).sort((x, y) => x - y)) { tot += moves.get(i); if (tot > tp) tp = tot; }
  tp = r2(Math.max(tp, L));
  st.debts = debts;
  st.debtTot = { owed: L, peak: tp, paid: r2(Math.max(0, tp - L)), hp: tp > 0.005 ? Math.max(0, Math.min(100, L / tp * 100)) : 0 };
}
const gPctTxt = p => (Math.abs(p - Math.round(p)) < 0.05 ? Math.round(p) : p.toFixed(1)) + '%';

/* ======================================================================
   the landmark art: inline SVG, colours from each look's CSS. Six stages:
   0 an empty lot with a sign, 1 foundation, 2 walls in scaffolding, 3 roof, 4 windows and door, 5 built.
   ====================================================================== */
const LM_PAL = ['#e5312f', '#1d8fe0', '#1fa64a', '#f7931e', '#8f4fd8', '#e2489a', '#159bb0', '#8b5a2b'];
/* each silhouette's parts, standing on the ground line G: which stage each part arrives at, its shape, its class */
function lmParts(sil, G) {
  const R = (x, y, w, h, c, s, rx) => ({ s, c, d: `<rect x="${x}" y="${(G - y).toFixed(1)}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}/>` });
  const P = (pts, c, s) => ({ s, c, d: `<polygon points="${pts.map(p => p[0] + ',' + (G - p[1]).toFixed(1)).join(' ')}"/>` });
  const Pa = (d, c, s) => ({ s, c, d: `<path d="${d.replace(/G(-?[\d.]+)/g, (m, n) => (G - +n).toFixed(1))}"/>` });
  const L = (x1, h1, x2, h2, c, s) => ({ s, c, d: `<line x1="${x1}" y1="${(G - h1).toFixed(1)}" x2="${x2}" y2="${(G - h2).toFixed(1)}"/>` });
  const flag = (x, h0, h1) => [L(x, h0, x, h1, 'lm-pole', 5), P([[x, h1], [x + 11, h1 - 3.5], [x, h1 - 7]], 'lm-flag', 5)];
  switch (sil) {
    case 'tower': return { x0: 46, x1: 74, h: 42, top: 58, parts: [
      R(46, 42, 28, 42, 'lm-wall', 2), R(43, 44, 34, 3.5, 'lm-trim', 3), P([[43, 42], [77, 42], [60, 58]], 'lm-roof', 3),
      R(50, 36, 6, 6, 'lm-win', 4), R(64, 36, 6, 6, 'lm-win', 4), R(50, 26, 6, 6, 'lm-win', 4), R(64, 26, 6, 6, 'lm-win', 4), R(56, 11, 8, 11, 'lm-door', 4)].concat(flag(60, 58, 70)) };
    case 'house': return { x0: 32, x1: 88, h: 28, top: 50, parts: [
      R(73, 47, 7, 12, 'lm-wall lm-chim', 3), R(32, 28, 56, 28, 'lm-wall', 2), P([[28, 28], [92, 28], [60, 50]], 'lm-roof', 3), R(27, 30, 66, 3, 'lm-trim', 3),
      R(38, 22, 11, 9, 'lm-win', 4), R(71, 22, 11, 9, 'lm-win', 4), R(55, 17, 10, 17, 'lm-door', 4)].concat(flag(60, 50, 64)) };
    case 'dome': return { x0: 36, x1: 84, h: 24, top: 46, parts: [
      R(36, 24, 48, 24, 'lm-wall', 2), Pa('M36 G24 A24 22 0 0 1 84 G24 Z', 'lm-roof', 3), R(34, 26.5, 52, 3.5, 'lm-trim', 3), L(60, 46, 60, 50, 'lm-pole', 3),
      R(41, 19, 7, 11, 'lm-win', 4), R(72, 19, 7, 11, 'lm-win', 4), Pa('M55 G0 L55 G10 A5 5 0 0 1 65 G10 L65 G0 Z', 'lm-door', 4)].concat(flag(60, 50, 62)) };
    case 'lighthouse': return { x0: 49, x1: 71, h: 40, top: 60, parts: [
      P([[49, 0], [71, 0], [67, 40], [53, 40]], 'lm-wall', 2), P([[48.5, 10], [71.5, 10], [70.8, 16], [49.2, 16]].map(p => [p[0] + (p[0] < 60 ? p[1] / 10 : -p[1] / 10), p[1]]), 'lm-trim lm-stripe', 3),
      P([[51.4, 24], [68.6, 24], [68, 30], [52, 30]], 'lm-trim lm-stripe', 3), R(50, 43, 20, 3, 'lm-trim', 3), R(53, 52, 14, 9, 'lm-win lm-lamp', 3), P([[51, 52], [69, 52], [60, 60]], 'lm-roof', 3),
      R(57, 38, 6, 5, 'lm-win', 4), R(56, 10, 8, 10, 'lm-door', 4)].concat(flag(60, 60, 70)) };
    default: return { x0: 14, x1: 106, h: 24, top: 36, parts: [   /* stadium */
      Pa('M14 G0 L18 G20 Q60 G27 102 G20 L106 G0 Z', 'lm-wall', 2), L(22, 20, 22, 40, 'lm-pole', 3), L(98, 20, 98, 40, 'lm-pole', 3), R(18, 44, 8, 5, 'lm-trim lm-lamp', 3), R(94, 44, 8, 5, 'lm-trim lm-lamp', 3),
      Pa('M16 G20 Q60 G31 104 G20 L102 G24 Q60 G36 18 G24 Z', 'lm-roof', 3),
      R(27, 13, 8, 9, 'lm-win', 4), R(40, 13, 8, 9, 'lm-win', 4), R(72, 13, 8, 9, 'lm-win', 4), R(85, 13, 8, 9, 'lm-win', 4), R(54, 14, 12, 14, 'lm-door', 4)].concat(flag(60, 33, 46)) };
  }
}
/* the building itself, at its stage. mode 'all' draws every part (the comic panel inks a full drawing stage by stage) */
function lmBuilding(sil, stage, G, o) {
  o = o || {};
  const B = lmParts(sil, G), out = [];
  const tag = (p, extra) => p.d.replace(/^<(\w+)/, `<$1 class="lm-p ${p.c}${p.s === stage && !o.noNew ? ' lm-new' : ''}${extra || ''}"`);
  /* what is still to come, as a dashed outline */
  if (!o.all && stage < 5 && !o.noGhost) out.push(`<g class="lm-ghost">${B.parts.filter(p => p.s > stage && /lm-wall|lm-roof/.test(p.c)).map(p => p.d).join('')}</g>`);
  if (stage >= 1) out.push(`<rect class="lm-p lm-found${stage === 1 && !o.noNew ? ' lm-new' : ''}" x="${B.x0 - 3}" y="${(G - 3).toFixed(1)}" width="${B.x1 - B.x0 + 6}" height="3.5"/>`);
  if (stage === 1 && !o.all) out.push(`<g class="lm-rebar lm-new">${[0.2, 0.4, 0.6, 0.8].map(f => { const x = (B.x0 + (B.x1 - B.x0) * f).toFixed(1); return `<line x1="${x}" y1="${G - 3}" x2="${x}" y2="${G - 9}"/>`; }).join('')}</g>`);
  for (const p of B.parts) if (o.all ? p.s <= 4 || stage >= 5 : p.s <= stage) out.push(tag(p, p.c.includes('lm-win') && stage >= 5 ? ' lit' : ''));
  /* scaffolding while the walls and roof go up */
  if (!o.all && (stage === 2 || stage === 3)) {
    const a = B.x0 - 4, b = B.x1 + 4, h = Math.min(B.h + 4, G - 4), lv = [h / 3, h * 2 / 3, h];
    out.push(`<g class="lm-scaf${stage === 2 ? ' lm-new' : ''}"><line x1="${a}" y1="${G}" x2="${a}" y2="${(G - h).toFixed(1)}"/><line x1="${b}" y1="${G}" x2="${b}" y2="${(G - h).toFixed(1)}"/>${lv.map(y => `<line x1="${a - 2}" y1="${(G - y).toFixed(1)}" x2="${b + 2}" y2="${(G - y).toFixed(1)}"/>`).join('')}<line class="lm-brace" x1="${a}" y1="${G}" x2="${b}" y2="${(G - h / 3).toFixed(1)}"/></g>`);
  }
  return { svg: out.join(''), B };
}
/* the lot's sign on the empty plot: the real share saved so far */
const lmSign = (pct, G, x) => `<g class="lm-sign"><line x1="${x}" y1="${G}" x2="${x}" y2="${G - 16}"/><rect x="${x - 13}" y="${G - 29}" width="26" height="13" rx="2"/><text x="${x}" y="${G - 19.5}" text-anchor="middle">${Math.floor(pct)}%</text></g>`;
const lmDust = G => `<g class="lm-dust">${[[44, 0], [60, 3], [76, 1], [52, -2], [68, -1]].map((p, i) => `<circle cx="${p[0]}" cy="${G - 2 + p[1] * 0.5}" r="${3 + (i % 3)}" style="--i:${i}"/>`).join('')}</g>`;
/* dark and paper: blocks in the silhouette's arrangement, drawn back to front */
const LM_ISO = {
  tower: [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3], [0, 0, 4]],
  house: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1, 'roof']],
  dome: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1, 'dome']],
  lighthouse: [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3], [0.2, 0.2, 4, 'lamp']],
  stadium: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [2, 1, 0]],
};
function lmIsoArt(sil, stage, pct) {
  const blocks = LM_ISO[sil] || LM_ISO.tower, s = 13, dx = s * 0.866, dy = s * 0.5;
  const dims = p => p[3] === 'lamp' ? [0.6, 0.8] : p[3] === 'roof' ? [2, 0.9] : p[3] === 'dome' ? [2, 1.2] : [1, 1];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of blocks) { const [w, h] = dims(p); for (const a of [p[0], p[0] + w]) for (const b of [p[1], p[1] + w]) for (const c of [p[2], p[2] + h]) { const X = (a - b) * dx, Y = (a + b) * dy - c * s; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); } }
  const ox = 60 - (x0 + x1) / 2, oy = 84 - y1, P = (a, b, c) => [(ox + (a - b) * dx).toFixed(1), (oy + (a + b) * dy - c * s).toFixed(1)];
  const pg = (cls, pts) => `<polygon class="${cls}" points="${pts.map(q => P(q[0], q[1], q[2]).join(',')).join(' ')}"/>`;
  const order = blocks.map((p, i) => ({ p, i })).sort((a, b) => a.p[2] - b.p[2] || (a.p[0] + a.p[1]) - (b.p[0] + b.p[1]));
  const parts = order.map(({ p, i }) => {
    const cls = `lm-blk${i < stage ? ' on' : ''}${i === stage - 1 ? ' lm-new' : ''}`, [w, h] = dims(p), x = p[0], y = p[1], z = p[2];
    if (p[3] === 'roof') return `<g class="${cls}">${pg('lm-it', [[0, 0, z], [2, 0, z], [2, 1, z + h], [0, 1, z + h]])}${pg('lm-il', [[0, 1, z + h], [2, 1, z + h], [2, 2, z], [0, 2, z]])}${pg('lm-ir', [[2, 0, z], [2, 2, z], [2, 1, z + h]])}</g>`;
    if (p[3] === 'dome') { const c = P(1, 1, z), r = 1.45 * dx; return `<g class="${cls}"><path class="lm-it" d="M${(+c[0] - r).toFixed(1)} ${c[1]}A${r.toFixed(1)} ${(s * 1.25).toFixed(1)} 0 0 1 ${(+c[0] + r).toFixed(1)} ${c[1]}A${r.toFixed(1)} ${(r * 0.52).toFixed(1)} 0 0 1 ${(+c[0] - r).toFixed(1)} ${c[1]}Z"/></g>`; }
    return `<g class="${cls}">${pg('lm-it', [[x, y, z + h], [x + w, y, z + h], [x + w, y + w, z + h], [x, y + w, z + h]])}${pg('lm-il', [[x, y + w, z], [x + w, y + w, z], [x + w, y + w, z + h], [x, y + w, z + h]])}${pg('lm-ir', [[x + w, y, z], [x + w, y + w, z], [x + w, y + w, z + h], [x + w, y, z + h]])}</g>`;
  }).join('');
  const top = (() => { const p = blocks[blocks.length - 1], [w, h] = dims(p); return p[3] === 'dome' ? [+P(1, 1, p[2])[0], +P(1, 1, p[2])[1] - s * 1.25] : p[3] === 'roof' ? P(1, 0.5, p[2] + h).map(Number) : P(p[0] + w / 2, p[1] + w / 2, p[2] + h).map(Number); })();
  return `<ellipse class="lm-shadow" cx="60" cy="${(84 + 2).toFixed(1)}" rx="40" ry="7"/>${parts}${stage >= 5 ? `<g class="lm-flagq"><line x1="${top[0]}" y1="${top[1]}" x2="${top[0]}" y2="${(top[1] - 11).toFixed(1)}"/><path d="M${top[0]} ${(top[1] - 11).toFixed(1)}h9l-3 3 3 3h-9z"/></g>` : ''}${stage === 0 ? `<text class="lm-pct" x="60" y="94" text-anchor="middle">${Math.floor(pct)}%</text>` : ''}`;
}
/* the whole landmark for a goal, in the look's own way */
function gLandmarkSVG(g, st, big) {
  const t = gTheme(), stage = gStage(g, st), pct = gGoalPct(g, st), sil = gSil(g.id), col = LM_PAL[gHash('ws.lc:' + g.id) % LM_PAL.length];
  const W = 120, H = 96;
  let body = '';
  if (t === 'tycoon') {
    const G = 74, b = lmBuilding(sil, stage, G);
    const cl = gHash('ws.cl:' + g.id), cx1 = 14 + cl % 30, cx2 = 70 + (cl >> 5) % 34;
    /* on the Goals page the street (sky, grass, road) is the panel's own background, so it runs unbroken past every lot */
    body = `${big ? `<rect class="lm-sky" x="0" y="0" width="${W}" height="${G + 1}"/>` : ''}<g class="lm-cloud"><ellipse cx="${cx1}" cy="14" rx="11" ry="4.5"/><ellipse cx="${cx1 + 7}" cy="11" rx="7" ry="4.5"/><ellipse cx="${cx2}" cy="24" rx="9" ry="3.5"/></g><rect class="lm-plot" x="3" y="${G}" width="114" height="9" rx="3"/><g class="lm-bush"><circle cx="10" cy="${G - 3}" r="5"/><circle cx="16" cy="${G - 2}" r="3.6"/><circle cx="110" cy="${G - 3}" r="4.4"/></g>
      ${big ? `<rect class="lm-road" x="0" y="${G + 9}" width="${W}" height="${H - G - 9}"/><line class="lm-lane" x1="0" y1="${G + 15.5}" x2="${W}" y2="${G + 15.5}"/>` : ''}
      ${stage === 0 ? lmSign(pct, G, 22) : ''}<g class="lm-bld">${b.svg}</g>${lmDust(G)}
      ${stage >= 5 ? `<g class="lm-rib"><path d="M28 ${G + 0.5}h64l-4 4.5 4 4.5H28l4-4.5z"/><text x="60" y="${G + 7.2}" text-anchor="middle">${esc(dword('Funded'))}</text></g>` : ''}`;
  } else if (t === 'heist') {
    const G = 71, b = lmBuilding(sil, stage, G);
    body = `<g class="lm-photo"><rect class="lm-paper" x="7" y="5" width="106" height="88" rx="1.5"/><rect class="lm-pic" x="12" y="10" width="96" height="64"/>
      <g class="lm-picin"><rect class="lm-gnd" x="12" y="${G}" width="96" height="3"/>${stage === 0 ? lmSign(pct, G, 26) : ''}<g class="lm-bld" transform="translate(60 ${G}) scale(.82) translate(-60 -${G})">${b.svg}</g>${lmDust(G)}</g>
      <text class="lm-cap" x="60" y="86" text-anchor="middle">SETUP ${stage}/5</text>
      ${stage >= 5 ? `<g class="lm-done"><image href="art/heist-bag.png" x="80" y="44" width="30" height="30"/><g transform="rotate(-12 60 42)"><rect x="18" y="33" width="84" height="16"/><text x="60" y="44.5" text-anchor="middle">HEIST COMPLETE</text></g></g>` : ''}</g>
      <circle class="lm-pin" cx="60" cy="7.5" r="3.6"/><circle class="lm-pin-hi" cx="59" cy="6.5" r="1.1"/>`;
  } else if (t === 'arcade') {
    const G = 76, b = lmBuilding(sil, stage, G);
    body = `<line class="lm-gline" x1="6" y1="${G}" x2="114" y2="${G}"/>${stage === 0 ? lmSign(pct, G, 22) : ''}<g class="lm-bld">${b.svg}</g>${lmDust(G)}
      <g class="lm-shards">${[0, 1, 2, 3, 4].map(i => `<path class="${i < stage ? 'on' : ''}" d="M${38 + i * 11} ${G + 6}l4 5-4 5-4-5z"/>`).join('')}</g>
      ${stage >= 5 ? `<image class="lm-crown" href="art/arcade-crown.png" x="88" y="2" width="28" height="28"/>` : ''}`;
  } else if (t === 'comic') {
    const G = 80, b = lmBuilding(sil, Math.max(stage, 4), G, { all: true });
    body = `<rect class="lm-panel" x="3" y="3" width="114" height="90"/><rect class="lm-dots" x="5" y="5" width="110" height="${G - 5}"/><line class="lm-gline" x1="3" y1="${G}" x2="117" y2="${G}"/>
      ${stage === 0 ? `${lmSign(pct, G, 60)}<text class="lm-tbc" x="60" y="30" text-anchor="middle">TO BE DRAWN...</text>` : `<g class="lm-bld">${b.svg}</g>`}${lmDust(G)}
      ${stage >= 4 ? `<g class="lm-capbox"><rect x="7" y="7" width="54" height="13"/><text x="10" y="16.5">MEANWHILE...</text></g>` : ''}
      ${stage >= 5 ? `<g class="lm-pow"><polygon points="96,6 100,14 109,11 105,19 114,23 105,26 108,35 99,31 95,39 91,31 82,34 86,26 77,22 86,19 83,11 91,14"/><text x="96" y="25.5" text-anchor="middle">POW!</text></g>` : ''}`;
  } else if (t === 'casino') {
    const G = 80, b = lmBuilding(sil, 4, G, { noGhost: true }), cols = ['#ece6d6', '#c8202f', '#188c4f', '#1c1c1f', '#6d35c9'];
    const stack = i => { const cx = 20 + i * 20, n = 3 + i * 2, on = i < stage; let s = ''; if (!on) return `<ellipse class="lm-spot" cx="${cx}" cy="86" rx="8" ry="3"/>`;
      for (let k = 0; k < n; k++) { const y = 86 - k * 3; s += `<g class="lm-chip" style="--c:${cols[i]}"><rect x="${cx - 8}" y="${y - 3}" width="16" height="3"/><ellipse cx="${cx}" cy="${y - 3}" rx="8" ry="2.8"/></g>`; }
      return `<g class="lm-stack${i === stage - 1 ? ' lm-new' : ''}">${s}</g>`; };
    body = `<rect class="lm-felt" x="2" y="4" width="116" height="90" rx="10"/><g class="lm-etch" transform="translate(60 ${G}) scale(.9) translate(-60 -${G})">${b.svg}</g>
      ${[0, 1, 2, 3, 4].map(stack).join('')}${stage >= 5 ? `<image class="lm-gem" href="art/casino-gem.png" x="44" y="2" width="32" height="32"/>` : ''}${lmDust(84)}`;
  } else if (t === 'passbook') {
    const G = 62, b = lmBuilding(sil, 4, G, { noGhost: true, noNew: true });
    body = `<rect class="lm-cert" x="4" y="5" width="112" height="86"/><rect class="lm-cert-in" x="8" y="9" width="104" height="78"/>
      <path class="lm-guil" d="M12 22 ${Array.from({ length: 12 }, (_, i) => `q4 ${i % 2 ? 4 : -4} 8 0`).join(' ')}"/><text class="lm-cert-t" x="60" y="18" text-anchor="middle">SAVINGS BOND</text>
      <g class="lm-etch" transform="translate(60 ${G}) scale(.62) translate(-60 -${G})">${b.svg}</g><line class="lm-cert-g" x1="26" y1="${G + 0.5}" x2="94" y2="${G + 0.5}"/>
      <g class="lm-stamps">${[0, 1, 2, 3, 4].map(i => `<g class="${i < stage ? 'on' : ''}${i === stage - 1 ? ' lm-new' : ''}"><circle cx="${26 + i * 17}" cy="76" r="6.4"/>${i < stage ? `<text x="${26 + i * 17}" y="78.6" text-anchor="middle">${i + 1}</text>` : ''}</g>`).join('')}</g>
      ${stage >= 5 ? `<g class="lm-matured" transform="rotate(-16 60 46)"><rect x="20" y="36" width="80" height="19" rx="2"/><rect class="lm-m2" x="22.5" y="38.5" width="75" height="14" rx="1"/><text x="60" y="50" text-anchor="middle">MATURED</text></g>` : ''}`;
  } else {
    /* dark and paper: minimal isometric blocks, one per stage; the ones to come as an outline */
    body = lmIsoArt(sil, stage, pct);
  }
  const title = `${g.name}: stage ${stage} of 5 ${DOT} ${gMoney(gGoalSaved(g, st))} of ${gMoney(g.target)}${g.kind === 'net' ? ' as is' : ''}`;
  return `<span class="gm-lm gm-lm-${sil} gm-st${stage}${big ? ' big' : ''}" data-gid="${esc(g.id)}" data-sil="${sil}" data-stage="${stage}" style="--lm-c:${col}" title="${esc(title)}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${body}</svg></span>`;
}
/* five stage pips: the table, the Overview's next landmark, the inspector */
const gPipsHTML = (stage, cls) => `<span class="gm-pips${stage >= 5 ? ' full' : ''}${cls ? ' ' + cls : ''}" title="Stage ${stage} of 5" aria-label="Stage ${stage} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= stage ? 'on' : ''}"></i>`).join('')}</span>`;
const LM_TITLE = { tycoon: 'Your city', heist: 'Setups', arcade: 'World map', comic: 'Panels', casino: 'Stacks', passbook: 'Certificates' };
const LM_DONE = { tycoon: 'City complete!', heist: 'Every setup done', arcade: 'World clear!', comic: 'The end!', casino: 'Full house', passbook: 'Every bond matured' };
/* the Goals page panel: one lot per goal, in the order they were added */
function gCityHTML(st, sel) {
  if (!S.goals.length) return '';
  const t = gTheme(), n = S.goals.length, built = S.goals.filter(g => st.stages[g.id] >= 5).length, stages = sum(S.goals, g => st.stages[g.id] || 0);
  const all = built === n;
  const sky = all ? `<span class="gm-sky" title="City complete: every goal built"><svg viewBox="0 0 ${Math.min(8, n) * 34 + 6} 26" aria-hidden="true">${S.goals.slice(0, 8).map((g, i) => `<g transform="translate(${i * 34 - 12} -40) scale(.45)">${lmParts(gSil(g.id), 140).parts.filter(p => /lm-wall|lm-roof|lm-trim/.test(p.c)).map(p => p.d).join('')}</g>`).join('')}</svg><b class="gm-sky-t">${esc(LM_DONE[t] || 'City complete')}</b></span>` : '';
  return `<section class="panel gm-city ${all ? 'rib-gold gm-city-done' : 'rib-green'}"><div class="panel-head"><span class="label">${esc(LM_TITLE[t] || 'Progress')}</span>${sky}<span class="muted small gm-city-n">${built} of ${n} built ${DOT} ${stages}/${n * 5} stages</span></div>
    <div class="gm-lots gm-lots-${t}">${S.goals.map(g => { const s = st.stages[g.id]; return `<button type="button" class="gm-lot dk-pin${sel === g.id ? ' on' : ''}" data-sel="${esc(g.id)}" title="${esc(g.name)}: click to select">
      ${gLandmarkSVG(g, st)}<span class="gm-lot-nm">${esc(g.name)}</span><span class="gm-lot-st">${s >= 5 ? `<b>✓ ${esc(dword('Funded'))}</b> 5/5` : `stage ${s} of 5`}</span><span class="gm-lot-v num">${gMoney(gGoalSaved(g, st))} of ${gMoney(g.target)}</span></button>`; }).join('')}</div></section>`;
}

/* ======================================================================
   debts as bosses (Accounts), assets as title deeds
   ====================================================================== */
const DEED_GROUP = { cash: 'Cash', invest: 'Investments', property: 'Property' };
function gDeedBand(a) {
  const grp = typeOf(a).group;
  const lbl = { tycoon: 'Title deed', comic: 'The stash', passbook: 'Certificate', heist: 'Asset', arcade: 'Item', casino: 'Holding' }[gTheme()] || 'Asset';
  return `<div class="gm-deed-band gm-g-${grp}"><span>${lbl}</span><span class="gm-deed-grp">${esc(DEED_GROUP[grp] || '')}</span></div>`;
}
function gHpBar(key, pct, cls) {
  return `<span class="gm-hp${cls ? ' ' + cls : ''}" data-hp="${esc(key)}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(1)}" aria-label="HP ${gPctTxt(pct)}"><i style="width:${pct.toFixed(2)}%"></i></span>`;
}
/* the total in the Debt panel head: what is still owed out of the highest total ever recorded */
function gBossTotHTML(st) {
  const d = st.debtTot;
  if (!(d.peak > 0.005)) return '';
  const txt = d.paid >= 1 ? `Paid down ${gMoney(d.paid)} of ${gMoney(d.peak)} peak` : `Debt HP ${gPctTxt(d.hp)}<span class="gm-boss-tl2"> ${DOT} every payment is a hit</span>`;
  return `<span class="gm-boss-tot" title="${esc(`The debts' HP: ${gMoney(d.owed)} owed of the ${gMoney(d.peak)} peak ${DOT} paid down ${gMoney(d.paid)} ${DOT} HP ${gPctTxt(d.hp)}`)}"><i class="gm-boss-ico" aria-hidden="true"></i>${gHpBar('total', d.hp, 'gm-hp-tot')}<span class="gm-boss-tl">${txt}</span></span>`;
}
const BOSS_WORDS = {
  tycoon: { k: 'Title deed', clear: 'Title deed', done: 'UNMORTGAGED' }, heist: { k: 'Target', clear: 'Target', done: 'TARGET ELIMINATED' }, arcade: { k: 'Boss', clear: 'Boss', done: 'BOSS DEFEATED' },
  comic: { k: 'Villain', done: 'PAID OFF!' }, casino: { k: 'House marker', done: 'MARKER SETTLED' }, passbook: { k: 'Loan ledger', done: 'PAID IN FULL' }, dark: { k: 'Debt', done: 'Paid off' },
};
function gBossHTML(a, st) {
  const d = st.debts[a.id];
  if (!d) return '';
  const t = gTheme(), W = BOSS_WORDS[t] || BOSS_WORDS.dark;
  const who = t === 'heist' ? (a.inst || a.name).toUpperCase() : a.name;
  const skull = t === 'arcade' ? '<i class="gm-skull" aria-hidden="true"></i>' : '';
  const hitLbl = x => { const f = acct(x.from); return f ? 'from ' + f.name : x.kind === 'payment' ? 'payment' : 'transfer'; };
  const hits = d.hits.length ? `<ul class="list dk-mini gm-hits">${d.hits.map(x => `<li title="${esc(x.desc)}"><span class="num muted w-date">${fmtDate(x.date, MD)}</span><span class="grow dk-ell">${esc(hitLbl(x))}</span>${t === 'comic' ? '<b class="gm-pow" aria-hidden="true">POW!</b>' : ''}<span class="num pos">${MINUS}${money(x.amount)}</span></li>`).join('')}</ul>` : `<p class="empty">No payments into it recorded yet.</p>`;
  const trail = t === 'passbook' && d.trail.length ? `<div class="gm-ledger">${d.trail.slice().reverse().map(x => `<s class="num">${money(x.before)}</s>`).join('')}<b class="num">${money(d.owed)}</b></div>` : '';
  return `<div class="dk-isec gm-boss gm-boss-${t}${d.cleared ? ' gm-cleared' : ''}" data-boss="${esc(a.id)}">
    <div class="gm-boss-top">${skull}<span class="gm-boss-k">${esc(d.cleared ? W.clear || W.k : W.k)}</span><span class="gm-boss-who dk-ell">${esc(who)}</span><span class="gm-boss-st">${!d.cleared && t === 'tycoon' ? 'MORTGAGED' : ''}</span></div>
    ${d.cleared ? `<div class="gm-boss-clear"><b>${esc(W.done)}</b><span>${esc(a.name)} owes $0 ${DOT} ${gMoney(d.peak)} paid off since the peak</span></div>` : `
    <div class="gm-boss-hp">${gHpBar('acct:' + a.id, d.hp)}<b class="gm-hp-n num">HP ${gPctTxt(d.hp)}</b></div>
    <div class="gm-boss-l">Paid down <b class="num">${gMoney(d.paid)}</b> since the peak <span class="muted">of ${gMoney(d.peak)}</span></div>
    ${d.left != null && !d.card ? `<div class="gm-boss-l gm-boss-eta" title="What is owed now over the bills that pay it each month. Interest is not counted, so it can take longer.">about <b class="num">${d.left}</b> payment${d.left === 1 ? '' : 's'} of <b class="num">${gMoney(d.monthly)}</b> to go, before interest</div>` : ''}`}
    ${trail}
    <div class="label dk-il gm-hits-l">${t === 'comic' ? 'Hits landed' : 'Last hits'}</div>${hits}
  </div>`;
}

/* ======================================================================
   juice after a change made here: coins, the PAID stamp, damage numbers, a building going up, a boss losing HP
   ====================================================================== */
/* on screen: most of it between the sticky page bar and the bottom of the window */
const gVis = el => !!el && el.getClientRects().length > 0 && (() => { const r = el.getBoundingClientRect(), top = gBarBottom(), seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, top); return r.width > 0 && r.height > 0 && seen >= Math.min(r.height * 0.75, r.height - 4) && r.right > 0 && r.left < innerWidth; })();
function gBarBottom() { const b = $('#main .dk-bar'); return b ? b.getBoundingClientRect().bottom : 0; }
const gSelEsc = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));
/* an account's row on this page: the Accounts tables or the Overview board */
function gAcctRow(id) {
  const r = $(`#main .dk-row[data-sel="${gSelEsc(id)}"]`) || $(`#main .dk-row[data-sel="a:${gSelEsc(id)}"]`);
  return gVis(r) ? r : null;
}
function gMidMain() { const m = $('#main').getBoundingClientRect(); return { left: m.left + m.width / 2 - 20, top: Math.max(gBarBottom() + 60, innerHeight * 0.42), width: 40, height: 20 }; }
/* what a local commit earned, worked out before the numbers roll so the counter can wait for the coins */
function gJuicePlan(st, prev) {
  if (!prev || !isDesk()) return null;
  const act = G.act && G.act.seq === G.seq - 1 ? G.act : { name: '' };
  const dNet = r2(st.net - prev.net), t0 = S.txns[0] || {};
  const plan = { act, dNet, dest: null, amt: 0, stamp: null, dmg: [], rose: [], cleared: [], round: !!act.round };
  /* a bill payment: how it landed against its due date */
  if (act.name === 'pay-bill' && t0.kind === 'payment') {
    const b = S.bills.find(x => x.id === act.id), k = b && Object.keys(b.paid || {}).find(k2 => b.paid[k2] && b.paid[k2].txnId === t0.id);
    const j = b && k && gJudge(b, k, b.paid[k]);
    if (j) plan.stamp = { b, k, p: b.paid[k], early: j.early, late: !j.onTime };
  }
  const late = !!(plan.stamp && plan.stamp.late);
  /* where the coins go: up the counter when the net rose, or to where the money was put to work */
  if (dNet >= 1) { plan.dest = 'net'; plan.amt = dNet; }
  else if (Math.abs(dNet) < 1) {
    if (act.name === 'transfer' && t0.kind === 'transfer') {
      const f = acct(t0.from), to = acct(t0.to);
      /* into savings or investments from outside them, or any asset paying a debt down */
      if (f && to && ((!isAsset(to) && isAsset(f)) || (isAsset(to) && SAVE_TYPES.has(to.type) && !gSaveAcct(f)))) { plan.dest = { acct: to.id }; plan.amt = +t0.amount || 0; }
    }
    else if (act.name === 'fund-goal' && t0.kind === 'goal') { plan.dest = { goal: act.id }; plan.amt = +t0.amount || 0; }
    else if (plan.stamp && !late) { const to = acct(plan.stamp.b.to), fr = acct(plan.stamp.p.from); if (to && !isAsset(to) && !(fr && !isAsset(fr))) { plan.dest = { acct: to.id }; plan.amt = +plan.stamp.p.amount || 0; } }
  }
  if (late) plan.dest = null;
  /* debts that went down, and ones that just hit $0. Only when the debts went down together: money moved from one debt
     to another (a loan paid with a card) is not a hit */
  let Lwas = 0, Lnow = 0;
  for (const a of liabilities()) { const was = prev.bal.get(a.id); if (was != null) { Lwas += was; Lnow += +a.balance || 0; } }
  for (const a of liabilities()) {
    const was = prev.bal.get(a.id);
    if (was == null) continue;
    if (a.balance < was - 0.005) { if (!late && Lnow < Lwas - 0.005) plan.dmg.push({ id: a.id, amt: r2(was - a.balance) }); if (a.balance <= 0.005 && st.debts[a.id] && st.debts[a.id].cleared) plan.cleared.push(a.id); }
  }
  for (const g of S.goals) { const was = prev.stages[g.id]; if (was != null && st.stages[g.id] > was) plan.rose.push(g.id); }
  return plan;
}
function gJuiceRun(plan, st) {
  const mo = motionOK(), act = plan.act;
  let played = false;
  /* the stamp first: it replaces the paid pop, so the payment is felt once. Late: a plain stamp, silent */
  if (plan.stamp) {
    const s = plan.stamp;
    G.skipKeys = new Set(s.late ? [] : [`paid:${s.b.id}:${s.k}`]);
    gStamp(s, st, act);
    if (!s.late) { gSound('stamp', 0); gSound('chaChing', 0.09); played = true; }
  }
  if (plan.dest) {
    let to = null, row = false;
    if (plan.dest === 'net') {
      const rail = $('#dkTicker [data-roll="rail"]'), hero = $('#main [data-roll="hero"]'), mark = $('.brand-mark');
      to = gVis(rail) ? rail : gVis(hero) ? hero : mark && mark.getClientRects().length ? mark : null;
    } else {
      const vis = el => (gVis(el) ? el : null), a = plan.dest.acct && acct(plan.dest.acct), g = plan.dest.goal && S.goals.find(x => x.id === plan.dest.goal);
      to = plan.dest.acct ? gAcctRow(plan.dest.acct) : vis($(`#main .dk-row[data-sel="${gSelEsc(plan.dest.goal)}"]`)) || vis($(`#main .gm-lot[data-sel="${gSelEsc(plan.dest.goal)}"]`));
      row = !!to;
      /* off screen: the figure that shows it on this page */
      if (!to && a && !isAsset(a)) to = vis($('#main .dk-debt-n'));
      if (!to && g) to = vis($(`#main .dk-mg[data-gid="${gSelEsc(g.id)}"]`)) || vis($('#main .dk-qw .gm-job-goal'));
      if (!to) to = vis($('#main .dk-qw .gm-job-pyf')) || vis($('#main .dk-qw .gm-qw-head'));
      if (!row && !plan.stamp && !(g && plan.rose.includes(g.id))) gWorkPop(plan, st, a, g);
    }
    if (to && mo) gCoins(act.dlg || !act.rect ? gMidMain() : act.rect, to.getBoundingClientRect(), plan.amt);
  }
  /* coin: the net rose, or money was put to work; a check-in step lands with a stamp (never when the net fell) */
  if (plan.round && plan.dNet > -0.005) gSound('stamp', 0);
  if (!played && (plan.dNet >= 1 || (plan.dest && plan.dest !== 'net'))) gSound('coin', plan.round ? 0.1 : 0);
  if (mo) for (const d of plan.dmg) gDamage(d.id, d.amt);
  if (mo) for (const id of plan.rose) document.querySelectorAll(`.gm-lm[data-gid="${gSelEsc(id)}"]`).forEach(el => el.classList.add('lm-rise'));
}
/* money put to work whose row is not on screen: one small pop with the true effect */
function gWorkPop(plan, st, a, g) {
  const pyf = st.jobs.find(j => j.id === 'pyf'), amt = gMoney(plan.amt);
  let text = a && !isAsset(a) ? `${amt} off ${a.name}` : g ? `+${amt} toward ${g.name}` : `+${amt} into ${a ? a.name : 'savings'}`;
  if (pyf) text += pyf.done ? ` ${DOT} this month's target met` : ` ${DOT} ${gMoney(Math.max(0, pyf.target - pyf.got))} to go this month`;
  G.popQ.push({ kind: 'work', snd: false, html: `<i class="fx-p-ico" aria-hidden="true"></i><span class="fx-p-body"><b class="fx-p-t">${esc(gw('work'))}</b><span class="fx-p-s">${esc(text)}</span></span>` });
  gLater(gPump, 450);
}
/* coins on an arc from the button to where the money went: 6, 8 or 10 of them by size, 700ms each, 40ms apart.
   Never while a dialog is open, and never above the top of the window. */
function gCoins(src, dst, amount) {
  if (!motionOK() || !src || !dst || $('#modalRoot').classList.contains('open')) return;
  const n = amount < 100 ? 6 : amount < 1000 ? 8 : 10, root = fxRoot();
  const sx = src.left + src.width / 2, sy = src.top + src.height / 2, dx = dst.left + dst.width / 2, dy = dst.top + dst.height / 2;
  const spreadX = Math.min(40, dst.width * 0.18), spreadY = Math.min(8, dst.height * 0.22);
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'fx-coin fx-fly';
    const jx = ((i * 37) % 21) - 10, jy = ((i * 53) % 13) - 6;
    const ex = dx + (((i * 29) % 9) - 4) / 4 * spreadX, ey = dy + (((i * 17) % 5) - 2) / 2 * spreadY;
    const lift = Math.min(170, 70 + Math.abs(ex - sx) * 0.22 + Math.max(0, sy - ey) * 0.25);
    const cx = (sx + ex) / 2 + (i % 2 ? 36 : -36), cy = Math.max(30, Math.min(sy, ey) - lift);
    const frames = [], spin = gTheme() === 'passbook' ? 0 : 540;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, q = u * u;
      const x = a * (sx + jx) + b * cx + q * ex, y = a * (sy + jy) + b * cy + q * ey;
      frames.push({ offset: u, opacity: k === 0 ? 0 : k === 12 ? 0.35 : 1, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(k === 0 ? 0.5 : k === 12 ? 0.8 : 1 + 0.25 * Math.sin(u * Math.PI)).toFixed(2)}) rotate(${Math.round(u * spin * (i % 2 ? 1 : -1))}deg)` });
    }
    root.appendChild(c);
    let an = null;
    try { an = c.animate(frames, { duration: 700, delay: i * 40, easing: 'cubic-bezier(.45, .05, .55, .95)', fill: 'both' }); } catch (e) { c.remove(); continue; }
    an.onfinish = () => c.remove();
    gLater(() => c.remove(), 700 + i * 40 + 150);
  }
}
/* the real reduction of a debt, as a hit: a small plate beside its balance that drifts along its own row, never onto the row
   above; off the page's debt total when the row is not on screen, beside the figure, which pulses as it drops */
function gDamage(id, amt) {
  const row = gAcctRow(id), tot = $('#main .dk-debt-n');
  if (!row && !gVis(tot)) return;
  const el = document.createElement('div');
  if (row) {
    const cell = row.querySelector('.dk-amt') || row.querySelector('td.r .num') || row.querySelector('td.r') || row, tr = gTextRect(cell), rr = row.getBoundingClientRect();
    el.className = 'fx-dmg fx-dmg-row';
    el.textContent = MINUS + gMoney(amt);
    el.style.cssText = `left:${(tr.left - 10).toFixed(1)}px;top:${(rr.top + rr.height / 2).toFixed(1)}px`;
  } else {
    const tr = gTextRect(tot);
    el.className = 'fx-dmg fx-dmg-stat';
    el.textContent = `${MINUS}${gMoney(amt)} debt`;
    el.style.cssText = `left:${tr.right.toFixed(1)}px;top:${(tr.top - 2).toFixed(1)}px`;   /* right-aligned over the figure, clear of its label */
    tot.classList.remove('gm-hit'); void tot.offsetWidth; tot.classList.add('gm-hit');
    gLater(() => tot.classList.remove('gm-hit'), 800);
  }
  fxRoot().appendChild(el);
  gLater(() => el.remove(), 1300);
}
/* the box a stamp may use: the element, cut off before `cut` (a row's amount, a card's button) so real figures stay in view */
function gStampBox(el, cut) {
  const r = el.getBoundingClientRect();
  let right = r.right;
  if (cut) { const c = cut.getBoundingClientRect(); if (c.width && c.left > r.left + 90) right = c.left - 8; }
  return { left: r.left, top: r.top, width: right - r.left, height: r.height };
}
/* the PAID stamp; on time, a chip with the streak follows it (one after the other, never overlapping). Late: a plain PAID.
   Where: the bill's own row if it is on screen (its Pending row, its Done row), cut off before the amount; from the keyboard
   the view follows the bill; otherwise what was clicked: the Quick Wins card, the Quick Wins head, the Up next head, the page title.
   A click never scrolls the page, and a stamp never lands on another bill. */
function gStamp(s, st, act) {
  const t = gTheme(), mo = motionOK(), id = s.b.id;
  const rows = Array.from(document.querySelectorAll('#main .dk-row')).filter(r => r.dataset.sel === 'b:' + id || r.dataset.sel === 'p:' + id || r.dataset.sel === 'b:' + id + ':' + s.k);
  let row = rows.find(r => r.dataset.sel === act.sel && gVis(r)) || rows.find(gVis) || null;
  if (!row && act.key) {
    const r = rows.find(x => x.dataset.sel === act.sel) || rows[0];
    if (r && r.getClientRects().length) { r.scrollIntoView({ block: 'nearest' }); gCursor(false); if (gVis(r)) row = r; }
  }
  let rc = null;
  if (row) rc = gStampBox(row, row.querySelector('td.r, .dk-amt'));
  else {
    const card = act.job && $(`#main .dk-qw .${act.job}`), head = $('#main .dk-qw .gm-qw-head'), title = $('#main .dk-bar .dk-title');
    /* the head of the list the paid row was in (the row itself moved on, or left the list) */
    const pnl = act.panel >= 0 ? document.querySelectorAll('#main .panel')[act.panel] : null, ph = pnl && pnl.querySelector(':scope > .panel-head');
    if (card && gVis(card)) rc = gStampBox(card, card.querySelector('.gm-job-go'));
    else if (act.job && head && gVis(head)) rc = gStampBox(head, head.querySelector('.gm-streaks'));
    else if (ph && gVis(ph)) rc = gStampBox(ph, ph.querySelector(':scope > :is(.muted, .small, .num, .link, .seg)'));
    else if (title) { const r = title.getBoundingClientRect(); rc = { left: r.left, top: r.top - 6, width: Math.max(260, r.width), height: r.height + 12 }; }
  }
  if (!rc) return;
  const streak = st.streaks.onTime.cur, paused = false, day = parseISO(s.p.date);
  const text = s.late ? 'PAID' : t === 'arcade' ? `COMBO ×${streak}` : t === 'comic' ? 'KA-CHUNK!' : t === 'passbook' ? `PAID ${DOT} ${day.getDate()} ${fmtDate(day, { month: 'short' }).toUpperCase()}` : t === 'dark' || t === 'light' ? 'Paid' : gword('paid');
  const chip = s.late ? '' : `${s.early > 0 ? s.early + (s.early === 1 ? ' DAY' : ' DAYS') + ' EARLY' : 'ON TIME'} +1 ${DOT} streak ${streak}${paused ? ' paused' : ''}`;
  const el = document.createElement('div');
  el.className = `fx-stamp${s.late ? ' late' : ''}${mo ? '' : ' fx-still'}${row ? '' : ' fx-st-off'}`;
  el.setAttribute('role', 'status');
  el.style.cssText = `left:${rc.left.toFixed(1)}px;top:${rc.top.toFixed(1)}px;width:${rc.width.toFixed(1)}px;height:${rc.height.toFixed(1)}px`;
  el.innerHTML = `<b class="fx-st-mark">${(t === 'dark' || t === 'light') && !s.late ? '<svg class="fx-st-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' : ''}<span>${esc(text)}</span></b>${chip ? `<span class="fx-st-chip">${esc(chip)}</span>` : ''}`;
  fxRoot().appendChild(el);
  gLater(() => el.classList.add('out'), s.late ? 700 : 1900);
  gLater(() => el.remove(), s.late ? 950 : 2200);
}

/* ======================================================================
   sound: one quiet synth, made on the first click or key on the desktop layout. No files.
   ====================================================================== */
const SND = { ctx: null, out: null, noise: null, counts: { coin: 0, chaChing: 0, levelUp: 0, sting: 0, stamp: 0, pop: 0, hop: 0 }, last: {} };
const gSoundOn = () => gGet(GK.sound) !== 'off';
function gAudioWake() {
  if (!isDesk() || !gSoundOn()) return;   /* muted: no context, no audio thread */
  if (!SND.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { SND.ctx = new AC(); SND.out = SND.ctx.createGain(); SND.out.gain.value = 0.06; SND.out.connect(SND.ctx.destination); } catch (e) { SND.ctx = null; return; }
  }
  if (SND.ctx.state === 'suspended') { try { SND.ctx.resume().catch(() => {}); } catch (e) {} }
}
document.addEventListener('pointerdown', gAudioWake, true);
document.addEventListener('keydown', gAudioWake, true);
const mhz = m => 440 * Math.pow(2, (m - 69) / 12);
/* a voice: an oscillator through an optional filter and an envelope into the master */
function sv(t, f, d, o) {
  o = o || {};
  const c = SND.ctx, osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.gl || d));
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + d + 0.05); }
  const peak = o.g == null ? 0.5 : o.g, a = o.a || 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let node = osc;
  if (o.lp || o.bp || o.hp) { const fl = c.createBiquadFilter(); fl.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass'; fl.frequency.setValueAtTime(o.lp || o.bp || o.hp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + d * 0.7); fl.Q.value = o.q || 0.8; osc.connect(fl); node = fl; }
  node.connect(g); g.connect(SND.out); osc.start(t); osc.stop(t + d + 0.03);
}
/* a noise burst, filtered: clicks, clacks, thumps */
function sn(t, d, o) {
  o = o || {};
  const c = SND.ctx;
  if (!SND.noise) { const len = Math.floor(c.sampleRate * 0.5), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0); let s = 1; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; ch[i] = (s / 2147483647) * 2 - 1; } SND.noise = buf; }
  const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = SND.noise; fl.type = o.type || 'bandpass'; fl.frequency.value = o.f || 2000; fl.Q.value = o.q || 1;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.g == null ? 0.5 : o.g, t + (o.a || 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(fl); fl.connect(g); g.connect(SND.out); src.start(t); src.stop(t + d + 0.02);
}
const bell = (t, m, d, g) => { const f = mhz(m); sv(t, f, d, { g }); sv(t, f * 2.76, d * 0.55, { g: g * 0.28 }); sv(t, f * 5.4, d * 0.28, { g: g * 0.12 }); };
const mar = (t, m, d, g) => { const f = mhz(m); sv(t, f, d, { g, a: 0.003 }); sv(t, f * 4, d * 0.22, { g: g * 0.3, a: 0.002 }); };
const thud = (t, g) => { sv(t, 140, 0.2, { g: g || 0.8, f2: 55, gl: 0.16 }); sn(t, 0.08, { type: 'lowpass', f: 380, g: (g || 0.8) * 0.6 }); };
const saw = (t, m, d, g, a) => sv(t, mhz(m), d, { type: 'sawtooth', g, a: a || 0.06, lp: 260, lp2: 2400, q: 3 });
const sq = (t, m, d, g) => sv(t, mhz(m), d, { type: 'square', g: g || 0.4, a: 0.002 });
const clack = (t, g) => { sn(t, 0.035, { f: 3200, q: 4, g: g || 0.7 }); sn(t + 0.004, 0.03, { f: 1400, q: 5, g: (g || 0.7) * 0.5 }); };
const key = (t, g) => sn(t, 0.022, { type: 'highpass', f: 2600, g: g || 0.5 });
const whistle = (t, m1, m2, d, g) => sv(t, mhz(m1), d, { g: g || 0.35, f2: mhz(m2), gl: d * 0.9, vib: 7, a: 0.02 });
const chime = (t, m, d, g) => sv(t, mhz(m), d, { g: g || 0.4, a: 0.012 });
/* every look's six sounds (each under 700ms). i is the star index for the recap's single notes */
const SYNTH = {
  tycoon: {
    coin: t => { mar(t, 84, 0.22, 0.55); bell(t + 0.07, 91, 0.42, 0.45); },
    chaChing: t => { [72, 76, 79].forEach((m, i) => mar(t + i * 0.045, m + 12, 0.28, 0.45)); bell(t + 0.17, 96, 0.48, 0.5); },
    levelUp: t => { [72, 76, 79, 84].forEach((m, i) => mar(t + i * 0.09, m, 0.3, 0.6)); bell(t + 0.3, 96, 0.36, 0.3); },
    sting: t => { [79, 84, 88].forEach((m, i) => bell(t + i * 0.11, m, 0.42, 0.45)); },
    stamp: t => thud(t, 0.7),
    pop: t => sv(t, mhz(84), 0.12, { g: 0.45, f2: mhz(91), gl: 0.05 }),
    hop: t => mar(t, 91, 0.09, 0.22),
    star: (t, i) => bell(t, [84, 88, 91][i] || 96, 0.35, 0.35),
  },
  heist: {
    coin: t => { saw(t, 45, 0.5, 0.3, 0.1); saw(t, 52, 0.5, 0.22, 0.1); sv(t, 60, 0.3, { g: 0.8, f2: 40, gl: 0.25 }); },
    chaChing: t => { sv(t, 55, 0.35, { g: 0.9, f2: 38, gl: 0.3 }); [45, 52, 57].forEach(m => saw(t + 0.02, m, 0.55, 0.2, 0.08)); sn(t + 0.18, 0.05, { f: 5000, q: 2, g: 0.25 }); },
    levelUp: t => { [57, 60, 64, 69].forEach((m, i) => saw(t + i * 0.1, m, 0.28, 0.24, 0.03)); sv(t, 55, 0.45, { g: 0.85, f2: 36, gl: 0.4 }); },
    sting: t => { [57, 60, 64].forEach((m, i) => saw(t + i * 0.12, m, 0.4, 0.25, 0.05)); sv(t, 45, 0.5, { g: 0.6 }); },
    stamp: t => { sv(t, 70, 0.22, { g: 0.95, f2: 40, gl: 0.2 }); sn(t, 0.1, { type: 'lowpass', f: 240, g: 0.6 }); },
    pop: t => saw(t, 64, 0.14, 0.45, 0.01),
    star: (t, i) => saw(t, [57, 60, 64][i] || 69, 0.3, 0.42, 0.02),
  },
  arcade: {
    coin: t => { sq(t, 83, 0.07); sq(t + 0.07, 88, 0.22); },
    chaChing: t => { [84, 88, 91, 96].forEach((m, i) => sq(t + i * 0.04, m, 0.1, 0.36)); sq(t + 0.16, 100, 0.2, 0.28); },
    levelUp: t => { [72, 76, 79, 84].forEach((m, i) => sq(t + i * 0.075, m, 0.09)); sq(t + 0.3, 88, 0.26, 0.34); },
    sting: t => { [79, 84, 88].forEach((m, i) => sq(t + i * 0.09, m, 0.11)); },
    stamp: t => { sn(t, 0.06, { type: 'lowpass', f: 1200, g: 0.6 }); sv(t, 110, 0.12, { type: 'square', g: 0.32, f2: 55, gl: 0.1 }); },
    pop: t => sv(t, 880, 0.08, { type: 'square', g: 0.3, f2: 1760, gl: 0.05 }),
    star: (t, i) => sq(t, [84, 88, 91][i] || 96, 0.1, 0.32),
  },
  comic: {
    coin: t => { whistle(t, 74, 91, 0.2); sv(t + 0.2, 420, 0.07, { g: 0.5, f2: 140, gl: 0.06 }); },
    chaChing: t => { whistle(t, 72, 96, 0.22); sv(t + 0.22, 520, 0.07, { g: 0.5, f2: 160, gl: 0.06 }); sv(t + 0.32, 620, 0.07, { g: 0.45, f2: 180, gl: 0.06 }); },
    levelUp: t => { [72, 76, 79, 84].forEach((m, i) => whistle(t + i * 0.1, m - 2, m, 0.1, 0.3)); sv(t + 0.42, 520, 0.08, { g: 0.45, f2: 150, gl: 0.07 }); },
    sting: t => { [79, 84, 88].forEach((m, i) => whistle(t + i * 0.12, m - 1, m, 0.14, 0.3)); },
    stamp: t => { sv(t, 240, 0.18, { g: 0.6, f2: 80, gl: 0.16 }); sn(t, 0.04, { f: 900, q: 1, g: 0.35 }); },
    pop: t => { sv(t, 480, 0.07, { g: 0.5, f2: 150, gl: 0.06 }); sn(t, 0.02, { f: 2500, g: 0.2 }); },
    star: (t, i) => whistle(t, ([79, 84, 88][i] || 91) - 1, [79, 84, 88][i] || 91, 0.12, 0.28),
  },
  casino: {
    coin: t => { clack(t); clack(t + 0.06, 0.5); bell(t + 0.1, 88, 0.4, 0.35); },
    chaChing: t => { clack(t); clack(t + 0.05, 0.55); bell(t + 0.1, 84, 0.45, 0.4); bell(t + 0.2, 91, 0.45, 0.4); },
    levelUp: t => { [84, 88, 91, 96].forEach((m, i) => bell(t + i * 0.09, m, 0.32, 0.38)); clack(t, 0.4); },
    sting: t => { [88, 91, 96].forEach((m, i) => bell(t + i * 0.11, m, 0.36, 0.38)); },
    stamp: t => { sn(t, 0.06, { f: 900, q: 3, g: 0.7 }); thud(t, 0.45); },
    pop: t => clack(t, 1),
    star: (t, i) => bell(t, [88, 91, 96][i] || 100, 0.3, 0.32),
  },
  passbook: {
    coin: t => { key(t); bell(t + 0.04, 96, 0.3, 0.28); },
    chaChing: t => { key(t); key(t + 0.07); bell(t + 0.12, 95, 0.55, 0.42); },
    levelUp: t => { [0, 1, 2, 3].forEach(i => { key(t + i * 0.08, 0.4); chime(t + i * 0.08, [72, 76, 79, 84][i], 0.18, 0.2); }); bell(t + 0.34, 95, 0.34, 0.35); },
    sting: t => { [91, 95, 98].forEach((m, i) => bell(t + i * 0.11, m, 0.32, 0.3)); },
    stamp: t => { sn(t, 0.12, { type: 'lowpass', f: 320, g: 0.8 }); sv(t, 90, 0.14, { g: 0.6, f2: 55, gl: 0.12 }); },
    pop: t => key(t, 0.55),
    star: (t, i) => bell(t, [91, 95, 98][i] || 100, 0.28, 0.28),
  },
  dark: {
    coin: t => chime(t, 84, 0.4),
    chaChing: t => { chime(t, 81, 0.4, 0.3); chime(t + 0.06, 88, 0.45, 0.35); },
    levelUp: t => { [72, 76, 79, 84].forEach((m, i) => chime(t + i * 0.1, m, 0.3, 0.32)); },
    sting: t => { [79, 84, 88].forEach((m, i) => chime(t + i * 0.12, m, 0.34, 0.3)); },
    stamp: t => sv(t, 196, 0.1, { g: 0.3, f2: 150, gl: 0.08 }),
    pop: t => chime(t, 91, 0.16, 0.26),
    star: (t, i) => chime(t, [84, 88, 91][i] || 96, 0.28, 0.28),
  },
};
SYNTH.light = SYNTH.dark;
/* play one, if the desktop layout is up, sound is on and the context has been woken by a click or key; counted for the tests */
function gSound(name, delay, i) {
  if (!isDesk() || !gSoundOn() || !SND.ctx || SND.ctx.state !== 'running') return false;
  const kit = SYNTH[gTheme()] || SYNTH.dark, fn = name === 'star' ? kit.star : kit[name];
  if (!fn) return false;
  const now = performance.now();
  if (name !== 'star' && SND.last[name] && now - SND.last[name] < 60) return false;   /* the same sound twice at once plays once */
  SND.last[name] = now;
  try { fn(SND.ctx.currentTime + 0.01 + (delay || 0), i || 0); } catch (e) { return false; }
  const k = name === 'star' ? 'sting' : name;
  SND.counts[k] = (SND.counts[k] || 0) + 1;
  gSoundHint();
  return true;
}
/* the first sound in a browser says how to turn it off, once */
function gSoundHint() {
  if (SND.hinted) return;
  SND.hinted = true;
  if (gGet(GK.seen) == null) { SND.hinted = false; return; }   /* the first run has not recorded its moments yet */
  if (gSeen().includes('hint:sound')) return;
  gMarkSeen(['hint:sound']);
  G.popQ.push({ kind: 'hint', html: `<i class="fx-p-ico fx-p-snd" aria-hidden="true"></i><span class="fx-p-body"><b class="fx-p-t">Sound on</b> <span class="fx-p-s">${DOT} press M to mute</span></span>` });
  gLater(gPump, 700);
}
const SPK = on => `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor" stroke-width="1.2"/>${on ? '<path d="M13.2 7.3a4 4 0 0 1 0 5.4M15.4 5.2a7 7 0 0 1 0 9.6"/>' : '<path d="M13.5 7.5l5 5M18.5 7.5l-5 5"/>'}</svg>`;
function gSoundBtn() {
  const foot = $('.side-foot');
  let b = $('.side-foot .gm-snd-btn');
  if (!isDesk()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button');
    b.type = 'button'; b.className = 'link desk-only gm-snd-btn'; b.dataset.action = 'gm-sound';
    const after = $('.side-foot .gm-tro-btn') || $('.side-foot .help');
    if (after) after.after(b); else foot.appendChild(b);
  } else { const tro = $('.side-foot .gm-tro-btn'); if (tro && b.previousElementSibling !== tro) tro.after(b); }
  const on = gSoundOn(), t = on ? 'Sound on · M' : 'Sound off · M';
  if (b.dataset.on !== String(on)) { b.innerHTML = SPK(on); b.dataset.on = String(on); }
  b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = t; b.setAttribute('aria-label', t);
  b.classList.toggle('off', !on);
}
function gToggleSound() {
  if (!isDesk()) return;
  const on = !gSoundOn();
  gSet(GK.sound, on ? 'on' : 'off');
  if (!on && SND.ctx) { try { SND.ctx.suspend().catch(() => {}); } catch (e) {} }   /* muted: the audio thread rests too */
  gSoundBtn();
  toast(on ? 'Sound on' : 'Sound off');
  if (on) { gAudioWake(); gSound('pop'); }
}

/* ======================================================================
   welcome back: the score since the last visit (this browser's last look, kept under ws.game.last)
   ====================================================================== */
function gWriteVisit() {
  if (!isDesk() || !S.accounts.length) return;
  const net = r2(totals().N);
  gSet(GK.last, JSON.stringify({ t: new Date().toISOString(), net, lvl: level(net) }));
}
window.addEventListener('pagehide', gWriteVisit);
document.addEventListener('visibilitychange', () => { if (document.hidden) gWriteVisit(); });
const gDayName = d => d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + fmtDate(d, MD);
function gWelcome(st) {
  const last = G.lastVisit;
  if (!last || !S.accounts.length || !isDesk() || $('#modalRoot').classList.contains('open')) return;
  const lt = Date.parse(last.t), was = +last.net;
  if (!isFinite(lt) || !isFinite(was)) return;
  const since = S.txns.filter(t => Date.parse(t.date) > lt), diff = r2(st.net - was);
  if (!(Date.now() - lt >= 36e5 && (Math.abs(diff) >= 1 || since.length))) return;
  const t = gTheme(), up = diff >= 1, down = diff <= -1, ld = new Date(lt), amt = gMoney(Math.abs(diff));
  const ago = Math.round((parseISO(todayStr()) - parseISO(localISO(ld))) / 864e5);
  const line = up ? (t === 'tycoon' ? `since ${gDayName(ld)}` : t === 'heist' ? '' : `up ${amt} since ${gDayName(ld)}`) : down && t === 'heist' ? '' : down ? `Down ${amt} since ${ago <= 6 ? ld.toLocaleDateString('en-US', { weekday: 'long' }) : fmtDate(ld, MD)}${since.length ? '' : ` ${DOT} markets move`}` : `${gMoney(st.net)}, the same as ${gDayName(ld)}`;
  /* only true lines: what changed, bills paid on time, a level reached, what is due today */
  const lines = [];
  if (since.length) lines.push(`${since.length} change${since.length === 1 ? '' : 's'} recorded since then`);
  const paidOn = st.pays.filter(e => { if (!e.onTime) return false; const b = S.bills.find(x => x.id === e.id), p = b && b.paid[e.key], tx = p && p.txnId && S.txns.find(x => x.id === p.txnId); return tx ? Date.parse(tx.date) > lt : e.date > localISO(ld); }).length;
  if (paidOn) lines.push(`${paidOn} bill${paidOn === 1 ? '' : 's'} paid on time`);
  if (isFinite(+last.lvl) && st.level > +last.lvl) lines.push(`${gLvl(st.level)} reached`);
  const today = billsDue(0).filter(x => x.days === 0);
  if (today.length) lines.push(`${today[0].bill.name}${today.length > 1 ? ` and ${today.length - 1} more` : ''} due today`);
  const head = { heist: 'WELCOME BACK', arcade: 'CONTINUE?', comic: 'Previously, on Wall Street...', casino: 'Welcome back to the table', passbook: 'Balance brought forward' }[t] || gword('welcome');
  const sub = t === 'heist' ? (up || down ? `${dword('Net worth')} ${up ? '+' : MINUS}${amt} since ${gDayName(ld)} ${DOT} ${gLvl(st.level)}` : gLvl(st.level)) : t === 'arcade' ? `PLAYER 1 ${DOT} ${gLvl(st.level)}` : t === 'passbook' ? `${gMoney(was)} ${ARROW} ${gMoney(st.net)}` : '';
  const art = t === 'passbook' ? `<span class="fx-wb-date">${fmtDate(ld, MD).toUpperCase()}</span>` : t === 'tycoon' || t === 'casino' ? '<span class="fx-wb-art" aria-hidden="true"></span>' : '';
  const el = document.createElement('div');
  el.className = `fx-moment fx-wb-wrap fx-wb-${up ? 'up' : down ? 'down' : 'flat'}${motionOK() ? '' : ' fx-still'}`;
  const mr = $('#main').getBoundingClientRect(), slot = gQuiet() ? gBarSlot(420) : null;
  el.style.cssText = `left:${mr.left.toFixed(0)}px;width:${mr.width.toFixed(0)}px;visibility:hidden`;
  /* the card never sits on a click target: only its button takes one; any click or key elsewhere lets it go */
  el.innerHTML = `<div class="fx-wb" role="status">${art}<div class="fx-wb-main"><div class="fx-wb-title">${esc(head)}</div>${sub ? `<div class="fx-wb-sub">${esc(sub)}</div>` : ''}
    ${up && t !== 'heist' ? `<div class="fx-wb-amt num">+${amt}</div>` : ''}${line ? `<div class="fx-wb-line">${esc(line)}</div>` : ''}${lines.length ? `<ul class="fx-wb-list">${lines.slice(0, 3).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>
    ${t === 'tycoon' ? `<button type="button" class="btn btn-primary fx-wb-go fx-live">${up ? 'Collect' : 'Continue'}</button>` : ''}${t === 'arcade' ? '<i class="fx-wb-scan" aria-hidden="true"></i>' : ''}</div>`;
  fxRoot().appendChild(el);
  /* where: never on the hero's number (it is counting up from the last visit right now), the As is switch or the bar's buttons.
     Dark and paper: one slim line in the page bar's empty middle. The others: over the chart, else under the hero or summary strip */
  if (slot && slot.width >= 420) {
    el.classList.add('fx-in-bar'); el.style.cssText = `left:${slot.left.toFixed(0)}px;width:${slot.width.toFixed(0)}px;--fx-top:${(slot.mid - el.querySelector('.fx-wb').offsetHeight / 2).toFixed(0)}px`;
    /* one line: the facts that do not fit whole are left out, never cut */
    const ul = el.querySelector('.fx-wb-list'), ln = el.querySelector('.fx-wb-line');
    while (ul && ul.children.length && ul.scrollWidth > ul.clientWidth + 1) ul.lastElementChild.remove();
    if (ul && (!ul.children.length || (ln && ln.scrollWidth > ln.clientWidth + 1))) ul.remove();
  }
  else {
    const card = el.querySelector('.fx-wb'), h = card.offsetHeight, ch = $('#main .dk-chart'), num = $('#main [data-roll="hero"]');
    const floor = num && num.getClientRects().length ? num.getBoundingClientRect().bottom + 10 : gBarBottom() + 14;
    const cr = ch && ch.getClientRects().length ? ch.getBoundingClientRect() : null;
    if (cr && cr.top > gBarBottom() && cr.top + 44 + h < innerHeight + 40) el.style.cssText = `left:${(cr.left + 8).toFixed(0)}px;width:${(cr.width - 16).toFixed(0)}px;--fx-top:${Math.max(floor, Math.min(cr.top + 44, innerHeight - h - 12)).toFixed(0)}px`;
    else el.style.cssText = `left:${mr.left.toFixed(0)}px;width:${mr.width.toFixed(0)}px;--fx-top:${Math.max(floor, gFxBelow(h)).toFixed(0)}px`;
  }
  const go = el.querySelector('.fx-wb-go');
  if (go && up) go.addEventListener('pointerdown', () => {
    const rail = $('#dkTicker [data-roll="rail"]'), hero = $('#main [data-roll="hero"]'), to = gVis(rail) ? rail : gVis(hero) ? hero : null;
    if (to && motionOK()) { gCoins(go.getBoundingClientRect(), to.getBoundingClientRect(), diff); gLater(() => gPickup(diff), 600); }
    gSound('coin');
  });
  G.big = el;
  el.__t = gLater(() => gBigEnd(el), 6000);
  if (up) gSound('coin');
  gWriteVisit();
}

/* ======================================================================
   the game menu: a cursor that slides between rows, the active page sliding in the rail, key prompts that light up
   ====================================================================== */
let gCur = null, gCurRaf = 0;
function gCursor(anim) {
  if (!isDesk()) { if (gCur) gCur.classList.remove('on'); return; }
  if (!gCur) { gCur = document.createElement('div'); gCur.className = 'desk-only dk-cursor'; gCur.setAttribute('aria-hidden', 'true'); document.body.appendChild(gCur); }
  const c = gCur, row = $('#main .dk-row.sel');
  if (!row || !row.getClientRects().length) { c.classList.remove('on'); return; }
  const r = row.getBoundingClientRect();
  if (!anim || !c.classList.contains('on')) c.classList.add('dk-cur-now');
  c.style.width = r.width.toFixed(1) + 'px'; c.style.height = r.height.toFixed(1) + 'px';
  c.style.transform = `translate(${(r.left + scrollX).toFixed(1)}px, ${(r.top + scrollY).toFixed(1)}px)`;
  c.dataset.kind = row.tagName === 'TR' ? 'tr' : 'li';
  c.classList.add('on');
  gCursorClip(row, r);
  if (c.classList.contains('dk-cur-now')) { void c.offsetWidth; c.classList.remove('dk-cur-now'); }
}
/* what is hidden under the sticky bar, a stuck table head or the edge of a scroll box stays hidden */
function gCursorClip(row, r) {
  let top = gBarBottom(), bot = innerHeight;
  const tb = row.closest('table'), th = tb && tb.tHead;
  /* the stuck part is the head's cells (the th is sticky, the thead keeps its own place) */
  if (th) { const hc = th.rows[0] && th.rows[0].cells[0], hr = (hc || th).getBoundingClientRect(); if (hr.bottom > top && hr.top <= r.top + 1) top = Math.max(top, hr.bottom); }
  const sc = row.closest('.dk-scroll');
  if (sc) { const sr = sc.getBoundingClientRect(); top = Math.max(top, sr.top); bot = Math.min(bot, sr.bottom); }
  const a = Math.max(0, top - r.top), b = Math.max(0, r.bottom - bot);
  gCur.style.clipPath = a || b ? `inset(${a.toFixed(1)}px -60px ${b.toFixed(1)}px -60px)` : '';
  gCur.classList.toggle('hid', a + b >= r.height - 1);
}
document.addEventListener('scroll', e => {
  if (!gCur || !isDesk() || !gCur.classList.contains('on')) return;
  const inner = e.target && e.target !== document && e.target.classList && e.target.classList.contains('dk-scroll');
  cancelAnimationFrame(gCurRaf);
  gCurRaf = requestAnimationFrame(() => { const row = $('#main .dk-row.sel'); if (!row) return; if (inner) gCursor(false); else gCursorClip(row, row.getBoundingClientRect()); });
}, true);
window.addEventListener('resize', debounce(() => { if (isDesk()) gCursor(false); else if (gCur) gCur.classList.remove('on'); }, 60));
/* the rail: the active page's highlight slides from the old item to the new one */
function gNavSlide(from) {
  const nav = $('#nav'), to = $('#nav .nav-item.on');
  if (!from || !to || !motionOK() || !isDesk()) return;
  const nr = nav.getBoundingClientRect(), tr = to.getBoundingClientRect();
  if (Math.abs(tr.top - from.top) < 1 && Math.abs(tr.left - from.left) < 1) return;
  const cs = getComputedStyle(to), gh = document.createElement('i');
  gh.className = 'dk-nav-ghost';
  const bd = side => `border-${side}:${cs['border' + side[0].toUpperCase() + side.slice(1) + 'Width']} ${cs['border' + side[0].toUpperCase() + side.slice(1) + 'Style']} ${cs['border' + side[0].toUpperCase() + side.slice(1) + 'Color']}`;
  gh.style.cssText = `left:${(from.left - nr.left).toFixed(1)}px;top:${(from.top - nr.top).toFixed(1)}px;width:${from.width.toFixed(1)}px;height:${from.height.toFixed(1)}px;background-color:${cs.backgroundColor};background-image:${cs.backgroundImage};${['top', 'right', 'bottom', 'left'].map(bd).join(';')};border-radius:${cs.borderRadius};box-shadow:${cs.boxShadow}`;
  nav.prepend(gh);
  to.classList.add('dk-nav-arrive');
  void gh.offsetWidth;
  gh.style.transform = `translate(${(tr.left - from.left).toFixed(1)}px, ${(tr.top - from.top).toFixed(1)}px)`;
  gh.style.width = tr.width.toFixed(1) + 'px'; gh.style.height = tr.height.toFixed(1) + 'px';
  setTimeout(() => { gh.remove(); to.classList.remove('dk-nav-arrive'); }, 200);
}
/* controller prompts: the key's own label lights up for 250ms when its shortcut runs */
function gFlash(k) {
  if (!isDesk()) return;
  G.flash = { k: String(k), until: performance.now() + 250 };
  gFlashApply();
}
function gFlashApply() {
  const f = G.flash;
  if (!f) return;
  const left = f.until - performance.now();
  if (left <= 0) { G.flash = null; document.querySelectorAll('.dk-flash').forEach(e => e.classList.remove('dk-flash')); return; }
  let els;
  if (/^[1-6]$/.test(f.k)) els = [$(`#nav .nav-item[href="#${VIEWS[+f.k - 1].id}"] .dk-k`)];
  else { const want = f.k === 'Enter' ? 'Enter' : f.k.toUpperCase(); els = Array.from(document.querySelectorAll('.dk-kbd')).filter(e => e.textContent.trim() === want && !e.closest('#modalRoot')); }
  els.forEach(e => { if (e && e.getClientRects().length) e.classList.add('dk-flash'); });
  clearTimeout(G.flashT);
  G.flashT = setTimeout(() => { document.querySelectorAll('.dk-flash').forEach(e => e.classList.remove('dk-flash')); G.flash = null; }, left);
}

/* ======================================================================
   after every desktop render (part 3): hp bars that drain, the cursor, the flash; the state to diff the next commit against
   ====================================================================== */
function gHpAfter(root, animate) {
  (root || document).querySelectorAll('.gm-hp[data-hp]').forEach(el => {
    const k = el.dataset.hp, i = el.querySelector('i'), now = parseFloat(i.style.width) || 0, was = G.hpShown.get(k);
    if (animate && was != null && now < was - 0.01 && motionOK()) {
      i.style.transition = 'none'; i.style.width = was.toFixed(2) + '%'; void i.offsetWidth;
      i.style.transition = ''; el.classList.add('gm-drain'); i.style.width = now.toFixed(2) + '%';
      gLater(() => el.classList.remove('gm-drain'), 700);
    }
    G.hpShown.set(k, now);
  });
}
function gRemember(st) {
  G.prev = { net: st.net, bal: new Map(S.accounts.map(a => [a.id, +a.balance || 0])), stages: Object.assign({}, st.stages) };
}
/* the inspector was redrawn for another row: bind its numbers, note its bars, keep the lots and the cursor in step */
function gInspAfter(insp) {
  gameBindRolls(insp);
  gHpAfter(insp, false);
  const k = dkSel[view];
  document.querySelectorAll('#main .gm-lot').forEach(l => l.classList.toggle('on', l.dataset.sel === k));
  gCursor(true);
}

/* ---------- chart ---------- */
function drawChart() {
  const wrap = $('#chart');
  if (!wrap) return;
  const W = Math.max(280, wrap.clientWidth - 24) || 800;
  let H = 190;
  if (isDesk() && wrap.dataset.fill) { const cs = getComputedStyle(wrap); H = Math.max(160, Math.floor(wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2)); }
  wrap.innerHTML = chartSVG(W, H, { axes: isDesk() && !!wrap.dataset.fill });
  if (isDesk()) gChartFit(wrap);
  bindChartScrub(wrap, W);
}
/* o.axes (desktop only): a value grid on the right, dates along the bottom and a soft fill under the line */
function chartSVG(W, H0, o) {
  o = o || {};
  const pts = rangeSeries(chartRange), H = H0 || 190, PL = 2, PR = o.axes ? 56 : 12, PT = 12, PB = o.axes ? 30 : 12;
  const x0 = pts[0].t, x1 = Math.max(pts[pts.length - 1].t, x0 + 1);
  let yMin = Math.min.apply(null, pts.map(p => p.v)), yMax = Math.max.apply(null, pts.map(p => p.v));
  if (yMax - yMin < 1) { const pad = Math.max(50, Math.abs(yMax) * 0.01); yMin -= pad; yMax += pad; }
  const padY = (yMax - yMin) * 0.14; yMin -= padY; yMax += padY;
  const X = t => PL + (t - x0) / (x1 - x0) * (W - PL - PR), Y = v => PT + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB);
  const P = pts.map(p => [+X(p.t).toFixed(1), +Y(p.v).toFixed(1), p.t, p.v]);
  const line = P.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const up = pts[pts.length - 1].v >= pts[0].v, base = Y(pts[0].v).toFixed(1), last = P[P.length - 1];
  let extra = '', gcls = '';
  if (o.axes) {
    const raw = (yMax - yMin) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(x => x >= raw);
    const grid = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) { const y = Y(v).toFixed(1); grid.push(`<line class="grid" x1="${PL}" x2="${W - PR + 6}" y1="${y}" y2="${y}"/><text class="ax" x="${W - 2}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${compact(v)}</text>`); }
    const intraday = chartRange === '1d', ticks = [0, 1 / 3, 2 / 3, 1].map((f, i, a) => { const t = x0 + (x1 - x0) * f, x = X(t); return `<text class="ax" x="${x.toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${i === a.length - 1 ? 'Now' : intraday ? fmtTime(t) : fmtDate(new Date(t), MD)}</text>`; });
    extra = `<defs><linearGradient id="dkArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="a0"/><stop offset="1" class="a1"/></linearGradient></defs>${grid.join('')}${ticks.join('')}<path class="area" fill="url(#dkArea)" d="${line} L${last[0]} ${H - PB} L${P[0][0]} ${H - PB} Z"/>`;
    /* the game's scoreboard, under the line: level lanes, the best close, a flag on a new record. As-is view only. */
    if (!viewAfter() && G.st) { const gl = gChartLayer({ W, H, PL, PR, PT, PB, Y, yMin, yMax, last }); extra += gl.svg; gcls = gl.cls; }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart ${up ? 'up' : 'down'}${gcls}" data-pts='${JSON.stringify(P)}'>${extra}
    <line class="base" x1="${PL}" x2="${W - PR}" y1="${base}" y2="${base}"/>
    <path d="${line}" class="line"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" class="pulse"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" class="dot"/>
    <line class="cross" x1="0" x2="0" y1="${PT - 6}" y2="${H - PB + 6}" style="display:none"/>
    <circle class="hover-dot" r="5" style="display:none"/>
  </svg><div class="chart-tip" style="display:none"></div>`;
}
/* drag a finger (or the mouse) across the line to read a moment */
function bindChartScrub(wrap, W) {
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const pts = JSON.parse(svg.dataset.pts), cross = svg.querySelector('.cross'), hd = svg.querySelector('.hover-dot'), tip = wrap.querySelector('.chart-tip');
  const first = pts[0][3], intraday = chartRange === '1d' || chartRange === '1w';
  const show = clientX => {
    const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    cross.setAttribute('x1', best[0]); cross.setAttribute('x2', best[0]); cross.style.display = '';
    hd.setAttribute('cx', best[0]); hd.setAttribute('cy', best[1]); hd.style.display = '';
    const when = new Date(best[2]), amt = best[3] - first;
    tip.innerHTML = `<span class="muted">${fmtDate(when, { month: 'short', day: 'numeric' })}${intraday ? ' ' + fmtTime(when) : ''}</span><b class="num">${money(best[3], { cents: false })}</b><span class="num ${amt > 0 ? 'pos' : amt < 0 ? 'neg' : 'muted'}">${amt > 0 ? '+' : amt < 0 ? MINUS : ''}${money(Math.abs(amt), { cents: false })}</span>`;
    tip.style.display = '';
    const px = best[0] / W * r.width;
    tip.style.left = Math.min(r.width - tip.offsetWidth, Math.max(0, px - tip.offsetWidth / 2)) + 12 + 'px';
  };
  const hide = () => { cross.style.display = 'none'; hd.style.display = 'none'; tip.style.display = 'none'; };
  let down = false;
  svg.addEventListener('pointerdown', e => { down = true; show(e.clientX); });
  svg.addEventListener('pointermove', e => { if (down || e.pointerType === 'mouse') show(e.clientX); });
  const end = () => { down = false; hide(); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('pointerleave', end);
}

/* ======================================================================
   modal, forms, confirm, toast
   ====================================================================== */
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = '<div class="modal-bg"></div><div class="modal">' + html + '</div>';
  root.classList.add('open');
  const first = root.querySelector('input:not([type=checkbox]):not([readonly]),select,textarea,button.btn-primary');
  if (first) setTimeout(() => { first.focus({ preventScroll: true }); if (first.select) first.select(); }, 0);
}
function closeModal(result) {
  const root = $('#modalRoot');
  root.classList.remove('open');
  root.innerHTML = '';
  const r = modalResolve; modalResolve = null;
  if (r && !(result && (result.ok || result.danger))) G.act = null;   /* a cancelled form never happened: it cannot colour the next change */
  if (r) r(result || { ok: false });
}

/* form({title, intro, fields, submit, danger}) -> Promise<{ok, v, danger}>
   field: {key, label, type: text|money|number|select|date|checks, value, options, required, placeholder, hint, half, min, max, step} */
function form(spec) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const html = spec.fields.map(f => {
      const id = 'f_' + f.key, req = f.required ? ' required' : '';
      let inp;
      switch (f.type) {
        case 'select':
          inp = `<select class="inp" id="${id}" name="${f.key}">${f.options.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(f.value == null ? '' : f.value) ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
        case 'checks':
          inp = `<div class="checks">${f.options.length
            ? f.options.map(o => `<label class="check"><input type="checkbox" name="${f.key}" value="${esc(o.v)}"${(f.value || []).includes(o.v) ? ' checked' : ''}><span class="grow">${esc(o.l)}</span>${o.hint ? `<span class="muted small num">${esc(o.hint)}</span>` : ''}</label>`).join('')
            : '<span class="muted small none">Nothing to choose from yet.</span>'}</div>`; break;
        case 'money':
          inp = `<div class="inp-money"><span>$</span><input class="inp num" id="${id}" name="${f.key}" type="text" inputmode="decimal" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.placeholder || '0.00')}"${req} autocomplete="off"></div>`; break;
        case 'number':
          inp = `<input class="inp num" id="${id}" name="${f.key}" type="number" value="${esc(f.value == null ? '' : f.value)}" min="${f.min == null ? '' : f.min}" max="${f.max == null ? '' : f.max}" step="${f.step == null ? 'any' : f.step}" placeholder="${esc(f.placeholder || '')}"${req}>`; break;
        case 'date':
          inp = `<input class="inp num" id="${id}" name="${f.key}" type="date" value="${esc(f.value || '')}">`; break;
        default:
          inp = `<input class="inp" id="${id}" name="${f.key}" type="text" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}"${req} autocomplete="off" maxlength="60">`;
      }
      return `<div class="field${f.half ? ' half' : ''}"><label for="${id}">${esc(f.label)}</label>${inp}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
    }).join('');
    openModal(`<form class="mform" id="mform"><h3>${esc(spec.title)}</h3>${spec.intro ? `<p class="muted small intro">${spec.intro}</p>` : ''}<div class="fields">${html}</div>
      <div class="mactions">${spec.danger ? `<button type="button" class="btn btn-ghost ${spec.dangerCls || 'danger'}" data-danger>${esc(spec.danger)}</button>` : ''}<span class="grow"><span class="desk-only dk-mkeys"><kbd class="dk-kbd">Enter</kbd> ${esc(spec.submit || 'Save').toLowerCase()} <kbd class="dk-kbd">Esc</kbd> cancel</span></span><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary">${esc(spec.submit || 'Save')}</button></div></form>`);
    $('#mform').addEventListener('submit', e => {
      e.preventDefault();
      const fm = e.target, v = {};
      for (const f of spec.fields) {
        if (f.type === 'checks') v[f.key] = Array.from(fm.querySelectorAll('input[name="' + f.key + '"]:checked')).map(i => i.value);
        else if (f.type === 'money' || f.type === 'number') v[f.key] = num(fm.elements[f.key].value);
        else v[f.key] = fm.elements[f.key].value.trim();
      }
      closeModal({ ok: true, v });
    });
  });
}
function confirmDlg(o) {
  return new Promise(resolve => {
    modalResolve = resolve;
    openModal(`<div class="mform"><h3>${esc(o.title)}</h3><p class="muted">${o.body}</p><div class="mactions"><span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(o.ok || 'Confirm')}</button></div></div>`);
  }).then(r => !!(r && r.ok));
}
function toast(msg, onTap) {
  const el = document.createElement('div');
  el.className = 'toast' + (onTap ? ' tap' : ''); el.textContent = msg;
  if (onTap) el.addEventListener('click', () => { el.remove(); onTap(); });
  $('#toastRoot').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, onTap ? 8000 : 2600);
}

/* updates: the hosted app is cached for a few minutes, so look for a newer build and pull it in.
   The running version is read off this script's own URL (app.js?v=N). */
const APP_VER = (() => { const m = ((document.currentScript && document.currentScript.src) || '').match(/[?&]v=(\d+)/); return m ? +m[1] : 0; })();
let lastUpdateCheck = 0;
async function checkUpdate(o) {
  o = o || {};
  if (!APP_VER || location.protocol === 'file:' || !navigator.onLine) return;
  if (!o.force && Date.now() - lastUpdateCheck < 60000) return;
  lastUpdateCheck = Date.now();
  try {
    const dir = location.pathname.replace(/[^/]*$/, '');
    const html = await (await fetch(dir + 'index.html', { cache: 'no-store' })).text();
    const m = html.match(/app\.js\?v=(\d+)/);
    if (!m || +m[1] <= APP_VER) return;
    const next = m[1];
    const go = () => { try { sessionStorage.setItem('ws.upd', next); } catch (e) {} location.replace(location.pathname + '?u=' + next + location.hash); };
    let tried = null; try { tried = sessionStorage.getItem('ws.upd'); } catch (e) {}
    if (o.auto && tried !== next && !$('#modalRoot').classList.contains('open')) { go(); return; }
    toast('Update ready. Tap here to refresh.', go);
  } catch (e) { /* offline or blocked: never mind */ }
}

/* ======================================================================
   field sets
   ====================================================================== */
const accountOpts = list => list.map(a => ({ v: a.id, l: a.name + ' ' + DOT + ' ' + money(a.balance) }));
const accountFields = a => {
  a = a || {};
  return [
    { key: 'name', label: 'Name', value: a.name, placeholder: 'e.g. Everyday checking', required: true },
    { key: 'inst', label: 'Institution', value: a.inst, placeholder: 'e.g. Chase', half: true },
    { key: 'type', label: 'Type', type: 'select', value: a.type || 'checking', half: true,
      options: Object.keys(TYPES).map(k => ({ v: k, l: TYPES[k].label + (TYPES[k].side === 'liability' ? ' (debt)' : '') })) },
  ].concat(a.id ? [] : [{ key: 'balance', label: 'Current balance', type: 'money', required: true, hint: 'For a card or loan, enter the amount owed.' }]);
};
const bucketFields = b => {
  b = b || {};
  return [
    { key: 'name', label: 'Bucket', value: b.name, placeholder: 'e.g. Emergency fund', required: true },
    { key: 'pct', label: 'Target share of assets (%)', type: 'number', value: b.pct == null ? '' : b.pct, min: 0, max: 100, step: 0.5, required: true },
    { key: 'accountIds', label: 'Accounts in this bucket', type: 'checks', value: b.accountIds || [],
      options: assets().map(a => { const other = S.buckets.find(x => x.id !== b.id && x.accountIds.includes(a.id)); return { v: a.id, l: a.name, hint: other ? 'in ' + other.name : money(a.balance, { cents: false }) }; }),
      hint: 'An account sits in one bucket at a time. Checking it here moves it.' },
  ];
};
const goalFields = g => {
  g = g || {};
  return [
    { key: 'name', label: 'Goal', value: g.name, placeholder: 'e.g. Japan trip', required: true },
    { key: 'kind', label: 'Progress comes from', type: 'select', value: g.kind || 'manual',
      options: [{ v: 'manual', l: 'Money I set aside for it' }, { v: 'net', l: 'My net worth' }],
      hint: 'A net worth goal moves on its own as your balances change.' },
    { key: 'target', label: 'Target', type: 'money', value: g.target == null ? '' : g.target.toFixed(2), required: true, half: true },
    { key: 'due', label: 'By when', type: 'date', value: g.due || '', half: true },
    { key: 'saved', label: 'Saved so far', type: 'money', value: g.saved == null ? '' : g.saved.toFixed(2), half: true },
    { key: 'accountId', label: 'Money sits in', type: 'select', value: g.accountId || '', half: true,
      options: [{ v: '', l: 'Not linked' }].concat(assets().map(a => ({ v: a.id, l: a.name }))) },
  ];
};
/* the goal form: hide the saved / account fields while "net worth" is picked, since they do not apply */
function wireGoalKind() {
  const k = $('#f_kind'); if (!k) return;
  const sync = () => { const net = k.value === 'net'; ['saved', 'accountId'].forEach(key => { const f = $('#f_' + key); if (f) f.closest('.field').style.display = net ? 'none' : ''; }); };
  k.addEventListener('change', sync); sync();
}
const goalFromForm = v => { const net = v.kind === 'net'; return { name: v.name, kind: net ? 'net' : 'manual', target: Math.abs(v.target), saved: net ? 0 : Math.abs(v.saved), due: v.due, accountId: net ? null : (v.accountId || null) }; };
const REPEAT_OPTS = [{ v: '', l: 'One time' }, { v: 'week', l: 'Every week' }, { v: '2weeks', l: 'Every 2 weeks' }, { v: 'month', l: 'Every month' }, { v: 'year', l: 'Every year' }];
/* the next date a repeating item is due, as the form shows it */
const billNextISO = b => { const st = billStatus(b); return localISO(st.state === 'paid' ? st.next : st.due); };
/* one form for a one-time item or a repeating one (type 'bill'): the Repeats dropdown decides which it is */
const upcomingFields = (it, type) => {
  it = it || {};
  const rep = type === 'bill', kind = rep ? 'out' : (it.kind || 'out');
  return [
    { key: 'name', label: 'What', value: it.name, placeholder: 'e.g. Car payment, new tires, tax refund', required: true },
    { key: 'kind', label: 'Direction', type: 'select', value: kind, half: true, options: [{ v: 'out', l: 'Money going out' }, { v: 'in', l: 'Money coming in' }] },
    { key: 'amount', label: 'Amount', type: 'money', value: it.amount == null ? '' : it.amount.toFixed(2), required: true, half: true },
    { key: 'repeat', label: 'Repeats', type: 'select', value: rep ? (it.every || 'month') : '', half: true, options: REPEAT_OPTS },
    { key: 'date', label: 'Expected', type: 'date', value: rep ? billNextISO(it) : (it.date || ''), half: true, hint: 'Leave it blank if you are not sure yet.' },
    { key: 'accountId', label: 'Paid from', type: 'select', value: (rep ? it.from : it.accountId) || '', half: true, options: [{ v: '', l: 'Decide later' }].concat(S.accounts.map(a => ({ v: a.id, l: a.name }))) },
    { key: 'to', label: 'Pays down', type: 'select', value: it.to || '', half: true, options: [{ v: '', l: 'Nothing' }].concat(liabilities().map(a => ({ v: a.id, l: a.name }))), hint: 'The card or loan this payment reduces.' },
    { key: 'note', label: 'Note', value: it.note, placeholder: 'optional' },
  ];
};
/* the form adapts as the dropdowns change: repeating items need a date and can pay a debt down; money in does not repeat */
function wireUpcomingForm() {
  const kind = $('#f_kind'), rep = $('#f_repeat'), date = $('#f_date'), acc = $('#f_accountId'), to = $('#f_to');
  if (!kind || !rep || !date) return;
  const field = el => el.closest('.field'), label = el => field(el).querySelector('label');
  const hint = (el, text) => { let h = field(el).querySelector('.hint'); if (!h) { h = document.createElement('div'); h.className = 'hint'; field(el).appendChild(h); } h.textContent = text; h.style.display = text ? '' : 'none'; };
  const show = (el, on) => { field(el).style.display = on ? '' : 'none'; };
  const sync = () => {
    const inn = kind.value === 'in';
    if (inn) rep.value = '';
    const r = rep.value, repeating = !inn && !!r;
    show(rep, !inn);
    hint(kind, inn ? 'Money in is one time. Regular pay lives on the Plan page.' : '');
    label(date).textContent = repeating ? 'Next due' : 'Expected';
    hint(date, repeating ? (r === 'month' ? 'It comes back on this day every month.' : 'It comes back ' + EVERY[r].toLowerCase().replace('every ', 'every ') + ' from this date.') : 'Leave it blank if you are not sure yet.');
    date.required = repeating;
    label(acc).textContent = inn ? 'Into' : 'Paid from';
    show(to, repeating);
  };
  kind.addEventListener('change', sync); rep.addEventListener('change', sync); sync();
}
/* save a repeating item from the form: a new one, an edit, or a one-time item that turned out to repeat.
   The start date only moves when the date in the form was changed, so editing a name never resets the cycle. */
function saveRepeating(v, b, u, prefill) {
  const d = v.date || todayStr(), dt = parseISO(d), fresh = !b;
  if (!b) { b = { id: uid(), paid: {} }; S.bills.push(b); }
  Object.assign(b, { name: v.name, amount: Math.abs(v.amount), every: EVERY[v.repeat] ? v.repeat : 'month', day: dt.getDate(), from: v.accountId || null, to: v.to || null, note: v.note || '' });
  if (fresh || d !== prefill) b.start = d;
  if (u) S.upcoming = S.upcoming.filter(x => x !== u);
  gTyped(); save(); render();
  toast(fresh || u ? b.name + ' repeats ' + EVERY[b.every].toLowerCase() + ', next ' + fmtDate(billNextISO(b), MD) : 'Saved');
}
const ordinal = n => (n % 10 === 1 && n !== 11) ? 'st' : (n % 10 === 2 && n !== 12) ? 'nd' : (n % 10 === 3 && n !== 13) ? 'rd' : 'th';

/* ======================================================================
   actions (data-action="...")
   ====================================================================== */
const actions = {
  help() { try { localStorage.setItem('ws.helpShown', '1'); } catch (e) {} openModal(helpHTML()); },
  async install() {
    const p = installPrompt; if (!p) return;
    installPrompt = null; p.prompt();
    const r = await p.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') closeModal(); else installPrompt = p;
  },
  'help-os'(el) { helpOS = el.dataset.os === 'android' ? 'android' : 'ios'; openModal(helpHTML()); },
  async 'copy-link'() {
    try { await navigator.clipboard.writeText(APP_URL); toast('Link copied'); }
    catch (e) { toast('Could not copy here. The link is shown above.'); }
  },
  'toggle-theme'() { openModal(looksHTML()); },
  'set-theme'(el) {
    if (!THEMES.includes(el.dataset.theme)) return;
    S.settings.theme = el.dataset.theme; save(); render();
    openModal(looksHTML()); /* keep the picker open so looks can be compared */
  },
  view(el) { S.settings.view = el.dataset.view === 'after' ? 'after' : 'now'; save(); render(); },
  range(el) { chartRange = el.dataset.range; try { localStorage.setItem('ws.range', chartRange); } catch (e) {} render(); },
  'hist-filter'(el) { histFilter = el.dataset.k; render(); },
  /* desktop only: sort a table by a column (again flips it), and the shortcut list */
  'dk-sort'(el) {
    const t = el.dataset.t, k = el.dataset.k, s = sortOf(t);
    dkSort[t] = s.k === k ? { k, dir: -s.dir } : { k, dir: +el.dataset.d || 1 };
    try { localStorage.setItem('ws.dk.sort', JSON.stringify(dkSort)); } catch (e) {}
    render();
  },
  'dk-keys'() { openModal(keysHTML()); },
  /* the game (desktop only): the check-in round, this week's jobs, trophies, a month's recap */
  'checkin-run'() { return gCheckinRun(); },
  'gm-sound'() { gToggleSound(); },
  'gm-jobs'() { if (isDesk() && S.accounts.length) openModal(gJobsDlgHTML(G.st || (G.st = gameState()))); },
  'gm-trophies'() { if (isDesk() && S.accounts.length) openModal(gTrophiesHTML(G.st || (G.st = gameState()))); },
  'gm-recap'(el) {
    if (!isDesk() || !S.accounts.length) return;
    const st = G.st || (G.st = gameState());
    let m = el && el.dataset && el.dataset.m;
    if (!m) { const done = st.months.filter(r => !r.cur && !r.skip); m = done.length ? done[done.length - 1].m : null; }
    if (!m) { toast('No finished month to look back on yet'); return; }
    gOpenRecap(m);
  },

  /* accounts */
  async 'add-account'() {
    const r = await form({ title: 'New account', fields: accountFields(), submit: 'Add account' });
    if (!r.ok) return;
    const a = { id: uid(), name: r.v.name, inst: r.v.inst, type: r.v.type, balance: Math.abs(r.v.balance), createdAt: nowISO(), updatedAt: nowISO() };
    S.accounts.push(a);
    txn({ kind: 'add', amount: isAsset(a) ? a.balance : -a.balance, to: a.id, desc: 'Added ' + a.name });
    commit(a.name + ' added');
  },
  async 'edit-account'(el) {
    const a = acct(el.dataset.id); if (!a) return;
    const r = await form({ title: 'Edit account', fields: accountFields(a), danger: 'Delete account' });
    if (r.danger) {
      const ok = await confirmDlg({ title: 'Delete ' + a.name + '?', body: 'Its ' + money(a.balance) + ' comes out of your totals. Bills and goals pointing at it are unlinked. History stays.', ok: 'Delete', danger: true });
      if (!ok) return;
      S.accounts = S.accounts.filter(x => x.id !== a.id);
      S.bills.forEach(b => { if (b.from === a.id) b.from = null; if (b.to === a.id) b.to = null; });
      S.goals.forEach(g => { if (g.accountId === a.id) g.accountId = null; });
      S.buckets.forEach(b => { b.accountIds = b.accountIds.filter(id => id !== a.id); });
      txn({ kind: 'remove', amount: isAsset(a) ? -a.balance : a.balance, from: a.id, desc: 'Removed ' + a.name });
      commit(a.name + ' removed');
      return;
    }
    if (!r.ok) return;
    Object.assign(a, { name: r.v.name, inst: r.v.inst, type: r.v.type });
    commit('Saved');
  },
  /* o.round (desktop check-in round only): { i, n, days } adds the round to the intro and a Skip button */
  async 'update-balance'(el, o) {
    const a = acct(el.dataset.id); if (!a) return;
    const debt = !isAsset(a), round = o && o.round;
    const r = await form({ title: a.name, intro: (round ? `Check-in ${round.i} of ${round.n} ${DOT} last updated ${round.days == null ? 'never' : round.days + 'd ago'} ${DOT} ` : '') + 'Now ' + money(a.balance) + (debt ? ' owed' : '') + (round ? '' : gStakes('update', a)), fields: [
      { key: 'balance', label: debt ? 'New amount owed' : 'New balance', type: 'money', value: a.balance.toFixed(2), required: true },
      { key: 'note', label: 'Note', placeholder: 'optional' },
    ], submit: 'Update', danger: round ? 'Skip' : undefined, dangerCls: round ? 'gm-skip' : undefined });
    if (round && r.danger) return 'skip';
    if (!r.ok) return round ? 'stop' : undefined;
    const nb = Math.abs(r.v.balance), delta = nb - a.balance;
    a.balance = nb; a.updatedAt = nowISO();
    txn({ kind: 'update', amount: debt ? -delta : delta, from: a.id, desc: a.name + ' set to ' + money(nb), note: r.v.note });
    if (isDesk()) G.checked.add(a.id);
    commit(a.name + ' ' + ARROW + ' ' + money(nb));
    return 'done';
  },
  async transfer(el) {
    if (S.accounts.length < 2) { toast('Add a second account first'); return; }
    const opts = accountOpts(S.accounts);
    /* the desktop detail panel can start a transfer from the account it shows (data-from); otherwise the first two accounts */
    const from0 = el && el.dataset && acct(el.dataset.from) ? el.dataset.from : opts[0].v;
    /* desktop callers (Quick Wins) can also name the account to move into and the amount */
    const to0 = el && el.dataset && acct(el.dataset.to) && el.dataset.to !== from0 ? el.dataset.to : opts.find(o => o.v !== from0).v;
    const amt0 = el && el.dataset && +el.dataset.amount > 0 ? (+el.dataset.amount).toFixed(2) : undefined;
    const r = await form({ title: 'Transfer', intro: 'Moving money into a card or loan pays it down.', fields: [
      { key: 'from', label: 'From', type: 'select', options: opts, value: from0, half: true },
      { key: 'to', label: 'To', type: 'select', options: opts, value: to0, half: true },
      { key: 'amount', label: 'Amount', type: 'money', required: true, value: amt0 },
      { key: 'note', label: 'Note', placeholder: 'optional' },
    ], submit: 'Move it' });
    if (!r.ok) return;
    const f = acct(r.v.from), t = acct(r.v.to), amt = Math.abs(r.v.amount);
    if (!f || !t || f === t || !amt) { toast('Pick two different accounts and an amount'); return; }
    applyOut(f, amt); applyIn(t, amt);
    txn({ kind: 'transfer', amount: amt, from: f.id, to: t.id, desc: f.name + ' ' + ARROW + ' ' + t.name, note: r.v.note });
    commit(money(amt) + ' moved to ' + t.name);
  },

  /* plan */
  async 'add-bucket'() {
    const r = await form({ title: 'New bucket', fields: bucketFields(), submit: 'Add bucket' });
    if (!r.ok) return;
    const b = { id: uid(), name: r.v.name, pct: r.v.pct, accountIds: r.v.accountIds };
    S.buckets.push(b); claimAccounts(b); gTyped(); save(); render(); toast(b.name + ' added');
  },
  async 'edit-bucket'(el) {
    const b = S.buckets.find(x => x.id === el.dataset.id); if (!b) return;
    const r = await form({ title: 'Edit bucket', fields: bucketFields(b), danger: 'Delete bucket' });
    if (r.danger) { S.buckets = S.buckets.filter(x => x !== b); gTyped(); save(); render(); toast(b.name + ' removed'); return; }
    if (!r.ok) return;
    Object.assign(b, { name: r.v.name, pct: r.v.pct, accountIds: r.v.accountIds });
    claimAccounts(b); gTyped(); save(); render(); toast('Saved');
  },
  'plan-template'() {
    const pick = types => assets().filter(a => types.includes(a.type)).map(a => a.id);
    S.buckets = [
      { id: uid(), name: 'Cash on hand', pct: 10, accountIds: pick(['checking', 'cash']) },
      { id: uid(), name: 'Emergency fund', pct: 25, accountIds: pick(['savings']) },
      { id: uid(), name: 'Invested', pct: 65, accountIds: pick(['brokerage', 'retirement', 'crypto']) },
    ];
    gTyped(); save(); render(); toast('Template loaded. Click a bucket to adjust it.');
  },

  /* goals */
  async 'add-goal'() {
    const p = form({ title: 'New goal', fields: goalFields(), submit: 'Add goal' }); wireGoalKind();
    const r = await p;
    if (!r.ok) return;
    const g = Object.assign({ id: uid() }, goalFromForm(r.v));
    S.goals.push(g); gTyped();
    if (g.saved) txn({ kind: 'goal', amount: g.saved, to: g.accountId, desc: money(g.saved) + ' toward ' + g.name });
    save(); render(); toast(g.name + ' added');
  },
  async 'edit-goal'(el) {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    const p = form({ title: 'Edit goal', fields: goalFields(g), danger: 'Delete goal' }); wireGoalKind();
    const r = await p;
    gTyped();
    if (r.danger) { S.goals = S.goals.filter(x => x !== g); if (S.settings.mainGoalId === g.id) S.settings.mainGoalId = null; save(); render(); toast(g.name + ' removed'); return; }
    if (!r.ok) { G.quietNext = false; return; }
    Object.assign(g, goalFromForm(r.v));
    save(); render(); toast('Saved');
  },
  'main-goal'(el) {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    S.settings.mainGoalId = g.id; gTyped(); save(); render(); toast(g.name + ' is now the main goal');
  },
  async 'fund-goal'(el) {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    if (g.kind === 'net') { toast('This goal follows your net worth. Update an account balance to move it.'); return; }
    const held = g.accountId ? acct(g.accountId) : null;
    const others = assets().filter(a => !held || a.id !== held.id);
    const fields = [{ key: 'amount', label: 'Amount', type: 'money', required: true }];
    if (held && others.length) fields.push({ key: 'from', label: 'Also move it from', type: 'select', value: '',
      options: [{ v: '', l: 'Nowhere, it is already in ' + held.name }].concat(accountOpts(others)),
      hint: 'Transfers the amount into ' + esc(held.name) + ' as well as earmarking it.' });
    const r = await form({ title: 'Add to ' + g.name, intro: money(g.saved) + ' saved of ' + money(g.target) + (held ? ' ' + DOT + ' held in ' + esc(held.name) : '') + gStakes('fund', g), fields, submit: 'Add funds' });
    if (!r.ok) return;
    const amt = Math.abs(r.v.amount); if (!amt) return;
    g.saved += amt;
    if (r.v.from) {
      const f = acct(r.v.from);
      if (f) { applyOut(f, amt); applyIn(held, amt); txn({ kind: 'transfer', amount: amt, from: f.id, to: held.id, desc: f.name + ' ' + ARROW + ' ' + held.name, note: 'for ' + g.name }); }
    }
    txn({ kind: 'goal', amount: amt, to: g.accountId, desc: money(amt) + ' toward ' + g.name });
    commit(g.saved >= g.target ? g.name + ' is funded' : money(amt) + ' toward ' + g.name);
  },

  /* upcoming: one-time items and repeating ones */
  async 'add-upcoming'() {
    const p = form({ title: 'Add to upcoming', fields: upcomingFields(), submit: 'Add' }); wireUpcomingForm();
    const r = await p; if (!r.ok) return;
    if (r.v.kind !== 'in' && r.v.repeat) { saveRepeating(r.v, null, null); return; }
    const u = { id: uid(), name: r.v.name, kind: r.v.kind === 'in' ? 'in' : 'out', amount: Math.abs(r.v.amount), date: r.v.date, accountId: r.v.accountId || null, note: r.v.note, createdAt: nowISO(), done: null };
    S.upcoming.push(u); gTyped(); save(); render(); toast(u.name + ' added');
  },
  async 'edit-upcoming'(el) {
    if (el.dataset.type === 'bill') return actions['edit-bill'](el);
    const u = S.upcoming.find(x => x.id === el.dataset.id); if (!u) return;
    const fields = u.done
      ? [{ key: 'name', label: 'What', value: u.name, required: true }, { key: 'note', label: 'Note', value: u.note, placeholder: 'optional' }]
      : upcomingFields(u);
    const p = form({ title: 'Edit', intro: u.done ? 'Already ' + (u.kind === 'in' ? 'received' : 'paid') + '. Undo it first to change the amount or account.' : '', fields, danger: 'Delete' });
    if (!u.done) wireUpcomingForm();
    const r = await p;
    if (r.ok || r.danger) gTyped();
    if (r.danger) { S.upcoming = S.upcoming.filter(x => x !== u); save(); render(); toast(u.name + ' removed'); return; }
    if (!r.ok) return;
    if (!u.done && r.v.kind !== 'in' && r.v.repeat) { saveRepeating(r.v, null, u); return; }
    if (u.done) Object.assign(u, { name: r.v.name, note: r.v.note });
    else Object.assign(u, { name: r.v.name, kind: r.v.kind === 'in' ? 'in' : 'out', amount: Math.abs(r.v.amount), date: r.v.date, accountId: r.v.accountId || null, note: r.v.note });
    save(); render(); toast('Saved');
  },
  async 'edit-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id); if (!b) return;
    const prefill = billNextISO(b);
    const p = form({ title: 'Edit', fields: upcomingFields(b, 'bill'), danger: 'Delete' }); wireUpcomingForm();
    const r = await p;
    if (r.ok || r.danger) gTyped();
    if (r.danger) { S.bills = S.bills.filter(x => x !== b); save(); render(); toast(b.name + ' removed'); return; }
    if (!r.ok) return;
    if (r.v.kind === 'in' || !r.v.repeat) {
      /* it no longer repeats: it becomes a one-time item on that date */
      S.bills = S.bills.filter(x => x !== b);
      const u = { id: uid(), name: r.v.name, kind: r.v.kind === 'in' ? 'in' : 'out', amount: Math.abs(r.v.amount), date: r.v.date, accountId: r.v.accountId || null, note: r.v.note, createdAt: nowISO(), done: null };
      S.upcoming.push(u); save(); render(); toast(u.name + ' is now a one-time item'); return;
    }
    saveRepeating(r.v, b, null, prefill);
  },
  async 'pay-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id); if (!b) return;
    const st = billStatus(b); if (st.state === 'paid') return;
    const to = acct(b.to);
    const r = await form({ title: 'Pay ' + b.name, intro: (to ? esc(to.name) + ' currently owes ' + money(to.balance) : '') + gStakes('pay', b), fields: [
      { key: 'amount', label: 'Amount', type: 'money', value: b.amount.toFixed(2), required: true, half: true },
      { key: 'date', label: 'Date', type: 'date', value: todayStr(), half: true },
      { key: 'from', label: 'From', type: 'select', value: b.from || '', options: [{ v: '', l: 'Do not touch an account' }].concat(accountOpts(S.accounts)), hint: 'Paying with a card adds to what is owed on it.' },
    ], submit: 'Mark paid' });
    if (!r.ok) return;
    const amt = Math.abs(r.v.amount), f = acct(r.v.from);
    if (f) applyOut(f, amt);
    if (to) applyIn(to, amt);
    const id = uid();
    txn({ id, kind: 'payment', amount: amt, from: f ? f.id : null, to: to ? to.id : null, desc: 'Paid ' + b.name + (f ? ' from ' + f.name : '') + (to ? ' ' + ARROW + ' ' + to.name : '') });
    b.paid[st.key] = { date: r.v.date || todayStr(), amount: amt, from: f ? f.id : null, to: to ? to.id : null, txnId: id };
    commit(b.name + ' paid');
  },
  async 'unpay-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id); if (!b) return;
    const st = billStatus(b), p = st.state === 'paid' && b.paid[st.key]; if (!p) return;
    const f = acct(p.from), t = acct(p.to);
    if (f) applyIn(f, p.amount);
    if (t) applyOut(t, p.amount);
    delete b.paid[st.key];
    txn({ kind: 'reverse', amount: p.amount, from: t ? t.id : null, to: f ? f.id : null, desc: 'Undid ' + b.name + ' payment' });
    commit(b.name + ' marked unpaid');
  },
  async 'done-upcoming'(el) {
    const u = S.upcoming.find(x => x.id === el.dataset.id); if (!u || u.done) return;
    const inn = u.kind === 'in';
    const r = await form({ title: (inn ? 'Received: ' : 'Paid: ') + u.name, fields: [
      { key: 'amount', label: 'Amount', type: 'money', value: u.amount.toFixed(2), required: true, half: true },
      { key: 'date', label: 'Date', type: 'date', value: todayStr(), half: true },
      { key: 'accountId', label: inn ? 'Into' : 'From', type: 'select', value: u.accountId || '', options: [{ v: '', l: 'Do not touch an account' }].concat(accountOpts(S.accounts)), hint: inn ? 'Money into a card or loan pays it down.' : 'Paying with a card adds to what is owed.' },
    ], submit: inn ? 'Mark received' : 'Mark paid' });
    if (!r.ok) return;
    const amt = Math.abs(r.v.amount), a = acct(r.v.accountId);
    if (a) { if (inn) applyIn(a, amt); else applyOut(a, amt); }
    const id = uid();
    txn({ id, kind: inn ? 'income' : 'expense', amount: amt, from: inn ? null : (a ? a.id : null), to: inn ? (a ? a.id : null) : null, desc: (inn ? 'Received ' : 'Paid ') + u.name + (a ? (inn ? ' into ' : ' from ') + a.name : ''), note: u.note });
    u.done = { date: r.v.date || todayStr(), amount: amt, accountId: a ? a.id : null, txnId: id };
    commit(u.name + (inn ? ' received' : ' paid'));
  },
  async 'undo-upcoming'(el) {
    const u = S.upcoming.find(x => x.id === el.dataset.id); if (!u || !u.done) return;
    const inn = u.kind === 'in', a = acct(u.done.accountId);
    if (a) { if (inn) applyOut(a, u.done.amount); else applyIn(a, u.done.amount); }
    txn({ kind: 'reverse', amount: inn ? -u.done.amount : u.done.amount, desc: 'Undid ' + u.name + (inn ? ' received' : ' paid') });
    u.done = null;
    commit(u.name + ' back to pending');
  },

  /* sync */
  async 'sync-on'() {
    if (!SYNC.url) return;
    if (sync.code) return;
    const code = newCode();
    sync.code = code; sync.version = 0; saveSync();
    await syncPush();
    if (sync.status === 'error') { sync.code = null; sync.version = 0; saveSync(); renderNav(); toast('Could not reach the cloud. Try again in a moment.'); return; }
    render();
    await confirmDlg({ title: 'Sync is on', body: 'Your code:<br><b class="num" style="font-size:18px">' + prettyCode(code) + '</b><br><br>On each other device, open History, tap "I have a code" and enter it. Keep it private: anyone who has the code can see and change these numbers.', ok: 'Got it' });
  },
  async 'sync-join'() {
    if (!SYNC.url) return;
    const r = await form({ title: 'Enter your sync code', intro: 'It is shown on the History page of the device you turned sync on with.', fields: [
      { key: 'code', label: 'Code', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', required: true },
    ], submit: 'Connect' });
    if (!r.ok) return;
    const code = normCode(r.v.code);
    if (code.length < 20) { toast('That code looks too short'); return; }
    let remote;
    try { remote = await rpc('ws_get', { code }); } catch (e) { console.warn(e); toast('Could not reach the cloud. Try again in a moment.'); return; }
    if (!remote) { toast('No ledger uses that code. Check it and try again.'); return; }
    const d = remote.data || {};
    if (!(d.accounts || []).length && S.accounts.length) {
      await confirmDlg({ title: 'That ledger is empty', body: 'The code is right, but the cloud copy has no accounts, and this device does. Nothing was changed. If your numbers are on this device, turn on sync here instead and enter the new code on the other devices.', ok: 'OK' });
      return;
    }
    if (S.accounts.length && !(await confirmDlg({ title: 'Replace what is on this device?', body: 'The synced ledger has ' + (d.accounts || []).length + ' accounts and last changed ' + fmtDate(remote.updated_at) + '. It replaces the numbers on this device. A safety copy of what is here now is kept under History, then Previous copies.', ok: 'Replace and sync', danger: true }))) return;
    sync.code = prettyCode(code);
    G.silent = true;
    adoptRemote(remote, 'Connected. Same numbers everywhere now.');
  },
  async 'sync-now'() {
    await syncPull({ force: true });
    if (sync.status !== 'error') await syncPush();
    render(); toast(sync.status === 'error' ? 'Could not reach the cloud' : 'Up to date');
  },
  async 'sync-copy'() {
    try { await navigator.clipboard.writeText(prettyCode(sync.code)); toast('Code copied'); }
    catch (e) { toast('Could not copy here. The code is shown on this page.'); }
  },
  async 'sync-off'() {
    const ok = await confirmDlg({ title: 'Turn off sync on this device?', body: 'This device keeps its numbers but stops sharing them. The cloud copy and your other devices are not affected.', ok: 'Turn off' });
    if (!ok) return;
    sync = { code: null, version: 0, last: null, status: 'idle' }; saveSync(); render(); toast('Sync is off on this device');
  },

  /* data */
  export() {
    S.settings.lastBackup = nowISO(); save();
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'wallstreet-backup-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    render(); toast('Backup downloaded');
  },
  import() { $('#importFile').click(); },
  async reset() {
    const ok = await confirmDlg({ title: 'Erase everything?', body: 'All accounts, goals, bills, upcoming, plan and history in this browser are wiped' + (sync.code ? ', and on every synced device' : '') + '. A safety copy is kept under History, then Previous copies.', ok: 'Erase', danger: true });
    if (!ok) return;
    keepCopy('before erasing');
    G.silent = true;
    const theme = S.settings.theme;
    S = fresh(); S.settings.theme = theme; shownNet = null;
    save(); render(); toast('Fresh start');
  },
  async demo() {
    if (S.accounts.length && !(await confirmDlg({ title: 'Load example data?', body: 'This replaces what is here. A safety copy is kept under History, then Previous copies.', ok: 'Load', danger: true }))) return;
    keepCopy('before example data');
    G.silent = true;
    loadDemo(); shownNet = null; save(); render(); toast('Example data loaded');
  },
  async 'restore-copy'(el) {
    const c = prevCopies()[+el.dataset.i]; if (!c) return;
    const ok = await confirmDlg({ title: 'Go back to this copy?', body: 'From ' + fmtDate(c.at) + ' ' + fmtTime(c.at) + ', ' + c.accounts + ' account' + (c.accounts === 1 ? '' : 's') + '. It replaces what is here now' + (sync.code ? ' and syncs to your other devices' : '') + '. The current numbers are kept as a copy too.', ok: 'Go back', danger: true });
    if (!ok) return;
    keepCopy('before going back');
    G.silent = true;
    S = hydrate(c.data); shownNet = null; save(); render(); toast('Restored the copy from ' + fmtDate(c.at, { month: 'short', day: 'numeric' }));
  },
};
function claimAccounts(b) { S.buckets.forEach(x => { if (x !== b) x.accountIds = x.accountIds.filter(id => !b.accountIds.includes(id)); }); }

/* made-up numbers so the layout has something to show */
function loadDemo() {
  const mk = (name, inst, type, balance) => ({ id: uid(), name, inst, type, balance, createdAt: nowISO(), updatedAt: nowISO() });
  const chk = mk('Everyday checking', 'Chase', 'checking', 3418.22);
  const sav = mk('High-yield savings', 'Ally', 'savings', 12050);
  const brk = mk('Brokerage', 'Fidelity', 'brokerage', 18742.6);
  const ira = mk('Roth IRA', 'Fidelity', 'retirement', 9310.15);
  const cc  = mk('Sapphire card', 'Chase', 'credit', 642.18);
  const car = mk('Car loan', 'Toyota Financial', 'auto_loan', 11204.5);
  const base = fresh(); base.settings.theme = S.settings.theme; S = base;
  S.accounts = [chk, sav, brk, ira, cc, car];
  S.buckets = [
    { id: uid(), name: 'Cash on hand', pct: 10, accountIds: [chk.id] },
    { id: uid(), name: 'Emergency fund', pct: 25, accountIds: [sav.id] },
    { id: uid(), name: 'Invested', pct: 65, accountIds: [brk.id, ira.id] },
  ];
  S.goals = [
    { id: uid(), name: 'Net worth to $40k', kind: 'net', target: 40000, saved: 0, due: '2027-12-31', accountId: null },
    { id: uid(), name: 'Japan, next spring', kind: 'manual', target: 4500, saved: 2050, due: '2027-03-15', accountId: sav.id },
    { id: uid(), name: 'New laptop', kind: 'manual', target: 2200, saved: 1000, due: '2026-12-01', accountId: sav.id },
    { id: uid(), name: 'Three months of expenses', kind: 'manual', target: 7500, saved: 7500, due: '', accountId: sav.id },
  ];
  S.settings.mainGoalId = S.goals[0].id;
  S.bills = [
    { id: uid(), name: 'Rent', amount: 1450, every: 'month', day: 1, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Phone', amount: 68, every: 'month', day: 8, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Gym', amount: 42, every: 'month', day: 15, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Car payment', amount: 312, every: 'month', day: 22, from: chk.id, to: car.id, paid: {} },
    { id: uid(), name: 'Sapphire card', amount: 600, every: 'month', day: 25, from: chk.id, to: cc.id, paid: {} },
    { id: uid(), name: 'Cleaner', amount: 80, every: '2weeks', day: 1, start: localISO(new Date(Date.now() + 3 * 864e5)), from: chk.id, to: null, paid: {} },
  ];
  const dd = n => localISO(new Date(Date.now() + n * 864e5));
  S.upcoming = [
    { id: uid(), name: 'Concert tickets', kind: 'out', amount: 220, date: dd(5), accountId: chk.id, note: '', createdAt: nowISO(), done: null },
    { id: uid(), name: 'Tax refund', kind: 'in', amount: 1240, date: dd(12), accountId: chk.id, note: '', createdAt: nowISO(), done: null },
    { id: uid(), name: 'New tires', kind: 'out', amount: 680, date: dd(20), accountId: cc.id, note: 'Costco', createdAt: nowISO(), done: null },
    { id: uid(), name: 'Sell the old monitor', kind: 'in', amount: 150, date: '', accountId: null, note: 'listed on Marketplace', createdAt: nowISO(), done: null },
  ];
  S.settings.income = 4800;
  const today = new Date().getDate(), key = ym();
  S.bills.forEach(b => { if (b.every === 'month' && b.day < today) b.paid[key] = { date: key + '-' + pad2(b.day), amount: b.amount, from: b.from, to: b.to }; });
  const T = totals(), NW = T.N - billsLeft(), start = Date.now() - 180 * 864e5;
  let net = NW * 0.78;
  for (let d = 0; d < 180; d += 5) {
    const goal = NW * (0.78 + 0.22 * d / 180);
    net += (goal - net) * 0.45 + (Math.random() - 0.5) * NW * 0.025;
    S.snapshots.push({ date: localISO(new Date(start + d * 864e5)), assets: net + T.L, liabilities: T.L, net, after: net });
  }
  /* the last week tick by tick, drifting toward today's number */
  S.ticks = [];
  const gap = T.N - NW; let v = net;
  for (let day = 7; day >= 0; day--) {
    const n = day === 0 ? 4 : 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const goal = day === 0 && k === n - 1 ? NW : NW * (1 - 0.03 * day / 7);
      v += (goal - v) * 0.5 + (Math.random() - 0.5) * NW * 0.006;
      const at = new Date(Date.now() - day * 864e5); at.setHours(day === 0 ? Math.max(6, Math.round(at.getHours() * (k + 1) / (n + 1))) : 8 + k * 3, Math.floor(Math.random() * 60), 0, 0);
      if (at.getTime() < Date.now()) S.ticks.push({ t: at.toISOString(), net: v + gap, after: v });
    }
  }
  snapshot();
  txn({ kind: 'note', amount: 0, desc: 'Loaded example data' });
}

/* ======================================================================
   wiring
   ====================================================================== */
async function onAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el || el.dataset.action === 'set-income') return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (isDesk()) gNoteAction(el);
  try { await fn(el); } catch (err) { console.error(err); toast('Something went wrong. See the console.'); }
}
async function onImportFile(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.accounts)) throw new Error('not a backup');
    const ok = await confirmDlg({ title: 'Restore this backup?', body: d.accounts.length + ' accounts, ' + (d.goals || []).length + ' goals, ' + (d.bills || []).length + ' bills, ' + (d.upcoming || []).length + ' upcoming, ' + (d.snapshots || []).length + ' snapshots. This replaces everything currently here; a safety copy of the current numbers is kept.', ok: 'Restore', danger: true });
    if (!ok) return;
    keepCopy('before restoring a backup');
    G.silent = true;
    S = hydrate(d); shownNet = null; save(); render(); toast('Backup restored');
  } catch (err) { console.warn(err); toast('That file is not a Wall Street backup'); }
}
const VIEW_ALIAS = { bills: 'upcoming' };
function syncHash() {
  const h0 = location.hash.slice(1), h = VIEW_ALIAS[h0] || h0;
  if (VIEWS.some(v => v.id === h) && h !== view) { view = h; window.scrollTo(0, 0); render(); }
}
function init() {
  const h0 = location.hash.slice(1), h = VIEW_ALIAS[h0] || h0;
  if (VIEWS.some(v => v.id === h)) view = h;
  /* desktop: a click anywhere in a list row selects it (before any button in it acts); double-click runs its main action */
  $('#main').addEventListener('click', e => {
    if (!isDesk()) return;
    const pin = e.target.closest('.dk-pin'); if (pin) { dkSelect(pin.dataset.sel, { scroll: true }); return; }
    const row = e.target.closest('.dk-row'); if (row && row.dataset.sel != null && row.dataset.sel !== dkSel[view]) dkSelect(row.dataset.sel);
  });
  $('#main').addEventListener('dblclick', e => { if (!isDesk() || e.target.closest('button, a, input, select')) return; if (e.target.closest('.dk-row')) dkPrimary('data-primary'); });
  document.addEventListener('keydown', dkKeys);
  if (DESK) { if (DESK.addEventListener) DESK.addEventListener('change', () => render()); else if (DESK.addListener) DESK.addListener(() => render()); }
  $('#main').addEventListener('click', onAction);
  $('.side').addEventListener('click', onAction);
  $('#main').addEventListener('change', e => {
    const el = e.target.closest('[data-action="set-income"]');
    if (el) { S.settings.income = Math.max(0, num(el.value)); gTyped(); save(); render(); }
  });
  $('#modalRoot').addEventListener('click', e => {
    const act = e.target.closest('[data-action]');
    if (act && ['set-theme', 'help-os', 'copy-link', 'install'].includes(act.dataset.action)) { actions[act.dataset.action](act); return; }
    if (act && act.closest('.gm-dlg') && actions[act.dataset.action]) {
      gNoteAction(act); closeModal();
      Promise.resolve(actions[act.dataset.action](act)).catch(err => { console.error(err); toast('Something went wrong. See the console.'); });
      return;
    }
    if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) closeModal();
    else if (e.target.closest('[data-ok]')) closeModal({ ok: true });
    else if (e.target.closest('[data-danger]')) closeModal({ ok: false, danger: true });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalRoot').classList.contains('open')) closeModal(); });
  $('#importFile').addEventListener('change', onImportFile);
  window.addEventListener('hashchange', syncHash);
  /* the first time the app opens in a phone browser, show how to put it on the home screen */
  let seen = false; try { seen = !!localStorage.getItem('ws.helpShown'); } catch (e) {}
  if (IS_MOBILE && !IS_STANDALONE && !seen) setTimeout(() => { if (!$('#modalRoot').classList.contains('open')) actions.help(); }, 900);
  window.addEventListener('resize', debounce(drawChart, 120));
  /* another tab of the app saved: pick up its data instead of overwriting it later */
  window.addEventListener('storage', e => { if (e.key === STORE_KEY && !$('#modalRoot').classList.contains('open')) { S = load(); render(); } });
  /* keep in step with the other devices: on open, when the tab comes back, and when the connection returns */
  window.addEventListener('online', () => syncPull({ force: true, quiet: true }));
  window.addEventListener('focus', () => syncPull({}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncPull({}); checkUpdate({}); } });
  /* today's point on the chart always reflects the current numbers, including bills that came due since the last change */
  if (S.accounts.length) { snapshot(); save({ local: true }); dailyCopy(); }
  render();
  if (sync.code) syncPull({ force: true, quiet: true });
  checkUpdate({ auto: true, force: true });
}
init();
})();
