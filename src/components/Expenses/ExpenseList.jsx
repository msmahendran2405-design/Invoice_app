import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { formatIndianCurrency } from '../../utils/indianUtils';
import {
  CreditCard, Plus, Search, Edit, Trash2, Calendar, TrendingDown,
  RefreshCw, DollarSign, ArrowUpRight, X, Receipt, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Spare Parts & Accessories Purchase',
  'Tools & Equipment',
  'Shop Rent',
  'Electricity & Utilities',
  'Staff Salary & Incentives',
  'Internet & Phone',
  'Stationery & Printing',
  'Tea & Refreshments',
  'Courier & Logistics',
  'Miscellaneous',
];

export default function ExpenseList() {
  const { user, activeCompanyId } = useAuth();
  const { settings } = useSettings();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    tax_amount: '0',
    vendor: '',
    payment_method: 'Cash',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadExpenses();
  }, [activeCompanyId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.EXPENSES, true);
      setExpenses(data.filter(e => e.id));
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setForm({
      category: EXPENSE_CATEGORIES[0],
      description: '',
      amount: '',
      tax_amount: '0',
      vendor: '',
      payment_method: 'Cash',
      expense_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      category: exp.category || EXPENSE_CATEGORIES[0],
      description: exp.description || '',
      amount: exp.amount || '',
      tax_amount: exp.tax_amount || '0',
      vendor: exp.vendor || '',
      payment_method: exp.payment_method || 'Cash',
      expense_date: exp.expense_date || new Date().toISOString().split('T')[0],
      notes: exp.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) {
      toast.error('Description and Amount are required');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingExpense) {
        await db.updateRow(SHEET_NAMES.EXPENSES, editingExpense.id, {
          ...editingExpense,
          ...form,
          updated_at: now,
        });
        toast.success('Expense updated!');
      } else {
        await db.appendRow(SHEET_NAMES.EXPENSES, {
          company_id: activeCompanyId || '1',
          ...form,
          recorded_by: user?.full_name || 'Admin',
          created_at: now,
        });
        toast.success('Expense recorded!');
      }
      setShowModal(false);
      loadExpenses();
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteRow(SHEET_NAMES.EXPENSES, id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.description?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.vendor?.toLowerCase().includes(q)
      );
    }).sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  }, [expenses, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Expense Management & Cash Outflow</span>
              <span className="text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-400/30 px-2 py-0.5 rounded-full">
                Profit & Loss Tracker
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Track operational costs, spares purchases, utilities, and maintain accurate net profit figures.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-0 py-2.5 px-4 shadow-md flex-shrink-0 whitespace-nowrap flex items-center gap-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Record New Expense
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Recorded Expenses</p>
          <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(totalExpenseAmount)}</p>
        </div>
        <div className="card py-3.5 px-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Expense Vouchers</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{expenses.length} Records</p>
        </div>
        <div className="card py-3.5 px-4 bg-blue-50/70 border border-blue-200">
          <p className="text-xs text-blue-800 font-bold uppercase">Average Per Voucher</p>
          <p className="text-2xl font-black text-blue-900 mt-1">
            {formatCurrency(expenses.length ? totalExpenseAmount / expenses.length : 0)}
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
            placeholder="Search expenses by description, vendor or category..."
            className="input-field pl-10 text-xs"
          />
        </div>
        <button onClick={loadExpenses} className="btn-secondary py-2.5 px-3">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Expense Table */}
      <div className="card p-0 overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No expenses recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">Add your store operational costs, utilities, or parts purchases.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {exp.expense_date}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {exp.vendor || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {exp.payment_method}
                    </td>
                    <td className="py-3 px-4 font-bold text-red-600 text-sm whitespace-nowrap">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {editingExpense ? 'Edit Expense' : 'Record New Expense'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expense Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="select-field text-xs"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                  className="input-field text-xs"
                  placeholder="e.g. October Shop Rent or Soldering Station Tip"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    required
                    className="input-field text-xs font-mono font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="select-field text-xs"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Card">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    value={form.vendor}
                    onChange={e => setForm({ ...form, vendor: e.target.value })}
                    className="input-field text-xs"
                    placeholder="e.g. Landlord / Wholesale Vendor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
