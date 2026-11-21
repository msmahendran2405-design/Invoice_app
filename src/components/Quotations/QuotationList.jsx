import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  FileCheck, Plus, Search, Edit, Trash2, Printer, Eye,
  RefreshCw, ArrowRight, X, Clock, FileText, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuotationList() {
  const { user, activeCompanyId } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    description: '',
    subtotal: '',
    tax_rate: '18',
    notes: 'Valid for 15 days from quote date.',
  });

  useEffect(() => {
    loadQuotations();
  }, [activeCompanyId]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.QUOTATIONS, true);
      setQuotations(data.filter(q => q.id));
    } catch {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.subtotal) {
      toast.error('Customer name and amount are required');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const sub = parseFloat(form.subtotal) || 0;
      const tax = (sub * parseFloat(form.tax_rate || 0)) / 100;
      const total = sub + tax;

      const nextNum = `EST-${Math.floor(1000 + Math.random() * 9000)}`;

      await db.appendRow(SHEET_NAMES.QUOTATIONS, {
        company_id: activeCompanyId || '1',
        quotation_number: nextNum,
        quotation_date: now.split('T')[0],
        valid_until: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        subtotal: sub.toFixed(2),
        tax_amount: tax.toFixed(2),
        total: total.toFixed(2),
        status: 'Sent',
        notes: `${form.description ? form.description + '. ' : ''}${form.notes}`,
        created_by: user?.full_name || 'Staff',
        created_at: now,
      });

      toast.success(`Quotation ${nextNum} generated!`);
      setShowModal(false);
      loadQuotations();
    } catch {
      toast.error('Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = (quote) => {
    navigate(`/invoices/new?customer_name=${encodeURIComponent(quote.customer_name)}&phone=${encodeURIComponent(quote.customer_phone || '')}&total=${quote.total}`);
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteRow(SHEET_NAMES.QUOTATIONS, id);
      setQuotations(prev => prev.filter(q => q.id !== id));
      toast.success('Quotation removed');
    } catch {
      toast.error('Failed to delete quotation');
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const filteredQuotes = useMemo(() => {
    return quotations.filter(q => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return (
        q.quotation_number?.toLowerCase().includes(search) ||
        q.customer_name?.toLowerCase().includes(search) ||
        q.customer_phone?.toLowerCase().includes(search)
      );
    }).sort((a, b) => new Date(b.created_at || b.quotation_date) - new Date(a.created_at || a.quotation_date));
  }, [quotations, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Quotations, Estimates & Proforma Invoices</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                1-Click Convert
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Issue formal price quotes to customers before committing to large repairs or corporate device orders.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Create New Quotation
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search quotations by quote # or customer name..."
            className="input-field pl-10 text-xs"
          />
        </div>
        <button onClick={loadQuotations} className="btn-secondary py-2.5 px-3">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-16">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No quotations generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Create estimates or proforma invoices for your customers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map(quote => (
                  <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {quote.quotation_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{quote.customer_name}</div>
                      {quote.customer_phone && (
                        <div className="font-mono text-slate-400 text-[10px]">{quote.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {quote.quotation_date}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {quote.valid_until || '15 Days'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {quote.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleConvertToInvoice(quote)}
                          className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs"
                          title="Convert to Tax Invoice"
                        >
                          <span>Convert to Invoice</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
              <h3 className="text-base font-bold text-gray-900">Create New Quotation</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  required
                  className="input-field text-xs"
                  placeholder="e.g. Anand Verma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mobile Phone</label>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                  className="input-field text-xs font-mono"
                  placeholder="98840 99881"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Service / Device Scope</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input-field text-xs h-16 resize-none"
                  placeholder="e.g. Motherboard chip repair & battery replacement"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Subtotal Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.subtotal}
                    onChange={e => setForm({ ...form, subtotal: e.target.value })}
                    required
                    className="input-field text-xs font-mono font-bold"
                    placeholder="2500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">GST Rate (%)</label>
                  <select
                    value={form.tax_rate}
                    onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                    className="select-field text-xs"
                  >
                    <option value="18">18% (Standard GST)</option>
                    <option value="12">12%</option>
                    <option value="5">5%</option>
                    <option value="0">0% (Nil)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Generating...' : 'Create Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
