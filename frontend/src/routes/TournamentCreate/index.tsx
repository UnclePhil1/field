import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { tournamentApi } from '../../lib/tournamentApi';
import { supabase } from '../../lib/supabase';
import { fetchMatches } from '../../lib/api';
import { useAuth } from '../../app/AuthStore';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { formatPrize } from '../../features/tournament/util';
import { untilKickoff } from '../../lib/format';
import type { Match } from '../../types';
import type { Capacity, CreateTournamentInput } from '../../types/tournament';

const isSolana = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());

function evenSplit(n: number): number[] {
  const base = Math.floor(100 / n);
  const arr = Array(n).fill(base);
  arr[0] += 100 - base * n; // remainder to 1st
  return arr;
}
function presetFor(n: number, kind: 'even' | 'top-heavy' | 'wta'): number[] {
  if (kind === 'wta') return [100, ...Array(n - 1).fill(0)];
  if (kind === 'even') return evenSplit(n);
  // top-heavy presets
  const map: Record<number, number[]> = { 1: [100], 2: [70, 30], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [40, 25, 15, 12, 8] };
  return map[n] ?? evenSplit(n);
}

export function TournamentCreate() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const { wallet } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(!editId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [matchId, setMatchId] = useState('');
  const [prize, setPrize] = useState(100);
  const [hostWallet, setHostWallet] = useState('');
  const [capacityType, setCapacityType] = useState<'open' | 'slots'>('open');
  const [maxSlots, setMaxSlots] = useState(50);
  const [winnersCount, setWinnersCount] = useState(3);
  const [split, setSplit] = useState<number[]>(presetFor(3, 'top-heavy'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMatches().then((ms) => setMatches(ms.filter((m) => m.status === 'upcoming'))).catch(() => {});
  }, []);

  // Edit mode: load the tournament once and prefill every field.
  useEffect(() => {
    if (!editId) return;
    tournamentApi.getById(editId).then((t) => {
      setTitle(t.title);
      setDescription(t.description ?? '');
      setBannerUrl(t.bannerUrl ?? '');
      setMatchId(t.matchId);
      setPrize(t.prize.total);
      setHostWallet(t.hostPayoutWallet);
      setCapacityType(t.capacity.type);
      if (t.capacity.type === 'slots') setMaxSlots(t.capacity.max);
      setWinnersCount(t.winnersCount);
      setSplit(t.split);
      setLoaded(true);
    }).catch(() => { setError('Could not load this tournament'); setLoaded(true); });
  }, [editId]);

  async function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setError('Banner must be a PNG, JPG or WebP image'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Banner must be under 3 MB'); return; }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('tournament-banners')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('tournament-banners').getPublicUrl(path);
      setBannerUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the banner');
    } finally {
      setUploading(false);
    }
  }
  useEffect(() => { if (wallet && !isEdit) setHostWallet(wallet); }, [wallet, isEdit]);
  useEffect(() => { setSplit((s) => resize(s, winnersCount)); }, [winnersCount]);

  const splitSum = split.reduce((a, n) => a + (Number(n) || 0), 0);

  const validation = useMemo(() => {
    if (!title.trim() || title.length > 60) return 'Title is required (≤60 chars)';
    if (description.length > 280) return 'Description must be ≤280 chars';
    if (!matchId) return 'Pick a match that hasn’t started';
    if (!(prize > 0)) return 'Prize must be greater than 0';
    if (!isSolana(hostWallet)) return 'Enter a valid Solana payout wallet';
    if (capacityType === 'slots' && maxSlots < winnersCount) return 'Slots must be ≥ winners';
    if (splitSum !== 100) return `Split must total 100% (currently ${splitSum}%)`;
    return null;
  }, [title, description, matchId, prize, hostWallet, capacityType, maxSlots, winnersCount, splitSum]);

  async function submit() {
    if (validation) return;
    setBusy(true);
    setError(null);
    const capacity: Capacity = capacityType === 'slots' ? { type: 'slots', max: maxSlots } : { type: 'open' };
    const input: CreateTournamentInput = {
      title: title.trim(), description: description.trim(), bannerUrl: bannerUrl.trim(),
      matchId, hostPayoutWallet: hostWallet.trim(), prize: { asset: 'USDC', total: prize },
      capacity, winnersCount, split, startingPoints: 1000, joinCloses: 'kickoff',
    };
    try {
      const t = isEdit ? await tournamentApi.update(editId!, input) : await tournamentApi.create(input);
      navigate(`/tournaments/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEdit ? 'Could not save changes' : 'Could not create tournament');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="mx-auto max-w-[680px] px-4 py-8 text-muted">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-5">
      <Link to={isEdit ? `/tournaments/${editId}` : '/tournaments'} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-chalk">← {isEdit ? 'Back' : 'Tournaments'}</Link>
      <StatLabel className="ml-4">{isEdit ? 'Edit battle' : 'Host a battle'}</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">{isEdit ? 'Edit tournament' : 'Create tournament'}</h1>

      <div className="mt-5 flex flex-col gap-5">
        {/* basics */}
        <Section title="Basics">
          <Field label={`Title (${title.length}/60)`}>
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="England vs France — Corner Clash" className={inputCls} />
          </Field>
          <Field label={`Description (${description.length}/280)`}>
            <textarea value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Banner image (optional)">
            <div className="flex gap-2">
              <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="Paste an image URL" className={`${inputCls} min-w-0 flex-1`} />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickBanner} className="hidden" />
              <Button type="button" variant="turf" size="md" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">Paste a link or upload from your device (PNG, JPG or WebP, up to 3 MB).</p>
          </Field>
          {bannerUrl && <img src={bannerUrl} alt="" className="h-28 w-full rounded-card border border-edge object-cover" />}
        </Section>

        {/* match */}
        <Section title="Match">
          {isEdit && <p className="text-xs text-muted">The match can’t be changed. To use a different match, delete this tournament and create a new one.</p>}
          {matches.length === 0 ? (
            <p className="text-sm text-muted">No upcoming matches available to host on right now.</p>
          ) : (
            <div className={['grid gap-2 sm:grid-cols-2', isEdit ? 'pointer-events-none opacity-70' : ''].join(' ')}>
              {matches.map((m) => (
                <button key={m.id} onClick={() => setMatchId(m.id)} className={[
                  'rounded-card border px-3 py-2.5 text-left transition-colors',
                  matchId === m.id ? 'border-grass bg-grass/10' : 'border-edge bg-turf hover:border-edge-2',
                ].join(' ')}>
                  <p className="text-sm font-semibold text-chalk">{m.home.code} v {m.away.code}</p>
                  <p className="tabular text-xs text-muted">{untilKickoff(m.kickoff)}</p>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* prize + wallet */}
        <Section title="Prize">
          <div className="flex gap-3">
            <Field label="Amount (USDC)" className="flex-1">
              <input type="number" min={1} value={prize} onChange={(e) => setPrize(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <Field label="Your payout wallet (you pay winners from here)">
            <input value={hostWallet} onChange={(e) => setHostWallet(e.target.value)} placeholder="Solana address" className={`${inputCls} tabular`} />
            {hostWallet && !isSolana(hostWallet) && <p className="mt-1 text-xs text-flare-2">Not a valid Solana address.</p>}
          </Field>
        </Section>

        {/* capacity */}
        <Section title="Capacity">
          <div className="flex gap-2">
            <Toggle active={capacityType === 'open'} onClick={() => setCapacityType('open')}>Open</Toggle>
            <Toggle active={capacityType === 'slots'} onClick={() => setCapacityType('slots')}>Limited slots</Toggle>
          </div>
          {capacityType === 'slots' && (
            <Field label="Max players" className="mt-3">
              <input type="number" min={winnersCount} value={maxSlots} onChange={(e) => setMaxSlots(Number(e.target.value))} className={inputCls} />
            </Field>
          )}
        </Section>

        {/* winners + split */}
        <Section title="Winners & split">
          <Field label="Number of winners">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Toggle key={n} active={winnersCount === n} onClick={() => setWinnersCount(n)}>{n}</Toggle>
              ))}
            </div>
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Preset onClick={() => setSplit(presetFor(winnersCount, 'wta'))}>Winner-takes-all</Preset>
            <Preset onClick={() => setSplit(presetFor(winnersCount, 'top-heavy'))}>Top-heavy</Preset>
            <Preset onClick={() => setSplit(presetFor(winnersCount, 'even'))}>Even</Preset>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {split.map((pct, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-10 text-sm text-chalk-dim">{['1st', '2nd', '3rd', '4th', '5th'][i]}</span>
                <input type="number" min={0} max={100} value={pct} onChange={(e) => setSplit((s) => s.map((v, j) => (j === i ? Number(e.target.value) : v)))} className={`${inputCls} tabular w-24`} />
                <span className="tabular text-xs text-muted">${((prize * pct) / 100).toLocaleString('en-US')}</span>
              </div>
            ))}
            <p className={['text-xs font-semibold', splitSum === 100 ? 'text-grass' : 'text-flare-2'].join(' ')}>Total: {splitSum}%{splitSum === 100 ? ' ✓' : ' (must be 100%)'}</p>
          </div>
        </Section>

        {/* review + create */}
        <div className="rounded-card-lg border border-edge-2 bg-turf p-4">
          <StatLabel>Review</StatLabel>
          <p className="mt-2 text-sm text-chalk-dim">
            You're committing to pay <span className="font-semibold text-grass">{formatPrize({ asset: 'USDC', total: prize })}</span> to the
            top {winnersCount} from your wallet <span className="tabular">{hostWallet ? `${hostWallet.slice(0, 6)}…` : '—'}</span>,{' '}
            <span className="font-semibold text-chalk">within 48 hours</span> of the final result. Field never holds the funds and verifies each payment on Solana.
          </p>
          {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}
          {validation && <p className="mt-2 text-xs text-flare-2">{validation}</p>}
          <Button variant="grass" size="lg" fullWidth className="mt-4" disabled={!!validation || busy} onClick={submit}>
            {isEdit ? (busy ? 'Saving…' : 'Save changes') : (busy ? 'Creating…' : 'Create tournament')}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted">No wallet signature or fund lock — creating just publishes the contest.</p>
        </div>
      </div>
    </div>
  );
}

function resize(split: number[], n: number): number[] {
  if (split.length === n) return split;
  return presetFor(n, 'top-heavy');
}

const inputCls = 'w-full rounded-[13px] border border-edge-2 bg-turf-2 px-3 py-2.5 text-sm text-chalk outline-none focus:border-grass/60';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <StatLabel>{title}</StatLabel>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={['block', className].join(' ')}>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={[
      'rounded-[12px] border px-4 py-2 text-sm font-semibold transition-colors',
      active ? 'border-grass bg-grass/10 text-grass' : 'border-edge-2 bg-turf-2 text-chalk-dim hover:text-chalk',
    ].join(' ')}>{children}</button>
  );
}
function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="rounded-full border border-edge-2 bg-turf-2 px-3 py-1 text-xs font-semibold text-chalk-dim hover:border-grass/50 hover:text-chalk">{children}</button>;
}
