import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  Plus, Search, Filter, Eye, Edit, Trash2, Copy, Download,
  FileText, MoreVertical, ChevronDown, RefreshCw, Send, Smartphone,
  CheckCircle2, Clock, Wrench, Package, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const REPAIR_FILTER_TABS = [
  { id: 'all', label: 'All Bills' },
  { id: 'working', label: '🟡 Currently Working (Pending)' },
  { id: 'ready', label: '🟢 Finished / Ready for Pickup' },
  { id: 'delivered', label: '🔵 Delivered to Customer' },
  { id: 'retail', label: '📦 Device & Accessory Sales' },
];

export default function InvoiceList() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      let data = await db.fetchSheet(SHEET_NAMES.INVOICES, true);
      data = data.filter(inv => inv.id);
      if (user.role !== 'admin') {
        data = data.filter(inv => inv.created_by === user.id);
      }
      setInvoices(data);
    } catch (error) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const handleRepairStatusChange = async (id, newRepairStatus) => {
    try {
      const now = new Date().toISOString();
      const updates = { repair_status: newRepairStatus, updated_at: now };
      await db.updateRow(SHEET_NAMES.INVOICES, id, updates);
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, repair_status: newRepairStatus } : inv));
      toast.success(`Status updated to: ${newRepairStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        inv.customer_phone?.toLowerCase().includes(q) ||
        inv.device_model?.toLowerCase().includes(q) ||
        inv.imei_serial?.toLowerCase().includes(q) ||
        inv.issue_reported?.toLowerCase().includes(q);

      const rStatus = (inv.repair_status || '').toLowerCase();
      let matchesTab = true;
      if (activeTab === 'working') {
        matchesTab = rStatus.includes('working') || rStatus.includes('pending') || rStatus.includes('service') || rStatus.includes('received');
      } else if (activeTab === 'ready') {
        matchesTab = rStatus.includes('ready') || rStatus.includes('finished') || rStatus.includes('repaired');
      } else if (activeTab === 'delivered') {
        matchesTab = rStatus.includes('delivered');
      } else if (activeTab === 'retail') {
        matchesTab = !inv.device_model;
      }

      return matchesSearch && matchesTab;
    }).sort((a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date));
  }, [invoices, searchQuery, activeTab]);

  const handleDelete = async (id) => {
    try {
      const items = await db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS);
      const invoiceItems = items.filter(item => item.invoice_id === id);
      for (const item of invoiceItems) {
        await db.deleteRow(SHEET_NAMES.INVOICE_ITEMS, item.id);
      }
      await db.deleteRow(SHEET_NAMES.INVOICES, id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      setShowDeleteModal(null);
      toast.success('Bill deleted');
    } catch (error) {
      toast.error('Failed to delete bill');
    }
  };

  const handleDuplicate = async (invoice) => {
    try {
      const newNumber = await db.getNextInvoiceNumber();
      const now = new Date().toISOString();
      const newInvoice = {
        ...invoice,
        id: undefined,
        invoice_number: newNumber,
        status: 'draft',
        repair_status: 'Pending (Currently Working)',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount_paid: '0',
        created_at: now,
        updated_at: now,
      };
      const created = await db.appendRow(SHEET_NAMES.INVOICES, newInvoice);
      
      const items = await db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS);
      const origItems = items.filter(item => item.invoice_id === invoice.id);
      for (const item of origItems) {
        await db.appendRow(SHEET_NAMES.INVOICE_ITEMS, {
          ...item,
          id: undefined,
          invoice_id: created.id,
        });
      }
      
      toast.success('Bill duplicated');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to duplicate bill');
    }
    setActionMenuId(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await db.updateRow(SHEET_NAMES.INVOICES, id, { status: newStatus, updated_at: new Date().toISOString() });
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
      toast.success(`Bill marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
    setActionMenuId(null);
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const stats = useMemo(() => {
    const workingCount = invoices.filter(i => {
      const s = (i.repair_status || '').toLowerCase();
      return s.includes('working') || s.includes('pending') || s.includes('service') || s.includes('received');
    }).length;

    const readyCount = invoices.filter(i => {
      const s = (i.repair_status || '').toLowerCase();
      return s.includes('ready') || s.includes('finished') || s.includes('repaired');
    }).length;

    const deliveredCount = invoices.filter(i => {
      const s = (i.repair_status || '').toLowerCase();
      return s.includes('delivered');
    }).length;

    const totalCollected = invoices.reduce((sum, i) => sum + (parseFloat(i.amount_paid) || parseFloat(i.total) || 0), 0);

    return {
      total: invoices.length,
      working: workingCount,
      ready: readyCount,
      delivered: deliveredCount,
      totalCollected,
    };
  }, [invoices]);

  const sendWhatsAppUpdate = (invoice) => {
    const phone = (invoice.customer_phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    if (!cleanPhone) {
      toast.error('Customer phone number not available');
      return;
    }
    const shop = settings.company_name || 'Sai Ram Mobile Care';
    const statusText = invoice.repair_status || 'Under Service';
    const msg = `Hello ${invoice.customer_name || 'Customer'},\nUpdate on your phone repair at *${shop}*:\nBill No: *${invoice.invoice_number}*\nDevice: *${invoice.device_model || 'Handset'}*\nStatus: *${statusText}*\nTotal: *${formatCurrency(invoice.total)}*\nBalance Due: *${formatCurrency(Math.max(0, (parseFloat(invoice.total) || 0) - (parseFloat(invoice.amount_paid) || 0)))}*\nThank you!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* 4 Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Total Bills & Jobs</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="card py-3.5 px-4 bg-amber-50/60 border border-amber-200">
          <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Currently Working
          </p>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.working} <span className="text-xs font-semibold text-amber-700">Phones</span></p>
        </div>
        <div className="card py-3.5 px-4 bg-emerald-50/60 border border-emerald-200">
          <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finished & Ready
          </p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{stats.ready} <span className="text-xs font-semibold text-emerald-700">Phones</span></p>
        </div>
        <div className="card py-3.5 px-4 bg-blue-50/60 border border-blue-200">
          <p className="text-xs text-blue-800 font-semibold">Total Revenue Collected</p>
          <p className="text-xl font-black text-blue-900 mt-1">{formatCurrency(stats.totalCollected)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
        {REPAIR_FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bill #, Customer Name, Phone, Model, IMEI..."
              className="input-field pl-10 text-sm"
            />
          </div>
          <button onClick={loadInvoices} className="btn-secondary py-2.5 px-3" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <Link to="/invoices/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          + New Bill / Job Intake
        </Link>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No bills found</h3>
            <p className="text-sm text-slate-500 mb-4">
              {searchQuery || activeTab !== 'all' ? 'Try adjusting your search or tab filter' : 'Create your first mobile bill or service intake to get started'}
            </p>
            <Link to="/invoices/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Bill
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Customer & Phone</th>
                  <th className="py-3 px-4">Handset & Issue</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Bill Total (₹)</th>
                  <th className="py-3 px-4">Work / Repair Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredInvoices.map((invoice) => {
                  const rStatus = invoice.repair_status || 'Delivered to Customer';
                  const isWorking = rStatus.includes('Working') || rStatus.includes('Pending') || rStatus.includes('Service');
                  const isReady = rStatus.includes('Ready') || rStatus.includes('Finished') || rStatus.includes('Repaired');
                  const isDelivered = rStatus.includes('Delivered');

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link to={`/invoices/view/${invoice.id}`} className="text-blue-600 hover:text-blue-800 font-bold font-mono">
                          {invoice.invoice_number}
                        </Link>
                        <span className={`block text-[10px] font-semibold mt-0.5 ${
                          invoice.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          ● {invoice.status === 'paid' ? 'Paid' : 'Payment Due'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-slate-900 font-bold">{invoice.customer_name || 'Walk-in Customer'}</p>
                        {invoice.customer_phone && (
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <span>📞</span> {invoice.customer_phone}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {invoice.device_model ? (
                          <div>
                            <p className="font-semibold text-blue-900 flex items-center gap-1">
                              <span>📱</span> {invoice.device_model}
                            </p>
                            {invoice.issue_reported && (
                              <p className="text-xs text-slate-500 truncate max-w-[200px]" title={invoice.issue_reported}>
                                {invoice.issue_reported}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-slate-400" /> Device / Accessory Sale
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{invoice.invoice_date || '—'}</p>
                        <p className="text-[11px] text-slate-400">{invoice.intake_time || ''}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-slate-900">{formatCurrency(invoice.total)}</p>
                        {parseFloat(invoice.advance_paid) > 0 && (
                          <p className="text-[11px] text-emerald-600">Adv: {formatCurrency(invoice.advance_paid)}</p>
                        )}
                      </td>

                      {/* Interactive Work / Service Status Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={invoice.repair_status || 'Delivered to Customer'}
                          onChange={(e) => handleRepairStatusChange(invoice.id, e.target.value)}
                          className={`text-xs font-bold py-1.5 px-2.5 rounded-lg border outline-none cursor-pointer transition-all shadow-xs ${
                            isWorking
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : isReady
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <option value="Pending (Currently Working)">🟡 Pending (Working)</option>
                          <option value="Finished / Ready for Pickup">🟢 Finished (Ready)</option>
                          <option value="Delivered to Customer">🔵 Delivered</option>
                          <option value="Unserviceable / Returned">⚪ Unserviceable</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/invoices/view/${invoice.id}`}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View & Print Bill / Job Slip"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {invoice.customer_phone && (
                            <button
                              onClick={() => sendWhatsAppUpdate(invoice)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Send WhatsApp Update"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}

                          <Link
                            to={`/invoices/edit/${invoice.id}`}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Bill"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          <div className="relative">
                            <button
                              onClick={() => setActionMenuId(actionMenuId === invoice.id ? null : invoice.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {actionMenuId === invoice.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 text-left">
                                  <button onClick={() => handleDuplicate(invoice)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                                    <Copy className="w-3.5 h-3.5" /> Duplicate
                                  </button>
                                  <button onClick={() => { setShowDeleteModal(invoice.id); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Bill
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Bill?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone. All bill items and records will be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(showDeleteModal)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
