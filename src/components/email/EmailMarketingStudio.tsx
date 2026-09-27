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
  Gift,
  Bookmark,
  History,
  BookOpen,
  Palette,
  ShieldCheck,
  CheckCheck,
  Plus,
  Code,
  FileCode,
  Wand2,
  Layers,
  PenLine,
  FileText,
  SlidersHorizontal
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MediaLibraryModal } from '../modals/MediaLibraryModal';
import { useToast } from '../../context/ToastContext';
import { 
  fetchAcumbamailListsDirect, 
  sendAcumbamailCampaignDirect, 
  sendAcumbamailSingleEmailDirect, 
  generateMarketingEmailCopyDirect, 
  generateMarketingFullHtmlEmailDirect,
  uploadMarketingImageDirect,
  fetchAcumbamailCampaignsDirect,
  fetchAcumbamailCampaignDetailDirect,
  fetchAdminAffiliates,
  fetchCustomersDirect,
  AcumbamailList,
  WordPressPluginSettings 
} from '../../lib/wordpressBridge';
import { renderMarketingEmailHtml, MarketingEmailOptions, TrustFeatureCard } from '../../lib/emailRenderer';
import { compileMjmlToHtml, isMjmlMarkup } from '../../lib/mjmlCompiler';

export type AudienceType = 'subscribers' | 'affiliates' | 'customer';

export interface MarketingPreset {
  id: string;
  name: string;
  desc?: string;
  isBuiltIn?: boolean;
  theme: 'dark' | 'light';
  showHeader?: boolean;
  showBadge?: boolean;
  logoPosition?: 'top' | 'bottom' | 'none';
  subject: string;
  preheader: string;
  badgeText: string;
  badgeVariant: 'amber' | 'emerald' | 'blue' | 'purple' | 'zinc';
  headline: string;
  recipientGreeting: string;
  subPillNotice?: string;
  bodyText: string;
  showPromoBox: boolean;
  promoCode?: string;
  promoTitle?: string;
  promoText?: string;
  ctaText: string;
  ctaUrl: string;
  primaryCtaColor: 'amber' | 'white' | 'emerald';
  showTrustGrid: boolean;
  bannerImageUrl?: string;
  bannerAspectRatio?: '16:9' | '4:3' | '1:1' | '3:4' | 'auto';
}

const PRESETS_STORAGE_KEY = 'exacoat_marketing_presets';

export const BUILTIN_PRESETS: MarketingPreset[] = [
  {
    id: 'preset_dark_sale',
    name: 'Exacoat Dark Flash Sale (Reference Style)',
    desc: 'Matches signature dark layout: yellow SHOP NOW button, coupon box, and 4 trust feature cards.',
    isBuiltIn: true,
    theme: 'dark',
    showHeader: false,
    showBadge: false,
    logoPosition: 'top',
    subject: '7.7 FLASH SALE: 17% OFF Everything',
    preheader: 'Precision device skins cut to the millimeter with authentic tactile textures.',
    badgeText: '7.7 FLASH SALE',
    badgeVariant: 'amber',
    headline: 'Upgrade Your Everyday Carry',
    recipientGreeting: 'Hi there,',
    subPillNotice: 'All Items - Limited Time Only • Auto Applied at Checkout',
    bodyText: 'Refresh your gadget setup with millimeter-precise skins engineered for uncompromising grip and scratch defense.\n\nCrafted from authentic cast vinyl with air release channels, every wrap provides full back, frame, and camera protection without adding bulk.\n\nTake advantage of our storewide seasonal discount today.',
    showPromoBox: true,
    promoCode: 'SALE17',
    promoTitle: 'Limited Time Storewide Perk',
    promoText: '17% OFF all skins and wraps applied automatically at checkout.',
    ctaText: 'SHOP NOW',
    ctaUrl: 'https://exacoat.com/shop',
    primaryCtaColor: 'amber',
    showTrustGrid: true,
    bannerImageUrl: '',
    bannerAspectRatio: '16:9',
  },
  {
    id: 'preset_flagship_drop',
    name: 'Flagship Device Drop (Dark Edition)',
    desc: 'Sleek product launch announcement for newly released phone/laptop skins.',
    isBuiltIn: true,
    theme: 'dark',
    showHeader: false,
    showBadge: false,
    logoPosition: 'top',
    subject: 'The ultimate skin for your new device is here',
    preheader: 'Explore millimeter-precise protection for the latest flagship releases.',
    badgeText: 'NEW RELEASE',
    badgeVariant: 'blue',
    headline: 'Engineered Precision. Pure Tactile Feel.',
    recipientGreeting: 'Hi there,',
    subPillNotice: 'Now Shipping Worldwide • Free Replacement Guarantee',
    bodyText: 'We spent weeks micro-measuring every curve, bezel, and port to create a skin that fits like a second skin.\n\nChoose from our signature textured materials: Matrix, Black Camo, Slate, Honeycomb, and Matte Black.\n\nOrder today to protect your device against daily micro-scratches from day one.',
    showPromoBox: false,
    ctaText: 'ORDER YOUR SKIN',
    ctaUrl: 'https://exacoat.com/shop',
    primaryCtaColor: 'amber',
    showTrustGrid: true,
    bannerImageUrl: '',
    bannerAspectRatio: '16:9',
  },
  {
    id: 'preset_affiliate_blast',
    name: 'Creator & Affiliate Exclusive (Dark)',
    desc: 'Private memo for affiliates with sample access and commission boosts.',
    isBuiltIn: true,
    theme: 'dark',
    showHeader: false,
    showBadge: false,
    logoPosition: 'top',
    subject: 'Exclusive Partner Memo: Upcoming Drop Sample Kits',
    preheader: 'Special update and early access reserved for Exacoat creator partners.',
    badgeText: 'PARTNER UPDATE',
    badgeVariant: 'purple',
    headline: 'Exclusive Creator Preview',
    recipientGreeting: 'Hi Creator,',
    subPillNotice: 'Exacoat Creator Hub • Priority Dispatch Active',
    bodyText: 'As an official Exacoat partner, you get early access to our upcoming texture line before public release.\n\nReply directly to this email or visit your creator dashboard to request complimentary sample units for your upcoming content.\n\nWe have also enabled a seasonal 5% commission booster across all sales through your custom code.',
    showPromoBox: true,
    promoCode: 'CREATORVIP',
    promoTitle: 'Your Exclusive Partner Code',
    promoText: 'Share with your audience for extra perks.',
    ctaText: 'OPEN CREATOR HUB',
    ctaUrl: 'https://exacoat.com/affiliate-portal',
    primaryCtaColor: 'amber',
    showTrustGrid: false,
    bannerImageUrl: '',
    bannerAspectRatio: '16:9',
  },
];

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
    'You spent weeks choosing a device engineered to the sub-millimeter, only to face two frustrating options: bury it inside an awkward plastic case, or leave it bare to collect scratches from desk grit and pocket keys.\n\nExacoat gives you a clean third path. Authentic cast vinyl, 360-degree millimeter precision, and real tactile texture that keeps your device looking pristine without adding bulk.\n\nProtect your hardware while keeping the exact ergonomics you bought it for.'
  );

  // Feature & Comparison Cards (2-Column Grid)
  const [customCards, setCustomCards] = useState<TrustFeatureCard[]>([
    { title: 'Installation Warranty', desc: 'If your installation slips within 2 days of delivery, we ship a free replacement.', highlighted: true },
    { title: 'Scratch & Desk Defense', desc: 'Shields against table grit, pocket keys, and daily abrasive contact.', highlighted: false },
    { title: 'Bubble-Free Air Release', desc: 'Micro-channels let air escape smoothly for a clean edge-to-edge finish.', highlighted: false },
    { title: 'Authentic 3D Texture', desc: 'True tactile surface depth you can feel in hand, never flat printed ink.', highlighted: false },
  ]);

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
  const [bannerAspectRatio, setBannerAspectRatio] = useState<'16:9' | '4:3' | '1:1' | '3:4' | 'auto'>('16:9');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Copywriter State
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [aiCampaignType, setAiCampaignType] = useState('New Device / Skin Release');
  const [aiTone, setAiTone] = useState('Exacoat Studio Wit (Dry & Observant)');
  const [aiProductFocus, setAiProductFocus] = useState('iPhone 17 and Samsung Galaxy skins in Matrix and Black Camo');
  const [aiPromoDetails, setAiPromoDetails] = useState('');
  const [aiLanguage, setAiLanguage] = useState<'en' | 'id'>('en');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedSubjects, setAiGeneratedSubjects] = useState<string[]>([]);

  // Preview Mode
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Dark / Light Theme & Brand Style (Defaults to Sleek Dark)
  const [emailTheme, setEmailTheme] = useState<'dark' | 'light'>('dark');
  const [primaryCtaColor, setPrimaryCtaColor] = useState<'amber' | 'white' | 'emerald'>('amber');
  const [subPillNotice, setSubPillNotice] = useState('Limited Time Only • Complimentary Replacement Guarantee');
  const [showTrustGrid, setShowTrustGrid] = useState(true);

  // Header & Brand Placement (Hidden by default for clean, low cognitive load layout)
  const [showHeader, setShowHeader] = useState<boolean>(false);
  const [showBadge, setShowBadge] = useState<boolean>(false);
  const [logoPosition, setLogoPosition] = useState<'top' | 'bottom' | 'none'>('top');

  // Active Composer Section Tab ('content' | 'visuals' | 'audience')
  const [activeTab, setActiveTab] = useState<'content' | 'visuals' | 'audience'>('content');

  // References & Past Campaigns Modal
  const [showReferencesModal, setShowReferencesModal] = useState(false);
  const [referencesTab, setReferencesTab] = useState<'presets' | 'acumbamail'>('presets');
  const [acumbaCampaigns, setAcumbaCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [viewingCampaignHtml, setViewingCampaignHtml] = useState<string | null>(null);
  const [viewingCampaignTitle, setViewingCampaignTitle] = useState<string>('');
  const [customPresetName, setCustomPresetName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<MarketingPreset[]>(() => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return [...BUILTIN_PRESETS, ...parsed];
      }
    } catch {}
    return BUILTIN_PRESETS;
  });

  // Dispatch & Test Send Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('william@exacoat.com');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Composer Mode: Visual Brand Studio vs. Pure HTML / Custom Code
  const [composerMode, setComposerMode] = useState<'visual' | 'code'>('visual');
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);

  // Custom Code Studio State (Supports MJML and HTML)
  const [codeFormat, setCodeFormat] = useState<'mjml' | 'html'>('mjml');
  const [customHtmlCode, setCustomHtmlCode] = useState<string>(() => {
    return `<mjml>
  <mj-head>
    <mj-font name="Plus Jakarta Sans" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" />
    <mj-attributes>
      <mj-all font-family="Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" />
      <mj-text font-size="14.5px" color="#a1a1aa" line-height="1.7" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#050507">
    <!-- Top Webview Link with generous spacing -->
    <mj-section padding="40px 0 18px">
      <mj-column>
        <mj-text align="center" font-size="11px" color="#71717a" line-height="1.5">
          If you cannot see this email properly, please <a href="{{webview_url}}" style="color:#a1a1aa;text-decoration:underline;">click here</a>.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Main Container Card (Rounded 28px) -->
    <mj-wrapper background-color="#0e0e11" border-radius="28px" border="1px solid #1f1f24" padding="36px 24px 32px">
      <!-- Sub-Pill Notice Capsule (Left-aligned, Borderless, Subtle, Centered) -->
      <mj-section padding="0 0 16px">
        <mj-column>
          <mj-button background-color="rgba(255,255,255,0.06)" color="#a1a1aa" border-radius="9999px" font-size="9.5px" font-weight="500" letter-spacing="1.2px" text-transform="uppercase" align="left" inner-padding="4px 12px" padding="0">
            Limited Time Only &bull; Free Replacement Guarantee
          </mj-button>
        </mj-column>
      </mj-section>

      <!-- Message Content -->
      <mj-section padding="0 0 16px">
        <mj-column>
          <mj-text font-size="24px" font-weight="800" color="#ffffff" line-height="1.3" padding="0 0 12px">
            Engineered Precision. Pure Tactile Feel.
          </mj-text>
          <mj-text font-size="15px" font-weight="600" color="#e4e4e7" padding="0 0 12px">
            Hi Customer,
          </mj-text>
          <mj-text padding="0 0 12px">
            We measured every curve, bezel, and port to create a skin that fits like a second skin.
          </mj-text>
          <mj-text padding="0 0 12px">
            Choose from our signature textured materials: Matrix, Black Camo, Slate, Honeycomb, and Matte Black.
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Trust Cards (Rounded 20px) -->
      <mj-section padding="8px 0 16px">
        <mj-column width="48%" background-color="#121215" border="1px solid rgba(245,158,11,0.55)" border-radius="20px" padding="16px">
          <mj-text align="center" font-size="13px" font-weight="bold" color="#fbbf24" padding="0 0 4px">
            Installation Warranty
          </mj-text>
          <mj-text align="center" font-size="11.5px" padding="0">
            If installation fails within 2 days after receipt, we replace it with a new one.
          </mj-text>
        </mj-column>
        <mj-column width="4%"></mj-column>
        <mj-column width="48%" background-color="#121215" border="1px solid rgba(255,255,255,0.08)" border-radius="20px" padding="16px">
          <mj-text align="center" font-size="13px" font-weight="bold" color="#ffffff" padding="0 0 4px">
            Scratch &amp; Mold Resistant
          </mj-text>
          <mj-text align="center" font-size="11.5px" padding="0">
            Shields surfaces from scratches and moisture buildup that degrade gadget finishes.
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- CTA Button -->
      <mj-section padding="16px 0 28px">
        <mj-column>
          <mj-button href="https://exacoat.com/shop" background-color="#f59e0b" color="#000000" font-weight="900" font-size="14.5px" border-radius="999px" inner-padding="15px 38px">
            ORDER YOUR SKIN
          </mj-button>
        </mj-column>
      </mj-section>

      <!-- Footer with Logo on top of Social Links -->
      <mj-section border-top="1px solid #1a1a1f" padding="32px 0 16px">
        <mj-column>
          <mj-text align="center" font-size="16px" font-weight="900" color="#ffffff" letter-spacing="2px" padding="0 0 20px">
            EXACOAT
          </mj-text>
          <mj-social font-size="12px" icon-size="0" mode="horizontal" align="center" padding="0 0 16px">
            <mj-social-element href="https://instagram.com/exacoat" background-color="rgba(255,255,255,0.06)" color="#e4e4e7" border-radius="999px" padding="5px 14px">Instagram</mj-social-element>
            <mj-social-element href="https://x.com/exacoat" background-color="rgba(255,255,255,0.06)" color="#e4e4e7" border-radius="999px" padding="5px 14px">X</mj-social-element>
            <mj-social-element href="https://youtube.com/@exacoat" background-color="rgba(255,255,255,0.06)" color="#e4e4e7" border-radius="999px" padding="5px 14px">YouTube</mj-social-element>
          </mj-social>
          <mj-text align="center" font-size="11.5px" color="#71717a" padding="8px 0 0">
            &copy; 2016-2026 Exacoat
          </mj-text>
          <mj-text align="center" font-size="11px" color="#71717a" padding="6px 0 0">
            <a href="{{webview_url}}" style="color:#a1a1aa;text-decoration:underline;">View in browser</a> &bull;
            <a href="{{unsubscribe_url}}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>`;
  });
  const [compiledHtml, setCompiledHtml] = useState<string>('');
  const [mjmlErrors, setMjmlErrors] = useState<string[]>([]);
  const [isCompilingMjml, setIsCompilingMjml] = useState<boolean>(false);
  const [aiCodePrompt, setAiCodePrompt] = useState<string>('');
  const [isGeneratingFullHtml, setIsGeneratingFullHtml] = useState<boolean>(false);

  // Live MJML to HTML Compilation Effect
  useEffect(() => {
    if (composerMode !== 'code') return;
    const isMjml = codeFormat === 'mjml' || isMjmlMarkup(customHtmlCode);
    if (!isMjml) {
      setCompiledHtml(customHtmlCode);
      setMjmlErrors([]);
      return;
    }

    let isMounted = true;
    setIsCompilingMjml(true);
    compileMjmlToHtml(customHtmlCode).then((res) => {
      if (!isMounted) return;
      setIsCompilingMjml(false);
      if (res.success && res.html) {
        setCompiledHtml(res.html);
        setMjmlErrors(res.errors || []);
      } else {
        setMjmlErrors(res.errors || ['Compilation error']);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [customHtmlCode, codeFormat, composerMode]);

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

  // Generate Copy or Full MJML with AI
  const handleGenerateAiCopy = async (targetMode: 'visual' | 'mjml' = 'visual') => {
    setIsGeneratingAi(true);

    if (targetMode === 'mjml') {
      showToast('info', 'AI Designing MJML Email', 'Building responsive multi-card layout with Exacoat brand voice...');
      const fullPrompt = `Campaign: ${aiCampaignType}. Focus: ${aiProductFocus}. ${aiPromoDetails ? `Offer: ${aiPromoDetails}.` : ''} Tone: ${aiTone}. Generate complete responsive MJML with complex comparison or feature cards, display headline, concise body copy with zero walls of text, and no em dashes.`;

      const res = await generateMarketingFullHtmlEmailDirect({
        prompt: fullPrompt,
        subject: subject || undefined,
        theme: emailTheme,
        language: aiLanguage,
        format: 'mjml',
      });

      setIsGeneratingAi(false);

      if (res.success && res.html) {
        setCustomHtmlCode(res.html);
        setCodeFormat('mjml');
        setComposerMode('code');
        if (res.subject) setSubject(res.subject);
        showToast('success', 'MJML Multi-Card Template Created', 'Compiled into live preview and code editor.');
      } else {
        showToast('error', 'Generation Failed', res.error || 'Could not generate MJML email.');
      }
      return;
    }

    const targetDesc = audienceType === 'subscribers' 
      ? 'Newsletter subscribers and hardware enthusiasts'
      : audienceType === 'affiliates'
      ? 'Content creators, influencers, and affiliates promoting Exacoat'
      : 'Specific high-value customer';

    const res = await generateMarketingEmailCopyDirect({
      campaignType: aiCampaignType,
      productFocus: aiProductFocus,
      promoDetails: aiPromoDetails,
      tone: aiTone,
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
      if (res.subPillNotice) setSubPillNotice(res.subPillNotice);
      if (res.bodyText) setBodyText(res.bodyText);
      if (res.ctaText) setCtaText(res.ctaText);

      // Support complex cards from AI response!
      if (res.cards && res.cards.length > 0) {
        setCustomCards(res.cards);
        setShowTrustGrid(true);
      }

      if (res.promoCode) {
        setShowPromoBox(true);
        setPromoCode(res.promoCode);
        if (res.promoTitle) setPromoTitle(res.promoTitle);
        if (res.promoText) setPromoText(res.promoText);
      }

      showToast('success', 'AI Copy & Cards Generated', 'Applied witty Exacoat copy and structured feature cards.');
    } else {
      showToast('error', 'AI Generation Failed', res.error || 'Check API key connection in settings.');
    }
  };

  // Generate Full Email Template with AI (Pure HTML & MJML Studio)
  const handleGenerateAiFullHtml = async () => {
    if (!aiCodePrompt.trim()) {
      showToast('error', 'Prompt Required', 'Please describe the email design you want.');
      return;
    }
    setIsGeneratingFullHtml(true);
    showToast('info', 'AI Designing Email', `Crafting custom responsive ${codeFormat.toUpperCase()} template...`);

    const res = await generateMarketingFullHtmlEmailDirect({
      prompt: aiCodePrompt,
      subject: subject || undefined,
      theme: emailTheme,
      language: aiLanguage,
      format: codeFormat,
    });

    setIsGeneratingFullHtml(false);

    if (res.success && res.html) {
      setCustomHtmlCode(res.html);
      if (res.subject) setSubject(res.subject);
      showToast('success', 'AI Template Created', `Custom ${codeFormat.toUpperCase()} template ready in editor and live preview.`);
    } else {
      showToast('error', 'Generation Failed', res.error || 'Could not generate email template.');
    }
  };

  // Past Campaigns & Preset Handlers
  const loadPastCampaigns = async () => {
    setIsLoadingCampaigns(true);
    const res = await fetchAcumbamailCampaignsDirect(settings.acumbamail_token);
    setIsLoadingCampaigns(false);
    if (res.success && Array.isArray(res.campaigns)) {
      setAcumbaCampaigns(res.campaigns);
    } else {
      showToast('error', 'Campaigns Load Failed', res.error || 'Could not fetch campaigns from Acumbamail.');
    }
  };

  const handlePreviewCampaign = async (campaignId: string, name: string) => {
    showToast('info', 'Loading Campaign', `Fetching ${name}...`);
    const res = await fetchAcumbamailCampaignDetailDirect(campaignId, settings.acumbamail_token);
    if (res.success && res.html) {
      setViewingCampaignHtml(res.html);
      setViewingCampaignTitle(name);
    } else {
      showToast('error', 'Preview Error', res.error || 'Could not load campaign HTML.');
    }
  };

  const handleUseCampaignAsReference = async (campaignId: string, name: string) => {
    showToast('info', 'Importing Reference', `Loading details for ${name}...`);
    const res = await fetchAcumbamailCampaignDetailDirect(campaignId, settings.acumbamail_token);
    if (res.success) {
      if (res.subject) setSubject(res.subject);
      setCampaignName(`${name} (Reference)`);
      setShowReferencesModal(false);
      showToast('success', 'Reference Imported', `Loaded subject and title from ${name}.`);
    } else {
      showToast('error', 'Import Error', res.error || 'Failed to import campaign.');
    }
  };

  const handleApplyPreset = (p: MarketingPreset) => {
    setEmailTheme(p.theme);
    setShowHeader(p.showHeader ?? false);
    setShowBadge(p.showBadge ?? false);
    setLogoPosition(p.logoPosition ?? 'top');
    setSubject(p.subject);
    setPreheader(p.preheader);
    setBadgeText(p.badgeText);
    setBadgeVariant(p.badgeVariant);
    setHeadline(p.headline);
    setRecipientGreeting(p.recipientGreeting);
    setSubPillNotice(p.subPillNotice || '');
    setBodyText(p.bodyText);
    setShowPromoBox(p.showPromoBox);
    if (p.promoCode) setPromoCode(p.promoCode);
    if (p.promoTitle) setPromoTitle(p.promoTitle);
    if (p.promoText) setPromoText(p.promoText);
    setCtaText(p.ctaText);
    setCtaUrl(p.ctaUrl);
    setPrimaryCtaColor(p.primaryCtaColor);
    setShowTrustGrid(p.showTrustGrid);
    if (p.bannerImageUrl) setBannerImageUrl(p.bannerImageUrl);
    if (p.bannerAspectRatio) setBannerAspectRatio(p.bannerAspectRatio);
    setShowReferencesModal(false);
    showToast('success', 'Preset Applied', `Loaded "${p.name}".`);
  };

  const handleSaveCurrentAsPreset = () => {
    if (!customPresetName.trim()) {
      showToast('error', 'Name Required', 'Please enter a name for your custom preset.');
      return;
    }
    const newPreset: MarketingPreset = {
      id: `custom_${Date.now()}`,
      name: customPresetName.trim(),
      desc: `Saved on ${new Date().toLocaleDateString()}`,
      isBuiltIn: false,
      theme: emailTheme,
      showHeader,
      showBadge,
      logoPosition,
      subject,
      preheader,
      badgeText,
      badgeVariant,
      headline,
      recipientGreeting,
      subPillNotice,
      bodyText,
      showPromoBox,
      promoCode,
      promoTitle,
      promoText,
      ctaText,
      ctaUrl,
      primaryCtaColor,
      showTrustGrid,
      bannerImageUrl,
      bannerAspectRatio,
    };

    const userCreated = savedTemplates.filter(p => !p.isBuiltIn);
    const updatedUserCreated = [newPreset, ...userCreated];
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedUserCreated));
      setSavedTemplates([...BUILTIN_PRESETS, ...updatedUserCreated]);
      setCustomPresetName('');
      showToast('success', 'Reference Saved', `Saved "${newPreset.name}" to your reference library.`);
    } catch {
      showToast('error', 'Storage Error', 'Could not save preset to browser storage.');
    }
  };

  const handleDeleteCustomPreset = (id: string) => {
    const remaining = savedTemplates.filter(p => p.id !== id);
    const userOnly = remaining.filter(p => !p.isBuiltIn);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userOnly));
      setSavedTemplates(remaining);
      showToast('info', 'Preset Removed', 'Reference removed from your library.');
    } catch {}
  };

  // Computed Marketing Email HTML Options
  const emailOptions: MarketingEmailOptions = useMemo(() => ({
    theme: emailTheme,
    subject,
    preheaderText: preheader,
    showHeader,
    showBadge,
    logoPosition,
    badgeText,
    badgeVariant,
    headline,
    recipientGreeting: audienceType === 'affiliates' ? 'Hi Creator,' : recipientGreeting,
    bannerImageUrl: bannerImageUrl || undefined,
    bannerImageAlt,
    bannerLinkUrl: bannerLinkUrl || undefined,
    bannerAspectRatio,
    subPillNotice: subPillNotice.trim() || undefined,
    bodyText,
    highlightTitle: showPromoBox ? promoTitle : undefined,
    highlightText: showPromoBox ? promoText : undefined,
    promoCode: showPromoBox ? promoCode : undefined,
    ctaText: ctaText || undefined,
    ctaUrl: ctaUrl || undefined,
    primaryCtaColor,
    secondaryCtaText: showSecondaryCta ? secondaryCtaText : undefined,
    secondaryCtaUrl: showSecondaryCta ? secondaryCtaUrl : undefined,
    trustCards: customCards.length > 0 ? customCards : undefined,
    showTrustGrid,
    unsubscribeUrl: '{{unsubscribe_url}}',
  }), [
    emailTheme,
    subject,
    preheader,
    showHeader,
    showBadge,
    logoPosition,
    badgeText,
    badgeVariant,
    headline,
    recipientGreeting,
    audienceType,
    bannerImageUrl,
    bannerImageAlt,
    bannerLinkUrl,
    bannerAspectRatio,
    subPillNotice,
    bodyText,
    showPromoBox,
    promoTitle,
    promoText,
    promoCode,
    ctaText,
    ctaUrl,
    primaryCtaColor,
    showSecondaryCta,
    secondaryCtaText,
    secondaryCtaUrl,
    customCards,
    showTrustGrid,
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

    const contentToSend = composerMode === 'code' ? (compiledHtml || customHtmlCode) : renderedEmail.html;
    setIsSendingTest(true);
    const fromEmail = settings.acumbamail_from_email || 'sales@exacoat.com';
    const fromName = settings.acumbamail_from_name || 'Exacoat';

    const res = await sendAcumbamailSingleEmailDirect({
      toEmail: testEmailAddress,
      subject: `[TEST] ${subject}`,
      bodyHtml: contentToSend,
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
    const contentToSend = composerMode === 'code' ? (compiledHtml || customHtmlCode) : renderedEmail.html;

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
        contentHtml: contentToSend,
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
          bodyHtml: contentToSend,
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
        bodyHtml: contentToSend,
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
      <GlassCard className="p-4 md:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Marketing Studio</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Acumbamail Engine
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Precision branded campaigns with witty Exacoat tone &amp; dual live preview.
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher */}
        <div className="flex items-center bg-zinc-100 dark:bg-white/[0.04] p-1 rounded-xl border border-zinc-200/80 dark:border-white/10 shadow-sm w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setComposerMode('visual')}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              composerMode === 'visual'
                ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Visual Studio</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerMode('code');
              if (!customHtmlCode || customHtmlCode.trim() === '') {
                setCustomHtmlCode(renderedEmail.html);
              }
            }}
            className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              composerMode === 'code'
                ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>MJML / Code</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowReferencesModal(true);
              if (acumbaCampaigns.length === 0) loadPastCampaigns();
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 bg-zinc-100 dark:bg-white/[0.05] border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:text-amber-500 hover:border-amber-500/30"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Library</span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Test Send</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 bg-[#111111] hover:bg-zinc-800 text-white font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch</span>
          </Button>
        </div>
      </GlassCard>

      {/* Quick Presets Sub-bar */}
      <div className="flex items-center justify-between gap-3 text-xs px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1 mr-1">
            <Bookmark className="w-3 h-3 text-amber-500" />
            Presets:
          </span>
          {savedTemplates.slice(0, 3).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-amber-500 hover:border-amber-500/50 border border-zinc-200/80 dark:border-white/10 shrink-0 transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${p.theme === 'dark' ? 'bg-amber-500' : 'bg-blue-500'}`} />
              <span>{p.name.split(' (')[0]}</span>
            </button>
          ))}
        </div>

        {composerMode === 'code' && (
          <button
            type="button"
            onClick={() => {
              setCustomHtmlCode(renderedEmail.html);
              showToast('info', 'Code Synced', 'Overwrote HTML code with current visual layout.');
            }}
            className="text-[11px] font-semibold text-zinc-500 hover:text-amber-500 flex items-center gap-1 transition-colors shrink-0"
            title="Sync current visual builder layout into the HTML editor"
          >
            <RotateCw className="w-3 h-3" />
            <span>Sync from Visual</span>
          </button>
        )}
      </div>

      {/* Main Studio Grid: 2 Columns (Composer & Live Dual Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-4">

          {/* AI Copywriter Assistant Drawer / Quick Assist Bar */}
          <GlassCard className="p-4 md:p-5 space-y-3.5 border-amber-500/25 bg-amber-500/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                      AI Copywriting Assistant
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Antislop Filter Active
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Generates witty, observant Exacoat brand copy and multi-card layouts with zero buzzwords.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiPanel(!showAiPanel)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-amber-500 flex items-center gap-1.5 transition-colors"
              >
                <span>{showAiPanel ? 'Minimize' : 'Open Assistant'}</span>
                {showAiPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Prompt Chips (Always accessible) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1">
                Quick Angles:
              </span>
              {[
                { label: 'New Release Drop', val: 'New Device / Skin Release' },
                { label: 'Bare vs Case Dilemma', val: 'Hardware Comparison' },
                { label: 'Flash Sale', val: 'Promotional / Flash Sale' },
                { label: 'Creator VIP', val: 'Affiliate Creator Opportunity' },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => {
                    setAiCampaignType(chip.val);
                    if (!showAiPanel) setShowAiPanel(true);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    aiCampaignType === chip.val
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold'
                      : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showAiPanel && (
              <div className="space-y-3.5 pt-2 border-t border-zinc-200/80 dark:border-white/[0.06]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Campaign Angle
                    </label>
                    <select
                      value={aiCampaignType}
                      onChange={(e) => setAiCampaignType(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="New Device / Skin Release">New Device / Texture Drop</option>
                      <option value="Promotional / Flash Sale">Flash Sale / Discount Promo</option>
                      <option value="Hardware Comparison">Hardware Dilemma (Bare vs Case vs Wrap)</option>
                      <option value="Affiliate Creator Opportunity">Affiliate Bonus / Creator Opportunity</option>
                      <option value="VIP Customer Re-engagement">VIP Customer Re-engagement</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Tone Voice
                    </label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="Exacoat Studio Wit (Dry & Observant)">Exacoat Studio Wit (Dry & Observant)</option>
                      <option value="Hardware Teardown & Tech Wit">Hardware Teardown & Tech Wit</option>
                      <option value="Understated Luxury & Minimalist">Understated Luxury & Minimalist</option>
                      <option value="Creator & Partner Exclusive">Creator & Partner Exclusive</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Language
                    </label>
                    <div className="flex items-center gap-1.5 h-9">
                      <button
                        type="button"
                        onClick={() => setAiLanguage('en')}
                        className={`flex-1 h-full rounded-xl border text-xs font-bold transition-all ${
                          aiLanguage === 'en'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiLanguage('id')}
                        className={`flex-1 h-full rounded-xl border text-xs font-bold transition-all ${
                          aiLanguage === 'id'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400'
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
                      Product Focus / Device Models
                    </label>
                    <Input
                      type="text"
                      value={aiProductFocus}
                      onChange={(e) => setAiProductFocus(e.target.value)}
                      placeholder="e.g. iPhone 17 and Pixel 10 skins in Matrix texture"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Promo Code / Special Offer (Optional)
                    </label>
                    <Input
                      type="text"
                      value={aiPromoDetails}
                      onChange={(e) => setAiPromoDetails(e.target.value)}
                      placeholder="e.g. 15% off with code EXA15"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-zinc-200/80 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Banned: "elevate", "seamless"
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      No em dashes
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Structured Cards Support
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGenerateAiCopy('visual')}
                      disabled={isGeneratingAi}
                      className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingAi ? 'Generating...' : 'Generate Copy & Cards'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateAiCopy('mjml')}
                      disabled={isGeneratingAi}
                      className="flex-1 sm:flex-initial border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold flex items-center justify-center gap-1.5"
                      title="Generate a multi-card responsive MJML template"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-500" />
                      <span>Full MJML</span>
                    </Button>
                  </div>
                </div>

                {/* AI Generated Subject Suggestions */}
                {aiGeneratedSubjects.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/[0.06]">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                      AI Suggested Subject Lines:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {aiGeneratedSubjects.map((sub, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSubject(sub);
                            showToast('info', 'Subject Line Applied', sub);
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
              </div>
            )}
          </GlassCard>

          {composerMode === 'visual' ? (
            <>
              {/* Visual Studio Workspace Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-white/[0.04] rounded-2xl border border-zinc-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'content'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-500" />
                  <span>Content &amp; Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('visuals')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'visuals'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  <span>Visuals &amp; Brand</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('audience')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'audience'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span>Audience &amp; Launch</span>
                  <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {audienceType === 'subscribers' ? 'Lists' : audienceType === 'affiliates' ? 'Creators' : '1:1'}
                  </span>
                </button>
              </div>

              {/* TAB 1: Content & Copy */}
              {activeTab === 'content' && (
                <GlassCard className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Email Story &amp; Messaging
                      </h3>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">Exacoat Editorial Tone</span>
                  </div>

                  {/* Subject Line & Preheader */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          Subject Line
                        </label>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {subject.length} chars
                        </span>
                      </div>
                      <Input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject line in inbox"
                        className="text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          Preheader Snippet
                        </label>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Preview text
                        </span>
                      </div>
                      <Input
                        type="text"
                        value={preheader}
                        onChange={(e) => setPreheader(e.target.value)}
                        placeholder="Displayed next to subject in inbox"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Headline & Greeting */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
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
                        Greeting
                      </label>
                      <Input
                        type="text"
                        value={recipientGreeting}
                        onChange={(e) => setRecipientGreeting(e.target.value)}
                        placeholder="Hi there,"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Body Text */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        Body Story Copy
                      </label>
                      <span className="text-[10px] text-zinc-400">
                        Separate paragraphs with blank lines
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Write your email story..."
                      className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                  </div>

                  {/* Action Buttons (CTA) */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.06] space-y-3">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                      Call to Action Buttons
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                          Primary Button Label
                        </label>
                        <Input
                          type="text"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          placeholder="Explore Collection"
                          className="text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                          Primary Button Destination URL
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

                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSecondaryCta}
                          onChange={(e) => setShowSecondaryCta(e.target.checked)}
                          className="rounded text-amber-500"
                        />
                        <span>Include secondary action link / button</span>
                      </label>

                      {showSecondaryCta && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pl-4 border-l-2 border-amber-500/30 mt-2">
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
                  </div>

                  {/* Promo Code Box Accordion */}
                  <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.01] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPromoBox}
                          onChange={(e) => setShowPromoBox(e.target.checked)}
                          className="rounded text-amber-500"
                        />
                        <span>Include Coupon / Exclusive Perk Box</span>
                      </label>
                      {showPromoBox && <Gift className="w-4 h-4 text-amber-500" />}
                    </div>

                    {showPromoBox && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
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
                </GlassCard>
              )}

              {/* TAB 2: Visuals & Brand */}
              {activeTab === 'visuals' && (
                <div className="space-y-4">
                  {/* Header Bar & Logo Placement Card */}
                  <GlassCard className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                          Header Bar &amp; Logo Placement
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Configure whether the header bar is visible and where the brand wordmark appears.
                        </p>
                      </div>
                    </div>

                    {/* Show Top Header Bar Toggle (Hidden by Default!) */}
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            Show Top Header Bar
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400">
                            {showHeader ? 'Visible' : 'Hidden by Default'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          When hidden, gives an editorial look without the bordered top header row.
                        </p>
                      </div>

                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showHeader}
                          onChange={(e) => setShowHeader(e.target.checked)}
                          className="rounded text-amber-500 w-4 h-4"
                        />
                      </label>
                    </div>

                    {!showHeader ? (
                      /* When Top Header is Hidden: Choose Logo Placement */
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                          Brand Logo Position
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setLogoPosition('top')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              logoPosition === 'top'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                            }`}
                          >
                            Top of Card
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoPosition('bottom')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              logoPosition === 'bottom'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                            }`}
                          >
                            Bottom (Above Footer)
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoPosition('none')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              logoPosition === 'none'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                            }`}
                          >
                            Hidden (Footer Only)
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* When Top Header is Visible: Show Category Badge Option */
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.06] space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                              Category Badge Pill
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Displays pill on the right side of the header (hidden by default)
                            </span>
                          </div>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showBadge}
                              onChange={(e) => setShowBadge(e.target.checked)}
                              className="rounded text-amber-500 w-4 h-4"
                            />
                          </label>
                        </div>

                        {showBadge && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
                            <div>
                              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Badge Text</label>
                              <Input
                                type="text"
                                value={badgeText}
                                onChange={(e) => setBadgeText(e.target.value)}
                                placeholder="NEW RELEASE"
                                className="text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Badge Variant</label>
                              <select
                                value={badgeVariant}
                                onChange={(e: any) => setBadgeVariant(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                              >
                                <option value="amber">Amber Gold</option>
                                <option value="emerald">Emerald Green</option>
                                <option value="blue">Electric Blue</option>
                                <option value="purple">Royal Purple</option>
                                <option value="zinc">Subtle Zinc</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-Banner Capsule Notice Pill */}
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          Sub-Banner Capsule Notice
                        </label>
                        {subPillNotice && (
                          <button
                            type="button"
                            onClick={() => setSubPillNotice('')}
                            className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <Input
                        type="text"
                        value={subPillNotice}
                        onChange={(e) => setSubPillNotice(e.target.value)}
                        placeholder="Limited Time Only • Complimentary Replacement Guarantee"
                        className="text-xs"
                      />

                      {/* Live Mini Preview of the Refined Pill */}
                      {subPillNotice && (
                        <div className="pt-1 flex items-center justify-start">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400">
                            <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] leading-none">
                              {subPillNotice}
                            </span>
                          </div>
                        </div>
                      )}
                      <span className="text-[10px] text-zinc-400 block">
                        Renders as a left-aligned, borderless capsule with subtle typography above the headline.
                      </span>
                    </div>
                  </GlassCard>

                  {/* Theme & Palette Card */}
                  <GlassCard className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                          Theme &amp; Accent Palette
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black">
                        {emailTheme === 'dark' ? 'Dark Edition' : 'Light Edition'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Theme Selector */}
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                          Theme Appearance
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEmailTheme('dark')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                              emailTheme === 'dark'
                                ? 'bg-zinc-950 text-white border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:border-zinc-300'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Dark (Default)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmailTheme('light')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                              emailTheme === 'light'
                                ? 'bg-white text-zinc-950 border-zinc-400 shadow-md'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:border-zinc-300'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-zinc-400" />
                            <span>Light Mode</span>
                          </button>
                        </div>
                      </div>

                      {/* Primary CTA Color */}
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                          Action Button Accent
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrimaryCtaColor('amber')}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                              primaryCtaColor === 'amber'
                                ? 'bg-amber-500 text-black border-amber-600 font-extrabold shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent'
                            }`}
                          >
                            Amber Gold
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrimaryCtaColor('white')}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                              primaryCtaColor === 'white'
                                ? 'bg-white text-black border-zinc-300 font-extrabold shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent'
                            }`}
                          >
                            Pure White
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrimaryCtaColor('emerald')}
                            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                              primaryCtaColor === 'emerald'
                                ? 'bg-emerald-500 text-white border-emerald-600 font-extrabold shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent'
                            }`}
                          >
                            Emerald
                          </button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Hero Banner Image Card */}
                  <GlassCard className="p-5 md:p-6 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                          Hero Banner Media (Optional)
                        </h3>
                      </div>
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
                          Media Library
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowMediaModal(true)}
                          className="w-full flex items-center justify-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/25 font-bold"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                          <span>Browse Media</span>
                        </Button>
                      </div>
                    </div>

                    {/* Aspect Ratio Selector Chips */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                          Banner Aspect Ratio
                        </label>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Current: {bannerAspectRatio}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { id: '16:9', label: '16:9', desc: 'Landscape' },
                          { id: '4:3', label: '4:3', desc: 'Standard' },
                          { id: '1:1', label: '1:1', desc: 'Square' },
                          { id: '3:4', label: '3:4', desc: 'Portrait' },
                          { id: 'auto', label: 'Auto', desc: 'Natural' },
                        ].map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setBannerAspectRatio(r.id as any)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${
                              bannerAspectRatio === r.id
                                ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                            }`}
                          >
                            <span>{r.label}</span>
                            <span className="text-[9px] font-normal text-zinc-400 hidden sm:inline">{r.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {bannerImageUrl && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
                            Destination Link
                          </label>
                          <Input
                            type="text"
                            value={bannerLinkUrl}
                            onChange={(e) => setBannerLinkUrl(e.target.value)}
                            placeholder="https://exacoat.com/shop"
                            className="text-xs"
                          />
                          <p className="text-[10px] text-zinc-400 mt-1">
                            Optional URL when recipient clicks the banner image.
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <div
                            className={`relative w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-900 shadow-sm flex items-center justify-center ${
                              bannerAspectRatio === '16:9'
                                ? 'aspect-[16/9]'
                                : bannerAspectRatio === '4:3'
                                ? 'aspect-[4/3]'
                                : bannerAspectRatio === '1:1'
                                ? 'aspect-square max-h-48'
                                : bannerAspectRatio === '3:4'
                                ? 'aspect-[3/4] max-h-48'
                                : 'max-h-48'
                            }`}
                          >
                            <img
                              src={bannerImageUrl}
                              alt="Banner preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[9px] font-mono font-bold text-white uppercase">
                              {bannerAspectRatio}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </GlassCard>

                  {/* Feature & Guarantee Cards Manager */}
                  <GlassCard className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-4 h-4 text-amber-500" />
                        <div>
                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                            Feature &amp; Guarantee Cards
                          </h3>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            2-column responsive cards for device comparisons, textures, and guarantees
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTrustGrid}
                          onChange={(e) => setShowTrustGrid(e.target.checked)}
                          className="rounded text-amber-500"
                        />
                        <span>Show Cards</span>
                      </label>
                    </div>

                    {showTrustGrid && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {customCards.map((card, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                                card.highlighted 
                                  ? 'bg-amber-500/[0.04] border-amber-500/40' 
                                  : 'bg-zinc-50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={card.title}
                                  onChange={(e) => {
                                    const updated = [...customCards];
                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                    setCustomCards(updated);
                                  }}
                                  placeholder="Card Title"
                                  className="font-bold bg-transparent text-zinc-900 dark:text-white flex-1 focus:outline-none"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <label className="text-[10px] flex items-center gap-1 cursor-pointer text-zinc-500 hover:text-amber-500">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(card.highlighted)}
                                      onChange={(e) => {
                                        const updated = [...customCards];
                                        updated[idx] = { ...updated[idx], highlighted: e.target.checked };
                                        setCustomCards(updated);
                                      }}
                                      className="rounded text-amber-500 w-3 h-3"
                                    />
                                    <span>Highlight</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomCards(customCards.filter((_, i) => i !== idx));
                                    }}
                                    className="p-1 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="Delete Card"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={2}
                                value={card.desc}
                                onChange={(e) => {
                                  const updated = [...customCards];
                                  updated[idx] = { ...updated[idx], desc: e.target.value };
                                  setCustomCards(updated);
                                }}
                                placeholder="Card Description"
                                className="w-full bg-transparent text-[11px] text-zinc-600 dark:text-zinc-400 focus:outline-none resize-none leading-relaxed"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCards([
                                ...customCards,
                                { title: 'New Feature Card', desc: 'Describe the feature or guarantee benefit here.', highlighted: false }
                              ]);
                            }}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Card</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCustomCards([
                                { title: 'Installation Warranty', desc: 'If your installation slips within 2 days of delivery, we ship a free replacement.', highlighted: true },
                                { title: 'Scratch & Desk Defense', desc: 'Shields against table grit, pocket keys, and daily abrasive contact.', highlighted: false },
                                { title: 'Bubble-Free Air Release', desc: 'Micro-channels let air escape smoothly for a clean edge-to-edge finish.', highlighted: false },
                                { title: 'Authentic 3D Texture', desc: 'True tactile surface depth you can feel in hand, never flat printed ink.', highlighted: false },
                              ]);
                              showToast('info', 'Reset Cards', 'Restored Exacoat default guarantee cards.');
                            }}
                            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          >
                            Reset to Brand Defaults
                          </button>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                </div>
              )}

              {/* TAB 3: Audience & Launch */}
              {activeTab === 'audience' && (
                <div className="space-y-4">
                  {/* Audience Selector Card */}
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

                  {/* Dispatch Launchpad Card */}
                  <GlassCard className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                          Launch &amp; Delivery
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Acumbamail Connected
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.06] space-y-2">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                        Quick Send Test Email
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          placeholder="your.email@example.com"
                          className="text-xs flex-1"
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

                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                          Ready to broadcast?
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Target: {recipientCountLabel}
                        </span>
                      </div>
                      <Button
                        variant="primary"
                        onClick={() => setShowSendModal(true)}
                        className="bg-[#111111] hover:bg-zinc-800 text-white font-bold flex items-center gap-2 px-5 py-2.5"
                      >
                        <Send className="w-4 h-4" />
                        <span>Launch Campaign</span>
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              )}
            </>
          ) : (
            <>
              {/* AI Full-Email Template Designer Card */}
              <GlassCard className="p-5 md:p-6 space-y-4 border-amber-500/25 bg-amber-500/[0.03]">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      AI Full-Email Template Designer
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Antislop Responsive HTML</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Describe Email Design &amp; Layout to Generate
                  </label>
                  <textarea
                    rows={3}
                    value={aiCodePrompt}
                    onChange={(e) => setAiCodePrompt(e.target.value)}
                    placeholder="e.g. Design a sleek, dark cyberpunk product reveal for Matrix texture skins on Galaxy S25 Ultra, with 2-column feature cards, highlight promo box, and bold yellow button."
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-zinc-400 font-semibold">Quick Ideas:</span>
                    <button
                      type="button"
                      onClick={() => setAiCodePrompt('Flagship Device Drop: Dark tactical theme for new iPhone 17 skins with 2 comparison cards and replacement warranty guarantee.')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-amber-500 transition-colors"
                    >
                      Product Drop
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiCodePrompt('VIP Weekend Flash Sale: 20% off all skins with countdown notice, promo coupon VIP20, and gold action button.')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-amber-500 transition-colors"
                    >
                      Flash Sale
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiCodePrompt('Minimalist Founder Memo: A clean dark-mode letter from Exacoat team introducing our new textured cast vinyl manufacturing.')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-amber-500 transition-colors"
                    >
                      Founder Memo
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-100 dark:bg-white/[0.05] p-0.5 rounded-lg border border-zinc-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setCodeFormat('mjml')}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                          codeFormat === 'mjml'
                            ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        MJML
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodeFormat('html')}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                          codeFormat === 'html'
                            ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        HTML
                      </button>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateAiFullHtml}
                      disabled={isGeneratingFullHtml || !aiCodePrompt.trim()}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGeneratingFullHtml ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingFullHtml ? 'Designing...' : `AI Generate ${codeFormat.toUpperCase()}`}</span>
                    </Button>
                  </div>
                </div>
              </GlassCard>

              {/* Code Editor Card */}
              <GlassCard className="p-5 md:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      {codeFormat === 'mjml' ? 'MJML Semantic Source' : 'Pure HTML Source'}
                    </h3>

                    {/* Language Switcher */}
                    <div className="flex items-center bg-zinc-100 dark:bg-white/[0.06] p-0.5 rounded-lg border border-zinc-200 dark:border-white/10 ml-2">
                      <button
                        type="button"
                        onClick={() => setCodeFormat('mjml')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                          codeFormat === 'mjml'
                            ? 'bg-amber-500 text-black font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        MJML
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodeFormat('html')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                          codeFormat === 'html'
                            ? 'bg-amber-500 text-black font-extrabold'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        HTML
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {codeFormat === 'mjml' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (compiledHtml) {
                            setCustomHtmlCode(compiledHtml);
                            setCodeFormat('html');
                            showToast('success', 'Compiled to HTML', 'Replaced MJML with compiled HTML code.');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-100 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
                        title="Compile MJML and paste raw HTML into editor"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Compile to Raw HTML</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(customHtmlCode);
                        showToast('success', 'Copied', `${codeFormat.toUpperCase()} code copied to clipboard.`);
                      }}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </button>
                  </div>
                </div>

                {/* Subject line input for code mode */}
                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Campaign Subject Line
                  </label>
                  <Input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line for this custom email"
                    className="text-xs font-semibold"
                  />
                </div>

                {/* Live Compilation Status Banner */}
                {codeFormat === 'mjml' && (
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    isCompilingMjml 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                      : mjmlErrors.length === 0
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isCompilingMjml ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : mjmlErrors.length === 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span className="font-semibold">
                        {isCompilingMjml
                          ? 'Compiling MJML in real-time...'
                          : mjmlErrors.length === 0
                          ? 'MJML 4.x compiled successfully into cross-client HTML'
                          : `MJML Validation: ${mjmlErrors[0]}`}
                      </span>
                    </div>
                    {compiledHtml && (
                      <span className="text-[10px] font-mono opacity-70">
                        {compiledHtml.length} compiled bytes
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                      {codeFormat === 'mjml' ? 'MJML Markup' : 'Responsive HTML'}
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {customHtmlCode.length} characters &bull; Live Preview synced
                    </span>
                  </div>
                  <textarea
                    rows={22}
                    value={customHtmlCode}
                    onChange={(e) => setCustomHtmlCode(e.target.value)}
                    className="w-full p-3 font-mono text-[11px] leading-relaxed rounded-xl bg-zinc-950 text-emerald-400 border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 overflow-x-auto resize-y"
                    spellCheck={false}
                  />
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/05 text-[11px] text-zinc-500 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {codeFormat === 'mjml' ? 'Supported MJML Placeholders & Tags:' : 'Supported Acumbamail placeholders:'}
                  </p>
                  <p className="font-mono text-[10px]">
                    <code className="text-amber-500">{`{{webview_url}}`}</code> - View in browser link &nbsp;&bull;&nbsp; 
                    <code className="text-amber-500">{`{{unsubscribe_url}}`}</code> - Required Unsubscribe link
                  </p>
                </div>
              </GlassCard>
            </>
          )}
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
            <div className={`flex-1 flex justify-center ${emailTheme === 'dark' ? 'bg-[#000000]' : 'bg-zinc-200/50 dark:bg-black/40'} rounded-2xl p-2 md:p-4 overflow-hidden border border-zinc-200 dark:border-white/10 min-h-[580px]`}>
              <div
                className={`transition-all duration-300 ${emailTheme === 'dark' ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-300 dark:border-zinc-700'} rounded-2xl shadow-2xl overflow-hidden border ${
                  previewViewport === 'desktop' ? 'w-full max-w-[580px]' : 'w-[375px]'
                }`}
              >
                <iframe
                  title="Marketing Email Preview"
                  srcDoc={composerMode === 'code' ? (compiledHtml || customHtmlCode) : renderedEmail.html}
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

      {/* References & Past Campaigns Library Modal */}
      <Modal
        isOpen={showReferencesModal}
        onClose={() => setShowReferencesModal(false)}
        title="Email References & Past Campaigns"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Modal Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setReferencesTab('presets')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                referencesTab === 'presets'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Presets &amp; Templates ({savedTemplates.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setReferencesTab('acumbamail');
                if (acumbaCampaigns.length === 0) loadPastCampaigns();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                referencesTab === 'acumbamail'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Past Acumbamail Campaigns ({acumbaCampaigns.length})</span>
            </button>
          </div>

          {/* TAB 1: Saved Templates & Presets */}
          {referencesTab === 'presets' && (
            <div className="space-y-4">
              {/* Save current form as custom preset */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Save Current Composer as a Reusable Reference
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    placeholder="Reference name (e.g. 8.8 Dark Drop, VIP Exclusive)..."
                    className="text-xs"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveCurrentAsPreset}
                    className="whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Current</span>
                  </Button>
                </div>
              </div>

              {/* Presets List */}
              <div className="grid grid-cols-1 gap-3">
                {savedTemplates.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:border-amber-500/40 transition-all space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${p.theme === 'dark' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{p.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 uppercase">
                          {p.theme}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(p)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black transition-colors"
                        >
                          Load Reference
                        </button>
                        {!p.isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomPreset(p.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 transition-colors"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {p.desc && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {p.desc}
                      </p>
                    )}

                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.03] text-[11px] space-y-0.5 border border-zinc-100 dark:border-white/[0.04]">
                      <div className="truncate text-zinc-700 dark:text-zinc-300">
                        <strong>Subject:</strong> {p.subject}
                      </div>
                      <div className="truncate text-zinc-500">
                        <strong>Headline:</strong> {p.headline}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Past Acumbamail Campaigns */}
          {referencesTab === 'acumbamail' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Broadcast campaigns retrieved directly from your connected Acumbamail account:
                </span>
                <button
                  type="button"
                  onClick={loadPastCampaigns}
                  disabled={isLoadingCampaigns}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline"
                >
                  <RotateCw className={`w-3 h-3 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingCampaigns ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                  <span>Fetching past campaigns from Acumbamail...</span>
                </div>
              ) : acumbaCampaigns.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed rounded-xl">
                  No past campaigns returned or Acumbamail token needs verification.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {acumbaCampaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900 dark:text-white block truncate">
                          {camp.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Campaign ID: {camp.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePreviewCampaign(camp.id, camp.name)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview HTML</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseCampaignAsReference(camp.id, camp.name)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black transition-colors"
                        >
                          Use as Reference
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Past Campaign Full HTML Viewer Modal */}
      {viewingCampaignHtml && (
        <Modal
          isOpen={Boolean(viewingCampaignHtml)}
          onClose={() => setViewingCampaignHtml(null)}
          title={`Original Campaign: ${viewingCampaignTitle}`}
        >
          <div className="space-y-4">
            <div className="border border-zinc-300 dark:border-zinc-700 rounded-xl overflow-hidden h-[540px] bg-black">
              <iframe
                title="Historical Campaign Preview"
                srcDoc={viewingCampaignHtml}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1 gap-2">
              <span className="text-zinc-500">Rendered from Acumbamail archive</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCustomHtmlCode(viewingCampaignHtml);
                    setSubject(viewingCampaignTitle);
                    setComposerMode('code');
                    setViewingCampaignHtml(null);
                    setShowReferencesModal(false);
                    showToast('success', 'Loaded into HTML Editor', `Imported "${viewingCampaignTitle}" HTML into Code Studio.`);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Code className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit in HTML Studio</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSubject(viewingCampaignTitle);
                    setViewingCampaignHtml(null);
                    setShowReferencesModal(false);
                    showToast('success', 'Applied to Composer', `Set subject to "${viewingCampaignTitle}".`);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                >
                  Use Title Only
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* WordPress Media Library Picker Modal */}
      <MediaLibraryModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelectImage={(url) => {
          setBannerImageUrl(url);
          setShowMediaModal(false);
          showToast('success', 'Banner Image Selected', 'Banner applied from WordPress Media Library.');
        }}
        title="Select Hero Banner from WordPress Media"
        recommendedDimensions="1200x600 (or 600x300) JPG / WebP"
        currentUrl={bannerImageUrl}
      />
    </div>
  );
};
