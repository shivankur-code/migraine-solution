// The app mark: one wave at rest inside a plate, with the still point at its centre (sound settling
// into stillness, as sand settles on a vibrating plate). Decorative; the word "Still" sits beside it.
import { Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * Hides a react-native-svg <Svg> from assistive tech. On web react-native-svg hands its props straight
 * to the DOM <svg>, where the native-only props become unknown attributes (React warns on every render),
 * so web gets `aria-hidden` alone.
 */
export const svgHidden: object = Platform.OS === 'web'
  ? { 'aria-hidden': true }
  : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true };

export function Mark({ size = 24, color = colors.lamp, strokeWidth = 1.5 }: { size?: number; color?: string; strokeWidth?: number }) {
  // Drawn in a 24-unit box so the stroke stays 1.5 px at every size (vector-effect keeps it from scaling).
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none" {...svgHidden}>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth * 0.75} opacity={0.55} vectorEffect="non-scaling-stroke" />
      <Path d="M4.5 12c1.9-5.6 5.6-5.6 7.5 0s5.6 5.6 7.5 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </Svg>
  );
}
