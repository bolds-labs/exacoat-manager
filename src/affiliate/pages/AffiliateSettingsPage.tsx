import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Lock, 
  Unlock, 
  AlertCircle, 
  Save, 
  User, 
  ShieldCheck, 
  CreditCard, 
  AtSign, 
  ExternalLink,
  Percent,
  Copy,
  Check,
  KeyRound
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

  // Customer discount slider state following creator max commission pool
  const maxPool = Number(profile.max_commission_rate) || 25;
  const currentDiscount = profile.discount_rate != null ? Number(profile.discount_rate) : 0;
  const [discountRate, setDiscountRate] = useState<number>(Math.min(maxPool, currentDiscount));
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);
  const creatorCommission = Math.max(0, Math.round((maxPool - discountRate) * 100) / 100);

  // Bank details form state
  const [bankName, setBankName] = useState<AffiliateBankName | ''>(profile.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number || '');
  const [accountName, setAccountName] = useState(profile.bank_account_name || '');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Slug customization form state
  const [customSlug, setCustomSlug] = useState(profile.slug || '');
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [hasCopiedSlug, setHasCopiedSlug] = useState(false);
  const isSlugLocked = profile.slug_locked;

  // Keep state synchronized whenever profile updates
  useEffect(() => {
    setDisplayName(profile.display_name || '');
    setBankName(profile.bank_name || '');
    setAccountNumber(profile.bank_account_number || '');
    setAccountName(profile.bank_account_name || '');
    setCustomSlug(profile.slug || '');
    const disc = profile.discount_rate != null ? Number(profile.discount_rate) : 0;
    setDiscountRate(Math.min(maxPool, disc));
  }, [profile, maxPool]);

  const handleCopyReferralUrl = () => {
    const url = `https://exacoat.com/?x=${profile.slug}`;
    navigator.clipboard.writeText(url);
    setHasCopiedSlug(true);
    showToast('success', 'Copied', 'Referral URL copied to clipboard.');
    setTimeout(() => setHasCopiedSlug(false), 2000);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDiscount(true);
    try {
      const res = await updateAffiliateSettings({
        affiliate_id: profile.id,
        discount_rate: discountRate,
      });
      if (res.success) {
        showToast(
          'success', 
          'Discount Saved', 
          `Customer discount set to ${discountRate}% and creator commission to ${creatorCommission}%.`
        );
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
        affiliate_id: profile.id,
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
        affiliate_id: profile.id,
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
        affiliate_id: profile.id,
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
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeroHeader
        title="Creator Preferences"
        subtitle="Manage your discount split, Indonesian payout bank, and referral profile settings."
        badge={{ label: 'WORKSTATION SETTINGS', variant: 'amber' }}
      />

      {/* 2-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Financials & Offer Split */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Customer Discount & Split Card */}
          <GlassCard className="p-5 sm:p-6 border border-white/[0.08] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#f3aa18] flex items-center justify-center shrink-0">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                    Customer Discount &amp; Split
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Set the discount your followers receive when shopping through your link.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto text-xs font-mono text-zinc-400 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                Commission Pool: <strong className="text-white">{maxPool}%</strong>
              </span>
            </div>

            <form onSubmit={handleSaveDiscount} className="space-y-5">
              {/* Real-time Split Display */}
              <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-[#050506] border border-white/[0.08]">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">Customer Gets</span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
                    {discountRate}% <span className="text-sm font-normal text-zinc-400">OFF</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Applied automatically at checkout
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">You Keep</span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-[#f3aa18] mt-1">
                    {creatorCommission}% <span className="text-sm font-normal text-[#f3aa18]/70">COMMISSION</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Earned on every verified order
                  </p>
                </div>
              </div>

              {/* Clean Interactive Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={maxPool}
                  step="1"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#f3aa18] bg-zinc-800 focus:outline-none"
                />
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>0% discount ({maxPool}% you)</span>
                  <span>{maxPool}% discount (0% you)</span>
                </div>
              </div>

              {/* Quick Presets & Save Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500 font-mono">Presets:</span>
                  {[
                    { label: 'None (0%)', val: 0 },
                    { label: '5% off', val: 5 },
                    { label: '10% off', val: 10 },
                    ...(maxPool >= 20 ? [{ label: '15% off', val: 15 }] : []),
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setDiscountRate(p.val)}
                      className={clsx(
                        'px-3 py-1 rounded-xl text-xs font-mono border transition-all cursor-pointer',
                        discountRate === p.val
                          ? 'bg-white/[0.12] text-white border-white/30 font-semibold'
                          : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-white'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSavingDiscount || discountRate === currentDiscount}
                  isLoading={isSavingDiscount}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Split Changes
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* 2. Indonesian Bank Settings Card */}
          <GlassCard className="p-6 sm:p-7 border border-white/[0.08] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 text-[#f3aa18] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                    Bank Payout Destination
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Earnings are disbursed in IDR directly via Indonesian bank transfer.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto text-[11px] font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-3 py-1 rounded-full border border-[#f3aa18]/25">
                BCA &amp; Mandiri Supported
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
                    <span>Account Number</span>
                    <span className="text-[#f3aa18]">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 1234567890"
                    className="w-full bg-[#050506] border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                  />
                </div>
              </div>

              {/* Account Holder Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Account Holder Name</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account holder name as registered in bank"
                  className="w-full bg-[#050506] border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
                <p className="text-[11px] text-zinc-400">
                  Please ensure the holder name matches your bank account exactly to prevent transfer reversals. Minimum payout threshold is Rp 250,000.
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
        </div>

        {/* Right Column: Identity, Referral Link, Account */}
        <div className="lg:col-span-5 space-y-6">
          {/* 3. Referral Identity & Custom Slug Card */}
          <GlassCard className="p-6 border border-white/[0.08] space-y-5">
            <div className="flex items-center gap-3 pb-3.5 border-b border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#f3aa18] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                  Referral Branding
                </h2>
                <p className="text-xs text-zinc-400">
                  Your public creator identity and referral link.
                </p>
              </div>
            </div>

            {/* Public Creator Name */}
            <form onSubmit={handleSaveDisplayName} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Public Creator Name</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your channel or creator name"
                  className="w-full bg-[#050506] border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isSavingDisplayName || displayName.trim() === (profile.display_name || '').trim()}
                  isLoading={isSavingDisplayName}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Name
                </Button>
              </div>
            </form>

            {/* Custom Referral Slug */}
            <div className="pt-3 border-t border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Referral URL &amp; Slug</span>
                </label>
                {isSlugLocked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-300 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                    <Lock className="w-2.5 h-2.5 text-[#f3aa18]" />
                    Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <Unlock className="w-2.5 h-2.5" />
                    Customizable
                  </span>
                )}
              </div>

              {isSlugLocked ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[#050506] border border-white/[0.08] flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-[#f3aa18] font-bold truncate select-all">
                      https://exacoat.com/?x={profile.slug}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyReferralUrl}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                      title="Copy referral link"
                    >
                      {hasCopiedSlug ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Locked permanently to prevent broken links across your shared posts and videos.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLockCustomSlug} className="space-y-3">
                  <div className="flex items-center">
                    <span className="bg-[#141416] border border-r-0 border-white/[0.1] rounded-l-xl px-3 py-2 text-xs text-zinc-400 font-mono select-none">
                      exacoat.com/?x=
                    </span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="your-referral-slug"
                      className="flex-1 bg-[#050506] border border-white/[0.1] rounded-r-xl px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-start gap-2 text-xs text-[#f3aa18]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Customizing your slug locks it permanently to preserve all future traffic.
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={isSavingSlug || customSlug === profile.slug}
                      isLoading={isSavingSlug}
                      leftIcon={<Lock className="w-3.5 h-3.5" />}
                    >
                      Save and Lock Slug
                    </Button>
                  </div>
                </form>
              )}

            </div>
          </GlassCard>

          {/* 4. Account Details & Security Card */}
          <GlassCard className="p-5 border border-white/[0.08] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-['Chakra_Petch'] tracking-wide uppercase">
                  Account &amp; Security
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Account profile and credential management.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#050506] border border-white/[0.06] space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Username</span>
                <p className="font-mono text-zinc-200 font-semibold truncate">{profile.username}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#050506] border border-white/[0.06] space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Channel</span>
                <p className="text-zinc-200 font-medium truncate">{profile.promotion_channel || 'General'}</p>
              </div>
              <div className="col-span-2 p-2.5 rounded-lg bg-[#050506] border border-white/[0.06] space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Email Address</span>
                <p className="font-mono text-zinc-200 truncate">{profile.email}</p>
              </div>
            </div>

            <div className="pt-1">
              <a
                href="https://exacoat.com/my-account/edit-account/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#f3aa18]/40 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                <span>Manage Password &amp; Login</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
