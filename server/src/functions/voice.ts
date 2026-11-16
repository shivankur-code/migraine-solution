// POST /api/voice: { text } -> { intent }. Layer 3 of voice commands (see ../voice.ts). Open only to
// people signed in to Still (Supabase): the server checks the sign-in token with Supabase, and each
// person may ask 40 times in 10 minutes on an instance. Only the words arrive, never audio.
import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import { openRouterModel, ProviderError } from '../reviewer.js';
import { allow, interpretWords, validateWords, VOICE_DEADLINE_MS, VOICE_FORMAT, VOICE_MODELS, whoIs } from '../voice.js';

const apiKey = process.env.OPENROUTER_API_KEY || '';
const models = (process.env.OPENROUTER_VOICE_MODELS || '').split(',').map(m => m.trim()).filter(Boolean);
const model = apiKey ? openRouterModel({ apiKey, models: models.length ? models : VOICE_MODELS, deadlineMs: VOICE_DEADLINE_MS, format: VOICE_FORMAT }) : null;

export async function voice(request: HttpRequest): Promise<HttpResponseInit> {
  if (!model) return { status: 503, jsonBody: { error: 'not-configured' } };
  const raw = await request.text();
  if (raw.length > 2000) return { status: 413, jsonBody: { error: 'too-large' } };
  let text: string;
  try { text = validateWords(JSON.parse(raw)); } catch { return { status: 400, jsonBody: { error: 'bad-request' } }; }
  const who = await whoIs(request.headers.get('authorization'));
  if (who === 'unauthorized') return { status: 401, jsonBody: { error: 'sign-in' } };
  if (who === 'unavailable') return { status: 503, jsonBody: { error: 'auth-unavailable' } };
  if (!allow(who.id)) return { status: 429, jsonBody: { error: 'busy' } };
  try {
    return { status: 200, jsonBody: { intent: await interpretWords(model, text) } };
  } catch (error) {
    if (error instanceof ProviderError && error.status === 504) return { status: 504, jsonBody: { error: 'timeout' } };
    return { status: 502, jsonBody: { error: 'upstream' } };
  }
}

app.http('voice', { methods: ['POST'], authLevel: 'anonymous', route: 'voice', handler: voice });
