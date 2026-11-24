import React, { useState, useEffect } from 'react';
import db from '../../services/googleSheets';
import apiClient from '../../services/apiClient';
import {
  Database, CheckCircle2, AlertCircle, Copy, Check, ExternalLink,
  RefreshCw, Save, Trash2, ArrowRight, ShieldCheck, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DatabaseSettings() {
  const [webAppUrl, setWebAppUrl] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadDatabaseConfig();
  }, []);

  const loadDatabaseConfig = async () => {
    try {
      const res = await apiClient.get('/database/config');
      if (res && res.success) {
        setWebAppUrl(res.webAppUrl || '');
        setIsConfigured(res.isConfigured);
        if (res.details) {
          setTestResult(res.details);
        }
        return;
      }
    } catch {
      // Fallback to local config
    }
    const config = db.getConfig();
    setWebAppUrl(config.webAppUrl || '');
    setIsConfigured(Boolean(config.webAppUrl));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    const cleanUrl = webAppUrl.trim();
    if (!cleanUrl) {
      toast.error('Please enter a valid Google Apps Script Web App URL');
      return;
    }
    if (!cleanUrl.startsWith('https://script.google.com/')) {
      toast.error('URL must begin with https://script.google.com/...');
      return;
    }

    setSaving(true);
    try {
      // Save to secure backend API
      const res = await apiClient.post('/database/config', { webAppUrl: cleanUrl });
      
      // Also cache in db config
      db.saveConfig({
        webAppUrl: cleanUrl,
        syncMode: 'webapp',
      });
      setIsConfigured(true);
      toast.success('Google Sheet Database API saved to secure backend!');
      
      if (res && res.testResult) {
        setTestResult(res.testResult);
        if (res.testResult.success) {
          toast.success(`Connected! (${res.testResult.latency}ms)`);
        }
      } else {
        handleTest(cleanUrl);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save database configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (urlToTest) => {
    const targetUrl = urlToTest || webAppUrl.trim();
    if (!targetUrl) {
      toast.error('Enter an API URL first to test');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test via secure API layer
      const res = await apiClient.post('/database/test', { webAppUrl: targetUrl });
      if (res && res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Connected successfully to Google Sheet via API Gateway!',
          spreadsheet: res.spreadsheet || 'Google Sheet Database',
          latency: res.latency,
        });
        toast.success(`Connected! (${res.latency}ms)`);
      } else {
        throw new Error(res?.error || 'Connection failed');
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Could not connect. Please check: 1) Web App was deployed with "Who has access: Anyone", 2) Permissions were authorized.',
        error: err.message,
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Sheets Database and switch back to local offline mode?')) {
      return;
    }
    try {
      await apiClient.post('/database/config', { webAppUrl: '' });
    } catch (e) {
      console.warn('Disconnect API call note:', e);
    }
    db.saveConfig({ webAppUrl: '', syncMode: 'local' });
    setWebAppUrl('');
    setIsConfigured(false);
    setTestResult(null);
    toast.success('Switched back to Local Database mode');
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    toast.success('Google Apps Script copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <span>Google Sheet Database API</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
              }`}>
                {isConfigured ? '🟢 Live Google Sheet Connected' : '⚠️ Offline / Local Mode'}
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Admin Google Sheets Backend configuration. Simply paste your Google Apps Script Web App URL below.
            </p>
          </div>
        </div>

        {isConfigured && (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        )}
      </div>

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Google Apps Script Web App API URL</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter the Web App URL generated from your Google Sheet's Apps Script editor.
            </p>
          </div>

          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
            Admin Only Setup
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Web App URL (https://script.google.com/macros/s/.../exec)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="input-field text-xs font-mono flex-1"
                required
              />
              <button
                type="submit"
                disabled={saving}
                className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 flex-shrink-0 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save API URL'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleTest()}
                disabled={testing || !webAppUrl.trim()}
                className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>

          {/* Test Result Message Box */}
          {testResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-1 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.success && (
                <p className="text-[11px] text-emerald-700 font-medium pl-6">
                  Spreadsheet: <strong>{testResult.spreadsheet}</strong> • Response Time: <strong>{testResult.latency}ms</strong>
                </p>
              )}
              {!testResult.success && testResult.error && (
                <p className="text-[11px] text-red-700 font-mono pl-6">
                  Error Details: {testResult.error}
                </p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* How To Setup Guide & Copyable Apps Script */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>How to Create Your Google Sheet Database (4 Easy Steps)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Follow these simple steps once to deploy your Google Apps Script backend.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyScript}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Apps Script Code'}</span>
          </button>
        </div>

        {/* 4 Step Instruction Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">1</span>
            <p className="font-bold text-slate-900">Create New Sheet</p>
            <p className="text-slate-500 text-[11px]">
              Open <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">sheets.new</a> in your browser to create a new blank Google Spreadsheet.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">2</span>
            <p className="font-bold text-slate-900">Open Apps Script</p>
            <p className="text-slate-500 text-[11px]">
              In the top menu of your Google Sheet, click on <strong>Extensions &gt; Apps Script</strong>.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">3</span>
            <p className="font-bold text-slate-900">Paste Script & Deploy</p>
            <p className="text-slate-500 text-[11px]">
              Replace code with the script below. Click <strong>Deploy &gt; New deployment</strong>. Select <strong>Web app</strong> (Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>).
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">4</span>
            <p className="font-bold text-slate-900">Paste URL Here</p>
            <p className="text-slate-500 text-[11px]">
              Copy the resulting <strong>Web App URL</strong>, paste it into the box above, and click <strong>Save API URL</strong>!
            </p>
          </div>
        </div>

        {/* Apps Script Code Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Complete Google Apps Script Code (`google-apps-script.js`)</span>
            <button
              onClick={handleCopyScript}
              className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
          </div>

          <div className="relative">
            <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed">
              <code>{APPS_SCRIPT_CODE}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

const APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT FOR MULTI-COMPANY INVOICE & SERVICE MANAGEMENT ERP
 * =========================================================================
 * 
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet (https://sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Replace all code in the editor with this script
 * 4. Click the blue "Deploy" button at top right > "New deployment"
 * 5. Select type: "Web app"
 *    - Description: "Invoice ERP Database"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Click "Deploy", authorize permissions, and copy the Web App URL!
 * 7. Paste that Web App URL in your Admin Database API page!
 */

const SHEET_COLUMNS = {
  Companies: [
    'id', 'name', 'logo', 'gstin', 'address', 'city', 'state', 'state_code', 'pincode',
    'email', 'phone', 'website', 'invoice_prefix', 'bank_name', 'bank_acc_no', 'bank_ifsc',
    'upi_id', 'terms_conditions', 'is_active', 'subscription_plan', 'subscription_expiry',
    'created_at', 'updated_at'
  ],
  Users: [
    'id', 'company_id', 'username', 'password_hash', 'role', 'full_name', 'email', 'phone',
    'company_name', 'gstin', 'address', 'city', 'state', 'upi_id', 'invoice_prefix',
    'subscription_valid_until', 'avatar_color', 'is_active', 'created_at', 'updated_at'
  ],
  Customers: [
    'id', 'company_id', 'name', 'phone', 'alt_phone', 'email', 'company', 'address', 'city',
    'state', 'pincode', 'gstin', 'category', 'notes', 'created_by', 'created_at', 'updated_at'
  ],
  Products: [
    'id', 'company_id', 'name', 'sku_barcode', 'description', 'category', 'unit', 'purchase_price',
    'selling_price', 'tax_rate', 'hsn_sac', 'opening_stock', 'stock_qty', 'min_stock_alert',
    'is_active', 'created_by', 'created_at', 'updated_at'
  ],
  ServiceOrders: [
    'id', 'company_id', 'job_number', 'customer_id', 'customer_name', 'customer_phone',
    'customer_address', 'brand', 'device_model', 'imei_serial', 'device_color', 'accessories_received',
    'device_condition', 'issue_reported', 'technician_notes', 'customer_notes', 'technician_id',
    'technician_name', 'intake_date', 'expected_delivery', 'completion_date', 'delivery_date',
    'status', 'labor_charges', 'parts_charges', 'additional_charges', 'discount_amount',
    'tax_amount', 'total_estimated', 'advance_paid', 'balance_amount', 'created_by', 'created_at', 'updated_at'
  ],
  Invoices: [
    'id', 'company_id', 'invoice_number', 'invoice_type', 'invoice_date', 'due_date',
    'customer_id', 'customer_name', 'customer_phone', 'customer_gstin', 'customer_state',
    'place_of_supply', 'is_interstate', 'service_order_id', 'subtotal', 'discount_type',
    'discount_value', 'discount_amount', 'taxable_amount', 'cgst_amount', 'sgst_amount',
    'igst_amount', 'total_tax', 'grand_total', 'amount_paid', 'balance_due', 'payment_status',
    'payment_mode', 'notes', 'terms', 'device_model', 'imei_serial', 'repair_status',
    'created_by', 'created_at', 'updated_at'
  ],
  InvoiceItems: [
    'id', 'company_id', 'invoice_id', 'product_id', 'item_type', 'description', 'hsn_sac',
    'quantity', 'unit', 'unit_price', 'discount', 'taxable_amount', 'gst_rate', 'cgst_rate',
    'cgst_amount', 'sgst_rate', 'sgst_amount', 'igst_rate', 'igst_amount', 'total_amount'
  ],
  Payments: [
    'id', 'company_id', 'invoice_id', 'invoice_number', 'customer_id', 'customer_name',
    'amount', 'payment_date', 'payment_method', 'reference_number', 'notes', 'recorded_by', 'created_at'
  ],
  Expenses: [
    'id', 'company_id', 'category', 'description', 'amount', 'tax_amount', 'vendor',
    'payment_method', 'expense_date', 'receipt_url', 'notes', 'recorded_by', 'created_at'
  ],
  Quotations: [
    'id', 'company_id', 'quotation_number', 'quotation_date', 'valid_until', 'customer_id',
    'customer_name', 'customer_phone', 'subtotal', 'tax_amount', 'total', 'status', 'notes',
    'terms', 'created_by', 'created_at', 'updated_at'
  ],
  Purchases: [
    'id', 'company_id', 'purchase_number', 'vendor_name', 'vendor_gstin', 'purchase_date',
    'total_amount', 'tax_amount', 'payment_status', 'notes', 'created_by', 'created_at'
  ],
  Settings: [
    'id', 'company_id', 'key', 'value', 'category', 'updated_at'
  ]
};

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const cols = SHEET_COLUMNS[sheetName] || ['id', 'created_at'];
    sheet.appendRow(cols);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const params = e ? e.parameter || {} : {};
  const action = params.action || '';
  const sheetName = params.sheet || '';

  // Ping / healthcheck action
  if (action === 'ping' || !sheetName) {
    return responseJSON({
      status: 'success',
      message: 'Google Sheets Database API connected successfully!',
      spreadsheet: ss.getName()
    });
  }

  try {
    const sheet = getOrCreateSheet(ss, sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return responseJSON({ status: 'success', sheet: sheetName, count: 0, data: [] });
    }

    const headers = data[0];
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && row[0] !== 0) continue;
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = row[idx] !== undefined ? String(row[idx]) : '';
      });
      records.push(item);
    }

    return responseJSON({ status: 'success', sheet: sheetName, count: records.length, data: records });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const contents = e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(contents);
    const action = payload.action;
    const sheetName = payload.sheet;
    const sheet = getOrCreateSheet(ss, sheetName);
    const cols = SHEET_COLUMNS[sheetName] || [];

    if (action === 'append') {
      const item = payload.data || {};
      const rowValues = cols.map(c => item[c] !== undefined ? item[c] : '');
      sheet.appendRow(rowValues);
      return responseJSON({ status: 'success', action: 'append', id: item.id });
    }

    if (action === 'update') {
      const id = String(payload.id);
      const updateData = payload.data || {};
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === id) {
          const rowNumber = i + 1;
          headers.forEach((h, colIdx) => {
            if (updateData[h] !== undefined) {
              sheet.getRange(rowNumber, colIdx + 1).setValue(updateData[h]);
            }
          });
          return responseJSON({ status: 'success', action: 'update', id });
        }
      }
      return responseJSON({ status: 'not_found', id });
    }

    if (action === 'delete') {
      const id = String(payload.id);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === id) {
          sheet.deleteRow(i + 1);
          return responseJSON({ status: 'success', action: 'delete', id });
        }
      }
      return responseJSON({ status: 'not_found', id });
    }

    return responseJSON({ status: 'unknown_action', action });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
