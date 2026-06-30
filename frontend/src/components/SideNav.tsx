import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, isActive } from './navItems';
import { Wordmark } from './AppBar';

export function SideNav() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex lg:w-[208px] xl:w-[232px] shrink-0 flex-col gap-1 border-r border-edge px-4 py-5">
      <Wordmark className="mb-6 px-2 text-2xl" />
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={[
                'group flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-semibold transition-colors',
                active
                  ? 'bg-grass/10 text-grass'
                  : 'text-chalk-dim hover:bg-turf-2 hover:text-chalk',
              ].join(' ')}
            >
              <item.Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pt-6">
        <p className="eyebrow">For the fans</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Don't just watch the match — <span className="font-semibold text-chalk-dim">call it, live.</span>
        </p>
      </div>
    </aside>
  );
}
