// Public Firebase web config (safe to expose). Shared by the app and the SW.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/** FCM is only usable when the core config is present. */
export const fcmConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidKey,
);
