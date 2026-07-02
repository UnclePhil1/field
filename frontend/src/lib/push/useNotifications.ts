import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFieldMessaging } from './firebase';
import { fcmConfigured, vapidKey } from './firebaseConfig';
import { pushApi } from './pushApi';

export type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

/** iOS Safari can only receive push when Field is installed as a PWA. */
export function isIos(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}
export function isStandalone(): boolean {
  return (
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
    // iOS Safari
    (typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

export interface NotificationsState {
  supported: boolean;
  /** true only where enabling can actually work (e.g. not iOS-in-browser) */
  canEnable: boolean;
  needsInstall: boolean; // iOS, not installed → show Add to Home Screen
  permission: PermState;
  busy: boolean;
  token: string | null;
  onForeground?: (fn: (title: string, body?: string, url?: string) => void) => void;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export function useNotifications(): NotificationsState {
  const supported = fcmConfigured && typeof Notification !== 'undefined';
  const needsInstall = isIos() && !isStandalone();
  const canEnable = supported && !needsInstall;

  const [permission, setPermission] = useState<PermState>(
    supported ? (Notification.permission as PermState) : 'unsupported',
  );
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Foreground messages → let the app show an in-app toast.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (permission !== 'granted') return;
    (async () => {
      const messaging = await getFieldMessaging();
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        const evt = new CustomEvent('field:push', {
          detail: {
            title: payload.notification?.title ?? 'Field',
            body: payload.notification?.body,
            url: (payload.data as Record<string, string> | undefined)?.url,
          },
        });
        window.dispatchEvent(evt);
      });
    })();
    return () => unsub?.();
  }, [permission]);

  // Re-register the token on app open if permission is already granted (handles
  // dormant-SW re-subscription + token refresh).
  useEffect(() => {
    if (permission !== 'granted') return;
    void refreshToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  const refreshToken = useCallback(async () => {
    const messaging = await getFieldMessaging();
    if (!messaging) return;
    const registration = await navigator.serviceWorker.ready;
    const t = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }).catch(() => null);
    if (t) {
      setToken(t);
      await pushApi.register(t, navigator.userAgent).catch(() => {});
    }
  }, []);

  const enable = useCallback(async () => {
    if (!canEnable) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PermState);
      if (perm === 'granted') await refreshToken();
    } finally {
      setBusy(false);
    }
  }, [canEnable, refreshToken]);

  const disable = useCallback(async () => {
    if (token) await pushApi.unregister(token).catch(() => {});
    setToken(null);
  }, [token]);

  return { supported, canEnable, needsInstall, permission, busy, token, enable, disable };
}
