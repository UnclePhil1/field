# Field — Push notifications (FCM web push)

Opt-in web push via Firebase Cloud Messaging. Frontend uses the public Firebase
config + VAPID key; the backend sends via FCM HTTP v1 using a service account.
Field never holds the service account in the client.

## What's built
- **PWA**: `vite-plugin-pwa` (injectManifest) → one service worker `src/sw.ts`
  (offline precache + FCM `onBackgroundMessage` + `notificationclick` deep-links).
- **Client**: `lib/push/firebase.ts`, `useNotifications` (permission → `getToken`
  → register), foreground `onMessage` → in-app toast (`PushToast`).
- **UI**: notifications panel on the **You** page — soft-ask, iOS "Add to Home
  Screen" instructions, master + granular preference toggles.
- **Backend**: `push` Edge Function (`register`/`unregister`/`preferences`);
  `_shared/fcm.ts` sender (service-account JWT → FCM v1, prunes dead tokens);
  dispatch wired in `engine-tick` ("your call settled") and `tournaments` settle
  ("results are in — claim").

## Remaining setup (you)
1. **Frontend env** (already in `.env`; also add to **Vercel → Environment
   Variables** since `.env` is gitignored):
   `VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
   VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_VAPID_KEY`.
2. **Service account secret** (backend — enables *sending*). In Firebase →
   Project settings → Service accounts → Generate new private key. Then:
   ```bash
   supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat ~/Downloads/wave-e34bd-xxxx.json)"
   supabase functions deploy engine-tick tournaments   # pick up the secret
   ```
   Until this is set, sending is a safe no-op (token registration + prefs still work).
3. Deploy the frontend (Vercel) — push notifications require the PWA service
   worker, which only ships in the built app.

## Testing
- Desktop Chrome/Firefox/Edge: open the site → You → **Turn on alerts** → allow.
  Settle a card / tournament → notification arrives (background too).
- **iOS**: only works from the installed PWA (Share → Add to Home Screen), iOS 16.4+.
- Foreground messages show the in-app toast; background/closed show the OS
  notification via the service worker; clicking deep-links into the match/tournament.

## Notes
- Every token is bound to the authenticated user (no client-supplied ids).
- Preferences are honored server-side before sending; opt-in only; no auto-prompt.
- Stale tokens are pruned on `UNREGISTERED`/404. Tokens re-register on app open.
- TODO: "card locking soon" / "streak at risk" / per-followed-match alerts.
