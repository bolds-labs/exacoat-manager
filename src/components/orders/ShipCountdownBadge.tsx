import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface ShipCountdownBadgeProps {
  shipByTimestamp?: number | null;
  shipByDate?: string | null;
  orderStatus?: string;
  className?: string;
  showIcon?: boolean;
}

export const ShipCountdownBadge: React.FC<ShipCountdownBadgeProps> = ({
  shipByTimestamp,
  shipByDate,
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

  let effectiveTimestamp = shipByTimestamp;
  if (!effectiveTimestamp && shipByDate) {
    const parsed = Date.parse(shipByDate);
    if (!isNaN(parsed)) {
      effectiveTimestamp = Math.floor(parsed / 1000);
    }
  }

  if (!effectiveTimestamp) {
    if (isFinished) {
      return null;
    }
    return (
      <span
        title="Batas waktu kirim tidak tersedia dari API marketplace"
        className={clsx(
          'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium bg-chip text-muted',
          className
        )}
      >
        {showIcon && <Clock className="h-3 w-3 shrink-0" />}
        <span>Batas Kirim: N/A</span>
      </span>
    );
  }

  const diff = effectiveTimestamp - now;

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
        title={`Batas pengiriman telah terlewat pada ${new Date(effectiveTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium bg-st-stop-bg text-st-stop-fg',
          className
        )}
      >
        {showIcon && <AlertTriangle className="h-3 w-3 shrink-0" />}
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
        title={`Batas pengiriman: ${new Date(effectiveTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium bg-st-stop-bg text-st-stop-fg',
          className
        )}
      >
        {showIcon && <Clock className="h-3 w-3 shrink-0" />}
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
        title={`Batas pengiriman: ${new Date(effectiveTimestamp * 1000).toLocaleString('id-ID')}`}
        className={clsx(
          'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium bg-st-act-bg text-st-act-fg',
          className
        )}
      >
        {showIcon && <Clock className="h-3 w-3 shrink-0" />}
        <span>Kirim dlm {hours}j {minutes}m</span>
      </span>
    );
  }

  // More than 24 hours: Normal
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  return (
    <span
      title={`Batas pengiriman: ${new Date(effectiveTimestamp * 1000).toLocaleString('id-ID')}`}
      className={clsx(
        'inline-flex items-center gap-1 rounded-[7px] px-2 py-[2px] text-[12px] font-medium bg-chip text-muted',
        className
      )}
    >
      {showIcon && <Clock className="h-3 w-3 shrink-0" />}
      <span>Kirim dlm {days}h {hours}j</span>
    </span>
  );
};
