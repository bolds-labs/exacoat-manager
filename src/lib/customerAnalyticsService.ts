import { Order } from '../types';
import { Customer } from './wordpressBridge';
import { convertToIdr, isRevenueOrder } from './formatters';

export interface UnifiedCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  username: string;
  role: string;
  city: string;
  country: string;
  ordersCount: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  isPayingCustomer: boolean;
  isRepeatCustomer: boolean;
  isVip: boolean;
  avatarUrl?: string;
  billing?: any;
  shipping?: any;
  isGuest?: boolean;
}

export interface CustomerAnalyticsSummary {
  totalCustomers: number;
  payingCustomers: number;
  repeatCustomers: number;
  repeatRate: number; // 0 to 100
  totalRevenue: number;
  averageOrderValue: number;
  topCustomers: UnifiedCustomer[];
  highestSpender: UnifiedCustomer | null;
}

export type CustomerFilterTab = 'all' | 'paying' | 'repeat' | 'vip' | 'registered' | 'guest';

export type CustomerSortOption = 
  | 'spent_desc' 
  | 'spent_asc' 
  | 'orders_desc' 
  | 'aov_desc' 
  | 'recent' 
  | 'name_asc';

/**
 * Builds a unified list of customers combining WooCommerce registered users
 * and guest order records to provide accurate customer analytics.
 */
export function buildUnifiedCustomers(
  wcCustomers: Customer[],
  orders: Order[]
): {
  customers: UnifiedCustomer[];
  summary: CustomerAnalyticsSummary;
} {
  const customerMap = new Map<string, UnifiedCustomer>();

  // 1. Initialize registered WooCommerce customers
  for (const c of wcCustomers) {
    const emailKey = (c.email || '').trim().toLowerCase();
    const idKey = String(c.id);
    const key = emailKey || `id_${idKey}`;

    const firstName = c.first_name || c.billing?.first_name || '';
    const lastName = c.last_name || c.billing?.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || c.username || (c.email ? c.email.split('@')[0] : `Customer #${c.id}`);

    const spentRaw = parseFloat(String(c.total_spent || '0')) || 0;
    const ordersCountRaw = parseInt(String(c.orders_count || '0'), 10) || 0;

    const phone = c.billing?.phone || c.shipping?.phone || '';
    const city = c.billing?.city || c.shipping?.city || '';
    const country = c.billing?.country || c.shipping?.country || 'ID';

    customerMap.set(key, {
      id: c.id,
      name,
      email: c.email || '',
      phone,
      username: c.username || '',
      role: c.role || 'customer',
      city,
      country,
      ordersCount: ordersCountRaw,
      totalSpent: spentRaw,
      avgOrderValue: ordersCountRaw > 0 ? spentRaw / ordersCountRaw : 0,
      firstOrderDate: c.date_created || null,
      lastOrderDate: null,
      isPayingCustomer: ordersCountRaw > 0 || spentRaw > 0 || !!c.is_paying_customer,
      isRepeatCustomer: ordersCountRaw >= 2,
      isVip: spentRaw >= 1000000 || ordersCountRaw >= 3,
      avatarUrl: c.avatar_url,
      billing: c.billing,
      shipping: c.shipping,
      isGuest: false,
    });
  }

  // 2. Cross-reference store orders to compute live spent, order counts, and dates
  // Also collect guest orders that may not exist in wcCustomers
  const ordersByCustomerKey = new Map<string, Order[]>();

  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;

    const email = (o.customer_email || o.billing?.email || '').trim().toLowerCase();
    const customerId = Number(o.customer_id) || 0;
    const key = email || (customerId > 0 ? `id_${customerId}` : `order_${o.id}`);

    if (!ordersByCustomerKey.has(key)) {
      ordersByCustomerKey.set(key, []);
    }
    ordersByCustomerKey.get(key)!.push(o);
  }

  // Process order groupings into the customer map
  ordersByCustomerKey.forEach((orderList, key) => {
    let customer = customerMap.get(key);

    const orderSpendTotal = orderList.reduce((sum, ord) => {
      const orderVal = (ord as any).total_idr || convertToIdr(ord.total, ord.currency);
      return sum + orderVal;
    }, 0);

    const sortedDates = orderList
      .map(o => o.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const firstDate = sortedDates[0] || null;
    const lastDate = sortedDates[sortedDates.length - 1] || null;

    if (customer) {
      // Enhance existing registered user with accurate order dates and live calculations
      const actualCount = Math.max(customer.ordersCount, orderList.length);
      const actualSpent = Math.max(customer.totalSpent, orderSpendTotal);

      customer.ordersCount = actualCount;
      customer.totalSpent = actualSpent;
      customer.avgOrderValue = actualCount > 0 ? actualSpent / actualCount : 0;
      customer.isPayingCustomer = true;
      customer.isRepeatCustomer = actualCount >= 2;
      customer.isVip = actualSpent >= 1000000 || actualCount >= 3;
      if (firstDate && (!customer.firstOrderDate || new Date(firstDate) < new Date(customer.firstOrderDate))) {
        customer.firstOrderDate = firstDate;
      }
      customer.lastOrderDate = lastDate || customer.lastOrderDate;

      // Extract phone/city if missing
      const latestOrder = orderList[orderList.length - 1];
      if (!customer.phone && (latestOrder.customer_phone || latestOrder.billing?.phone || latestOrder.shipping?.phone)) {
        customer.phone = latestOrder.customer_phone || latestOrder.billing?.phone || latestOrder.shipping?.phone || '';
      }
      if (!customer.city && (latestOrder.shipping?.city || latestOrder.billing?.city)) {
        customer.city = latestOrder.shipping?.city || latestOrder.billing?.city || '';
      }
    } else {
      // Guest Customer
      const rep = orderList[orderList.length - 1];
      const guestName = rep.customer_name || `${rep.shipping?.first_name || ''} ${rep.shipping?.last_name || ''}`.trim() || 'Guest Customer';
      const guestEmail = rep.customer_email || rep.billing?.email || '';
      const guestPhone = rep.customer_phone || rep.billing?.phone || rep.shipping?.phone || '';
      const guestCity = rep.shipping?.city || rep.billing?.city || '';
      const guestCountry = rep.shipping?.country || rep.billing?.country || 'ID';
      const count = orderList.length;

      customerMap.set(key, {
        id: rep.customer_id || 0,
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
        username: guestEmail ? guestEmail.split('@')[0] : 'guest',
        role: 'guest',
        city: guestCity,
        country: guestCountry,
        ordersCount: count,
        totalSpent: orderSpendTotal,
        avgOrderValue: count > 0 ? orderSpendTotal / count : 0,
        firstOrderDate: firstDate,
        lastOrderDate: lastDate,
        isPayingCustomer: true,
        isRepeatCustomer: count >= 2,
        isVip: orderSpendTotal >= 1000000 || count >= 3,
        billing: rep.billing,
        shipping: rep.shipping,
        isGuest: true,
      });
    }
  });

  const allCustomers = Array.from(customerMap.values());

  // 3. Compute Summary KPIs
  const totalCustomers = allCustomers.length;
  const payingCustomers = allCustomers.filter(c => c.isPayingCustomer).length;
  const repeatCustomers = allCustomers.filter(c => c.isRepeatCustomer).length;
  const repeatRate = payingCustomers > 0 ? Math.round((repeatCustomers / payingCustomers) * 100) : 0;

  const totalRevenue = allCustomers.reduce((acc, c) => acc + c.totalSpent, 0);
  const totalOrdersCount = allCustomers.reduce((acc, c) => acc + c.ordersCount, 0);
  const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Rank top customers by total spend
  const sortedBySpend = [...allCustomers].sort((a, b) => b.totalSpent - a.totalSpent);
  const topCustomers = sortedBySpend.slice(0, 5);
  const highestSpender = sortedBySpend[0] || null;

  return {
    customers: allCustomers,
    summary: {
      totalCustomers,
      payingCustomers,
      repeatCustomers,
      repeatRate,
      totalRevenue,
      averageOrderValue,
      topCustomers,
      highestSpender,
    },
  };
}

/**
 * Filter and sort unified customers list
 */
export function filterAndSortCustomers(
  customers: UnifiedCustomer[],
  options: {
    search?: string;
    tab?: CustomerFilterTab;
    sortBy?: CustomerSortOption;
  }
): UnifiedCustomer[] {
  let list = [...customers];

  // 1. Search filtering
  if (options.search && options.search.trim()) {
    const q = options.search.toLowerCase().trim();
    list = list.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  }

  // 2. Tab filtering
  if (options.tab && options.tab !== 'all') {
    switch (options.tab) {
      case 'paying':
        list = list.filter(c => c.isPayingCustomer);
        break;
      case 'repeat':
        list = list.filter(c => c.isRepeatCustomer);
        break;
      case 'vip':
        list = list.filter(c => c.isVip);
        break;
      case 'registered':
        list = list.filter(c => !c.isGuest && c.id > 0);
        break;
      case 'guest':
        list = list.filter(c => c.isGuest || c.id === 0);
        break;
    }
  }

  // 3. Sorting
  const sortBy = options.sortBy || 'spent_desc';
  list.sort((a, b) => {
    switch (sortBy) {
      case 'spent_desc':
        return b.totalSpent - a.totalSpent;
      case 'spent_asc':
        return a.totalSpent - b.totalSpent;
      case 'orders_desc':
        return b.ordersCount - a.ordersCount;
      case 'aov_desc':
        return b.avgOrderValue - a.avgOrderValue;
      case 'recent': {
        const timeA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
        const timeB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
        return timeB - timeA;
      }
      case 'name_asc':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return list;
}
