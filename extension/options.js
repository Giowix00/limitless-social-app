import { getCfg } from './common.js';
const T = {
  it: { setup: 'Configurazione iniziale', steps: ['Su Telegram apri @BotFather, scrivi /newbot, copia il token.', 'Crea un gruppo con i 3 membri, aggiungi il bot, scrivi un messaggio nel gruppo.', 'Apri https://api.telegram.org/bot<TOKEN>/getUpdates e copia "chat":{"id": ...} (negativo per i gruppi).', 'Premi "Concedi camera", poi "Test Telegram", poi "Salva".', 'Apri Discord nel browser ed entra in Locked In con la camera accesa.'],
    name: 'Il tuo nome (come appare negli avvisi)', tz: 'Il tuo fuso orario (es. Europe/Rome, America/Vancouver)', voice: 'Nome del canale vocale', start: 'Inizio', end: 'Fine', days: 'Giorni (0=dom, 1=lun ... 6=sab)',
    phone: 'Avviso telefono dopo (min)', absent: 'Avviso assenza dopo (min)', gaze: 'Check-in dopo sguardo in basso (min)', checkin: 'Check-in periodico ogni (min)', pw: 'Telefono per lavoro: durata (min)', leave: 'Avviso uscita/camera off dopo (min)', block: 'Siti bloccati (uno per riga)', blockon: 'Blocca i siti durante l\'orario', force: 'Modalità test: ignora l\'orario (attiva sempre)',
    cam: 'Concedi camera', test: 'Test Telegram', save: 'Salva', saved: 'Salvato.', camok: 'Camera concessa.' },
  en: { setup: 'Initial setup', steps: ['In Telegram open @BotFather, send /newbot, copy the token.', 'Create a group with the 3 members, add the bot, post a message in the group.', 'Open https://api.telegram.org/bot<TOKEN>/getUpdates and copy "chat":{"id": ...} (negative for groups).', 'Press "Grant camera", then "Test Telegram", then "Save".', 'Open Discord in the browser and join Locked In with your camera on.'],
    name: 'Your name (shown in alerts)', tz: 'Your time zone (e.g. Europe/Rome, America/Vancouver)', voice: 'Voice channel name', start: 'Start', end: 'End', days: 'Days (0=Sun, 1=Mon ... 6=Sat)',
    phone: 'Phone alert after (min)', absent: 'Away alert after (min)', gaze: 'Check-in after looking down (min)', checkin: 'Periodic check-in every (min)', pw: 'Phone for work: duration (min)', leave: 'Left/camera-off alert after (min)', block: 'Blocked sites (one per line)', blockon: 'Block sites during work hours', force: 'Test mode: ignore schedule (always on)',
    cam: 'Grant camera', test: 'Test Telegram', save: 'Save', saved: 'Saved.', camok: 'Camera granted.' }
};
const $ = (id) => document.getElementById(id);
const textIds = { l_name: 'name', l_tz: 'tz', l_voice: 'voice', l_start: 'start', l_end: 'end', l_days: 'days', l_phone: 'phone', l_absent: 'absent', l_gaze: 'gaze', l_checkin: 'checkin', l_pw: 'pw', l_leave: 'leave', l_block: 'block', l_blockon: 'blockon', l_force: 'force', cam: 'cam', test: 'test', save: 'save', t_setup: 'setup' };
function applyLang(l) {
  for (const [id, k] of Object.entries(textIds)) $(id).textContent = T[l][k];
  $('steps').innerHTML = T[l].steps.map((s) => `<li>${s}</li>`).join('');
}
const cfg = await getCfg();
for (const k of ['name', 'token', 'chatId', 'tz', 'voiceName', 'start', 'end', 'phoneMin', 'absentMin', 'gazeMin', 'leaveMin', 'checkinMin', 'phoneWorkMin']) $(k).value = cfg[k];
$('days').value = cfg.days.join(',');
$('blocklist').value = cfg.blocklist.join('\n');
$('blockSites').checked = cfg.blockSites;
$('forceActive').checked = cfg.forceActive;
$('lang').value = cfg.lang;
applyLang(cfg.lang);
$('lang').onchange = () => applyLang($('lang').value);

async function save() {
  const c = { ...cfg, lang: $('lang').value, days: $('days').value.split(',').map((x) => Number(x.trim())).filter((n) => n >= 0 && n <= 6), blocklist: $('blocklist').value.split('\n').map((s) => s.trim()).filter(Boolean), blockSites: $('blockSites').checked, forceActive: $('forceActive').checked };
  for (const k of ['name', 'token', 'chatId', 'tz', 'voiceName', 'start', 'end']) c[k] = $(k).value.trim();
  for (const k of ['phoneMin', 'absentMin', 'gazeMin', 'leaveMin', 'checkinMin', 'phoneWorkMin']) c[k] = Number($(k).value);
  await chrome.storage.local.set({ cfg: c });
  $('msg').textContent = T[c.lang].saved;
}
$('save').onclick = save;
$('test').onclick = async () => { await save(); const r = await chrome.runtime.sendMessage({ type: 'test' }); $('msg').textContent = r.ok ? 'OK' : r.error; };
$('cam').onclick = async () => {
  try { (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach((t) => t.stop()); $('msg').textContent = T[$('lang').value].camok; }
  catch (e) { $('msg').textContent = String(e); }
};
