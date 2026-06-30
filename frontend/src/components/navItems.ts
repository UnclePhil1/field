import type { ComponentType } from 'react';
import { BoardIcon, PitchIcon, PlayIcon, TrophyIcon, YouIcon } from './Icons';

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** match nested routes too */
  match?: (path: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/play', label: 'Matches', Icon: PitchIcon, match: (p) => p === '/play' || p.startsWith('/lobby') },
  { to: '/match/eng-fra', label: 'Play', Icon: PlayIcon, match: (p) => p.startsWith('/match') },
  { to: '/tournaments', label: 'Battles', Icon: TrophyIcon, match: (p) => p.startsWith('/tournaments') },
  { to: '/board', label: 'Board', Icon: BoardIcon, match: (p) => p.startsWith('/board') },
  { to: '/you', label: 'You', Icon: YouIcon, match: (p) => p.startsWith('/you') },
];

export function isActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname === item.to;
}
