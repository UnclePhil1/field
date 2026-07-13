import { Outlet } from 'react-router-dom';
import { AppBar } from '../components/AppBar';
import { SideNav } from '../components/SideNav';
import { BottomNav } from '../components/BottomNav';
import { PushToast } from '../components/PushToast';
import { FloatingChat } from '../features/chat/FloatingChat';

export function AppShell() {
  return (
    <div className="dot-grid bg-pitch flex h-dvh flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1320px] min-h-0 flex-1">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          <AppBar />
          <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
      <FloatingChat />
      <PushToast />
    </div>
  );
}
