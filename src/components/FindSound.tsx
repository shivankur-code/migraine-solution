// Find your sound, with one tap. The sound starts at its gentlest (deepest, darkest) and slowly
// brightens through the seven Tone settings, about 40 seconds in all, each change a slow crossfade.
// The person taps anywhere the moment it feels like too much; Still keeps the setting one step
// gentler than that. Noticing "too much" is far easier than judging "best" while a sound moves,
// and doing nothing is safe: with no tap it keeps a warm, gentle middle.
//
// The look: the sound's own dust figure in the middle, reshaping as the sound brightens, inside a
// thin lamp ring that fills as the drift goes on, one dot per setting. Nothing flashes; under
// Reduce Motion the figure holds still and only the ring moves.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { recipeFor, type Profile } from '../lib/profile';
import { figureFor } from '../lib/cymatics';
import * as player from '../lib/player';
import { colors, space } from '../lib/theme';
import { Body, Button, Caption, Heading, Kicker, Meta, Press, Title } from '../lib/ui';
import { track } from '../lib/activity';
import { Cymatics } from './Cymatics';
import { DIALS, withDial } from './Studio';

const STOPS = DIALS.tone.stops;            // Deepest … Airy
const N = STOPS.length;
const STEP_MS = 5000;                       // each setting plays this long
const XFADE_S = 2.5;                        // and blends into the next over this long
const UNTOUCHED = 2;                        // no tap at all: keep "Warm", the gentle middle
const ARC = 0.75;                           // the ring is a 270° arc, open at the bottom

export type Phase = 'ready' | 'preparing' | 'drifting' | 'found';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function FindSound({ profile, onFound, onStart, header, saveLabel, onSave, size: fixed, below, idleFigure, startLabel, extraFoot }: {
  profile: Profile;
  /** Called once a setting is found (tapped, or kept when nobody tapped), with the new profile. */
  onFound: (p: Profile) => void;
  /** Called as the drift starts, e.g. to stop another preview. */
  onStart?: () => void;
  /** Drawn above the ring, inside the tap area, so a tap on the words counts too. */
  header?: ReactNode;
  /** The primary once found, e.g. "Save my sound". Without it the result simply saves. */
  saveLabel?: string;
  onSave?: () => void;
  /** Ring size; by default it fits the screen. */
  size?: number;
  /** Drawn under the words, told where the drift is (My sound's dials follow it). */
  below?: (s: { phase: Phase; index: number }) => ReactNode;
  /** Show the sound's own figure before the drift starts, not loose dust. */
  idleFigure?: boolean;
  /** The label of the button that starts the drift. */
  startLabel?: string;
  /** Extra actions beside Start and Try again (e.g. Listen). */
  extraFoot?: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const size = fixed ?? Math.min(width - 48, height < 700 ? 220 : 280, 320);

  // One profile per setting, from the person's own sound (texture, loudness and the rest kept).
  const steps = useMemo(() => STOPS.map((_, i) => withDial(profile, 'tone', i)), [profile]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const [phase, setPhase] = useState<Phase>('ready');
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<{ i: number; tapped: boolean } | null>(null);
  const [frac, setFrac] = useState(0);        // how far through the current setting, 0–1
  const phaseRef = useRef<Phase>('ready');
  const indexRef = useRef(0);
  const stepAt = useRef(0);
  const run = useRef(0);
  const files = useRef(new Map<number, Promise<string>>());

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const recipeAt = (i: number) => recipeFor(stepsRef.current[i], 'warning').recipe;
  // Render each setting once (about a second on a phone), one ahead of where the drift is.
  const file = (i: number) => {
    let f = files.current.get(i);
    if (!f) { f = player.recipeFile(recipeAt(i)); files.current.set(i, f); }
    return f;
  };
  // A new profile (another texture) means new sounds.
  useEffect(() => { files.current = new Map(); }, [steps]);

  const playAt = async (i: number, crossfade: number) => {
    const uri = await file(i);
    await player.play(uri, { levelDb: recipeAt(i).levelDb, fadeIn: crossfade, crossfade, title: 'Find your sound' });
  };

  const settle = useCallback((i: number, tapped: boolean) => {
    if (phaseRef.current !== 'drifting') return;
    run.current++;                                   // ends the drift loop
    setP('found');
    setChosen({ i, tapped });
    if (tapped) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('find_sound', { tappedAt: tapped ? indexRef.current : null, kept: i });
    playAt(i, 1.5).catch(() => {});
    onFound(stepsRef.current[i]);
  }, [onFound]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    const mine = ++run.current;
    onStart?.();
    setChosen(null); setIndex(0); indexRef.current = 0; setFrac(0);
    setP('preparing');
    try {
      await file(0);
      file(1).catch(() => {});
      if (mine !== run.current) return;
      setP('drifting');
      stepAt.current = Date.now();
      await playAt(0, 2);
      for (let i = 1; i < N; i++) {
        await wait(STEP_MS);
        if (mine !== run.current) return;
        await file(i);                               // never step to a sound that is not ready
        if (mine !== run.current) return;
        indexRef.current = i; setIndex(i); stepAt.current = Date.now();
        playAt(i, XFADE_S).catch(() => {});
        if (i + 1 < N) file(i + 1).catch(() => {});
      }
      await wait(STEP_MS);
      if (mine !== run.current) return;
      settle(UNTOUCHED, false);
    } catch {
      if (mine === run.current) setP('ready');
    }
  }, [onStart, settle]); // eslint-disable-line react-hooks/exhaustive-deps

  // The ring fills smoothly between settings.
  useEffect(() => {
    if (phase !== 'drifting') return;
    const t = setInterval(() => setFrac(Math.min(1, (Date.now() - stepAt.current) / STEP_MS)), 100);
    return () => clearInterval(t);
  }, [phase]);

  // Leaving the screen ends the drift and its sound.
  useEffect(() => () => { run.current++; player.stop(0.8); }, []);
  // So does switching tabs (screens stay mounted): an unfinished drift goes back to the start.
  useFocusEffect(useCallback(() => () => {
    if (phaseRef.current === 'drifting' || phaseRef.current === 'preparing') { run.current++; setP('ready'); player.stop(0.8); }
  }, []));

  const tapAt = () => settle(Math.max(0, indexRef.current - 1), true);

  const shownIndex = phase === 'found' && chosen ? chosen.i : index;
  const figure = figureFor(recipeAt(shownIndex));
  // The arc meets each dot as its setting begins and travels to the next one while it plays.
  const progress = phase === 'found' ? shownIndex / (N - 1) : phase === 'drifting' ? Math.min(1, (index + frac) / (N - 1)) : 0;
  const live = phase === 'drifting' || phase === 'found';

  const stage = (
    <View style={styles.stage}>
      <Ring size={size} progress={progress} lit={phase === 'found' ? shownIndex : phase === 'drifting' ? index : -1} chosen={phase === 'found' ? shownIndex : null}>
        <Cymatics figure={live || idleFigure ? figure : null} size={Math.round(size * 0.66)} live={live} />
      </Ring>
      <View style={styles.words} accessibilityLiveRegion="polite" aria-live="polite">
        {phase === 'ready' ? (
          <>
            <Body center color={colors.ink2} style={styles.lead}>It starts deep and slowly brightens, about 40 seconds. Tap anywhere the moment it feels like too much.</Body>
            <Meta center>Eyes closed is fine · headphones help</Meta>
          </>
        ) : phase === 'preparing' ? (
          <Meta center>Preparing your sound…</Meta>
        ) : phase === 'drifting' ? (
          <>
            <Heading center>Tap when it’s too much.</Heading>
            <Meta center>{`${STOPS[index]} · ${index + 1} of ${N}`}</Meta>
          </>
        ) : (
          <>
            <Kicker>Your sound</Kicker>
            <Title center>{STOPS[shownIndex]}</Title>
            <Caption center>{chosen?.tapped ? (shownIndex === 0 ? 'The gentlest setting there is.' : 'One step gentler than where you tapped.') : 'No tap, so it stays warm and gentle.'}</Caption>
          </>
        )}
      </View>
    </View>
  );

  const foot = phase === 'ready' || phase === 'preparing' ? (
    <>
      <Button kind="primary" icon="play" label={phase === 'preparing' ? 'Preparing…' : startLabel ?? 'Start'} disabled={phase === 'preparing'} onPress={start} />
      {phase === 'ready' ? extraFoot : null}
    </>
  ) : phase === 'drifting' ? (
    // Looks like a button; the whole screen is the target (see below), so a miss still counts.
    <View style={styles.hint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Meta color={colors.ink}>Tap anywhere</Meta>
    </View>
  ) : (
    <>
      {saveLabel && onSave ? <Button kind="primary" label={saveLabel} onPress={onSave} /> : null}
      <Button kind="quiet" icon="refresh-outline" label="Try again" onPress={start} />
      {extraFoot}
    </>
  );

  // While it drifts, the whole surface is one target: the words, the ring and the empty space.
  if (phase === 'drifting') {
    return (
      <Press accessibilityRole="button" accessibilityLabel="That's too much" accessibilityHint="Keeps your sound one step gentler than this"
        haptic={false} scaleTo={1} largeSurface onPress={tapAt} style={[styles.root, fixed ? styles.inline : null]}>
        {header}{stage}{below?.({ phase, index: shownIndex })}<View style={styles.foot}>{foot}</View>
      </Press>
    );
  }
  return <View style={[styles.root, fixed ? styles.inline : null]}>{header}{stage}{below?.({ phase, index: shownIndex })}<View style={styles.foot}>{foot}</View></View>;
}

/** A 270° lamp ring with one dot per setting; the dots up to the current one are lit. */
function Ring({ size, progress, lit, chosen, children }: { size: number; progress: number; lit: number; chosen: number | null; children: ReactNode }) {
  const c = size / 2, r = c - 12, circ = 2 * Math.PI * r, arc = circ * ARC;
  const start = 135;                                 // degrees, clockwise from 3 o'clock: the arc opens at the bottom
  const dot = (i: number) => {
    const a = ((start + (270 * i) / (N - 1)) * Math.PI) / 180;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.hairlineLit} strokeWidth={1}
          strokeDasharray={`${arc} ${circ}`} transform={`rotate(${start} ${c} ${c})`} />
        {progress > 0 ? (
          <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.lamp} strokeWidth={1.5} strokeLinecap="round" opacity={0.85}
            strokeDasharray={`${Math.max(0.01, arc * Math.min(1, progress))} ${circ}`} transform={`rotate(${start} ${c} ${c})`} />
        ) : null}
        {STOPS.map((_, i) => {
          const p = dot(i);
          const on = i <= lit;
          const mine = chosen === i;
          return (
            <Circle key={i} cx={p.x} cy={p.y} r={mine ? 6 : i === lit ? 4.5 : 3}
              fill={on ? colors.lamp : colors.night} stroke={on ? colors.lamp : colors.ink3} strokeWidth={1}
              opacity={mine ? 1 : on ? 0.9 : 0.6} />
          );
        })}
        {chosen !== null ? <Circle cx={dot(chosen).x} cy={dot(chosen).y} r={12} fill="none" stroke={colors.lamp} strokeWidth={1} opacity={0.35} /> : null}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: space.l },
  // Inside a card (My sound): sized by its content, not the screen.
  inline: { flex: 0 },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingVertical: space.s },
  words: { alignItems: 'center', gap: 8, minHeight: 92, maxWidth: 360, paddingHorizontal: space.s },
  lead: { maxWidth: 340 },
  foot: { gap: 6, paddingTop: space.s },
  hint: { minHeight: 56, borderRadius: 999, borderWidth: 1, borderColor: colors.glassEdge, borderTopColor: colors.glassLit, backgroundColor: colors.glassFill, alignItems: 'center', justifyContent: 'center' },
});
