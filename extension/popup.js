import { getCfg } from './common.js';
import { S } from './i18n.js';
const cfg = await getCfg();
const t = S[cfg.lang];
const root = document.getElementById('root');
const pill = (txt, cls) => `<span class="pill ${cls}">${txt}</span>`;
async function render() {
  const r = await chrome.runtime.sendMessage({ type: 'status' });
  const p = r.presence, v = r.vision;
  const fresh = p && Date.now() - p.ts < 60000;
  root.innerHTML = `<h1>🔒 Locked In</h1><p>${pill(r.active ? t.active : t.outside, r.active ? 'ok' : '')}${cfg.forceActive ? pill(t.testMode, 'warn') : ''}</p>
    <p>${pill(fresh && p.inVoice && p.rightChannel ? t.inCall : t.outCall, fresh && p.inVoice && p.rightChannel ? 'ok' : 'bad')}${pill(`${t.camera}: ${fresh && p.cameraOn ? t.on : t.off}`, fresh && p.cameraOn ? 'ok' : 'bad')}</p>
    <p>${v ? pill(`${t.face}: ${v.face ? t.present : t.absent}`, v.face ? 'ok' : 'bad') + pill(`${t.phone}: ${v.phoneHeld ? t.held : t.none}`, v.phoneHeld ? 'bad' : 'ok') : pill(r.visionError ? 'Camera: ' + r.visionError.slice(0, 40) : t.noVision, 'warn')}</p>
    <p><button id="d">${t.openDash}</button> <button class="sec" id="c">${t.checkNow}</button></p>`;
  document.getElementById('d').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  document.getElementById('c').onclick = () => { chrome.runtime.sendMessage({ type: 'testCheckin' }); window.close(); };
}
render(); setInterval(render, 3000);
