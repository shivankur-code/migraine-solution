// Browsers cannot read a barometer, and Still does not look up weather by location, so on the web
// the air-pressure nudge is simply unavailable. Same interface as pressure.ts (phones).
export const pressureAvailable = async (): Promise<boolean> => false;
export const allowPressure = async (): Promise<boolean> => false;
export const sampleAndTrend = async (): Promise<number | null> => null;
