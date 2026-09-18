import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchTikTokSettingsDirect,
  saveTikTokSettingsDirect,
  getTikTokAuthUrlDirect,
  TikTokSettings,
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
  Radio,
} from 'lucide-react';
import { clsx } from 'clsx';

interface TikTokSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const TikTokSettingsModal: React.FC<TikTokSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAuth, setIsGeneratingAuth] = useState(false);

  // Form State
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('live');
  const [serviceId, setServiceId] = useState<string>('7686433028542351124');
  const [appKey, setAppKey] = useState<string>('');
  const [appSecret, setAppSecret] = useState<string>('');
  const [shopCipher, setShopCipher] = useState<string>('');
  const [shopName, setShopName] = useState<string>('Exacoat TikTok Shop');

  // Status State
  const [settings, setSettings] = useState<TikTokSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    fetchTikTokSettingsDirect()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.settings) {
          setSettings(res.settings);
          setEnvironment(res.settings.environment || 'live');
          setServiceId(res.settings.service_id || '7686433028542351124');
          setAppKey(res.settings.app_key || '');
          setShopCipher(res.settings.shop_cipher || '');
          setShopName(res.settings.shop_name || 'Exacoat TikTok Shop');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast('error', 'Failed to load TikTok settings', err.message);
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
        service_id: serviceId.trim(),
        app_key: appKey.trim(),
        shop_cipher: shopCipher.trim(),
        shop_name: shopName.trim(),
      };

      if (appSecret.trim()) {
        payload.app_secret = appSecret.trim();
      }

      const res = await saveTikTokSettingsDirect(payload);
      if (res.success) {
        showToast('success', 'TikTok settings updated', 'API parameters saved successfully.');
        setAppSecret('');
        onSettingsSaved?.();
        // Refresh local settings display
        const refreshed = await fetchTikTokSettingsDirect();
        if (refreshed.success && refreshed.settings) {
          setSettings(refreshed.settings);
        }
      } else {
        showToast('error', 'Failed to save settings', res.error || 'Server error');
      }
    } catch (err: any) {
      showToast('error', 'Save failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectAuth = async () => {
    setIsGeneratingAuth(true);
    try {
      const res = await getTikTokAuthUrlDirect();
      if (res.success && res.auth_url) {
        // Open TikTok seller authorization portal in popup window
        const popup = window.open(res.auth_url, 'TikTokAuth', 'width=800,height=750,scrollbars=yes');
        if (!popup) {
          window.location.href = res.auth_url;
        } else {
          showToast('info', 'Authorization window opened', 'Complete consent in the TikTok popup.');
        }
      } else {
        showToast('error', 'Could not start authorization', res.error || 'Check Service ID and App Key.');
      }
    } catch (err: any) {
      showToast('error', 'Authorization failed', err.message);
    } finally {
      setIsGeneratingAuth(false);
    }
  };

  const redirectUrl = settings?.redirect_url || 'https://manager.exacoat.com/tiktok/callback';
  const webhookUrl = settings?.webhook_url || 'https://exacoat.com/wp-json/exacoat-core/v1/tiktok/webhook';
  const partnerUrl = `https://partner.tiktokshop.com/service/gather?service_id=${serviceId || '7686433028542351124'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TikTok Shop Open Platform Settings">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 text-sm">
        {/* Header Summary */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/60 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold font-mono">
              TT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  {settings?.shop_name || 'TikTok Shop Integration'}
                </span>
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase',
                    settings?.is_connected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  )}
                >
                  {settings?.is_connected ? 'Connected' : 'Not Linked'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Service ID: <span className="font-mono text-neutral-300">{serviceId}</span>
              </p>
            </div>
          </div>

          <a
            href={partnerUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <span>Partner Center</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
        </div>

        {/* Environment Selector */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            API Environment
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEnvironment('live')}
              className={clsx(
                'p-3 rounded-xl border text-left transition-all cursor-pointer',
                environment === 'live'
                  ? 'bg-rose-500/10 border-rose-500/40 text-white shadow-sm'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:border-white/10'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white">Production (Live)</span>
                <Radio className={clsx('w-3.5 h-3.5', environment === 'live' ? 'text-rose-400' : 'text-neutral-600')} />
              </div>
              <p className="text-[11px] text-neutral-400">
                Official TikTok store order and courier fulfillment.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setEnvironment('sandbox')}
              className={clsx(
                'p-3 rounded-xl border text-left transition-all cursor-pointer',
                environment === 'sandbox'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:border-white/10'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white">Test / Sandbox</span>
                <Radio className={clsx('w-3.5 h-3.5', environment === 'sandbox' ? 'text-amber-400' : 'text-neutral-600')} />
              </div>
              <p className="text-[11px] text-neutral-400">
                Sandbox environment for testing API calls safely.
              </p>
            </button>
          </div>
        </div>

        {/* Partner Center Credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
              TikTok Partner Credentials
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Service ID</label>
              <input
                type="text"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                placeholder="7686433028542351124"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-100 text-xs font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">App Key</label>
              <input
                type="text"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="Enter App Key from Partner Center"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-100 text-xs font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              App Secret
              {settings?.has_secret && (
                <span className="ml-2 text-[10px] text-emerald-400 font-mono">
                  (Configured: {settings.app_secret})
                </span>
              )}
            </label>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={settings?.has_secret ? 'Leave blank to keep existing secret' : 'Paste App Secret from Partner Center'}
              className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-100 text-xs font-mono focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Shop Cipher / Open ID</label>
              <input
                type="text"
                value={shopCipher}
                onChange={(e) => setShopCipher(e.target.value)}
                placeholder="Auto-populated upon authorization"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-100 text-xs font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Store Display Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Exacoat TikTok Shop"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-100 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Callback and Webhook URLs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
              Callback and Webhook Configuration
            </h4>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              OAuth Redirect URL (Copy to TikTok Partner Center)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={redirectUrl}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900/50 border border-white/10 text-neutral-400 text-xs font-mono select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(redirectUrl, 'redirect')}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs flex items-center gap-1 shrink-0"
              >
                {copiedField === 'redirect' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Webhook Event URL (Push Notifications)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900/50 border border-white/10 text-neutral-400 text-xs font-mono select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'webhook')}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs flex items-center gap-1 shrink-0"
              >
                {copiedField === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleConnectAuth}
            disabled={isGeneratingAuth || !appKey}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-500/20"
          >
            {isGeneratingAuth ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Store className="w-4 h-4" />
            )}
            <span>Connect TikTok Shop</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />}
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
