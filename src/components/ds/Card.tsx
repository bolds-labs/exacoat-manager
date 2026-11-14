import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface CardProps {
  icon?: LucideIcon;
  title?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({ icon: Icon, title, count, actions, children, className = '' }: CardProps) {
  const hasHeader = Icon || title || actions;
  return (
    <section className={`rounded-[14px] border border-card-border bg-card px-5 py-[18px] ${className}`}>
      {hasHeader && (
        <div className="mb-3.5 flex h-[30px] items-center gap-2.5">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
            {Icon && <Icon className="h-[15px] w-[15px] text-faint" strokeWidth={1.8} aria-hidden />}
            {title}
            {count !== undefined && <em className="font-medium not-italic text-faint">{count}</em>}
          </h3>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
