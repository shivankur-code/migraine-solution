// Voice commands: what a few spoken words mean, worked out on the phone. Nothing here talks back:
// the answer to a command is the sound changing. Three layers, fastest first:
//   1. exact command words ("softer", "darker", "stop"),
//   2. everyday phrases for the same things ("it's buzzy", "too much", "like a hairdryer"),
//   3. (in the app, optional) a model picks one intent from INTENTS for anything left over.
// Every intent is gentle by construction: none makes the sound louder, brighter or busier.

/** Every intent a voice command can have. Layer 3 must answer with one of these or "none". */
export const INTENTS = [
  'softer',      // quieter (and, once already softer, quieter still)
  'darker',      // Tone one step deeper
  'less-hum',    // Hum one step less
  'stiller',     // Motion one step stiller
  'closer',      // Space one step narrower (less wide, less in one ear)
  'stop',        // fade to silence
  'play',        // start my sound
  'worse',       // "this is making it worse": stop, and start quieter and deeper next time
  'dark',        // dark screen
  'rain', 'ocean', 'fan', 'hush',   // switch texture
  'timer-15', 'timer-30', 'timer-60', 'timer-off',
];

// Layer 1: the words a person is told about, matched as the whole utterance.
const EXACT = {
  softer: 'softer', quieter: 'softer', darker: 'darker', deeper: 'darker',
  stop: 'stop', play: 'play', start: 'play', worse: 'worse',
  rain: 'rain', ocean: 'ocean', fan: 'fan', hush: 'hush',
  'dark screen': 'dark', 'less hum': 'less-hum', 'no hum': 'less-hum',
  stiller: 'stiller', calmer: 'stiller', closer: 'closer', narrower: 'closer',
  'this is worse': 'worse', 'this is making it worse': 'worse', 'more rain': 'rain',
};

// Layer 2: phrases inside what was said. Checked in this order; earlier groups win when two match
// (so "stop, it's worse" is "worse", and "turn it off" is "stop", not "dark").
const PHRASES = [
  ['worse', ['making it worse', 'makes it worse', 'its worse', 'it is worse', 'getting worse', 'worse now', 'this is worse', 'worse']],
  ['dark', ['dark screen', 'screen off', 'lights off', 'turn off the screen', 'black screen', 'too bright screen']],
  ['stop', ['stop', 'turn it off', 'switch it off', 'switch off', 'turn off', 'silence', 'enough', 'pause', 'shut up', 'off please', 'no sound', 'cancel']],
  ['rain', ['rain', 'raining', 'rainfall', 'drizzle']],
  ['ocean', ['ocean', 'sea', 'waves', 'wave', 'beach', 'surf', 'tide']],
  ['fan', ['fan', 'whir', 'whirr', 'air conditioner', 'aircon']],
  ['hush', ['hush', 'plain noise', 'just noise', 'pink noise', 'brown noise', 'white noise']],
  ['less-hum', ['less hum', 'no hum', 'hum', 'humming', 'buzzy', 'buzzing', 'buzz', 'drone', 'droning', 'rumble', 'rumbly', 'engine', 'vibrating']],
  ['stiller', ['stiller', 'calmer', 'less movement', 'less motion', 'stop moving', 'moving', 'wobbly', 'wobble', 'wavy', 'pulsing', 'pulse', 'throbbing', 'seasick', 'dizzy', 'swelling', 'up and down']],
  ['closer', ['closer', 'narrower', 'too wide', 'left ear', 'right ear', 'one ear', 'one side', 'everywhere', 'too big', 'too spacious', 'echo', 'echoey']],
  ['darker', ['darker', 'deeper', 'warmer', 'lower pitch', 'too bright', 'too sharp', 'sharp', 'harsh', 'hissy', 'hiss', 'hissing', 'tinny', 'shrill', 'piercing', 'screechy', 'high pitched', 'too high', 'hairdryer', 'hair dryer', 'static', 'crackly', 'crackling', 'scratchy', 'fizzy', 'like a kettle', 'kettle']],
  ['softer', ['softer', 'quieter', 'too loud', 'too much', 'turn it down', 'turn down', 'volume down', 'lower', 'gentler', 'hurts', 'it hurts', 'painful', 'shh', 'shush', 'less', 'down']],
  ['play', ['play', 'start', 'my sound', 'turn it on', 'switch it on', 'begin', 'on please']],
];

const NUMBER_WORDS = { five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30, forty: 40, 'forty five': 45, fifty: 50, sixty: 60, ninety: 90 };

/** Lower case, no punctuation, single spaces; "it's" becomes "its". */
export function normalize(text) {
  return String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const has = (said, phrase) => (` ${said} `).includes(` ${phrase} `);

/**
 * A timer in what was said: minutes (5 to 120), 0 for "no timer", or null. Understands "20 minutes",
 * "twenty minutes", "half an hour", "an hour", "no timer", "timer off".
 */
export function timerIn(said) {
  if (has(said, 'no timer') || has(said, 'timer off') || has(said, 'without a timer') || has(said, 'keep playing')) return 0;
  if (has(said, 'half an hour') || has(said, 'half hour')) return 30;
  if (has(said, 'an hour') || has(said, 'one hour') || has(said, '1 hour')) return 60;
  const minutes = /\b(\d{1,3})\s*(min|mins|minute|minutes)\b/.exec(said);
  if (minutes) return clampMinutes(Number(minutes[1]));
  for (const [word, n] of Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    if (has(said, `${word} minutes`) || has(said, `${word} min`)) return n;
  }
  return null;
}
const clampMinutes = n => Math.max(5, Math.min(120, Math.round(n)));

/** Turn a timer intent from layer 3 ("timer-30") into minutes. */
export function minutesOf(intent) {
  if (intent === 'timer-off') return 0;
  const m = /^timer-(\d+)$/.exec(intent || '');
  return m ? Number(m[1]) : null;
}

/**
 * What was said, as intents. Returns { intents, timer, layer }: `layer` is 1 for exact command words,
 * 2 for everyday phrases, 0 when nothing was understood (layer 3 is the app's to try). At most one
 * texture and one of each change; "stop" or "worse" end the list, since nothing after them applies.
 */
export function understand(text) {
  const said = normalize(text);
  if (!said) return { intents: [], timer: null, layer: 0 };
  const timer = timerIn(said);
  if (EXACT[said]) return { intents: [EXACT[said]], timer: null, layer: 1 };
  const found = [];
  for (const [intent, phrases] of PHRASES) {
    if (phrases.some(p => has(said, p))) found.push(intent);
  }
  // "Stop" inside a timer phrase ("stop after 20 minutes") is the timer, not a stop.
  let intents = timer !== null ? found.filter(i => i !== 'stop' && !(i === 'softer' && /\b(less|down|lower)\b/.test(said) && !/too|quiet|soft/.test(said))) : found;
  // One texture at most: the first one named.
  const textures = intents.filter(i => ['rain', 'ocean', 'fan', 'hush'].includes(i));
  if (textures.length > 1) intents = intents.filter(i => !textures.slice(1).includes(i));
  // A specific complaint ("hissy") already makes it gentler: drop the generic "less"/"down" softer that rode along.
  if (intents.length > 1 && intents.includes('softer') && !/\b(softer|quieter|too loud|turn it down|turn down|volume down)\b/.test(said)) intents = intents.filter(i => i !== 'softer');
  // "Play" only when nothing else was asked ("play rain" is a texture change that also plays).
  if (intents.length > 1) intents = intents.filter(i => i !== 'play');
  if (intents.includes('worse')) intents = ['worse'];
  else if (intents.includes('stop')) intents = ['stop'];
  else if (intents.includes('dark')) intents = ['dark'];
  return { intents, timer, layer: intents.length || timer !== null ? 2 : 0 };
}

/** The words shown, and given to the phone's speech recognizer as hints. */
export const HINT_WORDS = ['softer', 'darker', 'stop', 'play', 'worse', 'less hum', 'stiller', 'closer', 'rain', 'ocean', 'fan', 'hush', 'dark screen', 'minutes', 'this is making it worse'];
