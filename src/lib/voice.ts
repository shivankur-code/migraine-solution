// Hold to talk, on phones. Speech is recognised on the phone itself (requiresOnDeviceRecognition):
// no audio leaves the device, so the App Store "Data Not Collected" label still holds. If a phone
// cannot recognise speech offline, voice is simply unavailable on it. The microphone is only on
// while a finger is held down; permissions are asked the first time someone holds, never at launch.
// The web build uses voice.web.ts instead (voice off: browsers send speech to a server).
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { HINT_WORDS } from '../engine/voice-commands.js';
import { restoreAudioMode } from './player';

/** `asked`: permission was just granted; the system sheet took the hold, so hold again. */
export type VoiceStatus = 'ready' | 'unsupported' | 'offline-missing' | 'denied' | 'asked' | 'installing' | 'maybe';

/** Whether this phone can listen offline. Cheap; safe to call on every screen visit. */
export async function voiceStatus(): Promise<VoiceStatus> {
  try {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return 'unsupported';
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() ? 'ready' : 'offline-missing';
  } catch { return 'unsupported'; }
}

let heard = '';
let ended: (() => void) | null = null;
let subs: { remove: () => void }[] = [];
const clear = () => { subs.forEach(s => { try { s.remove(); } catch {} }); subs = []; };

/** Start listening (finger down). Asks for the microphone the first time. */
export async function startListening(): Promise<VoiceStatus | 'listening'> {
  const status = await voiceStatus();
  if (status !== 'ready') return status;
  try {
    const now = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (!now.granted) {
      const asked = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return asked.granted ? 'asked' : 'denied';
    }
  } catch { return 'unsupported'; }
  clear(); heard = '';
  subs.push(ExpoSpeechRecognitionModule.addListener('result', e => { heard = e.results?.[0]?.transcript ?? heard; }));
  subs.push(ExpoSpeechRecognitionModule.addListener('end', () => { ended?.(); }));
  subs.push(ExpoSpeechRecognitionModule.addListener('error', () => { ended?.(); }));
  try {
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US', interimResults: true, continuous: true, requiresOnDeviceRecognition: true, addsPunctuation: false,
      contextualStrings: HINT_WORDS, iosTaskHint: 'confirmation',
      // Keep Still's sound playing (dipped) while listening, instead of the recogniser silencing it.
      iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'], mode: 'default' },
    });
  } catch { clear(); return 'unsupported'; }
  return 'listening';
}

/** Stop listening (finger up) and return what was heard, or '' if nothing. */
export function stopListening(): Promise<string> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; ended = null; clear(); restoreAudioMode().catch(() => {}); resolve(heard.trim()); };
    ended = finish;
    try { ExpoSpeechRecognitionModule.stop(); } catch { finish(); }
    setTimeout(finish, 1500);   // the final result normally arrives well before this
  });
}

/** The phone asks for the microphone itself (startListening returns 'denied'). */
export const micBlocked = () => false;
