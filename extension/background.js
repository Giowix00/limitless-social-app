import { getCfg, inSchedule, MSG, fmt, sendTelegram } from './common.js';

const mem = {
  presence: null, vision: null, since: {}, lastTrue: {}, lastAlert: {}, blockSig: null, active: false, wasActive: false, visionError: null,
  phoneOkUntil: 0, studyUntil: 0, nextCheckin: 0, prompt: null, calib: null, calibLoaded: false, calibSamples: null
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const dayKey = (t = Date.now()) => new Date(t).toDateString();

async function push(key, item, max = 500) {
  const o = await chrome.storage.local.get(key);
  await chrome.storage.local.set({ [key]: [...(o[key] || []), { t: Date.now(), ...item }].slice(-max) });
}

chrome.runtime.onInstalled.addListener((d) => { if (d.reason === 'install') chrome.runtime.openOptionsPage(); });
chrome.storage.onChanged.addListener((c) => { if (c.cfg || c.unblocks) { mem.blockSig = null; evaluate(); } });
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => { devReload(); evaluate(); });

// Dev convenience: an unpacked extension reloads itself when its files change on disk.
const DEV_FILES = ['manifest.json', 'background.js', 'common.js', 'i18n.js', 'content.js', 'offscreen.js', 'checkin.js', 'checkin.html', 'dashboard.js', 'dashboard.html', 'popup.js', 'popup.html', 'blocked.js', 'blocked.html', 'options.js', 'options.html', 'ui.css'];
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
async function devReload() {
  if (chrome.runtime.getManifest().update_url) return;
  let h = '';
  for (const f of DEV_FILES) {
    try { const t = await (await fetch(chrome.runtime.getURL(f) + '?' + Date.now(), { cache: 'no-store' })).text(); h += f + hash(t) + ';'; } catch {}
  }
  const { devhash } = await chrome.storage.session.get('devhash');
  await chrome.storage.session.set({ devhash: h });
  if (devhash && devhash !== h) chrome.runtime.reload();
}

async function hasOffscreen() { return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0; }
async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Local webcam analysis during work hours' });
}
async function closeOffscreen() { if (await hasOffscreen()) await chrome.offscreen.closeDocument(); mem.vision = null; }

async function syncBlocking(cfg, active) {
  const { unblocks = {} } = await chrome.storage.local.get('unblocks');
  const now = Date.now();
  const list = active && cfg.blockSites ? cfg.blocklist.filter((d) => !(unblocks[d] > now)) : [];
  const sig = list.join('|');
  if (mem.blockSig === sig) return;
  mem.blockSig = sig;
  const add = list.map((d, i) => ({
    id: i + 1, priority: 1,
    action: { type: 'redirect', redirect: { url: chrome.runtime.getURL('blocked.html') + '?d=' + encodeURIComponent(d) } },
    condition: { urlFilter: '||' + d, resourceTypes: ['main_frame'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: Array.from({ length: 200 }, (_, i) => i + 1), addRules: add });
}

async function tg(cfg, text) { try { await sendTelegram(cfg, text); return true; } catch { return false; } }

async function alertTeam(cfg, what, key) {
  const sent = await tg(cfg, fmt(MSG[cfg.lang].head, { name: cfg.name || '?', what }));
  await push('events', { key, what, sent });
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: 'Locked In', message: fmt(MSG[cfg.lang].nudge, { what }) });
}

async function openCheckin(cfg, reason, minutes) {
  if (mem.prompt) return;
  const w = await chrome.windows.create({ url: `checkin.html?reason=${reason}&m=${minutes || 0}`, type: 'popup', width: 460, height: reason === 'eod' ? 520 : 560, focused: true });
  mem.prompt = { reason, minutes: minutes || 0, openedAt: Date.now(), windowId: w.id };
}
async function closePrompt() {
  if (mem.prompt?.windowId) chrome.windows.remove(mem.prompt.windowId).catch(() => {});
  mem.prompt = null;
}

async function handleAnswer(cfg, a) {
  const p = mem.prompt;
  const now = Date.now();
  await closePrompt();
  const M = MSG[cfg.lang];
  if (p?.reason === 'eod') {
    const { checkins = [], events = [] } = await chrome.storage.local.get(['checkins', 'events']);
    const cs = checkins.filter((c) => dayKey(c.t) === dayKey() && c.productive);
    const pts = cs.reduce((s, c) => s + ({ yes: 1, partly: 0.5, no: 0 }[c.productive] ?? 0), 0);
    const pct = cs.length ? Math.round((100 * pts) / cs.length) : 0;
    const al = events.filter((e) => dayKey(e.t) === dayKey() && ['left', 'camoff', 'absent', 'noresp'].includes(e.key)).length;
    const { days = {} } = await chrome.storage.local.get('days');
    days[dayKey()] = { rating: a.rating, improve: a.improve, pct };
    await chrome.storage.local.set({ days });
    await tg(cfg, fmt(M.eod, { name: cfg.name || '?', n: cs.length, pct, a: al, rating: a.rating, improve: a.improve || '-' }));
    return;
  }
  delete mem.since.gaze; delete mem.since.phone;
  mem.nextCheckin = now + (a.nextMin || cfg.checkinMin) * 60000;
  await push('checkins', { reason: p?.reason, doing: a.answer, productive: a.productive });
  if (p?.reason === 'periodic' && cfg.postCheckins) {
    const time = new Date().toLocaleTimeString(cfg.lang === 'it' ? 'it-IT' : 'en-CA', { hour: '2-digit', minute: '2-digit', timeZone: cfg.tz });
    await tg(cfg, fmt(M.checkin, { name: cfg.name || '?', time, doing: M.doing[a.answer] || a.answer, prod: M.prod[a.productive] || '-' }));
  }
  if (a.answer === 'phonework') {
    mem.phoneOkUntil = now + cfg.phoneWorkMin * 60000;
    if (p?.reason !== 'periodic' || !cfg.postCheckins) await tg(cfg, fmt(M.phonework, { name: cfg.name || '?', m: cfg.phoneWorkMin }));
  } else if (a.answer === 'study') {
    mem.studyUntil = now + Math.min(a.nextMin || cfg.checkinMin, 60) * 60000;
  }
  // 'pc', 'break', 'distracted': no alert. Admitting a distraction is not punished.
}

async function handleTimeout(cfg) {
  const p = mem.prompt;
  await closePrompt();
  delete mem.since.gaze; delete mem.since.phone;
  mem.nextCheckin = Date.now() + cfg.checkinMin * 60000;
  const M = MSG[cfg.lang];
  await alertTeam(cfg, fmt(M.noresp, { why: fmt(M['why_' + p.reason], { m: p.minutes }) }), 'noresp');
}

async function loadCalib() {
  if (mem.calibLoaded) return;
  mem.calibLoaded = true;
  mem.calib = (await chrome.storage.local.get('calib')).calib || null;
}

async function evaluate() {
  const cfg = await getCfg();
  await loadCalib();
  const now = Date.now();
  const active = cfg.enabled && (cfg.forceActive || inSchedule(cfg));
  const was = mem.wasActive;
  mem.active = active; mem.wasActive = active;
  await syncBlocking(cfg, active);
  if (!active) {
    await closeOffscreen(); mem.since = {}; mem.nextCheckin = 0;
    if (was) {
      const { checkins = [] } = await chrome.storage.local.get('checkins');
      await closePrompt();
      if (checkins.some((c) => dayKey(c.t) === dayKey() && c.productive)) await openCheckin(cfg, 'eod', 0);
    }
    return;
  }
  await ensureOffscreen();
  if (!mem.nextCheckin) mem.nextCheckin = now + cfg.checkinMin * 60000;

  const p = mem.presence;
  const inCh = !!(p && now - p.ts < 60000 && p.inVoice && p.rightChannel);
  const v = mem.vision && now - mem.vision.ts < 15000 ? mem.vision : null;
  const c = mem.calib;
  const gazeDown = !!(v && v.face && c && v.eyeDown != null && ((v.eyeDown - c.eye) > 0.2 || (v.pitch != null && Math.abs(v.pitch - c.pitch) > 15)));
  const cond = {
    left: !inCh, camoff: inCh && !p.cameraOn,
    absent: !!v && !v.face && v.hands === 0,
    phone: !!(v && v.phoneHeld) && now > mem.phoneOkUntil,
    gaze: gazeDown && now > mem.studyUntil && now > mem.phoneOkUntil
  };
  const thr = { left: cfg.leaveMin, camoff: cfg.leaveMin, absent: cfg.absentMin, phone: cfg.phoneMin, gaze: cfg.gazeMin };
  for (const k of Object.keys(cond)) {
    if (cond[k]) { mem.since[k] ??= now; mem.lastTrue[k] = now; }
    else if (mem.since[k] && now - mem.lastTrue[k] > 30000) delete mem.since[k];
    if (!(mem.since[k] && now - mem.since[k] >= thr[k] * 60000)) continue;
    const m = Math.round((now - mem.since[k]) / 60000);
    if (k === 'phone' || k === 'gaze') { if (inCh) await openCheckin(cfg, k, m); }
    else if (now - (mem.lastAlert[k] || 0) >= cfg.cooldownMin * 60000) {
      mem.lastAlert[k] = now;
      await alertTeam(cfg, fmt(MSG[cfg.lang][k], { m }), k);
    }
  }
  if (inCh && !mem.prompt && now >= mem.nextCheckin) await openCheckin(cfg, 'periodic', 0);
  if (mem.prompt && mem.prompt.reason !== 'eod' && now - mem.prompt.openedAt > (cfg.answerSec + 5) * 1000) await handleTimeout(cfg);
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    if (msg.type === 'presence') { mem.presence = { ...msg, ts: Date.now() }; await evaluate(); reply({}); }
    else if (msg.type === 'vision') {
      await loadCalib();
      mem.vision = { ...msg, ts: Date.now() }; mem.visionError = null;
      if (msg.face && msg.eyeDown != null && msg.pitch != null) {
        if (!mem.calib && !mem.calibSamples) mem.calibSamples = [];
        if (mem.calibSamples) {
          mem.calibSamples.push({ e: msg.eyeDown, p: msg.pitch });
          if (mem.calibSamples.length >= 8) {
            mem.calib = { eye: median(mem.calibSamples.map((s) => s.e)), pitch: median(mem.calibSamples.map((s) => s.p)) };
            mem.calibSamples = null;
            await chrome.storage.local.set({ calib: mem.calib });
          }
        }
      }
      await evaluate(); reply({});
    }
    else if (msg.type === 'visionError') { mem.visionError = msg.error; reply({}); }
    else if (msg.type === 'calibrate') { mem.calibSamples = []; reply({ ok: true }); }
    else if (msg.type === 'status') {
      reply({ active: mem.active, presence: mem.presence, vision: mem.vision, calib: mem.calib, calibrating: !!mem.calibSamples, visionError: mem.visionError, nextCheckin: mem.nextCheckin });
    } else if (msg.type === 'checkinAnswer') {
      const cfg = await getCfg();
      if (mem.prompt) await handleAnswer(cfg, msg);
      reply({});
    } else if (msg.type === 'testCheckin') {
      await openCheckin(await getCfg(), 'periodic', 0); reply({});
    } else if (msg.type === 'test') {
      const cfg = await getCfg();
      try { await sendTelegram(cfg, fmt(MSG[cfg.lang].test, { name: cfg.name || '?' })); reply({ ok: true }); }
      catch (e) { reply({ ok: false, error: String(e) }); }
    } else if (msg.type === 'unblock') {
      const cfg = await getCfg();
      if (!msg.reason || msg.reason.trim().length < 15) return reply({ ok: false });
      const { unblocks = {} } = await chrome.storage.local.get('unblocks');
      unblocks[msg.entry] = Date.now() + msg.minutes * 60000;
      await chrome.storage.local.set({ unblocks });
      await push('events', { key: 'unblock', site: msg.entry, reason: msg.reason.trim(), minutes: msg.minutes });
      await tg(cfg, fmt(MSG[cfg.lang].unblock, { name: cfg.name || '?', site: msg.entry, m: msg.minutes, reason: msg.reason.trim() }));
      reply({ ok: true });
    }
  })();
  return true;
});
