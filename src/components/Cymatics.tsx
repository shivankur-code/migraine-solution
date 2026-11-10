// Cymatics on phones: a few hundred grains that glide from one figure to the next. The motion runs
// on the native thread. While the sound plays, the plate turns slowly (fan, ocean) and breathes in
// time with the sound's own swell. Slow, low-contrast motion only (no flashing); still under
// Reduce Motion. The web version (Cymatics.web.tsx) draws thousands of grains on a canvas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { gather, scatter, type Figure } from '../lib/cymatics';
import { useReducedMotion } from '../lib/motion';

type Props = { figure: Figure | null; size: number; live?: boolean; pulse?: number; opacity?: number };
// Lamp-amber grains with every fifth one cream, the same mix as the landing page's point field.
const GRAIN = 'rgba(194,154,98,0.85)', GLINT = 'rgba(232,227,217,0.8)';

export function Cymatics({ figure, size, live = false, pulse = 0, opacity = 1 }: Props) {
  const count = Math.round(Math.min(260, Math.max(110, size * 1.05)));
  const reduce = useReducedMotion();
  const target = useMemo(() => (figure ? gather(figure, count) : scatter(count)), [figure?.key, figure?.hum, figure?.spread, figure?.fuzz, count]);
  const [pair, setPair] = useState({ from: target, to: target });
  const morph = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  // A new figure: grains glide from where they were to where the new sound puts them.
  useEffect(() => {
    if (pair.to === target) return;
    setPair(p => ({ from: p.to, to: target }));
    morph.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(morph, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [target]);

  // A pulse throws the grains outward; they settle back.
  useEffect(() => {
    if (!pulse || reduce) return;
    burst.setValue(0);
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(burst, { toValue: 0, speed: 4, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [pulse]);

  // Slow turning (dust always drifts a little; a figure turns only while its sound plays) and breath.
  const spin = figure ? (live ? figure.spin : 0) : 0.25;
  useEffect(() => {
    if (reduce || !spin) { turn.stopAnimation(); return; }
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 90000 / spin, easing: Easing.linear, useNativeDriver: true }));
    turn.setValue(0); loop.start();
    return () => loop.stop();
  }, [spin, reduce]);
  const breathe = live && figure && !reduce ? figure.breathe : 0;
  useEffect(() => {
    if (!breathe || !figure) { breath.stopAnimation(); breath.setValue(0); return; }
    const half = (figure.breathPeriodS * 1000) / 2;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe, figure?.breathPeriodS]);

  const R = size * 0.47;
  const grains = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const fx = pair.from[i * 2] * R, fy = pair.from[i * 2 + 1] * R, tx = pair.to[i * 2] * R, ty = pair.to[i * 2 + 1] * R;
      out.push({
        x: Animated.add(morph.interpolate({ inputRange: [0, 1], outputRange: [fx, tx] }), burst.interpolate({ inputRange: [0, 1], outputRange: [0, tx * 0.28] })),
        y: Animated.add(morph.interpolate({ inputRange: [0, 1], outputRange: [fy, ty] }), burst.interpolate({ inputRange: [0, 1], outputRange: [0, ty * 0.28] })),
      });
    }
    return out;
  }, [pair, R, count]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (figure?.breathe ?? 0) * 0.04] });
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, opacity: live ? opacity : opacity * 0.85 }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }, { scale }] }}>
        {grains.map((g, i) => (
          <Animated.View key={i} style={{ position: 'absolute', left: size / 2 - 1, top: size / 2 - 1, width: 2, height: 2, borderRadius: 1, backgroundColor: i % 5 === 0 ? GLINT : GRAIN, transform: [{ translateX: g.x }, { translateY: g.y }] }} />
        ))}
      </Animated.View>
    </View>
  );
}
