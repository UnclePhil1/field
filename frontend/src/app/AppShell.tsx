import { Outlet } from 'react-router-dom';
import { AppBar } from '../components/AppBar';
import { SideNav } from '../components/SideNav';
import { BottomNav } from '../components/BottomNav';

/**
 * Mobile-first: AppBar on top, fixed BottomNav.
 * Desktop (lg+): slim SideNav on the left; routes own their inner
 * center-column + contextual-rail layout so each screen earns its width.
 */
export function AppShell() {
  return (
    <div className="app-backdrop flex h-dvh flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1320px] min-h-0 flex-1">
        {/* SideNav stays fixed — it does not scroll with content */}
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          {/* AppBar stays fixed at the top of the content column */}
          <AppBar />
          {/* Only this region scrolls */}
          <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
