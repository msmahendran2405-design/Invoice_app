import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency, formatIndianDate } from '../../utils/indianUtils';
import {
  Wrench, Plus, Search, Edit, Trash2, CheckCircle2, Clock, Smartphone,
  Phone, User, Calendar, AlertCircle, MessageCircle, Printer, FileText,
  Check, RefreshCw, X, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const SERVICE_STATUSES = [
  { id: 'Received', label: '🔵 Received', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'In Progress', label: '🟡 In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Ready for Delivery', label: '🟢 Ready for Delivery', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Delivered', label: '✅ Delivered', color: 'bg-slate-800 text-white border-slate-700' },
  { id: 'Cancelled', label: '❌ Cancelled', color: 'bg-red-50 text-red-700 border-red-200' },
];

export default function ServiceOrderList() {
  const { user, activeCompanyId, currentCompany } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [serviceOrders, setServiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [printJobCard, setPrintJobCard] = useState(null);
  const [saving, setSaving] = useState(false);

  // Exact 5 Fields: Name, Phone Number, Phone Model, Service Details, Status (+ optional Est. Amount)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    device_model: '',
    service_details: '',
    status: 'Received',
    estimated_cost: '350',
  });

  useEffect(() => {
    loadServiceOrders();
    const handleOpen = () => openAddModal();
    window.addEventListener('open-service-modal', handleOpen);
    return () => window.removeEventListener('open-service-modal', handleOpen);
  }, [activeCompanyId]);

  const loadServiceOrders = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.INVOICES, true);
      // Map invoices representing service jobs
      const serviceData = data.filter(inv => inv.id && (inv.device_model || inv.repair_status));
      setServiceOrders(serviceData);
    } catch {
      toast.error('Failed to load service jobs');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingOrder(null);
    setForm({
      customer_name: '',
      customer_phone: '',
      device_model: '',
      service_details: '',
      status: 'Received',
      estimated_cost: '350',
    });
    setShowModal(true);
  };

  const openEditModal = (order) => {
    setEditingOrder(order);
    setForm({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      device_model: order.device_model || '',
      service_details: order.issue_reported || '',
      status: order.repair_status || 'Received',
      estimated_cost: order.estimated_cost || order.total || '350',
    });
    setShowModal(true);
  };

  const handleSaveJobCard = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.device_model.trim()) {
      toast.error('Please enter Customer Name, Phone Number and Phone Model');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const estCost = parseFloat(form.estimated_cost) || 0;

      if (editingOrder) {
        await db.updateRow(SHEET_NAMES.INVOICES, editingOrder.id, {
          ...editingOrder,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          device_model: form.device_model.trim(),
          issue_reported: form.service_details.trim(),
          repair_status: form.status,
          estimated_cost: String(estCost),
          total: String(estCost),
          updated_at: now,
        });
        toast.success('Service updated successfully!');
      } else {
        const nextNum = await db.getNextInvoiceNumber();
        const jobNum = `JOB-${nextNum.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;

        await db.appendRow(SHEET_NAMES.INVOICES, {
          company_id: activeCompanyId || '1',
          invoice_number: jobNum,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          device_model: form.device_model.trim(),
          issue_reported: form.service_details.trim(),
          repair_status: form.status,
          estimated_cost: String(estCost),
          total: String(estCost),
          invoice_date: now.split('T')[0],
          status: 'pending',
          created_by: user?.id || '1',
          creator_name: user?.full_name || 'Technician',
          created_at: now,
          updated_at: now,
        });

        // Auto-save Customer to customer directory
        if (form.customer_phone.trim()) {
          try {
            const allCust = await db.fetchSheet(SHEET_NAMES.CUSTOMERS, true);
            const found = allCust.find(c => c.phone === form.customer_phone.trim());
            if (!found) {
              await db.appendRow(SHEET_NAMES.CUSTOMERS, {
                company_id: activeCompanyId || '1',
                name: form.customer_name.trim(),
                phone: form.customer_phone.trim(),
                created_at: now,
              });
            }
          } catch (cErr) {
            console.warn('Customer auto-sync note:', cErr);
          }
        }

        toast.success(`New Service Job ${jobNum} added!`);
      }

      setShowModal(false);
      loadServiceOrders();
    } catch {
      toast.error('Failed to save service job');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await db.updateRow(SHEET_NAMES.INVOICES, orderId, {
        repair_status: newStatus,
        updated_at: new Date().toISOString(),
      });
      setServiceOrders(prev => prev.map(o => o.id === orderId ? { ...o, repair_status: newStatus } : o));
      toast.success(`Status updated: ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSendWhatsApp = (order) => {
    if (!order.customer_phone) {
      toast.error('No phone number available');
      return;
    }
    const cleanPhone = order.customer_phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const shop = currentCompany?.name || 'Mobile Care';
    const status = order.repair_status || 'Received';
    
    let msg = `Hello ${order.customer_name}!\nGreetings from ${shop}.\nYour ${order.device_model} service status is: *${status}*.`;
    if (status.includes('Ready') || status.includes('Completed')) {
      msg += `\nYour phone is ready for pickup! Total Amount: ₹${order.estimated_cost || order.total || 0}.`;
    }
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const filteredOrders = useMemo(() => {
    return serviceOrders.filter(o => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.device_model?.toLowerCase().includes(q) ||
        o.issue_reported?.toLowerCase().includes(q) ||
        o.invoice_number?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const st = (o.repair_status || '').toLowerCase();
      if (activeTab === 'all') return true;
      if (activeTab === 'active') return !st.includes('deliver') && !st.includes('cancel');
      if (activeTab === 'ready') return st.includes('ready');
      if (activeTab === 'delivered') return st.includes('deliver');
      return true;
    }).sort((a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date));
  }, [serviceOrders, searchQuery, activeTab]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <span>Customer Service Management</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                {serviceOrders.length} Services
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Add customer details (Name, Phone, Phone Model, Service Details) and update service status.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Customer Service</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Services ({serviceOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'active' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            In Progress (
            {serviceOrders.filter(o => {
              const st = (o.repair_status || '').toLowerCase();
              return !st.includes('deliver') && !st.includes('cancel');
            }).length}
            )
          </button>
          <button
            onClick={() => setActiveTab('ready')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ready' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ready for Delivery (
            {serviceOrders.filter(o => (o.repair_status || '').toLowerCase().includes('ready')).length}
            )
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'delivered' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Delivered (
            {serviceOrders.filter(o => (o.repair_status || '').toLowerCase().includes('deliver')).length}
            )
          </button>
        </div>

        {/* Search */}
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, phone model..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Services List Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center py-16 bg-white border border-slate-200">
          <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No service records found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Click below to add customer details and phone service intake.</p>
          <button onClick={openAddModal} className="btn-primary text-xs">
            <Plus className="w-4 h-4" /> + Add Customer Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const currentStatus = order.repair_status || 'Received';
            const statusConfig = SERVICE_STATUSES.find(s => s.id === currentStatus) || SERVICE_STATUSES[0];
            const isDelivered = currentStatus === 'Delivered';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div>
                  {/* Top Header: Phone Model & Status Selector */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {order.invoice_number || 'JOB'}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="truncate">{order.device_model || 'Mobile Handset'}</span>
                      </h3>
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative">
                      <select
                        value={currentStatus}
                        onChange={e => handleUpdateStatus(order.id, e.target.value)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${statusConfig.color}`}
                      >
                        {SERVICE_STATUSES.map(st => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Customer Details Box: Name & Phone Number */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs border border-slate-100">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{order.customer_name}</span>
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-slate-600 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.customer_phone}</span>
                      </p>
                      {order.customer_phone && (
                        <button
                          onClick={() => handleSendWhatsApp(order)}
                          className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-200 flex items-center gap-1 transition-colors"
                          title="Send WhatsApp Update"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Details:</p>
                    <p className="text-xs text-slate-800 mt-0.5 font-medium bg-amber-50/50 p-2 rounded-lg border border-amber-100/70">
                      {order.issue_reported || 'General Service & Repair'}
                    </p>
                  </div>

                  {/* Estimated Cost */}
                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Service Charge:</span>
                    <strong className="text-sm font-bold text-indigo-700">
                      {formatCurrency(order.estimated_cost || order.total || 0)}
                    </strong>
                  </div>
                </div>

                {/* Actions: Deliver Button & Generate Bill */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!isDelivered ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'Delivered')}
                        className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                        title="Mark Delivered"
                      >
                        <Check className="w-3.5 h-3.5" /> Deliver
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Handed Over
                      </span>
                    )}

                    <Link
                      to={`/invoices/new?from_service=${order.id}`}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 transition-colors"
                      title="Generate Bill"
                    >
                      <FileText className="w-3.5 h-3.5" /> Bill
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPrintJobCard(order)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Print Job Slip"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(order)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Service"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simplified Add / Edit Modal (Only 5 Fields) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingOrder ? 'Edit Customer Service' : 'New Customer Service'}
                  </h3>
                  <p className="text-xs text-gray-500">Enter customer details, phone model, service details & status</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJobCard} className="p-6 space-y-4">
              {/* 1. Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  1. Customer Name *
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  required
                  autoFocus
                  className="input-field text-xs"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              {/* 2. Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  2. Phone Number *
                </label>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                  required
                  className="input-field text-xs font-mono"
                  placeholder="e.g. 98401 23456"
                />
              </div>

              {/* 3. Phone Model */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  3. Phone Model *
                </label>
                <input
                  type="text"
                  value={form.device_model}
                  onChange={e => setForm({ ...form, device_model: e.target.value })}
                  required
                  className="input-field text-xs"
                  placeholder="e.g. Samsung M31 / Vivo Y20 / iPhone 13"
                />
              </div>

              {/* 4. Service Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  4. Service Details *
                </label>
                <textarea
                  value={form.service_details}
                  onChange={e => setForm({ ...form, service_details: e.target.value })}
                  required
                  rows={2}
                  className="input-field text-xs resize-none"
                  placeholder="e.g. Display broken / Battery draining fast / Charging port loose"
                />
              </div>

              {/* 5. Status & Service Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    5. Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="select-field text-xs font-bold"
                  >
                    {SERVICE_STATUSES.map(st => (
                      <option key={st.id} value={st.id}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Charge (₹)
                  </label>
                  <input
                    type="number"
                    value={form.estimated_cost}
                    onChange={e => setForm({ ...form, estimated_cost: e.target.value })}
                    className="input-field text-xs font-mono font-bold text-indigo-700"
                    placeholder="350"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : editingOrder ? 'Update Service' : '+ Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Job Slip Modal */}
      {printJobCard && (
        <div className="modal-overlay" onClick={() => setPrintJobCard(null)}>
          <div className="modal-content max-w-sm p-6 bg-white" onClick={e => e.stopPropagation()}>
            <div className="text-center border-b pb-3 mb-3">
              <h3 className="font-bold text-sm text-slate-900">{currentCompany?.name || 'Mobile Care & Service'}</h3>
              <p className="text-[11px] text-slate-500">{currentCompany?.phone || currentCompany?.address || 'Service Center'}</p>
              <span className="inline-block mt-1 font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded">
                SLIP: {printJobCard.invoice_number || 'JOB'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{printJobCard.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-900">{printJobCard.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone Model:</span>
                <span className="font-bold text-slate-900">{printJobCard.device_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service Details:</span>
                <span className="font-medium text-slate-800 text-right">{printJobCard.issue_reported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-blue-700">{printJobCard.repair_status || 'Received'}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold text-slate-700">Service Charge:</span>
                <span className="font-bold text-indigo-700 text-sm">₹{printJobCard.estimated_cost || printJobCard.total || 0}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => window.print()} className="btn-primary w-full text-xs py-2">
                <Printer className="w-3.5 h-3.5 inline mr-1" /> Print Slip
              </button>
              <button onClick={() => setPrintJobCard(null)} className="btn-secondary w-full text-xs py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
