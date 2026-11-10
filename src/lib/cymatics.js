// Cymatics: sand on a vibrating plate gathers on the lines that stay still (Chladni figures).
// Each person's sound gets its own figure, worked out from the same recipe the engine plays:
//   darker tone → a simpler figure (fewer nodal lines), brighter → a more intricate one;
//   hum → rings; texture → how fine or loose the grains sit; motion → a slow breath in time
//   with the sound's own swell; space → how far the figure spreads.
// Pure functions, no device APIs, so they run in the app and in tests.

// Mode pairs from deepest to airiest. Lower modes have fewer nodal lines, as on a real plate.
const MODES = [[1, 2], [1, 3], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [3, 7], [5, 6]];
const TILT_RANGE = [-9, -1.5];

/** Small deterministic random generator, so a figure looks the same every time. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** The figure for a recipe (any object with the recipe's fields; missing ones use gentle defaults). */
export function figureFor(r = {}) {
  const tilt = Number.isFinite(r.tiltDbPerOct) ? r.tiltDbPerOct : -6;
  const t = Math.min(1, Math.max(0, (tilt - TILT_RANGE[0]) / (TILT_RANGE[1] - TILT_RANGE[0])));
  const [n, m] = MODES[Math.round(t * (MODES.length - 1))];
  const texture = r.texture || 'rain';
  return {
    n, m,
    hum: Math.min(1, Math.max(0, r.tonal ?? 0)),
    fuzz: texture === 'rain' ? 0.035 : texture === 'ocean' ? 0.025 : texture === 'fan' ? 0.018 : 0.01,
    spin: texture === 'fan' ? 1 : texture === 'ocean' ? 0.4 : 0,
    breathe: Math.min(1, Math.max(0, (r.swellDb ?? 0) / 3)),
    breathPeriodS: Math.min(16, Math.max(4, r.swellPeriodS ?? 10)),
    spread: 0.78 + 0.2 * Math.min(1, Math.max(0, r.width ?? 0.6)),
    key: `${n}-${m}-${texture}`,
  };
}

/** How far a point is from still (0 = on a nodal line), for a point inside the unit circle. */
export function plate(fig, x, y) {
  const { n, m, hum } = fig;
  const px = Math.PI * (x + 1) / 2, py = Math.PI * (y + 1) / 2;
  const square = Math.cos(n * px) * Math.cos(m * py) - Math.cos(m * px) * Math.cos(n * py);
  const ring = Math.cos((n + m) * 1.6 * Math.hypot(x, y));
  return (1 - hum) * square + hum * ring;
}

/**
 * `count` grain positions (x, y in -1…1, inside the circle) lying on the figure's nodal lines.
 * Returns a flat array [x0, y0, x1, y1, …].
 */
export function gather(fig, count, seed = 7) {
  const rand = rng(seed + fig.n * 31 + fig.m * 17 + Math.round(fig.hum * 10));
  const out = new Array(count * 2);
  let k = 0, tries = 0;
  const band = 0.06;
  while (k < count && tries < count * 400) {
    tries++;
    const x = rand() * 2 - 1, y = rand() * 2 - 1;
    if (x * x + y * y > 1) continue;
    if (Math.abs(plate(fig, x, y)) > band) continue;
    const j = (rand() - 0.5) * fig.fuzz * 2;
    let gx = x + j, gy = y - j;
    const r = Math.hypot(gx, gy); if (r > 1) { gx /= r; gy /= r; } // keep fuzzed grains on the plate
    out[k * 2] = gx * fig.spread; out[k * 2 + 1] = gy * fig.spread; k++;
  }
  // A very flat figure might not fill up; top up with loose grains so the count is always exact.
  for (; k < count; k++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * fig.spread; out[k * 2] = Math.cos(a) * r; out[k * 2 + 1] = Math.sin(a) * r; }
  return out;
}

/** Loose dust: grains scattered evenly over the plate, as when no sound plays. */
export function scatter(count, seed = 3) {
  const rand = rng(seed);
  const out = new Array(count * 2);
  for (let k = 0; k < count; k++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.95; out[k * 2] = Math.cos(a) * r; out[k * 2 + 1] = Math.sin(a) * r; }
  return out;
}
