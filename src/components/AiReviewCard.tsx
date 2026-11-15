// "Check my sound": an instant on-device check (nothing sent), then, if the person allows it, an
// AI review that refines it in the background. Either can only make small, gentler changes.
import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import type { AiReview, Profile } from '../lib/profile';
import { aiAvailable, deviceReview, requestReview, reviewPayload, ReviewError } from '../lib/ai';
import { loadJournal } from '../lib/storage';
import { track } from '../lib/activity';
import { Body, Button, Caption, Control } from '../lib/ui';
import { colors } from '../lib/theme';
import { switchColors } from './AccountCard';

const NAMES: Record<string, string> = {
  levelOffsetDb: 'Quieter', tiltDbPerOct: 'Darker', cutoffHz: 'Softer highs', fadeInS: 'Slower fade-in', tonal: 'Hum',
  swellDb: 'Rise and fall', width: 'Width', humHz: 'Hum pitch', swellPeriodS: 'Rise-and-fall speed', extraCuts: 'Band cuts',
};

export function AiReviewCard({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const check = async () => {
    const journal = await loadJournal();
    const local = deviceReview(profile, journal);
    let current: Profile = { ...profile, aiReview: local };
    onChange(current);
    track('review', { source: 'device', changes: local.rationale.length });
    if (!aiAvailable || !profile.consentAI) { setNote(''); return; }
    setBusy(true); setNote('The AI is taking a closer look. This usually takes under a minute…');
    try {
      const ai = await requestReview(profile, journal, local);
      current = { ...current, aiReview: ai };
      onChange(current);
      track('review', { source: 'ai', changes: ai.rationale.length });
      setNote('');
    } catch (e) {
      setNote(e instanceof ReviewError ? e.message : 'The AI could not be reached. Your on-device check is applied.');
    }
    setBusy(false);
  };

  const r: AiReview | null = profile.aiReview && (profile.consentAI || profile.aiReview.source === 'device') ? profile.aiReview : null;
  const changed = r ? Object.keys(r.adjustments || {}) : [];

  return (
    <View style={styles.card}>
      <Caption>Looks at your answers, tests and journal and makes small changes if they would help. It can never make the sound louder or harsher.</Caption>
      <Button label={busy ? 'The AI is looking…' : 'Check my sound'} onPress={check} disabled={busy} testID="check-sound" />
      {r ? (
        <View style={styles.result} testID="review-result">
          <Caption>{r.source === 'ai' ? 'AI review' : 'On-device check, nothing sent'}</Caption>
          {r.summary ? <Body>{r.summary}</Body> : null}
          {r.rationale.map((x, i) => <Text key={i} style={styles.line}>{`${NAMES[x.param] || x.param}: ${x.why}`}</Text>)}
          {(r.cautions || []).map((c, i) => <Text key={`c${i}`} style={[styles.line, { color: colors.ink }]}>{c}</Text>)}
          {(r.questions || []).map((q, i) => <Text key={`q${i}`} style={styles.line}>{`? ${q}`}</Text>)}
          {changed.length ? <Button kind="quiet" label="Undo these changes" onPress={() => { onChange({ ...profile, aiReview: null }); setNote('Back to your sound before the check.'); }} /> : null}
        </View>
      ) : null}
      {aiAvailable ? (
        <>
          <View style={styles.switchRow}>
            <Control style={styles.switchLabel}>Also ask the AI</Control>
            <Switch value={profile.consentAI} onValueChange={v => onChange({ ...profile, consentAI: v })} accessibilityLabel="Also ask the AI" {...switchColors(profile.consentAI)} />
          </View>
          <Caption>Sends your settings and journal counts (no name, dates or notes) for a second opinion. Needs sign-in, 5 a day.</Caption>
          {profile.consentAI && <Button kind="quiet" icon="eye-outline" label={preview ? 'Hide what is sent' : 'See what is sent'} onPress={async () => setPreview(preview ? null : JSON.stringify(reviewPayload(profile, await loadJournal()), null, 1))} />}
          {preview ? <Text selectable style={styles.preview}>{preview}</Text> : null}
        </>
      ) : null}
      {note ? <Caption accessibilityLiveRegion="polite">{note}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  switchLabel: { flex: 1 },
  // The exact payload, in a monospace face so the JSON lines up.
  preview: {
    color: colors.ink2, fontSize: 12, lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
  },
  result: { gap: 8, borderLeftWidth: 2, borderLeftColor: colors.lampDeep, paddingLeft: 12 },
  line: { color: colors.ink2, fontSize: 14, lineHeight: 20 },
});
