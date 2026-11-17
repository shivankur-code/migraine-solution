// The brain of voice and the "Say or type" box: a few words in, gentle intents out. Interpreters
// run in order and the first one that understands wins:
//   1. words    exact command words and everyday phrases, on the device, instant (voice-commands.js)
//   2. (slot)   an on-device language model, when one is available: add it here, between the
//               two, e.g. Chrome's built-in model on the web, or Apple's Foundation Models through
//               a native module in the iPhone app. Nothing leaves the device, so no opt-in needed.
//   3. server   the optional AI on the review server, only for people who switched AI on (text only).
// Whatever an interpreter returns passes through `keepSafe`: only intents from the fixed list,
// timers clamped. So no interpreter, now or later, can make the sound louder or brighter.
import { INTENTS, understand } from '../engine/voice-commands.js';
import { askModel } from './voiceAsk';

export type Heard = { intents: string[]; timer: number | null; by: string };
export type Context = { consentAI: boolean };
export type Interpreter = {
  name: string;
  /** Whether this interpreter may run for this person right now (e.g. AI switched on). */
  allowed: (ctx: Context) => boolean;
  /** Intents for the words, or null when it does not understand them. */
  run: (text: string) => Promise<{ intents: string[]; timer: number | null } | null>;
};

export const INTERPRETERS: Interpreter[] = [
  { name: 'words', allowed: () => true, run: async text => { const r = understand(text); return r.intents.length || r.timer !== null ? r : null; } },
  // An on-device model goes here (see the note at the top, and design/voice.md).
  { name: 'server-ai', allowed: ctx => ctx.consentAI, run: askModel },
];

/** Only intents from the fixed list, at most four, and a timer between 5 and 120 minutes (or 0 for none). */
export function keepSafe(r: { intents: unknown; timer: unknown }): { intents: string[]; timer: number | null } {
  const intents = (Array.isArray(r.intents) ? r.intents : []).filter((i): i is string => typeof i === 'string' && INTENTS.includes(i)).slice(0, 4);
  const t = typeof r.timer === 'number' && Number.isFinite(r.timer) ? Math.round(r.timer) : null;
  return { intents, timer: t === null ? null : t === 0 ? 0 : Math.max(5, Math.min(120, t)) };
}

/** What the words mean, or null when nobody understood them. */
export async function interpret(text: string, ctx: Context): Promise<Heard | null> {
  const words = text.trim();
  if (!words) return null;
  for (const it of INTERPRETERS) {
    if (!it.allowed(ctx)) continue;
    let out: { intents: string[]; timer: number | null } | null = null;
    try { out = await it.run(words); } catch { out = null; }
    if (!out) continue;
    const safe = keepSafe(out);
    if (safe.intents.length || safe.timer !== null) return { ...safe, by: it.name };
  }
  return null;
}
