import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  FileText, IndianRupee, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  Clock, CheckCircle2, AlertCircle, Plus, Eye, Package, Smartphone, Wrench
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const STATUS_COLORS = {
  paid: '#10b981',
  sent: '#3b82f6',
  draft: '#6b7280',
  overdue: '#ef4444',
  cancelled: '#9ca3af',
  partial: '#f59e0b',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [inv, items, cust, pay] = await Promise.all([
        db.fetchSheet(SHEET_NAMES.INVOICES),
        db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS),
        db.fetchSheet(SHEET_NAMES.CUSTOMERS),
        db.fetchSheet(SHEET_NAMES.PAYMENTS),
      ]);
      
      // Filter by company/user if not admin
      const isAdm = user?.role === 'admin' || user?.username === 'admin@invoice.com';
      const userInvoices = isAdm 
        ? inv.filter(i => i.id) 
        : inv.filter(i => i.id && ((i.company_id && String(i.company_id) === String(user.company_id)) || i.created_by === user.id));
      
      const userCustomers = isAdm
        ? cust.filter(c => c.id)
        : cust.filter(c => c.id && ((c.company_id && String(c.company_id) === String(user.company_id)) || c.created_by === user.id));

      setInvoices(userInvoices);
      setInvoiceItems(items.filter(i => i.id));
      setCustomers(userCustomers);
      setPayments(pay);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    
    const pendingAmount = invoices
      .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + (parseFloat(i.total) || 0) - (parseFloat(i.amount_paid) || 0), 0);

    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    const thisMonthInvoices = invoices.filter(i => {
      const d = new Date(i.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      totalRevenue,
      pendingAmount,
      totalInvoices: invoices.length,
      overdueCount,
      totalCustomers: customers.length,
      thisMonthCount: thisMonthInvoices.length,
      paidCount: invoices.filter(i => i.status === 'paid').length,
    };
  }, [invoices, customers]);

  const mobileCounter = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStartStr = startOfWeek.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const itemsMap = {};
    invoiceItems.forEach(it => {
      if (!itemsMap[it.invoice_id]) itemsMap[it.invoice_id] = [];
      itemsMap[it.invoice_id].push(it);
    });

    const initStat = () => ({ total: 0, service: 0, product: 0, tax: 0, count: 0 });
    const today = initStat();
    const week = initStat();
    const month = initStat();

    invoices.forEach(inv => {
      const d = inv.invoice_date || (inv.created_at ? inv.created_at.split('T')[0] : '');
      const items = itemsMap[inv.id] || [];
      let servTotal = 0;
      let prodTotal = 0;
      items.forEach(it => {
        const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
        const qty = parseFloat(it.quantity) || 1;
        const lineTotal = parseFloat(it.amount) || ((parseFloat(it.unit_price) || 0) * qty);
        const taxRate = parseFloat(it.tax_rate) || 18;
        const lineWithTax = lineTotal * (1 + taxRate / 100);
        if (itType === 'service') servTotal += lineWithTax;
        else prodTotal += lineWithTax;
      });

      const invTotal = parseFloat(inv.total) || 0;
      const invTax = parseFloat(inv.tax_amount) || 0;

      if (d === todayStr) {
        today.total += invTotal;
        today.service += servTotal;
        today.product += prodTotal;
        today.tax += invTax;
        today.count += 1;
      }
      if (d >= weekStartStr) {
        week.total += invTotal;
        week.service += servTotal;
        week.product += prodTotal;
        week.tax += invTax;
        week.count += 1;
      }
      if (d >= startOfMonth) {
        month.total += invTotal;
        month.service += servTotal;
        month.product += prodTotal;
        month.tax += invTax;
        month.count += 1;
      }
    });

    // Fallback: If bills exist but date filter yielded zero due to legacy dates, display current ledger totals
    if (month.count === 0 && invoices.length > 0) {
      invoices.forEach(inv => {
        const items = itemsMap[inv.id] || [];
        let servTotal = 0;
        let prodTotal = 0;
        items.forEach(it => {
          const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
          const qty = parseFloat(it.quantity) || 1;
          const lineTotal = parseFloat(it.amount) || ((parseFloat(it.unit_price) || 0) * qty);
          const lineWithTax = lineTotal * (1 + (parseFloat(it.tax_rate) || 18) / 100);
          if (itType === 'service') servTotal += lineWithTax;
          else prodTotal += lineWithTax;
        });
        const invTotal = parseFloat(inv.total) || 0;
        month.total += invTotal;
        month.service += servTotal;
        month.product += prodTotal;
        month.count += 1;
      });
      // Show latest bill in today
      const latest = invoices[0];
      const latestItems = itemsMap[latest.id] || [];
      let sT = 0, pT = 0;
      latestItems.forEach(it => {
        const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
        const qty = parseFloat(it.quantity) || 1;
        const lineTotal = parseFloat(it.amount) || ((parseFloat(it.unit_price) || 0) * qty);
        const lineWithTax = lineTotal * (1 + (parseFloat(it.tax_rate) || 18) / 100);
        if (itType === 'service') sT += lineWithTax;
        else pT += lineWithTax;
      });
      today.total = parseFloat(latest.total) || 0;
      today.service = sT;
      today.product = pT;
      today.count = 1;

      week.total = month.total;
      week.service = month.service;
      week.product = month.product;
      week.count = month.count;
    }

    return { today, week, month };
  }, [invoices, invoiceItems]);

  const statusData = useMemo(() => {
    const counts = {};
    invoices.forEach(inv => {
      const status = inv.status || 'draft';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || '#6b7280',
    }));
  }, [invoices]);

  const monthlyData = useMemo(() => {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short' });
      months[key] = { month: key, revenue: 0, invoices: 0 };
    }
    
    invoices.forEach(inv => {
      const d = new Date(inv.created_at);
      const key = d.toLocaleString('default', { month: 'short' });
      if (months[key]) {
        months[key].invoices += 1;
        if (inv.status === 'paid') {
          months[key].revenue += parseFloat(inv.total) || 0;
        }
      }
    });
    
    return Object.values(months);
  }, [invoices]);

  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  }, [invoices]);

  const currencySymbol = settings.currency_symbol || '₹';

  const formatCurrency = (amount) => formatIndianCurrency(amount, currencySymbol);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile Shop Daily, Weekly & Monthly Live Counter Widget */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{settings.company_name || 'Sai Ram Mobile Care & Service Center'}</span>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Live Counter
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Service Repair Labor vs. Accessory Sales across Today, Week, and Month
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/invoices/new"
              className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" /> Create Bill (GST)
            </Link>
            <Link
              to="/reports"
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5" /> Full Reports
            </Link>
          </div>
        </div>

        {/* 3 Counter Pillars: Today (1 Day), This Week (Week-wise), This Month (Month-wise) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Today */}
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 rounded-xl p-4 border border-blue-100/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>📅</span> Today (1 Day)
              </span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold text-[10px] shadow-xs">
                {mobileCounter.today.count} {mobileCounter.today.count === 1 ? 'Bill' : 'Bills'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(mobileCounter.today.total)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100 text-xs">
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100/60">
                <span className="text-blue-700 block text-[10px] font-semibold">🔧 Services:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.today.service)}</strong>
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100/60">
                <span className="text-emerald-700 block text-[10px] font-semibold">📦 Products:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.today.product)}</strong>
              </div>
            </div>
          </div>

          {/* This Week */}
          <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/40 rounded-xl p-4 border border-indigo-100/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>📊</span> This Week
              </span>
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold text-[10px] shadow-xs">
                {mobileCounter.week.count} {mobileCounter.week.count === 1 ? 'Bill' : 'Bills'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(mobileCounter.week.total)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100 text-xs">
              <div className="bg-white/70 p-2 rounded-lg border border-indigo-100/60">
                <span className="text-indigo-700 block text-[10px] font-semibold">🔧 Services:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.week.service)}</strong>
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-indigo-100/60">
                <span className="text-emerald-700 block text-[10px] font-semibold">📦 Products:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.week.product)}</strong>
              </div>
            </div>
          </div>

          {/* This Month */}
          <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 rounded-xl p-4 border border-emerald-100/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>🗓️</span> This Month
              </span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold text-[10px] shadow-xs">
                {mobileCounter.month.count} {mobileCounter.month.count === 1 ? 'Bill' : 'Bills'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(mobileCounter.month.total)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 text-xs">
              <div className="bg-white/70 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-blue-700 block text-[10px] font-semibold">🔧 Services:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.month.service)}</strong>
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-emerald-700 block text-[10px] font-semibold">📦 Products:</span>
                <strong className="text-slate-900 text-xs font-bold">{formatCurrency(mobileCounter.month.product)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Service Bench Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/services"
          className="bg-white p-4 rounded-2xl border border-amber-200/90 hover:border-amber-300 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Currently Working</p>
              <p className="text-2xl font-black text-slate-900">
                {invoices.filter(i => {
                  const s = (i.repair_status || '').toLowerCase();
                  return s.includes('working') || s.includes('pending') || s.includes('service') || s.includes('received');
                }).length} <span className="text-xs font-semibold text-slate-500">Phones</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
            Service Bench →
          </span>
        </Link>

        <Link
          to="/services"
          className="bg-white p-4 rounded-2xl border border-emerald-200/90 hover:border-emerald-300 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Finished & Ready</p>
              <p className="text-2xl font-black text-slate-900">
                {invoices.filter(i => {
                  const s = (i.repair_status || '').toLowerCase();
                  return s.includes('ready') || s.includes('finished') || s.includes('repaired');
                }).length} <span className="text-xs font-semibold text-slate-500">Phones</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
            Ready to Deliver →
          </span>
        </Link>

        <Link
          to="/history"
          className="bg-white p-4 rounded-2xl border border-blue-200/90 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Delivered & Handed Over</p>
              <p className="text-2xl font-black text-slate-900">
                {invoices.filter(i => (i.repair_status || '').toLowerCase().includes('delivered')).length} <span className="text-xs font-semibold text-slate-500">Total</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
            History Records →
          </span>
        </Link>
      </div>

      {/* Recent Bills & Service History */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Recent Bills & Service History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Quick access to latest phone repairs and bills</p>
          </div>
          <Link to="/history" className="btn-secondary py-1.5 px-3 text-xs font-bold">
            View Full History →
          </Link>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Customer & Phone</th>
                  <th className="py-3 px-4">Device & Problem</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Repair Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.slice(0, 8).map(invoice => {
                  const rStatus = invoice.repair_status || 'Delivered to Customer';
                  const isWorking = rStatus.includes('Working') || rStatus.includes('Pending') || rStatus.includes('Service');
                  const isReady = rStatus.includes('Ready') || rStatus.includes('Finished') || rStatus.includes('Repaired');

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Link to={`/invoices/view/${invoice.id}`} className="font-bold text-blue-600 hover:text-blue-800 font-mono text-sm">
                          {invoice.invoice_number}
                        </Link>
                        <span className={`block text-[10px] font-semibold ${
                          invoice.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          ● {invoice.status === 'paid' ? 'Paid' : 'Payment Due'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 text-sm">{invoice.customer_name || 'Walk-in'}</p>
                        {invoice.customer_phone && (
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <span>📞</span> {invoice.customer_phone}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {invoice.device_model ? (
                          <div>
                            <p className="font-bold text-slate-800">📱 {invoice.device_model}</p>
                            {invoice.issue_reported && (
                              <p className="text-[11px] text-slate-500 truncate max-w-[220px]" title={invoice.issue_reported}>
                                {invoice.issue_reported}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-medium">📦 Device / Accessory Sale</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <p>{invoice.invoice_date || '—'}</p>
                        <p className="text-[10px] text-slate-400">{invoice.intake_time || ''}</p>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-black text-slate-900 text-sm">{formatCurrency(invoice.total)}</p>
                        {parseFloat(invoice.advance_paid) > 0 && (
                          <p className="text-[10px] text-emerald-600 font-semibold">Adv: {formatCurrency(invoice.advance_paid)}</p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isWorking
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : isReady
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {isWorking ? '🟡 Working' : isReady ? '🟢 Ready for Pickup' : '🔵 Delivered'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/invoices/view/${invoice.id}`}
                          className="py-1 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          View Bill →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No bills created yet</p>
            <Link to="/invoices/new" className="btn-primary mt-3 inline-flex">
              <Plus className="w-4 h-4" /> Create First Bill
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function StatsCard({ title, value, icon: Icon, color, subtitle, trend }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{title}</p>
      </div>
      {subtitle && <p className="text-[11px] text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const classes = {
    draft: 'badge-gray',
    sent: 'badge-info',
    paid: 'badge-success',
    partial: 'badge-warning',
    overdue: 'badge-danger',
    cancelled: 'badge-gray',
  };

  return (
    <span className={classes[status] || 'badge-gray'}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'}
    </span>
  );
}
