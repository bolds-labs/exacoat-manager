import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface ShipCountdownBadgeProps {
  shipByTimestamp?: number | null;
  orderStatus?: string;
  className?: string;
  showIcon?: boolean;
}

export const ShipCountdownBadge: React.FC<ShipCountdownBadgeProps> = ({
  shipByTimestamp,
  orderStatus = '',
  className,
  showIcon = true,
}) => {
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const st = orderStatus.toUpperCase();
  const isFinished = ['COMPLETED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(st);

  if (!shipByTimestamp) {
    if (isFinished) {
      return null;
    }
    return (
      <span
        title="Batas waktu kirim tidak tersedia dari API marketplace"
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-neutral-800/70 text-neutral-400 border-white/10',
          className
        )}
      >
        {showIcon && <Clock className="w-3 h-3 text-neutral-500 shrink-0" />}
        <span>Batas Kirim: N/A</span>
      </span>
    );
  }

  const diff = shipByTimestamp - now;

  if (isFinished) {
    return null;
  }

  // Overdue
  if (diff <= 0) {
    const absDiff = Math.abs(diff);
    const hours = Math.floor(absDiff / 3600);
    const minutes = Math.floor((absDiff % 3600) / 60);
    const text = hours > 0 ? `Lewat ${hours}j ${minutes}m` : `Lewat ${minutes}m`;

    return (
      <span
        title={`Batas pengiriman telah terlewat pada ${new Date(shipByTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-rose-500/15 text-rose-300 border-rose-500/30',
          className
        )}
      >
        {showIcon && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
        <span>{text}</span>
      </span>
    );
  }

  // Less than 12 hours: Urgent
  if (diff < 12 * 3600) {
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    return (
      <span
        title={`Batas pengiriman: ${new Date(shipByTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-rose-500/10 text-rose-300 border-rose-500/25',
          className
        )}
      >
        {showIcon && <Clock className="w-3 h-3 text-rose-400 shrink-0" />}
        <span>Kirim dlm {hours}j {minutes}m</span>
      </span>
    );
  }

  // Less than 24 hours: Warning
  if (diff < 24 * 3600) {
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    return (
      <span
        title={`Batas pengiriman: ${new Date(shipByTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-amber-500/10 text-amber-300 border-amber-500/25',
          className
        )}
      >
        {showIcon && <Clock className="w-3 h-3 text-amber-400 shrink-0" />}
        <span>Kirim dlm {hours}j {minutes}m</span>
      </span>
    );
  }

  // More than 24 hours: Normal
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  return (
    <span
      title={`Batas pengiriman: ${new Date(shipByTimestamp * 1000).toLocaleString('id-ID')}`}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-neutral-800/80 text-neutral-300 border-white/10',
        className
      )}
    >
      {showIcon && <Clock className="w-3 h-3 text-neutral-400 shrink-0" />}
      <span>Kirim dlm {days}h {hours}j</span>
    </span>
  );
};
