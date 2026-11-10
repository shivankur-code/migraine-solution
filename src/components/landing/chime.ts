// Soft chimes for the landing's field: one quiet, low, slow-decaying note as the cursor crosses the
// page, pitched by where it is (left to right walks up a pentatonic scale, so any path sounds sweet).
// Migraine rules: very quiet (about 30 dB under full scale), nothing above ~660 Hz plus a faint
// octave, a slow 60 ms attack (no clicks), at most three or four notes a second, and never before
// the person has clicked or tapped (browsers require that anyway). Web only.

const SCALE = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // G major pentatonic, G3 to E5
const MIN_GAP_MS = 280;

export type Chimes = {
  /** Call from a click or tap: browsers only allow sound after one. */
  unlock(): void;
  /** x and y from 0 to 1 across the page. Plays only when the cursor has moved on to a new note. */
  touch(x: number, y: number, force?: boolean): void;
  setEnabled(on: boolean): void;
  destroy(): void;
};

export function createChimes(): Chimes {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let enabled = true, lastAt = 0, lastNote = -1;

  const unlock = () => {
    if (ctx) { ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const soften = ctx.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.value = 1600;
      out = ctx.createGain(); out.gain.value = 1;
      out.connect(soften).connect(ctx.destination);
    } catch { ctx = null; }
  };

  const touch = (x: number, y: number, force = false) => {
    if (!enabled || !ctx || !out || ctx.state !== 'running') return;
    const note = Math.min(SCALE.length - 1, Math.max(0, Math.floor(x * SCALE.length)));
    const now = performance.now();
    if (!force && (note === lastNote || now - lastAt < MIN_GAP_MS)) return;
    lastNote = note; lastAt = now;
    const t = ctx.currentTime, peak = 0.03 * (0.7 + 0.3 * (1 - y));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const pan = ctx.createStereoPanner(); pan.pan.value = (x - 0.5) * 0.8;
    const a = ctx.createOscillator(); a.type = 'sine'; a.frequency.value = SCALE[note];
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = SCALE[note] * 2;
    const bGain = ctx.createGain(); bGain.gain.value = 0.18;
    a.connect(gain); b.connect(bGain).connect(gain); gain.connect(pan).connect(out);
    a.start(t); b.start(t); a.stop(t + 2.3); b.stop(t + 2.3);
  };

  return {
    unlock, touch,
    setEnabled(on) { enabled = on; },
    destroy() { try { ctx?.close(); } catch {} ctx = null; out = null; },
  };
}
