import { getCfg } from './common.js';
import { S, esc } from './i18n.js';
const cfg = await getCfg();
const t = S[cfg.lang];
const reason = new URLSearchParams(location.search).get('reason');
const root = document.getElementById('root');
const send = async (m) => { await chrome.runtime.sendMessage({ type: 'checkinAnswer', ...m }); window.close(); };
let left = cfg.answerSec;
const timer = () => `<p class="kl" id="tm">${t.ci.left} ${left}s</p>`;
if (reason !== 'eod') setInterval(() => { left = Math.max(0, left - 1); const e = document.getElementById('tm'); if (e) e.textContent = `${t.ci.left} ${left}s`; }, 1000);

if (reason === 'gaze' || reason === 'phone') {
  root.innerHTML = `<h1>${t.ci.title}</h1><p class="kl">${t.ci[reason]}</p>` +
    Object.keys(t.ci.a).map((k) => `<button class="opt" style="display:block;width:100%;text-align:left;padding:12px" data-a="${k}">${t.ci.a[k]}</button>`).join('') +
    `<label>${t.ci.next}</label><select id="nx"><option>30</option><option>45</option><option>60</option></select>` + timer();
  document.getElementById('nx').value = String(cfg.checkinMin);
  root.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => send({ answer: b.dataset.a, nextMin: Number(document.getElementById('nx').value) }));
} else if (reason === 'periodic') {
  let doing = null, prod = null;
  const keys = ['pc', 'phonework', 'study', 'break', 'distracted'];
  const icon = { pc: '💻', phonework: '📱', study: '📖', break: '☕', distracted: '😵' };
  root.innerHTML = `<h1>${t.ci.title}</h1><h2>${t.ci.q1}</h2><div id="q1">${keys.map((k) => `<button class="opt" data-k="${k}">${icon[k]} ${t.doing[k]}</button>`).join('')}</div>
    <h2 style="margin-top:14px">${t.ci.q2}</h2><div id="q2">${['yes', 'partly', 'no'].map((k) => `<button class="opt" data-k="${k}">${t.prod[k]}</button>`).join('')}</div>
    <label>${t.ci.next}</label><select id="nx"><option>30</option><option>45</option><option>60</option></select>
    <p><button id="go" disabled>${t.ci.send}</button></p>` + timer();
  document.getElementById('nx').value = String(cfg.checkinMin);
  const upd = () => { document.getElementById('go').disabled = !(doing && prod); };
  const wire = (id, set) => root.querySelectorAll(`#${id} .opt`).forEach((b) => b.onclick = () => { root.querySelectorAll(`#${id} .opt`).forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); set(b.dataset.k); upd(); });
  wire('q1', (k) => (doing = k)); wire('q2', (k) => (prod = k));
  document.getElementById('go').onclick = () => send({ answer: doing, productive: prod, nextMin: Number(document.getElementById('nx').value) });
} else {
  let rating = null;
  root.innerHTML = `<h1>${t.ci.eodQ1}</h1><div id="r">${[1, 2, 3, 4, 5].map((n) => `<button class="opt" data-k="${n}">${'★'.repeat(n)}</button>`).join('')}</div>
    <h2 style="margin-top:14px">${t.ci.eodQ2}</h2><textarea id="imp" rows="4"></textarea><p><button id="go" disabled>${t.ci.eodSend}</button></p>`;
  root.querySelectorAll('.opt').forEach((b) => b.onclick = () => { root.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); rating = Number(b.dataset.k); document.getElementById('go').disabled = false; });
  document.getElementById('go').onclick = () => send({ rating, improve: document.getElementById('imp').value.trim() });
}
