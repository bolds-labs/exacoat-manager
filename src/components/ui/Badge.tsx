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
  "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-[7px] border px-2 text-[12px] leading-none font-medium font-sans transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-card-border bg-chip text-fg",
        lime: "border-accent-border bg-accent-soft text-accent-fg",
        secondary: "border-transparent bg-chip text-fg",
        subtle: "border-card-border bg-chip text-muted",
        destructive: "border-st-stop-border bg-st-stop-bg text-st-stop-fg",
        outline: "border-card-border bg-transparent text-fg",
        success: "border-st-done-border bg-st-done-bg text-st-done-fg",
        warning: "border-st-wait-border bg-st-wait-bg text-st-wait-fg",
        amber: "border-st-wait-border bg-st-wait-bg text-st-wait-fg",
        indigo: "border-st-prog-border bg-st-prog-bg text-st-prog-fg",
        cyan: "border-st-prog-border bg-st-prog-bg text-st-prog-fg",
        rose: "border-st-stop-border bg-st-stop-bg text-st-stop-fg",
        emerald: "border-st-done-border bg-st-done-bg text-st-done-fg",
        slate: "border-card-border bg-chip text-muted",
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
  let colorClass = 'text-muted';
  let bgClass = 'bg-chip';
  let borderClass = 'border-card-border';
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
    else if (clean === 'completed' || clean === 'delivered' || clean === 'smb-picked') IconComponent = CheckCircle2;
    else if (clean === 'awaiting-pickup' || clean === 'awaiting_pickup' || clean === 'ready-to-ship' || clean === 'ready_to_ship' || clean === 'smb-ready') IconComponent = Package;
    else if (clean === 'in-production' || clean === 'in_production' || clean === 'preparing-order' || clean === 'preparing_order') IconComponent = Layers;
    else if (clean === 'processing') IconComponent = Clock;
    else if (clean === 'on-hold' || clean === 'pending-payment') IconComponent = Clock;
    else if (clean === 'cancelled' || clean === 'refunded') IconComponent = XCircle;
  } else if (variant) {
    const variantMap: Record<string, { color: string; bg: string }> = {
      lime: { color: 'text-accent-fg', bg: 'bg-accent-soft border-accent-border' },
      emerald: { color: 'text-st-done-fg', bg: 'bg-st-done-bg border-st-done-border' },
      success: { color: 'text-st-done-fg', bg: 'bg-st-done-bg border-st-done-border' },
      cyan: { color: 'text-st-prog-fg', bg: 'bg-st-prog-bg border-st-prog-border' },
      indigo: { color: 'text-st-prog-fg', bg: 'bg-st-prog-bg border-st-prog-border' },
      amber: { color: 'text-st-wait-fg', bg: 'bg-st-wait-bg border-st-wait-border' },
      warning: { color: 'text-st-wait-fg', bg: 'bg-st-wait-bg border-st-wait-border' },
      rose: { color: 'text-st-stop-fg', bg: 'bg-st-stop-bg border-st-stop-border' },
      destructive: { color: 'text-st-stop-fg', bg: 'bg-st-stop-bg border-st-stop-border' },
      slate: { color: 'text-muted', bg: 'bg-chip border-card-border' },
      secondary: { color: 'text-fg', bg: 'bg-chip border-card-border' },
      subtle: { color: 'text-muted', bg: 'bg-chip border-card-border' },
      outline: { color: 'text-fg', bg: 'bg-transparent border-card-border' },
      default: { color: 'text-fg', bg: 'bg-chip border-card-border' },
    };
    if (variantMap[variant]) {
      colorClass = variantMap[variant].color;
      bgClass = variantMap[variant].bg;
      borderClass = '';
    }
  }

  const sizeStyles = {
    xs: 'h-5 px-2 text-[11.5px] leading-none',
    sm: 'h-6 px-2.5 text-[12px] leading-none',
    md: 'h-7 px-3 text-[12.5px] leading-none font-medium',
  };

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] font-sans font-medium border transition-colors',
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
