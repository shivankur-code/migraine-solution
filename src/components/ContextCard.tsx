// Live nudges the person can switch: a little gentler late in the day (on by default), and on days
// when the phone's barometer shows air pressure falling (off until they allow it). Both only ever
// make the sound quieter and darker, and only when it starts. See recipe/personal.js.
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { Profile } from '../lib/profile';
import { allowPressure, pressureAvailable } from '../lib/pressure';
import { Caption, Control } from '../lib/ui';
import { switchColors } from './AccountCard';

export function ContextCard({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const ctx = profile.context ?? { timeOfDay: true, pressure: false };
  const [hasBarometer, setHasBarometer] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { pressureAvailable().then(setHasBarometer).catch(() => {}); }, []);
  const set = (next: Partial<typeof ctx>) => onChange({ ...profile, context: { ...ctx, ...next } });

  const togglePressure = async (on: boolean) => {
    if (!on) { set({ pressure: false }); setNote(''); return; }
    const ok = await allowPressure();
    if (ok) { set({ pressure: true }); setNote(''); }
    else setNote('Allow Motion & Fitness for Still in your phone’s Settings to use this.');
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}><Control>Gentler late in the day</Control><Caption>A little quieter in the evening and at night.</Caption></View>
        <Switch value={ctx.timeOfDay} onValueChange={v => set({ timeOfDay: v })} accessibilityLabel="Gentler late in the day" {...switchColors(ctx.timeOfDay)} />
      </View>
      {hasBarometer ? (
        <View style={styles.row}>
          <View style={styles.text}><Control>Air pressure</Control><Caption>When pressure is falling, your sound starts a little gentler. Read on this phone; nothing is sent.</Caption></View>
          <Switch value={ctx.pressure} onValueChange={togglePressure} accessibilityLabel="Air pressure" {...switchColors(ctx.pressure)} />
        </View>
      ) : null}
      {note ? <Caption accessibilityLiveRegion="polite">{note}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  text: { flex: 1, gap: 2 },
});
