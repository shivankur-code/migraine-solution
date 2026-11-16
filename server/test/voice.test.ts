// Voice endpoint logic with a fake model: the request sent, answers kept to the fixed list, the deadline.
import assert from 'node:assert/strict';
import { allow, interpretWords, validateWords, VOICE_CHOICES, VOICE_FORMAT, VOICE_MODELS, VOICE_PROMPT, whoIs } from '../src/voice.js';
import { openRouterModel, ProviderError } from '../src/reviewer.js';

// 1. Words are checked: a short non-empty string only.
assert.equal(validateWords({ text: '  it is buzzy ' }), 'it is buzzy');
assert.throws(() => validateWords({ text: '' }));
assert.throws(() => validateWords({ text: 'x'.repeat(201) }));
assert.throws(() => validateWords({ words: 'hi' }));

// 2. The OpenRouter request: the voice schema, no data collection, both free models raced.
const sent: any[] = [];
const fakeFetch = (answer: (model: string) => any) => (async (_url: any, init: any) => {
  const body = JSON.parse(init.body); sent.push(body);
  const a = await answer(body.model);
  return new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
const reply = (content: string) => ({ choices: [{ finish_reason: 'stop', message: { content } }] });

const m1 = openRouterModel({ apiKey: 'k', models: VOICE_MODELS, deadlineMs: 2000, format: VOICE_FORMAT, fetchFn: fakeFetch(() => reply('{"intent":"darker"}')) });
assert.equal(await interpretWords(m1, 'it sounds like a dentist drill'), 'darker');
assert.equal(sent.length, 2);
assert.deepEqual(sent.map(b => b.model).sort(), [...VOICE_MODELS].sort());
assert.equal(sent[0].response_format.json_schema.name, 'voice_intent');
assert.deepEqual(sent[0].response_format.json_schema.schema.properties.intent.enum, VOICE_CHOICES);
assert.equal(sent[0].provider.data_collection, 'deny');
assert.equal(sent[0].messages[0].content, VOICE_PROMPT);
assert.match(sent[0].messages[1].content, /dentist drill/);

// 3. Anything outside the list, or unreadable, is "none": never louder, never anything new.
const m2 = openRouterModel({ apiKey: 'k', models: ['a'], deadlineMs: 2000, format: VOICE_FORMAT, fetchFn: fakeFetch(() => reply('{"intent":"louder"}')) });
assert.equal(await interpretWords(m2, 'louder'), 'none');
assert.ok(!VOICE_CHOICES.includes('louder') && !VOICE_CHOICES.includes('brighter'));

// 4. The deadline: a model that never answers ends in a 504-style error, quickly.
const m3 = openRouterModel({ apiKey: 'k', models: ['slow'], deadlineMs: 50, format: VOICE_FORMAT, fetchFn: (() => new Promise(() => {})) as unknown as typeof fetch });
await assert.rejects(interpretWords(m3, 'hmm'), (e: unknown) => e instanceof ProviderError && e.status === 504);

// 5. Sign-in: no token, anonymous, and a real person.
assert.equal(await whoIs(null, { url: 'u', key: 'k' }), 'unauthorized');
const userFetch = (user: any, status = 200) => (async () => new Response(JSON.stringify(user), { status })) as unknown as typeof fetch;
assert.equal(await whoIs('Bearer t', { url: 'u', key: 'k', fetcher: userFetch({ id: '1', is_anonymous: true }) }), 'unauthorized');
assert.deepEqual(await whoIs('Bearer t', { url: 'u', key: 'k', fetcher: userFetch({ id: 'abc' }) }), { id: 'abc' });
assert.equal(await whoIs('Bearer t', { url: 'u', key: 'k', fetcher: userFetch({}, 401) }), 'unauthorized');

// 6. The throttle: 40 asks per 10 minutes per person.
for (let i = 0; i < 40; i++) assert.ok(allow('p', 1000 + i));
assert.equal(allow('p', 2000), false);
assert.ok(allow('p', 1000 + 10 * 60_000 + 50));
console.log('voice server: ok');
