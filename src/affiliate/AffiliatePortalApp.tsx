import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AffiliateLayout, AffiliateTabKey } from './components/AffiliateLayout';
import { AffiliateDashboardPage } from './pages/AffiliateDashboardPage';
import { AffiliateLinkGeneratorPage } from './pages/AffiliateLinkGeneratorPage';
import { AffiliatePayoutsPage } from './pages/AffiliatePayoutsPage';
import { AffiliateSettingsPage } from './pages/AffiliateSettingsPage';
import { AffiliateRegisterPage } from './pages/AffiliateRegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { fetchAffiliatePortalData } from '../lib/wordpressBridge';
import { AffiliateProfile, AffiliateCommission, AffiliatePayout, AffiliateClick, AffiliateDailyStat } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

export const AffiliatePortalApp: React.FC = () => {
  const { user, logout, isLoading: isAuthLoading } = useAuth();

  const [viewMode, setViewMode] = useState<'app' | 'register'>('app');
  const [currentTab, setCurrentTab] = useState<AffiliateTabKey>('dashboard');

  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [metrics, setMetrics] = useState<{
    lifetime_earnings: number;
    unpaid_balance: number;
    total_clicks: number;
    total_orders: number;
    commission_rate: number;
    min_payout_amount: number;
    can_request_payout: boolean;
  }>({
    lifetime_earnings: 0,
    unpaid_balance: 0,
    total_clicks: 0,
    total_orders: 0,
    commission_rate: 20,
    min_payout_amount: 250000,
    can_request_payout: false,
  });
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [dailyStats, setDailyStats] = useState<AffiliateDailyStat[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPortalData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    setErrorMsg(null);
    try {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const affIdParam = searchParams?.get('affiliate_id');
      const isStaff = user.role === 'super_admin' || user.role === 'manager' || user.role === 'shop_manager';
      const targetAffId = affIdParam && isStaff ? Number(affIdParam) : undefined;
      const res = await fetchAffiliatePortalData(targetAffId);
      if (res.success && res.profile) {
        setProfile(res.profile);
        if (res.metrics) setMetrics(res.metrics);
        if (res.commissions) setCommissions(res.commissions);
        if (res.payouts) setPayouts(res.payouts);
        if (res.clicks) setClicks(res.clicks);
        if (res.daily_stats) setDailyStats(res.daily_stats);
      } else {
        setErrorMsg(res.error || 'Unable to retrieve affiliate profile.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with affiliate server.');
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPortalData();
    }
  }, [user, loadPortalData]);

  // If user is registering
  if (viewMode === 'register') {
    return <AffiliateRegisterPage onNavigateToLogin={() => setViewMode('app')} />;
  }

  // If auth is loading
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // If not logged in, show Creator Login page with option to switch to Register
  if (!user) {
    return (
      <LoginPage 
        portalMode="affiliate" 
        onGoToRegister={() => setViewMode('register')} 
      />
    );
  }

  // If profile is loading for the first time
  if (isLoadingData && !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-xs text-zinc-400">Loading your affiliate workstation...</p>
      </div>
    );
  }

  // If error loading profile
  if (errorMsg && !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-white">Profile Unavailable</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{errorMsg}</p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={loadPortalData}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AffiliateLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      profile={profile}
      onLogout={logout}
    >
      {currentTab === 'dashboard' && profile && (
        <AffiliateDashboardPage
          profile={profile}
          metrics={metrics}
          commissions={commissions}
          clicks={clicks}
          dailyStats={dailyStats}
          payouts={payouts}
          onRefresh={loadPortalData}
          isLoading={isLoadingData}
          onNavigateTab={setCurrentTab}
        />
      )}
      {currentTab === 'links' && profile && (
        <AffiliateLinkGeneratorPage profile={profile} />
      )}
      {currentTab === 'payouts' && profile && (
        <AffiliatePayoutsPage
          profile={profile}
          payouts={payouts}
          onRefresh={loadPortalData}
          onNavigateTab={setCurrentTab}
        />
      )}
      {currentTab === 'settings' && profile && (
        <AffiliateSettingsPage
          profile={profile}
          onRefresh={loadPortalData}
        />
      )}
    </AffiliateLayout>
  );
};
