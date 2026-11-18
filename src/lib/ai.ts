// Optional AI review of the recipe. Needs a review server (see server/README.md) configured at
// build time with EXPO_PUBLIC_RECIPE_API_URL. Only runs when the person has opted in.
import { metrics } from '../engine/journal-store.js';
import { buildReviewRequest, sanitizeReview } from '../recipe/review.js';
import { mergeWithDraft, quickReview } from '../recipe/quick-review.js';
import { recipeFor, type AiReview, type Profile } from './profile';
import type { Journal } from './storage';
import { supabase, supabaseReady } from './supabase';

const URL = process.env.EXPO_PUBLIC_RECIPE_API_URL || 'https://still-review-fc26d0.azurewebsites.net/api/review';
export const aiAvailable = URL.startsWith('https://');
/** Why a review could not run, in words the screen can show. */
export class ReviewError extends Error {}

// Built from the sound as the rules make it, without any earlier review, so reviews never stack.
export function reviewPayload(profile: Profile, journal: Journal) {
  const base = { ...profile, aiReview: null };
  return buildReviewRequest(base, { normal: recipeFor(base, 'normal').recipe, attack: recipeFor(base, 'attack').recipe }, metrics(journal));
}

/** Instant, on the device, nothing sent: the rule-based check the AI review starts from. */
export function deviceReview(profile: Profile, journal: Journal): AiReview {
  const clean = quickReview(reviewPayload(profile, journal));
  return { at: new Date().toISOString(), source: 'device', ...clean, adjustments: clean.adjustments as unknown as Record<string, unknown> };
}

export async function requestReview(profile: Profile, journal: Journal, draft?: AiReview | null): Promise<AiReview> {
  if (!aiAvailable || !supabaseReady) throw new ReviewError('The AI review is not set up in this version yet.');
  // The review server accepts signed-in people only (5 reviews a day), so no key is built into the app.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || data.session?.user?.is_anonymous) throw new ReviewError('Sign in under Account (below) to use the AI review.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // the server gives up on models after 45 s
  try {
    const res = await fetch(URL, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...reviewPayload(profile, journal), ...(draft ? { draft: { summary: draft.summary, adjustments: draft.adjustments, cautions: draft.cautions } } : {}) }),
    });
    if (res.status === 401) throw new ReviewError('Your sign-in has expired. Sign in again under Account.');
    if (res.status === 429) throw new ReviewError('You have used today\'s 5 reviews. Try again tomorrow.');
    if (res.status === 504) throw new ReviewError('The AI took too long. Your on-device check is applied; try the AI again later.');
    if (res.status === 503) throw new ReviewError('The AI review is not available right now. Your on-device check is applied.');
    if (!res.ok) throw new Error(`status-${res.status}`);
    const clean = mergeWithDraft(sanitizeReview(await res.json()), draft ?? null);
    return { at: new Date().toISOString(), source: 'ai', ...clean, adjustments: clean.adjustments as unknown as Record<string, unknown> };
  } finally { clearTimeout(timer); }
}
