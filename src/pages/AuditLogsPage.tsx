import React, { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Tabs } from '../components/ui/Tabs';
import { WordPressSystemLogsTable } from '../components/audit/WordPressSystemLogsTable';
import { ManagerLiveAuditLogs } from '../components/audit/ManagerLiveAuditLogs';
import { Terminal, Activity } from 'lucide-react';

interface AuditLogsPageProps {}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'manager_ai' | 'wordpress'>('manager_ai');

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
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as any)}
          />
        </div>
      </GlassCard>

      {/* 2. Tab Content */}
      {activeTab === 'manager_ai' ? (
        <ManagerLiveAuditLogs />
      ) : (
        <WordPressSystemLogsTable />
      )}
    </div>
  );
};
