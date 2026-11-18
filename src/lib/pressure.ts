// Air pressure from the phone's own barometer (most iPhones and many Android phones), read on the
// phone: no location, no network. Used only if the person switches it on in My sound, which is also
// when the system asks for permission (iOS: Motion & Fitness), never at launch. A reading is taken
// when the Quiet room opens and every 15 minutes while it is open; the last 12 hours are kept on the
// phone so a falling trend can be seen (recipe/personal.js pressureDrop). The web build uses
// pressure.web.ts: browsers cannot read the barometer.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Barometer } from 'expo-sensors';
import { pressureDrop } from '../recipe/personal.js';

const KEY = 'still-pressure-v1';
type Sample = { t: number; hPa: number };

export async function pressureAvailable(): Promise<boolean> {
  try { return await Barometer.isAvailableAsync(); } catch { return false; }
}

/** Ask for permission (the person just switched it on). True when readings can be taken. */
export async function allowPressure(): Promise<boolean> {
  if (!(await pressureAvailable())) return false;
  try { return (await Barometer.requestPermissionsAsync()).granted; } catch { return false; }
}

async function read(): Promise<Sample[]> {
  try { const v = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Take one reading (at most every 10 minutes), keep it, and return the current fall in hPa or null. */
export async function sampleAndTrend(): Promise<number | null> {
  try {
    if (!(await pressureAvailable()) || !(await Barometer.getPermissionsAsync()).granted) return null;
    const list = await read();
    const now = Date.now();
    if (!list.length || now - list[list.length - 1].t > 10 * 60e3) {
      const hPa = await new Promise<number | null>(resolve => {
        let done = false;
        const sub = Barometer.addListener(m => { if (done) return; done = true; sub.remove(); resolve(Number.isFinite(m.pressure) ? m.pressure : null); });
        setTimeout(() => { if (!done) { done = true; sub.remove(); resolve(null); } }, 3000);
      });
      if (hPa !== null) {
        const keep = [...list, { t: now, hPa }].filter(s => now - s.t < 12 * 3600e3).slice(-80);
        await AsyncStorage.setItem(KEY, JSON.stringify(keep));
        return pressureDrop(keep, now);
      }
    }
    return pressureDrop(list, now);
  } catch { return null; }
}
