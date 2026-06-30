import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, isActive } from './navItems';

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-pitch/90 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-[560px]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
                  active ? 'text-grass' : 'text-muted hover:text-chalk-dim',
                ].join(' ')}
              >
                <item.Icon size={22} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
