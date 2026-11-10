export const S = {
  it: {
    active: 'Attivo ora', outside: 'Fuori orario', testMode: 'Modalità test', discord: 'Discord', inCall: 'In Locked In', outCall: 'Fuori dal canale', camera: 'Camera', on: 'accesa', off: 'spenta',
    face: 'Volto', phone: 'Telefono', gaze: 'Sguardo', present: 'presente', absent: 'assente', held: 'in mano', none: 'no', down: 'in basso', ok: 'ok', noVision: 'Camera di analisi non attiva',
    kCheckins: 'Check-in oggi', kProd: 'Produttività', kAlerts: 'Avvisi al team', kUnblocks: 'Sblocchi sito',
    today: 'Oggi', empty: 'Ancora niente oggi.', week: 'Ultimi 7 giorni (produttività)', sites: 'Siti bloccati', unlockedUntil: 'sbloccato fino alle', blocked: 'bloccato',
    checkNow: 'Check-in ora', calibrate: 'Calibra sguardo', settings: 'Impostazioni', openDash: 'Apri dashboard', calibrating: 'Calibrazione: guarda lo schermo per 15 secondi', calDone: 'Base occhi/testa', notCal: 'non calibrato', next: 'Prossimo check-in',
    ev: { left: 'Fuori da Locked In', camoff: 'Camera spenta', absent: 'Assente dalla scrivania', noresp: 'Check-in senza risposta', unblock: 'Sblocco sito' },
    doing: { pc: 'Lavoro al PC', phonework: 'Telefono per lavoro', study: 'Studio su carta', break: 'Pausa', distracted: 'Distratto' },
    prod: { yes: 'Sì', partly: 'In parte', no: 'No' },
    ci: { title: 'Check-in', q1: 'Cosa stai facendo?', q2: 'Sei stato produttivo nell\'ultima mezz\'ora?', next: 'Prossimo check-in tra', send: 'Invia', left: 'Rispondi entro', gaze: 'Stai guardando in basso da un po\'.', phone: 'Sembra che tu abbia il telefono in mano.', periodic: 'Check-in periodico.', eodQ1: 'Com\'è andata oggi?', eodQ2: 'Cosa posso migliorare domani?', eodSend: 'Chiudi la giornata', a: { pc: '💻 Sto lavorando al PC', phonework: '📱 Telefono, ma per lavoro', study: '📖 Sto studiando / scrivo su carta', distracted: '😅 Mi stavo distraendo, torno al lavoro' } },
    bl: { title: 'Sito bloccato', body: '{site} è bloccato durante l\'orario di lavoro.', why: 'Perché ti serve? (minimo 15 caratteri, il motivo lo vede il team)', dur: 'Per quanto tempo', req: 'Sblocca', back: 'Torna al lavoro', short: 'Motivo troppo breve' }
  },
  en: {
    active: 'Active now', outside: 'Outside hours', testMode: 'Test mode', discord: 'Discord', inCall: 'In Locked In', outCall: 'Not in the channel', camera: 'Camera', on: 'on', off: 'off',
    face: 'Face', phone: 'Phone', gaze: 'Gaze', present: 'present', absent: 'absent', held: 'in hand', none: 'no', down: 'down', ok: 'ok', noVision: 'Analysis camera not running',
    kCheckins: 'Check-ins today', kProd: 'Productivity', kAlerts: 'Team alerts', kUnblocks: 'Site unblocks',
    today: 'Today', empty: 'Nothing yet today.', week: 'Last 7 days (productivity)', sites: 'Blocked sites', unlockedUntil: 'unlocked until', blocked: 'blocked',
    checkNow: 'Check in now', calibrate: 'Calibrate gaze', settings: 'Settings', openDash: 'Open dashboard', calibrating: 'Calibrating: look at the screen for 15 seconds', calDone: 'Eye/head baseline', notCal: 'not calibrated', next: 'Next check-in',
    ev: { left: 'Left Locked In', camoff: 'Camera off', absent: 'Away from desk', noresp: 'Check-in not answered', unblock: 'Site unblock' },
    doing: { pc: 'Working on PC', phonework: 'Phone for work', study: 'Studying on paper', break: 'Break', distracted: 'Distracted' },
    prod: { yes: 'Yes', partly: 'Partly', no: 'No' },
    ci: { title: 'Check-in', q1: 'What are you doing?', q2: 'Were you productive in the last half hour?', next: 'Next check-in in', send: 'Submit', left: 'Answer within', gaze: 'You have been looking down for a while.', phone: 'It looks like you are holding your phone.', periodic: 'Periodic check-in.', eodQ1: 'How did today go?', eodQ2: 'What can I improve tomorrow?', eodSend: 'Close the day', a: { pc: '💻 Working on the PC', phonework: '📱 Phone, but for work', study: '📖 Studying / writing on paper', distracted: '😅 I was getting distracted, back to work' } },
    bl: { title: 'Site blocked', body: '{site} is blocked during work hours.', why: 'Why do you need it? (min. 15 characters, the team will see it)', dur: 'For how long', req: 'Unblock', back: 'Back to work', short: 'Reason too short' }
  }
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
