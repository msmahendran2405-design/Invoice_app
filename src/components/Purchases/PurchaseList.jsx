import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  ShoppingBag, Plus, Search, Edit, Trash2, Calendar,
  RefreshCw, DollarSign, X, Truck, CheckCircle2, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PurchaseList() {
  const { user, activeCompanyId } = useAuth();
  const { settings } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vendor_name: '',
    vendor_gstin: '',
    purchase_date: new Date().toISOString().split('T')[0],
    total_amount: '',
    tax_amount: '0',
    payment_status: 'Paid',
    notes: 'Inward spare parts / displays purchase from wholesaler.',
  });

  useEffect(() => {
    loadPurchases();
  }, [activeCompanyId]);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.PURCHASES, true);
      setPurchases(data.filter(p => p.id));
    } catch {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.total_amount) {
      toast.error('Vendor name and amount are required');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nextNum = `PUR-${Math.floor(1000 + Math.random() * 9000)}`;

      await db.appendRow(SHEET_NAMES.PURCHASES, {
        company_id: activeCompanyId || '1',
        purchase_number: nextNum,
        ...form,
        created_by: user?.full_name || 'Admin',
        created_at: now,
      });

      toast.success(`Purchase ${nextNum} recorded!`);
      setShowModal(false);
      loadPurchases();
    } catch {
      toast.error('Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const totalPurchases = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.vendor_name?.toLowerCase().includes(q) ||
        p.purchase_number?.toLowerCase().includes(q) ||
        p.vendor_gstin?.toLowerCase().includes(q)
      );
    }).sort((a, b) => new Date(b.created_at || b.purchase_date) - new Date(a.created_at || a.purchase_date));
  }, [purchases, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Inward Purchases & Supplier Stock</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Inventory Supply
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Record wholesale stock entries, track supplier GSTIN, and maintain purchase cost history.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Record New Purchase
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Inward Stock Cost</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase">Purchase Invoices</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{purchases.length} Inward Bills</p>
        </div>
        <div className="card py-3.5 px-4 bg-emerald-50/70 border border-emerald-200">
          <p className="text-xs text-emerald-800 font-bold uppercase">Suppliers Logged</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">
            {new Set(purchases.map(p => p.vendor_name).filter(Boolean)).size} Vendors
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search purchases by vendor or purchase #..."
            className="input-field pl-10 text-xs"
          />
        </div>
        <button onClick={loadPurchases} className="btn-secondary py-2.5 px-3">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No purchase records found</p>
            <p className="text-xs text-slate-500 mt-1">Record supplier purchase bills to track parts and accessory costs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Purchase #</th>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Supplier GSTIN</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map(pur => (
                  <tr key={pur.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {pur.purchase_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {pur.vendor_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {pur.vendor_gstin || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {pur.purchase_date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {formatCurrency(pur.total_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {pur.payment_status || 'Paid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                      {pur.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Record Inward Stock Purchase</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Vendor / Wholesaler Name *</label>
                <input
                  type="text"
                  value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  required
                  className="input-field text-xs"
                  placeholder="e.g. Apex Wholesale Supplies"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Vendor GSTIN (Optional)</label>
                <input
                  type="text"
                  value={form.vendor_gstin}
                  onChange={e => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })}
                  className="input-field text-xs font-mono"
                  placeholder="33AAAAA0000A1Z5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Total Bill Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.total_amount}
                    onChange={e => setForm({ ...form, total_amount: e.target.value })}
                    required
                    className="input-field text-xs font-mono font-bold"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Items / Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input-field text-xs h-16 resize-none"
                  placeholder="e.g. 10x iPhone 13 display combos, 20x tempered glass packs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Recording...' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
