import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency, formatIndianDate } from '../../utils/indianUtils';
import {
  FileText, Users, Search, Eye, Printer, MessageCircle, ArrowUpRight,
  Clock, CheckCircle2, AlertCircle, Calendar, Smartphone, RefreshCw,
  DollarSign, ChevronRight, Filter, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function HistoryRecords() {
  const { user, isAdmin, activeCompanyId, currentCompany } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'customers'
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'this_month' | 'last_month'

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amt) => formatIndianCurrency(amt, cs);

  useEffect(() => {
    loadHistoryData();
  }, [activeCompanyId]);

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const [invData, custData] = await Promise.all([
        db.fetchSheet(SHEET_NAMES.INVOICES, true),
        db.fetchSheet(SHEET_NAMES.CUSTOMERS, true),
      ]);

      // Filter invoices for this company/user
      const validInvoices = invData.filter(i => i.id);
      setInvoices(validInvoices);
      setCustomers(custData.filter(c => c.id));
    } catch (err) {
      console.error('Failed to load history data:', err);
      toast.error('Failed to load history records');
    } finally {
      setLoading(false);
    }
  };

  // Compute Overall Stats
  const stats = useMemo(() => {
    const totalBills = invoices.length;
    const totalBilledAmount = invoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => {
      const tot = parseFloat(i.total) || 0;
      if (i.status === 'paid') return sum + tot;
      return sum + (parseFloat(i.amount_paid) || 0);
    }, 0);
    const totalPending = totalBilledAmount - totalPaid;
    const totalCustomers = customers.length;

    return {
      totalBills,
      totalBilledAmount,
      totalPaid,
      totalPending: Math.max(0, totalPending),
      totalCustomers,
    };
  }, [invoices, customers]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        inv.customer_phone?.toLowerCase().includes(q) ||
        inv.device_model?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter !== 'all') {
        const invStatus = (inv.status || 'pending').toLowerCase();
        if (statusFilter === 'paid' && invStatus !== 'paid') return false;
        if (statusFilter === 'pending' && invStatus !== 'pending' && invStatus !== 'sent') return false;
        if (statusFilter === 'partial' && invStatus !== 'partial') return false;
      }

      if (dateFilter !== 'all') {
        const invDate = new Date(inv.invoice_date || inv.created_at);
        const now = new Date();
        if (dateFilter === 'today') {
          if (invDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'this_month') {
          if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'last_month') {
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          if (invDate.getMonth() !== lastMonth || invDate.getFullYear() !== year) return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.invoice_date || b.created_at) - new Date(a.invoice_date || a.created_at));
  }, [invoices, searchQuery, statusFilter, dateFilter]);

  // Aggregate Customer Stats from Invoices
  const aggregatedCustomers = useMemo(() => {
    const custMap = new Map();

    // First populate from Customer records
    customers.forEach(c => {
      const key = (c.phone || c.mobile || c.name || c.id).trim().toLowerCase();
      custMap.set(key, {
        id: c.id,
        name: c.name || 'Walk-in Customer',
        phone: c.phone || c.mobile || '',
        city: c.city || '',
        address: c.address || '',
        totalBills: 0,
        totalSpent: 0,
        lastVisit: c.created_at || '',
        devices: new Set(),
      });
    });

    // Merge with invoices
    invoices.forEach(inv => {
      const key = (inv.customer_phone || inv.customer_name || 'unknown').trim().toLowerCase();
      let record = custMap.get(key);
      if (!record) {
        record = {
          id: inv.customer_id || `temp-${Math.random()}`,
          name: inv.customer_name || 'Walk-in Customer',
          phone: inv.customer_phone || '',
          city: inv.customer_city || '',
          address: inv.customer_address || '',
          totalBills: 0,
          totalSpent: 0,
          lastVisit: inv.invoice_date || inv.created_at || '',
          devices: new Set(),
        };
        custMap.set(key, record);
      }

      record.totalBills += 1;
      record.totalSpent += parseFloat(inv.total) || 0;
      if (inv.device_model) record.devices.add(inv.device_model);
      const invDate = new Date(inv.invoice_date || inv.created_at);
      const currLast = new Date(record.lastVisit || 0);
      if (invDate > currLast) {
        record.lastVisit = inv.invoice_date || inv.created_at;
      }
    });

    return Array.from(custMap.values()).filter(c => {
      const q = searchQuery.toLowerCase();
      return !searchQuery ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0));
  }, [customers, invoices, searchQuery]);

  const handleSendWhatsApp = (phone, invNum, total) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const shop = currentCompany?.name || 'Sai Ram Mobile Care';
    const message = encodeURIComponent(
      `Hello! Greetings from ${shop}.\nYour Bill #${invNum} for ₹${total} is ready.\nThank you for choosing our service!`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">History & Master Records</h1>
            <span className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
              Past Bills & Customer Log
            </span>
          </div>
          <p className="text-xs text-slate-300">
            View all previous customer service details, total bill details, reprint invoices, and review customer lifetime value.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadHistoryData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-medium"
            title="Refresh History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/invoices/new"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 text-xs font-semibold flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>+ New Bill</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Total Bills Created</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalBills}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Lifetime invoices & slips</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Total Billed Revenue</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="font-bold text-sm">₹</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatCurrency(stats.totalBilledAmount)}</p>
          <p className="text-[11px] text-emerald-700/70 mt-0.5">Total invoice volume</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Amount Received</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Cash, UPI & cards collected</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Total Customers</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-2">{aggregatedCustomers.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Serviced clients on record</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Header & Filter Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-200/60 rounded-xl">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'invoices'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Previous Bills & Invoices ({filteredInvoices.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'customers'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Total Customer Records ({aggregatedCustomers.length})</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'invoices' ? "Search bill #, customer, phone..." : "Search customer name, phone..."}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {activeTab === 'invoices' && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Previous Invoices Table */}
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice / Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Device / Issue</th>
                  <th className="py-3 px-4 text-right">Total Bill Amount</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading bill history...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      No invoices found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isPaid = (inv.status || '').toLowerCase() === 'paid';
                    const isPartial = (inv.status || '').toLowerCase() === 'partial';
                    const totalVal = parseFloat(inv.total) || 0;

                    return (
                      <tr key={inv.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                          {inv.invoice_number || `INV-${inv.id}`}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {inv.invoice_date || (inv.created_at ? formatIndianDate(inv.created_at) : 'N/A')}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-900">{inv.customer_name || 'Walk-in Customer'}</p>
                          {inv.customer_phone && (
                            <p className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                              <span>📱 {inv.customer_phone}</span>
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-gray-600">
                          {inv.device_model ? (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium">
                              <Smartphone className="w-3 h-3 text-slate-500" />
                              {inv.device_model}
                            </span>
                          ) : (
                            inv.issue_reported || 'General Sales / Service'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-gray-900 text-sm">
                          {formatCurrency(totalVal)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPartial
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              to={`/invoices/view/${inv.id}`}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors border border-indigo-200"
                              title="View & Print Bill"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Link>
                            {inv.customer_phone && (
                              <button
                                onClick={() => handleSendWhatsApp(inv.customer_phone, inv.invoice_number, totalVal)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200"
                                title="Share on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Total Customer Records */}
        {activeTab === 'customers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Location / Address</th>
                  <th className="py-3 px-4 text-center">Total Invoices / Visits</th>
                  <th className="py-3 px-4 text-right">Lifetime Billed (₹)</th>
                  <th className="py-3 px-4">Last Visit</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading customer directory...
                    </td>
                  </tr>
                ) : aggregatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      No customer records found.
                    </td>
                  </tr>
                ) : (
                  aggregatedCustomers.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{cust.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-700">
                        {cust.phone || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {cust.city || cust.address || 'Local'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px]">
                          {cust.totalBills} Bills
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(cust.totalSpent)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                        {cust.lastVisit ? formatIndianDate(cust.lastVisit) : 'Recent'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSearchQuery(cust.phone || cust.name);
                            setActiveTab('invoices');
                          }}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          View Bills
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
