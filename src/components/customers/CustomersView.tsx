import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../../types';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { fetchCustomersDirect } from '../../lib/wordpressBridge';
import { formatCurrency, formatDate, stripEmDashes } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import { Users, Search, RefreshCw, Mail, MapPin, ShoppingBag } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchCustomersDirect({
        search: search.trim() || undefined,
        page,
        per_page: 25,
      });

      if (res.success) {
        setCustomers(res.customers);
        setTotalCount(res.total_customers);
      } else {
        showToast('warning', 'Customers Sync Warning', res.error || 'Failed loading customers');
      }
    } catch (err: any) {
      showToast('error', 'Customers Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, showToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="space-y-6">
      <PageHeroHeader
        title="Customer Intelligence CRM"
        subtitle="Manage customer profiles, registered accounts, and shipping histories"
        icon={<Users className="w-5 h-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadCustomers}
            isLoading={isLoading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={isLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span>Sync</span>
          </Button>
        }
      />

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#0d0d11] border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-500 pl-9 pr-3 py-2 rounded-xl focus:border-[#f3aa18] min-h-[44px]"
          />
        </div>

        <div className="text-xs text-zinc-400">
          Showing <span className="text-white font-bold">{customers.length}</span> of{' '}
          <span className="text-[#f3aa18] font-bold">{totalCount.toLocaleString()}</span> customers
        </div>
      </div>

      {/* Customer Table */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#f3aa18] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Querying WooCommerce customer directory...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#0d0d11] rounded-2xl border border-white/[0.08]">
          <Users className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-chakra">No Customers Found</h3>
          <p className="text-xs text-zinc-400">No customers matched your search criteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0d0d11]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400 uppercase tracking-wider font-semibold">
                <th className="p-4">Customer</th>
                <th className="p-4">Role</th>
                <th className="p-4">Primary Address</th>
                <th className="p-4">Registered Date</th>
                <th className="p-4">Orders Count</th>
                <th className="p-4 text-right">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {customers.map((c) => {
                const fullName = stripEmDashes((c.first_name + ' ' + c.last_name).trim() || c.username || 'User #' + c.id);
                const address = c.shipping?.city ? (c.shipping.city + ', ' + c.shipping.country) : (c.billing?.city ? (c.billing.city + ', ' + c.billing.country) : 'Not specified');

                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white">{fullName}</div>
                      <div className="text-zinc-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-zinc-500" />
                        <span>{c.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {c.role || 'customer'}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{address}</span>
                      </div>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {formatDate(c.date_created)}
                    </td>
                    <td className="p-4 font-mono font-medium text-zinc-200">
                      {c.orders_count !== undefined ? c.orders_count : 'N/A'}
                    </td>
                    <td className="p-4 text-right font-bold text-[#f3aa18]">
                      {c.total_spent ? formatCurrency(c.total_spent, 'IDR') : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
