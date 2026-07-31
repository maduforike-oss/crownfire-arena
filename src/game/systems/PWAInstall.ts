interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | undefined;
const SERVICE_WORKER_VERSION = '9';
const RELOAD_GUARD = `crowdfire-sw-reload-v${SERVICE_WORKER_VERSION}`;

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
    const hadController = Boolean(navigator.serviceWorker.controller);
    const workerUrl = new URL(`sw.js?v=${SERVICE_WORKER_VERSION}`, document.baseURI);
    const workerScope = new URL('./', document.baseURI).pathname;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      try {
        if (sessionStorage.getItem(RELOAD_GUARD)) return;
        sessionStorage.setItem(RELOAD_GUARD, '1');
        window.location.reload();
      } catch {
        // Safari private browsing can reject storage access. The new worker
        // still controls the next navigation without requiring a hard failure.
      }
    }, { once: true });

    void navigator.serviceWorker.register(workerUrl.href, {
      scope: workerScope,
      updateViaCache: 'none'
    }).then((registration) => registration.update()).catch(() => undefined);
  });
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
  if (!deferredPrompt) return 'manual';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') deferredPrompt = undefined;
  return choice.outcome;
}
