import { useCallback, useEffect, useState } from 'react';
import { squadsApi, type Squad } from '../../lib/squadsApi';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { YouIcon, ShareIcon, CheckIcon } from '../../components/Icons';

// Squad: play this match with your friends. Create a room, share the link, and
// everyone's calls land on one shared leaderboard.
export function SquadPanel({ matchId }: { matchId: string }) {
  const [squad, setSquad] = useState<Squad | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const mine = await squadsApi.mine(matchId);
      if (mine.squad) setSquad(await squadsApi.get(mine.squad.code));
      else setSquad(null);
    } catch { setSquad(null); }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true);
    try {
      const s = await squadsApi.create(matchId);
      setSquad(await squadsApi.get(s.code));
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function invite() {
    if (!squad) return;
    const url = `${window.location.origin}/squad/${squad.code}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Join my FanField squad', text: `Play ${squad.name} with me`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  }

  if (squad === undefined) return <div className="h-32 animate-pulse rounded-card border border-edge bg-turf" />;

  // No squad yet → explain the feature and let them start one.
  if (squad === null) {
    return (
      <section className="rounded-card border border-edge bg-turf p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-grass/10 text-grass"><YouIcon size={16} /></span>
          <StatLabel>Squad</StatLabel>
        </div>
        <p className="mt-2 text-sm text-chalk-dim">Play this match with your friends.</p>
        <p className="mt-1 text-xs text-muted">Start a squad, share the link, and see whose calls come out on top — one leaderboard for your group.</p>
        <Button variant="grass" size="md" fullWidth className="mt-3" leftIcon={<YouIcon size={16} />} disabled={busy} onClick={create}>
          {busy ? 'Creating…' : 'Play with friends'}
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatLabel>{squad.name}</StatLabel>
        <span className="tabular text-[11px] text-muted">{squad.memberCount} in squad</span>
      </div>

      <ul className="flex flex-col gap-1">
        {squad.standings.map((s) => (
          <li key={s.userId} className={['flex items-center gap-2 rounded-[10px] px-2 py-1.5', s.isMe ? 'bg-grass/[0.08]' : ''].join(' ')}>
            <span className="tabular w-5 text-xs font-bold text-muted">{s.rank}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">{s.isMe ? 'You' : s.name}</span>
            <span className="tabular text-sm font-bold text-grass">{s.points}</span>
          </li>
        ))}
      </ul>

      <Button variant="turf" size="sm" fullWidth className="mt-3" leftIcon={copied ? <CheckIcon size={14} /> : <ShareIcon size={14} />} onClick={invite}>
        {copied ? 'Link copied!' : 'Invite friends'}
      </Button>
      <p className="mt-2 text-[11px] text-muted">Points come from the calls each member makes on this match.</p>
    </section>
  );
}
