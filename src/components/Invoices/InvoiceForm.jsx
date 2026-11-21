import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import {
  Plus, Trash2, ArrowLeft, Printer, CheckCircle2,
  Smartphone, QrCode, Sparkles, UserCheck, Shield
} from 'lucide-react';
import { formatIndianCurrency, numberToIndianWords, getUpiQrCodeImgUrl } from '../../utils/indianUtils';
import toast from 'react-hot-toast';

const QUICK_ITEMS = [
  { name: 'Display Combo Replacement', rate: 1650, tax: 18, type: 'service' },
  { name: 'Battery Replacement', rate: 850, tax: 18, type: 'service' },
  { name: 'Charging Port Repair', rate: 350, tax: 18, type: 'service' },
  { name: '11D Tempered Glass', rate: 150, tax: 18, type: 'product' },
  { name: '33W Fast Charger', rate: 499, tax: 18, type: 'product' },
  { name: 'General Phone Service', rate: 300, tax: 18, type: 'service' },
];

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, currentCompany } = useAuth();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Clean Customer & Invoice State (Only Essential Fields)
  const [invoice, setInvoice] = useState({
    customer_name: '',
    customer_phone: '',
    device_model: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Cash',
    apply_tax: true,
    status: 'paid',
  });

  const [items, setItems] = useState([
    {
      id: 1,
      description: 'Display Combo Replacement',
      quantity: 1,
      unit_price: 1650,
      tax_rate: 18,
    }
  ]);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Check if coming from Customer Service desk via ?from_service=ID
      const searchParams = new URLSearchParams(window.location.search);
      const fromServiceId = searchParams.get('from_service');

      if (fromServiceId && !isEdit) {
        const allInvs = await db.fetchSheet(SHEET_NAMES.INVOICES, true);
        const sOrder = allInvs.find(i => String(i.id) === String(fromServiceId));
        if (sOrder) {
          setInvoice(prev => ({
            ...prev,
            customer_name: sOrder.customer_name || '',
            customer_phone: sOrder.customer_phone || '',
            device_model: sOrder.device_model || '',
          }));
          const serviceCharge = parseFloat(sOrder.estimated_cost || sOrder.total || 350);
          setItems([
            {
              id: 1,
              description: `${sOrder.device_model || 'Handset'} - ${sOrder.issue_reported || 'Service & Repair'}`,
              quantity: 1,
              unit_price: serviceCharge,
              tax_rate: 18,
            }
          ]);
          toast.success(`Loaded details from Service ${sOrder.invoice_number || ''}`);
        }
      } else if (isEdit) {
        const invoices = await db.fetchSheet(SHEET_NAMES.INVOICES, true);
        const inv = invoices.find(i => String(i.id) === String(id));
        if (inv) {
          setInvoice({
            customer_name: inv.customer_name || '',
            customer_phone: inv.customer_phone || '',
            device_model: inv.device_model || '',
            invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
            payment_mode: inv.payment_mode || 'Cash',
            apply_tax: parseFloat(inv.tax_amount || 0) > 0,
            status: inv.status || 'paid',
          });

          const allItems = await db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS, true);
          const related = allItems.filter(it => String(it.invoice_id) === String(id));
          if (related.length > 0) {
            setItems(related.map((it, idx) => ({
              id: idx + 1,
              description: it.product_name || it.description || 'Item',
              quantity: parseFloat(it.quantity) || 1,
              unit_price: parseFloat(it.unit_price) || 0,
              tax_rate: parseFloat(it.tax_rate) || 0,
            })));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load invoice form:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickWalkIn = () => {
    setInvoice(prev => ({
      ...prev,
      customer_name: prev.customer_name || 'Walk-in Customer',
      customer_phone: prev.customer_phone || '98765 00000',
    }));
    toast.success('Walk-in Customer details added');
  };

  const handleAddQuickItem = (preset) => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        description: preset.name,
        quantity: 1,
        unit_price: preset.rate,
        tax_rate: invoice.apply_tax ? preset.tax : 0,
      }
    ]);
    toast.success(`Added ${preset.name}`);
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: invoice.apply_tax ? 18 : 0,
      }
    ]);
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      toast.error('Invoice must contain at least one item');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach(it => {
      const qty = parseFloat(it.quantity) || 1;
      const rate = parseFloat(it.unit_price) || 0;
      const lineSubtotal = qty * rate;
      const taxRate = invoice.apply_tax ? (parseFloat(it.tax_rate) || 0) : 0;
      const lineTax = (lineSubtotal * taxRate) / 100;

      subtotal += lineSubtotal;
      totalTax += lineTax;
    });

    const grandTotal = Math.round(subtotal + totalTax);

    return {
      subtotal,
      totalTax,
      grandTotal,
    };
  }, [items, invoice.apply_tax]);

  const currencySymbol = settings.currency_symbol || '₹';
  const formatCurrency = (amt) => formatIndianCurrency(amt, currencySymbol);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoice.customer_name.trim()) {
      toast.error('Please enter Customer Name');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nextInvNum = isEdit ? null : await db.getNextInvoiceNumber();

      const invoiceData = {
        company_id: user?.company_id || '1',
        customer_name: invoice.customer_name.trim(),
        customer_phone: invoice.customer_phone.trim(),
        device_model: invoice.device_model.trim(),
        invoice_date: invoice.invoice_date,
        payment_mode: invoice.payment_mode,
        subtotal: String(calculations.subtotal),
        tax_amount: String(calculations.totalTax),
        total: String(calculations.grandTotal),
        status: invoice.status,
        updated_at: now,
      };

      let savedId;
      if (isEdit) {
        await db.updateRow(SHEET_NAMES.INVOICES, id, invoiceData);
        savedId = id;
      } else {
        invoiceData.invoice_number = nextInvNum;
        invoiceData.created_at = now;
        invoiceData.created_by = user?.id || '1';
        const saved = await db.appendRow(SHEET_NAMES.INVOICES, invoiceData);
        savedId = saved.id;
      }

      // Save line items
      for (const it of items) {
        await db.appendRow(SHEET_NAMES.INVOICE_ITEMS, {
          invoice_id: savedId,
          product_name: it.description || 'Service / Product',
          quantity: String(it.quantity || 1),
          unit_price: String(it.unit_price || 0),
          tax_rate: String(invoice.apply_tax ? it.tax_rate : 0),
          amount: String((parseFloat(it.quantity) || 1) * (parseFloat(it.unit_price) || 0)),
        });
      }

      // Auto-save Customer to directory
      if (invoice.customer_phone.trim()) {
        try {
          const allCust = await db.fetchSheet(SHEET_NAMES.CUSTOMERS, true);
          const found = allCust.find(c => c.phone === invoice.customer_phone.trim());
          if (!found) {
            await db.appendRow(SHEET_NAMES.CUSTOMERS, {
              company_id: user?.company_id || '1',
              name: invoice.customer_name.trim(),
              phone: invoice.customer_phone.trim(),
              created_at: now,
            });
          }
        } catch (cErr) {
          console.warn('Customer auto-save note:', cErr);
        }
      }

      toast.success(isEdit ? 'Invoice updated!' : 'Invoice generated successfully!');
      navigate(`/invoices/view/${savedId}`);
    } catch (err) {
      console.error('Invoice save failed:', err);
      toast.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const upiQrUrl = getUpiQrCodeImgUrl({
    upiId: user?.upi_id || settings.upi_id || 'sairam@okaxis',
    name: currentCompany?.name || 'Mobile Care',
    amount: calculations.grandTotal,
    invoiceNumber: 'INV-BILL',
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            className="p-2 bg-white hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-600 transition-colors"
            title="Back to Invoices"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Invoice' : 'Create Invoice & Bill'}
            </h1>
            <p className="text-xs text-gray-500">
              Instant GST and Cash billing with Scan-and-Pay UPI QR Code
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleQuickWalkIn}
          className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>⚡ Fast Walk-in Customer</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Items (2 Columns wide) */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Customer & Phone Reference Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤</span> Customer Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={invoice.customer_name}
                  onChange={e => setInvoice({ ...invoice, customer_name: e.target.value })}
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={invoice.customer_phone}
                  onChange={e => setInvoice({ ...invoice, customer_phone: e.target.value })}
                  placeholder="e.g. 98401 23456"
                  className="input-field text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Model (Optional)
                </label>
                <input
                  type="text"
                  value={invoice.device_model}
                  onChange={e => setInvoice({ ...invoice, device_model: e.target.value })}
                  placeholder="e.g. Vivo Y20 / Samsung M31"
                  className="input-field text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Items & Services Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>🧾</span> Items & Services Billed
              </h3>

              {/* Tax Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">GST Billing (18%):</span>
                <button
                  type="button"
                  onClick={() => setInvoice({ ...invoice, apply_tax: !invoice.apply_tax })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                    invoice.apply_tax
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-gray-100 text-gray-600 border-gray-300'
                  }`}
                >
                  {invoice.apply_tax ? '✓ GST Enabled' : 'No GST (Cash Bill)'}
                </button>
              </div>
            </div>

            {/* Quick Pick Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-gray-400 mr-1">Quick Add:</span>
              {QUICK_ITEMS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuickItem(preset)}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-all"
                >
                  + {preset.name} (₹{preset.rate})
                </button>
              ))}
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Item / Service Description</th>
                    <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                    {invoice.apply_tax && <th className="py-2.5 px-3 w-20 text-center">GST %</th>}
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const lineTotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                            required
                            placeholder="e.g. Display Combo / Battery"
                            className="w-full bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-medium text-gray-900"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs text-center font-bold"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="any"
                            value={item.unit_price}
                            onChange={e => handleItemChange(index, 'unit_price', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs text-right font-mono font-bold"
                          />
                        </td>
                        {invoice.apply_tax && (
                          <td className="p-2 text-center">
                            <select
                              value={item.tax_rate}
                              onChange={e => handleItemChange(index, 'tax_rate', e.target.value)}
                              className="bg-transparent border border-gray-200 rounded px-1.5 py-1 text-[11px] font-bold text-center"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                        )}
                        <td className="p-2 text-right font-mono font-bold text-gray-900">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                            title="Remove Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Item</span>
            </button>
          </div>
        </div>

        {/* Right Column: Billing Summary & Payment (1 Column) */}
        <div className="space-y-5">
          {/* Billing Summary Box */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Payment Summary
            </h3>

            <div className="space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-gray-900">{formatCurrency(calculations.subtotal)}</span>
              </div>

              {invoice.apply_tax && (
                <div className="flex justify-between text-emerald-700">
                  <span>GST (Tax):</span>
                  <span className="font-mono font-semibold">+{formatCurrency(calculations.totalTax)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-sm font-bold text-gray-900">
                <span>Grand Total:</span>
                <span className="text-xl font-black text-indigo-700">{formatCurrency(calculations.grandTotal)}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">
                {numberToIndianWords(calculations.grandTotal)}
              </p>
            </div>

            {/* Payment Mode Selection */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Payment Mode</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['Cash', 'UPI', 'Card'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInvoice({ ...invoice, payment_mode: mode })}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      invoice.payment_mode === mode
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic UPI QR Code Preview when UPI is selected */}
            {invoice.payment_mode === 'UPI' && (
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-indigo-900">Scan to Pay via UPI</p>
                  <p className="text-[10px] text-indigo-600">GPay, PhonePe, Paytm</p>
                  <p className="font-mono text-[10px] text-gray-500 mt-1">{user?.upi_id || settings.upi_id || 'sairam@okaxis'}</p>
                </div>
                {upiQrUrl && (
                  <img
                    src={upiQrUrl}
                    alt="UPI QR Code"
                    className="w-16 h-16 rounded-lg border border-indigo-200 bg-white p-0.5 shadow-xs"
                  />
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full justify-center py-3 text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>{saving ? 'Generating...' : 'Generate & Print Invoice'}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="btn-secondary w-full justify-center py-2 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
