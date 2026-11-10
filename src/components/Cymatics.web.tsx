// Cymatics on the web: a canvas of a few thousand grains. Each grain springs toward its place on
// the sound's figure (or drifts as loose dust when nothing plays), so changes swarm rather than
// jump. While the sound plays, grains tremble with its real loudness. Slow, low-contrast motion
// only (no flashing), still under Reduce Motion, and the loop sleeps once everything has settled.
import { createElement, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { gather, scatter, type Figure } from '../lib/cymatics';
import { level } from '../lib/output';
import { useReducedMotion } from '../lib/motion';

type Props = { figure: Figure | null; size: number; live?: boolean; pulse?: number; opacity?: number };

export function Cymatics({ figure, size, live = false, pulse = 0, opacity = 1 }: Props) {
  const count = Math.round(Math.min(6000, Math.max(1200, size * size * 0.05)));
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();
  const target = useMemo(() => (figure ? gather(figure, count) : scatter(count)), [figure?.key, figure?.hum, figure?.spread, figure?.fuzz, count]);
  const state = useRef<{ x: Float32Array; v: Float32Array; k: Float32Array; raf: number; angle: number; t0: number } | null>(null);
  const props = useRef({ figure, live, reduce, opacity, target });
  props.current = { figure, live, reduce, opacity, target };

  // One set of grains per canvas; each has its own pull, so the swarm arrives in waves.
  if (!state.current || state.current.x.length !== count * 2) {
    const x = new Float32Array(scatter(count, 11)), k = new Float32Array(count);
    for (let i = 0; i < count; i++) k[i] = 0.012 + ((i * 7919) % 1000) / 1000 * 0.03;
    state.current = { x, v: new Float32Array(count * 2), k, raf: 0, angle: 0, t0: Date.now() };
  }

  const wake = () => {
    const s = state.current!;
    if (s.raf || typeof window === 'undefined') return;
    const frame = () => {
      s.raf = 0;
      const c = canvas.current; if (!c) return;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const { figure: fig, live: on, reduce: still, opacity: alpha, target: tg } = props.current;
      const dpr = window.devicePixelRatio || 1, W = size * dpr, R = W * 0.47;
      if (c.width !== W) { c.width = W; c.height = W; }
      const loud = on ? Math.min(1, (level() ?? 0.25) * 3) : 0;
      const shake = still ? 0 : 0.0006 + loud * 0.004;
      let moving = 0;
      for (let i = 0; i < count; i++) {
        const ix = i * 2, iy = ix + 1;
        if (still) { s.x[ix] = tg[ix]; s.x[iy] = tg[iy]; continue; }
        // Loose dust drifts a little even when quiet; a figure holds still unless the sound plays.
        const jitter = fig ? shake : 0.0012;
        s.v[ix] = s.v[ix] * 0.86 + (tg[ix] - s.x[ix]) * s.k[i] + (Math.random() - 0.5) * jitter;
        s.v[iy] = s.v[iy] * 0.86 + (tg[iy] - s.x[iy]) * s.k[i] + (Math.random() - 0.5) * jitter;
        s.x[ix] += s.v[ix]; s.x[iy] += s.v[iy];
        moving += Math.abs(s.v[ix]) + Math.abs(s.v[iy]);
      }
      const t = (Date.now() - s.t0) / 1000;
      if (on && fig && !still) s.angle += fig.spin * 0.0012;
      const breath = on && fig && !still ? 1 + fig.breathe * 0.035 * Math.sin((2 * Math.PI * t) / fig.breathPeriodS) : 1;
      const cos = Math.cos(s.angle) * R * breath, sin = Math.sin(s.angle) * R * breath, cx = W / 2;
      ctx.clearRect(0, 0, W, W);
      // Lamp-amber grains with every fifth one cream, the same mix as the landing page's point field.
      const dot = Math.max(1, dpr * 1.1), a = (0.6 + loud * 0.25) * alpha;
      for (const [fill, pick] of [[`rgba(194,154,98,${a})`, 0], [`rgba(232,227,217,${a * 0.9})`, 1]] as const) {
        ctx.fillStyle = fill;
        for (let i = 0; i < count; i++) {
          if ((i % 5 === 0 ? 1 : 0) !== pick) continue;
          const x = s.x[i * 2], y = s.x[i * 2 + 1];
          ctx.fillRect(cx + x * cos - y * sin, cx + x * sin + y * cos, dot, dot);
        }
      }
      // Keep going while grains move, the sound plays, or dust drifts; otherwise sleep.
      if (!still && (on || !fig || moving > count * 0.00002) && !document.hidden) s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);
  };

  useEffect(() => { wake(); }, [target, live, reduce, opacity, size]);
  // A pulse throws the grains outward; they swarm back to the figure.
  useEffect(() => {
    if (!pulse || reduce) return;
    const s = state.current!;
    for (let i = 0; i < count * 2; i++) s.v[i] += s.x[i] * 0.05 + (Math.random() - 0.5) * 0.03;
    wake();
  }, [pulse]);
  useEffect(() => {
    const onVis = () => { if (!document.hidden) wake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); const s = state.current; if (s?.raf) cancelAnimationFrame(s.raf); if (s) s.raf = 0; };
  }, []);

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {createElement('canvas', { ref: canvas, width: size, height: size, style: { width: size, height: size, display: 'block' } })}
    </View>
  );
}
