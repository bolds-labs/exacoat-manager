import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { clsx } from "clsx"
import { 
  getBadgeInfo, 
  getAccountStatusInfo,
  getApplicationStatusInfo,
  getIdentityStatusInfo,
  getOrderStatusInfo
} from "../../lib/formatters"
import { BadgeType, AccountStatus, ApplicationStatus, IdentityStatus, OrderStatus } from "../../types"
import { ShieldCheck, Award, Sparkles, CheckCircle2, Clock, XCircle, AlertTriangle, Building2, UserPlus, Truck, Layers, Eye, Package } from "lucide-react"

const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md border px-2 text-[10px] leading-none font-medium font-mono transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
        lime:
          "border-[#f3aa18]/30 bg-[#f3aa18]/10 text-amber-700 dark:text-[#f3aa18]",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-100",
        subtle:
          "border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300",
        destructive:
          "border-transparent bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        outline: "text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-white/10",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        amber:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        indigo:
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
        cyan:
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
        rose:
          "border-rose-500/30 bg-rose-500/10 text-rose-400",
        emerald:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        slate:
          "border-zinc-700/80 bg-zinc-800/80 text-zinc-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  type?: 'badge' | 'badgeType' | 'accountStatus' | 'applicationStatus' | 'identityStatus' | 'orderStatus' | 'custom' | string;
  value?: BadgeType | AccountStatus | ApplicationStatus | IdentityStatus | OrderStatus | string | null;
  metadata?: any;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  type,
  value,
  metadata,
  label,
  size = 'sm',
  variant,
  showIcon = true,
  className,
  children,
  ...props
}) => {
  // If children or shadcn variant passed without domain status type
  if (!type && !value) {
    return (
      <div className={clsx(badgeVariants({ variant }), className)} {...props}>
        {children || label}
      </div>
    );
  }

  let displayLabel = label || String(value || '');
  let colorClass = 'text-zinc-300';
  let bgClass = 'bg-zinc-800/80';
  let borderClass = 'border-zinc-700/80';
  let IconComponent: React.ComponentType<{ className?: string }> | null = null;

  if (type === 'badge' || type === 'badgeType') {
    const info = getBadgeInfo(value as BadgeType);
    displayLabel = info.label;
    colorClass = info.colorClass;
    bgClass = info.bgClass;
    borderClass = info.borderClass;
    if (value === 'verified_artist') IconComponent = ShieldCheck;
    else if (value === 'verified_brand') IconComponent = Building2;
    else if (value === 'curated_artist') IconComponent = Award;
    else if (value === 'artist_of_the_month') IconComponent = Sparkles;
    else if (value === 'new_artist') IconComponent = UserPlus;
  } else if (type === 'accountStatus') {
    const info = getAccountStatusInfo(value as AccountStatus);
    displayLabel = info.label;
    colorClass = info.color;
    bgClass = info.bg;
    if (value === 'active') IconComponent = CheckCircle2;
    else if (value === 'suspended') IconComponent = AlertTriangle;
    else if (value === 'deactivated') IconComponent = XCircle;
  } else if (type === 'applicationStatus') {
    const info = getApplicationStatusInfo(value as ApplicationStatus);
    displayLabel = info.label;
    colorClass = info.color;
    bgClass = info.bg;
    if (value === 'approved') IconComponent = CheckCircle2;
    else if (value === 'under_review' || value === 'in_progress') IconComponent = Clock;
    else if (value === 'not_approved') IconComponent = XCircle;
    else if (value === 'changes_requested') IconComponent = AlertTriangle;
  } else if (type === 'identityStatus') {
    const info = getIdentityStatusInfo(value as IdentityStatus);
    displayLabel = info.label;
    colorClass = info.color;
    bgClass = info.bg;
    if (value === 'verified') IconComponent = ShieldCheck;
    else if (value === 'pending') IconComponent = AlertTriangle;
  } else if (type === 'orderStatus') {
    const info = getOrderStatusInfo(value as string);
    displayLabel = info.label;
    colorClass = info.color;
    bgClass = info.bg;
    const clean = String(value || '').replace('wc-', '').toLowerCase();
    if (clean === 'shipped') IconComponent = Truck;
    else if (clean === 'completed' || clean === 'delivered') IconComponent = CheckCircle2;
    else if (clean === 'awaiting-pickup' || clean === 'awaiting_pickup') IconComponent = Package;
    else if (clean === 'in-production' || clean === 'in_production') IconComponent = Layers;
    else if (clean === 'quality-check' || clean === 'quality_check') IconComponent = Eye;
    else if (clean === 'processing') IconComponent = Clock;
    else if (clean === 'cancelled' || clean === 'refunded') IconComponent = XCircle;
  } else if (variant) {
    const variantMap: Record<string, { color: string; bg: string }> = {
      lime: { color: 'text-[#f3aa18]', bg: 'bg-[#f3aa18]/10 border-[#f3aa18]/30' },
      emerald: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
      cyan: { color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
      indigo: { color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
      amber: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
      warning: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
      rose: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
      destructive: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
      slate: { color: 'text-zinc-300', bg: 'bg-zinc-800/80 border-zinc-700/80' },
      secondary: { color: 'text-zinc-300', bg: 'bg-zinc-800/80 border-zinc-700/80' },
      subtle: { color: 'text-zinc-600 dark:text-zinc-300', bg: 'bg-zinc-100 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08]' },
      default: { color: 'text-zinc-300', bg: 'bg-zinc-900 border-zinc-800' },
    };
    if (variantMap[variant]) {
      colorClass = variantMap[variant].color;
      bgClass = variantMap[variant].bg;
    }
  }

  const sizeStyles = {
    xs: 'h-5 px-2 text-[10px] leading-none',
    sm: 'h-6 px-2.5 text-[11px] leading-none',
    md: 'h-7 px-3 text-xs leading-none font-medium',
  };

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-mono font-medium border backdrop-blur-md transition-colors',
        sizeStyles[size],
        colorClass,
        bgClass,
        borderClass,
        className
      )}
    >
      {showIcon && IconComponent && <IconComponent className={clsx('shrink-0', size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />}
      <span className="truncate">{displayLabel || children}</span>
    </span>
  );
};

export { badgeVariants }
