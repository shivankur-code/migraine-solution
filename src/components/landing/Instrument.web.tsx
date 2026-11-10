/// <reference types="expo/types" />
// The landing's first screen. The sound is the background: a full-bleed field of dim points that
// slowly becomes ocean, rain, hush and fan on its own, with page-wide dust that stirs under the
// cursor (and rings softly, after a first click). In front, only what matters: what Still is, one
// way in, and Listen. Inspired by Gather's point clouds; quieter, because it is for migraine days.
//
// Safety, as in the room: nothing plays until Listen is pressed, sound starts in silence and fades
// in, Esc stops it. The background always keeps changing, except for people whose device asks for
// reduced motion: for them it holds still.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useFonts } from 'expo-font';
import { Manrope_300Light } from '@expo-google-fonts/manrope/300Light';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { freshProfile, recipeFor } from '../../lib/profile';
import * as player from '../../lib/player';
import { TEXTURES } from '../Studio';
import { createField, type Field } from './field';
import { createChimes, type Chimes } from './chime';
import './instrument.css';

const CHIME_KEY = 'still.chimes';
// The background's order and pace: one slow change every 14 s, each change a 2.6 s swarm.
const ORDER = [1, 0, 3, 2];            // indexes into TEXTURES: ocean, rain, hush, fan
const CYCLE_MS = 14000;
const PARAMS = { tone: 0.33, hum: 0, motion: 0.33, space: 0.6 };

const read = (key: string, fallback: boolean) => { try { const v = window.localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; } };
const write = (key: string, on: boolean) => { try { window.localStorage.setItem(key, on ? '1' : '0'); } catch {} };

export function Instrument({ onEnter, onHow, reduced, ctaHref }: {
  /** The way in. Called synchronously (it prevents the default). */
  onEnter: (e: MouseEvent<HTMLAnchorElement>, ready?: Promise<unknown>) => void;
  onHow: (e: MouseEvent<HTMLAnchorElement>) => void;
  reduced: boolean;
  ctaHref: string;
}) {
  const [fontsReady] = useFonts({ Manrope_300Light, Manrope_500Medium });
  const [step, setStep] = useState(0);                       // position in ORDER
  const [chimesOn, setChimesOn] = useState(() => read(CHIME_KEY, true));
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [woken, setWoken] = useState(false);
  const [touch] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  const [count] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 820 ? 12288 : 28672));

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const chimes = useRef<Chimes | null>(null);
  const run = useRef(0);
  const quiet = reduced;

  const form = ORDER[step];
  const texture = TEXTURES[form];
  const recipe = useMemo(() => {
    const p = freshProfile();
    return recipeFor({ ...p, intake: { ...p.intake, texture: texture.value } }, 'attack').recipe;
  }, [texture.value]);

  // ------------------------------------------------------------------ the background field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createField(canvas, { count, reduced, cover: true });
    if (!field) return;
    fieldRef.current = field;
    field.setParams(PARAMS);
    field.setLevel(1);
    const measure = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      // The form fills the page, centred behind the words.
      field.setFrame({ x: 0, y: 0, w, h })
    };
    const ro = new ResizeObserver(measure);
    ro.observe(canvas); measure();
    return () => { ro.disconnect(); field.destroy(); fieldRef.current = null; };
  }, [reduced, count]);

  useEffect(() => { fieldRef.current?.setForm(form); }, [form]);
  useEffect(() => { fieldRef.current?.setCalm(quiet); }, [quiet]);

  // The background keeps changing on its own. It holds while Listen plays, so the sound stays steady.
  useEffect(() => {
    if (quiet || listening || busy) return;
    const t = window.setInterval(() => setStep(s => (s + 1) % ORDER.length), CYCLE_MS);
    return () => window.clearInterval(t);
  }, [quiet, listening, busy]);

  // ------------------------------------------------------------------ the hand: stir, ring, chimes
  useEffect(() => {
    chimes.current = createChimes();
    return () => { chimes.current?.destroy(); chimes.current = null; };
  }, []);
  useEffect(() => { chimes.current?.setEnabled(chimesOn && !quiet); write(CHIME_KEY, chimesOn); }, [chimesOn, quiet]);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // a finger scrolls; taps are handled below
      const p = at(e);
      fieldRef.current?.setTilt((p.x / p.w - 0.5) * 0.3, (p.y / p.h - 0.5) * 0.2);
      fieldRef.current?.setPointer(p.x, p.y, true);
      chimes.current?.touch(p.x / p.w, p.y / p.h);
    };
    const leave = () => { fieldRef.current?.setTilt(0, 0); fieldRef.current?.setPointer(0, 0, false); };
    const down = (e: PointerEvent) => {
      chimes.current?.unlock();
      setWoken(true);
      // Buttons and links keep their own job; the open background rings.
      if ((e.target as HTMLElement | null)?.closest('button, a, input, label')) return;
      const p = at(e);
      fieldRef.current?.pulse(p.x, p.y);
      window.setTimeout(() => chimes.current?.touch(p.x / p.w, p.y / p.h, true), 30);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); el.addEventListener('pointerdown', down);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointerdown', down); };
  }, []);

  // ------------------------------------------------------------------ Listen: the real sound of what is showing
  const start = useCallback(async () => {
    const mine = ++run.current;
    setBusy(true);
    try {
      const uri = await player.recipeFile(recipe);
      if (mine !== run.current) return;
      await player.play(uri, { levelDb: recipe.levelDb, fadeIn: recipe.fadeInS, title: 'Still' });
      if (mine !== run.current) return;
      setListening(true);
      fieldRef.current?.setGlow(true, recipe.fadeInS);
    } catch {
      if (mine === run.current) setListening(false);
    } finally {
      if (mine === run.current) setBusy(false);
    }
  }, [recipe]);
  const stop = useCallback((seconds = 2) => {
    run.current++;
    player.stop(seconds);
    setListening(false); setBusy(false);
    fieldRef.current?.setGlow(false, 3);
  }, []);
  const toggleListen = () => (listening || busy ? stop() : start());
  const toggleRef = useRef(toggleListen);
  toggleRef.current = toggleListen;
  useEffect(() => () => { run.current++; player.stop(0.5); }, []);

  const firstRecipe = useRef(true);
  useEffect(() => {
    if (firstRecipe.current) { firstRecipe.current = false; return; }
    if (!listening) return;
    const t = window.setTimeout(() => { start(); }, 350);
    return () => window.clearTimeout(t);
  }, [recipe]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') { stop(1.5); return; }
      if ((e.key === 'l' || e.key === 'L') && !(t && (t.tagName === 'BUTTON' || t.tagName === 'A'))) toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);

  const enter = (e: MouseEvent<HTMLAnchorElement>) => { if (listening || busy) stop(1.2); onEnter(e); };

  const status = busy && !listening ? 'Preparing the sound on this device…'
    : listening ? `Listening to ${texture.label.toLowerCase()} · Esc to stop`
    : quiet ? 'Silent until you press Listen.'
    : woken ? (chimesOn ? 'Move to stir the dust. It rings softly.' : 'Move to stir the dust.')
    : touch ? 'Silent until you press Listen. Tap the dust to ring it.'
    : 'Silent until you press Listen. Move to stir the dust.';

  return (
    <section ref={sectionRef} className={`hero${fontsReady ? ' is-ready' : ''}${listening ? ' is-listening' : ''}`} aria-labelledby="hero-title">
      <canvas ref={canvasRef} className="hero-canvas" aria-hidden />
      <div className="hero-scrim" aria-hidden />

      <header className="hero-top">
        <p className="hero-brand"><StillMark /><span>Still</span></p>
        <nav className="hero-nav" aria-label="Landing">
          <a href="#how" className="hero-link" onClick={onHow}>How it works</a>
          <a href="/privacy.html" className="hero-link">Privacy</a>
        </nav>
      </header>

      <div className="hero-copy">
        <p className="hero-eyebrow">For migraine days</p>
        <h1 id="hero-title" className="hero-h1">A quiet room, with one soft sound in it.</h1>
        <p className="hero-lead">Still makes a gentle sound on your phone, shaped by a few choices you make by ear. It starts in silence. Nothing leaves your device.</p>
        <div className="hero-actions">
          <a href={ctaHref} className="hero-btn hero-btn-primary" onClick={enter}>Open the quiet room</a>
          <button type="button" className={`hero-btn hero-btn-ghost${listening ? ' is-on' : ''}`} onClick={toggleListen} aria-pressed={listening}>
            <ListenGlyph on={listening || busy} />
            <span>{busy && !listening ? 'Preparing…' : listening ? 'Stop' : 'Listen'}</span>
          </button>
        </div>
        <p className="hero-status" role="status" aria-live="polite">{status}</p>
      </div>

      <footer className="hero-foot">
        <p className="hero-now" aria-live="polite"><span className="hero-now-label">Now</span> <span className="hero-now-name">{texture.label}</span></p>
        <button type="button" className="hero-quiet" aria-pressed={chimesOn && !quiet} onClick={() => setChimesOn(c => !c)} disabled={quiet}>
          {chimesOn && !quiet ? 'Chimes on' : 'Chimes off'}
        </button>
      </footer>
    </section>
  );
}

/** The mark: one wave at rest inside a plate, with the still point at its centre. Same drawing as Mark.tsx. */
export function StillMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="hero-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      <path d="M4.5 12c1.9-5.6 5.6-5.6 7.5 0s5.6 5.6 7.5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ListenGlyph({ on }: { on: boolean }) {
  return on
    ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="2.5" y="2" width="2.4" height="8" rx="0.6" fill="currentColor" /><rect x="7.1" y="2" width="2.4" height="8" rx="0.6" fill="currentColor" /></svg>
    : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3.2 1.8v8.4L10 6z" fill="currentColor" /></svg>;
}
