// Voice for any screen: the ears (hold to talk, or hold Space on a computer), the brain
// (lib/interpret) and the feedback (one light tap when done, two soft taps when not understood).
// Each screen brings only its own hands: `apply` turns the gentle intents into changes there.
// See design/voice.md.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as player from './player';
import { track } from './activity';
import { interpret, type Heard } from './interpret';
import { micBlocked, startListening, stopListening, voiceStatus, type VoiceStatus } from './voice';
import { DIALS } from '../components/Studio';
import type { Profile } from './profile';
import { recipeFor } from './profile';

/** Heard and done: one light tap. */
export const confirmTap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
/** Not understood: two soft taps, and nothing changes. */
export const notUnderstood = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}), 160);
};

/** The dial each "one step gentler" intent turns, and the words for it. */
export const DIAL_FOR: Record<string, 'tone' | 'hum' | 'motion' | 'space'> = { darker: 'tone', 'less-hum': 'hum', stiller: 'motion', closer: 'space' };
export const SAID: Record<string, string> = { darker: 'Darker', 'less-hum': 'Less hum', stiller: 'Stiller', closer: 'Closer', softer: 'Softer', rain: 'Rain', ocean: 'Ocean', fan: 'Fan', hush: 'Hush', play: 'Playing' };
export const AT_END: Record<string, string> = { darker: 'Already deepest', 'less-hum': 'No hum already', stiller: 'Already still', closer: 'Already closest' };
export const TEXTURE_FOR: Record<string, NonNullable<Profile['intake']['texture']>> = { rain: 'rain', ocean: 'ocean', fan: 'fan', hush: 'none' };

/**
 * Apply the dial and texture intents to a profile: one step gentler per dial, or a texture.
 * Returns the new profile, whether it changed, and short words for what happened.
 */
export function gentler(profile: Profile, intents: string[]): { profile: Profile; changed: boolean; done: string[] } {
  let p = profile, changed = false;
  const done: string[] = [];
  for (const i of intents) {
    const dial = DIAL_FOR[i];
    if (dial) {
      const at = DIALS[dial].index(recipeFor(p, 'normal').recipe);
      if (at > 0) { p = { ...p, tests: { ...p.tests, ...DIALS[dial].tests(at - 1) } }; changed = true; done.push(SAID[i]); }
      else done.push(AT_END[i]);
    } else if (TEXTURE_FOR[i]) {
      if (p.intake.texture !== TEXTURE_FOR[i]) { p = { ...p, intake: { ...p.intake, texture: TEXTURE_FOR[i] } }; changed = true; }
      done.push(SAID[i]);
    }
  }
  return { profile: p, changed, done };
}

export function useVoice({ consentAI, apply, say }: {
  consentAI: boolean;
  /** This screen's hands: make the change. */
  apply: (heard: Heard) => Promise<void> | void;
  /** Show one short line (the screen may choose to stay silent, e.g. on the dark screen). */
  say: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const [voiceOk, setVoiceOk] = useState<VoiceStatus>('unsupported');
  useEffect(() => { let on = true; voiceStatus().then(s => { if (on) setVoiceOk(s); }).catch(() => {}); return () => { on = false; }; }, []);
  const canHold = voiceOk === 'ready' || voiceOk === 'offline-missing' || voiceOk === 'maybe';
  // The latest screen callbacks, so the key listener never holds a stale one.
  const props = useRef({ consentAI, apply, say });
  props.current = { consentAI, apply, say };

  /** Words from any ear (voice or the box) through the brain to this screen's hands. */
  const handleWords = useCallback(async (words: string, from: 'voice' | 'typed') => {
    const heard = await interpret(words, { consentAI: props.current.consentAI });
    if (!heard) { notUnderstood(); props.current.say(from === 'typed' ? 'Not sure what that means.' : ''); return; }
    track('voice', { intents: heard.intents.join(','), timer: heard.timer, by: heard.by, from });
    await props.current.apply(heard);
    confirmTap();
  }, []);

  const hold = useCallback(async () => {
    if (listeningRef.current) return;
    const r = await startListening();
    if (r !== 'listening') {
      notUnderstood();
      if (r === 'installing') { setVoiceOk('ready'); props.current.say('Getting voice ready. Hold again in a moment.'); return; }
      // This browser cannot listen on the device after all: the screen offers the Say or type box instead.
      if (r === 'unsupported') { setVoiceOk('unsupported'); props.current.say(Platform.OS === 'web' ? 'Voice isn’t available here. Type instead.' : 'Voice isn’t available here.'); return; }
      props.current.say(r === 'asked' ? 'Now hold again to speak.' : r === 'denied' ? 'The microphone is off for Still.' : 'Voice isn’t available here.');
      return;
    }
    listeningRef.current = true; setListening(true);
    player.duck(true); confirmTap();
    props.current.say('Listening…');
  }, []);

  const release = useCallback(async () => {
    if (!listeningRef.current) return;
    listeningRef.current = false; setListening(false);
    const words = await stopListening();
    player.duck(false);
    if (micBlocked()) { notUnderstood(); props.current.say('The microphone is off for Still.'); return; }
    await handleWords(words, 'voice');
  }, [handleWords]);

  // Computers: hold Space to talk, let go to apply. Only on the screen in front (tabs stay mounted),
  // and never while typing or on a focused control.
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    if (Platform.OS !== 'web' || !canHold || !focused || typeof window === 'undefined') return;
    const busy = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, button, a, [role="button"], [role="tab"], [role="radio"], [role="slider"], [contenteditable="true"]');
    const down = (e: KeyboardEvent) => { if (e.code !== 'Space' || e.repeat || busy(e.target)) return; e.preventDefault(); hold(); };
    const up = (e: KeyboardEvent) => { if (e.code !== 'Space' || busy(e.target)) return; e.preventDefault(); release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [canHold, focused, hold, release]);

  return { voiceOk, canHold, listening, hold, release, handleWords };
}
