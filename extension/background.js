import { getCfg, inSchedule, MSG, fmt, sendTelegram } from './common.js';

const mem = { presence: null, vision: null, since: {}, lastTrue: {}, lastAlert: {}, pauseUntil: 0, blocking: null, active: false, visionError: null };

chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.storage.onChanged.addListener((c) => { if (c.cfg) { mem.blocking = null; evaluate(); } });
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => evaluate());

async function hasOffscreen() {
  const c = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return c.length > 0;
}
async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html', reasons: ['USER_MEDIA'],
    justification: 'Local webcam analysis during work hours'
  });
}
async function closeOffscreen() {
  if (await hasOffscreen()) await chrome.offscreen.closeDocument();
  mem.vision = null;
}

async function syncBlocking(cfg, active) {
  const want = active && cfg.blockSites;
  if (mem.blocking === want) return;
  mem.blocking = want;
  const add = want ? cfg.blocklist.map((d, i) => ({
    id: i + 1, priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { urlFilter: '||' + d, resourceTypes: ['main_frame'] }
  })) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: Array.from({ length: 200 }, (_, i) => i + 1), addRules: add
  });
}

async function log(entry) {
  const { events = [] } = await chrome.storage.local.get('events');
  events.push({ t: Date.now(), ...entry });
  await chrome.storage.local.set({ events: events.slice(-100) });
}

async function alertTeam(cfg, key, minutes) {
  const what = fmt(MSG[cfg.lang][key], { m: minutes });
  const text = fmt(MSG[cfg.lang].head, { name: cfg.name || '?', what });
  try { await sendTelegram(cfg, text); await log({ key, minutes, sent: true }); }
  catch (e) { await log({ key, minutes, sent: false, err: String(e) }); }
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icon.png', title: 'Locked In',
    message: fmt(MSG[cfg.lang].nudge, { what })
  });
}

async function evaluate() {
  const cfg = await getCfg();
  const now = Date.now();
  const active = cfg.enabled && (cfg.forceActive || inSchedule(cfg));
  mem.active = active;
  await syncBlocking(cfg, active);
  if (!active) { await closeOffscreen(); mem.since = {}; return; }
  await ensureOffscreen();

  const p = mem.presence;
  const inCh = !!(p && now - p.ts < 60000 && p.inVoice && p.rightChannel);
  const v = mem.vision && now - mem.vision.ts < 15000 ? mem.vision : null;
  const cond = {
    left: !inCh,
    camoff: inCh && !p.cameraOn,
    phone: !!(v && v.phoneHeld) && now > mem.pauseUntil,
    absent: !!v && !v.face && v.hands === 0,
    nohands: !!v && v.face && v.hands === 0
  };
  const thr = { left: cfg.leaveMin, camoff: cfg.leaveMin, phone: cfg.phoneMin, absent: cfg.absentMin, nohands: cfg.noHandsMin };
  for (const k of Object.keys(cond)) {
    if (cond[k]) { mem.since[k] ??= now; mem.lastTrue[k] = now; }
    else if (mem.since[k] && now - mem.lastTrue[k] > 30000) delete mem.since[k];
    if (mem.since[k] && now - mem.since[k] >= thr[k] * 60000 && now - (mem.lastAlert[k] || 0) >= cfg.cooldownMin * 60000) {
      mem.lastAlert[k] = now;
      await alertTeam(cfg, k, Math.round((now - mem.since[k]) / 60000));
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    if (msg.type === 'presence') { mem.presence = { ...msg, ts: Date.now() }; await evaluate(); reply({}); }
    else if (msg.type === 'vision') { mem.vision = { ...msg, ts: Date.now() }; mem.visionError = null; await evaluate(); reply({}); }
    else if (msg.type === 'visionError') { mem.visionError = msg.error; reply({}); }
    else if (msg.type === 'status') {
      reply({ active: mem.active, presence: mem.presence, vision: mem.vision, since: mem.since, pauseUntil: mem.pauseUntil, visionError: mem.visionError });
    } else if (msg.type === 'test') {
      const cfg = await getCfg();
      try { await sendTelegram(cfg, fmt(MSG[cfg.lang].test, { name: cfg.name || '?' })); reply({ ok: true }); }
      catch (e) { reply({ ok: false, error: String(e) }); }
    } else if (msg.type === 'pause') {
      const cfg = await getCfg();
      const day = new Date().toDateString();
      const { pauses = {} } = await chrome.storage.local.get('pauses');
      const n = pauses.day === day ? pauses.n : 0;
      if (n >= cfg.maxPausesPerDay) return reply({ ok: false, error: 'limit' });
      await chrome.storage.local.set({ pauses: { day, n: n + 1 } });
      mem.pauseUntil = Date.now() + cfg.pauseMin * 60000;
      delete mem.since.phone;
      try { await sendTelegram(cfg, fmt(MSG[cfg.lang].pause, { name: cfg.name || '?', m: cfg.pauseMin, n: n + 1, max: cfg.maxPausesPerDay })); } catch {}
      reply({ ok: true });
    }
  })();
  return true;
});
