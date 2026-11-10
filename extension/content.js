// Runs on discord.com. Reads voice state from the DOM (best effort, selectors may need tuning).
const DISCONNECT = /^(disconnect|disconnetti)/i;
const CAM_ON = /(turn off camera|disattiva (la )?(fotocamera|videocamera|camera)|stop video)/i;

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
  const cameraOn = buttons.some((b) => CAM_ON.test(b.getAttribute('aria-label') || ''));
  try { chrome.runtime.sendMessage({ type: 'presence', inVoice, rightChannel, cameraOn }); } catch {}
}
setInterval(scan, 5000);
scan();
