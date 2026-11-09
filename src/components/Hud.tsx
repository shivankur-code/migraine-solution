// A thin instrument frame around a figure: corner brackets, a fine tick ruler and small
// letter-spaced labels, like a measuring plate. Purely visual; screen readers skip it.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors } from '../lib/theme';

const LINE = 'rgba(214,226,206,0.28)';

export function Caps({ children, color = colors.muted, size = 12.5 }: { children: ReactNode; color?: string; size?: number }) {
  return <Text style={{ color, fontSize: size, letterSpacing: 2.2, textTransform: 'uppercase' }}>{children}</Text>;
}

export function Hud({ size, children, tl, tr, bl, br, ticks = true }: {
  size: number; children: ReactNode; tl?: string; tr?: string; bl?: string; br?: string; ticks?: boolean;
}) {
  const arm = 14, pad = 6;
  const corner = (pos: object, edges: object) => <View style={[{ position: 'absolute', width: arm, height: arm, borderColor: LINE }, pos, edges]} />;
  const label = (text: string | undefined, pos: object, align: 'left' | 'right') => text
    ? <Text numberOfLines={1} style={[{ position: 'absolute', color: colors.muted, fontSize: 11.5, letterSpacing: 1.8, textTransform: 'uppercase', textAlign: align, maxWidth: size * 0.6 }, pos]}>{text}</Text>
    : null;
  return (
    <View style={{ width: size + pad * 2, height: size + pad * 2 + 36, alignItems: 'center', justifyContent: 'center' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 18 }}>
        {corner({ top: 0, left: 0 }, { borderTopWidth: 1, borderLeftWidth: 1 })}
        {corner({ top: 0, right: 0 }, { borderTopWidth: 1, borderRightWidth: 1 })}
        {corner({ bottom: 0, left: 0 }, { borderBottomWidth: 1, borderLeftWidth: 1 })}
        {corner({ bottom: 0, right: 0 }, { borderBottomWidth: 1, borderRightWidth: 1 })}
        {ticks && (
          <View style={{ position: 'absolute', bottom: 4, left: arm + 8, right: arm + 8, height: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {Array.from({ length: 25 }, (_, i) => <View key={i} style={{ width: 1, height: i % 6 === 0 ? 6 : 3, backgroundColor: LINE }} />)}
          </View>
        )}
      </View>
      {label(tl, { top: 0, left: 2 }, 'left')}
      {label(tr, { top: 0, right: 2 }, 'right')}
      {label(bl, { bottom: 0, left: 2 }, 'left')}
      {label(br, { bottom: 0, right: 2 }, 'right')}
      {children}
    </View>
  );
}
