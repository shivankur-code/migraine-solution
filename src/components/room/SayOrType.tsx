// "Say or type": for browsers that cannot listen on the device (Safari, older browsers), a small
// field that takes the same words as voice. On iPhone the keyboard's microphone dictates into it,
// and Apple processes that dictation on the phone. Enter applies it; the field clears itself.
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { colors, fonts } from '../../lib/theme';
import { Ionicons } from '../../lib/ui';

export function SayOrType({ onWords }: { onWords: (text: string) => void }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const send = () => { const t = text.trim(); if (!t) return; setText(''); onWords(t); };
  return (
    <View style={[styles.wrap, focused && styles.wrapOn]}>
      <Ionicons name="mic-outline" size={18} color={colors.ink3} />
      <TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="go" blurOnSubmit={false}
        placeholder="Say or type: softer, darker, stop…" placeholderTextColor={colors.ink3}
        accessibilityLabel="Say or type a change" autoCorrect={false} autoCapitalize="none" maxLength={200}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        {...({ dataSet: { field: 'pill' } } as object)}
        style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.glassFill },
  // Focus shows on the rounded box (lamp edge), not as the browser's square outline inside it.
  wrapOn: { borderColor: colors.lamp },
  // 16 px keeps iOS Safari from zooming into the field.
  input: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: fonts.body, fontSize: 16, paddingVertical: 10, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null) },
});
