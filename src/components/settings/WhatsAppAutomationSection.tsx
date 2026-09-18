import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  fetchWhatsAppSettings,
  saveWhatsAppSettings,
  testWhatsAppMessage,
  fetchBcaWebhookStatus,
  fetchTrackingPoolInventory,
  WhatsAppSettings,
  BcaWebhookStatus,
  TrackingPoolInventory,
} from '../../lib/wordpressBridge';
import { TrackingPoolModal } from '../orders/TrackingPoolModal';
import {
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Package,
  Layers,
  ShieldCheck,
  SendHorizontal,
  Bot,
} from 'lucide-react';
import clsx from 'clsx';

export const WhatsAppAutomationSection: React.FC = () => {
  const { showToast } = useToast();

  // WhatsApp State
  const [waSettings, setWaSettings] = useState<WhatsAppSettings>({
    enabled: true,
    phone_number_id: '',
    access_token: '',
    business_account_id: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    telegram_alerts_enabled: false,
    events: {
      processing: true,
      completed: true,
      smb_ready: true,
      smb_picked: true,
    },
  });

  const [isLoadingWa, setIsLoadingWa] = useState(false);
  const [isSavingWa, setIsSavingWa] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [testTemplate, setTestTemplate] = useState('notif_order_confirmed');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // BCA Webhook State
  const [bcaStatus, setBcaStatus] = useState<BcaWebhookStatus | null>(null);
  const [isLoadingBca, setIsLoadingBca] = useState(false);

  // Pool State
  const [poolInventory, setPoolInventory] = useState<TrackingPoolInventory | null>(null);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  // Copied helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('info', 'Copied', 'Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadData = useCallback(async () => {
    setIsLoadingWa(true);
    setIsLoadingBca(true);
    try {
      const [waRes, bcaRes, poolRes] = await Promise.all([
        fetchWhatsAppSettings(),
        fetchBcaWebhookStatus(),
        fetchTrackingPoolInventory(),
      ]);

      if (waRes.success && waRes.settings) {
        setWaSettings(waRes.settings);
      }
      if (bcaRes.success && bcaRes.status) {
        setBcaStatus(bcaRes.status);
      }
      if (poolRes.success && poolRes.inventory) {
        setPoolInventory(poolRes.inventory);
      }
    } catch {
      showToast('error', 'Sync Error', 'Failed to load automation settings');
    } finally {
      setIsLoadingWa(false);
      setIsLoadingBca(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveWhatsApp = async () => {
    setIsSavingWa(true);
    try {
      const res = await saveWhatsAppSettings(waSettings);
      if (res.success) {
        showToast('success', 'Configuration Saved', 'WhatsApp configuration saved');
        if (res.settings) setWaSettings(res.settings);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message || 'Error saving settings');
    } finally {
      setIsSavingWa(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      showToast('warning', 'Missing Phone', 'Please enter a destination phone number with country code');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await testWhatsAppMessage(testPhone.trim(), testTemplate);
      if (res.success) {
        setTestResult({
          success: true,
          message: `Dispatched successfully. Message ID: ${res.message_id || 'OK'}`,
        });
        showToast('success', 'Dispatched', 'Test message dispatched');
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to dispatch test message. Check Meta Cloud API credentials.',
        });
        showToast('error', 'Test Failed', res.error || 'Test failed');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error communicating with WhatsApp engine.',
      });
      showToast('error', 'Network Error', 'Test failed');
    } finally {
      setIsSendingTest(false);
    }
  };

  const isWaConfigured = Boolean(waSettings.phone_number_id && waSettings.access_token);
  const jneCount = poolInventory?.jne?.available ?? 0;
  const sicepatCount = poolInventory?.sicepat?.available ?? 0;

  return (
    <div className="space-y-6">
      {/* SECTION 1: WHATSAPP CLOUD API */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  WhatsApp Cloud API Service
                </h3>
                <span
                  className={clsx(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                    waSettings.enabled && isWaConfigured
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isWaConfigured
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  )}
                >
                  {waSettings.enabled && isWaConfigured
                    ? 'Active'
                    : isWaConfigured
                    ? 'Ready'
                    : 'Awaiting Credentials'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Direct Meta Graph API v20.0 engine for customer transactional messaging. Replaces legacy n8n workflows.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadData}
            isLoading={isLoadingWa}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Status
          </Button>
        </div>

        {/* Master Enable Checkbox */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">
              WhatsApp Notifications Enabled
            </div>
            <div className="text-[11px] text-zinc-500">
              Dispatches automated order confirmation, shipment, and pickup notifications to customer phone numbers.
            </div>
          </div>
          <input
            type="checkbox"
            checked={waSettings.enabled}
            onChange={(e) => setWaSettings({ ...waSettings, enabled: e.target.checked })}
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
        </div>

        {/* Credentials Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phone ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Phone Number ID
            </label>
            <input
              type="text"
              value={waSettings.phone_number_id}
              onChange={(e) => setWaSettings({ ...waSettings, phone_number_id: e.target.value })}
              placeholder="e.g. 1029384756..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Obtained from Meta App Dashboard &gt; WhatsApp &gt; API Setup.
            </p>
          </div>

          {/* Access Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Meta Permanent Access Token
              </label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-zinc-500 hover:text-white text-[11px] flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showToken ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <input
              type={showToken ? 'text' : 'password'}
              value={waSettings.access_token}
              onChange={(e) => setWaSettings({ ...waSettings, access_token: e.target.value })}
              placeholder="EAAG..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              System user access token with <code className="text-zinc-400">whatsapp_business_messaging</code> permission.
            </p>
          </div>
        </div>

        {/* Business Account ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            WhatsApp Business Account ID (Optional)
          </label>
          <input
            type="text"
            value={waSettings.business_account_id}
            onChange={(e) => setWaSettings({ ...waSettings, business_account_id: e.target.value })}
            placeholder="e.g. 2938471029..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>

        {/* Event Toggles */}
        <div className="pt-2 border-t border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Active Notification Event Triggers
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={waSettings.events.processing}
                onChange={(e) =>
                  setWaSettings({
                    ...waSettings,
                    events: { ...waSettings.events, processing: e.target.checked },
                  })
                }
                className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
              />
              <div className="text-xs">
                <div className="font-bold text-white">Order Confirmed</div>
                <div className="text-[11px] text-zinc-400">
                  Sends <code className="text-amber-400">notif_order_confirmed</code> on payment confirmed. Warranty and Redeem orders are automatically detected and bypassed with an internal note.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={waSettings.events.completed}
                onChange={(e) =>
                  setWaSettings({
                    ...waSettings,
                    events: { ...waSettings.events, completed: e.target.checked },
                  })
                }
                className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
              />
              <div className="text-xs">
                <div className="font-bold text-white">Order Shipped</div>
                <div className="text-[11px] text-zinc-400">
                  Sends <code className="text-amber-400">notif_order_completed</code> with tracking URL. Dispatches <code className="text-amber-400">notif_order_warranty_redeem</code> for warranty replacements.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={waSettings.events.smb_ready}
                onChange={(e) =>
                  setWaSettings({
                    ...waSettings,
                    events: { ...waSettings.events, smb_ready: e.target.checked },
                  })
                }
                className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
              />
              <div className="text-xs">
                <div className="font-bold text-white">SMB Ready for Pickup</div>
                <div className="text-[11px] text-zinc-400">
                  Sends <code className="text-amber-400">notif_order_pickup_smb</code> when order status changes to <code className="text-zinc-300">smb-ready</code>.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={waSettings.events.smb_picked}
                onChange={(e) =>
                  setWaSettings({
                    ...waSettings,
                    events: { ...waSettings.events, smb_picked: e.target.checked },
                  })
                }
                className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
              />
              <div className="text-xs">
                <div className="font-bold text-white">SMB Picked Up</div>
                <div className="text-[11px] text-zinc-400">
                  Sends <code className="text-amber-400">notif_order_picked_up_all</code> when pickup is finalized.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Telegram Fallback Alerts */}
        <div className="pt-2 border-t border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Telegram Operations Fallback Alerts
              </h4>
            </div>
            <input
              type="checkbox"
              checked={waSettings.telegram_alerts_enabled}
              onChange={(e) =>
                setWaSettings({ ...waSettings, telegram_alerts_enabled: e.target.checked })
              }
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-zinc-400">
                Telegram Bot Token
              </label>
              <input
                type="text"
                value={waSettings.telegram_bot_token}
                onChange={(e) => setWaSettings({ ...waSettings, telegram_bot_token: e.target.value })}
                placeholder="bot123456:ABC..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-zinc-400">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={waSettings.telegram_chat_id}
                onChange={(e) => setWaSettings({ ...waSettings, telegram_chat_id: e.target.value })}
                placeholder="-100123456..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={handleSaveWhatsApp}
            isLoading={isSavingWa}
            className="px-6"
          >
            Save WhatsApp Configuration
          </Button>
        </div>
      </GlassCard>

      {/* SECTION 2: LIVE TEST DISPATCHER */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SendHorizontal className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Live WhatsApp Test Dispatcher
          </h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Verify your Meta Cloud API connection by sending a real test message to any destination phone number.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Destination phone with country code: 628123456789"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={testTemplate}
              onChange={(e) => setTestTemplate(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white focus:border-amber-500/50 focus:outline-none"
            >
              <option value="notif_order_confirmed">notif_order_confirmed</option>
              <option value="notif_order_completed">notif_order_completed</option>
              <option value="notif_order_warranty_redeem">notif_order_warranty_redeem</option>
              <option value="notif_order_pickup_smb">notif_order_pickup_smb</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs">
            {testResult && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold',
                  testResult.success
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                )}
              >
                {testResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{testResult.message}</span>
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendTest}
            isLoading={isSendingTest}
            leftIcon={<Send className="w-3.5 h-3.5 text-amber-400" />}
          >
            Send Test Message
          </Button>
        </div>
      </GlassCard>

      {/* SECTION 3: TRACKING POOL QUICK STATUS */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Tracking Number Inventory Pool
            </h3>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsPoolModalOpen(true)}
            leftIcon={<Layers className="w-3.5 h-3.5 text-amber-400" />}
          >
            Manage Pool &amp; Restock
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="text-[10px] font-bold uppercase text-zinc-500">JNE Express</div>
            <div className="text-xl font-extrabold text-white mt-1">{jneCount}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Available for auto-resi</div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="text-[10px] font-bold uppercase text-zinc-500">SiCepat</div>
            <div className="text-xl font-extrabold text-white mt-1">{sicepatCount}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Available for auto-resi</div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="text-[10px] font-bold uppercase text-zinc-500">POS Indonesia</div>
            <div className="text-xl font-extrabold text-zinc-400 mt-1">Manual</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Flagged for manual entry</div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="text-[10px] font-bold uppercase text-zinc-500">Goorita Send</div>
            <div className="text-xl font-extrabold text-zinc-400 mt-1">Manual</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Flagged for manual entry</div>
          </div>
        </div>
      </GlassCard>

      {/* SECTION 4: BCA PAYMENT WEBHOOK & UNMATCHED MUTATIONS */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              BCA Automated Payment Webhook
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
            Active Endpoint
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 flex-wrap gap-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Webhook Listener URL
            </span>
            <span className="text-xs font-mono text-amber-400">
              {bcaStatus?.webhook_url || '/wp-json/exacoat-core/v1/bca-webhook'}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                bcaStatus?.webhook_url || 'https://exacoat.com/wp-json/exacoat-core/v1/bca-webhook',
                'bca_url'
              )
            }
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
          >
            {copiedKey === 'bca_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy URL</span>
          </button>
        </div>

        {/* Unmatched Mutations Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">
              Unmatched Mutations Queue ({bcaStatus?.unmatched_count ?? 0})
            </span>
            <span className="text-[11px] text-zinc-500">
              Incoming bank transfers without corresponding order kode unik
            </span>
          </div>

          {(!bcaStatus?.unmatched_mutations || bcaStatus.unmatched_mutations.length === 0) ? (
            <div className="py-6 text-center text-xs text-zinc-500 rounded-xl border border-zinc-800/60 bg-zinc-950/30">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1.5 opacity-80" />
              <span>Queue is clear: All received BCA mutations successfully matched to orders.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {bcaStatus.unmatched_mutations.map((mut, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/30">
                      <td className="py-2.5 px-3 text-zinc-500 text-[11px] font-mono">
                        {mut.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400 font-mono">
                        Rp {mut.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-300">
                        {mut.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Tracking Pool Modal */}
      <TrackingPoolModal
        isOpen={isPoolModalOpen}
        onClose={() => setIsPoolModalOpen(false)}
        onInventoryChanged={loadData}
      />
    </div>
  );
};
