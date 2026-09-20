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
  { id: 'bills',    label: 'Bills' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history',  label: 'History' },
];
const KIND_TAG = { update: 'SET', transfer: 'XFER', payment: 'PAID', income: 'IN', expense: 'OUT', goal: 'GOAL', add: 'NEW', remove: 'DEL', reverse: 'UNDO', note: 'NOTE' };

/* ======================================================================
   state + persistence
   ====================================================================== */
const fresh = () => ({
  version: 1,
  settings: { theme: 'dark', income: 0, lastBackup: null, mainGoalId: null },
  accounts: [], snapshots: [], txns: [], goals: [], buckets: [], bills: [], upcoming: [],
});
let S = load();
let view = 'overview', chartRange = 'all', histFilter = 'all', shownNet = null, modalResolve = null;

function load() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) localStorage.setItem(STORE_KEY, raw);
    }
    if (!raw) return fresh();
    return hydrate(JSON.parse(raw));
  } catch (e) { console.warn('Wall Street: could not load saved data', e); return fresh(); }
}
function hydrate(d) {
  const base = fresh();
  const out = Object.assign(base, d);
  out.settings = Object.assign(fresh().settings, d.settings || {});
  for (const k of ['accounts', 'snapshots', 'txns', 'goals', 'buckets', 'bills', 'upcoming']) if (!Array.isArray(out[k])) out[k] = [];
  out.buckets.forEach(b => { if (!Array.isArray(b.accountIds)) b.accountIds = []; });
  out.bills.forEach(b => { if (!b.paid || typeof b.paid !== 'object') b.paid = {}; });
  out.goals.forEach(g => { if (g.kind !== 'net') g.kind = 'manual'; if (typeof g.saved !== 'number') g.saved = 0; });
  out.upcoming.forEach(u => { if (u.kind !== 'in') u.kind = 'out'; if (!u.done || typeof u.done !== 'object') u.done = null; });
  return out;
}
function save(o) {
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
/* the cloud copy wins: replace this device's ledger with it */
function adoptRemote(r, msg) {
  S = hydrate(r.data); sync.version = r.version; sync.last = nowISO(); sync.status = 'idle'; saveSync();
  save({ local: true }); shownNet = null; render();
  if (msg) toast(msg);
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
  if (!sync.code || !SYNC.url) return;
  if (!navigator.onLine) { setSyncStatus('error'); return; }
  setSyncStatus('syncing');
  try {
    const r = await rpc('ws_put', { code: normCode(sync.code), payload: S, expected: sync.version || null });
    if (r && r.ok) { sync.version = r.version; sync.last = nowISO(); saveSync(); setSyncStatus('idle'); }
    else if (r && r.conflict) adoptRemote(r, 'Another device changed things first. Reloaded, so redo your last change.');
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
  /* net = assets minus debt; after = the same with this month's unpaid bills taken out, which is the number the app shows as net worth */
  const snap = { date, assets: T.A, liabilities: T.L, net: T.N, after: T.N - billsLeft() };
  const i = S.snapshots.findIndex(s => s.date === date);
  if (i >= 0) S.snapshots[i] = snap; else S.snapshots.push(snap);
  S.snapshots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function txn(t) {
  S.txns.unshift({ id: t.id || uid(), date: nowISO(), kind: t.kind, amount: +t.amount || 0, from: t.from || null, to: t.to || null, desc: t.desc || '', note: t.note || '' });
  if (S.txns.length > 3000) S.txns.length = 3000;
}
/* every balance change goes through here: snapshot, persist, redraw, say so */
function commit(msg) { snapshot(); save(); render(); if (msg) toast(msg); }

/* money moving out of / into an account. For debts the sign flips: paying into a loan lowers what's owed. */
function applyOut(a, amt) { a.balance += isAsset(a) ? -amt : amt; a.updatedAt = nowISO(); }
function applyIn(a, amt)  { a.balance += isAsset(a) ? amt : -amt; a.updatedAt = nowISO(); }

/* the value a snapshot charts: after-bills when recorded, plain net for older snapshots */
const snapVal = s => (s.after != null ? s.after : s.net);
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
const gsaved = g => (g.kind === 'net' ? Math.max(0, netAfterBills()) : g.saved);
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

/* bills */
function billDue(b, ref) {
  ref = ref || new Date();
  const y = ref.getFullYear(), m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(Math.max(1, b.day | 0), last));
}
function billStatus(b) {
  const paid = b.paid && b.paid[ym()];
  if (paid) return { state: 'paid', date: paid.date, amount: paid.amount };
  const due = billDue(b), days = Math.round((due - parseISO(todayStr())) / 864e5);
  return { state: days < 0 ? 'overdue' : 'due', days, due };
}
function billsDue(days) {
  const today = parseISO(todayStr()), out = [];
  const months = [new Date(), new Date(today.getFullYear(), today.getMonth() + 1, 1)];
  for (const ref of months) for (const b of S.bills) {
    if (b.paid && b.paid[ym(ref)]) continue;
    const due = billDue(b, ref), d = Math.round((due - today) / 864e5);
    if (d <= days) out.push({ bill: b, due, days: d });
  }
  return out.sort((a, b) => a.due - b.due);
}
const billsMonthly = () => sum(S.bills, b => b.amount);
const billsPaidThisMonth = () => { const key = ym(); return sum(S.bills.filter(b => b.paid && b.paid[key]), b => b.paid[key].amount); };
const billsLeft = () => Math.max(0, billsMonthly() - billsPaidThisMonth());
/* the headline number: assets minus debt, minus the bills still unpaid this month */
const netAfterBills = () => totals().N - billsLeft();

/* upcoming: one-time money in or out. Pending items do not touch balances; marking one done does. */
const pending = () => S.upcoming.filter(u => !u.done);
const sortUpcoming = list => list.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''));
function expected() {
  const p = pending();
  const inn = sum(p.filter(u => u.kind === 'in'), u => u.amount), out = sum(p.filter(u => u.kind !== 'in'), u => u.amount);
  return { inn, out, net: inn - out, count: p.length };
}
/* the headline number plus what is pending in Upcoming: planned one-time expenses out, expected one-time income in */
function afterAll() {
  const E = expected(), bills = billsLeft(), now = totals().N - bills;
  return { bills, inn: E.inn, out: E.out, now, after: now - E.out + E.inn, any: E.count > 0 };
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
const VIEW_FN = { overview: vOverview, accounts: vAccounts, plan: vPlan, goals: vGoals, bills: vBills, upcoming: vUpcoming, history: vHistory };

function render() {
  document.documentElement.dataset.theme = S.settings.theme;
  $('#themeBtn').textContent = S.settings.theme === 'dark' ? 'Light mode' : 'Dark mode';
  const tc = $('meta[name="theme-color"]');
  if (tc) tc.content = S.settings.theme === 'dark' ? '#0e0e12' : '#f2f1f6';
  renderNav();
  $('#main').innerHTML = (VIEW_FN[view] || vOverview)();
  afterRender();
}
function renderNav() {
  const counts = { accounts: S.accounts.length, goals: S.goals.length, bills: S.bills.length, plan: S.buckets.length, upcoming: pending().length };
  $('#nav').innerHTML = VIEWS.map(v => '<a href="#' + v.id + '" class="nav-item' + (v.id === view ? ' on' : '') + '"><span>' + v.label + '</span>' + (counts[v.id] ? '<span class="nav-n num">' + counts[v.id] + '</span>' : '') + '</a>').join('');
  const lb = S.settings.lastBackup;
  $('#sideStatus').innerHTML = esc(syncLine()) + '<br>' + (lb ? 'Backed up ' + fmtDate(lb, { month: 'short', day: 'numeric' }) : 'Never backed up');
}
function afterRender() {
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
  const up = upNext(30).slice(0, 7), AF = afterAll(), mg = mainGoal();
  const P = planRows();
  const drift = P.rows.filter(r => Math.abs(r.diff) > 1).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 4);
  const deltaHtml = d
    ? `<span class="${d.amt >= 0 ? 'pos' : 'neg'} num">${d.amt >= 0 ? UP : DOWN} ${money(Math.abs(d.amt), { cents: false })} ${DOT} ${pctStr(Math.abs(d.pct), 1)}</span> <span class="muted">since ${fmtDate(d.since, { month: 'short', day: 'numeric' })}</span>`
    : `<span class="muted">No movement recorded yet. Update a balance on another day and this fills in.</span>`;
  return `
  <header class="hero">
    <div>
      <div class="label">Net worth</div>
      <div class="hero-num num" data-count="${AF.now}">${money(AF.now, { cents: false })}</div>
      <div class="hero-delta">${deltaHtml}</div>
      ${AF.bills ? `<div class="hero-note small muted"><span class="num">${money(T.N, { cents: false })}</span> before this month's bills ${DOT} <span class="num neg">${MINUS}${money(AF.bills, { cents: false })}</span> still to pay</div>` : ''}
      ${AF.any ? `<div class="hero-next">
        <div class="label">After what is coming</div>
        <div class="hero-num2 num">${money(AF.after, { cents: false })}</div>
        <div class="hero-breakdown small muted">
          ${AF.inn ? `<span><span class="pos num">+${money(AF.inn, { cents: false })}</span> coming in</span>` : ''}
          ${AF.out ? `<span><span class="neg num">${MINUS}${money(AF.out, { cents: false })}</span> going out</span>` : ''}
        </div>
      </div>` : ''}
    </div>
    <div class="hero-r">
      <div class="stat"><div class="label">Assets</div><div class="num">${money(T.A, { cents: false })}</div></div>
      <div class="stat"><div class="label">Debt</div><div class="num${T.L ? ' neg' : ''}">${T.L ? MINUS : ''}${money(T.L, { cents: false })}</div></div>
      <div class="stat"><div class="label">Bills left</div><div class="num">${money(AF.bills, { cents: false })}</div></div>
    </div>
  </header>
  ${mg ? mainGoalPanel(mg) : ''}
  <section class="panel">
    <div class="panel-head"><span class="label">Net worth over time</span>
      <div class="seg">${['1m', '3m', '1y', 'all'].map(r => `<button class="${chartRange === r ? 'on' : ''}" data-action="range" data-range="${r}">${r.toUpperCase()}</button>`).join('')}</div></div>
    <div class="chart-wrap" id="chart"></div>
  </section>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-head"><span class="label">Where it sits</span><a class="link" href="#accounts">All accounts</a></div>
      ${accountGroups()}
    </section>
    <div class="stack">
      <section class="panel">
        <div class="panel-head"><span class="label">Coming up</span><span class="links"><a class="link" href="#bills">Bills</a><a class="link" href="#upcoming">Upcoming</a></span></div>
        ${up.length
          ? `<ul class="list">${up.map(u => `<li><span class="num muted w-date">${fmtDate(u.date, { month: 'short', day: 'numeric' })}</span>${u.kind !== 'bill' ? `<span class="tag ${u.kind === 'in' ? 'pos-tag' : 'neg-tag'}">${u.kind === 'in' ? 'IN' : 'OUT'}</span>` : ''}<span class="grow">${esc(u.name)}</span>${u.days < 0 && u.kind === 'bill' ? '<span class="tag neg-tag">late</span>' : ''}<span class="num${u.kind === 'in' ? ' pos' : u.kind === 'out' ? ' neg' : ''}">${u.kind === 'in' ? '+' : u.kind === 'out' ? MINUS : ''}${money(u.amount)}</span></li>`).join('')}</ul>`
          : `<p class="empty">${S.bills.length || S.upcoming.length ? 'Nothing in the next 30 days.' : 'No bills or upcoming items yet.'}</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><span class="label">Goals</span><a class="link" href="#goals">All goals</a></div>
        ${S.goals.length
          ? S.goals.slice(0, 4).map(g => `<div class="mini-goal"><div class="row"><span class="grow">${esc(g.name)}${isMainGoal(g) ? ' <span class="tag">MAIN</span>' : ''}</span><span class="num muted small">${money(gsaved(g), { cents: false })} / ${money(g.target, { cents: false })}</span></div><div class="bar"><i class="${gdone(g) ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div></div>`).join('')
          : `<p class="empty">No goals yet.</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><span class="label">Plan drift</span><a class="link" href="#plan">Plan</a></div>
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
  return `<div class="meter${done ? ' done' : ''}">${Array.from({ length: n }, (_, i) => `<i><b style="width:${Math.round(Math.max(0, Math.min(1, f - i)) * 100)}%"></b></i>`).join('')}</div>`;
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
    <div class="panel-head"><span class="label">Main goal</span><span class="links">${S.goals.length > 1 ? '<a class="link" href="#goals">Change</a>' : ''}<a class="link" href="#goals">All goals</a></span></div>
    <div class="mg">
      <div>
        <div class="mg-name">${esc(g.name)}</div>
        <div class="goal-nums"><span class="num big">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span></div>
        ${bits.length ? `<div class="muted small">${bits.join(' ' + DOT + ' ')}</div>` : ''}
      </div>
      <div>
        <div class="row"><span class="mg-pct num${done ? ' pos' : ''}">${pctStr(pct)}</span><span class="grow"></span><span class="small muted">${done ? 'funded' : 'of the way there'}</span></div>
        ${meterHTML(pct, done)}
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
    <div class="row"><button class="btn btn-primary" data-action="add-account">Add an account</button><button class="btn" data-action="demo">Load example data</button></div>
    <p class="small" style="margin:14px 0 0">Example data is made up. Wipe it any time from History.</p>
  </section>`;
}
function accountGroups() {
  return GROUP_ORDER.map(g => {
    const list = S.accounts.filter(a => typeOf(a).group === g).sort((a, b) => b.balance - a.balance);
    if (!list.length) return '';
    const t = sum(list, a => a.balance), debt = g === 'debt';
    return `<div class="group">
      <div class="group-head"><span>${GROUPS[g]}</span><span class="num${debt ? ' neg' : ''}">${debt ? MINUS : ''}${money(t, { cents: false })}</span></div>
      ${list.map(a => `<div class="row acct-row" data-action="update-balance" data-id="${a.id}" title="Update balance"><span class="tag">${typeOf(a).tag}</span><span class="grow">${esc(a.name)}${a.inst ? `<span class="muted"> ${DOT} ${esc(a.inst)}</span>` : ''}</span><span class="num">${money(a.balance)}</span></div>`).join('')}
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
    return `<section class="panel"><div class="panel-head"><span class="label">${debt ? 'Debt' : 'Assets'}</span><span class="num${debt ? ' neg' : ''}">${debt ? MINUS : ''}${money(sum(list, a => a.balance))}</span></div>
    ${list.map(a => { const em = earmarked(a.id); return `<div class="rrow">
      <span class="tag">${typeOf(a).tag}</span>
      <div class="what"><div class="strong">${esc(a.name)}</div><div class="sub">${typeOf(a).label}${a.inst ? ` ${DOT} ${esc(a.inst)}` : ''}${a.updatedAt ? ` ${DOT} updated ${fmtDate(a.updatedAt, { month: 'short', day: 'numeric' })}` : ''}</div></div>
      <div class="amt"><div class="num">${money(a.balance)}</div>${em ? `<div class="muted small">${money(em, { cents: false })} earmarked</div>` : ''}</div>
      <div class="acts"><button class="btn btn-sm" data-action="update-balance" data-id="${a.id}">Update</button><button class="btn btn-sm btn-ghost" data-action="edit-account" data-id="${a.id}">Edit</button></div>
    </div>`; }).join('')}
    </section>`;
  };
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Assets</div><div class="num big">${money(T.A, { cents: false })}</div></div>
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
        ? `<div class="kv"><span class="muted">Bills</span><span class="num">${MINUS}${money(billsTotal, { cents: false })}</span></div><div class="kv strong"><span>Free to allocate</span><span class="num${free < 0 ? ' neg' : ''}">${money(free, { cents: false })}</span></div>
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
      <div class="row"><span class="strong grow">${esc(g.name)}</span>${main ? '<span class="tag">MAIN</span>' : ''}${done ? '<span class="tag pos-tag">Funded</span>' : ''}</div>
      <div class="goal-nums"><span class="num big">${money(saved, { cents: false })}</span><span class="muted num small">of ${money(g.target, { cents: false })}</span></div>
      <div class="bar"><i class="${done ? 'done' : ''}" style="width:${goalPct(g)}%"></i></div>
      <div class="row small muted"><span class="grow">${net ? 'Follows your net worth' : a ? 'Held in ' + esc(a.name) : 'Not linked to an account'}</span><span class="num">${pctStr(goalPct(g))}</span></div>
      ${goalLine(g)}
      <div class="row top">${net ? `<a class="btn btn-sm btn-primary" href="#accounts">Update balances</a>` : `<button class="btn btn-sm btn-primary" data-action="fund-goal" data-id="${g.id}">Add funds</button>`}<button class="btn btn-sm btn-ghost" data-action="edit-goal" data-id="${g.id}">Edit</button>${main || S.goals.length < 2 ? '' : `<button class="btn btn-sm btn-ghost" data-action="main-goal" data-id="${g.id}">Make main</button>`}</div>
    </section>`; }).join('')}</div>`;
}

/* ---------- bills ---------- */
function vBills() {
  const total = billsMonthly(), paidAmt = billsPaidThisMonth();
  const head = `<header class="page-head"><div><h1>Bills</h1><p class="sub">Recurring payments. Paying one moves money out of the source account, and pays the debt down if it is a card or loan.</p></div>
    <div class="row"><button class="btn btn-primary" data-action="add-bill">Add bill</button></div></header>`;
  if (!S.bills.length) return head + `<section class="panel"><p class="empty">No bills yet. Rent, car payment, credit card, phone, subscriptions: anything that recurs monthly.</p></section>`;
  const sorted = S.bills.slice().sort((a, b) => a.day - b.day);
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Monthly total</div><div class="num big">${money(total, { cents: false })}</div></div>
      <div class="stat"><div class="label">Paid in ${fmtDate(todayStr(), { month: 'long' })}</div><div class="num big">${money(paidAmt, { cents: false })}</div></div>
      <div class="stat"><div class="label">Remaining</div><div class="num big">${money(Math.max(0, total - paidAmt), { cents: false })}</div></div>
    </div>
  <section class="panel"><div class="panel-head"><span class="label">This month</span><span class="muted small">in due-date order</span></div>
  ${sorted.map(b => {
    const st = billStatus(b), from = acct(b.from), to = acct(b.to);
    const status = st.state === 'paid' ? `<span class="pos">Paid ${fmtDate(st.date, { month: 'short', day: 'numeric' })}</span>`
      : st.state === 'overdue' ? `<span class="neg">Overdue ${DOT} ${-st.days} day${st.days === -1 ? '' : 's'}</span>`
      : `<span>${st.days === 0 ? 'Due today' : 'Due ' + fmtDate(st.due, { month: 'short', day: 'numeric' })}</span>${st.days > 0 ? ` <span class="muted">${relDays(st.days)}</span>` : ''}`;
    return `<div class="rrow${st.state === 'paid' ? ' dim' : ''}">
      <div class="what"><div class="strong">${esc(b.name)}</div><div class="sub">Day ${b.day} ${DOT} ${from ? 'from ' + esc(from.name) : '<span class="warn">no account</span>'}${to ? ` ${DOT} pays down ${esc(to.name)}` : ''}</div></div>
      <div class="amt"><div class="num">${money(st.state === 'paid' ? st.amount : b.amount)}</div><div class="small">${status}</div></div>
      <div class="acts">${st.state === 'paid'
        ? `<button class="btn btn-sm btn-ghost" data-action="unpay-bill" data-id="${b.id}">Undo</button>`
        : `<button class="btn btn-sm btn-primary" data-action="pay-bill" data-id="${b.id}">Pay</button>`}<button class="btn btn-sm btn-ghost" data-action="edit-bill" data-id="${b.id}">Edit</button></div>
    </div>`; }).join('')}
  </section>`;
}

/* ---------- upcoming (one-time money in or out) ---------- */
function vUpcoming() {
  const E = expected(), T = totals();
  const head = `<header class="page-head"><div><h1>Upcoming</h1><p class="sub">One-time money on the horizon: a purchase you are planning, a refund you are waiting on. Nothing touches a balance until you mark it received or paid.</p></div>
    <div class="row"><button class="btn" data-action="add-upcoming" data-kind="in">Add money in</button><button class="btn btn-primary" data-action="add-upcoming" data-kind="out">Add expense</button></div></header>`;
  if (!S.upcoming.length) return head + `<section class="panel"><p class="empty">Nothing planned. Add a purchase you are saving toward, or money you expect to land: a tax refund, a bonus, something you sold.</p></section>`;
  const open = sortUpcoming(pending());
  const done = S.upcoming.filter(u => u.done).sort((a, b) => (b.done.date || '').localeCompare(a.done.date || '')).slice(0, 20);
  const row = u => {
    const inn = u.kind === 'in', a = acct(u.accountId), d = u.date ? daysUntil(u.date) : null;
    const sub = [a ? (inn ? 'into ' : 'from ') + esc(a.name) : '', u.note ? esc(u.note) : ''].filter(Boolean).join(' ' + DOT + ' ');
    return `<div class="rrow">
      <div class="w-date">${u.date ? `<div class="num small">${fmtDate(u.date, { month: 'short', day: 'numeric' })}</div><div class="small ${d < 0 ? 'warn' : 'muted'}">${relShort(d)}</div>` : `<div class="small muted">no date</div>`}</div>
      <span class="tag ${inn ? 'pos-tag' : 'neg-tag'}">${inn ? 'IN' : 'OUT'}</span>
      <div class="what"><div class="strong">${esc(u.name)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <div class="amt"><div class="num ${inn ? 'pos' : 'neg'}">${inn ? '+' : MINUS}${money(u.amount)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-primary" data-action="done-upcoming" data-id="${u.id}">${inn ? 'Received' : 'Paid'}</button><button class="btn btn-sm btn-ghost" data-action="edit-upcoming" data-id="${u.id}">Edit</button></div>
    </div>`;
  };
  const doneRow = u => {
    const inn = u.kind === 'in', a = acct(u.done.accountId);
    return `<div class="rrow dim">
      <div class="w-date"><div class="num small">${fmtDate(u.done.date, { month: 'short', day: 'numeric' })}</div></div>
      <span class="tag">${inn ? 'IN' : 'OUT'}</span>
      <div class="what"><div class="strong">${esc(u.name)}</div><div class="sub">${inn ? 'Received' : 'Paid'}${a ? (inn ? ' into ' : ' from ') + esc(a.name) : ''}</div></div>
      <div class="amt"><div class="num">${inn ? '+' : MINUS}${money(u.done.amount)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-ghost" data-action="undo-upcoming" data-id="${u.id}">Undo</button><button class="btn btn-sm btn-ghost" data-action="edit-upcoming" data-id="${u.id}">Edit</button></div>
    </div>`;
  };
  return head + `<div class="summary-row">
      <div class="stat"><div class="label">Coming in</div><div class="num big${E.inn ? ' pos' : ''}">${E.inn ? '+' : ''}${money(E.inn, { cents: false })}</div></div>
      <div class="stat"><div class="label">Going out</div><div class="num big${E.out ? ' neg' : ''}">${E.out ? MINUS : ''}${money(E.out, { cents: false })}</div></div>
      <div class="stat"><div class="label">Net</div><div class="num big">${money(E.net, { cents: false, sign: true })}</div></div>
      <div class="stat"><div class="label">Net worth after</div><div class="num big">${money(T.N + E.net, { cents: false })}</div></div>
    </div>
  <section class="panel"><div class="panel-head"><span class="label">Pending</span><span class="muted small">${open.length} item${open.length === 1 ? '' : 's'}</span></div>
    ${open.length ? open.map(row).join('') : `<p class="empty">Everything here is done.</p>`}
  </section>
  ${done.length ? `<section class="panel"><div class="panel-head"><span class="label">Done</span><span class="muted small">newest first</span></div>${done.map(doneRow).join('')}</section>` : ''}`;
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
    <div class="panel-head"><span class="label">Changes</span><div class="seg">${Object.keys(kinds).map(k => `<button class="${histFilter === k ? 'on' : ''}" data-action="hist-filter" data-k="${k}">${kinds[k]}</button>`).join('')}</div></div>
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
         ${S.snapshots.slice().reverse().slice(0, 30).map(s => `<tr><td class="muted">${fmtDate(s.date)}</td><td class="r num hide-sm">${money(s.assets, { cents: false })}</td><td class="r num hide-sm">${money(s.liabilities, { cents: false })}</td><td class="r num strong">${money(snapVal(s), { cents: false })}</td></tr>`).join('')}
         </tbody></table>`
      : `<p class="empty">No snapshots yet.</p>`}
  </section>
  <section class="panel">
    <div class="panel-head"><span class="label">Data</span></div>
    ${SYNC.url ? `<div class="data-row"><div><div class="strong">Sync across devices</div><div class="muted small">${sync.code
      ? `On. Your code is <b class="num">${prettyCode(sync.code)}</b>. Enter it on another device to see the same numbers there.${sync.last ? ' Last synced ' + fmtDate(sync.last, { month: 'short', day: 'numeric' }) + ' ' + fmtTime(sync.last) + '.' : ''}${sync.status === 'error' ? ' <span class="warn">Cannot reach the cloud right now.</span>' : ''}`
      : 'Keep the same numbers on your computer, laptop and phone. Turn it on here, then enter the code it gives you on each other device.'}</div></div>
      <div class="row acts">${sync.code
        ? `<button class="btn" data-action="sync-copy">Copy code</button><button class="btn" data-action="sync-now">Sync now</button><button class="btn btn-ghost" data-action="sync-off">Turn off</button>`
        : `<button class="btn btn-primary" data-action="sync-on">Turn on sync</button><button class="btn" data-action="sync-join">I have a code</button>`}</div></div>` : ''}
    <div class="data-row"><div><div class="strong">Backup</div><div class="muted small">Download everything as one JSON file. This app keeps its data in this browser only, so keep a copy somewhere safe.</div></div><button class="btn" data-action="export">Download backup</button></div>
    <div class="data-row"><div><div class="strong">Restore</div><div class="muted small">Load a backup file. Replaces what is here.</div></div><button class="btn" data-action="import">Choose file</button></div>
    <div class="data-row"><div><div class="strong">Start over</div><div class="muted small">Wipe all accounts, goals, bills, upcoming, plan and history${sync.code ? ', here and on every synced device' : ''}.</div></div><button class="btn btn-danger" data-action="reset">Erase everything</button></div>
  </section>`;
}

/* ---------- chart ---------- */
function drawChart() {
  const wrap = $('#chart');
  if (!wrap) return;
  const W = Math.max(320, wrap.clientWidth - 24) || 800;
  wrap.innerHTML = chartSVG(W);
  bindChartHover(wrap, W);
}
function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag, step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.5; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
function chartSVG(W) {
  let snaps = S.snapshots;
  const days = { '1m': 31, '3m': 92, '1y': 366 }[chartRange];
  if (days) {
    const cutoff = localISO(new Date(Date.now() - days * 864e5));
    const before = snaps.filter(s => s.date < cutoff), after = snaps.filter(s => s.date >= cutoff);
    snaps = before.length ? [before[before.length - 1]].concat(after) : after;
  }
  if (snaps.length < 2) return `<div class="chart-empty">${snaps.length ? 'One data point so far. The line appears once a balance changes on another day.' : 'No history in this range.'}</div>`;
  const H = 220, PL = 60, PR = 16, PT = 16, PB = 28;
  const xs = snaps.map(s => parseISO(s.date).getTime()), ys = snaps.map(snapVal);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  let yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
  if (yMax - yMin < 1) { yMin -= 100; yMax += 100; }
  const padY = (yMax - yMin) * 0.12; yMin -= padY; yMax += padY;
  const ticks = niceTicks(yMin, yMax, 4);
  yMin = Math.min(yMin, ticks[0]); yMax = Math.max(yMax, ticks[ticks.length - 1]);
  const X = t => PL + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - PL - PR);
  const Y = v => PT + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB);
  const pts = snaps.map((s, i) => [+X(xs[i]).toFixed(1), +Y(ys[i]).toFixed(1), s.date, ys[i]]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const floor = (H - PB).toFixed(1);
  const area = line + ' L' + pts[pts.length - 1][0] + ' ' + floor + ' L' + pts[0][0] + ' ' + floor + ' Z';
  const grid = ticks.map(t => { const y = Y(t).toFixed(1); return `<line x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}" class="grid"/><text x="${PL - 8}" y="${(+y + 3.5).toFixed(1)}" class="tick" text-anchor="end">${compact(t)}</text>`; }).join('');
  const n = pts.length, idx = Array.from(new Set([0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1]));
  const xl = idx.map(i => `<text x="${pts[i][0]}" y="${H - 8}" class="tick" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${fmtDate(pts[i][2], { month: 'short', day: 'numeric' })}</text>`).join('');
  const last = pts[n - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" data-pts='${JSON.stringify(pts)}'>
    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#fill)"/>
    <path d="${line}" class="line"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.5" class="dot"/>
    <line class="cross" x1="0" x2="0" y1="${PT}" y2="${H - PB}" style="display:none"/>
    <circle class="hover-dot" r="4" style="display:none"/>
    ${xl}
  </svg><div class="chart-tip" style="display:none"></div>`;
}
function bindChartHover(wrap, W) {
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const pts = JSON.parse(svg.dataset.pts), tip = wrap.querySelector('.chart-tip');
  const cross = svg.querySelector('.cross'), hd = svg.querySelector('.hover-dot');
  const show = clientX => {
    const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    cross.setAttribute('x1', best[0]); cross.setAttribute('x2', best[0]); cross.style.display = '';
    hd.setAttribute('cx', best[0]); hd.setAttribute('cy', best[1]); hd.style.display = '';
    tip.innerHTML = `<span class="muted">${fmtDate(best[2])}</span><b class="num">${money(best[3], { cents: false })}</b>`;
    tip.style.display = '';
    const px = best[0] / W * r.width;
    tip.style.left = Math.min(r.width - tip.offsetWidth, Math.max(0, px - tip.offsetWidth / 2)) + 12 + 'px';
  };
  const hide = () => { cross.style.display = 'none'; hd.style.display = 'none'; tip.style.display = 'none'; };
  svg.addEventListener('mousemove', e => show(e.clientX));
  svg.addEventListener('mouseleave', hide);
  /* a finger works too: touch to read a point, lift to clear it after a moment */
  svg.addEventListener('touchstart', e => show(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchmove', e => show(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchend', () => setTimeout(hide, 1500), { passive: true });
}

/* ======================================================================
   modal, forms, confirm, toast
   ====================================================================== */
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = '<div class="modal-bg"></div><div class="modal">' + html + '</div>';
  root.classList.add('open');
  const first = root.querySelector('input:not([type=checkbox]),select,textarea,button.btn-primary');
  if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 0);
}
function closeModal(result) {
  const root = $('#modalRoot');
  root.classList.remove('open');
  root.innerHTML = '';
  const r = modalResolve; modalResolve = null;
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
      <div class="mactions">${spec.danger ? `<button type="button" class="btn btn-ghost danger" data-danger>${esc(spec.danger)}</button>` : ''}<span class="grow"></span><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary">${esc(spec.submit || 'Save')}</button></div></form>`);
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
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('#toastRoot').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, 2600);
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
const billFields = b => {
  b = b || {};
  return [
    { key: 'name', label: 'Bill', value: b.name, placeholder: 'e.g. Car payment', required: true },
    { key: 'amount', label: 'Amount', type: 'money', value: b.amount == null ? '' : b.amount.toFixed(2), required: true, half: true, hint: 'For a card, a typical amount. You can change it when you pay.' },
    { key: 'day', label: 'Due day of month', type: 'number', value: b.day || '', min: 1, max: 31, step: 1, required: true, half: true },
    { key: 'from', label: 'Paid from', type: 'select', value: b.from || '', options: [{ v: '', l: DASH }].concat(assets().map(a => ({ v: a.id, l: a.name }))) },
    { key: 'to', label: 'Pays down', type: 'select', value: b.to || '', options: [{ v: '', l: 'Nothing, it is an expense' }].concat(liabilities().map(a => ({ v: a.id, l: a.name }))), hint: 'Pick the card or loan this payment reduces.' },
  ];
};
const upcomingFields = (u, kind) => {
  u = u || {};
  kind = u.kind || kind || 'out';
  return [
    { key: 'name', label: 'What', value: u.name, placeholder: kind === 'in' ? 'e.g. Tax refund' : 'e.g. New tires', required: true },
    { key: 'kind', label: 'Direction', type: 'select', value: kind, half: true, options: [{ v: 'out', l: 'Money going out' }, { v: 'in', l: 'Money coming in' }] },
    { key: 'amount', label: 'Amount', type: 'money', value: u.amount == null ? '' : u.amount.toFixed(2), required: true, half: true },
    { key: 'date', label: 'Expected', type: 'date', value: u.date || '', half: true, hint: 'Leave it blank if you are not sure yet.' },
    { key: 'accountId', label: 'Account', type: 'select', value: u.accountId || '', half: true, options: [{ v: '', l: 'Decide later' }].concat(S.accounts.map(a => ({ v: a.id, l: a.name }))), hint: 'Where it comes from or lands.' },
    { key: 'note', label: 'Note', value: u.note, placeholder: 'optional' },
  ];
};

/* ======================================================================
   actions (data-action="...")
   ====================================================================== */
const actions = {
  'toggle-theme'() { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); render(); },
  range(el) { chartRange = el.dataset.range; render(); },
  'hist-filter'(el) { histFilter = el.dataset.k; render(); },

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
  async 'update-balance'(el) {
    const a = acct(el.dataset.id); if (!a) return;
    const debt = !isAsset(a);
    const r = await form({ title: a.name, intro: 'Now ' + money(a.balance) + (debt ? ' owed' : ''), fields: [
      { key: 'balance', label: debt ? 'New amount owed' : 'New balance', type: 'money', value: a.balance.toFixed(2), required: true },
      { key: 'note', label: 'Note', placeholder: 'optional' },
    ], submit: 'Update' });
    if (!r.ok) return;
    const nb = Math.abs(r.v.balance), delta = nb - a.balance;
    a.balance = nb; a.updatedAt = nowISO();
    txn({ kind: 'update', amount: debt ? -delta : delta, from: a.id, desc: a.name + ' set to ' + money(nb), note: r.v.note });
    commit(a.name + ' ' + ARROW + ' ' + money(nb));
  },
  async transfer() {
    if (S.accounts.length < 2) { toast('Add a second account first'); return; }
    const opts = accountOpts(S.accounts);
    const r = await form({ title: 'Transfer', intro: 'Moving money into a card or loan pays it down.', fields: [
      { key: 'from', label: 'From', type: 'select', options: opts, value: opts[0].v, half: true },
      { key: 'to', label: 'To', type: 'select', options: opts, value: opts[1].v, half: true },
      { key: 'amount', label: 'Amount', type: 'money', required: true },
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
    S.buckets.push(b); claimAccounts(b); save(); render(); toast(b.name + ' added');
  },
  async 'edit-bucket'(el) {
    const b = S.buckets.find(x => x.id === el.dataset.id); if (!b) return;
    const r = await form({ title: 'Edit bucket', fields: bucketFields(b), danger: 'Delete bucket' });
    if (r.danger) { S.buckets = S.buckets.filter(x => x !== b); save(); render(); toast(b.name + ' removed'); return; }
    if (!r.ok) return;
    Object.assign(b, { name: r.v.name, pct: r.v.pct, accountIds: r.v.accountIds });
    claimAccounts(b); save(); render(); toast('Saved');
  },
  'plan-template'() {
    const pick = types => assets().filter(a => types.includes(a.type)).map(a => a.id);
    S.buckets = [
      { id: uid(), name: 'Cash on hand', pct: 10, accountIds: pick(['checking', 'cash']) },
      { id: uid(), name: 'Emergency fund', pct: 25, accountIds: pick(['savings']) },
      { id: uid(), name: 'Invested', pct: 65, accountIds: pick(['brokerage', 'retirement', 'crypto']) },
    ];
    save(); render(); toast('Template loaded. Click a bucket to adjust it.');
  },

  /* goals */
  async 'add-goal'() {
    const p = form({ title: 'New goal', fields: goalFields(), submit: 'Add goal' }); wireGoalKind();
    const r = await p;
    if (!r.ok) return;
    const g = Object.assign({ id: uid() }, goalFromForm(r.v));
    S.goals.push(g);
    if (g.saved) txn({ kind: 'goal', amount: g.saved, to: g.accountId, desc: money(g.saved) + ' toward ' + g.name });
    save(); render(); toast(g.name + ' added');
  },
  async 'edit-goal'(el) {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    const p = form({ title: 'Edit goal', fields: goalFields(g), danger: 'Delete goal' }); wireGoalKind();
    const r = await p;
    if (r.danger) { S.goals = S.goals.filter(x => x !== g); if (S.settings.mainGoalId === g.id) S.settings.mainGoalId = null; save(); render(); toast(g.name + ' removed'); return; }
    if (!r.ok) return;
    Object.assign(g, goalFromForm(r.v));
    save(); render(); toast('Saved');
  },
  'main-goal'(el) {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    S.settings.mainGoalId = g.id; save(); render(); toast(g.name + ' is now the main goal');
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
    const r = await form({ title: 'Add to ' + g.name, intro: money(g.saved) + ' saved of ' + money(g.target) + (held ? ' ' + DOT + ' held in ' + esc(held.name) : ''), fields, submit: 'Add funds' });
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

  /* bills */
  async 'add-bill'() {
    const r = await form({ title: 'New bill', fields: billFields(), submit: 'Add bill' });
    if (!r.ok) return;
    const b = { id: uid(), name: r.v.name, amount: Math.abs(r.v.amount), day: Math.min(31, Math.max(1, r.v.day | 0)), from: r.v.from || null, to: r.v.to || null, paid: {} };
    S.bills.push(b); save(); render(); toast(b.name + ' added');
  },
  async 'edit-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id); if (!b) return;
    const r = await form({ title: 'Edit bill', fields: billFields(b), danger: 'Delete bill' });
    if (r.danger) { S.bills = S.bills.filter(x => x !== b); save(); render(); toast(b.name + ' removed'); return; }
    if (!r.ok) return;
    Object.assign(b, { name: r.v.name, amount: Math.abs(r.v.amount), day: Math.min(31, Math.max(1, r.v.day | 0)), from: r.v.from || null, to: r.v.to || null });
    save(); render(); toast('Saved');
  },
  async 'pay-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id); if (!b) return;
    const to = acct(b.to);
    const r = await form({ title: 'Pay ' + b.name, intro: to ? esc(to.name) + ' currently owes ' + money(to.balance) : '', fields: [
      { key: 'amount', label: 'Amount', type: 'money', value: b.amount.toFixed(2), required: true, half: true },
      { key: 'date', label: 'Date', type: 'date', value: todayStr(), half: true },
      { key: 'from', label: 'From', type: 'select', value: b.from || '', options: [{ v: '', l: 'Do not touch an account' }].concat(accountOpts(assets())) },
    ], submit: 'Mark paid' });
    if (!r.ok) return;
    const amt = Math.abs(r.v.amount), f = acct(r.v.from);
    if (f) applyOut(f, amt);
    if (to) applyIn(to, amt);
    const id = uid();
    txn({ id, kind: 'payment', amount: amt, from: f ? f.id : null, to: to ? to.id : null, desc: 'Paid ' + b.name + (f ? ' from ' + f.name : '') + (to ? ' ' + ARROW + ' ' + to.name : '') });
    b.paid[ym()] = { date: r.v.date || todayStr(), amount: amt, from: f ? f.id : null, to: to ? to.id : null, txnId: id };
    commit(b.name + ' paid');
  },
  async 'unpay-bill'(el) {
    const b = S.bills.find(x => x.id === el.dataset.id), p = b && b.paid[ym()]; if (!p) return;
    const f = acct(p.from), t = acct(p.to);
    if (f) applyIn(f, p.amount);
    if (t) applyOut(t, p.amount);
    delete b.paid[ym()];
    txn({ kind: 'reverse', amount: p.amount, from: t ? t.id : null, to: f ? f.id : null, desc: 'Undid ' + b.name + ' payment' });
    commit(b.name + ' marked unpaid');
  },

  /* upcoming */
  async 'add-upcoming'(el) {
    const kind = el.dataset.kind === 'in' ? 'in' : 'out';
    const r = await form({ title: kind === 'in' ? 'Money coming in' : 'Planned expense', fields: upcomingFields(null, kind), submit: 'Add' });
    if (!r.ok) return;
    const u = { id: uid(), name: r.v.name, kind: r.v.kind === 'in' ? 'in' : 'out', amount: Math.abs(r.v.amount), date: r.v.date, accountId: r.v.accountId || null, note: r.v.note, createdAt: nowISO(), done: null };
    S.upcoming.push(u); save(); render(); toast(u.name + ' added');
  },
  async 'edit-upcoming'(el) {
    const u = S.upcoming.find(x => x.id === el.dataset.id); if (!u) return;
    const fields = u.done
      ? [{ key: 'name', label: 'What', value: u.name, required: true }, { key: 'note', label: 'Note', value: u.note, placeholder: 'optional' }]
      : upcomingFields(u);
    const r = await form({ title: u.done ? 'Edit' : 'Edit upcoming', intro: u.done ? 'Already ' + (u.kind === 'in' ? 'received' : 'paid') + '. Undo it first to change the amount or account.' : '', fields, danger: 'Delete' });
    if (r.danger) { S.upcoming = S.upcoming.filter(x => x !== u); save(); render(); toast(u.name + ' removed'); return; }
    if (!r.ok) return;
    if (u.done) Object.assign(u, { name: r.v.name, note: r.v.note });
    else Object.assign(u, { name: r.v.name, kind: r.v.kind === 'in' ? 'in' : 'out', amount: Math.abs(r.v.amount), date: r.v.date, accountId: r.v.accountId || null, note: r.v.note });
    save(); render(); toast('Saved');
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
    if (S.accounts.length && !(await confirmDlg({ title: 'Replace what is on this device?', body: 'The synced ledger has ' + (d.accounts || []).length + ' accounts and last changed ' + fmtDate(remote.updated_at) + '. It replaces the numbers on this device. Download a backup first if you want to keep this copy.', ok: 'Replace and sync', danger: true }))) return;
    sync.code = prettyCode(code);
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
    const ok = await confirmDlg({ title: 'Erase everything?', body: 'All accounts, goals, bills, upcoming, plan and history in this browser are wiped. Download a backup first if you might want it back.', ok: 'Erase', danger: true });
    if (!ok) return;
    const theme = S.settings.theme;
    S = fresh(); S.settings.theme = theme; shownNet = null;
    save(); render(); toast('Fresh start');
  },
  async demo() {
    if (S.accounts.length && !(await confirmDlg({ title: 'Load example data?', body: 'This replaces what is here.', ok: 'Load', danger: true }))) return;
    loadDemo(); shownNet = null; save(); render(); toast('Example data loaded');
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
    { id: uid(), name: 'Rent', amount: 1450, day: 1, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Phone', amount: 68, day: 8, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Gym', amount: 42, day: 15, from: chk.id, to: null, paid: {} },
    { id: uid(), name: 'Car payment', amount: 312, day: 22, from: chk.id, to: car.id, paid: {} },
    { id: uid(), name: 'Sapphire card', amount: 600, day: 25, from: chk.id, to: cc.id, paid: {} },
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
  S.bills.forEach(b => { if (b.day < today) b.paid[key] = { date: key + '-' + pad2(b.day), amount: b.amount, from: b.from, to: b.to }; });
  const T = totals(), NW = T.N - billsLeft(), start = Date.now() - 180 * 864e5;
  let net = NW * 0.78;
  for (let d = 0; d < 180; d += 5) {
    const goal = NW * (0.78 + 0.22 * d / 180);
    net += (goal - net) * 0.45 + (Math.random() - 0.5) * NW * 0.025;
    S.snapshots.push({ date: localISO(new Date(start + d * 864e5)), assets: net + T.L, liabilities: T.L, net, after: net });
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
  try { await fn(el); } catch (err) { console.error(err); toast('Something went wrong. See the console.'); }
}
async function onImportFile(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.accounts)) throw new Error('not a backup');
    const ok = await confirmDlg({ title: 'Restore this backup?', body: d.accounts.length + ' accounts, ' + (d.goals || []).length + ' goals, ' + (d.bills || []).length + ' bills, ' + (d.upcoming || []).length + ' upcoming, ' + (d.snapshots || []).length + ' snapshots. This replaces everything currently here.', ok: 'Restore', danger: true });
    if (!ok) return;
    S = hydrate(d); shownNet = null; save(); render(); toast('Backup restored');
  } catch (err) { console.warn(err); toast('That file is not a Wall Street backup'); }
}
function syncHash() {
  const h = location.hash.slice(1);
  if (VIEWS.some(v => v.id === h) && h !== view) { view = h; window.scrollTo(0, 0); render(); }
}
function init() {
  const h = location.hash.slice(1);
  if (VIEWS.some(v => v.id === h)) view = h;
  $('#main').addEventListener('click', onAction);
  $('.side').addEventListener('click', onAction);
  $('#main').addEventListener('change', e => {
    const el = e.target.closest('[data-action="set-income"]');
    if (el) { S.settings.income = Math.max(0, num(el.value)); save(); render(); }
  });
  $('#modalRoot').addEventListener('click', e => {
    if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) closeModal();
    else if (e.target.closest('[data-ok]')) closeModal({ ok: true });
    else if (e.target.closest('[data-danger]')) closeModal({ ok: false, danger: true });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalRoot').classList.contains('open')) closeModal(); });
  $('#importFile').addEventListener('change', onImportFile);
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('resize', debounce(drawChart, 120));
  /* another tab of the app saved: pick up its data instead of overwriting it later */
  window.addEventListener('storage', e => { if (e.key === STORE_KEY && !$('#modalRoot').classList.contains('open')) { S = load(); render(); } });
  /* keep in step with the other devices: on open, when the tab comes back, and when the connection returns */
  window.addEventListener('online', () => syncPull({ force: true, quiet: true }));
  window.addEventListener('focus', () => syncPull({}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPull({}); });
  /* today's point on the chart always reflects the current numbers, including bills that came due since the last change */
  if (S.accounts.length) { snapshot(); save({ local: true }); }
  render();
  if (sync.code) syncPull({ force: true, quiet: true });
}
init();
})();
