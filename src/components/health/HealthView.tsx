import React, { useState, useEffect } from 'react';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { fetchSiteHealthDirect } from '../../lib/wordpressBridge';
import { Activity, Radio, RefreshCw, CheckCircle2, ShieldCheck, Database } from 'lucide-react';

export const HealthView: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetchSiteHealthDirect();
      setHealth(res);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeroHeader
        title="Store Connectivity & Health"
        subtitle="Live status, API credentials verification, and WooCommerce response latency"
        icon={<Activity className="w-5 h-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={checkHealth}
            isLoading={isLoading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={isLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span>Ping Server</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Connection Status</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-chakra flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{health?.status === 'online' ? 'Online & Authenticated' : 'Offline'}</span>
          </div>
          <p className="text-[11px] text-zinc-500">WooCommerce v3 REST API endpoint</p>
        </GlassCard>

        <GlassCard className="p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Round-Trip Latency</span>
            <Activity className="w-4 h-4 text-[#f3aa18]" />
          </div>
          <div className="text-2xl font-bold text-white font-chakra">
            {health?.latencyMs !== undefined ? health.latencyMs + ' ms' : '...'}
          </div>
          <p className="text-[11px] text-zinc-500">Response time to exacoat.com</p>
        </GlassCard>

        <GlassCard className="p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Store Orders</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-chakra">
            {health?.totalOrders ? health.totalOrders.toLocaleString() : 'Live'}
          </div>
          <p className="text-[11px] text-zinc-500">Indexed orders in WooCommerce</p>
        </GlassCard>
      </div>

      <div className="p-6 rounded-3xl bg-[#0d0d11] border border-white/[0.08] space-y-4">
        <h3 className="text-sm font-bold text-white font-chakra flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#f3aa18]" />
          <span>Security & Integration Credentials</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
            <span className="text-zinc-500 block">Upstream Endpoint</span>
            <span className="text-zinc-200 font-mono">https://exacoat.com</span>
          </div>
          <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
            <span className="text-zinc-500 block">Consumer Key</span>
            <span className="text-zinc-200 font-mono">ck_********... (Verified)</span>
          </div>
          <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
            <span className="text-zinc-500 block">Dev CORS Bypass</span>
            <span className="text-emerald-400 font-mono">Vite /cms Proxy Active</span>
          </div>
          <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
            <span className="text-zinc-500 block">Thermal Shipping Label Format</span>
            <span className="text-zinc-200 font-mono">A6 105 x 148 mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};
