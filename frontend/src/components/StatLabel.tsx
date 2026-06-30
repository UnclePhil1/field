import type { ReactNode } from 'react';

interface StatLabelProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'h2' | 'h3';
}

/** The tracked uppercase eyebrow — a Field signature. */
export function StatLabel({ children, className = '', as: Tag = 'span' }: StatLabelProps) {
  return <Tag className={['eyebrow', className].join(' ')}>{children}</Tag>;
}
