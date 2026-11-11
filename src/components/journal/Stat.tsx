// One journal number: a light Fraunces numeral under a small capital label, set in a row of three inside
// one glass panel (hairlines between them). With nothing to show yet it says so in words, quietly,
// instead of a dash that looks broken.
import { StyleSheet, View } from 'react-native';
import { colors } from '../../lib/theme';
import { Body, Eyebrow, Heading, Numeral } from '../../lib/ui';

export type StatProps = {
  /** The number or word. `null` / `undefined` is "nothing yet". */
  value: number | string | null | undefined;
  /** What it counts, e.g. "Days with Still". */
  label: string;
  /** Draw a hairline on the left (every stat after the first). */
  divided?: boolean;
};

export function Stat({ value, label, divided }: StatProps) {
  const empty = value === null || value === undefined || value === '';
  const text = empty ? 'Not yet' : String(value);
  return (
    <View style={[styles.stat, divided && styles.divided]} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${empty ? 'nothing yet' : text}`}>
      <Eyebrow numberOfLines={2}>{label}</Eyebrow>
      {empty ? <Body color={colors.ink3} style={styles.empty}>{text}</Body>
        // A number is set large; a word (a sound's name) a size down, so it fits a third of a phone.
        : typeof value === 'number' ? <Numeral numberOfLines={1}>{text}</Numeral>
        : <Heading style={styles.word}>{text}</Heading>}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, minWidth: 0, gap: 6 },
  divided: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.09)', paddingLeft: 14 },
  // Sits on the numeral's baseline so the row lines up whether a stat has a number or not.
  empty: { minHeight: 42, textAlignVertical: 'bottom', paddingTop: 14 },
  word: { minHeight: 42, paddingTop: 12 },
});
