// Ears on the web: the browser's own speech recognition, used ONLY in its on-device mode
// (processLocally), so no audio leaves the computer. Chrome and Edge have it (since Chrome 139),
// and any browser that adds it later (Safari, Firefox) is picked up by the same check. Where a
// browser cannot promise on-device recognition, voice stays off and the room offers its
// "Say or type" box instead (on iPhone, the keyboard's own dictation is processed on the phone).
// Same interface as voice.ts (phones), so the room does not care which ears it has.
/** `maybe`: the browser has on-device mode, but we only ask whether English is there on the first hold. */
export type VoiceStatus = 'ready' | 'unsupported' | 'offline-missing' | 'denied' | 'asked' | 'installing' | 'maybe';

const LANG = 'en-US';
type Rec = {
  lang: string; processLocally: boolean; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecCtor = {
  new (): Rec;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};
const Ctor: RecCtor | undefined = typeof window === 'undefined' ? undefined : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/**
 * Cheap, on page load: 'maybe' when the browser offers on-device mode at all, else 'unsupported'.
 * Nothing touches speech recognition until someone holds to talk (`check` runs then).
 */
export async function voiceStatus(): Promise<VoiceStatus> {
  return Ctor && typeof Ctor.available === 'function' ? 'maybe' : 'unsupported';
}

/** 'ready' only when the browser promises on-device recognition for English; 'offline-missing' when it can download it. */
async function check(): Promise<VoiceStatus> {
  if (!Ctor || typeof Ctor.available !== 'function') return 'unsupported';
  try {
    const a = await Ctor.available({ langs: [LANG], processLocally: true });
    return a === 'available' ? 'ready' : a === 'downloadable' || a === 'downloading' ? 'offline-missing' : 'unsupported';
  } catch { return 'unsupported'; }
}

let rec: Rec | null = null;
let heard = '';
let blocked = false;
let ended: (() => void) | null = null;

/** Finger (or Space) down. The first time, the browser downloads its English pack instead: hold again after. */
export async function startListening(): Promise<VoiceStatus | 'listening'> {
  if (blocked) return 'denied';
  const status = await check();
  if (status === 'offline-missing') {
    try { Ctor?.install?.({ langs: [LANG], processLocally: true }); } catch {}
    return 'installing';
  }
  if (status !== 'ready' || !Ctor) return status;
  try {
    const r = new Ctor();
    r.lang = LANG; r.processLocally = true; r.continuous = true; r.interimResults = true;
    heard = '';
    r.onresult = e => { heard = Array.from(e.results).map(x => x[0]?.transcript ?? '').join(' '); };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') blocked = true; ended?.(); };
    r.onend = () => { ended?.(); };
    r.start();
    rec = r;
    return 'listening';
  } catch { return 'unsupported'; }
}

/** Finger (or Space) up: what was heard, or '' if nothing. */
export function stopListening(): Promise<string> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; ended = null; rec = null; resolve(heard.trim()); };
    ended = finish;
    try { rec?.stop(); } catch { finish(); }
    setTimeout(finish, 1500);
  });
}

/** True when the microphone was refused; the room says so once. */
export const micBlocked = () => blocked;
