// Web routing for the welcome page. Every fresh visit to the site's front door (the Quiet room at "/")
// opens /welcome first; from there, "Open the quiet room" goes straight in. Moving around inside the
// app never bounces back (tabs, the Still link, the CTA), and direct links to /tune or /journal open
// as they are. Native never redirects: the app store listing is its landing.
// Safe to import anywhere: nothing here touches `window` unless it exists.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

const WELCOMED_KEY = 'still.welcomed';

// Once per page load: set when the welcome page has been shown (or the visit started somewhere else),
// so the redirect happens at most once and only on arrival.
let settled = false;

// Where this page load began, read once when the app loads (later in-app moves change the address).
const ARRIVED_AT = typeof window === 'undefined' ? null : window.location.pathname.replace(/\/+$/, '');
/** True when this page load began at the site's front door ("/"), not at a deep link. */
function arrivedAtFrontDoor(): boolean {
  return ARRIVED_AT === '' || ARRIVED_AT === '/index';
}

/**
 * Call once in the Quiet room. On web, the first time the room shows in a page load that began at "/",
 * go to /welcome instead. `onboarded` is unused now (kept so callers need not change).
 */
export function useWelcomeRedirect(_onboarded?: boolean | null): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || settled) return;
    settled = true;
    if (arrivedAtFrontDoor()) router.replace('/welcome');
  }, []);
}

/** The welcome page calls this when it shows, so arriving there counts as this load's welcome. */
export function noteWelcomeShown(): void { settled = true; }

/** Remember that the landing was seen. Every landing CTA calls this before navigating. */
export function markWelcomed(): void {
  settled = true;
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(WELCOMED_KEY, '1'); } catch {}
}
