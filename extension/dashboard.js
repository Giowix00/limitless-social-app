import { getCfg } from './common.js';
import { S, esc } from './i18n.js';
const cfg = await getCfg();
const t = S[cfg.lang];
const root = document.getElementById('root');
const day = (x) => new Date(x).toDateString();
const hm = (x) => new Date(x).toLocaleTimeString(cfg.lang === 'it' ? 'it-IT' : 'en-CA', { hour: '2-digit', minute: '2-digit' });
const pts = { yes: 1, partly: 0.5, no: 0 };
const pct = (cs) => (cs.length ? Math.round((100 * cs.reduce((s, c) => s + pts[c.productive], 0)) / cs.length) : null);
const pill = (txt, cls) => `<span class="pill ${cls}">${txt}</span>`;

async function render() {
  const [r, d] = await Promise.all([chrome.runtime.sendMessage({ type: 'status' }), chrome.storage.local.get(['checkins', 'events', 'days', 'unblocks'])]);
  const checkins = d.checkins || [], events = d.events || [], unblocks = d.unblocks || {};
  const today = day(Date.now());
  const cT = checkins.filter((c) => day(c.t) === today && c.productive);
  const eT = events.filter((e) => day(e.t) === today);
  const alerts = eT.filter((e) => ['left', 'camoff', 'absent', 'noresp'].includes(e.key)).length;
  const unb = eT.filter((e) => e.key === 'unblock').length;
  const p = r.presence, v = r.vision, fresh = p && Date.now() - p.ts < 60000;
  const inCall = fresh && p.inVoice && p.rightChannel;
  const prod = pct(cT);

  const items = [
    ...checkins.filter((c) => day(c.t) === today).map((c) => ({ t: c.t, html: `${pill(c.reason === 'periodic' ? '✅' : '⚠️', '')} ${esc(t.doing[c.doing] || c.doing)}${c.productive ? ` · ${esc(t.prod[c.productive])}` : ''}` })),
    ...eT.map((e) => ({ t: e.t, html: `${pill(e.key === 'unblock' ? '🔓' : '🚨', e.key === 'unblock' ? 'warn' : 'bad')} ${esc(t.ev[e.key] || e.key)}${e.site ? ': ' + esc(e.site) + ' (' + esc(e.reason) + ')' : ''}` }))
  ].sort((a, b) => b.t - a.t);

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const cs = checkins.filter((c) => day(c.t) === dt.toDateString() && c.productive);
    week.push({ l: dt.toLocaleDateString(cfg.lang === 'it' ? 'it-IT' : 'en-CA', { weekday: 'short' }), v: pct(cs) });
  }
  const dots = cT.map((c) => `<i title="${hm(c.t)}" style="background:var(--${{ yes: 'ok', partly: 'warn', no: 'bad' }[c.productive]})"></i>`).join('');
  const sites = cfg.blocklist.map((s) => unblocks[s] > Date.now() ? pill(`${esc(s)} · ${t.unlockedUntil} ${hm(unblocks[s])}`, 'warn') : pill(`${esc(s)} · ${t.blocked}`, '')).join('');
  const dayRev = (d.days || {})[today];

  root.innerHTML = `<header><h1>🔒 Locked In</h1>${pill(r.active ? t.active : t.outside, r.active ? 'ok' : '')}${cfg.forceActive ? pill(t.testMode, 'warn') : ''}<span class="sp"></span>
    <button class="sec" id="bc">${t.checkNow}</button><button class="sec" id="bl">${t.calibrate}</button><a class="btn sec" href="options.html">${t.settings}</a></header>
    <section class="grid">
      <div class="card"><div class="k">${cT.length}</div><div class="kl">${t.kCheckins}</div></div>
      <div class="card"><div class="k">${prod === null ? '-' : prod + '%'}</div><div class="kl">${t.kProd}</div><div class="dots">${dots}</div></div>
      <div class="card"><div class="k">${alerts}</div><div class="kl">${t.kAlerts}</div></div>
      <div class="card"><div class="k">${unb}</div><div class="kl">${t.kUnblocks}</div></div>
    </section>
    <section class="card" style="margin-bottom:12px"><h2>Live</h2>
      ${pill(`${t.discord}: ${inCall ? t.inCall : t.outCall}`, inCall ? 'ok' : 'bad')}${pill(`${t.camera}: ${fresh && p.cameraOn ? t.on : t.off}`, fresh && p.cameraOn ? 'ok' : 'bad')}
      ${v ? pill(`${t.face}: ${v.face ? t.present : t.absent}`, v.face ? 'ok' : 'bad') + pill(`${t.phone}: ${v.phoneHeld ? t.held : t.none}`, v.phoneHeld ? 'bad' : 'ok') + (v.eyeDown != null ? pill(`${t.gaze}: ${r.calib && (v.eyeDown - r.calib.eye > 0.2 || Math.abs(v.pitch - r.calib.pitch) > 15) ? t.down : t.ok}`, 'ok') : '') : pill(r.visionError ? esc(r.visionError.slice(0, 60)) : t.noVision, 'warn')}
      ${r.calibrating ? pill(t.calibrating, 'warn') : pill(`${t.calDone}: ${r.calib ? r.calib.eye.toFixed(2) + ' / ' + r.calib.pitch.toFixed(0) + '°' : t.notCal}`, '')}
      ${r.active && r.nextCheckin ? pill(`${t.next}: ${hm(r.nextCheckin)}`, '') : ''}
      ${dayRev ? pill(`★ ${dayRev.rating}/5`, 'ok') : ''}
    </section>
    <div class="cols"><section class="card"><h2>${t.today}</h2>${items.length ? `<ul class="tl">${items.map((i) => `<li><time>${hm(i.t)}</time><span>${i.html}</span></li>`).join('')}</ul>` : `<p class="kl">${t.empty}</p>`}</section>
    <section class="card"><h2>${t.week}</h2><div class="bars">${week.map((w) => `<div style="height:${w.v ?? 0}%"><span>${w.l}</span></div>`).join('')}</div><div style="height:14px"></div>
      <h2 style="margin-top:14px">${t.sites}</h2>${sites}</section></div>`;
  document.getElementById('bc').onclick = () => chrome.runtime.sendMessage({ type: 'testCheckin' });
  document.getElementById('bl').onclick = () => chrome.runtime.sendMessage({ type: 'calibrate' });
}
render(); setInterval(render, 4000);
