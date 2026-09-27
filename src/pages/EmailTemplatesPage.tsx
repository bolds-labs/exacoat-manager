import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { CustomSelect, SelectOption } from '../components/ui/CustomSelect';
import { ALL_EMAIL_TEMPLATES, EMAIL_TEMPLATES_CATALOG } from '../config/emailTemplates';
import { 
  Mail, 
  Send, 
  Eye, 
  EyeOff, 
  Save, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Lock, 
  Clock, 
  Layers, 
  ExternalLink,
  RotateCw,
  AlertCircle 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tabs } from '../components/ui/Tabs';
import { 
  fetchPluginSettings, 
  savePluginSettings, 
  sendDirectZeptoMailEmail, 
  previewEmailHtml,
  fetchAcumbamailListsDirect,
  WordPressPluginSettings 
} from '../lib/wordpressBridge';
import { EmailMarketingStudio } from '../components/email/EmailMarketingStudio';

interface EmailTemplatesPageProps {
  defaultTab?: 'marketing' | 'templates' | 'test' | 'delivery';
}

export const EmailTemplatesPage: React.FC<EmailTemplatesPageProps> = ({ defaultTab = 'marketing' }) => {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<string>(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveSection(defaultTab);
    }
  }, [defaultTab]);

  // Settings State
  const [settings, setSettings] = useState<WordPressPluginSettings>({
    zeptomail_token: '',
    email_from_address: 'orders@exacoat.com',
    email_from_name: 'Exacoat',
    acumbamail_token: 'c7b494d1f2354a7aadb7aba0e260364b',
    acumbamail_from_email: 'sales@exacoat.com',
    acumbamail_from_name: 'Exacoat',
    acumbamail_default_list: '678690',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAcumbaToken, setShowAcumbaToken] = useState(false);
  const [isTestingAcumba, setIsTestingAcumba] = useState(false);
  const [acumbaConnectionStatus, setAcumbaConnectionStatus] = useState<string | null>(null);

  // Dispatcher State
  const [selectedEvent, setSelectedEvent] = useState('customer_order_processing');
  const [recipientEmail, setRecipientEmail] = useState('customer@exacoat.com');
  const [isSending, setIsSending] = useState(false);
  const [sendResponse, setSendResponse] = useState<any>(null);

  // Preview Modal State
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewEventName, setPreviewEventName] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    const res = await fetchPluginSettings();
    if (res.success && res.settings) {
      setSettings(prev => ({ ...prev, ...res.settings }));
    }
    setIsLoadingSettings(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await savePluginSettings(settings);
    if (res.success) {
      showToast('success', 'ESP Settings Saved', 'Acumbamail and ZeptoMail configurations saved to WordPress.');
      await loadSettings();
    } else {
      showToast('error', 'Save Failed', res.error || 'Failed updating email settings.');
    }
    setIsSaving(false);
  };

  const handleTestAcumbamailConnection = async () => {
    setIsTestingAcumba(true);
    const res = await fetchAcumbamailListsDirect(settings.acumbamail_token);
    setIsTestingAcumba(false);
    if (res.success && res.lists) {
      setAcumbaConnectionStatus(`Connected: ${res.lists.length} subscriber lists available.`);
      showToast('success', 'Acumbamail Connected', `Successfully connected. Found ${res.lists.length} lists.`);
    } else {
      setAcumbaConnectionStatus(`Failed: ${res.error || 'Connection error'}`);
      showToast('error', 'Acumbamail Connection Failed', res.error || 'Check auth token.');
    }
  };

  const handlePreview = async (eventKey?: string) => {
    const targetEvent = eventKey || selectedEvent;
    setPreviewEventName(targetEvent);
    setIsPreviewLoading(true);
    const tmpl = ALL_EMAIL_TEMPLATES.find(t => t.key === targetEvent);
    const res = await previewEmailHtml(targetEvent, tmpl?.defaults || {});
    setIsPreviewLoading(false);

    if (res.success && res.html) {
      setPreviewSubject(res.subject || 'Email Preview');
      setPreviewHtml(res.html);
      setShowPreviewModal(true);
    } else {
      showToast('error', 'Preview Failed', res.error || 'Could not render template preview.');
    }
  };

  const handleSendTest = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      showToast('error', 'Invalid Email', 'Please enter a valid recipient email address.');
      return;
    }

    setIsSending(true);
    const currentTemplate = ALL_EMAIL_TEMPLATES.find(t => t.key === selectedEvent);
    const recipientName = 'Customer';
    const res = await sendDirectZeptoMailEmail(selectedEvent, recipientEmail, recipientName, currentTemplate?.defaults);
    setSendResponse(res);
    setIsSending(false);

    if (res.success) {
      showToast('success', 'Email Sent', `Delivered in ${res.latency_ms || 0}ms.`);
    } else {
      showToast('error', 'Send Failed', res.message || 'Check email configuration.');
    }
  };

  const emailTemplateOptions: SelectOption[] = ALL_EMAIL_TEMPLATES.map(tmpl => ({
    value: tmpl.key,
    label: tmpl.name,
    category: tmpl.category,
    subtitle: tmpl.subject,
    badge: tmpl.badge,
    badgeVariant: tmpl.badgeVariant,
  }));

  const emailTemplatesCatalog = EMAIL_TEMPLATES_CATALOG;

  return (
    <div className="space-y-6 font-sans">
      <PageHeroHeader
        title="Email Hub"
        subtitle="Manage marketing campaigns, customer broadcasts, and transactional templates."
        badge={{ label: 'Acumbamail & ZeptoMail', variant: 'lime' }}
      />

      <Tabs
        tabs={[
          { id: 'marketing', label: 'Marketing Studio' },
          { id: 'templates', label: 'Transactional Catalog' },
          { id: 'test', label: 'Transactional Sandbox' },
          { id: 'delivery', label: 'Delivery & ESP Settings' },
        ]}
        activeTab={activeSection}
        onChange={setActiveSection}
        className="w-full sm:w-fit"
      />

      {/* 1. Marketing Studio */}
      {activeSection === 'marketing' && (
        <EmailMarketingStudio 
          settings={settings} 
          onNavigateSettings={() => setActiveSection('delivery')} 
        />
      )}

      {/* 2. ESP Delivery Settings */}
      {activeSection === 'delivery' && (
        <div className="space-y-6">
          {/* Acumbamail Marketing ESP Configuration */}
          <GlassCard className="p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <strong className="text-sm font-bold text-zinc-900 dark:text-white">
                  Acumbamail Marketing Engine
                </strong>
              </div>
              <span className="inline-flex h-5 items-center whitespace-nowrap text-[10px] leading-none text-amber-500 bg-amber-500/10 px-2 rounded-full border border-amber-500/20">
                Marketing &amp; Broadcasts
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Acumbamail Auth Token (API Key)
                  </label>
                  <Input
                    type={showAcumbaToken ? 'text' : 'password'}
                    value={settings.acumbamail_token || ''}
                    onChange={e => setSettings({ ...settings, acumbamail_token: e.target.value })}
                    placeholder="Acumbamail auth token"
                    className="font-mono"
                    rightElement={
                      <button 
                        type="button" 
                        onClick={() => setShowAcumbaToken(!showAcumbaToken)} 
                        className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white" 
                        aria-label={showAcumbaToken ? 'Hide token' : 'Show token'}
                      >
                        {showAcumbaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <span className="text-[10px] text-zinc-500 block">Acumbamail &gt; My Account &gt; API &gt; Auth Token</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Sender Email
                  </label>
                  <Input
                    type="email"
                    value={settings.acumbamail_from_email || 'sales@exacoat.com'}
                    onChange={e => setSettings({ ...settings, acumbamail_from_email: e.target.value })}
                    placeholder="sales@exacoat.com"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Sender Name
                  </label>
                  <Input
                    type="text"
                    value={settings.acumbamail_from_name || 'Exacoat'}
                    onChange={e => setSettings({ ...settings, acumbamail_from_name: e.target.value })}
                    placeholder="Exacoat"
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Default List ID
                  </label>
                  <Input
                    type="text"
                    value={settings.acumbamail_default_list || '678690'}
                    onChange={e => setSettings({ ...settings, acumbamail_default_list: e.target.value })}
                    placeholder="678690"
                    className="font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 block">e.g. 678690 (Exacoat Mailing List)</span>
                </div>
              </div>

              {acumbaConnectionStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                  acumbaConnectionStatus.startsWith('Connected') 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}>
                  {acumbaConnectionStatus.startsWith('Connected') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{acumbaConnectionStatus}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestAcumbamailConnection}
                  disabled={isTestingAcumba}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTestingAcumba ? 'animate-spin' : ''}`} />
                  <span>{isTestingAcumba ? 'Testing...' : 'Test Acumbamail Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadSettings}
                    disabled={isLoadingSettings}
                    className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 border border-zinc-200 dark:border-white/10 transition-colors font-mono"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isLoadingSettings ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </GlassCard>

          {/* Zoho ZeptoMail Transactional Configuration */}
          <GlassCard className="p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#f3aa18]" />
                <strong className="text-sm font-bold text-zinc-900 dark:text-white">
                  ZeptoMail Transactional Engine
                </strong>
              </div>
              <span className="inline-flex h-5 items-center whitespace-nowrap text-[10px] leading-none text-[#f3aa18] bg-lime-500/10 px-2 rounded-full border border-lime-500/20">
                Transactional Only
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    ZeptoMail Send Token
                  </label>
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={settings.zeptomail_token || ''}
                    onChange={e => setSettings({ ...settings, zeptomail_token: e.target.value })}
                    placeholder="Zoho send token"
                    className="font-mono"
                    rightElement={
                      <button 
                        type="button" 
                        onClick={() => setShowToken(!showToken)} 
                        className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white" 
                        aria-label={showToken ? 'Hide token' : 'Show token'}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <span className="text-[10px] text-zinc-500 block">Zoho ZeptoMail &gt; Mail Agents &gt; Setup Info &gt; Send Mail Token</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Sender Address
                  </label>
                  <Input
                    type="email"
                    value={settings.email_from_address || 'orders@exacoat.com'}
                    onChange={e => setSettings({ ...settings, email_from_address: e.target.value })}
                    placeholder="orders@exacoat.com"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* 3. Live Email Dispatcher */}
      {activeSection === 'test' && <GlassCard className="p-6 md:p-8 space-y-6 overflow-visible relative z-30">
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Send Test
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              Preview a template or send it to a test address.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono relative z-40">
          <CustomSelect
            label="Select Email Event:"
            value={selectedEvent}
            onChange={setSelectedEvent}
            options={emailTemplateOptions}
            searchable={true}
            placeholder="Search templates..."
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block font-mono">
              Recipient Email Address:
            </label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={e => { setRecipientEmail(e.target.value); setSendResponse(null); }}
              placeholder="customer@exacoat.com"
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handlePreview()}
            disabled={isPreviewLoading}
            className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white font-bold text-xs flex items-center gap-2 border border-zinc-200 dark:border-white/10"
          >
            <Eye className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>{isPreviewLoading ? 'Preparing Preview' : 'Preview'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09a10] text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Sending' : 'Send Test'}</span>
          </button>
        </div>

        {sendResponse && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs animate-fade-in">
            <div className="flex items-center justify-between text-[11px] border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">Recipient: <strong className="text-white">{recipientEmail}</strong></span>
              <span className={`font-bold px-2 py-0.5 rounded ${sendResponse.success ? 'bg-[#f3aa18]/15 text-[#f3aa18]' : 'bg-rose-500/15 text-rose-400'}`}>
                HTTP {sendResponse.status_code || (sendResponse.success ? 200 : 500)} ({sendResponse.latency_ms || 0}ms)
              </span>
            </div>
            <p className="text-xs text-zinc-300 pt-1 font-sans">{sendResponse.message}</p>
          </div>
        )}
      </GlassCard>}

      {/* 4. Complete Templates Registry Matrix */}
      {activeSection === 'templates' && <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            Templates
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Preview the transactional emails sent throughout the customer journey.
          </p>
        </div>

        <div className="space-y-8">
          {emailTemplatesCatalog.map(group => (
            <div key={group.category} className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  {group.category}
                </span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-white/[0.08]" />
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {group.items.map(item => (
                  <div
                    key={item.key}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/[0.06] space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-xs truncate">
                          {item.name}
                        </span>
                        <span className="inline-flex h-5 items-center px-2 rounded-full text-[10px] leading-none bg-zinc-200 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-white/10 whitespace-nowrap">
                          {item.badge}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                        {item.trigger}
                      </p>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-[11px] text-[#38bdf8] overflow-x-auto">
                        <code>{item.payload}</code>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">Event: <code className="text-[#f3aa18]">{item.key}</code></span>
                      <button
                        type="button"
                        onClick={() => handlePreview(item.key)}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-[11px] font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#f3aa18]" />
                        <span>Preview Email</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>}

      {/* HTML Email Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        maxWidth="4xl"
        title={
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-primary" />
            <div>
              <strong className="text-sm font-semibold text-zinc-950 dark:text-white block">Email Preview</strong>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">Subject: <span className="text-primary">{previewSubject}</span></p>
            </div>
          </div>
        }
        footer={
          <>
            <span />
            <Button type="button" variant="secondary" onClick={() => setShowPreviewModal(false)}>Close</Button>
          </>
        }
      >
        <div className="w-full bg-[#141416] rounded-xl overflow-hidden p-2">
          <iframe
            srcDoc={previewHtml}
            title="HTML Email Preview"
            className="w-full h-[65vh] min-h-[360px] rounded-xl border border-zinc-800/80 bg-white dark:bg-zinc-900"
          />
        </div>
      </Modal>
    </div>
  );
};
