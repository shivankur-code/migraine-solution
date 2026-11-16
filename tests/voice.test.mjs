// Voice commands: exact words, everyday phrases and timers, all on the phone. Never louder or brighter.
import assert from 'node:assert/strict';
import { understand, INTENTS, minutesOf, normalize } from '../src/engine/voice-commands.js';

const is = (text, intents, layer) => {
  const r = understand(text);
  assert.deepEqual(r.intents, intents, `"${text}" -> ${JSON.stringify(r.intents)}, expected ${JSON.stringify(intents)}`);
  if (layer !== undefined) assert.equal(r.layer, layer, `"${text}" layer ${r.layer}`);
};

// Layer 1: the command words.
is('Softer', ['softer'], 1);
is('darker.', ['darker'], 1);
is('STOP', ['stop'], 1);
is('more rain', ['rain'], 1);
is('less hum', ['less-hum'], 1);
is('this is making it worse', ['worse'], 1);
is('dark screen', ['dark'], 1);

// Layer 2: everyday phrases, the examples from the plan included.
is("it's buzzy", ['less-hum'], 2);
is('it feels like a hairdryer', ['darker'], 2);
is('too much in my left ear', ['closer'], 2);          // a specific complaint wins over the generic "too much"
is('it hurts', ['softer'], 2);
is('too loud', ['softer'], 2);
is('can you make it a bit quieter please', ['softer'], 2);
is('the hissing is too sharp', ['darker'], 2);
is('it is making me seasick', ['stiller'], 2);
is('switch to the ocean', ['ocean'], 2);
is('play rain', ['rain'], 2);
is('turn it off', ['stop'], 2);
is('stop, this is getting worse', ['worse'], 2);
is('softer and darker', ['darker', 'softer'], 2);
is('lights off', ['dark'], 2);
is('play my sound', ['play'], 2);

// Timers.
assert.equal(understand('20 minutes').timer, 20);
assert.equal(understand('twenty minutes please').timer, 20);
assert.equal(understand('half an hour').timer, 30);
assert.equal(understand('stop after an hour').timer, 60);
assert.deepEqual(understand('stop after an hour').intents, []);   // a timer, not a stop
assert.equal(understand('no timer').timer, 0);
assert.equal(understand('500 minutes').timer, 120);
assert.equal(minutesOf('timer-30'), 30);
assert.equal(minutesOf('timer-off'), 0);
assert.equal(minutesOf('softer'), null);

// Nothing understood: layer 3's turn (or a soft double vibration).
is('what time is it', [], 0);
is('', [], 0);
is('louder', [], 0);                      // never louder: no intent makes the sound louder
is('brighter please', [], 0);             // nor brighter

// Every intent the parser can produce is in the fixed list layer 3 answers from.
for (const t of ['softer', 'darker', 'buzzy', 'seasick', 'left ear', 'stop', 'play', 'worse', 'dark screen', 'rain', 'ocean', 'fan', 'hush']) {
  for (const i of understand(t).intents) assert.ok(INTENTS.includes(i), `${i} not in INTENTS`);
}
assert.equal(normalize("It’s  BUZZY!!"), 'its buzzy');
console.log('voice commands: ok');
