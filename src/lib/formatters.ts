/**
 * Strict currency and string formatter adhering to antislop rules:
 * - ZERO em dashes
 * - Clean multi-currency support (IDR, USD, EUR, SGD, GBP, AUD)
 */

export function stripEmDashes(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/\s*--\s*/g, ', ');
}

export function formatCurrency(amount: number | string | undefined | null, currency = 'IDR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return currency === 'IDR' ? 'Rp 0' : '$0.00';

  const curr = (currency || 'IDR').toUpperCase().trim();

  if (curr === 'IDR') {
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  }

  if (curr === 'USD') {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (curr === 'EUR') {
    return '€' + num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (curr === 'GBP') {
    return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (curr === 'SGD') {
    return 'S$' + num.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (curr === 'AUD') {
    return 'A$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return curr + ' ' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

export function getStatusBadgeStyle(status: string): { bg: string; text: string; label: string; border: string } {
  const norm = (status || '').toLowerCase().replace('wc-', '').trim();

  switch (norm) {
    case 'processing':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'Processing',
      };
    case 'ready-to-ship':
    case 'ready_to_ship':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'Ready to Ship',
      };
    case 'completed':
    case 'delivered':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'Completed',
      };
    case 'on-hold':
    case 'on_hold':
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
        label: 'On Hold',
      };
    case 'cancelled':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        label: 'Cancelled',
      };
    case 'refunded':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        label: 'Refunded',
      };
    case 'failed':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
        label: 'Failed',
      };
    default:
      return {
        bg: 'bg-zinc-800',
        text: 'text-zinc-300',
        border: 'border-zinc-700',
        label: norm.charAt(0).toUpperCase() + norm.slice(1),
      };
  }
}
