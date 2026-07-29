// Platform detection and fullscreen utilities for mobile PWA
// iOS has no Fullscreen API -- we use CSS to fill viewport instead.
// Android supports both Fullscreen API and manifest orientation lock.

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function enterFullscreen(element: HTMLElement): void {
  if (isIOS()) {
    // iOS: no Fullscreen API. The video element is styled to fill viewport via CSS.
    // Adding a class triggers the CSS fullscreen override.
    document.documentElement.classList.add('ios-fullscreen');
    return;
  }
  // Android/desktop: use standard Fullscreen API
  element.requestFullscreen?.();
}

export function exitFullscreen(): void {
  if (isIOS()) {
    document.documentElement.classList.remove('ios-fullscreen');
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  }
}

export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}
