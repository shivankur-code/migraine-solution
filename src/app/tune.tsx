// My sound: pick a texture, then one instrument: find the sound by ear with one tap while the four dials
// turn along with it, then nudge them by hand. Choosing by A/B and account settings sit behind one tap each.
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { freshProfile, type Profile } from '../lib/profile';
import { loadProfile, saveOnboarded, saveProfile } from '../lib/storage';
import * as player from '../lib/player';
import { Tests } from '../components/build/Tests';
import { PreviewButton, ProfileDial, TextureTiles, usePreview } from '../components/Studio';
import { driftStop, FindSound } from '../components/FindSound';
import { AiReviewCard } from '../components/AiReviewCard';
import { SupportCard } from '../components/SupportCard';
import { AccountCard, SharingCard } from '../components/AccountCard';
import { Body, Button, Caption, Card, Columns, confirmAction, Eyebrow, Heading, Ionicons, Kicker, Meta, Press, Row, Screen, Title, useTablet, useWide } from '../lib/ui';
import { colors, space } from '../lib/theme';
import { track } from '../lib/activity';
import { gentler, useVoice } from '../lib/useVoice';
import { SayOrType } from '../components/room/SayOrType';

const EAR_TESTS = ['tilt', 'cutoff', 'tonal'];
const DIAL_KEYS = ['tone', 'hum', 'motion', 'space'] as const;

export default function MySound() {
  const [profile, setProfile] = useState<Profile>(freshProfile());
  const [open, setOpen] = useState<'ear' | 'more' | 'dials' | 'check' | null>(null);
  const preview = usePreview();
  const wide = useWide();
  const tablet = useTablet();
  useFocusEffect(useCallback(() => {
    loadProfile().then(setProfile);
    return () => { preview.stop(); player.stop(0.3); };
  }, []));

  const update = (next: Profile) => { setProfile(next); saveProfile(next); preview.update(next); };
  // A dial turned by hand: save it and let it be heard.
  const dialed = (next: Profile) => { update(next); if (!preview.on) preview.start(next); };
  // Found by ear: save it (the drift is already playing it, so the preview stays out of the way).
  const found = (next: Profile) => { setProfile(next); saveProfile(next); };

  // Voice: the same words as the Quiet room. Here they turn the dials (one step gentler), change the
  // texture or the volume, and play the result. Nothing talks back; one short line says what changed.
  const [voiceLine, setVoiceLine] = useState('');
  const voice = useVoice({
    consentAI: profile.consentAI,
    say: setVoiceLine,
    apply: heard => {
      const i = heard.intents;
      if (i.includes('stop') || i.includes('worse')) { preview.stop(); setVoiceLine('Stopped.'); return; }
      if (i.includes('dark')) { setVoiceLine('Dark screen is in the Quiet room.'); return; }
      const step = gentler(profile, i);
      let p = step.profile, changed = step.changed;
      const done = step.done;
      if (i.includes('softer')) { p = { ...p, baseLevelDb: Math.max(-40, p.baseLevelDb - 3) }; changed = true; done.push('Softer'); }
      if (heard.timer !== null) done.push('Timers are in the Quiet room');
      if (changed) { setProfile(p); saveProfile(p); }
      if (changed || i.includes('play')) { if (preview.on) preview.update(p); else preview.start(p); }
      setVoiceLine(done.length ? `${done.join(' · ')}.` : i.includes('play') ? 'Playing.' : '');
    },
  });
  // Hold to talk where this device listens privately; elsewhere on the web, the Say or type box.
  const voiceBar = voice.canHold ? (
    <Press accessibilityRole="button" accessibilityLabel="Hold to speak" accessibilityHint="Say softer, darker, less hum or a texture"
      onLongPress={voice.hold} delayLongPress={250} onPressOut={voice.release} haptic={false} style={s.hold}>
      <Ionicons name="mic-outline" size={18} color={voice.listening ? colors.lamp : colors.ink3} />
      <Meta color={voice.listening ? colors.lamp : colors.ink2}>{voice.listening ? 'Listening…' : wide ? 'Hold here or Space to speak' : 'Hold here to speak'}</Meta>
    </Press>
  ) : Platform.OS === 'web' ? <SayOrType onWords={w => voice.handleWords(w, 'typed')} /> : null;
  const hatesHum = (profile.intake.dislikes || []).includes('hum');

  const startOver = () => confirmAction('Set up your sound again?', 'Your dials and choices go back to the start. Your journal stays.', 'Start over', async () => {
    preview.stop();
    const fresh = { ...freshProfile(), consentAI: profile.consentAI };
    await saveProfile(fresh); setProfile(fresh);
    await saveOnboarded(false);
    router.navigate('/');
  });

  const toggle = (k: 'ear' | 'more' | 'dials' | 'check') => { preview.stop(); if (open !== k) track('step_open', { step: k }); setOpen(open === k ? null : k); };

  const mixer = (
    <>
      <View style={s.header}>
        <Kicker>My sound</Kicker>
        <Title accessibilityRole="header">Your sound</Title>
      </View>

      {voiceBar}
      {voiceLine ? <Meta>{voiceLine}</Meta> : null}

      <TextureTiles value={profile.intake.texture} onPick={t => {
        const next = { ...profile, intake: { ...profile.intake, texture: t } };
        update(next);
        if (!preview.on) preview.start(next);
      }} />

      {/* One instrument: find it by ear, and the dials beneath it turn along with the sound. Then nudge them by hand. */}
      <Card style={s.find}>
        <FindSound profile={profile} onFound={found} onStart={() => preview.stop()} size={tablet ? 220 : 200} idleFigure startLabel="Find it by ear"
          header={<View style={s.findHead}><Heading>Find it by ear</Heading></View>}
          extraFoot={<PreviewButton compact on={preview.on} busy={preview.busy} onPress={() => preview.toggle(profile)} />}
          below={({ phase, index: driftAt }) => {
            const drifting = phase === 'drifting' || phase === 'preparing';
            return (
              <View style={s.byHand}>
                {drifting ? null : <Eyebrow>By hand</Eyebrow>}
                <View style={s.dials}>
                  {DIAL_KEYS.map(k => (
                    // While it drifts, all four turn together with the sound; afterwards they are yours.
                    <View key={k} style={s.dial} pointerEvents={drifting ? 'none' : 'auto'}>
                      <ProfileDial which={k} profile={profile} onChange={dialed} size={tablet ? 104 : 92}
                        disabled={k === 'hum' && hatesHum} follow={phase === 'drifting' ? driftStop(profile, k, driftAt) : undefined} />
                    </View>
                  ))}
                </View>
              </View>
            );
          }} />
      </Card>
    </>
  );

  const extras = (
    <>
      <Card style={s.rows}>
        <Row icon="headset-outline" label="Compare two sounds" sub="About 3 minutes"
          expanded={open === 'ear'} onPress={() => toggle('ear')}>
          <Tests profile={profile} onChange={update} keys={EAR_TESTS} />
        </Row>
        <Row icon="sparkles-outline" label="Check my sound"
          expanded={open === 'check' || wide} onPress={() => toggle('check')}>
          <AiReviewCard profile={profile} onChange={update} />
        </Row>
        <Row icon="settings-outline" label="Account and privacy"
          expanded={open === 'more' || wide} onPress={() => toggle('more')}>
          <AccountCard />
          <SharingCard />
          <SupportCard />
        </Row>
      </Card>
      <Button kind="quiet" icon="refresh-outline" label="Start over" onPress={startOver} />
    </>
  );

  return (
    <Screen texture={profile.intake.texture} depth={1}>
      <Columns left={mixer} right={extras} />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { gap: space.xs },
  dials: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 18, paddingVertical: 4 },
  find: { paddingVertical: 24 },
  hold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, borderRadius: 999,
    borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.glassFill },
  findHead: { gap: 4, alignItems: 'center' },
  byHand: { gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.glassEdge, paddingTop: 18 },
  dial: { flexBasis: '45%', alignItems: 'center' },
  // The two rows share one glass panel; the last row's hairline is hidden by the panel's own edge.
  rows: { paddingVertical: 4, paddingHorizontal: 14, gap: 0 },
});
