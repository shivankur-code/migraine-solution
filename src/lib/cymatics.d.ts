// Types for cymatics.js (kept as plain JS so the tests run under plain Node).
export type Figure = {
  n: number; m: number; hum: number; fuzz: number; spin: number;
  breathe: number; breathPeriodS: number; spread: number; key: string;
};
export function rng(seed: number): () => number;
export function figureFor(recipe?: { tiltDbPerOct?: number; texture?: string; tonal?: number; swellDb?: number; swellPeriodS?: number; width?: number }): Figure;
export function plate(fig: Figure, x: number, y: number): number;
export function gather(fig: Figure, count: number, seed?: number): number[];
export function scatter(count: number, seed?: number): number[];
