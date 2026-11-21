import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  Plus, Search, Edit, Trash2, X, Users, Mail, Phone, MapPin, Building,
  RefreshCw, Smartphone, Clock, CheckCircle2, History, ArrowRight,
  FileText, MessageCircle, ExternalLink, Calendar, Wrench, Shield, Check,
  TrendingUp, PackageCheck, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerList() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('current'); // 'current', 'last', 'all', or YYYY-MM
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custs, invs, items] = await Promise.all([
        db.fetchSheet(SHEET_NAMES.CUSTOMERS, true),
        db.fetchSheet(SHEET_NAMES.INVOICES, true),
        db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS, true),
      ]);
      setCustomers(custs.filter(c => c.id));
      setInvoices(invs.filter(i => i.id));
      setInvoiceItems(items.filter(it => it.id));
    } catch (error) {
      toast.error('Failed to load customer service records');
    } finally {
      setLoading(false);
    }
  };

  // Group invoices by customer
  const customerHistoryMap = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const cId = inv.customer_id;
      const cPhone = (inv.customer_phone || '').replace(/[^0-9]/g, '');
      const cName = (inv.customer_name || '').trim().toLowerCase();

      customers.forEach(cust => {
        const custPhone = (cust.phone || '').replace(/[^0-9]/g, '');
        const custName = (cust.name || '').trim().toLowerCase();
        const isMatch = (cId && String(cId) === String(cust.id)) ||
                        (cPhone && custPhone && (cPhone === custPhone || cPhone.endsWith(custPhone) || custPhone.endsWith(cPhone))) ||
                        (cName && custName && cName === custName);

        if (isMatch) {
          if (!map[cust.id]) map[cust.id] = [];
          if (!map[cust.id].some(existing => existing.id === inv.id)) {
            map[cust.id].push(inv);
          }
        }
      });
    });
    return map;
  }, [customers, invoices]);

  // Available months from invoice data
  const availableMonths = useMemo(() => {
    const set = new Set();
    invoices.forEach(inv => {
      const dateStr = inv.invoice_date || inv.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  // Current & Last Month Keys
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const activeMonthKey = selectedMonth === 'current'
    ? currentMonthKey
    : selectedMonth === 'last'
    ? lastMonthKey
    : selectedMonth;

  // Filter invoices for selected month (or all)
  const monthlyInvoices = useMemo(() => {
    if (selectedMonth === 'all') return invoices;
    return invoices.filter(inv => {
      const dateStr = inv.invoice_date || inv.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === activeMonthKey;
    });
  }, [invoices, selectedMonth, activeMonthKey]);

  // Calculate Monthly Metrics
  const monthlyMetrics = useMemo(() => {
    const uniqueCustomerIds = new Set();
    let deliveredCount = 0;
    let workingCount = 0;
    let readyCount = 0;
    let totalBilled = 0;

    monthlyInvoices.forEach(inv => {
      const cId = inv.customer_id || inv.customer_phone || inv.customer_name;
      if (cId) uniqueCustomerIds.add(cId);

      totalBilled += parseFloat(inv.total) || 0;

      const s = (inv.repair_status || '').toLowerCase();
      if (s.includes('deliver')) {
        deliveredCount++;
      } else if (s.includes('ready') || s.includes('finished') || s.includes('repair')) {
        readyCount++;
      } else if (s.includes('work') || s.includes('pend') || s.includes('service') || s.includes('received')) {
        workingCount++;
      } else {
        // default if not specified
        deliveredCount++;
      }
    });

    return {
      customersServed: uniqueCustomerIds.size,
      totalJobs: monthlyInvoices.length,
      delivered: deliveredCount,
      working: workingCount,
      ready: readyCount,
      revenue: totalBilled,
    };
  }, [monthlyInvoices]);

  // Fast Status Update: e.g. Finish repair -> Deliver to customer
  const handleUpdateRepairStatus = async (invoiceId, newStatus) => {
    setStatusUpdating(invoiceId);
    try {
      const nowIso = new Date().toISOString();
      await db.updateRow(SHEET_NAMES.INVOICES, invoiceId, {
        repair_status: newStatus,
        updated_at: nowIso,
      });

      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, repair_status: newStatus } : inv));
      toast.success(`Service status updated to: ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const formatMonthName = (key) => {
    if (!key) return '';
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const sendWhatsApp = (customer, invoice, type = 'update') => {
    const rawPhone = (invoice?.customer_phone || customer?.phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    if (!cleanPhone) {
      toast.error('Customer phone number not available');
      return;
    }
    const shop = settings.company_name || 'Sai Ram Mobile Care';
    let msg = `Hello ${customer?.name || 'Customer'},\nThank you for choosing *${shop}*!`;
    if (invoice) {
      const status = invoice.repair_status || 'Under Service';
      if (status.toLowerCase().includes('ready')) {
        msg = `Hello ${customer?.name || 'Customer'},\nGreat news! Your device *${invoice.device_model || 'Handset'}* repair is *FINISHED & READY FOR PICKUP* at *${shop}*.\nBill No: *${invoice.invoice_number}*\nTotal Due: *${formatCurrency(invoice.total)}*\nPlease visit our store to collect your device.\nThank you!`;
      } else if (status.toLowerCase().includes('deliver')) {
        msg = `Hello ${customer?.name || 'Customer'},\nYour device *${invoice.device_model || 'Handset'}* (Bill: *${invoice.invoice_number}*) has been successfully *DELIVERED* at *${shop}*.\nThank you for your business! Have a great day.`;
      } else {
        msg = `Hello ${customer?.name || 'Customer'},\nUpdate on your service at *${shop}*:\nBill No: *${invoice.invoice_number}*\nDevice: *${invoice.device_model || 'Handset'}*\nStatus: *${status}*\nThank you!`;
      }
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const cInvoices = customerHistoryMap[c.id] || [];

      // If filtering by specific month, only show customers who have service jobs in that month
      if (selectedMonth !== 'all') {
        const hasInvoiceInMonth = cInvoices.some(inv => {
          const dateStr = inv.invoice_date || inv.created_at;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return false;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return key === activeMonthKey;
        });
        if (!hasInvoiceInMonth && !searchQuery) return false;
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const phoneMatch = (c.phone || '').includes(q);
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const deviceMatch = cInvoices.some(inv =>
        (inv.device_model || '').toLowerCase().includes(q) ||
        (inv.imei_serial || '').includes(q) ||
        (inv.issue_reported || '').toLowerCase().includes(q)
      );

      return phoneMatch || nameMatch || deviceMatch;
    });
  }, [customers, searchQuery, customerHistoryMap, selectedMonth, activeMonthKey]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Service Intake & Monthly Delivery Workflow */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Customer Service Log & Monthly Analysis</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Service & Delivery Flow
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Customer details are captured directly upon service intake. Track how many customers you serve each month, update repair status, and record handover upon delivery.
            </p>
          </div>
        </div>

        {/* Primary Action Button: New Service Intake */}
        <Link
          to="/invoices/new"
          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
          title="Take customer details for service & generate bill"
        >
          <Plus className="w-4 h-4" /> New Service Intake / Bill
        </Link>
      </div>

      {/* Month Selection Bar for Monthly Analysis */}
      <div className="card py-3 px-4 bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Analysis Period:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedMonth('current')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              selectedMonth === 'current'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            This Month ({formatMonthName(currentMonthKey)})
          </button>

          <button
            onClick={() => setSelectedMonth('last')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              selectedMonth === 'last'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Last Month ({formatMonthName(lastMonthKey)})
          </button>

          {availableMonths.length > 2 && (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none"
            >
              <option value="current">Current Month</option>
              <option value="last">Last Month</option>
              <option value="all">All Time (Full History)</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthName(m)}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSelectedMonth('all')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              selectedMonth === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Monthly KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Unique Customers Serviced */}
        <div className="card py-3.5 px-4 bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Customers Serviced
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{monthlyMetrics.customersServed}</span>
            <span className="text-xs text-slate-500 font-medium">People</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {selectedMonth === 'all' ? 'Across all records' : `In ${formatMonthName(activeMonthKey)}`}
          </p>
        </div>

        {/* Total Service Jobs / Bills */}
        <div className="card py-3.5 px-4 bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            Total Service Bills
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-indigo-900">{monthlyMetrics.totalJobs}</span>
            <span className="text-xs text-indigo-600 font-medium">Jobs</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Repairs & Intake cards</p>
        </div>

        {/* Delivered to Customer */}
        <div className="card py-3.5 px-4 bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <p className="text-[11px] text-emerald-800 font-bold uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered to Customer
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-900">{monthlyMetrics.delivered}</span>
            <span className="text-xs text-emerald-700 font-medium">Completed</span>
          </div>
          <p className="text-[10px] text-emerald-700/80 mt-1">Handed over to customer</p>
        </div>

        {/* Currently Working / In Service */}
        <div className="card py-3.5 px-4 bg-amber-50/70 border border-amber-200 shadow-xs">
          <p className="text-[11px] text-amber-800 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Under Service (Bench)
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-900">{monthlyMetrics.working}</span>
            <span className="text-xs text-amber-700 font-medium">In Progress</span>
          </div>
          <p className="text-[10px] text-amber-700/80 mt-1">Phones being serviced</p>
        </div>

        {/* Ready for Pickup */}
        <div className="card py-3.5 px-4 bg-blue-50/70 border border-blue-200 shadow-xs">
          <p className="text-[11px] text-blue-800 font-bold uppercase flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
            Ready for Pickup
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-900">{monthlyMetrics.ready}</span>
            <span className="text-xs text-blue-700 font-medium">Awaiting delivery</span>
          </div>
          <p className="text-[10px] text-blue-700/80 mt-1">Ready for handover</p>
        </div>
      </div>

      {/* Toolbar: Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, 10-digit phone, or phone model..."
            className="input-field pl-10 text-sm"
          />
        </div>
        <button
          onClick={loadData}
          className="btn-secondary py-2.5 px-3 flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh customer service list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Customer Service Records Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card text-center py-16 border border-slate-200 bg-white">
          <Users className="w-14 h-14 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {searchQuery
              ? 'No matching customer service records found'
              : `No customers recorded for ${selectedMonth === 'all' ? 'the selected filter' : formatMonthName(activeMonthKey)}`}
          </h3>
          <p className="text-xs text-slate-500 mb-5 max-w-md mx-auto">
            Customers are automatically registered in the system when you create a service intake or issue a bill.
          </p>
          <Link
            to="/invoices/new"
            className="btn-primary inline-flex items-center gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> Create New Service Intake / Bill
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const customerInvoices = (customerHistoryMap[customer.id] || []).sort(
              (a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date)
            );
            const totalSpent = customerInvoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
            const latestInvoice = customerInvoices[0];

            const workingInvoice = customerInvoices.find(i => {
              const s = (i.repair_status || '').toLowerCase();
              return s.includes('work') || s.includes('pend') || s.includes('service') || s.includes('received');
            });

            const readyInvoice = customerInvoices.find(i => {
              const s = (i.repair_status || '').toLowerCase();
              return s.includes('ready') || s.includes('finish') || s.includes('repair');
            });

            const activeJob = workingInvoice || readyInvoice || latestInvoice;
            const uniqueDevices = Array.from(new Set(customerInvoices.map(i => i.device_model).filter(Boolean)));

            return (
              <div
                key={customer.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col justify-between group space-y-4 shadow-xs"
              >
                <div>
                  {/* Customer Info Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                        {customer.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug truncate" title={customer.name}>
                          {customer.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                          <span>{customer.phone || 'No phone'}</span>
                        </p>
                      </div>
                    </div>
                    {customer.phone && (
                      <button
                        onClick={() => sendWhatsApp(customer, activeJob)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Send WhatsApp update to customer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Active Service Status Card */}
                  {activeJob && (
                    <div className={`mt-3 p-3 rounded-xl border text-xs ${
                      workingInvoice
                        ? 'bg-amber-50/80 border-amber-200'
                        : readyInvoice
                        ? 'bg-emerald-50/80 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          {workingInvoice && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
                          {readyInvoice && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                          <span>📱 {activeJob.device_model || 'Handset Service'}</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          workingInvoice
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : readyInvoice
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}>
                          {workingInvoice ? '🟡 In Service' : readyInvoice ? '🟢 Ready for Pickup' : '🔵 Delivered'}
                        </span>
                      </div>

                      {activeJob.issue_reported && (
                        <p className="text-[11px] text-slate-600 truncate">
                          Issue: {activeJob.issue_reported}
                        </p>
                      )}

                      {/* Quick 1-Click Status Handover Buttons */}
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                        {workingInvoice && (
                          <button
                            onClick={() => handleUpdateRepairStatus(workingInvoice.id, 'Finished / Ready for Pickup')}
                            disabled={statusUpdating === workingInvoice.id}
                            className="py-1 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Mark Ready
                          </button>
                        )}
                        {(workingInvoice || readyInvoice) && (
                          <button
                            onClick={() => handleUpdateRepairStatus((readyInvoice || workingInvoice).id, 'Delivered to Customer')}
                            disabled={statusUpdating === (readyInvoice || workingInvoice).id}
                            className="py-1 px-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-colors flex items-center gap-1"
                          >
                            <PackageCheck className="w-3 h-3" /> Mark Delivered
                          </button>
                        )}
                        {!workingInvoice && !readyInvoice && (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Handed over to customer
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Visits:</span>
                      <strong className="text-slate-800 text-xs font-bold">{customerInvoices.length} {customerInvoices.length === 1 ? 'Job' : 'Jobs'}</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Billed:</span>
                      <strong className="text-emerald-700 text-xs font-bold">{formatCurrency(totalSpent)}</strong>
                    </div>
                  </div>

                  {/* Serviced Devices Tags */}
                  {uniqueDevices.length > 0 && (
                    <div className="mt-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Devices Serviced:</p>
                      <div className="flex flex-wrap gap-1">
                        {uniqueDevices.slice(0, 3).map(dev => (
                          <span key={dev} className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                            📱 {dev}
                          </span>
                        ))}
                        {uniqueDevices.length > 3 && (
                          <span className="text-[10px] font-bold text-slate-500 px-1 py-0.5">+{uniqueDevices.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action: View Service History */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setHistoryCustomer(customer)}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Service & Delivery History</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== CUSTOMER SERVICE HISTORY & DELIVERY MODAL ==================== */}
      {historyCustomer && (
        <div className="modal-overlay" onClick={() => setHistoryCustomer(null)}>
          <div className="modal-content max-w-4xl p-0 overflow-hidden rounded-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                  {historyCustomer.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{historyCustomer.name}</span>
                    <span className="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">
                      Service & Delivery History
                    </span>
                  </h3>
                  <p className="text-xs text-blue-200 font-mono flex items-center gap-2 mt-0.5">
                    <span>📞 {historyCustomer.phone || 'No phone'}</span>
                    {historyCustomer.email && <span>• ✉️ {historyCustomer.email}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/invoices/new"
                  className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  title="Create new intake for this customer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Intake</span>
                </Link>
                <button onClick={() => setHistoryCustomer(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {(() => {
              const custInvoices = (customerHistoryMap[historyCustomer.id] || []).sort(
                (a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date)
              );
              const totalSpent = custInvoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
              const totalPaid = custInvoices.reduce((sum, i) => sum + (parseFloat(i.amount_paid) || 0), 0);
              const balanceDue = Math.max(0, totalSpent - totalPaid);

              return (
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Total Visits</p>
                      <p className="text-xl font-black text-slate-900 mt-0.5">{custInvoices.length} Jobs</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[11px] font-bold text-emerald-800 uppercase">Total Paid</p>
                      <p className="text-xl font-black text-emerald-900 mt-0.5">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${balanceDue > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-[11px] font-bold uppercase text-slate-500">Balance Due</p>
                      <p className={`text-xl font-black mt-0.5 ${balanceDue > 0 ? 'text-amber-800' : 'text-slate-900'}`}>{formatCurrency(balanceDue)}</p>
                    </div>
                  </div>

                  {/* Jobs List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-blue-600" />
                      All Phone Repairs, Purchases & Delivery Status
                    </h4>

                    {custInvoices.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                        <Smartphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No service history recorded yet</p>
                        <p className="text-xs text-slate-500 mt-1">Create a service intake or bill to log customer details.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Job / Bill #</th>
                              <th className="py-2.5 px-3">Device & Issue</th>
                              <th className="py-2.5 px-3">Amount</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {custInvoices.map(inv => {
                              const rStatus = inv.repair_status || 'Delivered to Customer';
                              const isWorking = rStatus.includes('Working') || rStatus.includes('Pending') || rStatus.includes('Service');
                              const isReady = rStatus.includes('Ready') || rStatus.includes('Finished') || rStatus.includes('Repaired');
                              const isDelivered = rStatus.includes('Delivered');

                              return (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-3 text-slate-600 font-medium">
                                    <p>{inv.invoice_date || '—'}</p>
                                    <p className="text-[10px] text-slate-400">{inv.intake_time || ''}</p>
                                  </td>

                                  <td className="py-3 px-3">
                                    <Link to={`/invoices/view/${inv.id}`} className="font-bold text-blue-600 hover:text-blue-800 font-mono">
                                      {inv.invoice_number}
                                    </Link>
                                    <span className={`block text-[10px] font-semibold ${
                                      inv.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>
                                      {inv.status === 'paid' ? '● Paid' : '● Due'}
                                    </span>
                                  </td>

                                  <td className="py-3 px-3">
                                    {inv.device_model ? (
                                      <div>
                                        <p className="font-bold text-slate-900">📱 {inv.device_model}</p>
                                        {inv.imei_serial && (
                                          <p className="text-[10px] text-slate-400 font-mono">IMEI: {inv.imei_serial}</p>
                                        )}
                                        {inv.issue_reported && (
                                          <p className="text-slate-600 text-[11px] mt-0.5">Issue: {inv.issue_reported}</p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500 font-medium">📦 Device / Accessory Purchase</span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    <p className="font-bold text-slate-900">{formatCurrency(inv.total)}</p>
                                    {parseFloat(inv.advance_paid) > 0 && (
                                      <p className="text-[10px] text-emerald-600">Adv: {formatCurrency(inv.advance_paid)}</p>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    <div className="space-y-1">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                        isWorking
                                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                                          : isReady
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                          : 'bg-blue-50 text-blue-800 border-blue-200'
                                      }`}>
                                        {isWorking ? '🟡 Working' : isReady ? '🟢 Ready' : '🔵 Delivered'}
                                      </span>

                                      {/* Quick status switch */}
                                      <div className="flex items-center gap-1">
                                        {!isDelivered && (
                                          <button
                                            onClick={() => handleUpdateRepairStatus(inv.id, 'Delivered to Customer')}
                                            className="text-[9px] text-blue-600 hover:underline font-semibold"
                                          >
                                            Mark Delivered
                                          </button>
                                        )}
                                        {isWorking && (
                                          <button
                                            onClick={() => handleUpdateRepairStatus(inv.id, 'Finished / Ready for Pickup')}
                                            className="text-[9px] text-emerald-600 hover:underline font-semibold"
                                          >
                                            Mark Ready
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Link
                                        to={`/invoices/view/${inv.id}`}
                                        className="py-1 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                                      >
                                        <span>View Bill</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </Link>
                                      {historyCustomer.phone && (
                                        <button
                                          onClick={() => sendWhatsApp(historyCustomer, inv)}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                          title="Send WhatsApp update to customer"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setHistoryCustomer(null)}
                className="btn-secondary py-2 px-5 text-xs font-semibold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
