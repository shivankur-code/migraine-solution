// The three onboarding panes. Each is a plain column that fills the stage; the shell (Onboarding.tsx)
// owns the step, the preview and the cross-fade between panes. Copy here is the spec's, word for word.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Profile } from '../../lib/profile';
import { figureFor } from '../../lib/cymatics';
import { Cymatics } from '../Cymatics';
import { Hud } from '../Hud';
import { colors, space } from '../../lib/theme';
import { Body, Button, Display, Kicker, Title } from '../../lib/ui';
import { Mark } from '../Mark';
import { PreviewButton, TextureTiles, usePreview, type Texture } from '../Studio';
import { FindSound } from '../FindSound';

export type Preview = ReturnType<typeof usePreview>;

/** Kicker, Title and one Body line, shared by panes 1 and 2. */
export function PaneHeader({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <View style={styles.header}>
      <Kicker>{kicker}</Kicker>
      <Title>{title}</Title>
      <Body color={colors.ink2}>{sub}</Body>
    </View>
  );
}

/** Actions sit at the foot of the pane so the thumb finds them in the same place on every step. */
function Foot({ children }: { children: ReactNode }) {
  return <View style={styles.foot}>{children}</View>;
}

// Pane 0: the mark, the name, one sentence, and the primary whose label the deploy workflow greps for (it appears nowhere else).
export function WelcomePane({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  // Loose dust that gathers into a figure a moment after the page appears: what sound does to sand.
  const [formed, setFormed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFormed(true), 700); return () => clearTimeout(t); }, []);
  const figure = figureFor({ tiltDbPerOct: -6.5, texture: 'rain' });
  return (
    <View style={styles.pane}>
      <View style={styles.welcome}>
        <Hud size={180} tl="Still" tr="Cymatics" bl={formed ? `${figure.n} · ${figure.m}` : 'Resting'} br="Rain" ticks={false}>
          <Cymatics figure={formed ? figure : null} size={176} live={formed} />
        </Hud>
        <Mark size={36} />
        <Display center>Still</Display>
        <Body center color={colors.ink2} style={styles.welcomeBody}>A soft sound for migraine days. Made on your phone, just for you.</Body>
      </View>
      <Foot>
        <Button kind="primary" label="Make my sound" onPress={onStart} />
        <Button kind="quiet" label="Just play a gentle sound" onPress={onSkip} />
      </Foot>
    </View>
  );
}

// Pane 1: the texture, chosen by ear. The first tap starts the preview; the room behind follows.
// Listen is the compact pill here (§7.2): the 112 pt round control is My sound's, and these panes are tight at 375 × 667.
export function TexturePane({ profile, preview, onPick, onContinue }: {
  profile: Profile; preview: Preview; onPick: (t: Texture) => void; onContinue: () => void;
}) {
  return (
    <View style={styles.pane}>
      <PaneHeader kicker="1 of 2" title="Pick what feels restful" sub="Tap one to hear it. Use headphones if you can." />
      <TextureTiles value={profile.intake.texture} onPick={onPick} />
      <PreviewButton compact on={preview.on} busy={preview.busy} onPress={() => preview.toggle(profile)} />
      <Foot>
        <Button kind="primary" label="Continue" onPress={onContinue} />
      </Foot>
    </View>
  );
}

// Pane 2: find the sound with one tap. The whole pane, words included, is the target while it drifts.
export function FindPane({ profile, onFound, onStart, onSave }: {
  profile: Profile; onFound: (p: Profile) => void; onStart: () => void; onSave: () => void;
}) {
  return (
    <View style={styles.pane}>
      <FindSound profile={profile} onFound={onFound} onStart={onStart} saveLabel="Save my sound" onSave={onSave}
        header={<PaneHeader kicker="2 of 2" title="Find your sound" sub="No dials. Just listen." />} />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, gap: space.l, paddingTop: space.l },
  header: { gap: 6, alignSelf: 'stretch' },
  welcome: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.xl, paddingVertical: space.xl },
  welcomeBody: { maxWidth: 320 },
  foot: { marginTop: 'auto', gap: 6, paddingTop: space.s },
});
