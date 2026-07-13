import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthStore';
import { AppShell } from '../app/AppShell';
import { Logo } from './Logo';

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
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
