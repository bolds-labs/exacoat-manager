import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  Unlock, 
  AlertCircle, 
  Save, 
  User, 
  Globe,
  ShieldCheck,
  CreditCard,
  AtSign,
  Sliders,
  Percent,
  Coins,
  ExternalLink
} from 'lucide-react';
import { AffiliateProfile, AffiliateBankName } from '../../types';
import { updateAffiliateSettings } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { clsx } from 'clsx';

interface AffiliateSettingsPageProps {
  profile: AffiliateProfile;
  onRefresh: () => void;
}

export const AffiliateSettingsPage: React.FC<AffiliateSettingsPageProps> = ({ profile, onRefresh }) => {
  const { showToast } = useToast();

  // Creator display name form state
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  // Customer discount slider state
  const currentDiscount = Number(profile.discount_rate) || 10;
  const currentCommission = Number(profile.commission_rate) || 10;
  const totalPool = Math.max(20, Math.round(currentDiscount + currentCommission));
  const [discountRate, setDiscountRate] = useState<number>(currentDiscount);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);
  const creatorCommission = Math.max(0, Math.round((totalPool - discountRate) * 100) / 100);

  // Bank details form state
  const [bankName, setBankName] = useState<AffiliateBankName | ''>(profile.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number || '');
  const [accountName, setAccountName] = useState(profile.bank_account_name || '');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Slug customization form state
  const [customSlug, setCustomSlug] = useState(profile.slug || '');
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const isSlugLocked = profile.slug_locked;

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDiscount(true);
    try {
      const res = await updateAffiliateSettings({
        discount_rate: discountRate,
      });
      if (res.success) {
        showToast('success', 'Discount Saved', `Customer discount updated to ${discountRate}% (Creator commission: ${creatorCommission}%).`);
        onRefresh();
      } else {
        showToast('error', 'Update Failed', res.error || 'Unable to update discount split.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network error occurred.');
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast('error', 'Missing Name', 'Please enter your creator display name.');
      return;
    }

    setIsSavingDisplayName(true);
    try {
      const res = await updateAffiliateSettings({
        display_name: displayName.trim(),
      });

      if (res.success) {
        showToast('success', 'Profile Saved', 'Creator display name updated successfully.');
        onRefresh();
      } else {
        showToast('error', 'Save Failed', res.error || 'Unable to update display name.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network error occurred.');
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !['BCA', 'MANDIRI'].includes(bankName)) {
      showToast('error', 'Invalid Bank', 'Please select either BCA or Bank Mandiri.');
      return;
    }
    if (!accountNumber.trim()) {
      showToast('error', 'Missing Number', 'Please enter your bank account number.');
      return;
    }
    if (!accountName.trim()) {
      showToast('error', 'Missing Name', 'Please enter the bank account holder name.');
      return;
    }

    setIsSavingBank(true);
    try {
      const res = await updateAffiliateSettings({
        bank_name: bankName as 'BCA' | 'MANDIRI',
        bank_account_number: accountNumber.trim(),
        bank_account_name: accountName.trim(),
      });

      if (res.success) {
        showToast('success', 'Settings Saved', 'Bank account details updated successfully.');
        onRefresh();
      } else {
        showToast('error', 'Save Failed', res.error || 'Unable to update bank details.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network error occurred.');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleLockCustomSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSlugLocked) return;

    const sanitized = customSlug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    if (sanitized.length < 3) {
      showToast('error', 'Invalid Slug', 'Referral slug must be at least 3 characters.');
      return;
    }

    const confirmed = window.confirm(
      `Locking your referral slug to "${sanitized}".\n\nImportant: Once locked, this URL cannot be changed again. Are you sure you want to proceed?`
    );
    if (!confirmed) return;

    setIsSavingSlug(true);
    try {
      const res = await updateAffiliateSettings({
        slug: sanitized,
      });

      if (res.success) {
        showToast('success', 'Slug Locked', `Your referral slug has been locked to "${sanitized}".`);
        onRefresh();
      } else {
        showToast('error', 'Error', res.error || 'Failed to customize referral slug.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network error occurred.');
    } finally {
      setIsSavingSlug(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeroHeader
        title="Affiliate Settings"
        subtitle="Configure your creator display name, Indonesian bank payout destination, and branded referral slug."
        badge={{ label: 'PREFERENCES', variant: 'amber' }}
      />

      {/* 1. Customer Discount & Commission Slider Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                Customer Discount &amp; Commission Split
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Slide the percentage to balance customer savings against your earned payout commission.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-3 py-1 rounded-full border border-[#f3aa18]/25 font-mono">
            Total Budget Pool: {totalPool}%
          </span>
        </div>

        <form onSubmit={handleSaveDiscount} className="space-y-6">
          {/* Split KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  Customer Discount
                </span>
                <span className="font-mono text-base font-bold">{discountRate}% Off</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Automatically deducted for shoppers entering via your referral link.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#f3aa18] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  Your Commission
                </span>
                <span className="font-mono text-base font-bold">{creatorCommission}% Cash</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Disbursed to your registered Indonesian bank account after order maturity.
              </p>
            </div>
          </div>

          {/* Interactive Range Slider */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="font-medium">Slide Customer Discount Percentage</span>
              <span className="font-mono font-bold text-white bg-white/[0.08] px-2.5 py-0.5 rounded-lg border border-white/[0.1]">
                {discountRate}% / {creatorCommission}%
              </span>
            </div>

            <div className="relative pt-1">
              <input
                type="range"
                min="0"
                max={totalPool}
                step="1"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#f3aa18] focus:outline-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-2 px-0.5">
                <span>0% Discount</span>
                <span>{Math.round(totalPool / 2)}% / {Math.round(totalPool / 2)}%</span>
                <span>{totalPool}% Discount</span>
              </div>
            </div>

            {/* Visual Proportion Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800 border border-white/[0.06]">
              <div
                className="bg-emerald-500 h-full transition-all duration-150"
                style={{ width: `${(discountRate / totalPool) * 100}%` }}
                title={`Customer Discount: ${discountRate}%`}
              />
              <div
                className="bg-[#f3aa18] h-full transition-all duration-150"
                style={{ width: `${(creatorCommission / totalPool) * 100}%` }}
                title={`Creator Commission: ${creatorCommission}%`}
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-zinc-500 font-mono">Presets:</span>
              <button
                type="button"
                onClick={() => setDiscountRate(Math.round(totalPool / 2))}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer',
                  discountRate === Math.round(totalPool / 2)
                    ? 'bg-white/[0.12] text-white border-white/30'
                    : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200'
                )}
              >
                50 / 50 Balanced
              </button>
              <button
                type="button"
                onClick={() => setDiscountRate(totalPool >= 25 ? 10 : 5)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer',
                  discountRate === (totalPool >= 25 ? 10 : 5)
                    ? 'bg-white/[0.12] text-white border-white/30'
                    : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200'
                )}
              >
                Higher Commission ({totalPool >= 25 ? '10% / 15%' : '5% / 15%'})
              </button>
              <button
                type="button"
                onClick={() => setDiscountRate(15)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer',
                  discountRate === 15
                    ? 'bg-white/[0.12] text-white border-white/30'
                    : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200'
                )}
              >
                Higher Discount (15% / {totalPool - 15}%)
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end border-t border-white/[0.06]">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSavingDiscount || discountRate === currentDiscount}
              isLoading={isSavingDiscount}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Discount Split
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* 2. Creator Display Details Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[#f3aa18] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                Creator Display Name
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                The public name presented to your audience when your direct discount is applied.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25">
            Active Discount: {profile.discount_rate || 10}% Off
          </span>
        </div>

        <form onSubmit={handleSaveDisplayName} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Public Creator Name</span>
              <span className="text-[#f3aa18]">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Edwin Yang"
              className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
            />
            <p className="text-[11px] text-zinc-400">
              Displayed in customer discount notifications: &quot;Creator discount applied: {profile.discount_rate || 10}% off from {displayName.trim() || 'Your Name'}&quot; and reflected in checkout totals.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSavingDisplayName || displayName.trim() === (profile.display_name || '').trim()}
              isLoading={isSavingDisplayName}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Creator Name
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* 3. Indonesian Bank Settings Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/25 text-[#f3aa18] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                Bank Payout Destination
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Earnings are disbursed directly via Indonesian bank transfer.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-3 py-1 rounded-full border border-[#f3aa18]/25">
            BCA &amp; Mandiri Only
          </span>
        </div>

        <form onSubmit={handleSaveBankDetails} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bank Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Destination Bank</span>
                <span className="text-[#f3aa18]">*</span>
              </label>
              <CustomSelect
                value={bankName}
                onChange={(val) => setBankName(val as AffiliateBankName)}
                placeholder="Select Destination Bank..."
                options={[
                  { value: 'BCA', label: 'Bank Central Asia (BCA)', subtitle: 'Fast Indonesian bank transfer' },
                  { value: 'MANDIRI', label: 'Bank Mandiri', subtitle: 'Fast Indonesian bank transfer' },
                ]}
              />
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Account Number (Nomor Rekening)</span>
                <span className="text-[#f3aa18]">*</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5271234567"
                className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
              />
            </div>
          </div>

          {/* Account Holder Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Account Holder Name (Nama Pemilik Rekening)</span>
              <span className="text-[#f3aa18]">*</span>
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Budi Santoso"
              className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
            />
            <p className="text-[11px] text-zinc-400">
              Please ensure the holder name matches your bank passbook exactly to prevent transfer reversals.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSavingBank}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Bank Info
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* 3. Custom Referral Slug Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
              isSlugLocked 
                ? 'bg-white/[0.03] text-zinc-400 border-white/[0.08]' 
                : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
            )}>
              {isSlugLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                Custom Referral Slug
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Your branded identifier attached to all referral destination links.
              </p>
            </div>
          </div>
          {isSlugLocked ? (
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
              <Lock className="w-3 h-3 text-[#f3aa18]" />
              Locked Permanently
            </span>
          ) : (
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <Unlock className="w-3 h-3" />
              Customizable Once
            </span>
          )}
        </div>

        {isSlugLocked ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#09090b]/80 border border-white/[0.08] space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Current Referral Base URL
              </span>
              <p className="text-sm font-mono text-[#f3aa18] font-bold select-all break-all">
                https://exacoat.com/?x={profile.slug}
              </p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your slug is permanently locked to protect customer links you have shared across your channels. Contact partner support if you require a critical update.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLockCustomSlug} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Customize Your Slug</span>
              </label>
              <div className="flex items-center">
                <span className="bg-[#141416] border border-r-0 border-white/[0.1] rounded-l-xl px-3.5 py-2.5 text-xs text-zinc-400 font-mono select-none">
                  exacoat.com/?x=
                </span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="your-brand-name"
                  className="flex-1 bg-[#0a0a0c]/80 border border-white/[0.1] rounded-r-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-start gap-2.5 text-xs text-[#f3aa18]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-zinc-300">
                <strong className="text-[#f3aa18]">Attention:</strong> You can customize this slug once. Once submitted, it will be permanently locked to ensure no shared links ever break.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSavingSlug || customSlug === profile.slug}
                isLoading={isSavingSlug}
                leftIcon={<Lock className="w-3.5 h-3.5" />}
              >
                Save and Lock Slug
              </Button>
            </div>
          </form>
        )}
      </GlassCard>

      {/* 4. Account Profile Snapshot */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-300">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
              Profile Details
            </h2>
            <p className="text-xs text-zinc-400">
              Basic account metadata registered in the affiliate database.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-4 rounded-xl bg-[#09090b]/70 border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Account Username
            </span>
            <p className="font-mono text-zinc-200 font-semibold">{profile.username}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#09090b]/70 border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Email Address
            </span>
            <p className="font-mono text-zinc-200 font-semibold">{profile.email}</p>
          </div>
          {profile.affiliate_type && !profile.affiliate_type.toLowerCase().includes('slicewp') && (
            <div className="p-4 rounded-xl bg-[#09090b]/70 border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Affiliate Category
              </span>
              <p className="text-zinc-200 font-medium">{profile.affiliate_type}</p>
            </div>
          )}
          <div className="p-4 rounded-xl bg-[#09090b]/70 border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Primary Channel
            </span>
            <p className="text-zinc-200 font-medium truncate">{profile.promotion_channel || 'Not specified'}</p>
          </div>
        </div>
      </GlassCard>

      {/* 5. Account Credentials & Security Card */}
      <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
              Account Credentials &amp; Security
            </h2>
            <p className="text-xs text-zinc-400">
              Manage your login email and account password on the Exacoat store portal.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#09090b]/70 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-zinc-300">
            <p className="font-medium text-white">Need to change your password or primary email?</p>
            <p className="text-zinc-400 leading-relaxed">
              Your creator workstation login is linked directly with your primary Exacoat customer account. To update credentials, please visit the account management portal.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="shrink-0 border-white/[0.15] hover:border-[#f3aa18]/50 hover:text-[#f3aa18]"
          >
            <a
              href="https://exacoat.com/my-account/edit-account/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <span>Manage on Exacoat.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
