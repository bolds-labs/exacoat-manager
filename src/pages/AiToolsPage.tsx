import React, { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { GlassCard } from '../components/ui/GlassCard';
import { CustomSelect } from '../components/ui/CustomSelect';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { 
  Bot, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Save, 
  Copy, 
  Check, 
  Zap, 
  RotateCw, 
  Cpu, 
  FileCode, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { 
  fetchPluginSettings, 
  savePluginSettings, 
  getCachedPluginSettings,
  testGeminiDirect, 
  testOpenAiDirect, 
  generateFandomDescriptionAi, 
  WordPressPluginSettings,
  PrivateSettingStatus
} from '../lib/wordpressBridge';

const DEFAULT_DESCRIPTION_PROMPT = `You are writing an on-page descriptive overview for an Exacoat device skin collection or texture series.

Context:
- Exacoat designs precision-engineered vinyl skins and protective wraps for smartphones, laptops, gaming consoles, and accessories.
- Each collection represents a specific finish, material texture, colorway, or design aesthetic.

Brand Voice and Tone:
- Confident, clean, understated, and authentic.
- No exclamation marks.
- No fake technical jargon or exaggerated marketing claims (e.g. avoid phrases like "aerospace-grade metal", "revolutionary shield", or "ultimate game-changing protection").
- Ground descriptions in real tactile and visual characteristics: finish (matte, textured, brushed, satin), grip enhancement, scratch defense without added bulk, and clean precision fit.
- Specific yet accessible: explain the look, feel, and aesthetic appeal of the collection naturally.

SEO Instructions:
- Mention the collection or series name naturally in the first paragraph only.
- Use semantically relevant terms such as design, precision, texture, finish, minimal bulk, and everyday durability.
- Optimize for readability and search relevance. Avoid keyword stuffing.

Writing Rules:
- Write exactly 3 short paragraphs.
- Total word count must be between 100 and 150 words, strictly enforced.
- Plain text only.
- Do not use em dashes like - or long dashes of any kind. Use commas, periods, or parentheses instead.`;

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

const DEFAULT_OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'gpt-4-turbo'
];

export const AiToolsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('models');
  const { showToast } = useToast();

  // Settings State - hydrate from local cache on mount
  const [settings, setSettings] = useState<WordPressPluginSettings>(() => {
    const cached = getCachedPluginSettings();
    const cachedPrompt = cached.fandom_system_prompt || '';
    const isLegacyPrompt = cachedPrompt.includes('museum prints') || cachedPrompt.includes('classical art');
    const initialPrompt = isLegacyPrompt || !cachedPrompt ? DEFAULT_DESCRIPTION_PROMPT : cachedPrompt;

    return {
      gemini_api_key: cached.gemini_api_key || '',
      vision_provider: cached.vision_provider || cached.ai_provider || 'gemini',
      ai_provider: cached.vision_provider || cached.ai_provider || 'gemini',
      ai_model: cached.gemini_model || cached.ai_model || 'gemini-2.5-flash',
      gemini_model: cached.gemini_model || cached.ai_model || 'gemini-2.5-flash',
      gemini_system_prompt: cached.gemini_system_prompt || '',
      openai_api_key: cached.openai_api_key || '',
      fandom_provider: cached.fandom_provider || cached.fandom_ai_provider || 'openai',
      fandom_model: cached.openai_model || cached.fandom_model || 'gpt-4o-mini',
      openai_model: cached.openai_model || cached.fandom_model || 'gpt-4o-mini',
      fandom_system_prompt: initialPrompt,
    };
  });
  const [secretStatus, setSecretStatus] = useState<PrivateSettingStatus>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const secretPlaceholder = (key: string, fallback: string) => {
    const status = secretStatus[key];
    if (status?.source === 'environment') return '•••••••••••••••• (Configured in wp-config.php)';
    if (status?.configured) return '•••••••••••••••• (Configured in CMS settings)';
    return fallback;
  };

  const secretSourceBadge = (key: string) => {
    const status = secretStatus[key];
    if (!status?.configured) return null;
    return (
      <span className={clsx(
        "inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border",
        status.source === 'environment'
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-amber-500/10 text-[#f3aa18] border-amber-500/20"
      )}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        <span>{status.source === 'environment' ? 'Configured in wp-config.php' : 'Configured in CMS'}</span>
      </span>
    );
  };

  // Prompt Expander
  const [showFandomPrompt, setShowFandomPrompt] = useState(false);

  // Dynamic Available Models Lists
  const [geminiModels, setGeminiModels] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('exacoat_gemini_models_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_GEMINI_MODELS, ...parsed]));
        }
      }
    } catch {}
    return DEFAULT_GEMINI_MODELS;
  });

  const [openaiModels, setOpenaiModels] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('exacoat_openai_models_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_OPENAI_MODELS, ...parsed]));
        }
      }
    } catch {}
    return DEFAULT_OPENAI_MODELS;
  });

  // Individual API Test Status
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<any>(null);
  const [isTestingOpenAi, setIsTestingOpenAi] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<any>(null);

  // Description Generator Playground State
  const [fandomTopic, setFandomTopic] = useState('Matte Carbon Fiber');
  const [fandomProvider, setFandomProvider] = useState<'openai' | 'gemini'>('openai');
  const [isGeneratingFandom, setIsGeneratingFandom] = useState(false);
  const [fandomResult, setFandomResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    const res = await fetchPluginSettings();
    if (res.secretStatus) {
      setSecretStatus(res.secretStatus);
    }
    if (res.success && res.settings) {
      const loadedGeminiModel = res.settings.gemini_model || res.settings.ai_model || 'gemini-2.5-flash';
      const loadedOpenAiModel = res.settings.openai_model || res.settings.fandom_model || 'gpt-4o-mini';

      const currentPrompt = res.settings?.fandom_system_prompt || '';
      const isLegacyPrompt = currentPrompt.includes('museum prints') || currentPrompt.includes('classical art');
      const resolvedPrompt = isLegacyPrompt || !currentPrompt ? DEFAULT_DESCRIPTION_PROMPT : currentPrompt;

      setSettings(prev => ({
        ...prev,
        ...res.settings,
        gemini_model: loadedGeminiModel,
        ai_model: loadedGeminiModel,
        openai_model: loadedOpenAiModel,
        fandom_model: loadedOpenAiModel,
        fandom_system_prompt: resolvedPrompt,
      }));

      if (loadedGeminiModel) {
        setGeminiModels(prev => {
          const updated = Array.from(new Set([loadedGeminiModel, ...prev]));
          try {
            localStorage.setItem('exacoat_gemini_models_cache', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
      if (loadedOpenAiModel) {
        setOpenaiModels(prev => {
          const updated = Array.from(new Set([loadedOpenAiModel, ...prev]));
          try {
            localStorage.setItem('exacoat_openai_models_cache', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }
    setIsLoadingSettings(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const res = await savePluginSettings(settings);
    if (res.success) {
      showToast('success', 'AI Settings Saved', 'Model preferences, API keys, and system prompts saved in WordPress.');
      await loadSettings();
    } else {
      showToast('error', 'Save Failed', res.error || 'Failed updating AI settings.');
    }
    setIsSavingSettings(false);
  };

  const handleGeminiModelChange = async (val: string) => {
    const updated = {
      ...settings,
      gemini_model: val,
      ai_model: val,
    };
    setSettings(updated);
    setGeminiModels(prev => {
      const merged = Array.from(new Set([val, ...prev]));
      try {
        localStorage.setItem('exacoat_gemini_models_cache', JSON.stringify(merged));
      } catch {}
      return merged;
    });

    const res = await savePluginSettings(updated);
    if (res.success) {
      showToast('success', 'Model Saved', `Active Gemini model set to ${val}`);
    } else {
      showToast('info', 'Model Updated Locally', `Model set to ${val}`);
    }
  };

  const handleOpenAiModelChange = async (val: string) => {
    const updated = {
      ...settings,
      openai_model: val,
      fandom_model: val,
    };
    setSettings(updated);
    setOpenaiModels(prev => {
      const merged = Array.from(new Set([val, ...prev]));
      try {
        localStorage.setItem('exacoat_openai_models_cache', JSON.stringify(merged));
      } catch {}
      return merged;
    });

    const res = await savePluginSettings(updated);
    if (res.success) {
      showToast('success', 'Model Saved', `Active OpenAI model set to ${val}`);
    } else {
      showToast('info', 'Model Updated Locally', `Model set to ${val}`);
    }
  };

  const [showCustomOpenAiInput, setShowCustomOpenAiInput] = useState(false);
  const [customOpenAiModel, setCustomOpenAiModel] = useState('');
  const [showCustomGeminiInput, setShowCustomGeminiInput] = useState(false);
  const [customGeminiModel, setCustomGeminiModel] = useState('');

  const handleApplyCustomOpenAiModel = async () => {
    const trimmed = customOpenAiModel.trim();
    if (!trimmed) {
      showToast('warning', 'Model ID Required', 'Please enter a model ID (e.g. gpt-5.6-terra).');
      return;
    }
    await handleOpenAiModelChange(trimmed);
    setShowCustomOpenAiInput(false);
    setCustomOpenAiModel('');
  };

  const handleApplyCustomGeminiModel = async () => {
    const trimmed = customGeminiModel.trim();
    if (!trimmed) {
      showToast('warning', 'Model ID Required', 'Please enter a model ID (e.g. gemini-2.5-pro).');
      return;
    }
    await handleGeminiModelChange(trimmed);
    setShowCustomGeminiInput(false);
    setCustomGeminiModel('');
  };

  const handleFetchGeminiModels = async () => {
    const isConfigured = Boolean(settings.gemini_api_key || secretStatus['gemini_api_key']?.configured);
    if (!isConfigured) {
      showToast('warning', 'API Key Required', 'Please enter your Google Gemini API Key first.');
      return;
    }
    setIsTestingGemini(true);
    const res = await testGeminiDirect(settings.gemini_api_key || undefined);
    setGeminiTestResult(res);
    setIsTestingGemini(false);

    if (res.success) {
      if (res.available_models && res.available_models.length > 0) {
        const merged = Array.from(new Set([
          ...res.available_models,
          ...geminiModels,
          settings.gemini_model || '',
        ])).filter(Boolean);
        setGeminiModels(merged);
        try {
          localStorage.setItem('exacoat_gemini_models_cache', JSON.stringify(merged));
        } catch {}
        showToast('success', 'Models Fetched', `Found ${res.available_models.length} active Gemini models (${res.latency_ms}ms)`);
      } else {
        showToast('success', 'Gemini Connected', `Connected in ${res.latency_ms}ms.`);
      }
    } else {
      showToast('error', 'Gemini Connection Failed', res.message);
    }
  };

  const handleFetchOpenAiModels = async () => {
    const isConfigured = Boolean(settings.openai_api_key || secretStatus['openai_api_key']?.configured);
    if (!isConfigured) {
      showToast('warning', 'API Key Required', 'Please enter your OpenAI API Key first.');
      return;
    }
    setIsTestingOpenAi(true);
    const res = await testOpenAiDirect(settings.openai_api_key || undefined);
    setOpenaiTestResult(res);
    setIsTestingOpenAi(false);

    if (res.success) {
      if (res.available_models && res.available_models.length > 0) {
        const merged = Array.from(new Set([
          ...res.available_models,
          ...openaiModels,
          settings.openai_model || '',
        ])).filter(Boolean);
        setOpenaiModels(merged);
        try {
          localStorage.setItem('exacoat_openai_models_cache', JSON.stringify(merged));
        } catch {}
        showToast('success', 'OpenAI Models Fetched', `Found ${res.available_models.length} active OpenAI models (${res.latency_ms}ms)`);
      } else {
        showToast('success', 'OpenAI Online', `OpenAI API connected in ${res.latency_ms}ms.`);
      }
    } else {
      showToast('error', 'OpenAI Connection Failed', res.message);
    }
  };

  const handleGenerateFandom = async () => {
    if (!fandomTopic.trim()) {
      showToast('error', 'Topic Required', 'Please enter a collection or theme name.');
      return;
    }
    setIsGeneratingFandom(true);
    const currentModel = fandomProvider === 'openai' 
      ? (settings.openai_model || settings.fandom_model) 
      : (settings.gemini_model || settings.ai_model);

    const res = await generateFandomDescriptionAi(fandomTopic, fandomProvider, {
      system_prompt: settings.fandom_system_prompt,
      model: currentModel,
      openai_api_key: settings.openai_api_key,
      gemini_api_key: settings.gemini_api_key,
    });
    setFandomResult(res);
    setIsGeneratingFandom(false);

    if (res.success && res.text) {
      showToast('success', 'Description Generated', `Generated via ${res.model_used || 'AI'} in ${res.latency_ms || 0}ms`);
    } else {
      showToast('error', 'Generation Failed', res.message || 'Check OpenAI or Gemini API key');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast('info', 'Copied to Clipboard', `${label} copied.`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const geminiOptions = useMemo(() => {
    const activeModel = settings.gemini_model || settings.ai_model || 'gemini-2.5-flash';
    const allModels = Array.from(new Set([activeModel, ...geminiModels]));
    return allModels.map(m => {
      let badge: string | undefined = undefined;
      let badgeVariant: 'lime' | 'amber' | 'rose' | 'zinc' | undefined = undefined;
      let subtitle = 'Google Gemini Model';

      if (m === activeModel) {
        badge = 'Active';
        badgeVariant = 'lime';
      } else if (m.includes('2.5-pro')) {
        badge = 'Pro 2.5';
        badgeVariant = 'amber';
      } else if (m.includes('2.5-flash')) {
        badge = 'Flash 2.5';
        badgeVariant = 'lime';
      } else if (m.includes('2.0-flash-lite')) {
        badge = 'Lite 2.0';
        badgeVariant = 'zinc';
      } else if (m.includes('2.0-flash')) {
        badge = 'Flash 2.0';
        badgeVariant = 'lime';
      } else if (m.includes('pro')) {
        badge = 'Pro';
        badgeVariant = 'amber';
      } else if (m.includes('flash')) {
        badge = 'Flash';
        badgeVariant = 'zinc';
      }

      if (m.includes('2.5-pro')) {
        subtitle = 'Advanced Reasoning & Code (Latest)';
      } else if (m.includes('2.5-flash')) {
        subtitle = 'Fast Multimodal Intelligence (Latest)';
      } else if (m.includes('2.0-flash-lite')) {
        subtitle = 'Ultra-fast & Cost-Efficient 2.0';
      } else if (m.includes('2.0-flash')) {
        subtitle = 'High-Speed Multimodal 2.0';
      } else if (m.includes('pro')) {
        subtitle = 'Deep Reasoning & Long Context';
      } else if (m.includes('flash')) {
        subtitle = 'Fast Multimodal Model';
      }

      return {
        value: m,
        label: m,
        badge,
        badgeVariant,
        subtitle,
      };
    });
  }, [geminiModels, settings.gemini_model, settings.ai_model]);

  const openaiOptions = useMemo(() => {
    const activeModel = settings.openai_model || settings.fandom_model || 'gpt-4o-mini';
    const allModels = Array.from(new Set([activeModel, ...openaiModels]));
    return allModels.map(m => {
      let badge: string | undefined = undefined;
      let badgeVariant: 'lime' | 'amber' | 'rose' | 'zinc' | undefined = undefined;
      let subtitle = 'OpenAI Model';

      if (m === activeModel) {
        badge = 'Active';
        badgeVariant = 'lime';
      } else if (m.startsWith('gpt-5')) {
        badge = 'Next-Gen';
        badgeVariant = 'lime';
      } else if (m.includes('o3-mini')) {
        badge = 'Reasoning';
        badgeVariant = 'amber';
      } else if (m.startsWith('o1')) {
        badge = 'Reasoning';
        badgeVariant = 'amber';
      } else if (m === 'gpt-4o') {
        badge = 'Flagship';
        badgeVariant = 'lime';
      } else if (m === 'gpt-4o-mini') {
        badge = 'Fast';
        badgeVariant = 'zinc';
      } else if (m.includes('4.5')) {
        badge = 'Preview';
        badgeVariant = 'rose';
      } else if (m.includes('turbo')) {
        badge = 'Turbo';
        badgeVariant = 'zinc';
      }

      if (m.startsWith('gpt-5')) {
        subtitle = 'OpenAI Next-Generation Model';
      } else if (m.includes('o3-mini')) {
        subtitle = 'High-Intelligence Coding & Reasoning (Latest)';
      } else if (m === 'o1') {
        subtitle = 'Complex Reasoning & Deep Thinking';
      } else if (m.startsWith('o1-mini')) {
        subtitle = 'Fast Reasoning for Math & Code';
      } else if (m === 'gpt-4o') {
        subtitle = 'High-Intelligence Multimodal Flagship';
      } else if (m === 'gpt-4o-mini') {
        subtitle = 'Affordable & Fast Lightweight Model';
      } else if (m.includes('4.5')) {
        subtitle = 'OpenAI 4.5 Architecture Preview';
      } else if (m.includes('turbo')) {
        subtitle = 'High-Throughput GPT-4';
      }

      return {
        value: m,
        label: m,
        badge,
        badgeVariant,
        subtitle,
      };
    });
  }, [openaiModels, settings.openai_model, settings.fandom_model]);

  return (
    <div className="space-y-6 font-sans">
      <PageHeroHeader
        title="AI Tools"
        subtitle="Configure AI engine keys, models, and generate collection descriptions."
        actions={<>
          <Button type="button" variant="secondary" onClick={loadSettings} isLoading={isLoadingSettings} leftIcon={<RotateCw className="w-3.5 h-3.5" />}>Refresh</Button>
          <Button type="button" onClick={handleSaveSettings} isLoading={isSavingSettings} leftIcon={<Save className="w-3.5 h-3.5" />}>Save Changes</Button>
        </>}
      />

      <Tabs
        tabs={[{ id: 'models', label: 'Models & API Keys' }, { id: 'descriptions', label: 'Collection Descriptions' }]}
        activeTab={activeSection}
        onChange={setActiveSection}
        className="w-full sm:w-fit"
      />

      {/* Models & API Keys Tab */}
      {activeSection === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Gemini Card */}
          <GlassCard className="p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Google Gemini</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Multimodal and reasoning engine</p>
                  </div>
                </div>
                {secretSourceBadge('gemini_api_key')}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Active Gemini Model
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchGeminiModels}
                      disabled={isTestingGemini}
                      title="Pull latest models from Google Gemini API"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <RotateCw className={clsx("w-3 h-3", isTestingGemini && "animate-spin")} />
                      <span>{isTestingGemini ? 'Pulling...' : 'Pull Latest'}</span>
                    </button>
                  </div>
                  <CustomSelect
                    options={geminiOptions}
                    value={settings.gemini_model || settings.ai_model || 'gemini-2.5-flash'}
                    onChange={handleGeminiModelChange}
                    placeholder="Select Gemini Model"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1.5 px-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Active: <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{settings.gemini_model || 'gemini-2.5-flash'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomGeminiInput(!showCustomGeminiInput)}
                      className="text-blue-500 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                    >
                      {showCustomGeminiInput ? 'Close Custom' : '+ Custom Model'}
                    </button>
                  </div>

                  {showCustomGeminiInput && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={customGeminiModel}
                        onChange={e => setCustomGeminiModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-pro, custom-gemini"
                        className="flex-1 p-2 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyCustomGeminiModel}
                      >
                        Apply
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowCustomGeminiInput(false)}
                        className="text-xs text-zinc-400 hover:text-white px-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets['gemini_api_key'] ? 'text' : 'password'}
                      value={settings.gemini_api_key}
                      onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })}
                      placeholder={secretPlaceholder('gemini_api_key', 'AIzaSy...')}
                      className="w-full p-2.5 pr-10 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('gemini_api_key')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      {showSecrets['gemini_api_key'] ? <EyeOff className="w-4 h-4 text-[#f3aa18]" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchGeminiModels}
                isLoading={isTestingGemini}
                className="w-full"
                leftIcon={<Zap className="w-3.5 h-3.5 text-[#f3aa18]" />}
              >
                {isTestingGemini ? 'Connecting & Pulling Models...' : 'Test Connection & Pull Models'}
              </Button>

              {geminiTestResult && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-800">
                    <span>Gemini Status:</span>
                    <span className={geminiTestResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {geminiTestResult.success ? `CONNECTED (${geminiTestResult.latency_ms}ms)` : 'ERROR'}
                    </span>
                  </div>
                  <p className="text-zinc-400">{geminiTestResult.message}</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* OpenAI Card */}
          <GlassCard className="p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">OpenAI</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Copywriting and description engine</p>
                  </div>
                </div>
                {secretSourceBadge('openai_api_key')}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Active OpenAI Model
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchOpenAiModels}
                      disabled={isTestingOpenAi}
                      title="Pull latest models from OpenAI API"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <RotateCw className={clsx("w-3 h-3", isTestingOpenAi && "animate-spin")} />
                      <span>{isTestingOpenAi ? 'Pulling...' : 'Pull Latest'}</span>
                    </button>
                  </div>
                  <CustomSelect
                    options={openaiOptions}
                    value={settings.openai_model || settings.fandom_model || 'gpt-4o-mini'}
                    onChange={handleOpenAiModelChange}
                    placeholder="Select OpenAI Model"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1.5 px-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Active: <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{settings.openai_model || 'gpt-4o-mini'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomOpenAiInput(!showCustomOpenAiInput)}
                      className="text-emerald-500 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                    >
                      {showCustomOpenAiInput ? 'Close Custom' : '+ Custom Model'}
                    </button>
                  </div>

                  {showCustomOpenAiInput && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={customOpenAiModel}
                        onChange={e => setCustomOpenAiModel(e.target.value)}
                        placeholder="e.g. gpt-5.6-terra, ft:gpt-4o:..."
                        className="flex-1 p-2 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyCustomOpenAiModel}
                      >
                        Apply
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowCustomOpenAiInput(false)}
                        className="text-xs text-zinc-400 hover:text-white px-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets['openai_api_key'] ? 'text' : 'password'}
                      value={settings.openai_api_key}
                      onChange={e => setSettings({ ...settings, openai_api_key: e.target.value })}
                      placeholder={secretPlaceholder('openai_api_key', 'sk-...')}
                      className="w-full p-2.5 pr-10 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('openai_api_key')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      {showSecrets['openai_api_key'] ? <EyeOff className="w-4 h-4 text-[#f3aa18]" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible System Prompt Editor */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFandomPrompt(!showFandomPrompt)}
                    className="w-full p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between border border-zinc-200 dark:border-white/10 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <span>Edit Description System Prompt</span>
                    </span>
                    {showFandomPrompt ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </button>

                  {showFandomPrompt && (
                    <div className="mt-2.5 space-y-2">
                      <textarea
                        rows={8}
                        value={settings.fandom_system_prompt || DEFAULT_DESCRIPTION_PROMPT}
                        onChange={e => setSettings({ ...settings, fandom_system_prompt: e.target.value })}
                        className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-zinc-300 leading-relaxed focus:outline-hidden focus:border-[#f3aa18]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSettings({ ...settings, fandom_system_prompt: DEFAULT_DESCRIPTION_PROMPT });
                            showToast('info', 'Prompt Reset', 'Description prompt restored to clean Exacoat template.');
                          }}
                          className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                        >
                          Reset to Default Prompt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchOpenAiModels}
                isLoading={isTestingOpenAi}
                className="w-full"
                leftIcon={<Zap className="w-3.5 h-3.5 text-[#f3aa18]" />}
              >
                {isTestingOpenAi ? 'Connecting & Pulling Models...' : 'Test Connection & Pull Models'}
              </Button>

              {openaiTestResult && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-800">
                    <span>OpenAI Status:</span>
                    <span className={openaiTestResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {openaiTestResult.success ? `CONNECTED (${openaiTestResult.latency_ms}ms)` : 'ERROR'}
                    </span>
                  </div>
                  <p className="text-zinc-400">{openaiTestResult.message}</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Description Generator Tab */}
      {activeSection === 'descriptions' && (
        <GlassCard className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
            <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[#f3aa18]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Generate Collection Description
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Draft a 3-paragraph SEO description for a skin collection or series.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
            <div className="space-y-4 p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Collection or Theme Name
                </label>
                <input
                  type="text"
                  value={fandomTopic}
                  onChange={e => setFandomTopic(e.target.value)}
                  placeholder="e.g. Matte Carbon Fiber, Cyber Horizon, Nordic Stone"
                  className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Model Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFandomProvider('openai')}
                    className={clsx(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      fandomProvider === 'openai'
                        ? "bg-zinc-100 dark:bg-white/15 border-zinc-300 dark:border-white/20 text-zinc-950 dark:text-white shadow-xs"
                        : "bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    )}
                  >
                    <div className="font-bold text-xs truncate">
                      {settings.openai_model || settings.fandom_model || 'OpenAI'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      OpenAI Engine
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFandomProvider('gemini')}
                    className={clsx(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      fandomProvider === 'gemini'
                        ? "bg-zinc-100 dark:bg-white/15 border-zinc-300 dark:border-white/20 text-zinc-950 dark:text-white shadow-xs"
                        : "bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    )}
                  >
                    <div className="font-bold text-xs truncate">
                      {settings.gemini_model || settings.ai_model || 'Google Gemini'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      Gemini Engine
                    </div>
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-zinc-500">
                Uses the system prompt configured under Models & API Keys.
              </p>

              <Button
                type="button"
                variant="primary"
                onClick={handleGenerateFandom}
                isLoading={isGeneratingFandom}
                className="w-full"
              >
                ✦ {isGeneratingFandom ? 'Writing Description...' : 'Generate Description'}
              </Button>
            </div>

            {/* AI Output Window */}
            <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-semibold text-zinc-300">Generated Description</span>
                {fandomResult && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    {fandomResult.model_used} • {fandomResult.latency_ms}ms
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-72 p-3 rounded-xl bg-black/50 border border-white/5 font-sans text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {fandomResult?.text || (
                  <span className="text-zinc-500 italic font-mono">
                    The generated description will appear here.
                  </span>
                )}
              </div>

              {fandomResult?.text && (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {fandomResult.text.trim().split(/\s+/).length} words
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(fandomResult.text || '', 'Generated Description')}
                    leftIcon={copiedKey === 'Generated Description' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    Copy Text
                  </Button>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
