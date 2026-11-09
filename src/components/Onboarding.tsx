// First-run setup: three taps and one dial, about 30 seconds. Every step can be skipped, and the
// sound plays while you choose, so people decide by ear rather than by reading.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recipeFor, type Profile } from '../lib/profile';
import { figureFor } from '../lib/cymatics';
import { Cymatics } from './Cymatics';
import { Hud } from './Hud';
import { colors, fonts } from '../lib/theme';
import { Button, Ionicons, tap, useReduceMotion } from '../lib/ui';
import { track } from '../lib/activity';
import { DIALS, PreviewButton, ProfileDial, TextureTiles, Tile, textureName, usePreview, withHardest, type Hardest } from './Studio';

const HARDEST: { value: Hardest; label: string; sub: string; icon: 'sparkles-outline' | 'pulse-outline' | 'flash-outline' | 'ellipse-outline' }[] = [
  { value: 'high', label: 'Hiss and high sounds', sub: 'Kettles, static, squeaks', icon: 'sparkles-outline' },
  { value: 'low', label: 'Low rumble', sub: 'Traffic, fridges, engines', icon: 'pulse-outline' },
  { value: 'sudden', label: 'Sudden noises', sub: 'Doors, alerts, dropped things', icon: 'flash-outline' },
  { value: 'unsure', label: 'Not sure', sub: 'Start with something gentle', icon: 'ellipse-outline' },
];

export function Onboarding({ profile, onChange, onDone }: { profile: Profile; onChange: (p: Profile) => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [hardest, setHardest] = useState<Hardest | null>(null);
  const preview = usePreview();
  const enter = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();

  // Each step glides up and fades in, like a sheet settling (a plain cut with Reduce Motion on).
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  }, [step, reduce]);

  const update = (p: Profile) => { onChange(p); preview.update(p); };
  const sound = recipeFor(profile, 'warning').recipe;
  const figure = figureFor(sound);
  // On the welcome screen the dust gathers into a figure a moment after it appears.
  const [formed, setFormed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFormed(true), 700); return () => clearTimeout(t); }, []);
  const go = (n: number) => { track('onboarding_step', { step: n }); setStep(n); };
  const finish = (how: 'done' | 'skipped') => { preview.stop(); track('onboarding_done', { how, step }); onDone(); };

  const body = [
    // 0 · Welcome
    <View key="w" style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
      <View style={{ alignItems: 'center' }}>
        <Hud size={200} tl="Still" tr="Cymatics" bl={formed ? `Figure ${figure.n} · ${figure.m}` : 'Resting'} br={textureName(sound.texture)}>
          <Cymatics figure={formed ? figure : null} size={196} live={formed} />
        </Hud>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 44, letterSpacing: -0.8, textAlign: 'center' }}>Still</Text>
        <Text style={{ color: colors.muted, fontSize: 17, lineHeight: 25, textAlign: 'center' }}>A soft sound for migraine days.{'\n'}Made on your phone, just for you.</Text>
      </View>
    </View>,
    // 1 · One question
    <View key="q" style={{ gap: 14 }}>
      <Title kicker="1 of 3" title="What's hardest on your ears?" sub="During a headache. Pick one." />
      {HARDEST.map(h => (
        <Tile key={h.value} wide icon={h.icon} label={h.label} sub={h.sub} on={hardest === h.value}
          onPress={() => { setHardest(h.value); update(withHardest(profile, h.value)); setTimeout(() => go(2), 260); }} />
      ))}
    </View>,
    // 2 · Texture, by ear
    <View key="t" style={{ gap: 18 }}>
      <Title kicker="2 of 3" title="Pick what feels restful" sub="Tap one to hear it. Use headphones if you can." />
      <TextureTiles value={profile.intake.texture} onPick={t => {
        const next = { ...profile, intake: { ...profile.intake, texture: t } };
        onChange(next);
        if (preview.on) preview.update(next); else preview.start(next);
      }} />
      <PreviewButton on={preview.on} busy={preview.busy} onPress={() => preview.toggle(profile)} />
    </View>,
    // 3 · One dial
    <View key="d" style={{ gap: 22, alignItems: 'center' }}>
      <Title kicker="3 of 3" title="Turn it to taste" sub="Turn the dial and watch your sound take shape. Deeper is usually calmer." />
      <Pressable accessibilityRole="button" accessibilityLabel={preview.on ? 'Stop listening' : 'Listen'} onPressIn={tap} onPress={() => preview.toggle(profile)}>
        <Hud size={150} tl={DIALS.tone.stops[DIALS.tone.index(recipeFor(profile, 'normal').recipe)]} tr={`${figure.n} · ${figure.m}`} bl={preview.on ? (preview.busy ? 'Tuning' : 'Playing') : 'Tap to listen'} br={textureName(sound.texture)} ticks={false}>
          <Cymatics figure={figure} size={146} live={preview.on} />
        </Hud>
      </Pressable>
      <ProfileDial which="tone" profile={profile} onChange={update} size={132} />
    </View>,
  ][step];

  const primary = step === 0 ? { label: 'Make my sound', go: () => go(1) }
    : step === 1 ? { label: 'Continue', go: () => { if (!hardest) update(withHardest(profile, 'unsure')); go(2); } }
    : step === 2 ? { label: 'Continue', go: () => { if (!preview.on) preview.start(profile); go(3); } }
    : { label: 'Save my sound', go: () => finish('done') };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: colors.bg }}>
      <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            {step > 0
              ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPressIn={tap} onPress={() => go(step - 1)} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.muted} /></Pressable>
              : <View />}
            <Dots step={step} />
            <Pressable accessibilityRole="button" accessibilityLabel="Skip setup" onPressIn={tap} onPress={() => finish('skipped')} hitSlop={12}>
              <Text style={{ color: colors.muted, fontSize: 15 }}>Skip</Text>
            </Pressable>
          </View>
          <Animated.View style={{ flex: 1, justifyContent: step === 0 ? 'center' : 'flex-start', paddingTop: step === 0 ? 0 : 18,
            opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
            {body}
          </Animated.View>
          <View style={{ gap: 6 }}>
            <Button kind="primary" label={primary.label} onPress={primary.go} />
            {step === 0 && <Button kind="quiet" label="Just play a gentle sound" onPress={() => finish('skipped')} />}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Title({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <View style={{ gap: 6, alignSelf: 'stretch' }}>
      <Text style={{ color: colors.accent, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>{kicker}</Text>
      <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.4, lineHeight: 36 }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 15.5, lineHeight: 22 }}>{sub}</Text>
    </View>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step + 1} of 4`}>
      {[0, 1, 2, 3].map(i => <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.accent : 'rgba(255,255,255,0.14)' }} />)}
    </View>
  );
}
