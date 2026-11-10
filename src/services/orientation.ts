import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export type OrientationResult = 'locked' | 'unsupported' | 'failed' | 'desktop';
let requestedFullscreen = false;

export function isMobileEnvironment(): boolean {
  const touchIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || touchIpad;
  return Capacitor.isNativePlatform() || (mobileAgent && matchMedia('(pointer: coarse)').matches);
}

export async function enterLandscape(): Promise<OrientationResult> {
  if (!isMobileEnvironment()) return 'desktop';
  if (Capacitor.isNativePlatform()) {
    try { await ScreenOrientation.lock({ orientation: 'landscape' }); return 'locked'; }
    catch { return 'failed'; }
  }
  const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> };
  if (!orientation?.lock) return 'unsupported';
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); requestedFullscreen = true; } catch { /* browser can deny fullscreen */ }
    }
    await orientation.lock('landscape');
    return 'locked';
  } catch { return 'unsupported'; }
}

export async function leaveLandscape(): Promise<void> {
  if (!isMobileEnvironment()) return;
  try {
    if (Capacitor.isNativePlatform()) await ScreenOrientation.lock({ orientation: 'portrait' });
    else {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> };
      await orientation.lock?.('portrait');
    }
  } catch { /* orientation may already have been released */ }
  if (requestedFullscreen && document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch { /* fullscreen may have been dismissed */ }
  }
  requestedFullscreen = false;
}
