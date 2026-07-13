import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig, fcmConfigured } from './firebaseConfig';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export async function getFieldMessaging(): Promise<Messaging | null> {
  if (!fcmConfigured) return null;
  if (!(await isSupported().catch(() => false))) return null;
  if (!app) app = initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}
