// The room behind every screen: one continuous gradient per scene (a soft lift at the top fading to
// night) and a whole-screen tint that deepens with loudness. No floor and no
// horizon: a band across the middle read as two screens stacked. No grain, no drift. Colours never interpolate at runtime
// (Reanimated on web cannot animate gradient colours), so every change is the opacity of a stacked layer.
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, makeMutable, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, depthTint, tintMax, tintStep, z, type Depth, type SceneTexture } from '../lib/theme';
import { cross, ease, lum, timing } from '../lib/motion';

export type SceneProps = {
  /** Which room. `none` and unknown values read as `hush`. */
  texture?: SceneTexture | 'none' | string | null;
  /** Loudness: Full 0, Gentle 1, Hushed 2. Each step darkens the whole room a little. */
  depth?: Depth;
  /** While sound fades in the room brightens 0.94 -> 1 over `fadeInMs`. */
  playing?: boolean;
  /** Softer adds one depth step. */
  softer?: boolean;
  /** "Making it worse" adds a permanent 0.10 tint for the visit. */
  worse?: boolean;
  /** The recipe's fade-in, `recipe.fadeInS * 1000`, so the room brightens at the rate the gain ramps. */
  fadeInMs?: number;
};

const IDLE_OPACITY = 0.94;   // the room is a touch dimmer until a sound plays
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const asTexture = (t: SceneProps['texture']): SceneTexture => (t === 'rain' || t === 'ocean' || t === 'fan' ? t : 'hush');

/** A scene fading in over the ones beneath it. Its opacity starts at 0, so its first frame shows nothing. */
type Layer = { id: number; texture: SceneTexture; opacity: SharedValue<number> };
type Stack = { base: SceneTexture; layers: Layer[] };

export function Scene({ texture, depth = 1, playing = false, softer = false, worse = false, fadeInMs = timing.luminance }: SceneProps) {

  // Texture cross-fade: each new scene is a layer that mounts at opacity 0 and fades in over whatever is
  // showing. A second change mid-fade stacks another layer on top, so the half-faded blend beneath stays
  // exactly as it was: nothing jumps. When a layer is fully in, everything under it is dropped.
  const next = asTexture(texture);
  const [stack, setStack] = useState<Stack>({ base: next, layers: [] });
  const seq = useRef(0);
  const top = stack.layers.length ? stack.layers[stack.layers.length - 1].texture : stack.base;
  useEffect(() => {
    if (next === top) return;
    const layer: Layer = { id: ++seq.current, texture: next, opacity: makeMutable(0) };
    setStack(s => ({ ...s, layers: [...s.layers, layer] }));
  }, [next, top]);
  const settle = useCallback((id: number) => setStack(s => {
    const i = s.layers.findIndex(l => l.id === id);
    return i < 0 ? s : { base: s.layers[i].texture, layers: s.layers.slice(i + 1) };
  }), []);
  const started = useRef(new Set<number>());
  useEffect(() => {
    for (const l of stack.layers) {
      if (started.current.has(l.id)) continue;
      started.current.add(l.id);
      l.opacity.set(withTiming(1, cross(timing.crossfadeIn), finished => { if (finished) scheduleOnRN(settle, l.id); }));
    }
  }, [stack.layers, settle]);

  // Luminance: a whole-screen tint per loudness step, and a slight brightening while the sound fades in.
  // Both are kept under reduced motion (they change brightness only, never position).
  const tint = useSharedValue(Math.min(depthTint[depth] + (softer ? tintStep : 0) + (worse ? tintStep : 0), tintMax));
  const glow = useSharedValue(playing ? 1 : IDLE_OPACITY);
  useEffect(() => {
    cancelAnimation(tint);
    tint.set(withTiming(Math.min(depthTint[depth] + (softer ? tintStep : 0) + (worse ? tintStep : 0), tintMax), lum(timing.luminance)));
  }, [depth, softer, worse, tint]);
  useEffect(() => {
    cancelAnimation(glow);
    glow.set(playing ? withTiming(1, { duration: fadeInMs, easing: ease.linear }) : withTiming(IDLE_OPACITY, lum(timing.luminance)));
  }, [playing, fadeInMs, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.get() }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Sky texture={stack.base} />
        {stack.layers.map(l => <FadeSky key={l.id} opacity={l.opacity} texture={l.texture} />)}
      </Animated.View>
      <AnimatedGradient colors={[colors.night, colors.black]} style={[StyleSheet.absoluteFill, tintStyle]} />
    </View>
  );
}

/** One continuous gradient, top to bottom: the scene's lift, its sky, then night. No floor, no horizon. */
function Sky({ texture }: { texture: SceneTexture }) {
  return <LinearGradient colors={[colors.lift[texture], colors.scene[texture].sky[1], colors.night]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />;
}

/** A scene's gradient fading in over the ones beneath it. */
function FadeSky({ opacity, texture }: { opacity: SharedValue<number>; texture: SceneTexture }) {
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, animated]}><Sky texture={texture} /></Animated.View>;
}

const styles = StyleSheet.create({
  root: { zIndex: z.scene, overflow: 'hidden', backgroundColor: colors.night },
});
