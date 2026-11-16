// Layer 3 of voice commands: when the phone could not place the words, and only for people who
// switched on AI and are signed in, send the words (text, never audio) to the server, which picks
// one intent from the fixed list in 8 seconds or answers "none".
import { minutesOf } from '../engine/voice-commands.js';
import { supabase, supabaseReady } from './supabase';

const REVIEW_URL = process.env.EXPO_PUBLIC_RECIPE_API_URL || 'https://still-review-fc26d0.azurewebsites.net/api/review';
const VOICE_URL = REVIEW_URL.replace(/\/review$/, '/voice');

/** Intents for the words, or null when the server is not reachable, not signed in, or unsure. */
export async function askModel(text: string): Promise<{ intents: string[]; timer: number | null } | null> {
  if (!VOICE_URL.startsWith('https://') || !supabaseReady || !text.trim()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || data.session?.user?.is_anonymous) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(VOICE_URL, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: text.slice(0, 200) }),
      });
      if (!res.ok) return null;
      const intent = String((await res.json())?.intent ?? 'none');
      if (intent === 'none') return null;
      const minutes = minutesOf(intent);
      return minutes !== null ? { intents: [], timer: minutes } : { intents: [intent], timer: null };
    } finally { clearTimeout(timer); }
  } catch { return null; }
}
