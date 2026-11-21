import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  BarChart3, Download, Calendar, TrendingUp, DollarSign, FileText,
  Smartphone, Package, Wrench, Printer, Filter, CheckCircle2,
  Clock, ArrowUpDown, ChevronRight, Layers, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

export default function Reports() {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [periodPreset, setPeriodPreset] = useState('today'); // 'today', 'yesterday', 'this_week', 'this_month', 'last_month', 'custom'
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('both'); // 'both', 'service', 'product'
  const [activeTab, setActiveTab] = useState('table_both'); // 'table_both', 'item_breakdown', 'periodic_summary'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, items, pay, cust, prod] = await Promise.all([
        db.fetchSheet(SHEET_NAMES.INVOICES),
        db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS),
        db.fetchSheet(SHEET_NAMES.PAYMENTS),
        db.fetchSheet(SHEET_NAMES.CUSTOMERS),
        db.fetchSheet(SHEET_NAMES.PRODUCTS),
      ]);

      const filterByUser = (data) => (user?.role === 'admin' ? data : data.filter(d => d.created_by === user?.id));
      setInvoices(filterByUser(inv.filter(i => i.id)));
      setInvoiceItems(items.filter(i => i.id));
      setPayments(pay.filter(p => p.id));
      setCustomers(cust.filter(c => c.id));
      setProducts(prod.filter(p => p.id));
    } catch (error) {
      console.error('Failed to load reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (val) => formatIndianCurrency(val, cs);

  // Date range determination
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (periodPreset === 'today') {
      return { start: todayStr, end: todayStr, label: 'Today (1 Day)' };
    }
    if (periodPreset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      return { start: y, end: y, label: 'Yesterday (1 Day)' };
    }
    if (periodPreset === 'this_week') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7; // Sunday = 7
      startOfWeek.setDate(startOfWeek.getDate() - day + 1); // Monday
      const startStr = startOfWeek.toISOString().split('T')[0];
      return { start: startStr, end: todayStr, label: 'This Week (Week-wise)' };
    }
    if (periodPreset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start: startOfMonth, end: todayStr, label: 'This Month (Month-wise)' };
    }
    if (periodPreset === 'last_month') {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start: startOfLast, end: endOfLast, label: 'Last Month' };
    }
    return {
      start: customStartDate || todayStr,
      end: customEndDate || todayStr,
      label: `Custom (${customStartDate} to ${customEndDate})`,
    };
  }, [periodPreset, customStartDate, customEndDate]);

  // Map of Invoice ID -> Array of Items
  const itemsByInvoiceId = useMemo(() => {
    const map = {};
    invoiceItems.forEach(item => {
      if (!map[item.invoice_id]) map[item.invoice_id] = [];
      map[item.invoice_id].push(item);
    });
    return map;
  }, [invoiceItems]);

  // Filtered Invoices in range
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.invoice_date || (inv.created_at ? inv.created_at.split('T')[0] : '');
      if (!d) return false;
      const inDate = d >= dateRange.start && d <= dateRange.end;
      if (!inDate) return false;

      // Filter by search query if any
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
          (inv.customer_phone && inv.customer_phone.toLowerCase().includes(q)) ||
          (inv.device_model && inv.device_model.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Filter by Type (service or product)
      if (typeFilter !== 'both') {
        const items = itemsByInvoiceId[inv.id] || [];
        const hasMatchingType = items.some(it => {
          const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
          return itType === typeFilter;
        });
        if (!hasMatchingType) return false;
      }

      return true;
    });
  }, [invoices, dateRange, typeFilter, searchQuery, itemsByInvoiceId]);

  // Enriched Invoices with split totals (Service amount vs Product amount)
  const enrichedInvoices = useMemo(() => {
    return filteredInvoices.map(inv => {
      const items = itemsByInvoiceId[inv.id] || [];
      let serviceAmount = 0;
      let serviceTax = 0;
      let serviceCount = 0;
      let productAmount = 0;
      let productTax = 0;
      let productCount = 0;
      const serviceNames = [];
      const productNames = [];

      items.forEach(it => {
        const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
        const qty = parseFloat(it.quantity) || 1;
        const lineTotal = parseFloat(it.amount) || ((parseFloat(it.unit_price) || 0) * qty);
        const taxRate = parseFloat(it.tax_rate) || 18;
        const lineTax = parseFloat(it.tax_amount) || (lineTotal * (taxRate / 100));

        if (itType === 'service') {
          serviceAmount += lineTotal;
          serviceTax += lineTax;
          serviceCount += qty;
          serviceNames.push(it.product_name || it.description);
        } else {
          productAmount += lineTotal;
          productTax += lineTax;
          productCount += qty;
          productNames.push(it.product_name || it.description);
        }
      });

      return {
        ...inv,
        items,
        serviceAmount,
        serviceTax,
        serviceCount,
        serviceNames,
        productAmount,
        productTax,
        productCount,
        productNames,
        totalWithTax: (parseFloat(inv.total) || 0),
        taxTotal: (parseFloat(inv.tax_amount) || 0),
        subtotalVal: (parseFloat(inv.subtotal) || 0),
      };
    });
  }, [filteredInvoices, itemsByInvoiceId]);

  // Aggregated Overall Totals for KPI Cards
  const kpis = useMemo(() => {
    let grandRevenue = 0;
    let serviceRevenue = 0;
    let serviceTax = 0;
    let serviceJobs = 0;
    let productRevenue = 0;
    let productTax = 0;
    let productUnits = 0;
    let totalTaxCollected = 0;

    enrichedInvoices.forEach(inv => {
      grandRevenue += inv.totalWithTax;
      serviceRevenue += inv.serviceAmount;
      serviceTax += inv.serviceTax;
      serviceJobs += inv.serviceCount;
      productRevenue += inv.productAmount;
      productTax += inv.productTax;
      productUnits += inv.productCount;
      totalTaxCollected += inv.taxTotal;
    });

    const netServiceWithTax = serviceRevenue + serviceTax;
    const netProductWithTax = productRevenue + productTax;

    return {
      grandRevenue,
      serviceRevenue,
      serviceTax,
      serviceJobs,
      netServiceWithTax,
      productRevenue,
      productTax,
      productUnits,
      netProductWithTax,
      totalTaxCollected,
      totalBills: enrichedInvoices.length,
    };
  }, [enrichedInvoices]);

  // Aggregated Item Breakdown (Service-wise & Product-wise breakdown)
  const itemAggregates = useMemo(() => {
    const agg = {};

    enrichedInvoices.forEach(inv => {
      inv.items.forEach(it => {
        const itType = it.item_type || (it.category === 'Services' || it.unit === 'Service' ? 'service' : 'product');
        if (typeFilter !== 'both' && itType !== typeFilter) return;

        const name = it.product_name || it.description || 'Unknown Item';
        const key = `${itType}_${name.toLowerCase()}`;
        const qty = parseFloat(it.quantity) || 1;
        const lineTotal = parseFloat(it.amount) || ((parseFloat(it.unit_price) || 0) * qty);
        const taxRate = parseFloat(it.tax_rate) || 18;
        const lineTax = parseFloat(it.tax_amount) || (lineTotal * (taxRate / 100));

        if (!agg[key]) {
          agg[key] = {
            name,
            type: itType,
            qty: 0,
            unitPrice: parseFloat(it.unit_price) || 0,
            subtotal: 0,
            taxAmount: 0,
            totalWithTax: 0,
          };
        }

        agg[key].qty += qty;
        agg[key].subtotal += lineTotal;
        agg[key].taxAmount += lineTax;
        agg[key].totalWithTax += (lineTotal + lineTax);
      });
    });

    return Object.values(agg).sort((a, b) => b.totalWithTax - a.totalWithTax);
  }, [enrichedInvoices, typeFilter]);

  // Day-wise / Date-wise Periodic Breakdown
  const periodicData = useMemo(() => {
    const dayMap = {};

    enrichedInvoices.forEach(inv => {
      const date = inv.invoice_date || (inv.created_at ? inv.created_at.split('T')[0] : 'Unknown');
      if (!dayMap[date]) {
        dayMap[date] = {
          date,
          billsCount: 0,
          services: 0,
          products: 0,
          tax: 0,
          total: 0,
        };
      }
      dayMap[date].billsCount += 1;
      dayMap[date].services += (inv.serviceAmount + inv.serviceTax);
      dayMap[date].products += (inv.productAmount + inv.productTax);
      dayMap[date].tax += inv.taxTotal;
      dayMap[date].total += inv.totalWithTax;
    });

    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [enrichedInvoices]);

  // Chart data for Service vs Product
  const pieData = useMemo(() => {
    const data = [];
    if (kpis.netServiceWithTax > 0) {
      data.push({ name: '🔧 Services (Repairs)', value: parseFloat(kpis.netServiceWithTax.toFixed(2)), color: '#2563eb' });
    }
    if (kpis.netProductWithTax > 0) {
      data.push({ name: '📦 Products (Accessories)', value: parseFloat(kpis.netProductWithTax.toFixed(2)), color: '#10b981' });
    }
    return data;
  }, [kpis]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Bill Number',
      'Invoice Date',
      'Customer Name',
      'Customer Phone',
      'Device Model',
      'IMEI Serial',
      'Services Included',
      'Services Total (Taxable)',
      'Products Bought',
      'Products Total (Taxable)',
      'GST Tax (₹)',
      'Grand Total (₹)',
      'Payment Mode',
      'Status',
    ];

    const rows = enrichedInvoices.map(i => [
      `"${i.invoice_number || ''}"`,
      `"${i.invoice_date || ''}"`,
      `"${(i.customer_name || '').replace(/"/g, '""')}"`,
      `"${i.customer_phone || ''}"`,
      `"${(i.device_model || '').replace(/"/g, '""')}"`,
      `"${i.imei_serial || ''}"`,
      `"${(i.serviceNames.join('; ') || 'None').replace(/"/g, '""')}"`,
      i.serviceAmount.toFixed(2),
      `"${(i.productNames.join('; ') || 'None').replace(/"/g, '""')}"`,
      i.productAmount.toFixed(2),
      i.taxTotal.toFixed(2),
      i.totalWithTax.toFixed(2),
      `"${i.payment_mode || ''}"`,
      `"${i.status || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mobile-service-report-${dateRange.start}-to-${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Mobile Service & Sales Analytics
              </h2>
              <p className="text-xs text-gray-500">
                Daily, Weekly, and Monthly Service-wise & Product-wise revenue breakdowns
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            title="Print Report"
          >
            <Printer className="w-4 h-4 text-gray-600" /> Print
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="card space-y-4 bg-white border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period Presets: Today (1 Day), Yesterday, This Week (Week-wise), This Month (Month-wise), Custom */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Period:
            </span>
            <button
              type="button"
              onClick={() => setPeriodPreset('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Today (1 Day)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('this_week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'this_week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 This Week (Week-wise)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'this_month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗓️ This Month (Month-wise)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'last_month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodPreset === 'custom'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⚙️ Custom Range
            </button>
          </div>

          {/* Type Filter: Both (All), Services Only, Products Only */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start lg:self-auto">
            <span className="text-[11px] font-bold text-gray-500 uppercase px-2">Type:</span>
            <button
              type="button"
              onClick={() => setTypeFilter('both')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'both'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔄 Both in Table
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('service')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'service'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔧 Services Only
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('product')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'product'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📦 Products Only
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker inputs when selected */}
        {periodPreset === 'custom' && (
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 flex flex-wrap items-center gap-4 text-xs">
            <span className="font-bold text-blue-900">Choose Specific Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-gray-600">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="input-field py-1 px-2.5 text-xs bg-white w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-600">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="input-field py-1 px-2.5 text-xs bg-white w-auto"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards for the Selected Period */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Grand Revenue */}
        <div className="card p-4 border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Total Revenue ({dateRange.label})
            </p>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              {cs}
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {formatCurrency(kpis.grandRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Across <strong>{kpis.totalBills}</strong> customer bills
          </p>
        </div>

        {/* Service Revenue & Jobs Done */}
        <div className="card p-4 border-2 border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              🔧 Service Revenue
            </p>
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-2">
            {formatCurrency(kpis.netServiceWithTax)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>Taxable: {formatCurrency(kpis.serviceRevenue)}</span>
            <span className="font-bold text-blue-700">{kpis.serviceJobs} Repair Jobs</span>
          </div>
        </div>

        {/* Product Sales & Items Sold */}
        <div className="card p-4 border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              📦 Product & Accessory Sales
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">
            {formatCurrency(kpis.netProductWithTax)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>Taxable: {formatCurrency(kpis.productRevenue)}</span>
            <span className="font-bold text-emerald-700">{kpis.productUnits} Items Sold</span>
          </div>
        </div>

        {/* Total GST Tax Collected */}
        <div className="card p-4 border-2 border-amber-100 bg-gradient-to-br from-amber-50/50 to-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              🧾 GST Collected
            </p>
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              %
            </div>
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2">
            {formatCurrency(kpis.totalTaxCollected)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>CGST (9%): {formatCurrency(kpis.totalTaxCollected / 2)}</span>
            <span>SGST (9%): {formatCurrency(kpis.totalTaxCollected / 2)}</span>
          </div>
        </div>
      </div>

      {/* Visual Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Periodic Bar Chart */}
        <div className="lg:col-span-2 card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-600" />
              Day-by-Day Revenue Split (Services vs Products)
            </h3>
            <span className="text-xs text-gray-500">{dateRange.label}</span>
          </div>

          {periodicData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={periodicData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val) => formatCurrency(val)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="services" name="🔧 Services (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="products" name="📦 Products (₹)" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No bills recorded for this time period
            </div>
          )}
        </div>

        {/* Share of Revenue Pie Chart */}
        <div className="card space-y-3 flex flex-col justify-between">
          <h3 className="section-title flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Revenue Share Breakdown
          </h3>

          {pieData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 pt-2">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-gray-50">
                    <span className="font-semibold text-gray-800">{item.name}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No sales data for pie chart
            </div>
          )}
        </div>
      </div>

      {/* Main Table Views Navigation */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('table_both')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'table_both'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 1. Customer Bills Table (Both in that Table)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('item_breakdown')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'item_breakdown'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> 2. Service & Product Sales Breakdown
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('periodic_summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'periodic_summary'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> 3. Daily / Periodic Summary
            </button>
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <strong>{enrichedInvoices.length}</strong> bills for {dateRange.label}
          </div>
        </div>

        {/* TAB 1: Detailed Bills Table with Both Services and Products Side-by-Side */}
        {activeTab === 'table_both' && (
          <div className="card p-0 overflow-hidden border border-gray-200 bg-white">
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  Complete Billing Register: Services & Products Combined
                </h4>
                <p className="text-xs text-gray-500">
                  Every bill with individual Service Total, Product Total, GST breakdown, and Grand Total
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter customer, phone, model..."
                  className="input-field text-xs py-1.5 pl-3 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Bill # / Date</th>
                    <th className="px-4 py-3">Customer & Mobile</th>
                    <th className="px-4 py-3">Device / IMEI</th>
                    <th className="px-4 py-3">🔧 Services (Repairs)</th>
                    <th className="px-4 py-3">📦 Products (Accessories)</th>
                    <th className="px-4 py-3 text-right">GST (18%)</th>
                    <th className="px-4 py-3 text-right">Grand Total</th>
                    <th className="px-4 py-3 text-center">Payment</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enrichedInvoices.length > 0 ? (
                    enrichedInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/invoices/view/${inv.id}`} className="text-primary-600 font-bold hover:underline">
                            {inv.invoice_number}
                          </Link>
                          <p className="text-[11px] text-gray-400 mt-0.5">{inv.invoice_date}</p>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{inv.customer_name || 'Walk-in'}</p>
                          {inv.customer_phone && <p className="text-[11px] text-gray-500">{inv.customer_phone}</p>}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{inv.device_model || '—'}</p>
                          {inv.imei_serial && (
                            <p className="text-[10px] text-gray-400 font-mono">IMEI: {inv.imei_serial}</p>
                          )}
                        </td>

                        {/* Service Column */}
                        <td className="px-4 py-3">
                          {inv.serviceCount > 0 ? (
                            <div>
                              <p className="font-bold text-blue-700 text-xs">
                                {formatCurrency(inv.serviceAmount)}
                              </p>
                              <p className="text-[11px] text-gray-600 line-clamp-1">
                                {inv.serviceNames.join(', ')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Product Column */}
                        <td className="px-4 py-3">
                          {inv.productCount > 0 ? (
                            <div>
                              <p className="font-bold text-emerald-700 text-xs">
                                {formatCurrency(inv.productAmount)}
                              </p>
                              <p className="text-[11px] text-gray-600 line-clamp-1">
                                {inv.productNames.join(', ')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {formatCurrency(inv.taxTotal)}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-sm">
                          {formatCurrency(inv.totalWithTax)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {inv.payment_mode || 'Cash'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Link
                            to={`/invoices/view/${inv.id}`}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg inline-flex items-center transition-colors"
                            title="View / Print Bill"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-gray-400">
                        No customer bills found for {dateRange.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Summary Table Footer */}
                {enrichedInvoices.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900 text-xs">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right uppercase tracking-wider">
                        Total for {dateRange.label}:
                      </td>
                      <td className="px-4 py-3 text-blue-700 font-black">
                        {formatCurrency(kpis.serviceRevenue)}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-black">
                        {formatCurrency(kpis.productRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-800 font-black">
                        {formatCurrency(kpis.totalTaxCollected)}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-900 font-black text-sm">
                        {formatCurrency(kpis.grandRevenue)}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Aggregated Item-wise & Service-wise Sales Table */}
        {activeTab === 'item_breakdown' && (
          <div className="card p-0 overflow-hidden border border-gray-200 bg-white">
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  Item-wise Breakdown: All Services Performed & Products Sold
                </h4>
                <p className="text-xs text-gray-500">
                  Aggregated quantities, total revenue, and tax collected per service/product
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Item / Service Name</th>
                    <th className="px-4 py-3 text-center">Category Type</th>
                    <th className="px-4 py-3 text-center">Qty / Jobs Done</th>
                    <th className="px-4 py-3 text-right">Taxable Subtotal</th>
                    <th className="px-4 py-3 text-right">GST Tax</th>
                    <th className="px-4 py-3 text-right">Total Revenue (with GST)</th>
                    <th className="px-4 py-3 text-right">% of Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itemAggregates.length > 0 ? (
                    itemAggregates.map((item, idx) => {
                      const isService = item.type === 'service';
                      const pct = kpis.grandRevenue > 0 ? ((item.totalWithTax / kpis.grandRevenue) * 100).toFixed(1) : '0';
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isService ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isService ? '🔧 SERVICE' : '📦 PRODUCT'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900">
                            {item.qty}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-medium">
                            {formatCurrency(item.subtotal)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 font-medium">
                            {formatCurrency(item.taxAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-gray-900">
                            {formatCurrency(item.totalWithTax)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-500">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-400">
                        No item sales recorded for {dateRange.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Daily / Periodic Summary Table */}
        {activeTab === 'periodic_summary' && (
          <div className="card p-0 overflow-hidden border border-gray-200 bg-white">
            <div className="p-4 bg-gray-50/70 border-b border-gray-200">
              <h4 className="font-bold text-gray-900 text-sm">
                Day-by-Day Financial Summary
              </h4>
              <p className="text-xs text-gray-500">
                Track how much your mobile repair shop made each day
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Bills Count</th>
                    <th className="px-4 py-3 text-right">🔧 Services Total (₹)</th>
                    <th className="px-4 py-3 text-right">📦 Products Total (₹)</th>
                    <th className="px-4 py-3 text-right">🧾 GST Tax (₹)</th>
                    <th className="px-4 py-3 text-right">💰 Net Total Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodicData.length > 0 ? (
                    periodicData.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900">{d.date}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700">{d.billsCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(d.services)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(d.products)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 font-medium">{formatCurrency(d.tax)}</td>
                        <td className="px-4 py-3 text-right font-black text-gray-900">{formatCurrency(d.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-400">
                        No day-by-day records found for {dateRange.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
