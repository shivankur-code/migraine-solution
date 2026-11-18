// The person's range: suggestions move either way inside it, never past it, never louder.
// And the live nudges: only ever gentler, small, and the barometer reading ignores lifts and flights.
import assert from 'node:assert/strict';
import { buildRecipe } from '../src/recipe/recipe.js';
import { personalLimits, withinRange, liveNudge, pressureDrop, ceilingStep } from '../src/recipe/personal.js';
import { TILT, DRIFT } from '../src/recipe/dials.js';
import { quickReview } from '../src/recipe/quick-review.js';
import { buildReviewRequest } from '../src/recipe/review.js';

const base = { intake: {}, tests: { tilt: { value: -8, trials: 0 } }, calibration: {}, trials: {}, trims: {}, baseLevelDb: 0 };
const current = buildRecipe(base, 'normal').recipe;

// 1. Without a ceiling, a suggestion cannot go brighter than the current sound (but can go gentler).
const noCeiling = personalLimits(base, current);
assert.equal(noCeiling.known, false);
assert.equal(withinRange({ tiltDbPerOct: -3 }, noCeiling).tiltDbPerOct, current.tiltDbPerOct);
assert.equal(withinRange({ tiltDbPerOct: -9 }, noCeiling).tiltDbPerOct, -9);

// 2. With "too much" tapped at step 5 (Bright), suggestions may go up to step 4 (Clear), never 5.
const withCeiling = { ...base, ceiling: { step: 5, at: '2026-11-18T00:00:00Z' } };
assert.equal(ceilingStep(withCeiling), 5);
const lim = personalLimits(withCeiling, current);
assert.equal(lim.tiltDbPerOct, TILT[DRIFT.tone[4]]);
assert.ok(lim.tiltDbPerOct < TILT[DRIFT.tone[5]]);
assert.equal(withinRange({ tiltDbPerOct: -3 }, lim).tiltDbPerOct, TILT[DRIFT.tone[4]]);
assert.equal(withinRange({ tiltDbPerOct: -6 }, lim).tiltDbPerOct, -6);   // brighter than now, inside the range: allowed

// 3. Never louder, whatever is proposed; a hum never for someone who dislikes hums.
assert.equal(withinRange({ levelOffsetDb: 6 }, lim).levelOffsetDb, 0);
const hates = personalLimits({ ...withCeiling, intake: { dislikes: ['hum'] } }, current);
assert.equal(withinRange({ tonal: 0.7 }, hates).tonal, 0);

// 4. A hand-set value above the ceiling is the person's choice: the limit never lowers it.
const handSet = personalLimits({ ...base, ceiling: { step: 1, at: 'x' } }, { ...current, tiltDbPerOct: -4 });
assert.equal(handSet.tiltDbPerOct, -4);

// 5. The recipe applies a review only inside the range.
const reviewed = buildRecipe({ ...withCeiling, aiReview: { at: 'x', source: 'device', adjustments: { tiltDbPerOct: -2, levelOffsetDb: 5 }, rationale: [] } }, 'normal').recipe;
assert.ok(reviewed.tiltDbPerOct <= TILT[DRIFT.tone[4]]);
assert.ok(reviewed.levelDb <= current.levelDb);

// 6. The on-device check brightens one step only when the journal clearly supports it, within range.
const good = { sessions: 6, usedEpisodes: 5, choices: { comfort: 6 }, followUps: { better: 5, same: 1 }, worseSessions: 0, medianListeningMin: 22 };
const req = buildReviewRequest(withCeiling, { normal: current, attack: buildRecipe(withCeiling, 'attack').recipe }, good);
assert.equal(req.range.known, true);
const up = quickReview(req);
assert.ok(Number.isFinite(up.adjustments.tiltDbPerOct), 'one step brighter');
assert.ok(up.adjustments.tiltDbPerOct <= req.range.max.tiltDbPerOct);
const shortSessions = quickReview(buildReviewRequest(withCeiling, { normal: current, attack: current }, { ...good, medianListeningMin: 6 }));
assert.equal(shortSessions.adjustments.tiltDbPerOct, undefined, 'short sessions: no brightening');
const noRange = quickReview(buildReviewRequest(base, { normal: current, attack: current }, good));
assert.equal(noRange.adjustments.tiltDbPerOct, undefined, 'no ceiling yet: no brightening');

// 7. Live nudges: gentler at night and on falling pressure, small, never louder.
assert.deepEqual(liveNudge({ hour: 14 }), { levelOffsetDb: 0, tiltDelta: 0, why: [] });
assert.equal(liveNudge({ hour: 20 }).levelOffsetDb, -1);
assert.equal(liveNudge({ hour: 23 }).levelOffsetDb, -2);
assert.equal(liveNudge({ hour: 23, timeOfDay: false }).levelOffsetDb, 0);
const both = liveNudge({ hour: 2, pressureDropHpa: 4 });
assert.equal(both.levelOffsetDb, -4); assert.equal(both.tiltDelta, -1); assert.deepEqual(both.why, ['night', 'pressure falling']);
assert.equal(liveNudge({ hour: 12, pressureDropHpa: 1 }).levelOffsetDb, 0);

// 8. Pressure: a 3 hPa fall over 3 hours counts; a 12 hPa change in 2 hours is a lift or a hill, not weather.
const h = 3600e3, now = 10 * h;
assert.equal(pressureDrop([{ t: now - 3 * h, hPa: 1013 }, { t: now - 10 * 60e3, hPa: 1010 }], now), 3);
assert.equal(pressureDrop([{ t: now - 2 * h, hPa: 1013 }, { t: now - 60e3, hPa: 1001 }], now), null);
assert.equal(pressureDrop([{ t: now - 3 * h, hPa: 1013 }], now), null);           // nothing recent
assert.equal(pressureDrop([{ t: now - 60e3, hPa: 1010 }], now), null);           // nothing 2–6 hours back
console.log('personal range: ok');
