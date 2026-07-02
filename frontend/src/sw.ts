/// <reference lib="webworker" />
// Field service worker: offline precache (Workbox) + FCM background messages.
import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from './lib/push/firebaseConfig';

declare const self: ServiceWorkerGlobalScope;

// Precache the app shell (manifest injected here by vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST);

// Activate updated SW immediately.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── FCM background messages (app closed / backgrounded) ──
if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  onBackgroundMessage(messaging, (payload) => {
    const n = payload.notification ?? {};
    const data = (payload.data ?? {}) as Record<string, string>;
    self.registration.showNotification(n.title ?? 'Field', {
      body: n.body,
      icon: '/logo.png',
      badge: '/logo.png',
      data,
      tag: data.tag,
    });
  });
}

// Clicking a notification deep-links into the app (data.url).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as Record<string, string> | undefined)?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          (c as WindowClient).navigate(url);
          return (c as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
