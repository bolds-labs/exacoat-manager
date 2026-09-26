import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  Unlock, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Save, 
  Loader2, 
  User, 
  Globe 
} from 'lucide-react';
import { AffiliateProfile, AffiliateBankName } from '../../types';
import { updateAffiliateSettings } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';

interface AffiliateSettingsPageProps {
  profile: AffiliateProfile;
  onRefresh: () => void;
}

export const AffiliateSettingsPage: React.FC<AffiliateSettingsPageProps> = ({ profile, onRefresh }) => {
  const { showToast } = useToast();

  // Bank details form state
  const [bankName, setBankName] = useState<AffiliateBankName | ''>(profile.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number || '');
  const [accountName, setAccountName] = useState(profile.bank_account_name || '');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Slug customization form state
  const [customSlug, setCustomSlug] = useState(profile.slug || '');
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const isSlugLocked = profile.slug_locked;

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
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Affiliate Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure your Indonesian payout destination and manage your referral slug.
        </p>
      </div>

      {/* 1. Indonesian Bank Settings Card */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Bank Payout Destination</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Payouts are exclusively processed via BCA and Bank Mandiri.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            BCA &amp; Mandiri Only
          </span>
        </div>

        <form onSubmit={handleSaveBankDetails} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bank Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Destination Bank <span className="text-amber-400">*</span>
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value as AffiliateBankName)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select a Bank...</option>
                <option value="BCA">Bank Central Asia (BCA)</option>
                <option value="MANDIRI">Bank Mandiri</option>
              </select>
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Account Number (Nomor Rekening) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5271234567"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {/* Account Holder Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Account Holder Name (Nama Pemilik Rekening) <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Budi Santoso"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <p className="text-[11px] text-zinc-400">
              Please ensure the holder name matches your bank book exactly to avoid failed transfers.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingBank}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer shadow-sm"
            >
              {isSavingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Bank Info</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Custom Referral Slug Card */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'p-2 rounded-lg',
              isSlugLocked ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-500/10 text-blue-400'
            )}>
              {isSlugLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Custom Referral Slug</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Your branded URL identifier at the end of referral links.
              </p>
            </div>
          </div>
          {isSlugLocked ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
              <Lock className="w-3 h-3" />
              Locked Permanently
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <Unlock className="w-3 h-3" />
              Customizable Once
            </span>
          )}
        </div>

        {isSlugLocked ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
              <span className="text-xs text-zinc-400">Current Referral Base URL:</span>
              <p className="text-xs font-mono text-amber-400 font-semibold select-all">
                https://exacoat.com/?ref={profile.slug}
              </p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your slug is permanently locked to protect customer links you have shared across your channels. Contact partner support if you require a critical update.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLockCustomSlug} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Customize Your Slug
              </label>
              <div className="flex items-center">
                <span className="bg-zinc-800 border border-r-0 border-zinc-700 rounded-l-xl px-3 py-2.5 text-xs text-zinc-400 font-mono">
                  exacoat.com/?ref=
                </span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="your-brand-name"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-r-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Attention:</strong> You can customize this slug once. Once submitted, it will be permanently locked to ensure no shared links ever break.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingSlug || customSlug === profile.slug}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSlug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Save and Lock Slug</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 3. Account Profile Snapshot */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-semibold text-white">Profile Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
            <span className="text-zinc-400">Account Username:</span>
            <p className="font-mono text-zinc-200">{profile.username}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
            <span className="text-zinc-400">Email Address:</span>
            <p className="font-mono text-zinc-200">{profile.email}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
            <span className="text-zinc-400">Affiliate Category:</span>
            <p className="text-zinc-200">{profile.affiliate_type || 'Content Creator'}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
            <span className="text-zinc-400">Primary Channel:</span>
            <p className="text-zinc-200 truncate">{profile.promotion_channel || 'Not specified'}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
