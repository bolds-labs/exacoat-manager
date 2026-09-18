import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { Button, buttonVariants } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { 
  Database, 
  Copy, 
  Check, 
  Save, 
  Download, 
  Activity, 
  Zap, 
  Smartphone, 
  Cloud, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Globe,
  Mail,
  RotateCw,
  HardDrive
} from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext';
import { 
  fetchPluginSettings, 
  savePluginSettings, 
  testPushoverDirect, 
  testCloudflareCacheDirect,
  purgeCloudflareCacheDirect,
  flushWordPressPermalinks, 
  revertWordPressMedia,
  WordPressPluginSettings,
  PrivateSettingStatus
} from '../../lib/wordpressBridge';
import { getWordPressBaseUrl, setWordPressBaseUrl, getWcCredentials, setWcCredentials } from '../../lib/env';
import { PLUGIN_VERSION, PLUGIN_ZIP_NAME } from '../../config/version';
import { TeamRolesManager } from './TeamRolesManager';
import { WhatsAppAutomationSection } from './WhatsAppAutomationSection';

type SettingsTab = 'general' | 'team' | 'automation' | 'integrations' | 'database';

export const SettingsPanel: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [currentWpUrl, setCurrentWpUrl] = useState(getWordPressBaseUrl());
  const [wpUrlInput, setWpUrlInput] = useState(getWordPressBaseUrl());
  const wpBaseUrl = currentWpUrl;
  const wcCredentials = getWcCredentials();

  const handleSaveWpUrl = (urlToSet?: string) => {
    const target = (urlToSet !== undefined ? urlToSet : wpUrlInput).trim();
    if (!target) return;
    setWordPressBaseUrl(target);
    const updated = getWordPressBaseUrl();
    setCurrentWpUrl(updated);
    setWpUrlInput(updated);
    showToast('success', 'WordPress Target Updated', `Active API target set to: ${updated}`);
  };

  const handleResetWpUrl = () => {
    setWordPressBaseUrl('');
    const updated = getWordPressBaseUrl();
    setCurrentWpUrl(updated);
    setWpUrlInput(updated);
    showToast('info', 'Target Reset', `Restored environment default: ${updated}`);
  };

  const [wcKeyInput, setWcKeyInput] = useState(wcCredentials.key);
  const [wcSecretInput, setWcSecretInput] = useState(wcCredentials.secret);
  const [showWcSecret, setShowWcSecret] = useState(false);

  const handleSaveWcCredentials = (k?: string, s?: string) => {
    const kVal = (k !== undefined ? k : wcKeyInput).trim();
    const sVal = (s !== undefined ? s : wcSecretInput).trim();
    setWcCredentials(kVal, sVal);
    setWcKeyInput(kVal);
    setWcSecretInput(sVal);
    showToast('success', 'Credentials Saved', 'WooCommerce API keys stored in local browser storage.');
  };

  const handleClearWcCredentials = () => {
    setWcCredentials('', '');
    setWcKeyInput('');
    setWcSecretInput('');
    showToast('info', 'Credentials Cleared', 'Reset to container environment default.');
  };

  // Remote WordPress Plugin Settings State
  const [wpSettings, setWpSettings] = useState<WordPressPluginSettings>({
    pushover_app_token: '',
    pushover_user_key: '',
    pushover_enabled: 1,
    pushover_notify_new_sale: 1,
    pushover_notify_inventory: 1,
    pushover_notify_errors: 1,
    cloudflare_zone_id: '',
    cloudflare_api_token: '',
    email_from_name: 'Exacoat',
    email_from_address: 'orders@exacoat.com',
    email_webhook_url: '',
    webhook_secret_key: '',
  });

  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [secretStatus, setSecretStatus] = useState<PrivateSettingStatus>({});

  // Integration Test Statuses
  const [isTestingPushover, setIsTestingPushover] = useState(false);
  const [pushoverTestResult, setPushoverTestResult] = useState<any>(null);
  const [isTestingCloudflare, setIsTestingCloudflare] = useState(false);
  const [isPurgingCloudflareCache, setIsPurgingCloudflareCache] = useState(false);
  const [cloudflareTestResult, setCloudflareTestResult] = useState<any>(null);

  // Quick Operations
  const [isFlushingPermalinks, setIsFlushingPermalinks] = useState(false);

  // WooCommerce REST API Connection Test
  const [isTestingWcApi, setIsTestingWcApi] = useState(false);
  const [wcApiTestResult, setWcApiTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    latency?: number;
    message?: string;
  } | null>(null);

  // Fetch Settings on Mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    const res = await fetchPluginSettings();
    if (res.success && res.settings) {
      setWpSettings(prev => ({
        ...prev,
        ...res.settings,
      }));
      setSecretStatus(res.secretStatus || {});
    } else if (!res.success) {
      showToast('error', 'Settings Unavailable', res.error || 'Sign in with a Manager account to load settings.');
    }
    setIsLoadingSettings(false);
  };

  const toggleShowSecret = (fieldKey: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const secretPlaceholder = (key: string, fallback: string) => {
    const status = secretStatus[key];
    if (status?.source === 'environment') return 'Configured in CMS environment';
    if (status?.configured) return 'Configured in CMS settings';
    return fallback;
  };

  const secretSource = (key: string) => {
    const status = secretStatus[key];
    if (!status?.configured) return null;
    return status.source === 'environment' ? 'Loaded from CMS server config' : 'Saved securely in WordPress';
  };

  const handleSaveRemoteSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    const res = await savePluginSettings(wpSettings);
    setIsSavingSettings(false);

    if (res.success) {
      showToast('success', 'Settings Saved', 'Settings synchronized with WordPress.');
      await loadSettings();
    } else {
      showToast('error', 'Save Failed', res.error || 'Failed updating plugin settings');
    }
  };

  const handleTestPushover = async () => {
    setIsTestingPushover(true);
    setPushoverTestResult(null);
    const res = await testPushoverDirect();
    setIsTestingPushover(false);
    setPushoverTestResult(res);

    if (res.success) {
      showToast('success', 'Pushover Alert Sent', `Delivered test notification (${res.latency_ms}ms)`);
    } else {
      showToast('error', 'Pushover Failed', res.message || 'Check App Token and User Key');
    }
  };

  const handleTestCloudflare = async () => {
    setIsTestingCloudflare(true);
    setCloudflareTestResult(null);
    const res = await testCloudflareCacheDirect();
    setIsTestingCloudflare(false);
    setCloudflareTestResult(res);

    if (res.success) {
      showToast('success', 'Cloudflare Connected', `Zone "${(res as any).zone_name || 'Exacoat'}" active (${res.latency_ms || res.latencyMs || 0}ms)`);
    } else {
      showToast('error', 'Cloudflare Failed', res.message || 'Check Zone ID and API Token');
    }
  };

  const handlePurgeCloudflareCache = async (scope: 'manager' | 'all' = 'manager') => {
    setIsPurgingCloudflareCache(true);
    const res = await purgeCloudflareCacheDirect(scope);
    setIsPurgingCloudflareCache(false);

    if (res.success) {
      showToast('success', 'Cache Purged', res.message || `Purged ${scope} cache successfully.`);
    } else {
      showToast('error', 'Purge Failed', res.message || 'Could not purge Cloudflare edge cache');
    }
  };

  const handleFlushPermalinks = async () => {
    setIsFlushingPermalinks(true);
    const res = await flushWordPressPermalinks();
    setIsFlushingPermalinks(false);
    if (res.success) {
      showToast('success', 'Permalinks Flushed', res.message || 'All rewrite rules refreshed');
    } else {
      showToast('error', 'Flush Failed', res.message);
    }
  };

  const handleTestWcApi = async () => {
    setIsTestingWcApi(true);
    setWcApiTestResult(null);
    const startTime = Date.now();
    const activeKey = (wcKeyInput || wcCredentials.key).trim();
    const activeSecret = (wcSecretInput || wcCredentials.secret).trim();

    if (!activeKey || !activeSecret) {
      setIsTestingWcApi(false);
      setWcApiTestResult({
        status: 'error',
        message: 'Consumer Key and Secret are required to test the WooCommerce API.',
      });
      showToast('error', 'Missing Keys', 'Please enter and save your Consumer Key and Secret first.');
      return;
    }

    try {
      // Over HTTPS, WooCommerce REST API natively uses consumer_key and consumer_secret query params.
      // Do NOT send Basic Auth header: WordPress core Application Passwords intercepts it and rejects ck_ as an unknown username.
      const endpoint = `${wpBaseUrl}/wp-json/wc/v3/system_status?consumer_key=${encodeURIComponent(activeKey)}&consumer_secret=${encodeURIComponent(activeSecret)}`;

      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        setWcApiTestResult({
          status: 'success',
          latency,
          message: `HTTP ${response.status} OK — WooCommerce Core REST API responsive`,
        });
        showToast('success', 'WooCommerce Connected', `System Status responded in ${latency}ms`);
      } else {
        const text = await response.text();
        setWcApiTestResult({
          status: 'error',
          latency,
          message: `HTTP ${response.status}: ${text.slice(0, 150)}`,
        });
        showToast('error', 'Connection Refused', `HTTP ${response.status}`);
      }
    } catch (err: any) {
      const latency = Date.now() - startTime;
      setWcApiTestResult({
        status: 'error',
        latency,
        message: err.message || 'Network error pinging WooCommerce REST API',
      });
      showToast('error', 'API Offline', err.message || 'Could not connect');
    } finally {
      setIsTestingWcApi(false);
    }
  };

  const [isRevertingMedia, setIsRevertingMedia] = useState(false);

  const handleRevertMedia = async () => {
    setIsRevertingMedia(true);
    try {
      const res = await revertWordPressMedia();
      if (res.success) {
        showToast('success', 'Media Consolidated', res.message || 'All media files consolidated to flat /uploads.');
      } else {
        showToast('error', 'Consolidation Failed', res.error || res.message || 'Could not consolidate media.');
      }
    } catch (err: any) {
      showToast('error', 'Consolidation Error', err.message || 'Failed to trigger media consolidation');
    } finally {
      setIsRevertingMedia(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast('info', 'Copied to Clipboard', `${label} copied.`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'team', label: 'Team Roles' },
    { id: 'automation', label: 'WhatsApp & Automation' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'database', label: 'Store API & Data' },
  ];

  return (
    <div className="space-y-6 font-sans">
      <PageHeroHeader
        title="Settings"
        subtitle="Manage store configuration, integrations, access control, and API data."
        actions={<>
          <a href={`/${PLUGIN_ZIP_NAME}`} download className={buttonVariants({ variant: 'secondary' })}>
            <Download className="w-3.5 h-3.5" />
            Plugin v{PLUGIN_VERSION}
          </a>
          <Button 
            type="button" 
            onClick={() => handleSaveRemoteSettings()} 
            isLoading={isSavingSettings} 
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Changes
          </Button>
        </>}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={tab => setActiveTab(tab as SettingsTab)} className="w-full" />

      {/* TAB: Team & Staff Roles */}
      {activeTab === 'team' && (
        <TeamRolesManager />
      )}

      {/* TAB: WhatsApp & Automation Engine */}
      {activeTab === 'automation' && (
        <WhatsAppAutomationSection />
      )}

      {/* TAB: General Store Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Store Overview Card */}
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center text-[#f3aa18]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Store & Environment Overview
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    Exacoat production storefront connection and core system metadata.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFlushPermalinks}
                isLoading={isFlushingPermalinks}
                leftIcon={<RotateCw className="w-3.5 h-3.5 text-[#f3aa18]" />}
              >
                Flush Permalinks
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Store Brand</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-white font-sans">Exacoat</span>
                <p className="text-[11px] text-zinc-500 font-sans">Premium Gadget Skins & Protection</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">WordPress Base URL</span>
                <span className="text-xs font-bold text-[#f3aa18] truncate block">{wpBaseUrl}</span>
                <p className="text-[11px] text-zinc-500 font-sans">Primary CMS backend</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Software Version</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">v{PLUGIN_VERSION}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#f3aa18]/15 text-[#f3aa18] border border-[#f3aa18]/30 font-bold">Latest</span>
                </div>
                <p className="text-[11px] text-zinc-500 font-sans">Manager ERP & exacoat-core</p>
              </div>
            </div>
          </GlassCard>

          {/* Email Sender Defaults Card */}
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#f3aa18]" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Store Email Defaults
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Default sender identity for customer transactional emails, order updates, and notifications.
              </p>
            </div>

            <form onSubmit={handleSaveRemoteSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-2">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={wpSettings.email_from_name || 'Exacoat'}
                    onChange={e => setWpSettings({ ...wpSettings, email_from_name: e.target.value })}
                    placeholder="Exacoat"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                  />
                  <p className="text-[11px] text-zinc-500 font-sans">Appears as the From name in customer inboxes.</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-2">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Sender Email Address
                  </label>
                  <input
                    type="email"
                    value={wpSettings.email_from_address || 'orders@exacoat.com'}
                    onChange={e => setWpSettings({ ...wpSettings, email_from_address: e.target.value })}
                    placeholder="orders@exacoat.com"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-sm font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                  />
                  <p className="text-[11px] text-zinc-500 font-sans">Verified outbound sending address.</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  isLoading={isSavingSettings}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Email Defaults
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* TAB: Integrations (Pushover & Cloudflare Cache) */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Pushover Real-Time Mobile Push Alerts */}
          <GlassCard className="p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#f3aa18]" />
                <strong className="text-sm font-bold text-zinc-900 dark:text-white">
                  Pushover Real-Time Admin Push Notifications
                </strong>
              </div>

              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(wpSettings.pushover_enabled)}
                  onChange={e => setWpSettings({ ...wpSettings, pushover_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded text-[#f3aa18] accent-[#f3aa18]"
                />
                <span className="text-zinc-300">Enable Mobile Alerts</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Pushover App Token / API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showSecrets['pushover_app_token'] ? 'text' : 'password'}
                    value={wpSettings.pushover_app_token || ''}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_app_token: e.target.value })}
                    placeholder={secretPlaceholder('pushover_app_token', 'Pushover app token')}
                    className="w-full p-2.5 pr-10 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('pushover_app_token')}
                    className="absolute right-2.5 p-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    {showSecrets['pushover_app_token'] ? <EyeOff className="w-4 h-4 text-[#f3aa18]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {secretSource('pushover_app_token') && <p className="text-[10px] font-mono text-emerald-400">{secretSource('pushover_app_token')}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Pushover User Key / Group Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showSecrets['pushover_user_key'] ? 'text' : 'password'}
                    value={wpSettings.pushover_user_key || ''}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_user_key: e.target.value })}
                    placeholder={secretPlaceholder('pushover_user_key', 'Pushover user key')}
                    className="w-full p-2.5 pr-10 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('pushover_user_key')}
                    className="absolute right-2.5 p-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    {showSecrets['pushover_user_key'] ? <EyeOff className="w-4 h-4 text-[#f3aa18]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {secretSource('pushover_user_key') && <p className="text-[10px] font-mono text-emerald-400">{secretSource('pushover_user_key')}</p>}
              </div>
            </div>

            {/* Event Triggers Matrix */}
            <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
              <div>
                <strong className="text-xs font-bold text-zinc-900 dark:text-zinc-200 block">
                  Select Events to Trigger Pushover Alerts:
                </strong>
                <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                  Configure which store events instantly dispatch push notifications to mobile and desktop devices.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 cursor-pointer hover:border-zinc-300 dark:hover:border-white/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(wpSettings.pushover_notify_new_sale ?? 1)}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_notify_new_sale: e.target.checked ? 1 : 0 })}
                    className="rounded text-[#f3aa18] accent-[#f3aa18] mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-zinc-900 dark:text-zinc-200 block font-sans font-semibold text-xs">New Customer Orders</span>
                    <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">Instant notification when a new order is received at checkout</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 cursor-pointer hover:border-zinc-300 dark:hover:border-white/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(wpSettings.pushover_notify_kyc ?? 1)}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_notify_kyc: e.target.checked ? 1 : 0 })}
                    className="rounded text-[#f3aa18] accent-[#f3aa18] mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-zinc-900 dark:text-zinc-200 block font-sans font-semibold text-xs">Customer Reviews & Ratings</span>
                    <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">When customers submit new product reviews with photos</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 cursor-pointer hover:border-zinc-300 dark:hover:border-white/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean((wpSettings as any).pushover_notify_inventory ?? 1)}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_notify_inventory: e.target.checked ? 1 : 0 } as any)}
                    className="rounded text-[#f3aa18] accent-[#f3aa18] mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-zinc-900 dark:text-zinc-200 block font-sans font-semibold text-xs">Low Stock & Inventory Alerts</span>
                    <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">When device skin variations fall below safety inventory threshold</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 cursor-pointer hover:border-zinc-300 dark:hover:border-white/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(wpSettings.pushover_notify_errors ?? 1)}
                    onChange={e => setWpSettings({ ...wpSettings, pushover_notify_errors: e.target.checked ? 1 : 0 })}
                    className="rounded text-[#f3aa18] accent-[#f3aa18] mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-zinc-900 dark:text-zinc-200 block font-sans font-semibold text-xs">Critical System & Sync Errors</span>
                    <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">High-priority alerts for WooCommerce REST API, webhook or payment failures</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex-wrap gap-3">
              <button
                type="button"
                onClick={handleTestPushover}
                disabled={isTestingPushover}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 border border-zinc-200 dark:border-white/10 uppercase tracking-wider cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>{isTestingPushover ? 'Sending Push Alert...' : 'Test Mobile Push Alert'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveRemoteSettings()}
                disabled={isSavingSettings}
                className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Pushover Config</span>
              </button>
            </div>

            {pushoverTestResult && (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-800">
                  <span className="text-zinc-400">Pushover Gateway:</span>
                  <span className={pushoverTestResult.success ? 'text-[#f3aa18] font-bold' : 'text-rose-400 font-bold'}>
                    {pushoverTestResult.success ? `DELIVERED (${pushoverTestResult.latency_ms}ms)` : 'FAILED'}
                  </span>
                </div>
                <p className="text-zinc-300 font-sans">{pushoverTestResult.message}</p>
              </div>
            )}
          </GlassCard>

          {/* Cloudflare CDN & Cache Purge */}
          <GlassCard className="p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <Cloud className="w-4 h-4 text-[#f3aa18]" />
              <strong className="text-sm font-bold text-zinc-900 dark:text-white">
                Cloudflare CDN & Cache Purge
              </strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Cloudflare Zone ID</label>
                <input
                  type="text"
                  value={wpSettings.cloudflare_zone_id || ''}
                  onChange={e => setWpSettings({ ...wpSettings, cloudflare_zone_id: e.target.value })}
                  placeholder="Zone ID for exacoat.com"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Cloudflare Cache API Token</label>
                <div className="relative flex items-center">
                  <input
                    type={showSecrets['cloudflare_api_token'] ? 'text' : 'password'}
                    value={wpSettings.cloudflare_api_token || ''}
                    onChange={e => setWpSettings({ ...wpSettings, cloudflare_api_token: e.target.value })}
                    placeholder={secretPlaceholder('cloudflare_api_token', 'API token with Cache Purge permission')}
                    className="w-full p-2.5 pr-10 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                  />
                  <button type="button" onClick={() => toggleShowSecret('cloudflare_api_token')} className="absolute right-2.5 p-1 text-zinc-400 hover:text-white transition-colors">
                    {showSecrets['cloudflare_api_token'] ? <EyeOff className="w-4 h-4 text-[#f3aa18]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {secretSource('cloudflare_api_token') && <p className="text-[10px] font-mono text-emerald-400">{secretSource('cloudflare_api_token')}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestCloudflare}
                  disabled={isTestingCloudflare}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 border border-zinc-200 dark:border-white/10 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>{isTestingCloudflare ? 'Testing API...' : 'Test Cache API'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePurgeCloudflareCache('manager')}
                  disabled={isPurgingCloudflareCache}
                  title="Purges manager application files (index.html, version.json, plugin zip)"
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 border border-zinc-200 dark:border-white/10 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5 text-purple-400', isPurgingCloudflareCache && 'animate-spin')} />
                  <span>Purge Manager Cache</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePurgeCloudflareCache('all')}
                  disabled={isPurgingCloudflareCache}
                  title="Purges all cached pages and assets across exacoat.com"
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 border border-zinc-200 dark:border-white/10 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5 text-sky-400', isPurgingCloudflareCache && 'animate-spin')} />
                  <span>{isPurgingCloudflareCache ? 'Purging Cache...' : 'Purge All (Zone)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveRemoteSettings()}
                  disabled={isSavingSettings}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Config</span>
                </button>
              </div>
            </div>

            {cloudflareTestResult && (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-800">
                  <span className="text-zinc-400">Cloudflare Cache API:</span>
                  <span className={cloudflareTestResult.success ? 'text-[#f3aa18] font-bold' : 'text-rose-400 font-bold'}>
                    {cloudflareTestResult.success ? `ACTIVE (${cloudflareTestResult.latency_ms}ms)` : 'ERROR'}
                  </span>
                </div>
                {cloudflareTestResult.zone_name && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                    <span>Zone: <strong className="text-white">{cloudflareTestResult.zone_name}</strong></span>
                    {cloudflareTestResult.plan_name && <span className="text-zinc-500 font-mono">Plan: {cloudflareTestResult.plan_name}</span>}
                  </div>
                )}
                <p className="text-zinc-300 font-sans mt-1">{cloudflareTestResult.message}</p>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB: WooCommerce REST API & Data Store */}
      {activeTab === 'database' && (
        <GlassCard className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
                  Decoupled Architecture
                </span>
                <span className="text-xs text-zinc-500 font-mono">100% Native WooCommerce</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-1">
                WooCommerce REST API & Data Store
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Direct integration with exacoat.com. Zero intermediary databases or external sync layers.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRevertMedia}
                isLoading={isRevertingMedia}
                leftIcon={<HardDrive className="w-3.5 h-3.5 text-emerald-400" />}
                title="Revert and consolidate all nested /uploads/Assets/ media files to flat /uploads root"
              >
                Consolidate to /uploads
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTestWcApi}
                isLoading={isTestingWcApi}
                leftIcon={<Activity className="w-3.5 h-3.5 text-[#f3aa18]" />}
              >
                Ping WooCommerce REST API
              </Button>
            </div>
          </div>

          {/* Test Ping Result Banner */}
          {wcApiTestResult && (
            <div className={clsx(
              "p-4 rounded-xl border text-xs font-mono flex items-center justify-between",
              wcApiTestResult.status === 'success' 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              <div className="flex items-center gap-2">
                <span className="font-bold">{wcApiTestResult.status === 'success' ? '✓ Connected:' : '✕ Error:'}</span>
                <span>{wcApiTestResult.message}</span>
              </div>
              {wcApiTestResult.latency && (
                <span className="text-[11px] opacity-80">{wcApiTestResult.latency}ms response</span>
              )}
            </div>
          )}

          {/* WordPress Target Instance Switcher */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span>Target WordPress Instance</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 lowercase">
                    active: {wpBaseUrl}
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                  Point Exacoat Manager to your staging server or live production store. Changes take effect instantly in this browser session.
                </p>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSaveWpUrl('https://staging.exacoat.com')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                    wpBaseUrl === 'https://staging.exacoat.com'
                      ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18] font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400"
                  )}
                >
                  staging.exacoat.com
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveWpUrl('https://exacoat.com')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                    wpBaseUrl === 'https://exacoat.com'
                      ? "bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18] font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400"
                  )}
                >
                  exacoat.com (live)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="url"
                value={wpUrlInput}
                onChange={(e) => setWpUrlInput(e.target.value)}
                placeholder="https://staging.exacoat.com"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
              />
              <button
                type="button"
                onClick={() => handleSaveWpUrl()}
                className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-zinc-950 font-bold text-xs font-mono transition-colors cursor-pointer"
              >
                Apply URL
              </button>
              <button
                type="button"
                onClick={handleResetWpUrl}
                title="Reset to environment variable default"
                className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-mono border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* Core Endpoints Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-2">
              <span className="text-[11px] font-mono text-zinc-400 block uppercase">WooCommerce Core REST v3</span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-[#f3aa18] break-all">{wpBaseUrl}/wp-json/wc/v3</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${wpBaseUrl}/wp-json/wc/v3`, 'wc_v3_url')}
                  className="text-zinc-400 hover:text-white shrink-0 p-1 cursor-pointer"
                >
                  {copiedKey === 'wc_v3_url' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Primary API for order fulfillment, customer profiles, product variations, inventory levels, and sales reports.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-2">
              <span className="text-[11px] font-mono text-zinc-400 block uppercase">Exacoat Core Plugin v1</span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-cyan-400 break-all">{wpBaseUrl}/wp-json/exacoat-core/v1</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${wpBaseUrl}/wp-json/exacoat-core/v1`, 'exacoat_core_url')}
                  className="text-zinc-400 hover:text-white shrink-0 p-1 cursor-pointer"
                >
                  {copiedKey === 'exacoat_core_url' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Backend plugin endpoints for server telemetry, health checks, cache purging, and diagnostic logs.
              </p>
            </div>
          </div>

          {/* Credentials Card */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span>Store Credentials & Authentication</span>
                  {wcKeyInput ? (
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 lowercase">
                      configured
                    </span>
                  ) : (
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 lowercase">
                      not set
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                  Configure WooCommerce REST API keys for order synchronization and operations.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSaveWcCredentials(
                    'ck_c6898072346d5098a584e142d19ab0cbd03700d6',
                    'cs_96cfb9b7614b309919f778686988f7f102de5029'
                  )}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[#f3aa18]/15 border border-[#f3aa18]/40 text-[#f3aa18] hover:bg-[#f3aa18]/25 transition-colors cursor-pointer"
                  title="Fill in the verified staging keys"
                >
                  Pre-fill Staging Keys
                </button>
                <button
                  type="button"
                  onClick={handleClearWcCredentials}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear Keys
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block">
                  Consumer Key (ck_...)
                </label>
                <input
                  type="text"
                  value={wcKeyInput}
                  onChange={(e) => setWcKeyInput(e.target.value)}
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block">
                  Consumer Secret (cs_...)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showWcSecret ? 'text' : 'password'}
                    value={wcSecretInput}
                    onChange={(e) => setWcSecretInput(e.target.value)}
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWcSecret(!showWcSecret)}
                    className="absolute right-2 text-zinc-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showWcSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-zinc-500 font-sans">
                Credentials are saved securely in your local browser storage and used for all direct WooCommerce REST calls.
              </div>
              <button
                type="button"
                onClick={() => handleSaveWcCredentials()}
                className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-zinc-950 font-bold text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Credentials</span>
              </button>
            </div>
          </div>

          {/* Active Data Schemas */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
              Live Store Resource Schemas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1">
                <span className="text-zinc-900 dark:text-white font-bold">/orders</span>
                <p className="text-[11px] text-zinc-400 font-sans">Customer orders, shipping details, device variants and line items.</p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1">
                <span className="text-zinc-900 dark:text-white font-bold">/products/reviews</span>
                <p className="text-[11px] text-zinc-400 font-sans">Verified customer reviews, star ratings (1-5★), and photo uploads.</p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1">
                <span className="text-zinc-900 dark:text-white font-bold">/reports/sales</span>
                <p className="text-[11px] text-zinc-400 font-sans">Monthly & yearly gross sales, order velocity, net store revenue.</p>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
