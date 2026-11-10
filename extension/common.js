export const DEFAULTS = {
  enabled: true, forceActive: false, lang: 'it', name: '',
  token: '', chatId: '',
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  start: '15:00', end: '19:30', days: [1, 2, 3, 4, 5, 6],
  voiceName: 'Locked In',
  leaveMin: 2, phoneMin: 5, absentMin: 10, noHandsMin: 15, cooldownMin: 10,
  maxPausesPerDay: 3, pauseMin: 10,
  blockSites: true,
  blocklist: ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'reddit.com', 'youtube.com/shorts']
};

export async function getCfg() {
  const { cfg } = await chrome.storage.local.get('cfg');
  return { ...DEFAULTS, ...(cfg || {}) };
}

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function inSchedule(cfg, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const dow = DOW[get('weekday')];
  const mins = Number(get('hour')) * 60 + Number(get('minute'));
  const [sh, sm] = cfg.start.split(':').map(Number);
  const [eh, em] = cfg.end.split(':').map(Number);
  return cfg.days.includes(dow) && mins >= sh * 60 + sm && mins < eh * 60 + em;
}

export const MSG = {
  it: {
    head: '⚠️ {name} si sta distraendo: {what}',
    phone: 'telefono in mano da {m} min',
    absent: 'non è alla scrivania da {m} min',
    nohands: 'mani non visibili da {m} min',
    left: 'è fuori da Locked In da {m} min',
    camoff: 'ha la camera spenta da {m} min',
    pause: '⏸ {name} ha messo in pausa il controllo telefono per {m} min (pausa {n} di {max} oggi)',
    test: '✅ Test Locked In: {name} è collegato.',
    nudge: 'Torna al lavoro: {what}'
  },
  en: {
    head: '⚠️ {name} is getting distracted: {what}',
    phone: 'phone in hand for {m} min',
    absent: 'away from the desk for {m} min',
    nohands: 'hands not visible for {m} min',
    left: 'out of Locked In for {m} min',
    camoff: 'camera off for {m} min',
    pause: '⏸ {name} paused phone detection for {m} min (pause {n} of {max} today)',
    test: '✅ Locked In test: {name} is connected.',
    nudge: 'Back to work: {what}'
  }
};
export const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export async function sendTelegram(cfg, text) {
  if (!cfg.token || !cfg.chatId) throw new Error('Telegram not configured');
  const r = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: cfg.chatId, text })
  });
  if (!r.ok) throw new Error('Telegram ' + r.status + ' ' + (await r.text()));
}
