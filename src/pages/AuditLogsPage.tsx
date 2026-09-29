import React, { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Tabs } from '../components/ui/Tabs';
import { WordPressSystemLogsTable } from '../components/audit/WordPressSystemLogsTable';
import { ManagerLiveAuditLogs } from '../components/audit/ManagerLiveAuditLogs';
import { EmailLogsTable } from '../components/email/EmailLogsTable';
import { Terminal, Activity, Mail } from 'lucide-react';

interface AuditLogsPageProps {}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'manager_ai' | 'wordpress' | 'emails'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('tab=emails') || search.includes('tab=emails') || hash.includes('tab=email')) {
        return 'emails';
      }
      if (hash.includes('tab=wordpress') || hash.includes('view=wordpress') || search.includes('tab=wordpress')) {
        return 'wordpress';
      }
    }
    return 'manager_ai';
  });

  // Listen to hash / route changes to switch tabs dynamically
  React.useEffect(() => {
    const handleUrlChange = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('tab=emails') || search.includes('tab=emails') || hash.includes('tab=email')) {
        setActiveTab('emails');
      } else if (hash.includes('tab=wordpress') || hash.includes('view=wordpress') || search.includes('tab=wordpress')) {
        setActiveTab('wordpress');
      } else if (hash.includes('tab=manager_ai') || search.includes('tab=manager_ai')) {
        setActiveTab('manager_ai');
      }
    };
    window.addEventListener('hashchange', handleUrlChange);
    return () => window.removeEventListener('hashchange', handleUrlChange);
  }, []);

  const handleTabChange = (tabId: string) => {
    const nextTab = tabId as 'manager_ai' | 'wordpress' | 'emails';
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#audit?tab=${nextTab}`);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header & Tab Switcher */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#f3aa18]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                Audit Logs
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-sans">
                Recent workspace events, API dispatches, and WordPress system activity.
              </p>
            </div>
          </div>

          {/* Tab Pill Buttons */}
          <Tabs
            tabs={[
              { id: 'manager_ai', label: 'Manager Activity' },
              { id: 'wordpress', label: 'WordPress Logs', icon: Terminal },
              { id: 'emails', label: 'Email Telemetry', icon: Mail },
            ]}
            activeTab={activeTab}
            onChange={handleTabChange}
          />
        </div>
      </GlassCard>

      {/* 2. Tab Content */}
      {activeTab === 'manager_ai' && <ManagerLiveAuditLogs />}
      {activeTab === 'wordpress' && <WordPressSystemLogsTable />}
      {activeTab === 'emails' && <EmailLogsTable />}
    </div>
  );
};
