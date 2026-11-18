// The person's own range, and the gentle live nudges (time of day, falling air pressure).
//
// Rule: the person's choices set the limits; suggestions (the on-device check, the AI review) may
// move the sound either way inside them, never past them. The limits come from "Find your sound":
// the step they tapped as "too much" is a ceiling, and nothing a suggestion proposes reaches it.
// Loudness stays theirs: suggestions can only make it quieter. Turning a dial by hand is always
// allowed (that is the person choosing), so a hand-set value above the ceiling is also respected.
import { CUTOFF, DRIFT, DRIFT_STEPS, SWELL, TILT, TONAL, WIDTH } from './dials.js';

/** The "too much" step from Find your sound (0–6), or null when the person has not done it yet. */
export function ceilingStep(profile) {
  const s = profile?.ceiling?.step;
  return Number.isInteger(s) && s >= 0 && s < DRIFT_STEPS ? s : null;
}

/**
 * The highest value a suggestion may set for each brightening setting, given the person's ceiling
 * and their current sound (`recipe`). Without a ceiling, the current value is the limit (a
 * suggestion can keep it or make it gentler, not brighter): the person has not told us their range yet.
 */
export function personalLimits(profile, recipe) {
  const c = ceilingStep(profile);
  const hatesHum = (profile?.intake?.dislikes || []).includes('hum');
  const below = c === null ? null : Math.max(0, c - 1);             // the last step that was still fine
  const at = (dial, values) => (below === null ? -Infinity : values[DRIFT[dial][below]]);
  const max = (fromCeiling, current) => Math.max(fromCeiling, Number.isFinite(current) ? current : -Infinity);
  return {
    known: c !== null,
    tiltDbPerOct: max(at('tone', TILT), recipe?.tiltDbPerOct),
    cutoffHz: max(at('tone', CUTOFF), recipe?.cutoffHz),
    tonal: hatesHum ? 0 : max(at('hum', TONAL), recipe?.tonal),
    swellDb: max(at('motion', SWELL), recipe?.swellDb),
    width: max(at('space', WIDTH), recipe?.width),
  };
}

/** Keep a suggestion's adjustments inside the person's range. Gentler values always pass. */
export function withinRange(adjustments, limits) {
  const out = { ...(adjustments || {}) };
  for (const k of ['tiltDbPerOct', 'cutoffHz', 'tonal', 'swellDb', 'width']) {
    if (Number.isFinite(out[k]) && Number.isFinite(limits[k])) out[k] = Math.min(out[k], limits[k]);
  }
  if (Number.isFinite(out.levelOffsetDb)) out.levelOffsetDb = Math.min(0, out.levelOffsetDb);   // never louder
  return out;
}

/**
 * Live nudges, applied when a sound starts (they change hour to hour, so they are never saved into
 * the sound): later in the evening and at night a little quieter and darker; on a day the phone's
 * barometer shows air pressure falling, a little gentler too. Small, and always gentler.
 * `hour` is the local hour (0–23); `pressureDropHpa` is how far pressure fell over the last few
 * hours (positive = falling), or null when unknown or not allowed.
 */
/** @param {{ hour: number, pressureDropHpa?: number | null, timeOfDay?: boolean }} at */
export function liveNudge({ hour, pressureDropHpa = null, timeOfDay = true }) {
  let levelOffsetDb = 0, tiltDelta = 0;
  const why = [];
  if (timeOfDay && Number.isFinite(hour)) {
    if (hour >= 22 || hour < 6) { levelOffsetDb -= 2; tiltDelta -= 0.5; why.push('night'); }
    else if (hour >= 19) { levelOffsetDb -= 1; why.push('evening'); }
  }
  if (typeof pressureDropHpa === 'number' && Number.isFinite(pressureDropHpa) && pressureDropHpa >= 2) { levelOffsetDb -= 2; tiltDelta -= 0.5; why.push('pressure falling'); }
  return { levelOffsetDb: Math.max(-4, levelOffsetDb), tiltDelta: Math.max(-1, tiltDelta), why };
}

/** A falling-pressure reading from stored barometer samples ({t: ms, hPa}), or null. */
export function pressureDrop(samples, now = Date.now()) {
  const list = (Array.isArray(samples) ? samples : []).filter(s => Number.isFinite(s?.t) && Number.isFinite(s?.hPa)).sort((a, b) => a.t - b.t);
  const latest = list[list.length - 1];
  if (!latest || now - latest.t > 60 * 60 * 1000) return null;               // no recent reading
  // A reading from 2 to 6 hours before the latest one.
  const past = [...list].reverse().find(s => latest.t - s.t >= 2 * 3600e3 && latest.t - s.t <= 6 * 3600e3);
  if (!past) return null;
  const hours = (latest.t - past.t) / 3600e3;
  const drop = past.hPa - latest.hPa;
  if (Math.abs(drop) / hours > 6) return null;                                 // a lift, a hill or a flight, not weather
  return Math.round(drop * 10) / 10;
}
