import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import { Plus, Search, CreditCard, X, RefreshCw, ChevronDown, IndianRupee, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = ['Cash', 'UPI (GPay / PhonePe / Paytm)', 'Credit Card', 'Debit Card', 'Bank Transfer (IMPS/NEFT)', 'Khata / Cheque', 'Other'];

export default function PaymentList() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    invoice_id: '', amount: '', method: 'Bank Transfer', reference: '', payment_date: new Date().toISOString().split('T')[0], notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pay, inv] = await Promise.all([
        db.fetchSheet(SHEET_NAMES.PAYMENTS, true),
        db.fetchSheet(SHEET_NAMES.INVOICES, true),
      ]);
      setPayments(pay.filter(p => p.id));
      const userInvoices = user.role === 'admin' ? inv : inv.filter(i => i.created_by === user.id);
      setInvoices(userInvoices.filter(i => i.id && ['sent', 'partial', 'overdue'].includes(i.status)));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.invoice_number?.toLowerCase().includes(q) || p.customer_name?.toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [payments, searchQuery]);

  const totalCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [payments]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.invoice_id) { toast.error('Please select an invoice'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }

    setSaving(true);
    try {
      const invoice = invoices.find(i => i.id === form.invoice_id);
      if (!invoice) { toast.error('Invoice not found'); return; }

      const balanceDue = parseFloat(invoice.total) - parseFloat(invoice.amount_paid || 0);
      if (parseFloat(form.amount) > balanceDue) {
        toast.error(`Amount exceeds balance due (${formatIndianCurrency(balanceDue, cs)})`);
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();
      await db.appendRow(SHEET_NAMES.PAYMENTS, {
        invoice_id: form.invoice_id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        amount: form.amount,
        method: form.method,
        reference: form.reference,
        payment_date: form.payment_date,
        notes: form.notes,
        recorded_by: user.id,
        recorder_name: user.full_name,
        created_at: now,
      });

      // Update invoice amount_paid and status
      const newAmountPaid = (parseFloat(invoice.amount_paid) || 0) + parseFloat(form.amount);
      const newStatus = newAmountPaid >= parseFloat(invoice.total) ? 'paid' : 'partial';
      await db.updateRow(SHEET_NAMES.INVOICES, form.invoice_id, {
        amount_paid: newAmountPaid.toFixed(2),
        status: newStatus,
        updated_at: now,
      });

      toast.success('Payment recorded!');
      setShowModal(false);
      loadData();
    } catch (error) {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const cs = settings.currency_symbol || '₹';

  const selectedInvoice = invoices.find(i => i.id === form.invoice_id);
  const balanceDue = selectedInvoice ? (parseFloat(selectedInvoice.total) - parseFloat(selectedInvoice.amount_paid || 0)).toFixed(2) : '0.00';

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card py-4 px-5">
          <p className="text-xs text-gray-500 font-medium">Total Collected</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatIndianCurrency(totalCollected, cs)}</p>
        </div>
        <div className="card py-4 px-5">
          <p className="text-xs text-gray-500 font-medium">Total Payments</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{payments.length}</p>
        </div>
        <div className="card py-4 px-5">
          <p className="text-xs text-gray-500 font-medium">Pending Invoices</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{invoices.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search payments..." className="input-field pl-10" />
          </div>
          <button onClick={loadData} className="btn-secondary py-2.5 px-3"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <button onClick={() => { setForm({ invoice_id: '', amount: '', method: 'Bank Transfer', reference: '', payment_date: new Date().toISOString().split('T')[0], notes: '' }); setShowModal(true); }} className="btn-success">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Payments Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No payments recorded</h3>
            <p className="text-sm text-gray-500">Record payments as they come in</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Method</th>
                  <th className="table-header">Reference</th>
                  <th className="table-header">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell text-gray-500">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</td>
                    <td className="table-cell font-medium text-primary-600">{payment.invoice_number}</td>
                    <td className="table-cell text-gray-700">{payment.customer_name}</td>
                    <td className="table-cell font-bold text-emerald-600">{formatIndianCurrency(payment.amount, cs)}</td>
                    <td className="table-cell"><span className="badge-info">{payment.method}</span></td>
                    <td className="table-cell text-gray-500 font-mono text-xs">{payment.reference || '—'}</td>
                    <td className="table-cell text-gray-500">{payment.recorder_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice *</label>
                <select value={form.invoice_id} onChange={e => setForm(prev => ({...prev, invoice_id: e.target.value}))} className="select-field" required>
                  <option value="">Select an invoice</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} — Balance: {cs}{(parseFloat(inv.total) - parseFloat(inv.amount_paid || 0)).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              {selectedInvoice && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-blue-700">Total: <strong>{cs}{parseFloat(selectedInvoice.total).toFixed(2)}</strong></p>
                  <p className="text-blue-700">Paid: <strong>{cs}{parseFloat(selectedInvoice.amount_paid || 0).toFixed(2)}</strong></p>
                  <p className="text-blue-800 font-bold">Balance Due: {cs}{balanceDue}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input type="number" min="0.01" step="0.01" max={balanceDue} value={form.amount} onChange={e => setForm(prev => ({...prev, amount: e.target.value}))} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select value={form.method} onChange={e => setForm(prev => ({...prev, method: e.target.value}))} className="select-field">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(prev => ({...prev, payment_date: e.target.value}))} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction ID</label>
                <input type="text" value={form.reference} onChange={e => setForm(prev => ({...prev, reference: e.target.value}))} className="input-field" placeholder="e.g., TXN-12345" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(prev => ({...prev, notes: e.target.value}))} className="input-field h-16 resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-success">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Record Payment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
