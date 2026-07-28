export interface DeviceProfile {
  touch: boolean;
  phone: boolean;
  tablet: boolean;
  landscape: boolean;
  aspectRatio: number;
  compactHud: boolean;
  matchZoom: number;
}

let matchPresentation = false;

export function getDeviceProfile(): DeviceProfile {
  const viewport = window.visualViewport;
  const width = Math.max(1, viewport?.width ?? window.innerWidth);
  const height = Math.max(1, viewport?.height ?? window.innerHeight);
  const shortEdge = Math.min(width, height);
  const touch = navigator.maxTouchPoints > 0
    || 'ontouchstart' in window
    || new URLSearchParams(window.location.search).has('touch');
  const tablet = touch && shortEdge >= 600;
  const phone = touch && !tablet;
  const aspectRatio = width / height;
  const matchZoom = !touch
    ? 1
    : aspectRatio < 1.55
      ? 1.28
      : 1;

  return {
    touch,
    phone,
    tablet,
    landscape: width >= height,
    aspectRatio,
    compactHud: touch,
    matchZoom
  };
}

export function refreshDevicePresentation(): DeviceProfile {
  const profile = getDeviceProfile();
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty('--crownfire-match-zoom', String(matchPresentation ? profile.matchZoom : 1));
  body.classList.toggle('device-touch', profile.touch);
  body.classList.toggle('device-phone', profile.phone);
  body.classList.toggle('device-tablet', profile.tablet);
  body.classList.toggle('device-landscape', profile.landscape);
  body.classList.toggle('touch-match', matchPresentation && profile.touch);
  return profile;
}

export function installDevicePresentation(): void {
  refreshDevicePresentation();
  window.addEventListener('resize', refreshDevicePresentation);
  window.visualViewport?.addEventListener('resize', refreshDevicePresentation);
}

export function setMatchPresentation(enabled: boolean): DeviceProfile {
  matchPresentation = enabled;
  return refreshDevicePresentation();
}
