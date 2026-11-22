import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import {
  Database, CheckCircle2, AlertCircle, RefreshCw, ExternalLink,
  Copy, Check, Save, Zap, Cloud, Server, Table, Code, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DatabaseSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState(db.getConfig());
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [tableCounts, setTableCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);

  useEffect(() => {
    loadTableCounts();
  }, []);

  const loadTableCounts = async () => {
    setLoadingCounts(true);
    try {
      const counts = {};
      const tables = Object.values(SHEET_NAMES);
      for (const tbl of tables) {
        const data = await db.fetchSheet(tbl);
        counts[tbl] = Array.isArray(data) ? data.length : 0;
      }
      setTableCounts(counts);
    } catch (err) {
      console.warn('Could not load table counts:', err);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    try {
      db.saveConfig({
        webAppUrl: config.webAppUrl.trim(),
        spreadsheetId: config.spreadsheetId.trim(),
        apiKey: config.apiKey?.trim() || '',
      });
      setConfig(db.getConfig());
      toast.success('Google Sheets Database settings saved!');
      loadTableCounts();
    } catch {
      toast.error('Failed to save database settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.webAppUrl?.trim()) {
      toast.error('Please enter a Google Apps Script Web App URL first');
      return;
    }

    setTesting(true);
    setTestResult(null);
    const startTime = performance.now();

    try {
      const url = `${config.webAppUrl.trim()}?action=read&sheet=Users`;
      const res = await fetch(url);
      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' || Array.isArray(json.data)) {
          setTestResult({
            success: true,
            latency,
            message: `Connection successful! Google Sheet responded in ${latency}ms with ${json.data?.length || 0} user records.`,
          });
          toast.success('Google Sheet database is online and reachable!');
          db.saveConfig({
            webAppUrl: config.webAppUrl.trim(),
            spreadsheetId: config.spreadsheetId.trim(),
          });
          loadTableCounts();
        } else {
          setTestResult({
            success: false,
            latency,
            message: json.message || 'Web App responded, but returned an error status.',
          });
          toast.error('Google Sheet responded with an error');
        }
      } else {
        setTestResult({
          success: false,
          latency,
          message: `HTTP Error: ${res.status} ${res.statusText}`,
        });
        toast.error(`Connection failed: HTTP ${res.status}`);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      setTestResult({
        success: false,
        latency,
        message: err.message || 'Network error: could not connect to Web App URL. Verify URL and deployment settings.',
      });
      toast.error('Could not connect to Google Apps Script URL');
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = () => {
    db.clearCache();
    loadTableCounts();
    toast.success('Database cache cleared and refreshed!');
  };

  const handleCopyScript = () => {
    const scriptCode = `// Google Apps Script deployment code is in google-apps-script.js
// Available in project directory. Follow the 5-step instructions below.`;
    navigator.clipboard?.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    toast.success('Deployment instructions copied!');
  };

  const isConnected = db.isConfigured() && Boolean(config.webAppUrl);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
            <Database className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Google Sheets Central Database Management</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
              }`}>
                {isConnected ? '🟢 Cloud Connected' : '🟡 Local Offline Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Admin configuration: Connect your central Google Spreadsheet as the multi-tenant database for all client shops.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearCache}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
            title="Clear Cache & Re-sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCounts ? 'animate-spin' : ''}`} />
            <span>Re-sync</span>
          </button>
          {config.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Sheet</span>
            </a>
          )}
        </div>
      </div>

      {/* Connection Status KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Database Mode</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-bold text-gray-900 mt-2">
            {isConnected ? 'Google Apps Script (Cloud)' : 'Local Storage Engine'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {isConnected ? 'Synchronized across all browsers' : 'Offline sandbox mode'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Core Tables Configured</span>
            <Table className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-600 mt-2">
            13 Normalized Sheets
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Users, Customers, Invoices, Services, etc.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Security & Access Control</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-lg font-bold text-purple-700 mt-2">
            Admin Controlled Only
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Client shops cannot alter master DB URL
          </p>
        </div>
      </div>

      {/* Main Connection Form Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Google Sheet Connection Settings</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                Web App REST API
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter your deployed Google Apps Script Web App URL below to connect the live database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Connection'}</span>
            </button>
          </div>
        </div>

        {/* Test Result Message Box */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{testResult.success ? 'Connection Verified' : 'Connection Test Failed'}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed">{testResult.message}</p>
              <p className="mt-1 font-mono text-[10px] opacity-75">Roundtrip latency: {testResult.latency}ms</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Google Apps Script Web App URL * <span className="text-[11px] text-blue-600 font-normal">(Full Read/Write Support with 0 CORS issues)</span>
            </label>
            <input
              type="url"
              value={config.webAppUrl || ''}
              onChange={e => setConfig({ ...config, webAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="input-field font-mono text-xs"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Example: Deploy your Apps Script as a Web App (Access: Anyone) and paste the <code className="text-gray-600">/exec</code> URL here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Google Spreadsheet ID (Optional)
              </label>
              <input
                type="text"
                value={config.spreadsheetId || ''}
                onChange={e => setConfig({ ...config, spreadsheetId: e.target.value })}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="input-field font-mono text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Found in the Google Sheet URL between <code className="text-gray-600">/d/</code> and <code className="text-gray-600">/edit</code>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Google Sheets API Key (Optional Fallback)
              </label>
              <input
                type="password"
                value={config.apiKey || ''}
                onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="input-field font-mono text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Optional REST API v4 fallback key if Web App is not in use.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 13 Tables Health & Record Counts */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">13 Database Tables Health Check</h2>
            <p className="text-xs text-gray-500 mt-0.5">Status and row counts of all normalized tables in your Google Sheet database.</p>
          </div>
          <button
            onClick={loadTableCounts}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingCounts ? 'animate-spin' : ''}`} /> Refresh Counts
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          {Object.entries(SHEET_NAMES).map(([key, name]) => {
            const count = tableCounts[name] ?? 0;
            return (
              <div key={key} className="p-3 bg-gray-50/70 rounded-xl border border-gray-200/80 hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 truncate" title={name}>{name}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {loadingCounts ? '...' : `${count} rows`}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Normalized Sheet</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Minute Deployment Guide */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
            <Cloud className="w-5 h-5 text-indigo-600" />
            <span>How to Create Your Free Google Sheets Database (Zero Cost)</span>
          </div>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-indigo-900 leading-relaxed">
          <li>
            Open Google Sheets by creating a new sheet at <strong><a href="https://sheets.new" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700">sheets.new</a></strong>.
          </li>
          <li>
            In the Google Sheet menu, click <strong>Extensions &gt; Apps Script</strong>.
          </li>
          <li>
            Replace all the code in the editor with the contents of <strong className="font-mono bg-indigo-100/60 px-1.5 py-0.5 rounded">google-apps-script.js</strong> (included in your project folder).
          </li>
          <li>
            Click the blue <strong>Deploy</strong> button at top right &gt; <strong>New deployment</strong>:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1 text-slate-700">
              <li>Select type: <strong>Web app</strong></li>
              <li>Execute as: <strong>Me (your Google email)</strong></li>
              <li>Who has access: <strong>Anyone</strong> (allows the invoice application to read and write without authentication errors)</li>
            </ul>
          </li>
          <li>
            Click <strong>Deploy</strong>, authorize permissions, and copy the <strong>Web App URL</strong> into the field above!
          </li>
        </ol>

        <div className="pt-2 flex items-center gap-3">
          <span className="text-xs text-indigo-700 font-medium">
            The script will automatically create all 13 sheet tabs with headers on its first write.
          </span>
        </div>
      </div>
    </div>
  );
}
