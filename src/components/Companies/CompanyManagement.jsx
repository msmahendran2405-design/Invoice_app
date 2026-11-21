import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import {
  Building, Plus, Search, Edit, Trash2, CheckCircle, XCircle, ShieldCheck,
  RefreshCw, ExternalLink, Calendar, MapPin, Phone, Mail, Award, ArrowRight, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompanyManagement() {
  const { currentCompany, switchCompany, activeCompanyId, loadCompanies, isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    state_code: '33',
    pincode: '',
    invoice_prefix: 'INV-',
    upi_id: '',
    subscription_plan: 'Enterprise',
    subscription_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    terms_conditions: '1. Standard 60-day service warranty.\n2. Goods once sold are not returnable.',
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.COMPANIES, true);
      setCompanies(data.filter(c => c.id));
    } catch (e) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCompany(null);
    setForm({
      name: '',
      gstin: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: 'Tamil Nadu',
      state_code: '33',
      pincode: '',
      invoice_prefix: 'MOB-',
      upi_id: '',
      subscription_plan: 'Enterprise',
      subscription_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      terms_conditions: '1. Standard 60-day service warranty.\n2. Goods once sold are not returnable.',
    });
    setShowModal(true);
  };

  const openEditModal = (comp) => {
    setEditingCompany(comp);
    setForm({
      name: comp.name || '',
      gstin: comp.gstin || '',
      email: comp.email || '',
      phone: comp.phone || '',
      address: comp.address || '',
      city: comp.city || '',
      state: comp.state || 'Tamil Nadu',
      state_code: comp.state_code || '33',
      pincode: comp.pincode || '',
      invoice_prefix: comp.invoice_prefix || 'INV-',
      upi_id: comp.upi_id || '',
      subscription_plan: comp.subscription_plan || 'Enterprise',
      subscription_expiry: comp.subscription_expiry || '',
      terms_conditions: comp.terms_conditions || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company Name is required');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingCompany) {
        await db.updateRow(SHEET_NAMES.COMPANIES, editingCompany.id, {
          ...editingCompany,
          ...form,
          updated_at: now,
        });
        toast.success('Company updated successfully!');
      } else {
        await db.appendRow(SHEET_NAMES.COMPANIES, {
          ...form,
          is_active: 'true',
          created_at: now,
          updated_at: now,
        });
        toast.success('New company created!');
      }

      setShowModal(false);
      await fetchCompanies();
      await loadCompanies();
    } catch (err) {
      toast.error('Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanyStatus = async (comp) => {
    if (String(comp.id) === '1') {
      toast.error('Cannot deactivate default primary company');
      return;
    }
    try {
      const newStatus = comp.is_active === 'false' ? 'true' : 'false';
      await db.updateRow(SHEET_NAMES.COMPANIES, comp.id, {
        ...comp,
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      });
      toast.success(`Company ${newStatus === 'true' ? 'activated' : 'deactivated'}`);
      fetchCompanies();
      loadCompanies();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredCompanies = companies.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.gstin?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Super Admin Top Banner */}
      <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Building className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Super Admin • Multi-Company Management</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Multi-Tenant Architecture
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Register companies, manage subscription plans, assign company admins, and strictly isolate company data.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="btn-primary bg-blue-500 hover:bg-blue-400 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Add New Company
        </button>
      </div>

      {/* Active Company Quick Switcher Banner */}
      <div className="card py-3 px-4 bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-500 font-semibold uppercase">Currently Active Tenant:</span>
          <strong className="text-sm font-bold text-slate-900">{currentCompany?.name}</strong>
          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
            {currentCompany?.gstin || 'GSTIN: Active'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Super Admin can switch to any company to manage bills, staff, and services.
        </p>
      </div>

      {/* Search & Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search companies by name, GSTIN, city or state..."
            className="input-field pl-10 text-sm"
          />
        </div>
        <button
          onClick={fetchCompanies}
          className="btn-secondary py-2.5 px-3 flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh company list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="card text-center py-16 bg-white border border-slate-200">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No companies found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your first company or adjust search filters.</p>
          <button onClick={openAddModal} className="btn-primary text-xs">
            <Plus className="w-4 h-4" /> Add Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.map(comp => {
            const isSelected = String(comp.id) === String(activeCompanyId);
            const isActive = comp.is_active !== 'false';

            return (
              <div
                key={comp.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-2 ring-blue-100'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                        {comp.name?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm truncate" title={comp.name}>
                            {comp.name}
                          </h3>
                          {isSelected && (
                            <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                              Active Context
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-emerald-700 font-bold mt-0.5">
                          {comp.gstin || 'GSTIN: Not Set'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Location:</span>
                      <p className="font-semibold text-slate-800 truncate">
                        {comp.city || 'City'}, {comp.state || 'Tamil Nadu'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Subscription:</span>
                      <p className="font-bold text-indigo-700 truncate">
                        {comp.subscription_plan || 'Enterprise'} Plan
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    {comp.phone && (
                      <p className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" /> {comp.phone}
                      </p>
                    )}
                    {comp.email && (
                      <p className="flex items-center gap-1.5 text-[11px] truncate">
                        <Mail className="w-3 h-3 text-slate-400" /> {comp.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      switchCompany(comp.id);
                      toast.success(`Switched active context to: ${comp.name}`);
                    }}
                    disabled={isSelected || !isActive}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs cursor-default'
                        : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <span>{isSelected ? '✓ Current Active' : 'Switch Context'}</span>
                    {!isSelected && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(comp)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit company profile"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleCompanyStatus(comp)}
                      disabled={String(comp.id) === '1'}
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={isActive ? 'Deactivate company access' : 'Activate company access'}
                    >
                      {isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingCompany ? 'Edit Company Profile' : 'Register New Company'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Configure company details, GSTIN, and subscription plan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Company / Business Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    className="input-field"
                    placeholder="e.g. Sai Ram Mobile Care & Service Center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">GSTIN Number *</label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    className="input-field font-mono"
                    placeholder="e.g. 33AAAAA0000A1Z5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={form.invoice_prefix}
                    onChange={e => setForm({ ...form, invoice_prefix: e.target.value })}
                    className="input-field font-mono"
                    placeholder="e.g. MOB-"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="input-field font-mono"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="input-field"
                    placeholder="service@company.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Street Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="input-field"
                    placeholder="Shop number, Commercial complex, Street"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Coimbatore"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">State & Code</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Tamil Nadu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">UPI ID for QR Code</label>
                  <input
                    type="text"
                    value={form.upi_id}
                    onChange={e => setForm({ ...form, upi_id: e.target.value })}
                    className="input-field font-mono"
                    placeholder="company@upi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Subscription Plan</label>
                  <select
                    value={form.subscription_plan}
                    onChange={e => setForm({ ...form, subscription_plan: e.target.value })}
                    className="select-field"
                  >
                    <option value="Enterprise">Enterprise (Unlimited Staff & Invoices)</option>
                    <option value="Professional">Professional (Up to 10 Staff)</option>
                    <option value="Starter">Starter (Single Store)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : editingCompany ? 'Update Company' : 'Register Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
