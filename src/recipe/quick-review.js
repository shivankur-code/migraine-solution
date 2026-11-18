// Instant on-device review: the same checks a careful reviewer would make first, as plain rules.
// It reads the privacy-minimal summary from buildReviewRequest (nothing leaves the device for it),
// answers in the same shape as the AI review (see sanitizeReview), and only ever makes the sound
// quieter, darker or steadier. The AI review, when the person asks for it, starts from this draft.
import { sanitizeReview } from './review.js';

const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/** @param {ReturnType<typeof import('./review.js').buildReviewRequest>} req */
export function quickReview(req) {
  const r = req?.recipes?.attack || req?.recipes?.normal || {};
  const i = req?.intake || {};
  const bother = i.soundBother || {};
  const f = req?.feedback || null;
  const adjustments = {};
  const rationale = [];
  const cautions = [];
  const questions = [];
  const change = (param, value, why, evidence = ['personal']) => { adjustments[param] = value; rationale.push({ param, why, evidence }); };

  const sessions = f?.sessions || 0;
  const followed = f ? Object.values(f.followUps || {}).reduce((a, b) => a + b, 0) - (f.followUps?.skipped || 0) : 0;
  const worse = f?.worseSessions || 0;
  const worseShare = followed ? (f.followUps?.worse || 0) / followed : 0;
  const softer = f?.choices?.softer || 0;
  const struggling = worse >= 2 && (worseShare >= 0.3 || worse >= 3);

  // 1. Your own journal comes first: repeated "worse" means quieter, darker and slower to start.
  if (struggling) {
    change('levelOffsetDb', worseShare >= 0.5 ? -6 : -3, `${worse} of your sessions felt worse afterwards, so your sound is now ${worseShare >= 0.5 ? 6 : 3} dB quieter.`, ['personal', 'ashkenazi2009']);
    if (Number.isFinite(r.tiltDbPerOct) && r.tiltDbPerOct > -8) change('tiltDbPerOct', round(Math.max(-9, r.tiltDbPerOct - 1.5), 1), 'It is also a little darker, with less of the hiss that migraine ears tolerate least.', ['mourgela2023']);
    if (Number.isFinite(r.cutoffHz) && r.cutoffHz > 1500) change('cutoffHz', Math.round(Math.max(1500, r.cutoffHz * 0.75)), 'The highest sounds are now softened earlier, for the same reason.', ['mourgela2023']);
    if (Number.isFinite(r.fadeInS)) change('fadeInS', Math.min(20, Math.round(r.fadeInS + 4)), 'It now fades in more slowly, so it never arrives all at once.', ['ambrosini2003']);
    cautions.push(worseShare >= 0.5
      ? 'Sound has made things worse more often than not. On a bad day, silence may suit you better; try "Silence" first, and talk to your clinician if attacks change.'
      : 'If sound keeps making things worse, choose silence on those days.');
  } else if (sessions >= 3 && softer >= 2 && softer / sessions >= 0.3) {
    change('levelOffsetDb', -3, `You chose "Softer" in ${softer} of ${sessions} sessions, so it now starts 3 dB quieter.`);
  }

  // 2. Things you told us you can't stand, that are still in the sound.
  const hatesHum = (i.dislikes || []).includes('hum') || (bother.low ?? 0) >= 3 || (bother.repetitive ?? 0) >= 3;
  if (hatesHum && (r.tonal ?? 0) > 0.02) change('tonal', 0, 'The hum is now off: you said steady low or repeating tones bother you, and adding a hum made every sound less pleasant in our listening study.', ['stillLab2026']);
  if ((bother.high ?? 0) >= 3 && (r.cutoffHz ?? 0) > 2500 && !adjustments.cutoffHz) change('cutoffHz', 2500, 'High sounds bother you a lot, so everything above about 2,500 Hz is softened.', ['mourgela2023']);
  if ((bother.pulse ?? 0) >= 3 && (r.swellDb ?? 0) > 0.5) change('swellDb', 0, 'The gentle rise and fall is now off, since pulsing sounds bother you.', ['virjonen2019']);
  if ((i.dizzy || i.motionSensitive) && (r.width ?? 0) > 0.6) change('width', 0.5, 'The sound now sits closer to the centre, which can feel steadier when you are dizzy or sensitive to motion.');

  // 3. Your own range, upwards: when the journal clearly shows the sound helps and you listen long,
  // one step brighter, never as far as the step you said was too much. Only if nothing above was gentler.
  const range = req?.range;
  const better = f?.followUps?.better || 0;
  if (!rationale.length && range?.known && sessions >= 4 && worse === 0 && followed >= 3 && better / followed >= 0.6
    && (f?.medianListeningMin ?? 0) >= 15 && Number.isFinite(r.tiltDbPerOct) && Number.isFinite(range.max?.tiltDbPerOct)
    && range.max.tiltDbPerOct >= r.tiltDbPerOct + 0.9) {
    change('tiltDbPerOct', round(Math.min(range.max.tiltDbPerOct, r.tiltDbPerOct + 1), 1),
      `${better} of your sessions felt better and you usually listen about ${Math.round(f.medianListeningMin)} minutes, so it is now one step brighter, still below the point you said was too much.`);
  }

  // 4. Questions only you can answer, when the data can't tell.
  if (sessions >= 3 && Number.isFinite(f?.medianListeningMin) && f.medianListeningMin < 10) questions.push('You usually stop within 10 minutes. Is that because it is too much, or because you feel better?');
  if (sessions < 2) questions.push('Use Still during your next attack, then tap how it felt. After a few of those, this check can tune your sound to you.');
  if (!req?.learnedRounds && !Object.keys(req?.tests || {}).length) questions.push('Try "Find it by ear" on a calm day. Two minutes of choices tells Still far more than the questionnaire.');

  const n = rationale.length;
  const fits = [];
  if ((r.tonal ?? 1) < 0.05) fits.push('it has no hum');
  if (Number.isFinite(r.tiltDbPerOct) && r.tiltDbPerOct <= -4) fits.push('it is soft and dark rather than hissy');
  if (Number.isFinite(r.fadeInS) && r.fadeInS >= 8) fits.push(`it fades in over ${Math.round(r.fadeInS)} seconds`);
  const summary = n
    ? `I checked your answers${sessions ? `, ${sessions} journal session${sessions === 1 ? '' : 's'}` : ''} and your current sound, and made ${n} small change${n === 1 ? '' : 's'}, within your own range and never louder.`
    : sessions
      ? `I checked your answers, ${sessions} journal session${sessions === 1 ? '' : 's'} and your current sound. Nothing needs changing: ${fits.length ? fits.join(', ') : 'it matches what you told us'}${f?.followUps?.better ? `, and ${f.followUps.better} session${f.followUps.better === 1 ? '' : 's'} felt better afterwards` : ''}.`
      : `Your sound already follows your answers${fits.length ? `: ${fits.join(', ')}` : ''}. There is no journal yet, so there is nothing to correct.`;

  return sanitizeReview({ summary, adjustments, rationale, cautions, questions });
}

/**
 * Combine the AI review with the on-device draft. The AI decides, except that it can never undo
 * the draft's protective changes from the person's own journal: the quieter level and the longer
 * fade-in each keep the gentler of the two values (with the draft's reason when that one wins).
 */
export function mergeWithDraft(ai, draft) {
  if (!draft) return ai;
  const adjustments = { ...ai.adjustments };
  const rationale = [...ai.rationale];
  const keep = (param, gentler) => {
    const d = draft.adjustments?.[param];
    if (!Number.isFinite(d)) return;
    const a = adjustments[param];
    if (Number.isFinite(a) && gentler(a, d) === a) return;
    adjustments[param] = d;
    const why = draft.rationale.find(r => r.param === param);
    const i = rationale.findIndex(r => r.param === param);
    if (why) { if (i >= 0) rationale[i] = why; else rationale.push(why); }
  };
  keep('levelOffsetDb', Math.min);
  keep('fadeInS', Math.max);
  const cautions = [...new Set([...(draft.cautions || []), ...(ai.cautions || [])])].slice(0, 5);
  return { ...ai, adjustments, rationale, cautions };
}
