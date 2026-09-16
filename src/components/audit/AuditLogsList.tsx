import React, { useState, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { AuditLog } from '../../types';
import { formatDateTime, formatDate, formatTimeAgo } from '../../lib/formatters';
import { 
  History, 
  Search, 
  User, 
  Image as ImageIcon, 
  Receipt, 
  Banknote, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp,
  Terminal
} from 'lucide-react';

interface AuditLogsListProps {
  logs: AuditLog[];
}

export const AuditLogsList: React.FC<AuditLogsListProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchQuery.toLowerCase();
      const eventName = log.event || '';
      const performer = log.performed_by || '';
      const entityId = log.entity_id || '';

      const matchesSearch =
        !q ||
        eventName.toLowerCase().includes(q) ||
        performer.toLowerCase().includes(q) ||
        entityId.toLowerCase().includes(q);

      const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;

      return matchesSearch && matchesEntity;
    });
  }, [logs, searchQuery, entityFilter]);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Receipt className="w-3.5 h-3.5 text-amber-400" />;
      case 'product':
      case 'skin':
        return <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />;
      case 'customer':
      case 'user':
        return <User className="w-3.5 h-3.5 text-indigo-400" />;
      case 'inventory':
        return <Banknote className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden">
      {/* Search & Filter Bar */}
      <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/40">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search event, user, entity ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="w-full sm:w-52">
            <SearchableCombobox
              options={[
                { value: 'all', label: 'All Entities' },
                { value: 'order', label: 'Order Events' },
                { value: 'product', label: 'Product & Skin Events' },
                { value: 'customer', label: 'Customer Events' },
                { value: 'inventory', label: 'Inventory Events' },
              ]}
              value={entityFilter}
              onChange={val => setEntityFilter(val)}
              placeholder="Filter Entity"
            />
          </div>
        </div>

        <span className="text-xs text-slate-400">
          Showing <strong className="text-white">{filteredLogs.length}</strong> activity records
        </span>
      </div>

      {/* Activity Timeline List */}
      <div className="divide-y divide-white/5">
        {filteredLogs.map(log => {
          const isExpanded = expandedLogId === log.id;

          return (
            <div
              key={log.id}
              className="p-4 hover:bg-white/[0.02] transition-colors group cursor-pointer"
              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2 rounded-xl bg-dark-850 border border-white/10 shrink-0 mt-0.5 shadow-sm">
                    {getEntityIcon(log.entity_type)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white group-hover:text-brand-300 transition-colors">
                        {log.event ? log.event.replace(/_/g, ' ') : 'System Action'}
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-white/5 border border-white/10 text-slate-300">
                        {log.entity_type}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Performed by: <strong className="text-slate-300">{log.performed_by || 'System Automation'}</strong> • Entity ID: <span className="font-mono text-slate-400">{log.entity_id ? log.entity_id.slice(0, 8) : '-'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-xs">
                    <span className="text-slate-300 font-medium block">{formatTimeAgo(log.created_at)}</span>
                    <span className="text-[10px] text-slate-500">{formatDate(log.created_at)}</span>
                  </div>

                  <button className="p-1 rounded-lg text-slate-400 group-hover:text-white">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Collapsible JSON Payload */}
              {isExpanded && log.payload && (
                <div className="mt-3 p-3 rounded-xl bg-dark-950 border border-white/10 animate-in fade-in">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Event Payload & Details
                  </span>
                  <pre className="text-[11px] font-mono text-brand-300 overflow-x-auto p-2 rounded bg-dark-900/90 border border-white/5 leading-relaxed">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold text-slate-300">No activity logs found</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
};
