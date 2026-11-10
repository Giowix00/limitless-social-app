const s = document.getElementById('s');
const refresh = async () => {
  const r = await chrome.runtime.sendMessage({ type: 'status' });
  const v = r.vision;
  s.textContent = [`attivo: ${r.active}`, `Discord: voce=${r.presence?.inVoice} canale=${r.presence?.rightChannel} cam=${r.presence?.cameraOn}`,
    `etichette cam: ${(r.presence?.labels || []).join(' | ') || '-'}`,
    v ? `volto=${v.face} mani=${v.hands} telefono=${v.phoneHeld} occhi_giu=${v.eyeDown?.toFixed(2)} pitch=${v.pitch?.toFixed(0)}` : 'visione: ' + (r.visionError || 'spenta'),
    `base: ${r.calib ? 'occhi=' + r.calib.eye.toFixed(2) + ' pitch=' + r.calib.pitch.toFixed(0) : 'non calibrato'}${r.calibrating ? ' (calibrazione...)' : ''}`,
    `timer: ${JSON.stringify(Object.fromEntries(Object.entries(r.since).map(([k, t]) => [k, Math.round((Date.now() - t) / 60000) + 'm'])))}`].join('\n');
};
refresh();
document.getElementById('p').onclick = async () => { await chrome.runtime.sendMessage({ type: 'calibrate' }); s.textContent = 'Calibrazione: guarda lo schermo per 15 secondi / look at the screen for 15 s'; };
document.getElementById('o').onclick = () => chrome.runtime.openOptionsPage();
