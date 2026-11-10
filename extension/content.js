// Runs on discord.com. Reads voice state from the DOM (best effort, selectors may need tuning).
const DISCONNECT = /^(disconnect|disconnetti)/i;
const CAM_WORD = /(camera|fotocamera|videocamera|webcam|turn (on|off) video|stop video)/i;
const OFF_VERB = /(turn off|stop|disattiva|spegni|interrompi|disabilita)/i;

async function scan() {
  const { cfg = {} } = await chrome.storage.local.get('cfg');
  const voiceName = (cfg.voiceName ?? 'Locked In').toLowerCase();
  const buttons = [...document.querySelectorAll('button, [role="button"]')];
  const disc = buttons.find((b) => DISCONNECT.test(b.getAttribute('aria-label') || ''));
  const inVoice = !!disc;
  let rightChannel = false;
  if (disc) {
    let el = disc;
    for (let i = 0; i < 8 && el; i++) {
      if ((el.textContent || '').toLowerCase().includes(voiceName)) { rightChannel = true; break; }
      el = el.parentElement;
    }
    if (!voiceName) rightChannel = true;
  }
  const camEls = [...document.querySelectorAll('[aria-label]')].filter((e) =>
    CAM_WORD.test(e.getAttribute('aria-label')) && e.matches('button,[role="button"],[role="switch"],[role="checkbox"]'));
  const labels = camEls.map((e) => e.getAttribute('aria-label')).slice(0, 6);
  let cameraOn = camEls.some((e) => OFF_VERB.test(e.getAttribute('aria-label')) ||
    e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-pressed') === 'true');
  if (!camEls.length) { // fallback: a live video tile is visible in the call
    cameraOn = [...document.querySelectorAll('video')].some((v) => v.readyState >= 2 && !v.paused &&
      v.srcObject?.getVideoTracks?.().some((t) => t.readyState === 'live'));
  }
  try { chrome.runtime.sendMessage({ type: 'presence', inVoice, rightChannel, cameraOn, labels }); } catch {}
}
setInterval(scan, 5000);
scan();
