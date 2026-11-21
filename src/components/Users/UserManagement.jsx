import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import authService from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus, Search, Edit, Trash2, X, UserCog, Shield, ShieldCheck, ShieldAlert,
  RefreshCw, Eye, EyeOff, Lock, CheckCircle, AlertTriangle, Building,
  Phone, Mail, Calendar, KeyRound, ArrowRight, Store, QrCode
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const { user, switchCompany } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    company_name: '',
    gstin: '',
    address: '',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    upi_id: '',
    invoice_prefix: 'MOB-',
    subscription_valid_until: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  });

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
      setSearchParams({}, { replace: true });
    }
    const handleOpen = () => openAddModal();
    window.addEventListener('open-client-modal', handleOpen);
    return () => window.removeEventListener('open-client-modal', handleOpen);
  }, [searchParams]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await authService.getAllUsers();
      setUsers(data.filter(u => u.id));
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const isPrimaryAdmin = (u) => {
    return u?.username === 'admin@invoice.com' || u?.username === 'admin';
  };

  const clientsList = useMemo(() => {
    return users.filter(u => !isPrimaryAdmin(u));
  }, [users]);

  const activeClientsCount = useMemo(() => {
    return clientsList.filter(c => c.is_active !== 'false').length;
  }, [clientsList]);

  const filteredClients = useMemo(() => {
    return clientsList.filter(u => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.company_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.gstin?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q)
      );
    });
  }, [clientsList, searchQuery]);

  const openAddModal = () => {
    setEditingUser(null);
    setShowPassword(false);
    setForm({
      full_name: '',
      username: '',
      password: '',
      phone: '',
      email: '',
      company_name: '',
      gstin: '',
      address: '',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      upi_id: '',
      invoice_prefix: 'MOB-',
      subscription_valid_until: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setEditingUser(client);
    setShowPassword(false);
    setForm({
      full_name: client.full_name || '',
      username: client.username || '',
      password: '',
      phone: client.phone || '',
      email: client.email || '',
      company_name: client.company_name || '',
      gstin: client.gstin || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || 'Tamil Nadu',
      upi_id: client.upi_id || '',
      invoice_prefix: client.invoice_prefix || 'MOB-',
      subscription_valid_until: client.subscription_valid_until || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.full_name.trim() || !form.company_name.trim()) {
      toast.error('Owner Name, Shop Name, and Username are required');
      return;
    }
    if (!editingUser && !form.password) {
      toast.error('Password is required for new client account');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updateData = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          company_name: form.company_name.trim(),
          gstin: form.gstin.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          upi_id: form.upi_id.trim(),
          invoice_prefix: form.invoice_prefix.trim(),
          subscription_valid_until: form.subscription_valid_until,
        };
        if (form.password) {
          updateData.password = form.password;
        }
        await authService.updateUser(editingUser.id, updateData);
        toast.success(`Client ${form.company_name} updated successfully!`);
      } else {
        await authService.register({
          ...form,
          username: form.username.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          company_name: form.company_name.trim(),
          role: 'client',
        });
        toast.success(`Client account created for ${form.company_name}!`);
      }
      setShowModal(false);
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to save client account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await authService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setShowDeleteModal(null);
      toast.success('Client account deleted');
    } catch {
      toast.error('Failed to delete client');
    }
  };

  const toggleActive = async (client) => {
    try {
      const newStatus = client.is_active === 'false' ? 'true' : 'false';
      await authService.updateUser(client.id, { is_active: newStatus });
      loadUsers();
      toast.success(`Client license ${newStatus === 'true' ? 'activated' : 'suspended'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Client Licensing & User Management</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Admin Control
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Create client logins for shops purchasing your software. Each client logs in to their customized billing portal with their own Shop Name, GSTIN, and address.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Create New Client Login
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Clients (Sold)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{clientsList.length} Shops</p>
        </div>
        <div className="card py-3.5 px-4 bg-emerald-50/70 border border-emerald-200">
          <p className="text-xs text-emerald-800 font-bold uppercase">Active Licensed Clients</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{activeClientsCount} Active</p>
        </div>
        <div className="card py-3.5 px-4 bg-amber-50/70 border border-amber-200">
          <p className="text-xs text-amber-800 font-bold uppercase">Admin Super Account</p>
          <p className="text-sm font-bold text-amber-900 mt-1 font-mono">admin@invoice.com</p>
        </div>
      </div>

      {/* Search & Refresh Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by client shop name, owner, username or GSTIN..."
            className="input-field pl-10 text-xs"
          />
        </div>
        <button
          onClick={loadUsers}
          className="btn-secondary py-2.5 px-3 flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh client list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Clients Table */}
      <div className="card p-0 overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No client accounts created yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Click below to create the first client login and shop profile.</p>
            <button onClick={openAddModal} className="btn-primary text-xs">
              <Plus className="w-4 h-4" /> Create New Client
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Client Shop Name</th>
                  <th className="py-3 px-4">Login Username</th>
                  <th className="py-3 px-4">Owner / Contact</th>
                  <th className="py-3 px-4">GSTIN & Location</th>
                  <th className="py-3 px-4">License Validity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map(client => {
                  const isActive = client.is_active !== 'false';
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-xs flex-shrink-0"
                            style={{ backgroundColor: client.avatar_color || '#3b82f6' }}
                          >
                            {client.company_name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">
                              {client.company_name || 'Mobile Service Center'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Prefix: {client.invoice_prefix || 'MOB-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                          @{client.username}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{client.full_name}</div>
                        {client.phone && (
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {client.phone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-emerald-700 font-bold">{client.gstin || 'Unregistered'}</div>
                        <div className="text-[11px] text-slate-500">{client.city || 'City'}, {client.state || 'Tamil Nadu'}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {client.subscription_valid_until ? (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Valid till {client.subscription_valid_until}</span>
                          </span>
                        ) : (
                          'Active 1 Year'
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(client)}
                          className={`badge cursor-pointer ${
                            isActive ? 'badge-success' : 'badge-danger'
                          }`}
                          title="Click to toggle client access"
                        >
                          {isActive ? 'Active' : 'Suspended'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(client)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
                            title="Edit Client Credentials or Shop Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteModal(client.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete Client Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Create / Edit Client Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingUser ? 'Edit Client Account & Shop Details' : 'Register New Client (Sell Software)'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Create login credentials and customize the software with the client's shop name & GSTIN
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Client Login Credentials */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Client Login Access
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Owner / Contact Name *</label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={e => setForm({ ...form, full_name: e.target.value })}
                      required
                      className="input-field text-xs"
                      placeholder="e.g. Ramesh Kumar"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Login Username (Login ID) *</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                      required
                      disabled={!!editingUser}
                      className="input-field text-xs font-mono"
                      placeholder="e.g. sairam1 or johnmobile"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Login Password {editingUser ? '(leave blank to keep current)' : '*'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        required={!editingUser}
                        className="input-field text-xs font-mono pr-9"
                        placeholder="e.g. client123"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Phone (10-Digit) *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      required
                      className="input-field text-xs font-mono"
                      placeholder="+91 98401 23456"
                    />
                  </div>
                </div>
              </div>

              {/* Client Shop Branding & GST */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-600" /> Client Shop Details (Printed on Invoices)
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Client Shop / Business Name *</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => setForm({ ...form, company_name: e.target.value })}
                    required
                    className="input-field text-xs font-bold"
                    placeholder="e.g. Sai Ram Mobile Care & Service Center"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN Number (Optional)</label>
                    <input
                      type="text"
                      value={form.gstin}
                      onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                      className="input-field text-xs font-mono"
                      placeholder="e.g. 33AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Bill / Invoice Prefix</label>
                    <input
                      type="text"
                      value={form.invoice_prefix}
                      onChange={e => setForm({ ...form, invoice_prefix: e.target.value.toUpperCase() })}
                      className="input-field text-xs font-mono"
                      placeholder="e.g. MOB-"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="input-field text-xs"
                    placeholder="e.g. Shop No. 14, City Mobile Complex, 1st Cross, Market Road"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      className="input-field text-xs"
                      placeholder="Coimbatore"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={e => setForm({ ...form, state: e.target.value })}
                      className="input-field text-xs"
                      placeholder="Tamil Nadu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">UPI ID (For QR Code)</label>
                    <input
                      type="text"
                      value={form.upi_id}
                      onChange={e => setForm({ ...form, upi_id: e.target.value })}
                      className="input-field text-xs font-mono"
                      placeholder="shop@upi"
                    />
                  </div>
                </div>
              </div>

              {/* License Validity */}
              <div className="pt-3 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Software License Valid Until</label>
                    <input
                      type="date"
                      value={form.subscription_valid_until}
                      onChange={e => setForm({ ...form, subscription_valid_until: e.target.value })}
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="input-field text-xs"
                      placeholder="client@service.com"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : editingUser ? 'Update Client' : 'Create Client Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete Client Account?</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              This client will no longer be able to log in. Their bills and customer service data will remain preserved in the Google Sheet database.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => handleDelete(showDeleteModal)} className="btn-danger text-xs">Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
