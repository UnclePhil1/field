/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from './lib/push/firebaseConfig';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
