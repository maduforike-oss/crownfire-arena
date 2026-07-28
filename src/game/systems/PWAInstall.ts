interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | undefined;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = undefined;
});

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const localDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (localDev) {
    // A previously installed worker can otherwise serve stale scene modules on
    // alternate Vite ports and make local visual changes appear to be missing.
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => ('caches' in window ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))) : undefined))
      .catch(() => undefined);
    return;
  }
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', document.baseURI).pathname).catch(() => undefined);
  });
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
  if (!deferredPrompt) return 'manual';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') deferredPrompt = undefined;
  return choice.outcome;
}
