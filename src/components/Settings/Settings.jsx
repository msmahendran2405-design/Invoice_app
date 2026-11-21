import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Save, Building, Palette, FileText, Database, Shield, Store,
  Smartphone, ShoppingCart, Briefcase, Check, AlertCircle, RefreshCw, QrCode
} from 'lucide-react';
import db from '../../services/googleSheets';
import { BUSINESS_PRESETS } from '../../utils/presets';
import { INDIAN_STATES } from '../../utils/indianUtils';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'branding', label: 'Shop Profile & GST', icon: Building },
  { id: 'database', label: 'Google Sheets DB', icon: Database },
  { id: 'invoice', label: 'GST & Invoice Defaults', icon: FileText },
  { id: 'permissions', label: 'Client Permissions', icon: Shield },
  { id: 'presets', label: 'Industry Presets', icon: Store },
  { id: 'theme', label: 'Theme', icon: Palette },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

export default function Settings() {
  const { settings, updateMultipleSettings, applyPreset } = useSettings();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('branding');
  const [saving, setSaving] = useState(false);
  const [applyingPresetKey, setApplyingPresetKey] = useState(null);
  const [formData, setFormData] = useState({ ...settings });
  const [sheetsConfig, setSheetsConfig] = useState(db.getConfig());

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyPreset = async (presetKey, replaceProducts = true) => {
    if (!window.confirm(`Apply preset "${BUSINESS_PRESETS[presetKey].name}"? ${replaceProducts ? 'This will update settings and load sample products for this shop.' : 'This will update settings only.'}`)) {
      return;
    }

    setApplyingPresetKey(presetKey);
    try {
      await applyPreset(presetKey, replaceProducts);
      const presetSettings = BUSINESS_PRESETS[presetKey].settings;
      setFormData(prev => ({ ...prev, ...presetSettings }));
      toast.success(`Applied ${BUSINESS_PRESETS[presetKey].name} preset!`);
    } catch (err) {
      toast.error('Failed to apply preset');
    } finally {
      setApplyingPresetKey(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await updateMultipleSettings({
        company_name: formData.company_name || 'Sai Ram Mobile Care & Service Center',
        company_email: formData.company_email || '',
        company_phone: formData.company_phone || '',
        company_address: formData.company_address || '',
        company_website: formData.company_website || '',
        company_tagline: formData.company_tagline || '',
        currency: 'INR',
        currency_symbol: '₹',
        tax_id: formData.tax_id || '',
        upi_id: formData.upi_id || '',
        state_name: formData.state_name || 'Tamil Nadu',
        state_code: formData.state_code || '33',
        default_terms: formData.default_terms || '',
        default_notes: formData.default_notes || '',
        invoice_prefix: formData.invoice_prefix || 'MOB-',
        payment_terms: formData.payment_terms || 'Due on Delivery',
        catalog_admin_only: String(formData.catalog_admin_only),
        allow_custom_price: String(formData.allow_custom_price),
        allow_custom_items: String(formData.allow_custom_items),
        enable_device_fields: String(formData.enable_device_fields),
        business_type: 'mobile_service',
      });
      toast.success('All shop details, Indian Rupee (₹) & GST profile saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      await updateMultipleSettings({
        catalog_admin_only: String(formData.catalog_admin_only),
        allow_custom_price: String(formData.allow_custom_price),
        allow_custom_items: String(formData.allow_custom_items),
        allow_user_discounts: String(formData.allow_user_discounts),
        max_discount_percent: String(formData.max_discount_percent || '10'),
        enable_device_fields: String(formData.enable_device_fields),
        enable_grocery_fields: String(formData.enable_grocery_fields),
      });
      toast.success('Staff permissions updated successfully!');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoice = async () => {
    setSaving(true);
    try {
      await updateMultipleSettings({
        currency: formData.currency,
        currency_symbol: formData.currency_symbol,
        tax_name: formData.tax_name,
        default_tax_rate: formData.default_tax_rate,
        tax_id: formData.tax_id || '',
        upi_id: formData.upi_id || '',
        state_name: formData.state_name || 'Tamil Nadu',
        state_code: formData.state_code || '33',
        invoice_prefix: formData.invoice_prefix,
        payment_terms: formData.payment_terms,
        default_notes: formData.default_notes,
        default_terms: formData.default_terms,
        default_invoice_layout: formData.default_invoice_layout || 'standard_a4',
        thermal_paper_width: formData.thermal_paper_width || '80mm',
      });
      toast.success('GST & POS settings saved successfully!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await updateMultipleSettings({
        company_name: formData.company_name,
        company_email: formData.company_email,
        company_phone: formData.company_phone,
        company_address: formData.company_address,
        company_website: formData.company_website,
        company_tagline: formData.company_tagline,
        tax_id: formData.tax_id || '',
        upi_id: formData.upi_id || '',
        state_name: formData.state_name || 'Tamil Nadu',
        state_code: formData.state_code || '33',
        default_terms: formData.default_terms || '',
      });
      toast.success('Shop details & GST settings saved!');
    } catch {
      toast.error('Failed to save shop settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    try {
      await updateMultipleSettings({ primary_color: formData.primary_color });
      toast.success('Theme saved!');
    } catch {
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSheetsConfig = () => {
    db.saveConfig({
      ...sheetsConfig,
      isConfigured: Boolean(sheetsConfig.webAppUrl || (sheetsConfig.spreadsheetId && sheetsConfig.apiKey)),
    });
    toast.success('Google Sheets configuration saved!');
  };

  const handleCurrencyChange = (code) => {
    const currency = CURRENCIES.find(c => c.code === code);
    if (currency) {
      setFormData(prev => ({ ...prev, currency: currency.code, currency_symbol: currency.symbol }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Banner with 1-Click Save */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-4 rounded-2xl text-white shadow-md border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center border border-blue-400/30 flex-shrink-0">
            <Smartphone className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Mobile Shop Profile & Settings</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-semibold">
                🇮🇳 ₹ INR Active
              </span>
            </h3>
            <p className="text-xs text-blue-200 mt-0.5">
              Change your shop name, phone, address, GSTIN & UPI ID anytime.
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all flex-shrink-0 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Changes...' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1.5 rounded-xl">
        {(isAdmin ? TABS : TABS.filter(t => ['branding', 'invoice', 'theme'].includes(t.id))).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 min-w-[130px] justify-center ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Preset Tab */}
      {activeTab === 'presets' && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title">Industry Shop Presets</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Quickly customize the entire application for your specific business type with 1-click presets.
              </p>
            </div>
            <span className="badge badge-primary">
              Active: {BUSINESS_PRESETS[formData.business_type]?.name || 'Custom Setup'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mobile Service Shop */}
            <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              formData.business_type === 'mobile_service'
                ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">Mobile Service Shop</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Includes IMEI / Serial tracking, Device Model, Problem diagnosis, 90-day warranty terms & repair catalog.
                </p>
                <div className="pt-2 text-[11px] text-gray-600 space-y-1">
                  <div>✓ Device Model & IMEI tracking</div>
                  <div>✓ Repair Status & Fault notes</div>
                  <div>✓ 90-day parts warranty clauses</div>
                  <div>✓ Screen & battery repair items</div>
                </div>
              </div>
              <button
                disabled={applyingPresetKey === 'mobile_service'}
                onClick={() => handleApplyPreset('mobile_service')}
                className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  formData.business_type === 'mobile_service'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {applyingPresetKey === 'mobile_service' ? 'Applying...' : formData.business_type === 'mobile_service' ? 'Current Active Preset' : 'Apply Mobile Preset'}
              </button>
            </div>

            {/* Grocery Shop */}
            <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              formData.business_type === 'grocery'
                ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">Grocery & Supermarket</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Fast counter billing with Barcode/SKU scanning, measurement units (kg, g, L, pcs) & 80mm thermal receipt.
                </p>
                <div className="pt-2 text-[11px] text-gray-600 space-y-1">
                  <div>✓ Fast Barcode / SKU item search</div>
                  <div>✓ Units (kg, grams, liter, pcs, pack)</div>
                  <div>✓ Compact 80mm Thermal POS receipt</div>
                  <div>✓ Grocery essentials catalog</div>
                </div>
              </div>
              <button
                disabled={applyingPresetKey === 'grocery'}
                onClick={() => handleApplyPreset('grocery')}
                className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  formData.business_type === 'grocery'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {applyingPresetKey === 'grocery' ? 'Applying...' : formData.business_type === 'grocery' ? 'Current Active Preset' : 'Apply Grocery Preset'}
              </button>
            </div>

            {/* General Business */}
            <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              formData.business_type === 'general'
                ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">General Commerce</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Multi-purpose commercial invoice generator for wholesale, consulting, freelance, or enterprise billing.
                </p>
                <div className="pt-2 text-[11px] text-gray-600 space-y-1">
                  <div>✓ Standard A4 tax invoice design</div>
                  <div>✓ Flexible services & product lines</div>
                  <div>✓ Standard commercial payment terms</div>
                  <div>✓ Custom discount & tax rates</div>
                </div>
              </div>
              <button
                disabled={applyingPresetKey === 'general'}
                onClick={() => handleApplyPreset('general')}
                className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  formData.business_type === 'general'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {applyingPresetKey === 'general' ? 'Applying...' : formData.business_type === 'general' ? 'Current Active Preset' : 'Apply General Preset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Restrictions & Access Control */}
      {activeTab === 'permissions' && (
        <div className="card space-y-6">
          <div>
            <h3 className="section-title">Client Access & Billing Restrictions</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Admin defines what Client users can do. Client accounts automatically use the Company Name, GSTIN, and Database configured by Admin and cannot alter master settings.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-gray-100">
            {/* Lock Prices */}
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="font-medium text-gray-800 text-sm">Lock Catalog Prices on Invoices</p>
                <p className="text-xs text-gray-500">
                  When enabled, regular users cannot alter unit prices. Only Admin can edit prices or grant discounts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_custom_price !== 'true'}
                  onChange={e => handleChange('allow_custom_price', e.target.checked ? 'false' : 'true')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Restrict to Catalog Items Only */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-gray-800 text-sm">Catalog-Only Invoicing</p>
                <p className="text-xs text-gray-500">
                  When enabled, staff can only select products & services created by the Admin. They cannot create ad-hoc items.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_custom_items !== 'true'}
                  onChange={e => handleChange('allow_custom_items', e.target.checked ? 'false' : 'true')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Catalog Admin Only */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-gray-800 text-sm">Product Catalog Admin Only</p>
                <p className="text-xs text-gray-500">
                  Only Admins can add, edit, or delete items in the Products catalog. Regular staff have view-only access.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.catalog_admin_only === 'true'}
                  onChange={e => handleChange('catalog_admin_only', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Staff Discount Limit */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-800 text-sm">Staff Maximum Discount Limit (%)</p>
                <p className="text-xs text-gray-500">
                  Cap the maximum discount percentage a regular user can apply on an invoice.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.max_discount_percent || '10'}
                  onChange={e => handleChange('max_discount_percent', e.target.value)}
                  className="input-field w-24 text-right"
                />
                <span className="text-sm font-semibold text-gray-600">%</span>
              </div>
            </div>

            {/* Enable Mobile Device Fields */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-gray-800 text-sm">Mobile Service & Device Fields</p>
                <p className="text-xs text-gray-500">
                  Show Device Model, IMEI/Serial Number, Issue Reported, and Warranty selector on the invoice generator.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_device_fields === 'true'}
                  onChange={e => handleChange('enable_device_fields', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Enable Grocery Fields */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-gray-800 text-sm">Grocery & Barcode Scanning Fields</p>
                <p className="text-xs text-gray-500">
                  Show quick Barcode / SKU scan field, item measurement units (kg, g, L, pcs), and POS cash calculator.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_grocery_fields === 'true'}
                  onChange={e => handleChange('enable_grocery_fields', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={handleSavePermissions} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> Save Permission Rules
            </button>
          </div>
        </div>
      )}

      {/* Invoice & POS Tab */}
      {activeTab === 'invoice' && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="section-title">GST, Indian State & POS Configuration</h3>
            <span className="badge badge-success">🇮🇳 Indian Billing Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State & GST State Code</label>
              <select
                value={formData.state_code || '33'}
                onChange={e => {
                  const state = INDIAN_STATES.find(s => s.code === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    state_code: e.target.value,
                    state_name: state?.name || ''
                  }));
                }}
                className="select-field"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (15-Digit GST Number)</label>
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={e => handleChange('tax_id', e.target.value.toUpperCase())}
                className="input-field font-mono uppercase"
                placeholder="e.g. 33AAAAA0000A1Z5"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Appears at the top of Tax Invoices & Thermal Bills</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (VPA for QR Payment)</label>
              <input
                type="text"
                value={formData.upi_id || ''}
                onChange={e => handleChange('upi_id', e.target.value.toLowerCase())}
                className="input-field font-mono"
                placeholder="e.g. storename@upi / 9876543210@paytm"
              />
              <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Auto-generates scannable QR on bills (GPay, PhonePe, Paytm, BHIM)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax / GST Slab (%)</label>
              <select
                value={formData.default_tax_rate || '18'}
                onChange={e => {
                  const rate = e.target.value;
                  let taxName = `GST (${rate}%)`;
                  if (rate === '18') taxName = 'GST 18% (CGST 9% + SGST 9%)';
                  else if (rate === '5') taxName = 'GST 5% (CGST 2.5% + SGST 2.5%)';
                  else if (rate === '12') taxName = 'GST 12% (CGST 6% + SGST 6%)';
                  else if (rate === '28') taxName = 'GST 28% (CGST 14% + SGST 14%)';
                  else if (rate === '0') taxName = 'Exempted (0%)';
                  setFormData(prev => ({
                    ...prev,
                    default_tax_rate: rate,
                    tax_name: taxName
                  }));
                }}
                className="select-field"
              >
                <option value="0">0% (Nil / Exempted Food Grains, Fresh Milk)</option>
                <option value="5">5% (Edible Oil, Sugar, Spices, Packaged Atta)</option>
                <option value="12">12% (FMCG, Processed Food, Ghee)</option>
                <option value="18">18% (Mobile Repair, Electronics, Accessories, Services)</option>
                <option value="28">28% (Luxury Items, Select Consumer Durables)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Label on Bill</label>
              <input
                type="text"
                value={formData.tax_name || ''}
                onChange={e => handleChange('tax_name', e.target.value)}
                className="input-field text-sm"
                placeholder="e.g. GST (18%)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Bill / Print Format</label>
              <select
                value={formData.default_invoice_layout || 'standard_a4'}
                onChange={e => handleChange('default_invoice_layout', e.target.value)}
                className="select-field"
              >
                <option value="standard_a4">Standard A4 Tax Invoice (GST Compliant)</option>
                <option value="thermal_pos">Thermal POS Receipt (80mm / 58mm Roll)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thermal Receipt Width</label>
              <select
                value={formData.thermal_paper_width || '80mm'}
                onChange={e => handleChange('thermal_paper_width', e.target.value)}
                className="select-field"
              >
                <option value="80mm">80mm (Standard Indian POS Printer)</option>
                <option value="58mm">58mm (Handheld Bluetooth Printer)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number Prefix</label>
              <input
                type="text"
                value={formData.invoice_prefix || ''}
                onChange={e => handleChange('invoice_prefix', e.target.value)}
                className="input-field font-mono"
                placeholder="e.g. MOB-, GRO-, INV-"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency || 'INR'}
                onChange={e => handleCurrencyChange(e.target.value)}
                className="select-field"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <select
                value={formData.payment_terms || 'Due on Delivery'}
                onChange={e => handleChange('payment_terms', e.target.value)}
                className="select-field"
              >
                <option value="Due on Delivery">Due on Delivery / Counter Cash</option>
                <option value="Immediate UPI / Cash">Immediate UPI / Cash</option>
                <option value="Khata / Credit 7 Days">Khata / Credit 7 Days</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Footer / Thank You Note</label>
              <textarea
                value={formData.default_notes || ''}
                onChange={e => handleChange('default_notes', e.target.value)}
                className="input-field h-16 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Warranty / Terms & Conditions</label>
              <textarea
                value={formData.default_terms || ''}
                onChange={e => handleChange('default_terms', e.target.value)}
                className="input-field h-24 resize-none text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSaveInvoice} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> Save Invoice & POS Settings
            </button>
          </div>
        </div>
      )}

      {/* Branding / Shop Profile & GST Tab */}
      {activeTab === 'branding' && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="section-title flex items-center gap-2">
                <Store className="w-5 h-5 text-primary-600" />
                Mobile Shop Profile & GST Details
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                These details appear on top of every customer bill, tax invoice, and thermal receipt.
              </p>
            </div>
            <span className="badge badge-success">🇮🇳 GST Billing Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shop / Business Name (Changeable at any time) *
              </label>
              <input
                type="text"
                value={formData.company_name || ''}
                onChange={e => handleChange('company_name', e.target.value)}
                className="input-field text-base font-bold bg-white"
                placeholder="e.g. Sai Ram Mobile Care & Service Center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shop Phone / Contact Number *
              </label>
              <input
                type="text"
                value={formData.company_phone || ''}
                onChange={e => handleChange('company_phone', e.target.value)}
                className="input-field"
                placeholder="e.g. +91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shop Email (Optional)
              </label>
              <input
                type="email"
                value={formData.company_email || ''}
                onChange={e => handleChange('company_email', e.target.value)}
                className="input-field"
                placeholder="e.g. contact@myshop.in"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shop Address (Printed on bill header) *
              </label>
              <textarea
                value={formData.company_address || ''}
                onChange={e => handleChange('company_address', e.target.value)}
                className="input-field h-20 resize-none"
                placeholder="e.g. Shop No. 14, Main Road, Market Complex..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                GSTIN (15-Digit GST Number)
              </label>
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={e => handleChange('tax_id', e.target.value.toUpperCase())}
                className="input-field font-mono font-bold uppercase"
                placeholder="e.g. 33AAAAA0000A1Z5"
              />
              <p className="text-[11px] text-gray-500 mt-0.5">Printed on Tax Invoices and thermal receipts</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                UPI ID (For Instant Bill Payment QR Code)
              </label>
              <input
                type="text"
                value={formData.upi_id || ''}
                onChange={e => handleChange('upi_id', e.target.value.toLowerCase())}
                className="input-field font-mono"
                placeholder="e.g. 9876543210@paytm / store@upi"
              />
              <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Creates scannable UPI QR on every customer invoice
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                State Name & Code
              </label>
              <select
                value={formData.state_code || '33'}
                onChange={e => {
                  const state = INDIAN_STATES.find(s => s.code === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    state_code: e.target.value,
                    state_name: state?.name || ''
                  }));
                }}
                className="select-field"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shop Tagline / Specialization
              </label>
              <input
                type="text"
                value={formData.company_tagline || ''}
                onChange={e => handleChange('company_tagline', e.target.value)}
                className="input-field"
                placeholder="e.g. Smartphone Display, Battery & Motherboard Specialists"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Default Repair Warranty & Terms (Printed on Bill Footer)
              </label>
              <textarea
                value={formData.default_terms || ''}
                onChange={e => handleChange('default_terms', e.target.value)}
                className="input-field h-24 resize-none text-xs"
                placeholder="Enter warranty policies, e.g. 90 days warranty on display combo, physical damage voids warranty..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button onClick={handleSaveBranding} disabled={saving} className="btn-primary py-2.5 px-6">
              <Save className="w-4 h-4" /> Save Shop Profile & GST Details
            </button>
          </div>
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <div className="card space-y-5">
          <h3 className="section-title">Theme Customization</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Brand Color</label>
            <div className="flex items-center gap-4">
              <input type="color" value={formData.primary_color || '#3b82f6'} onChange={e => handleChange('primary_color', e.target.value)} className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer" />
              <input type="text" value={formData.primary_color || '#3b82f6'} onChange={e => handleChange('primary_color', e.target.value)} className="input-field w-40 font-mono" />
              <div className="flex gap-2">
                {['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0d9488', '#ea580c', '#1e293b'].map(color => (
                  <button key={color} onClick={() => handleChange('primary_color', color)} className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110" style={{ backgroundColor: color, borderColor: formData.primary_color === color ? '#1e293b' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200" style={{ borderLeftWidth: '4px', borderLeftColor: formData.primary_color }}>
            <p className="text-sm text-gray-500">Preview: This brand accent will be used for buttons, links, invoices, and thermal receipt accents.</p>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSaveTheme} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> Save Theme
            </button>
          </div>
        </div>
      )}

      {/* Google Sheets Tab */}
      {activeTab === 'database' && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title">Google Sheets Live Database</h3>
              <p className="text-sm text-gray-500 mt-0.5">Use your Google Spreadsheet as the central cloud database for all staff & branch counters.</p>
            </div>
            <span className={`badge ${sheetsConfig.isConfigured ? 'badge-success' : 'badge-warning'}`}>
              {sheetsConfig.isConfigured ? '● Cloud Connected' : '● Local Offline Mode'}
            </span>
          </div>

          <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-sm text-blue-900 space-y-3">
            <div className="flex items-center gap-2 text-primary-700 font-bold text-base">
              <Database className="w-5 h-5 text-primary-600" />
              Easy 2-Minute Google Sheets Setup (Zero Cost)
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-blue-800 text-xs sm:text-sm">
              <li>Create a new spreadsheet at <strong>sheets.new</strong></li>
              <li>In your Google Sheet, click <strong>Extensions &gt; Apps Script</strong></li>
              <li>Paste the contents of <strong>google-apps-script.js</strong> (included in your project folder)</li>
              <li>Click <strong>Deploy &gt; New deployment &gt; Select type: Web app</strong></li>
              <li>Set <i>Execute as:</i> <strong>Me</strong> and <i>Who has access:</i> <strong>Anyone</strong></li>
              <li>Click <strong>Deploy</strong> and copy the <strong>Web App URL</strong> into the field below</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Google Apps Script Web App URL <span className="text-xs text-primary-600 font-normal">(Full Read/Write Support)</span>
              </label>
              <input
                type="url"
                value={sheetsConfig.webAppUrl || ''}
                onChange={e => setSheetsConfig(prev => ({ ...prev, webAppUrl: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              />
              <p className="text-xs text-gray-400 mt-1">Directly connects all invoices, customers, products, payments, and users across devices.</p>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alternative: Google Sheets REST API v4</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Spreadsheet ID</label>
                  <input
                    type="text"
                    value={sheetsConfig.spreadsheetId || ''}
                    onChange={e => setSheetsConfig(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                    className="input-field font-mono text-xs"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Google API Key</label>
                  <input
                    type="password"
                    value={sheetsConfig.apiKey || ''}
                    onChange={e => setSheetsConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="input-field font-mono text-xs"
                    placeholder="AIzaSy..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              All data is cached locally with offline fallback so the desktop app is always lightning fast.
            </span>
            <button onClick={handleSaveSheetsConfig} className="btn-primary">
              <Database className="w-4 h-4" /> Save Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
