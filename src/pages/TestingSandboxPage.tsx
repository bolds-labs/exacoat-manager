import React, { useState } from 'react';
import { 
  FlaskConical, 
  CheckCircle2, 
  Mail, 
  Send, 
  RefreshCw, 
  Sparkles, 
  Bot, 
  Activity, 
  Eye,
  Bell,
  RotateCcw
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Tabs } from '../components/ui/Tabs';
import { CustomSelect, SelectOption } from '../components/ui/CustomSelect';
import { useToast } from '../context/ToastContext';
import { 
  sendDirectZeptoMailEmail, 
  previewEmailHtml,
  sendPushoverAlert,
  testPushoverDirect, 
  testCloudflareCacheDirect,
  testGeminiDirect, 
  testOpenAiDirect, 
  pingWordPressPlugin
} from '../lib/wordpressBridge';
import { ALL_EMAIL_TEMPLATES, EMAIL_TEMPLATES_CATALOG } from '../config/emailTemplates';

interface TestingSandboxPageProps {
  onRefreshData?: () => void;
  onNavigate?: (tab: any) => void;
}

export const TestingSandboxPage: React.FC<TestingSandboxPageProps> = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'emails' | 'ai' | 'infra'>('emails');

  // Email Sandbox State
  const [emailEvent, setEmailEvent] = useState<string>(ALL_EMAIL_TEMPLATES[0]?.key || 'order_shipped');
  const [emailRecipient, setEmailRecipient] = useState<string>('customer@exacoat.com');
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<any>(null);

  // AI Sandbox State
  const [aiPrompt, setAiPrompt] = useState('Generate SEO meta title and excerpt for Xiaomi 17T Pro Shadow Black Textured Skin.');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [aiResult, setAiResult] = useState<any>(null);
  const [isRunningAiProbe, setIsRunningAiProbe] = useState(false);

  // Infra Sandbox State
  const [infraResults, setInfraResults] = useState<Record<string, any>>({});
  const [isRunningInfraProbe, setIsRunningInfraProbe] = useState(false);

  const emailTemplateOptions: SelectOption[] = ALL_EMAIL_TEMPLATES.map(t => ({
    value: t.key,
    label: t.name,
    subtitle: `Subject: ${t.subject}`,
    badge: t.badge,
    badgeVariant: 'lime',
  }));

  const activeEmailTemplate = ALL_EMAIL_TEMPLATES.find(t => t.key === emailEvent) || ALL_EMAIL_TEMPLATES[0];

  const handleTestSendEmail = async () => {
    if (!emailRecipient.trim()) {
      showToast('error', 'Recipient Required', 'Please enter a destination email.');
      return;
    }

    setIsSendingEmailTest(true);
    setEmailSendResult(null);

    try {
      const tmplDefaults = activeEmailTemplate.defaults || {};
      const isStorePickupEvent = emailEvent.includes('store_pickup');

      const payloadVars: Record<string, any> = {
        customer_name: 'Alex Tan',
        customer_first_name: 'Alex',
        order_id: '542222',
        order_number: '542222',
        device_name: 'Xiaomi 17T Pro',
        year: String(new Date().getFullYear()),
        ...tmplDefaults,
      };

      if (isStorePickupEvent) {
        payloadVars.is_store_pickup = true;
        payloadVars.courier = '';
        payloadVars.tracking_number = '';
        payloadVars.tracking_url = '';
        payloadVars.shipping_method_name = 'Store Pickup (Summarecon Bekasi)';
        payloadVars.shipping_total = 'Rp 0';
        if (emailEvent === 'customer_order_store_pickup_ready') {
          payloadVars.pickup_ready = true;
        } else if (emailEvent === 'customer_order_store_pickup_completed') {
          payloadVars.pickup_review = true;
        }
      } else {
        payloadVars.tracking_number = payloadVars.tracking_number || 'JNT1234567890';
        payloadVars.courier_name = payloadVars.courier_name || 'J&T Express';
      }

      const res = await sendDirectZeptoMailEmail(
        emailEvent,
        emailRecipient.trim(),
        'Valued Customer',
        payloadVars
      );

      setEmailSendResult(res);
      if (res.success) {
        showToast('success', 'Email Delivered', `Test email dispatched to ${emailRecipient}.`);
      } else {
        showToast('error', 'Dispatch Failed', res.message || 'ZeptoMail returned an error.');
      }
    } catch (e: any) {
      setEmailSendResult({ success: false, error: e.message });
      showToast('error', 'Dispatch Exception', e.message);
    } finally {
      setIsSendingEmailTest(false);
    }
  };

  const handleRunAiProbe = async () => {
    setIsRunningAiProbe(true);
    setAiResult(null);

    try {
      if (aiProvider === 'gemini') {
        const res = await testGeminiDirect(aiPrompt);
        setAiResult(res);
        if (res.success) {
          showToast('success', 'Gemini AI Responded', 'Latency: ' + (res.latencyMs || (res as any).latency_ms || 0) + 'ms');
        } else {
          showToast('error', 'Gemini Error', res.message);
        }
      } else {
        const res = await testOpenAiDirect(aiPrompt);
        setAiResult(res);
        if (res.success) {
          showToast('success', 'OpenAI Responded', 'Latency: ' + (res.latencyMs || (res as any).latency_ms || 0) + 'ms');
        } else {
          showToast('error', 'OpenAI Error', res.message);
        }
      }
    } catch (err: any) {
      setAiResult({ success: false, error: err.message });
      showToast('error', 'AI Probe Error', err.message);
    } finally {
      setIsRunningAiProbe(false);
    }
  };

  const handleRunAllInfraProbes = async () => {
    setIsRunningInfraProbe(true);
    setInfraResults({});
    showToast('info', 'Probing Cloud Infrastructure...', 'Testing all services in parallel');

    const results: Record<string, any> = {};

    // 1. WordPress Plugin Ping
    try {
      const wpRes = await pingWordPressPlugin();
      results.wordpress = wpRes;
    } catch (e: any) {
      results.wordpress = { success: false, message: e.message };
    }

    // 2. Pushover Gateway
    try {
      const pushRes = await testPushoverDirect();
      results.pushover = pushRes;
    } catch (e: any) {
      results.pushover = { success: false, message: e.message };
    }

    // 3. Cloudflare Cache
    try {
      const cfRes = await testCloudflareCacheDirect();
      results.cloudflare_cache = cfRes;
    } catch (e: any) {
      results.cloudflare_cache = { success: false, message: e.message };
    }

    // 4. Gemini AI
    try {
      const geminiRes = await testGeminiDirect('Ping');
      results.gemini = geminiRes;
    } catch (e: any) {
      results.gemini = { success: false, message: e.message };
    }

    // 5. OpenAI
    try {
      const openaiRes = await testOpenAiDirect('Ping');
      results.openai = openaiRes;
    } catch (e: any) {
      results.openai = { success: false, message: e.message };
    }

    setInfraResults(results);
    setIsRunningInfraProbe(false);
    showToast('info', 'Infra Probes Complete', 'All platform integrations tested.');
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-lime-500/10 border border-lime-500/20 text-[#f3aa18]">
              <FlaskConical className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Testing & Sandbox Simulator
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Execute authentic integration simulations: Transactional Emails ➔ AI Engines ➔ Webhooks ➔ Cloud Infrastructure
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEmailSendResult(null);
              setAiResult(null);
              setInfraResults({});
              showToast('info', 'Reset', 'Cleared sandbox output.');
            }}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset Logs</span>
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="overflow-x-auto no-scrollbar pb-1 -mb-1">
        <Tabs
          tabs={[
            { id: 'emails', label: `Transactional Emails (${ALL_EMAIL_TEMPLATES.length})`, icon: Mail },
            { id: 'ai', label: 'AI Diagnostic Probes', icon: Bot },
            { id: 'infra', label: 'Cloud & Infrastructure Suite', icon: Activity },
          ]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as any)}
        />
      </div>

      {/* TAB 1: TRANSACTIONAL EMAILS */}
      {activeTab === 'emails' && (
        <GlassCard className="p-6 md:p-8 space-y-6">
          <div className="border-b border-zinc-200 dark:border-white/[0.06] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                ZeptoMail Live Email Sandbox ({ALL_EMAIL_TEMPLATES.length} Templates)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Directly preview and test transactional email templates with live dispatch telemetry
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="space-y-4">
              <CustomSelect
                label="Select Email Event Template:"
                value={emailEvent}
                onChange={setEmailEvent}
                options={emailTemplateOptions}
                searchable={true}
                placeholder="Search templates..."
              />

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 font-sans">
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-white">{activeEmailTemplate?.name}</strong>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-lime-500/15 text-[#f3aa18] font-bold border border-lime-500/30">
                    {activeEmailTemplate?.badge}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Subject: <span className="text-zinc-200">{activeEmailTemplate?.subject}</span>
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {activeEmailTemplate?.trigger}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block font-mono">
                  Recipient Email Address:
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={e => setEmailRecipient(e.target.value)}
                  placeholder="customer@exacoat.com"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-lime-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setIsPreviewLoading(true);
                    const tmpl = ALL_EMAIL_TEMPLATES.find(t => t.key === emailEvent);
                    const res = await previewEmailHtml(emailEvent, tmpl?.defaults || {});
                    setIsPreviewLoading(false);
                    if (res.success && res.html) {
                      const win = window.open('', '_blank');
                      if (win) {
                        win.document.write(res.html);
                        win.document.close();
                      }
                    } else {
                      showToast('error', 'Preview Failed', res.error || 'Could not load HTML preview');
                    }
                  }}
                  disabled={isPreviewLoading}
                  className="py-3 px-4 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>{isPreviewLoading ? 'Rendering...' : 'Browser HTML Preview'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestSendEmail}
                  disabled={isSendingEmailTest}
                  className="py-3 px-4 rounded-xl bg-[#f3aa18] hover:bg-[#f5b838] text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingEmailTest ? 'Sending...' : 'Dispatch Live Email'}</span>
                </button>
              </div>
            </div>

            {/* Email Dispatch Result Telemetry */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    ZeptoMail Dispatch Telemetry
                  </span>
                  {emailSendResult && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      emailSendResult.success ? 'bg-lime-500/20 text-[#f3aa18]' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {emailSendResult.success ? 'HTTP 200 OK' : 'ERROR'}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-black/60 border border-white/[0.04] font-mono text-[11px] space-y-1.5 overflow-x-auto custom-scrollbar min-h-[160px]">
                  {emailSendResult ? (
                    <pre className="text-zinc-300 whitespace-pre-wrap">
                      {JSON.stringify(emailSendResult, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 italic py-12">
                      Ready. Trigger a live email dispatch to view delivery telemetry.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 2: AI DIAGNOSTIC PROBES */}
      {activeTab === 'ai' && (
        <GlassCard className="p-6 md:p-8 space-y-6">
          <div className="border-b border-zinc-200 dark:border-white/[0.06] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                AI Diagnostic & LLM Probes
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Verify Google Gemini 2.5 Flash and OpenAI GPT-4o endpoints with live prompt execution
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiProvider('gemini')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    aiProvider === 'gemini'
                      ? 'bg-lime-500/10 border-lime-500/40 text-[#f3aa18]'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Google Gemini 2.5 Flash
                </button>
                <button
                  type="button"
                  onClick={() => setAiProvider('openai')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    aiProvider === 'openai'
                      ? 'bg-lime-500/10 border-lime-500/40 text-[#f3aa18]'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
                  }`}
                >
                  OpenAI GPT-4o
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block font-mono">
                  Test Prompt:
                </label>
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-sans text-zinc-900 dark:text-white focus:outline-hidden focus:border-lime-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunAiProbe}
                disabled={isRunningAiProbe || !aiPrompt.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#f3aa18] hover:bg-[#f5b838] text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isRunningAiProbe ? 'Running AI Inference...' : `Execute Probe via ${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}`}</span>
              </button>
            </div>

            {/* AI Output Box */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Inference Output
                </span>
                {aiResult?.latency_ms && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Latency: {aiResult.latency_ms}ms
                  </span>
                )}
              </div>
              <div className="p-3 rounded-xl bg-black/60 border border-white/[0.04] font-mono text-[11px] space-y-1 overflow-x-auto min-h-[160px]">
                {aiResult ? (
                  <pre className="text-zinc-300 whitespace-pre-wrap">
                    {aiResult.text || aiResult.response || JSON.stringify(aiResult, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-600 italic py-12">
                    Execute a probe to inspect raw model completion.
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 3: INFRASTRUCTURE SUITE */}
      {activeTab === 'infra' && (
        <GlassCard className="p-6 md:p-8 space-y-6">
          <div className="border-b border-zinc-200 dark:border-white/[0.06] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Cloud & Edge Infrastructure Diagnostic Suite
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Verify WordPress REST bridge, Pushover gateway, Cloudflare Cache, and LLM APIs
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAllInfraProbes}
              disabled={isRunningInfraProbe}
              className="px-4 py-2.5 rounded-xl bg-[#f3aa18] text-zinc-950 font-bold text-xs flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningInfraProbe ? 'animate-spin' : ''}`} />
              <span>{isRunningInfraProbe ? 'Probing...' : 'Run All Probes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* 1. WordPress REST Plugin */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">WordPress Plugin</span>
                {infraResults.wordpress && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    infraResults.wordpress.success ? 'bg-lime-500/20 text-[#f3aa18]' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {infraResults.wordpress.success ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Tests /wp-json/exacoat-core/v1/ping endpoint
              </p>
              {infraResults.wordpress && (
                <p className="text-[10px] text-zinc-500">
                  {infraResults.wordpress.message || (infraResults.wordpress.success ? 'Online' : 'Offline')}
                </p>
              )}
            </div>

            {/* 2. Pushover Gateway */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Pushover Gateway</span>
                {infraResults.pushover && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    infraResults.pushover.success ? 'bg-lime-500/20 text-[#f3aa18]' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {infraResults.pushover.success ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Tests mobile push notification delivery
              </p>
              {infraResults.pushover && (
                <p className="text-[10px] text-zinc-500">
                  {infraResults.pushover.message || (infraResults.pushover.success ? 'Connected' : 'Error')}
                </p>
              )}
            </div>

            {/* 3. Cloudflare Cache */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Cloudflare Cache</span>
                {infraResults.cloudflare_cache && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    infraResults.cloudflare_cache.success ? 'bg-lime-500/20 text-[#f3aa18]' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {infraResults.cloudflare_cache.success ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Tests edge cache purge API response
              </p>
              {infraResults.cloudflare_cache && (
                <p className="text-[10px] text-zinc-500">
                  {infraResults.cloudflare_cache.message || (infraResults.cloudflare_cache.success ? 'Operational' : 'Error')}
                </p>
              )}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
