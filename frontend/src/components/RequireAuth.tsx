import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/AuthStore';
import { AppShell } from '../app/AppShell';

/**
 * Gate for the main platform. Routes the user to the right step of the
 * wallet sign-up flow until they have both a connected wallet and a
 * username, then renders the app shell.
 */
export function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="app-backdrop grid min-h-dvh place-items-center">
        <span className="inline-flex items-baseline text-3xl font-extrabold tracking-tightest text-chalk">
          Field<span className="text-grass animate-live-pulse">.</span>
        </span>
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/welcome" replace />;
  if (status === 'needs-username') return <Navigate to="/onboard" replace />;

  return <AppShell />;
}
