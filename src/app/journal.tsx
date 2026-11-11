// Journal: headache episodes, what was chosen and how it felt, in three glass panels. Kept on this device. The room is always
// hush at depth 1, the quietest scene, because this page is read on better days than the quiet room.
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { episodes, freshJournal, metrics, sanitizeJournal } from '../engine/journal-store.js';
import { clearJournal, loadJournal, loadProfile, saveJournal, type Journal } from '../lib/storage';
import { recipeFor } from '../lib/profile';
import { figureFor, type Figure } from '../lib/cymatics';
import { Cymatics } from '../components/Cymatics';
import { textureName } from '../components/Studio';
import { clearActivity, loadActivity, summarize } from '../lib/activity';
import { Body, Button, Card, Caption, Chip, Columns, confirmAction, Eyebrow, Heading, Kicker, Screen, Status, Title, useWide } from '../lib/ui';
import { colors } from '../lib/theme';
import { Stat } from '../components/journal/Stat';
import { Bars } from '../components/journal/Bars';
import { Timeline } from '../components/journal/Timeline';

const CHOICES = { silence: 'Dark screen', comfort: 'My sound', softer: 'Softer' } as const;
const FOLLOWS = { better: 'A bit easier', same: 'About the same', worse: 'Worse' } as const;
const BAR_COLORS: Record<keyof typeof FOLLOWS, string> = { better: colors.moss, same: colors.ink3, worse: colors.rose };
const DAY = 864e5;

export default function JournalScreen() {
  const [journal, setJournal] = useState<Journal>(freshJournal() as Journal);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [act, setAct] = useState(summarize([]));
  const [figure, setFigure] = useState<Figure | null>(null);
  const [texture, setTexture] = useState('rain');
  const [formed, setFormed] = useState(false);
  const [pulse, setPulse] = useState(0);
  const wide = useWide();
  // Each visit, the dust gathers into the person's own figure.
  useFocusEffect(useCallback(() => {
    loadJournal().then(j => { setJournal(j); setLoaded(true); });
    loadActivity().then(a => setAct(summarize(a, 90))).catch(() => {});
    loadProfile().then(p => { const r = recipeFor(p, 'warning').recipe; setFigure(figureFor(r)); setTexture(r.texture); });
    const t = setTimeout(() => setFormed(true), 350);
    return () => { clearTimeout(t); setFormed(false); };
  }, []));

  const m = metrics(journal);
  const eps = episodes(journal).reverse();
  const empty = m.usedEpisodes === 0;

  const addMissed = async (daysAgo: number) => {
    const at = new Date(Date.now() - daysAgo * DAY); at.setHours(12, 0, 0, 0);
    const day = at.toISOString().slice(0, 10);
    const j = await loadJournal();
    if (j.missed.some(x => x.at.slice(0, 10) === day)) { setNote('That day is already noted.'); return; }
    j.missed.push({ at: at.toISOString() });
    const next = sanitizeJournal(j) as Journal;
    const saved = await saveJournal(next);
    setNote(saved ? 'Noted. Thank you.' : 'The phone is not letting Still save.');
    if (saved) setPulse(n => n + 1); // a ripple through the figure
    setJournal(next);
  };

  const clear = () => confirmAction('Clear your journal?', 'This removes every entry from this device. It cannot be undone.', 'Clear',
    async () => { await clearJournal(); await clearActivity(); setJournal(freshJournal() as Journal); setAct(summarize([])); setNote('Journal cleared.'); });

  const timeline = eps.slice(0, 40).map(e => {
    const chose = Object.entries(e.choices).filter(([, n]) => n).map(([k, n]) => `${CHOICES[k as keyof typeof CHOICES].toLowerCase()}${Number(n) > 1 ? ` ×${n}` : ''}`).join(' · ');
    const felt = Object.entries(e.followUps).filter(([k, n]) => n && k in FOLLOWS).map(([k]) => FOLLOWS[k as keyof typeof FOLLOWS].toLowerCase());
    const minutes = e.listeningS ? Math.round(e.listeningS / 60) : 0;
    return {
      key: e.start,
      date: new Date(e.start).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      details: [chose, e.listeningS ? `${minutes} min` : '', felt.length ? `felt ${felt.join(', ')}` : ''].filter(Boolean).join(' · '),
      minutes: e.listeningS / 60,
      worse: e.worse,
    };
  });

  const days = `${m.usedEpisodes} ${m.usedEpisodes === 1 ? 'day' : 'days'} with Still`;
  return (
    <Screen texture="hush" depth={1}>
      <Columns rightWidth={400} gap={24} left={<>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Kicker>Journal</Kicker>
            <Title>Your journal</Title>
            <Body color={colors.ink2}>{empty ? 'Still notes each time you use it. It stays on this device.' : `${days} · only on this device`}</Body>
          </View>
          {/* The person's own figure, gathering on each visit. No frame: it floats on the glass light. */}
          <View style={styles.figure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Cymatics figure={formed ? figure : null} size={wide ? 120 : 84} live={formed} pulse={pulse} opacity={0.9} />
          </View>
        </View>

        <Card style={styles.stats}>
          <Stat value={empty ? null : m.usedEpisodes} label="Hard days" />
          <Stat divided value={m.medianListeningMin === null ? null : m.medianListeningMin < 1 ? 'Under a minute' : `${Math.round(m.medianListeningMin)} min`} label="Usual length" />
          <Stat divided value={act.helpedMost?.sound ?? textureName(texture)} label={act.helpedMost ? 'Helped most' : 'Your sound'} />
        </Card>

        <Card style={styles.panel}>
          <Eyebrow>How it felt afterwards</Eyebrow>
          <Bars ready={loaded} rows={(Object.keys(FOLLOWS) as (keyof typeof FOLLOWS)[]).map(k => ({ key: k, label: FOLLOWS[k], count: m.followUps[k] || 0, color: BAR_COLORS[k] }))} />
          <Caption color={colors.ink3}>Feeling better afterwards doesn't mean the sound caused it.</Caption>
          <View style={styles.rule} />
          <Heading>Headache without Still?</Heading>
          <Caption>One tap, no details.</Caption>
          <View style={styles.chips}>
            <Chip fit label="Today" onPress={() => addMissed(0)} style={styles.chip} />
            <Chip fit label="Yesterday" onPress={() => addMissed(1)} style={styles.chip} />
            <Chip fit label="2 days ago" onPress={() => addMissed(2)} style={styles.chip} />
          </View>
          {note ? <Status>{note}</Status> : null}
        </Card>

      </>} right={
        <Card style={styles.panel}>
          <Eyebrow>{eps.length ? `Episodes · ${eps.length}` : 'Episodes'}</Eyebrow>
          <Timeline episodes={timeline} />
          {(eps.length > 0 || m.missedEpisodes > 0) ? <Button kind="quiet" label="Clear journal" onPress={clear} style={styles.clear} /> : null}
        </Card>
      } />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  heroText: { flex: 1, gap: 6 },
  figure: { opacity: 0.9 },
  stats: { flexDirection: 'row', gap: 14, paddingVertical: 18 },
  panel: { gap: 12 },
  rule: { height: 1, backgroundColor: colors.glassEdge, marginVertical: 6 },
  clear: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 44 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 6 },
  // Three across on a 375 pt phone; the labels wrap inside the chip under large type.
  chip: { flex: 1, paddingHorizontal: 8 },
});
