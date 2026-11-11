import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { AppState, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../lib/theme';
import { useAppFonts } from '../lib/fonts';
import { useWide, type IconName } from '../lib/ui';
import { timing } from '../lib/motion';
import { TabBar } from '../components/TabBar';
import { Sidebar } from '../components/Sidebar';
import { syncNow } from '../lib/sharing';
import { listenForSignInLinks } from '../lib/account';
// The web shell: baseline CSS and the viewport/theme metas. A no-op module on native.
import '../lib/webShell';

// Outline when resting, filled when it is the room you are in.
const icon = (name: IconName) => ({ focused, color, size }: { focused: boolean; color: unknown; size: number }) => (
  <Ionicons name={(focused ? name.replace(/-outline$/, '') : name) as IconName} size={size} color={color as string} />
);

// Routes cross-fade; tabs are peers, so nothing slides. RN Animated easing: the navigator animates with it.
const crossFade = { animation: 'timing' as const, config: { duration: timing.crossfadeIn, easing: Easing.out(Easing.cubic) } };

export default function Layout() {
  // Desktop browser: a sidebar. Phones, tablets and narrow browsers: the floating tab bar.
  const wide = useWide();
  // Hold the first paint until the fonts are ready (a load failure also counts as ready). On iPhone, text
  // laid out in the fallback font and then drawn in the bundled one gets clipped ("Stil", "Quiet ro…").
  const { ready } = useAppFonts();
  // If the person turned on "Help improve Still", upload new events at launch, on return, and every few minutes.
  useEffect(() => {
    syncNow();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') syncNow(); });
    const timer = setInterval(syncNow, 5 * 60 * 1000);
    const stopLinks = listenForSignInLinks();
    return () => { sub.remove(); clearInterval(timer); stopLinks(); };
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.night }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.night }}>
      <StatusBar style="light" />
      {/* Desktop: the same soft gradient runs behind the sidebar, so the window reads as one surface. */}
      {wide ? <LinearGradient pointerEvents="none" colors={[colors.lift.hush, colors.scene.hush.sky[1], colors.night]} locations={[0, 0.45, 1]} style={[StyleSheet.absoluteFill, { opacity: 0.94 }]} /> : null}
      {/* ...with the same light tint the pages use at their usual loudness, so no edge shows. */}
      {wide ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, opacity: 0.12 }]} /> : null}
      <Tabs
        tabBar={props => (wide ? <Sidebar {...props} /> : <TabBar {...props} />)}
        screenOptions={{
          ...(wide ? { tabBarPosition: 'left' as const } : {}),
          headerShown: false,
          sceneStyle: { backgroundColor: wide ? 'transparent' : colors.night },
          animation: 'fade',
          transitionSpec: crossFade,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Quiet room', tabBarIcon: icon('moon-outline'), tabBarButtonTestID: 'tab-quiet' }} />
        <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book-outline'), tabBarButtonTestID: 'tab-journal' }} />
        <Tabs.Screen name="tune" options={{ title: 'My sound', tabBarIcon: icon('options-outline'), tabBarButtonTestID: 'tab-sound' }} />
        {/* The web landing. Not `href: null`: in SDK 58 js-tabs a hidden route that gains focus is
            redirected to the first tab, so /welcome would never show. TabBar and Sidebar list only
            the three rooms (NAV_ROUTES) and step aside while it is open. */}
        <Tabs.Screen name="welcome" options={{ title: 'Still' }} />
      </Tabs>
    </GestureHandlerRootView>
  );
}
