import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthStore';
import { AppShell } from '../app/AppShell';
import { Logo } from './Logo';

/**
 * Gate for the main platform. Routes the user to the right step of the
 * wallet sign-up flow until they have both a connected wallet and a
 * username, then renders the app shell.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  // Preserve the intended URL so a shared deep link survives the sign-in flow.
  const redirect = encodeURIComponent(location.pathname + location.search);

  if (status === 'loading') {
    return (
      <div className="app-backdrop grid min-h-dvh place-items-center">
        <span className="inline-flex items-center gap-2 text-3xl font-extrabold tracking-tightest text-chalk">
          <Logo size={44} className="animate-live-pulse" />
          <span className="inline-flex items-baseline">Field<span className="text-grass animate-live-pulse">.</span></span>
        </span>
      </div>
    );
  }
  if (status === 'guest') return <Navigate to={`/connect?redirect=${redirect}`} replace />;

  return <AppShell />;
}
