/**
 * D2 storage contract: exactly two persisted preferences, both guarded.
 *
 * Storage can throw in locked-down privacy modes, so every access is wrapped
 * in try/catch and every getter degrades to `null` (callers then fall back to
 * server-rendered defaults: dark theme, sound off until an explicit choice).
 * This module is the only place that names the keys.
 */

export const STORAGE_KEYS = {
  theme: 'theme',
  sound: 'sound',
} as const;

export type ThemePreference = 'light' | 'dark';
export type SoundPreference = 'on' | 'off';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function read(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Persistence is best-effort; the in-memory theme still applies. */
  }
}

export function getThemePreference(): ThemePreference | null {
  const value = read(STORAGE_KEYS.theme);
  return value === 'light' || value === 'dark' ? value : null;
}

export function setThemePreference(value: ThemePreference): void {
  write(STORAGE_KEYS.theme, value);
}

export function getSoundPreference(): SoundPreference | null {
  const value = read(STORAGE_KEYS.sound);
  return value === 'on' || value === 'off' ? value : null;
}

export function setSoundPreference(value: SoundPreference): void {
  write(STORAGE_KEYS.sound, value);
}
