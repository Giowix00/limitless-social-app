const s = document.getElementById('s');
const refresh = async () => {
  const r = await chrome.runtime.sendMessage({ type: 'status' });
  const v = r.vision;
  s.textContent = [`attivo: ${r.active}`, `Discord: voce=${r.presence?.inVoice} canale=${r.presence?.rightChannel} cam=${r.presence?.cameraOn}`,
    `etichette cam: ${(r.presence?.labels || []).join(' | ') || '-'}`,
    v ? `volto=${v.face} mani=${v.hands} telefono=${v.phoneHeld}` : 'visione: ' + (r.visionError || 'spenta'),
    `timer: ${JSON.stringify(Object.fromEntries(Object.entries(r.since).map(([k, t]) => [k, Math.round((Date.now() - t) / 60000) + 'm'])))}`].join('\n');
};
refresh();
document.getElementById('p').onclick = async () => { const r = await chrome.runtime.sendMessage({ type: 'pause' }); s.textContent = r.ok ? 'Pausa attiva / paused' : 'Limite pause raggiunto / limit reached'; };
document.getElementById('o').onclick = () => chrome.runtime.openOptionsPage();
