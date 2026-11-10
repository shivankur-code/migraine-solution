// Cymatics figures: exact grain counts, grains on nodal lines, figures follow the sound.
import assert from 'node:assert/strict';
import { figureFor, gather, scatter, plate } from '../src/lib/cymatics.js';

const deep = figureFor({ tiltDbPerOct: -9, texture: 'rain' });
const airy = figureFor({ tiltDbPerOct: -2, texture: 'rain' });
assert.ok(deep.n + deep.m < airy.n + airy.m, 'darker sound, simpler figure');
assert.equal(figureFor({}).key, figureFor({}).key, 'defaults are stable');
assert.equal(figureFor({ texture: 'fan' }).spin, 1);
assert.equal(figureFor({ swellDb: 0 }).breathe, 0);

for (const fig of [deep, airy, figureFor({ tonal: 0.7 })]) {
  const g = gather(fig, 600);
  assert.equal(g.length, 1200);
  assert.ok(g.every(Number.isFinite));
  let on = 0;
  for (let k = 0; k < 600; k++) {
    const x = g[2 * k] / fig.spread, y = g[2 * k + 1] / fig.spread;
    assert.ok(x * x + y * y <= 1.05, 'inside the plate');
    if (Math.abs(plate(fig, x, y)) < 0.25) on++;
  }
  assert.ok(on > 510, `most grains sit on still lines (rain grains sit a little loose) (${on}/600)`);
}
assert.deepEqual(gather(deep, 50), gather(deep, 50), 'same figure every time');
assert.notDeepEqual(gather(deep, 50), gather(airy, 50));
assert.equal(scatter(100).length, 200);

const t0 = performance.now(); gather(airy, 6000); const ms = performance.now() - t0;
assert.ok(ms < 400, `fast enough for the web canvas (${ms.toFixed(0)} ms)`);
console.log('cymatics ok', `${ms.toFixed(0)} ms for 6000 grains`);
