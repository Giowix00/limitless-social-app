import { getCfg, inSchedule, MSG, fmt, sendTelegram } from './common.js';

const mem = {
  presence: null, vision: null, since: {}, lastTrue: {}, lastAlert: {}, blocking: null, active: false, visionError: null,
  phoneOkUntil: 0, studyUntil: 0, nextCheckin: 0, prompt: null, calib: null, calibLoaded: false, calibSamples: null
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

chrome.runtime.onInstalled.addListener((d) => { if (d.reason === 'install') chrome.runtime.openOptionsPage(); });
chrome.storage.onChanged.addListener((c) => { if (c.cfg) { mem.blocking = null; evaluate(); } });
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => evaluate());

async function hasOffscreen() {
  return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;
}
async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Local webcam analysis during work hours' });
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
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: Array.from({ length: 200 }, (_, i) => i + 1), addRules: add });
}

async function log(entry) {
  const { events = [] } = await chrome.storage.local.get('events');
  events.push({ t: Date.now(), ...entry });
  await chrome.storage.local.set({ events: events.slice(-200) });
}

async function alertTeam(cfg, what, key) {
  const text = fmt(MSG[cfg.lang].head, { name: cfg.name || '?', what });
  try { await sendTelegram(cfg, text); await log({ key, what, sent: true }); }
  catch (e) { await log({ key, what, sent: false, err: String(e) }); }
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: 'Locked In', message: fmt(MSG[cfg.lang].nudge, { what }) });
}

async function openCheckin(cfg, reason, minutes) {
  if (mem.prompt) return;
  const w = await chrome.windows.create({ url: `checkin.html?reason=${reason}&m=${minutes || 0}`, type: 'popup', width: 440, height: 430, focused: true });
  mem.prompt = { reason, minutes: minutes || 0, openedAt: Date.now(), windowId: w.id };
}
async function closePrompt() {
  if (mem.prompt?.windowId) chrome.windows.remove(mem.prompt.windowId).catch(() => {});
  mem.prompt = null;
}

async function handleAnswer(cfg, answer, nextMin) {
  const p = mem.prompt;
  const now = Date.now();
  await closePrompt();
  delete mem.since.gaze; delete mem.since.phone;
  mem.nextCheckin = now + (nextMin || cfg.checkinMin) * 60000;
  await log({ key: 'answer', answer, reason: p?.reason });
  if (answer === 'phonework') {
    mem.phoneOkUntil = now + cfg.phoneWorkMin * 60000;
    try { await sendTelegram(cfg, fmt(MSG[cfg.lang].phonework, { name: cfg.name || '?', m: cfg.phoneWorkMin })); } catch {}
  } else if (answer === 'study') {
    mem.studyUntil = now + Math.min(nextMin || cfg.checkinMin, 60) * 60000;
  }
  // 'pc' and 'distracted': no alert, timers reset (self-correction is not punished)
}

async function handleTimeout(cfg) {
  const p = mem.prompt;
  await closePrompt();
  delete mem.since.gaze; delete mem.since.phone;
  mem.nextCheckin = Date.now() + cfg.checkinMin * 60000;
  const why = fmt(MSG[cfg.lang]['why_' + p.reason], { m: p.minutes });
  await alertTeam(cfg, fmt(MSG[cfg.lang].noresp, { why }), 'noresp');
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
  mem.active = active;
  await syncBlocking(cfg, active);
  if (!active) { await closeOffscreen(); await closePrompt(); mem.since = {}; mem.nextCheckin = 0; return; }
  await ensureOffscreen();
  if (!mem.nextCheckin) mem.nextCheckin = now + cfg.checkinMin * 60000;

  const p = mem.presence;
  const inCh = !!(p && now - p.ts < 60000 && p.inVoice && p.rightChannel);
  const v = mem.vision && now - mem.vision.ts < 15000 ? mem.vision : null;
  const c = mem.calib;
  const gazeDown = !!(v && v.face && c && v.eyeDown != null && ((v.eyeDown - c.eye) > 0.2 || (v.pitch != null && Math.abs(v.pitch - c.pitch) > 15)));
  const cond = {
    left: !inCh,
    camoff: inCh && !p.cameraOn,
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
    if (k === 'phone' || k === 'gaze') {
      if (inCh) await openCheckin(cfg, k, m);
    } else if (now - (mem.lastAlert[k] || 0) >= cfg.cooldownMin * 60000) {
      mem.lastAlert[k] = now;
      await alertTeam(cfg, fmt(MSG[cfg.lang][k], { m }), k);
    }
  }
  if (inCh && !mem.prompt && now >= mem.nextCheckin) await openCheckin(cfg, 'periodic', 0);
  if (mem.prompt && now - mem.prompt.openedAt > (cfg.answerSec + 5) * 1000) await handleTimeout(cfg);
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
      reply({ active: mem.active, presence: mem.presence, vision: mem.vision, since: mem.since, calib: mem.calib, calibrating: !!mem.calibSamples, visionError: mem.visionError, nextCheckin: mem.nextCheckin });
    } else if (msg.type === 'checkinAnswer') {
      const cfg = await getCfg();
      if (mem.prompt) await handleAnswer(cfg, msg.answer, msg.nextMin);
      reply({});
    } else if (msg.type === 'test') {
      const cfg = await getCfg();
      try { await sendTelegram(cfg, fmt(MSG[cfg.lang].test, { name: cfg.name || '?' })); reply({ ok: true }); }
      catch (e) { reply({ ok: false, error: String(e) }); }
    } else if (msg.type === 'testCheckin') {
      const cfg = await getCfg();
      await openCheckin(cfg, 'periodic', 0); reply({});
    }
  })();
  return true;
});
