import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchShopeeSettingsDirect,
  saveShopeeSettingsDirect,
  getShopeeAuthUrlDirect,
  ShopeeSettings,
} from '../../lib/wordpressBridge';
import {
  Store,
  KeyRound,
  Globe,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const ShopeeSettingsModal: React.FC<ShopeeSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAuth, setIsGeneratingAuth] = useState(false);

  // Form State
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [testPartnerId, setTestPartnerId] = useState<number>(1244885);
  const [testPartnerKey, setTestPartnerKey] = useState<string>('');
  const [testPushPartnerKey, setTestPushPartnerKey] = useState<string>('');
  const [livePartnerId, setLivePartnerId] = useState<number>(2011551);
  const [livePartnerKey, setLivePartnerKey] = useState<string>('');
  const [livePushPartnerKey, setLivePushPartnerKey] = useState<string>('');
  const [shopId, setShopId] = useState<number>(227918647);
  const [shopName, setShopName] = useState<string>('');

  // Status State
  const [settings, setSettings] = useState<ShopeeSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    fetchShopeeSettingsDirect()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.settings) {
          setSettings(res.settings);
          setEnvironment(res.settings.environment || 'sandbox');
          setTestPartnerId(res.settings.test_partner_id || 1244885);
          setLivePartnerId(res.settings.live_partner_id || 2011551);
          setShopId(res.settings.shop_id || 227918647);
          setShopName(res.settings.shop_name || '');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast('error', 'Failed to load Shopee settings', err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, showToast]);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    showToast('info', 'Copied to clipboard', text);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        environment,
        test_partner_id: Number(testPartnerId),
        live_partner_id: Number(livePartnerId),
        shop_id: Number(shopId),
        shop_name: shopName.trim(),
      };

      if (testPartnerKey.trim()) {
        payload.test_partner_key = testPartnerKey.trim();
      }
      if (testPushPartnerKey.trim()) {
        payload.test_push_partner_key = testPushPartnerKey.trim();
      }
      if (livePartnerKey.trim()) {
        payload.live_partner_key = livePartnerKey.trim();
      }
      if (livePushPartnerKey.trim()) {
        payload.live_push_partner_key = livePushPartnerKey.trim();
      }

      const res = await saveShopeeSettingsDirect(payload);
      if (res.success) {
        showToast('success', 'Shopee Settings Saved', 'Configuration updated successfully.');
        if (res.settings) {
          setSettings(res.settings);
        }
        setTestPartnerKey('');
        setTestPushPartnerKey('');
        setLivePartnerKey('');
        setLivePushPartnerKey('');
        onSettingsSaved?.();
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not update settings.');
      }
    } catch (err: any) {
      showToast('error', 'Error Saving Settings', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAuthUrl = async () => {
    setIsGeneratingAuth(true);
    try {
      const res = await getShopeeAuthUrlDirect();
      if (res.success && res.auth_url) {
        window.open(res.auth_url, '_blank', 'noopener,noreferrer');
        showToast(
          'info',
          'Shopee Authorization Opened',
          'Complete the authorization flow in the new browser window.'
        );
      } else {
        showToast('error', 'Failed to generate Auth URL', res.error || 'Check your Partner ID and Key.');
      }
    } catch (err: any) {
      showToast('error', 'Authorization Error', err.message);
    } finally {
      setIsGeneratingAuth(false);
    }
  };

  const testRedirectDomain = 'https://manager.exacoat.com';
  const callbackUrl = settings?.redirect_url || 'https://manager.exacoat.com/shopee/callback';
  const pushCallbackUrl = settings?.push_callback_url || 'https://exacoat.com/wp-json/exacoat-core/v1/shopee/webhook';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shopee Open Platform API v2 Configuration"
      maxWidth="2xl"
    >
      <div className="space-y-6 font-sans text-neutral-200">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
            <p className="text-sm">Loading Shopee Open API settings...</p>
          </div>
        ) : (
          <>
            {/* Status Banner */}
            <div className="p-4 rounded-xl border border-white/10 bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center border',
                    settings?.is_connected
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  )}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {settings?.shop_name || 'Exacoat Shopee'}
                    </span>
                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                        environment === 'sandbox'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      )}
                    >
                      {environment === 'sandbox' ? 'Sandbox Mode' : 'Production Live'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Shop ID: <span className="font-mono text-neutral-300">{settings?.shop_id || shopId}</span>
                    {settings?.token_expires_at ? (
                      <span className="ml-2 text-emerald-400">
                        Token active (expires {new Date(settings.token_expires_at * 1000).toLocaleDateString()})
                      </span>
                    ) : (
                      <span className="ml-2 text-neutral-400">(Awaiting OAuth authorization)</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAuthUrl}
                disabled={isGeneratingAuth}
                className="px-3.5 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                {isGeneratingAuth ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                <span>Connect / Reauthorize Shop</span>
              </button>
            </div>

            {/* Environment Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                API Environment
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnvironment('sandbox')}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1',
                    environment === 'sandbox'
                      ? 'border-orange-500/50 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-neutral-900/40 text-neutral-400 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-300">Sandbox Test-Stable</span>
                    {environment === 'sandbox' && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Endpoint: partner.test-stable.shopeemobile.com
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEnvironment('live')}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1',
                    environment === 'live'
                      ? 'border-orange-500/50 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-neutral-900/40 text-neutral-400 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Live Production</span>
                    {environment === 'live' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Endpoint: partner.shopeemobile.com
                  </span>
                </button>
              </div>
            </div>

            {/* Credentials Fields based on active environment */}
            <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                  <span>
                    {environment === 'sandbox' ? 'Sandbox API Credentials' : 'Live Production API Credentials'}
                  </span>
                </h3>
              </div>

              {environment === 'sandbox' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Test Partner ID</label>
                      <input
                        type="number"
                        value={testPartnerId}
                        onChange={(e) => setTestPartnerId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500"
                        placeholder="1244885"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Sandbox Shop ID</label>
                      <input
                        type="number"
                        value={shopId}
                        onChange={(e) => setShopId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500"
                        placeholder="227918647"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Test API Key (Leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        value={testPartnerKey}
                        onChange={(e) => setTestPartnerKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        placeholder={settings?.has_test_key ? 'Key is configured' : 'Enter test API key'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Test Push Partner Key (Webhooks)
                      </label>
                      <input
                        type="password"
                        value={testPushPartnerKey}
                        onChange={(e) => setTestPushPartnerKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        placeholder={settings?.has_test_push_key ? 'Push key configured' : 'Enter test push key'}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Live Partner ID</label>
                      <input
                        type="number"
                        value={livePartnerId}
                        onChange={(e) => setLivePartnerId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500"
                        placeholder="2011551"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Production Shop ID</label>
                      <input
                        type="number"
                        value={shopId}
                        onChange={(e) => setShopId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500"
                        placeholder="Live Shop ID"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Live API Key (Leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        value={livePartnerKey}
                        onChange={(e) => setLivePartnerKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        placeholder={settings?.has_live_key ? 'Key is configured' : 'Enter live API key'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Live Push Partner Key (Webhooks)
                      </label>
                      <input
                        type="password"
                        value={livePushPartnerKey}
                        onChange={(e) => setLivePushPartnerKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                        placeholder={settings?.has_live_push_key ? 'Push key configured' : 'Enter live push key'}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Shopee Open Platform Redirect Domain Requirements */}
            <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-neutral-900/40 text-xs">
              <div className="flex items-center gap-2 text-neutral-300 font-semibold">
                <Globe className="w-3.5 h-3.5 text-orange-400" />
                <span>Shopee Console Integration Endpoints</span>
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Configure these endpoints in your Shopee Open Platform Console for OAuth authorization and real-time push webhooks:
              </p>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-white/10">
                <div>
                  <span className="text-[10px] text-neutral-400 block">App Settings: Test / Live Redirect URL Domain</span>
                  <span className="font-mono text-white text-xs">{testRedirectDomain}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(testRedirectDomain, 'domain')}
                  className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Domain"
                >
                  {copiedField === 'domain' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-white/10">
                <div>
                  <span className="text-[10px] text-neutral-400 block">App Settings: OAuth Callback URL</span>
                  <span className="font-mono text-neutral-300 text-xs">{callbackUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(callbackUrl, 'callback')}
                  className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Callback URL"
                >
                  {copiedField === 'callback' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-white/10">
                <div>
                  <span className="text-[10px] text-neutral-400 block">Push Mechanism: Test / Live Call Back URL</span>
                  <span className="font-mono text-orange-300 text-xs">{pushCallbackUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(pushCallbackUrl, 'webhook')}
                  className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Webhook URL"
                >
                  {copiedField === 'webhook' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Sandbox Test Account Instructions */}
            {environment === 'sandbox' && (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-neutral-300 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sandbox Test Account Information</span>
                </div>
                <p className="text-neutral-400 text-[11px]">
                  When authorizing on the test platform, sign in with your Sandbox Seller credentials:
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono text-[11px]">
                  <div className="p-1.5 rounded bg-black/40 border border-white/5">
                    <span className="text-neutral-400 text-[10px] block">Username:</span>
                    <span className="text-neutral-200">SANDBOX.942af0487120eda0d689</span>
                  </div>
                  <div className="p-1.5 rounded bg-black/40 border border-white/5">
                    <span className="text-neutral-400 text-[10px] block">Password:</span>
                    <span className="text-neutral-200">2cf04836edd4191f</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Configuration</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
