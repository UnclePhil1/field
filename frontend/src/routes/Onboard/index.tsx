import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
import { shortAddress } from '../../lib/wallet';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Post-connect step: a newly connected wallet picks a username before it
 * gets access to the platform.
 */
export function Onboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const dest = redirect ? decodeURIComponent(redirect) : '/play';
  const { status, wallet, setUsername } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Guard: must have connected first; already-onboarded users skip this.
  if (status === 'guest') return <Navigate to="/connect" replace />;
  if (status === 'ready') return <Navigate to={dest} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!USERNAME_RE.test(name)) {
      setError('3–20 characters: letters, numbers and underscores only.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setUsername(name);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save username.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-backdrop grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-card-lg border border-edge bg-turf p-7">
        <span className="eyebrow">Almost there</span>
        <h1 className="mt-1 text-xl font-extrabold tracking-display text-chalk">
          Choose a username
        </h1>
        <p className="mt-2 text-sm text-muted">
          This is how you'll show up on the leaderboard.
        </p>

        {wallet && (
          <p className="tabular mt-3 text-xs text-muted">
            Wallet · {shortAddress(wallet)}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-5">
          <div className="flex items-center rounded-[13px] border border-edge-2 bg-turf-2 px-3 focus-within:border-grass/60">
            <span className="text-sm font-semibold text-muted">@</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="yourname"
              maxLength={20}
              aria-label="Username"
              className="h-11 w-full bg-transparent px-2 text-sm font-semibold text-chalk outline-none placeholder:text-muted"
            />
          </div>
          {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}

          <Button variant="grass" size="lg" fullWidth className="mt-5" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Enter Field'}
          </Button>
        </form>
      </div>
    </div>
  );
}
