import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Eye, 
  Upload, 
  Image as ImageIcon, 
  Users, 
  User, 
  Megaphone, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Monitor, 
  Trash2, 
  ExternalLink, 
  Link as LinkIcon, 
  Check, 
  Copy,
  ChevronDown,
  ChevronUp,
  Tag,
  Gift
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { 
  fetchAcumbamailListsDirect, 
  sendAcumbamailCampaignDirect, 
  sendAcumbamailSingleEmailDirect, 
  generateMarketingEmailCopyDirect, 
  uploadMarketingImageDirect,
  fetchAdminAffiliates,
  fetchCustomersDirect,
  AcumbamailList,
  WordPressPluginSettings 
} from '../../lib/wordpressBridge';
import { renderMarketingEmailHtml, MarketingEmailOptions } from '../../lib/emailRenderer';

export type AudienceType = 'subscribers' | 'affiliates' | 'customer';

interface EmailMarketingStudioProps {
  settings: WordPressPluginSettings;
  onNavigateSettings?: () => void;
}

export const EmailMarketingStudio: React.FC<EmailMarketingStudioProps> = ({ settings, onNavigateSettings }) => {
  const { showToast } = useToast();

  // Audience Selection
  const [audienceType, setAudienceType] = useState<AudienceType>('subscribers');
  const [acumbaLists, setAcumbaLists] = useState<AcumbamailList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // Affiliates state
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [affiliateFilter, setAffiliateFilter] = useState<'all' | 'active' | 'specific'>('all');
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');
  const [isLoadingAffiliates, setIsLoadingAffiliates] = useState(false);

  // Specific customer state
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Campaign Form Details
  const [campaignName, setCampaignName] = useState(`Announcement ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  const [subject, setSubject] = useState('New Precision Textures: Now Available');
  const [preheader, setPreheader] = useState('Explore our new precision skins cut to the millimeter.');
  const [badgeText, setBadgeText] = useState('NEW RELEASE');
  const [badgeVariant, setBadgeVariant] = useState<'amber' | 'emerald' | 'blue' | 'purple' | 'zinc'>('amber');
  const [recipientGreeting, setRecipientGreeting] = useState('Hi there,');
  const [headline, setHeadline] = useState('Precision Fit for Your Setup');
  const [bodyText, setBodyText] = useState(
    'We are excited to introduce our latest collection of custom-engineered skins, precision-measured and cut for an exact fit on your device.\n\nCrafted with premium materials and bubble-free adhesive, each skin delivers tactile grip and scratch defense without adding bulk.\n\nOrder today and elevate your device aesthetics.'
  );

  // Promo Box
  const [showPromoBox, setShowPromoBox] = useState(false);
  const [promoCode, setPromoCode] = useState('EXA15');
  const [promoTitle, setPromoTitle] = useState('Special Community Offer');
  const [promoText, setPromoText] = useState('Enjoy 15% off your next skin order at checkout.');

  // CTA Buttons
  const [ctaText, setCtaText] = useState('Explore the Collection');
  const [ctaUrl, setCtaUrl] = useState('https://exacoat.com/shop');
  const [showSecondaryCta, setShowSecondaryCta] = useState(false);
  const [secondaryCtaText, setSecondaryCtaText] = useState('View Installation Guide');
  const [secondaryCtaUrl, setSecondaryCtaUrl] = useState('https://exacoat.com/guide');

  // Hero / Banner Image
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerLinkUrl, setBannerLinkUrl] = useState('https://exacoat.com/shop');
  const [bannerImageAlt, setBannerImageAlt] = useState('Exacoat Precision Skin');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Copywriter State
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [aiCampaignType, setAiCampaignType] = useState('New Device / Skin Release');
  const [aiProductFocus, setAiProductFocus] = useState('iPhone 17 and Samsung Galaxy skins in Matrix and Black Camo');
  const [aiPromoDetails, setAiPromoDetails] = useState('');
  const [aiLanguage, setAiLanguage] = useState<'en' | 'id'>('en');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedSubjects, setAiGeneratedSubjects] = useState<string[]>([]);

  // Preview Mode
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Dispatch & Test Send Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('william@exacoat.com');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Load Acumbamail Lists on Mount
  const loadAcumbamailLists = async () => {
    setIsLoadingLists(true);
    const res = await fetchAcumbamailListsDirect(settings.acumbamail_token);
    setIsLoadingLists(false);
    if (res.success && res.lists.length > 0) {
      setAcumbaLists(res.lists);
      if (!selectedListId) {
        // Default to "Exacoat Mailing List" or the configured list
        const defaultList = res.lists.find(l => l.name.toLowerCase().includes('exacoat')) || res.lists[0];
        setSelectedListId(defaultList.id);
      }
    } else if (res.error) {
      console.warn('[Acumbamail] Error loading lists:', res.error);
    }
  };

  // Load Affiliates
  const loadAffiliates = async () => {
    setIsLoadingAffiliates(true);
    const res = await fetchAdminAffiliates();
    setIsLoadingAffiliates(false);
    if (res.success && Array.isArray(res.affiliates)) {
      setAffiliates(res.affiliates);
      if (res.affiliates.length > 0 && !selectedAffiliateId) {
        setSelectedAffiliateId(String(res.affiliates[0].id));
      }
    }
  };

  useEffect(() => {
    loadAcumbamailLists();
  }, [settings.acumbamail_token]);

  useEffect(() => {
    if (audienceType === 'affiliates' && affiliates.length === 0) {
      loadAffiliates();
    }
  }, [audienceType]);

  // Search WooCommerce Customers
  const handleSearchCustomers = async (q: string) => {
    setCustomerSearchQuery(q);
    if (!q || q.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomers(true);
    const res = await fetchCustomersDirect({ search: q, per_page: 8 });
    setIsSearchingCustomers(false);
    if (res.success && Array.isArray(res.customers)) {
      setCustomerSearchResults(res.customers);
    }
  };

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid File', 'Please select an image file (PNG, JPG, WebP).');
      return;
    }

    setIsUploadingImage(true);
    const res = await uploadMarketingImageDirect(file);
    setIsUploadingImage(false);

    if (res.success && res.url) {
      setBannerImageUrl(res.url);
      showToast('success', 'Image Uploaded', 'Banner image uploaded to media CDN.');
    } else {
      showToast('error', 'Upload Failed', res.error || 'Could not upload image.');
    }
  };

  // Generate Copy with AI
  const handleGenerateAiCopy = async () => {
    setIsGeneratingAi(true);
    const targetDesc = audienceType === 'subscribers' 
      ? 'Newsletter subscribers and loyal brand fans'
      : audienceType === 'affiliates'
      ? 'Content creators, influencers, and affiliates promoting Exacoat'
      : 'Specific high-value customer';

    const res = await generateMarketingEmailCopyDirect({
      campaignType: aiCampaignType,
      productFocus: aiProductFocus,
      promoDetails: aiPromoDetails,
      language: aiLanguage,
      targetAudience: targetDesc,
    });
    setIsGeneratingAi(false);

    if (res.success) {
      if (res.subjectLines && res.subjectLines.length > 0) {
        setAiGeneratedSubjects(res.subjectLines);
        setSubject(res.subjectLines[0]);
      }
      if (res.preheader) setPreheader(res.preheader);
      if (res.headline) setHeadline(res.headline);
      if (res.bodyText) setBodyText(res.bodyText);
      if (res.ctaText) setCtaText(res.ctaText);

      showToast('success', 'AI Copy Generated', 'Applied fresh copy with antislop compliance.');
    } else {
      showToast('error', 'AI Generation Failed', res.error || 'Check API key connection in settings.');
    }
  };

  // Computed Marketing Email HTML Options
  const emailOptions: MarketingEmailOptions = useMemo(() => ({
    subject,
    badgeText,
    badgeVariant,
    headline,
    recipientGreeting: audienceType === 'affiliates' ? 'Hi Creator,' : recipientGreeting,
    bannerImageUrl: bannerImageUrl || undefined,
    bannerImageAlt,
    bannerLinkUrl: bannerLinkUrl || undefined,
    bodyText,
    highlightTitle: showPromoBox ? promoTitle : undefined,
    highlightText: showPromoBox ? promoText : undefined,
    promoCode: showPromoBox ? promoCode : undefined,
    ctaText: ctaText || undefined,
    ctaUrl: ctaUrl || undefined,
    secondaryCtaText: showSecondaryCta ? secondaryCtaText : undefined,
    secondaryCtaUrl: showSecondaryCta ? secondaryCtaUrl : undefined,
    unsubscribeUrl: '{{unsubscribe_url}}',
  }), [
    subject,
    badgeText,
    badgeVariant,
    headline,
    recipientGreeting,
    audienceType,
    bannerImageUrl,
    bannerImageAlt,
    bannerLinkUrl,
    bodyText,
    showPromoBox,
    promoTitle,
    promoText,
    promoCode,
    ctaText,
    ctaUrl,
    showSecondaryCta,
    secondaryCtaText,
    secondaryCtaUrl,
  ]);

  const renderedEmail = useMemo(() => {
    return renderMarketingEmailHtml(emailOptions);
  }, [emailOptions]);

  // Recipient Count Calculator
  const recipientCountLabel = useMemo(() => {
    if (audienceType === 'subscribers') {
      const list = acumbaLists.find(l => l.id === selectedListId);
      return list ? `${list.name}` : 'Select a subscriber list';
    } else if (audienceType === 'affiliates') {
      if (affiliateFilter === 'all') return `All Affiliates (${affiliates.length} total)`;
      if (affiliateFilter === 'active') {
        const activeCount = affiliates.filter(a => a.status === 'active').length;
        return `Active Affiliates (${activeCount} creators)`;
      }
      const specific = affiliates.find(a => String(a.id) === selectedAffiliateId);
      return specific ? `Affiliate: ${specific.name || specific.email}` : 'Select an affiliate';
    } else {
      return customerEmail ? `1 Recipient: ${customerEmail}` : 'Enter recipient email';
    }
  }, [audienceType, selectedListId, acumbaLists, affiliateFilter, affiliates, selectedAffiliateId, customerEmail]);

  // Send Test Email via Acumbamail
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      showToast('error', 'Invalid Email', 'Enter a valid email address for testing.');
      return;
    }

    setIsSendingTest(true);
    const fromEmail = settings.acumbamail_from_email || 'sales@exacoat.com';
    const fromName = settings.acumbamail_from_name || 'Exacoat';

    const res = await sendAcumbamailSingleEmailDirect({
      toEmail: testEmailAddress,
      subject: `[TEST] ${subject}`,
      bodyHtml: renderedEmail.html,
      fromEmail,
      fromName,
      tokenOverride: settings.acumbamail_token,
    });
    setIsSendingTest(false);

    if (res.success) {
      showToast('success', 'Test Dispatched via Acumbamail', `Delivered to ${testEmailAddress} in ${res.latency_ms || 0}ms.`);
    } else {
      showToast('error', 'Test Send Failed', res.error || 'Check Acumbamail token or sender email.');
    }
  };

  // Dispatch Campaign
  const handleDispatchCampaign = async () => {
    const fromEmail = settings.acumbamail_from_email || 'sales@exacoat.com';
    const fromName = settings.acumbamail_from_name || 'Exacoat';

    setIsSending(true);

    if (audienceType === 'subscribers') {
      if (!selectedListId) {
        showToast('error', 'No List Selected', 'Please pick a subscriber list to dispatch.');
        setIsSending(false);
        return;
      }

      const res = await sendAcumbamailCampaignDirect({
        name: campaignName,
        fromName,
        fromEmail,
        subject,
        contentHtml: renderedEmail.html,
        listIds: [selectedListId],
        tokenOverride: settings.acumbamail_token,
      });

      setIsSending(false);
      setShowSendModal(false);

      if (res.success) {
        showToast('success', 'Campaign Created via Acumbamail', `Queued successfully (ID: ${res.campaign_id}).`);
      } else {
        showToast('error', 'Campaign Failed', res.error || 'Acumbamail campaign dispatch failed.');
      }
    } else if (audienceType === 'affiliates') {
      let targets: string[] = [];
      if (affiliateFilter === 'all') {
        targets = affiliates.map(a => a.email).filter(Boolean);
      } else if (affiliateFilter === 'active') {
        targets = affiliates.filter(a => a.status === 'active').map(a => a.email).filter(Boolean);
      } else {
        const aff = affiliates.find(a => String(a.id) === selectedAffiliateId);
        if (aff?.email) targets = [aff.email];
      }

      if (targets.length === 0) {
        showToast('error', 'No Affiliates Found', 'No affiliate email addresses available for dispatch.');
        setIsSending(false);
        return;
      }

      let sentCount = 0;
      let failCount = 0;

      for (const email of targets) {
        const res = await sendAcumbamailSingleEmailDirect({
          toEmail: email,
          subject,
          bodyHtml: renderedEmail.html,
          fromEmail,
          fromName,
          tokenOverride: settings.acumbamail_token,
        });
        if (res.success) sentCount++;
        else failCount++;
      }

      setIsSending(false);
      setShowSendModal(false);

      if (sentCount > 0) {
        showToast('success', 'Dispatched to Affiliates', `Sent to ${sentCount} creators via Acumbamail (${failCount} errors).`);
      } else {
        showToast('error', 'Dispatch Failed', 'Could not deliver emails to affiliates.');
      }
    } else {
      // Single customer
      if (!customerEmail || !customerEmail.includes('@')) {
        showToast('error', 'Invalid Customer Email', 'Please enter a valid customer email address.');
        setIsSending(false);
        return;
      }

      const res = await sendAcumbamailSingleEmailDirect({
        toEmail: customerEmail,
        subject,
        bodyHtml: renderedEmail.html,
        fromEmail,
        fromName,
        tokenOverride: settings.acumbamail_token,
      });

      setIsSending(false);
      setShowSendModal(false);

      if (res.success) {
        showToast('success', 'Email Sent via Acumbamail', `Delivered to ${customerEmail}.`);
      } else {
        showToast('error', 'Send Failed', res.error || 'Could not send email to customer.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Toolbar */}
      <GlassCard className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Email Marketing Studio</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Acumbamail Engine
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Compose, AI-generate, preview, and dispatch branded campaigns and updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              showAiPanel 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                : 'bg-zinc-100 dark:bg-white/[0.05] border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copywriter</span>
            {showAiPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Send Test</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 bg-[#111111] hover:bg-zinc-800 text-white font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Campaign</span>
          </Button>
        </div>
      </GlassCard>

      {/* Main Studio Grid: 2 Columns (Composer & Live Dual Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Target Audience Selector */}
          <GlassCard className="p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  Target Audience
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                {recipientCountLabel}
              </span>
            </div>

            {/* Audience Segment Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAudienceType('subscribers')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  audienceType === 'subscribers'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                <span>Subscribers List</span>
              </button>

              <button
                type="button"
                onClick={() => setAudienceType('affiliates')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  audienceType === 'affiliates'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Affiliates / Creators</span>
              </button>

              <button
                type="button"
                onClick={() => setAudienceType('customer')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  audienceType === 'customer'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Specific Customer</span>
              </button>
            </div>

            {/* Audience Details depending on Selection */}
            {audienceType === 'subscribers' && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Acumbamail Subscriber List
                  </label>
                  <button
                    type="button"
                    onClick={loadAcumbamailLists}
                    disabled={isLoadingLists}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoadingLists ? 'animate-spin' : ''}`} />
                    <span>Refresh Lists</span>
                  </button>
                </div>

                {acumbaLists.length > 0 ? (
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {acumbaLists.map((list) => (
                      <option key={list.id} value={list.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                        {list.name} (ID: {list.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                    <span>No subscriber lists loaded. Please verify Acumbamail token.</span>
                    <button
                      type="button"
                      onClick={onNavigateSettings}
                      className="underline font-bold text-amber-600 dark:text-amber-400"
                    >
                      Check Settings
                    </button>
                  </div>
                )}
              </div>
            )}

            {audienceType === 'affiliates' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Send To:</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="radio"
                        name="aff_filter"
                        checked={affiliateFilter === 'all'}
                        onChange={() => setAffiliateFilter('all')}
                        className="text-amber-500"
                      />
                      <span>All Creators ({affiliates.length})</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="radio"
                        name="aff_filter"
                        checked={affiliateFilter === 'active'}
                        onChange={() => setAffiliateFilter('active')}
                        className="text-amber-500"
                      />
                      <span>Active Only</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="radio"
                        name="aff_filter"
                        checked={affiliateFilter === 'specific'}
                        onChange={() => setAffiliateFilter('specific')}
                        className="text-amber-500"
                      />
                      <span>Single Affiliate</span>
                    </label>
                  </div>
                </div>

                {affiliateFilter === 'specific' && (
                  <select
                    value={selectedAffiliateId}
                    onChange={(e) => setSelectedAffiliateId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {affiliates.map((aff) => (
                      <option key={aff.id} value={aff.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                        {aff.name || aff.username} ({aff.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {audienceType === 'customer' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Recipient Email Address
                    </label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Recipient Name (Optional)
                    </label>
                    <Input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="William"
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Quick Customer Search from WooCommerce */}
                <div className="relative">
                  <div className="text-[11px] text-zinc-500 flex items-center justify-between mb-1">
                    <span>Or search from WooCommerce database:</span>
                    {isSearchingCustomers && <span className="animate-spin text-amber-500 text-[10px]">Searching...</span>}
                  </div>
                  <Input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => handleSearchCustomers(e.target.value)}
                    placeholder="Type name or email to search..."
                    className="text-xs"
                  />
                  {customerSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {customerSearchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setCustomerEmail(c.email);
                            setCustomerName(`${c.first_name || ''} ${c.last_name || ''}`.trim());
                            setCustomerSearchResults([]);
                            setCustomerSearchQuery('');
                          }}
                          className="p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-white block">
                              {c.first_name} {c.last_name}
                            </span>
                            <span className="text-[11px] text-zinc-500">{c.email}</span>
                          </div>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Pick</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          {/* 2. AI Copywriter Assistant */}
          {showAiPanel && (
            <GlassCard className="p-5 md:p-6 space-y-4 border-amber-500/20 bg-amber-500/[0.02]">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    AI Copywriting Assistant
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Antislop Filter Active</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Campaign Preset
                  </label>
                  <select
                    value={aiCampaignType}
                    onChange={(e) => setAiCampaignType(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="New Device / Skin Release">New Device / Texture Drop</option>
                    <option value="Promotional / Flash Sale">Flash Sale / Discount Promo</option>
                    <option value="Affiliate Creator Opportunity">Affiliate Bonus / Creator Opportunity</option>
                    <option value="VIP Customer Re-engagement">VIP Customer Re-engagement</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Language
                  </label>
                  <div className="flex items-center gap-2 h-9">
                    <button
                      type="button"
                      onClick={() => setAiLanguage('en')}
                      className={`flex-1 h-full rounded-xl border text-xs font-bold ${
                        aiLanguage === 'en'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/10 text-zinc-600'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiLanguage('id')}
                      className={`flex-1 h-full rounded-xl border text-xs font-bold ${
                        aiLanguage === 'id'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/10 text-zinc-600'
                      }`}
                    >
                      Indonesian
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Product Focus / Devices
                  </label>
                  <Input
                    type="text"
                    value={aiProductFocus}
                    onChange={(e) => setAiProductFocus(e.target.value)}
                    placeholder="e.g. iPhone 17 skins, Matrix texture"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Promo Code / Offer Details
                  </label>
                  <Input
                    type="text"
                    value={aiPromoDetails}
                    onChange={(e) => setAiPromoDetails(e.target.value)}
                    placeholder="e.g. 20% off with code EXA20"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-zinc-500">
                  Follows antislop standards: no em dashes, clean human tone, high craftsmanship.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateAiCopy}
                  disabled={isGeneratingAi}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAi ? 'Generating...' : 'Generate Copy'}</span>
                </Button>
              </div>

              {/* AI Generated Subject Suggestions */}
              {aiGeneratedSubjects.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                    Pick a Subject Line:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {aiGeneratedSubjects.map((sub, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSubject(sub);
                          showToast('info', 'Subject Line Updated', sub);
                        }}
                        className={`text-left text-xs p-2 rounded-lg border transition-colors flex items-center justify-between ${
                          subject === sub
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                            : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        <span>{sub}</span>
                        {subject === sub && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* 3. Campaign Email Content Composer */}
          <GlassCard className="p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Email Content & Identity
              </h3>
              <span className="text-[11px] text-zinc-500 font-mono">Exacoat Minimalist Layout</span>
            </div>

            {/* Campaign Name & Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Subject Line
                </label>
                <Input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line"
                  className="text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Category Badge
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="Badge (e.g. DROP)"
                    className="text-xs"
                  />
                  <select
                    value={badgeVariant}
                    onChange={(e: any) => setBadgeVariant(e.target.value)}
                    className="h-10 px-2 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                  >
                    <option value="amber">Amber</option>
                    <option value="emerald">Emerald</option>
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="zinc">Zinc</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Preheader & Greeting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Preheader Snippet
                </label>
                <Input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="Summary displayed next to subject in inbox"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Customer Greeting
                </label>
                <Input
                  type="text"
                  value={recipientGreeting}
                  onChange={(e) => setRecipientGreeting(e.target.value)}
                  placeholder="Hi there, / Hi Customer,"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Banner Image Attachment */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                  Hero Banner Image (Optional)
                </span>
                {bannerImageUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerImageUrl('')}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                    Image URL
                  </label>
                  <Input
                    type="text"
                    value={bannerImageUrl}
                    onChange={(e) => setBannerImageUrl(e.target.value)}
                    placeholder="https://exacoat.com/.../banner.jpg"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                    Or Upload File to CDN
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isUploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isUploadingImage ? 'animate-spin' : ''}`} />
                    <span>{isUploadingImage ? 'Uploading...' : 'Choose Image File'}</span>
                  </Button>
                </div>
              </div>

              {bannerImageUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                      Image Click Destination Link
                    </label>
                    <Input
                      type="text"
                      value={bannerLinkUrl}
                      onChange={(e) => setBannerLinkUrl(e.target.value)}
                      placeholder="https://exacoat.com/shop"
                      className="text-xs"
                    />
                  </div>
                  <div className="relative aspect-[16/7] rounded-lg overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                    <img src={bannerImageUrl} alt="Banner preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>

            {/* Headline & Body Text */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Headline
                </label>
                <Input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Main email heading"
                  className="text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Body Text (Paragraphs separated by blank lines)
                </label>
                <textarea
                  rows={5}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Enter message body copy..."
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                />
              </div>
            </div>

            {/* Promo Code Box Accordion */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.01] space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPromoBox}
                    onChange={(e) => setShowPromoBox(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Include Highlight / Coupon Box</span>
                </label>
                {showPromoBox && <Gift className="w-4 h-4 text-amber-500" />}
              </div>

              {showPromoBox && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Coupon Code</label>
                    <Input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="EXA15"
                      className="text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Box Title</label>
                    <Input
                      type="text"
                      value={promoTitle}
                      onChange={(e) => setPromoTitle(e.target.value)}
                      placeholder="Exclusive Community Offer"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Box Description</label>
                    <Input
                      type="text"
                      value={promoText}
                      onChange={(e) => setPromoText(e.target.value)}
                      placeholder="15% off your next order"
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons (CTA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Primary Button Text
                </label>
                <Input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Explore Collection"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Primary Button URL
                </label>
                <Input
                  type="text"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://exacoat.com/shop"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Secondary CTA Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={showSecondaryCta}
                  onChange={(e) => setShowSecondaryCta(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>Include secondary action link / button</span>
              </label>

              {showSecondaryCta && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 border-l-2 border-zinc-200 dark:border-white/10">
                  <Input
                    type="text"
                    value={secondaryCtaText}
                    onChange={(e) => setSecondaryCtaText(e.target.value)}
                    placeholder="Secondary button label"
                    className="text-xs"
                  />
                  <Input
                    type="text"
                    value={secondaryCtaUrl}
                    onChange={(e) => setSecondaryCtaUrl(e.target.value)}
                    placeholder="Secondary URL"
                    className="text-xs"
                  />
                </div>
              )}
            </div>

          </GlassCard>
        </div>

        {/* Right Column: Live Dual Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-4 md:p-5 flex flex-col h-full sticky top-4">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Live Email Preview</span>
              </div>

              {/* Viewport Switcher */}
              <div className="flex items-center bg-zinc-100 dark:bg-white/[0.05] p-1 rounded-xl border border-zinc-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    previewViewport === 'desktop'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    previewViewport === 'mobile'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Subject preview snippet */}
            <div className="bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/05 rounded-xl p-2.5 text-xs mb-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-semibold text-[10px] uppercase">Subject:</span>
                <span className="font-bold text-zinc-900 dark:text-white truncate">{subject}</span>
              </div>
              {preheader && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-semibold text-[10px] uppercase">Preview:</span>
                  <span className="text-zinc-500 dark:text-zinc-400 truncate text-[11px]">{preheader}</span>
                </div>
              )}
            </div>

            {/* Preview Frame Container */}
            <div className="flex-1 flex justify-center bg-zinc-200/50 dark:bg-black/40 rounded-2xl p-2 md:p-4 overflow-hidden border border-zinc-200 dark:border-white/10 min-h-[580px]">
              <div
                className={`transition-all duration-300 bg-white rounded-xl shadow-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 ${
                  previewViewport === 'desktop' ? 'w-full max-w-[620px]' : 'w-[375px]'
                }`}
              >
                <iframe
                  title="Marketing Email Preview"
                  srcDoc={renderedEmail.html}
                  className="w-full h-full min-h-[580px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Dispatch & Test Send Confirmation Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Dispatch Marketing Email"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <span className="font-bold block">Delivery Service: Acumbamail Engine</span>
            <span>Sender Address: <strong>{settings.acumbamail_from_email || 'sales@exacoat.com'}</strong> ({settings.acumbamail_from_name || 'Exacoat'})</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/05">
              <span className="text-zinc-500">Target Audience:</span>
              <span className="font-bold text-zinc-900 dark:text-white capitalize">{audienceType}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/05">
              <span className="text-zinc-500">Recipients:</span>
              <span className="font-bold text-zinc-900 dark:text-white">{recipientCountLabel}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/05">
              <span className="text-zinc-500">Email Subject:</span>
              <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[240px]">{subject}</span>
            </div>
          </div>

          {/* Test Send Section */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] space-y-2">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
              1. Send a Test Email First (Recommended)
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your.email@example.com"
                className="text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                className="whitespace-nowrap flex items-center gap-1.5"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-spin' : ''}`} />
                <span>{isSendingTest ? 'Sending...' : 'Send Test'}</span>
              </Button>
            </div>
          </div>

          {/* Full Dispatch Section */}
          <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowSendModal(false)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleDispatchCampaign}
              disabled={isSending}
              className="bg-[#111111] hover:bg-zinc-800 text-white font-bold flex items-center gap-2 px-5"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'Dispatching via Acumbamail...' : `Confirm & Send to ${audienceType}`}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
