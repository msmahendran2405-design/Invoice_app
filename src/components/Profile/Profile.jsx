import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import authService from '../../services/authService';
import { Save, Lock, User, Mail, Phone, Shield, Building, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, updateCurrentUser, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [passwords, setPasswords] = useState({ current: '', new_password: '', confirm: '' });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await authService.updateUser(user.id, form);
      updateCurrentUser(form);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (passwords.new_password !== passwords.confirm) { toast.error('Passwords do not match'); return; }
    
    setChangingPassword(true);
    try {
      await authService.changePassword(user.id, passwords.current, passwords.new_password);
      setPasswords({ current: '', new_password: '', confirm: '' });
      toast.success('Password changed successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    } finally { setChangingPassword(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{user?.full_name}</h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <Shield className="w-3.5 h-3.5" />
                  {isAdmin ? '👑 Administrator' : '👤 Client User'}
                </span>
              </div>
              <p className="text-sm text-gray-500 font-mono mt-0.5">@{user?.username}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 pt-6">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Personal Information</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-400" /> Full Name
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))}
              className="input-field"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-gray-400" /> Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-gray-400" /> Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="input-field font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* Assigned Company & GST Card */}
      <div className="card bg-slate-900 text-white border-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Assigned Company Profile & GST</span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                  Admin Master Config
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'As Admin, you can edit these company details in Shop Profile & GST.'
                  : 'Created and managed by Administrator. Applied automatically to all your bills and customer records.'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Link to="/settings" className="btn-secondary py-1.5 px-3 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
              Edit in Settings
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium">Shop / Business Name</p>
            <p className="font-bold text-white text-base mt-0.5">{user?.company_name || settings.company_name || 'Sai Ram Mobile Care & Service Center'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">GST Identification Number (GSTIN)</p>
            <p className="font-mono font-bold text-emerald-400 mt-0.5">{user?.gstin || settings.tax_id || 'Unregistered / Nil GST'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Address</p>
            <p className="text-slate-300 text-xs mt-0.5">{user?.address || settings.company_address || 'City Mobile Complex, Market Road'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">License Validity</p>
            <p className="text-emerald-400 text-xs mt-0.5 font-bold">
              {user?.subscription_valid_until ? `Active (Valid till ${user.subscription_valid_until})` : 'Active 1-Year License'}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-gray-400" /> Change Login Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={passwords.current}
              onChange={e => setPasswords(prev => ({ ...prev, current: e.target.value }))}
              className="input-field"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={passwords.new_password}
                onChange={e => setPasswords(prev => ({ ...prev, new_password: e.target.value }))}
                className="input-field"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={e => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                className="input-field"
                required
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={changingPassword} className="btn-primary">
              <Lock className="w-4 h-4" /> Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
