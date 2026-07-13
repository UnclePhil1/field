import { useEffect, useState } from 'react';
import { useNotifications } from '../../lib/push/useNotifications';
import { pushApi, type NotificationPreferences } from '../../lib/push/pushApi';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { isInWalletBrowser } from '../../lib/wallet';

const DEFAULTS: NotificationPreferences = {
  enabled: true,
  match_events: { goals: true, cards: true, corners: true, phases: true },
  my_play: { card_locking: true, settled: true, streak_risk: true, new_card: false },
  tournaments: { results: true, payout: true, paid: true },
  followed: [],
};

export function NotificationSettings() {
  const { supported, canEnable, needsInstall, permission, busy, token, enable } = useNotifications();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);

  useEffect(() => {
    if (permission === 'granted') {
      pushApi.getPreferences().then((p) => setPrefs({ ...DEFAULTS, ...p })).catch(() => {});
    }
  }, [permission]);

  function save(next: NotificationPreferences) {
    setPrefs(next);
    pushApi.setPreferences(next).catch(() => {});
  }

  if (!supported) {
    return (
      <section className="rounded-card border border-edge bg-turf p-4">
        <StatLabel>Notifications</StatLabel>
        {isInWalletBrowser() ? (
          <div className="mt-2">
            <p className="text-sm font-semibold text-chalk-dim">You’re in a wallet’s in-app browser.</p>
            <p className="mt-1 text-xs text-muted">Notifications need a normal browser. Open Field in Chrome or Safari.</p>
            <Button
              variant="turf"
              size="sm"
              className="mt-2"
              onClick={() => navigator.clipboard?.writeText(window.location.origin).then(() => {}, () => {})}
            >
              Copy Field link
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Push notifications aren’t available in this browser.</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <StatLabel>Notifications</StatLabel>

      {needsInstall && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-chalk-dim">Add Field to your Home Screen to get alerts.</p>
          <p className="mt-1 text-xs text-muted">
            Tap the <span className="font-semibold text-chalk">Share</span> icon in Safari, then{' '}
            <span className="font-semibold text-chalk">Add to Home Screen</span>. Open Field from there and enable alerts.
          </p>
        </div>
      )}

      {!needsInstall && permission !== 'granted' && (
        <div className="mt-2">
          <p className="text-sm text-chalk-dim">
            Get alerts when your card is about to lock, your call hits, and results drop.
          </p>
          {permission === 'denied' ? (
            <p className="mt-2 text-xs text-flare-2">Notifications are blocked — enable them in your browser settings.</p>
          ) : (
            <Button variant="grass" size="md" className="mt-3" disabled={!canEnable || busy} onClick={enable}>
              {busy ? 'Enabling…' : 'Turn on alerts'}
            </Button>
          )}
        </div>
      )}

      {permission === 'granted' && (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-xs text-muted">{token ? 'This device is registered for alerts.' : 'Registering this device…'}</p>
          <Row label="All notifications" checked={prefs.enabled} onChange={(v) => save({ ...prefs, enabled: v })} />
          <Group title="Match events" disabled={!prefs.enabled}>
            <Row label="Goals" checked={prefs.match_events.goals} onChange={(v) => save({ ...prefs, match_events: { ...prefs.match_events, goals: v } })} />
            <Row label="Cards" checked={prefs.match_events.cards} onChange={(v) => save({ ...prefs, match_events: { ...prefs.match_events, cards: v } })} />
            <Row label="Corners" checked={prefs.match_events.corners} onChange={(v) => save({ ...prefs, match_events: { ...prefs.match_events, corners: v } })} />
            <Row label="Kickoff / HT / FT" checked={prefs.match_events.phases} onChange={(v) => save({ ...prefs, match_events: { ...prefs.match_events, phases: v } })} />
          </Group>
          <Group title="My play" disabled={!prefs.enabled}>
            <Row label="Card locking soon" checked={prefs.my_play.card_locking} onChange={(v) => save({ ...prefs, my_play: { ...prefs.my_play, card_locking: v } })} />
            <Row label="My call settled" checked={prefs.my_play.settled} onChange={(v) => save({ ...prefs, my_play: { ...prefs.my_play, settled: v } })} />
            <Row label="Streak at risk" checked={prefs.my_play.streak_risk} onChange={(v) => save({ ...prefs, my_play: { ...prefs.my_play, streak_risk: v } })} />
            <Row label="New card" checked={prefs.my_play.new_card} onChange={(v) => save({ ...prefs, my_play: { ...prefs.my_play, new_card: v } })} />
          </Group>
          <Group title="Tournaments" disabled={!prefs.enabled}>
            <Row label="Results in" checked={prefs.tournaments.results} onChange={(v) => save({ ...prefs, tournaments: { ...prefs.tournaments, results: v } })} />
            <Row label="Submit payout address" checked={prefs.tournaments.payout} onChange={(v) => save({ ...prefs, tournaments: { ...prefs.tournaments, payout: v } })} />
            <Row label="You got paid" checked={prefs.tournaments.paid} onChange={(v) => save({ ...prefs, tournaments: { ...prefs.tournaments, paid: v } })} />
          </Group>
        </div>
      )}
    </section>
  );
}

function Group({ title, disabled, children }: { title: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <p className="eyebrow mb-2">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-chalk-dim">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-grass' : 'bg-turf-2 border border-edge-2',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </label>
  );
}
