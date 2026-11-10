import { getCfg } from './common.js';
const cfg = await getCfg();
const q = new URLSearchParams(location.search);
const L = {
  it: { h: 'Check-in: cosa stai facendo?', gaze: 'Stai guardando in basso da un po\'.', phone: 'Sembra che tu abbia il telefono in mano.', periodic: 'Check-in periodico.', pc: '💻 Sto lavorando al PC', pw: '📱 Telefono, ma per lavoro', st: '📖 Sto studiando / scrivo su carta', di: '😅 Mi stavo distraendo (torno al lavoro)', next: 'Prossimo check-in tra', left: 'Rispondi entro' },
  en: { h: 'Check-in: what are you doing?', gaze: 'You have been looking down for a while.', phone: 'It looks like you are holding your phone.', periodic: 'Periodic check-in.', pc: '💻 Working on the PC', pw: '📱 Phone, but for work', st: '📖 Studying / writing on paper', di: '😅 I was getting distracted (back to work)', next: 'Next check-in in', left: 'Answer within' }
}[cfg.lang];
const $ = (i) => document.getElementById(i);
$('h').textContent = L.h; $('r').textContent = L[q.get('reason')] || ''; $('b_pc').textContent = L.pc; $('b_pw').textContent = L.pw; $('b_st').textContent = L.st; $('b_di').textContent = L.di; $('l_next').textContent = L.next;
$('next').value = String(cfg.checkinMin);
let left = cfg.answerSec;
const tick = () => { $('t').textContent = `${L.left} ${left}s`; if (left-- <= 0) clearInterval(iv); };
const iv = setInterval(tick, 1000); tick();
document.querySelectorAll('button').forEach((b) => b.onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'checkinAnswer', answer: b.dataset.a, nextMin: Number($('next').value) });
  window.close();
});
