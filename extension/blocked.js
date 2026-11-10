import { getCfg } from './common.js';
import { S, esc } from './i18n.js';
const cfg = await getCfg();
const t = S[cfg.lang].bl;
const site = new URLSearchParams(location.search).get('d') || '';
document.getElementById('root').innerHTML = `<div class="card"><h1>🔒 ${t.title}</h1><p>${esc(t.body.replace('{site}', site))}</p>
  <label>${t.why}</label><textarea id="why" rows="3"></textarea>
  <label>${t.dur}</label><select id="m"><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option></select>
  <p><button id="go">${t.req}</button> <button class="sec" id="back">${t.back}</button></p><p class="kl" id="err"></p></div>`;
document.getElementById('back').onclick = () => window.close();
document.getElementById('go').onclick = async () => {
  const reason = document.getElementById('why').value;
  if (reason.trim().length < 15) { document.getElementById('err').textContent = t.short; return; }
  const r = await chrome.runtime.sendMessage({ type: 'unblock', entry: site, reason, minutes: Number(document.getElementById('m').value) });
  if (r.ok) setTimeout(() => (location.href = 'https://' + site), 800);
};
