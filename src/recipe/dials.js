// The four dials' click-stops and the "Find your sound" drift path, shared by the screens
// (Studio, FindSound) and the recipe rules (personal limits). Values are the recipe settings
// each stop sets; lower stops are gentler.
export const TILT = [-9, -8, -7, -6, -5, -4, -3];                 // Tone: Deepest … Airy (dB per octave)
export const CUTOFF = [600, 900, 1300, 1800, 2500, 3400, 4500];   // Tone's top-end softening (Hz)
export const TONAL = [0, 0.2, 0.45, 0.7];                         // Hum: None, A hint, Blend, Mostly
export const SWELL = [0, 0.6, 1.3, 2.2];                          // Motion: Still, Drift, Tide, Breathe (dB)
export const WIDTH = [0.1, 0.3, 0.55, 0.75, 0.95];                // Space: Centred … Wide

/**
 * The drift's one path through all four dials: one row per dial, one column per step (seven steps).
 * Tone brightens a step at a time; Motion and Space open up every other step; a hum only joins, as a
 * hint, in the last two steps (in our comfort test a hum made the sound less pleasant).
 */
export const DRIFT = {
  tone:   [0, 1, 2, 3, 4, 5, 6],
  motion: [0, 0, 1, 1, 2, 2, 3],
  space:  [0, 1, 1, 2, 3, 3, 4],
  hum:    [0, 0, 0, 0, 0, 1, 1],
};
export const DRIFT_STEPS = DRIFT.tone.length;
