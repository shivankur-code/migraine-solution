// "Say or type": for browsers that cannot listen on the device (Safari, older browsers), a small
// field that takes the same words as voice. On iPhone the keyboard's microphone dictates into it,
// and Apple processes that dictation on the phone. Enter applies it; the field clears itself.
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts } from '../../lib/theme';
import { Ionicons } from '../../lib/ui';

export function SayOrType({ onWords }: { onWords: (text: string) => void }) {
  const [text, setText] = useState('');
  const send = () => { const t = text.trim(); if (!t) return; setText(''); onWords(t); };
  return (
    <View style={styles.wrap}>
      <Ionicons name="mic-outline" size={18} color={colors.ink3} />
      <TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="go" blurOnSubmit={false}
        placeholder="Say or type: softer, darker, stop…" placeholderTextColor={colors.ink3}
        accessibilityLabel="Say or type a change" autoCorrect={false} autoCapitalize="none" maxLength={200}
        style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.glassFill },
  // 16 px keeps iOS Safari from zooming into the field.
  input: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: fonts.body, fontSize: 16, paddingVertical: 10 },
});
