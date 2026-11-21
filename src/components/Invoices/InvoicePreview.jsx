import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import {
  ArrowLeft, Download, Printer, Edit, Smartphone, ShoppingCart,
  Receipt, FileText, CheckCircle2, ShieldCheck, QrCode, MessageSquare
} from 'lucide-react';
import {
  formatIndianCurrency,
  numberToIndianWords,
  getUpiQrCodeImgUrl,
  getWhatsAppShareUrl
} from '../../utils/indianUtils';
import toast from 'react-hot-toast';

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const printRef = useRef();

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(settings.default_invoice_layout || 'standard_a4');

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const invoices = await db.fetchSheet(SHEET_NAMES.INVOICES);
      const inv = invoices.find(i => i.id === id);
      if (!inv) {
        toast.error('Invoice not found');
        navigate('/invoices');
        return;
      }
      setInvoice(inv);

      const allItems = await db.fetchSheet(SHEET_NAMES.INVOICE_ITEMS);
      setItems(allItems.filter(item => item.invoice_id === id));
    } catch (error) {
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoice.invoice_number || 'invoice'}.pdf`);

      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const cs = settings.currency_symbol || '₹';
  const formatCurrency = (amount) => formatIndianCurrency(amount, cs);

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      sent: 'bg-blue-100 text-blue-700 border-blue-300',
      paid: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
      partial: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
      overdue: 'bg-red-100 text-red-700 border-red-300',
      cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
    };
    return (
      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs border ${styles[status] || styles.paid}`}>
        ● {status?.toUpperCase() || 'PAID'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!invoice) return null;

  const hasDeviceDetails = Boolean(invoice.device_model || invoice.imei_serial);
  const totalTax = parseFloat(invoice.tax_amount) || 0;
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const amountWords = numberToIndianWords(invoice.total);

  // Scannable UPI QR code URL
  const qrCodeUrl = settings.upi_id
    ? getUpiQrCodeImgUrl({
        upiId: settings.upi_id,
        name: settings.company_name || 'Store',
        amount: invoice.total,
        invoiceNumber: invoice.invoice_number,
        size: 160,
      })
    : null;

  // WhatsApp bill share link
  const whatsAppUrl = getWhatsAppShareUrl({
    phone: invoice.customer_phone,
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    total: invoice.total,
    storeName: settings.company_name || 'Our Store',
    currencySymbol: cs,
  });

  // WhatsApp phone intake acknowledgement link
  const cleanPhone = invoice.customer_phone ? invoice.customer_phone.replace(/\D/g, '') : '';
  const intakeMsg = `Dear ${invoice.customer_name || 'Customer'},\n\nYour mobile handset *${invoice.device_model || 'Device'}* has been received for service at *${settings.company_name || 'Sai Ram Mobile Care'}*.\n\n📋 *Job Card #:* ${invoice.invoice_number}\n📅 *Received On:* ${invoice.invoice_date} ${invoice.intake_time || ''}\n🔍 *Problem:* ${invoice.issue_reported || 'General Repair'}\n💰 *Estimated Charges:* ${cs}${invoice.estimated_cost || invoice.total}\n💵 *Advance Paid:* ${cs}${invoice.advance_paid || '0'}\n⏳ *Expected Delivery:* ${invoice.expected_delivery || 'Same Day / Tomorrow'}\n\nPlease keep this receipt safe for collecting your device.\n\n${settings.company_phone ? '📞 Helpline: ' + settings.company_phone : ''}`;
  const whatsAppIntakeUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(intakeMsg)}` : '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium text-sm">Back to Invoices</span>
        </button>

        {/* View Switcher: A4 vs Job Sheet vs Thermal Receipt */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('standard_a4')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'standard_a4' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 🧾 Tax Invoice (Bill)
          </button>
          <button
            onClick={() => setViewMode('job_sheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'job_sheet' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> 📱 Phone Intake Job Slip
          </button>
          <button
            onClick={() => setViewMode('thermal_pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'thermal_pos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> 🖨️ Thermal POS (80mm)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.customer_phone && (
            <a
              href={viewMode === 'job_sheet' ? whatsAppIntakeUrl : whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              title={viewMode === 'job_sheet' ? 'Send Intake Job Slip to WhatsApp' : 'Share GST invoice on WhatsApp'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {viewMode === 'job_sheet' ? 'WhatsApp Job Slip' : 'WhatsApp GST Bill'}
            </a>
          )}
          <Link to={`/invoices/edit/${id}`} className="btn-secondary text-xs py-2 px-3">
            <Edit className="w-3.5 h-3.5" /> Edit
          </Link>
          <button onClick={handlePrint} className="btn-secondary text-xs py-2 px-3">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="btn-primary text-xs py-2 px-3">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW */}
      {viewMode === 'standard_a4' ? (
        /* STANDARD A4 GST TAX INVOICE */
        <div ref={printRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none print:m-0">
          {/* Header Bar */}
          <div className="bg-primary-600 text-white px-8 py-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-6 h-6" />
                  <h1 className="text-2xl font-bold tracking-tight">{settings.company_name || 'Store Name'}</h1>
                </div>
                {settings.company_tagline && (
                  <p className="text-primary-100 text-xs font-medium">{settings.company_tagline}</p>
                )}
                {settings.tax_id && (
                  <p className="text-white text-xs mt-1.5 font-mono font-bold tracking-wide bg-primary-700/60 inline-block px-2.5 py-0.5 rounded">
                    {settings.tax_id}
                  </p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-xl font-black tracking-widest uppercase">TAX INVOICE</h2>
                <p className="text-primary-100 text-base font-mono font-bold mt-0.5">{invoice.invoice_number}</p>
                <p className="text-[11px] text-primary-200 mt-0.5">Original for Recipient</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-5">
            {/* Meta Row */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 text-xs">
              <div className="flex items-center gap-3">
                {getStatusBadge(invoice.status)}
                {invoice.payment_mode && (
                  <span className="text-gray-600">
                    Mode: <strong className="text-gray-900">{invoice.payment_mode}</strong>
                  </span>
                )}
              </div>
              <div className="text-right space-y-0.5 text-gray-600">
                <p>Invoice Date: <strong className="text-gray-900">{invoice.invoice_date}</strong></p>
                {settings.state_name && (
                  <p>Place of Supply: <strong className="text-gray-900">{settings.state_name} ({settings.state_code || '33'})</strong></p>
                )}
              </div>
            </div>

            {/* Bill From / Bill To */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Billed By (Supplier)</p>
                <p className="font-bold text-gray-900 text-sm">{settings.company_name}</p>
                <p className="text-gray-600">{settings.company_address}</p>
                <p className="text-gray-600">Contact: <strong>{settings.company_phone}</strong></p>
                {settings.company_email && <p className="text-gray-600">Email: {settings.company_email}</p>}
                {settings.tax_id && <p className="font-mono text-gray-800 font-bold">{settings.tax_id}</p>}
              </div>

              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Billed To (Customer)</p>
                <p className="font-bold text-gray-900 text-sm">{invoice.customer_name || 'Walk-in Customer'}</p>
                {invoice.customer_phone && (
                  <p className="text-gray-700">Phone: <strong>{invoice.customer_phone}</strong></p>
                )}
                <p className="text-gray-500">State: {settings.state_name || 'Tamil Nadu'}</p>
                <p className="text-[11px] text-gray-400 font-mono">Billed by: {invoice.creator_name || 'Cashier'}</p>
              </div>
            </div>

            {/* Indian Mobile Repair & Warranty Tag (If present) */}
            {hasDeviceDetails && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-blue-900 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Mobile Service Intake & Warranty Record
                  </div>
                  <span className="text-[11px] font-mono text-gray-500 font-normal">
                    Intake: {invoice.invoice_date} {invoice.intake_time || ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-blue-950 pt-0.5">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Handset / Model</span>
                    <strong className="text-xs text-blue-900">{invoice.device_model || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">IMEI / Serial</span>
                    <strong className="text-xs font-mono">{invoice.imei_serial || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Warranty</span>
                    <strong className="text-xs text-emerald-800 font-bold">{invoice.warranty_period || 'No Warranty'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Status</span>
                    <strong className="text-xs text-primary-700">{invoice.repair_status || 'Delivered'}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-200/60 text-xs">
                  {invoice.issue_reported && (
                    <div className="text-gray-700">
                      <span className="text-gray-500 text-[10px] uppercase font-semibold">Reported Issue: </span>
                      <strong>{invoice.issue_reported}</strong>
                    </div>
                  )}
                  {invoice.device_passcode && (
                    <div className="text-gray-700">
                      <span className="text-gray-500 text-[10px] uppercase font-semibold">Lock PIN / Pattern: </span>
                      <strong className="font-mono text-indigo-900">{invoice.device_passcode}</strong>
                    </div>
                  )}
                </div>

                {invoice.physical_condition && (
                  <div className="text-[11px] text-gray-600 pt-0.5">
                    <span className="text-gray-500 text-[10px] uppercase font-semibold">Intake Condition: </span>
                    <span>{invoice.physical_condition}</span>
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left w-10">#</th>
                    <th className="px-3.5 py-2.5 text-left">Item Description / Service</th>
                    <th className="px-3.5 py-2.5 text-center">HSN/SAC</th>
                    <th className="px-3.5 py-2.5 text-center">Unit</th>
                    <th className="px-3.5 py-2.5 text-right">Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Rate</th>
                    <th className="px-3.5 py-2.5 text-right">GST %</th>
                    <th className="px-3.5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {items.map((item, index) => {
                    const isService = item.item_type === 'service';
                    return (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="px-3.5 py-2.5 text-gray-400 text-center">{index + 1}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              isService ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isService ? '🔧 Service' : '📦 Product'}
                            </span>
                            <span className="font-bold text-gray-900">{item.product_name || item.description}</span>
                          </div>
                          {item.description && item.description !== item.product_name && (
                            <p className="text-gray-500 text-[11px] mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center text-gray-500 font-mono text-[11px]">
                          {item.barcode || (isService ? 'SAC-9987' : 'HSN-8517')}
                        </td>
                        <td className="px-3.5 py-2.5 text-center text-gray-600">{item.unit || (isService ? 'Service' : 'Piece')}</td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-gray-800">{item.quantity}</td>
                        <td className="px-3.5 py-2.5 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3.5 py-2.5 text-right text-gray-600">{item.tax_rate}%</td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations & UPI QR Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 items-start">
              {/* Left Side: UPI QR Code & Amount in words */}
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Amount in Words</span>
                  <p className="font-bold text-gray-900 leading-snug">{amountWords}</p>
                </div>

                {qrCodeUrl && (
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center gap-3">
                    <img
                      src={qrCodeUrl}
                      alt="UPI QR Code"
                      className="w-24 h-24 bg-white p-1 rounded-lg border border-emerald-300 flex-shrink-0"
                    />
                    <div className="space-y-0.5 text-xs text-emerald-950">
                      <p className="font-bold text-emerald-900 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> Scan & Pay with Any UPI
                      </p>
                      <p className="text-[11px] text-emerald-800">GPay • PhonePe • Paytm • BHIM</p>
                      <p className="font-mono text-[11px] text-gray-700 mt-1">UPI ID: <strong>{settings.upi_id}</strong></p>
                      <p className="text-[10px] text-gray-500">Scan to pay exact amount directly</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: GST Calculation Breakdown */}
              <div className="space-y-1.5 text-xs bg-gray-50/50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Amount (Subtotal)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({(parseFloat(settings.default_tax_rate || '18') / 2).toFixed(1)}%)</span>
                  <span className="font-medium text-amber-700">+{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({(parseFloat(settings.default_tax_rate || '18') / 2).toFixed(1)}%)</span>
                  <span className="font-medium text-amber-700">+{formatCurrency(sgst)}</span>
                </div>
                {parseFloat(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>Discount</span>
                    <span>-{formatCurrency(invoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t-2 border-gray-900 text-sm font-bold text-gray-900">
                  <span>Total Amount (INR)</span>
                  <span className="text-primary-600 text-lg">{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.payment_mode === 'Cash' && parseFloat(invoice.cash_received) > 0 && (
                  <div className="pt-2 border-t border-gray-200 space-y-0.5 text-gray-600 text-[11px]">
                    <div className="flex justify-between">
                      <span>Cash Tendered:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(invoice.cash_received)}</span>
                    </div>
                    {parseFloat(invoice.change_due) > 0 && (
                      <div className="flex justify-between text-emerald-800 font-bold">
                        <span>Change Returned:</span>
                        <span>{formatCurrency(invoice.change_due)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Terms */}
            {(invoice.notes || invoice.terms) && (
              <div className="grid grid-cols-2 gap-6 pt-3 border-t border-gray-200 text-xs text-gray-600">
                {invoice.notes && (
                  <div>
                    <p className="font-bold text-gray-800 uppercase tracking-wider mb-1 text-[10px]">Remarks / Instructions</p>
                    <p className="whitespace-pre-line leading-relaxed">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="font-bold text-gray-800 uppercase tracking-wider mb-1 text-[10px]">Terms & Conditions</p>
                    <p className="whitespace-pre-line leading-relaxed text-[11px] text-gray-500">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}

            {/* Signatory Footer */}
            <div className="flex justify-between items-end pt-6 border-t border-gray-200 text-xs">
              <div className="text-gray-400 text-[10px]">
                <p>This is a computer generated invoice.</p>
                <p>{settings.company_website || ''}</p>
              </div>
              <div className="text-center space-y-8">
                <div className="h-6"></div>
                <div className="border-t border-gray-400 pt-1 px-6">
                  <p className="font-bold text-gray-800 text-[11px]">For {settings.company_name}</p>
                  <p className="text-[10px] text-gray-500">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'job_sheet' ? (
        /* PHONE SERVICE JOB INTAKE SLIP & HANDSET TAG */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" ref={printRef}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white px-8 py-5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight">{settings.company_name || 'Sai Ram Mobile Care'}</h1>
                <p className="text-blue-200 text-xs mt-0.5">{settings.company_tagline || 'Smartphone Display, Battery & Motherboard Service Specialists'}</p>
                <p className="text-blue-100 text-xs mt-1">{settings.company_address} • Tel: {settings.company_phone}</p>
                {settings.tax_id && <p className="text-[11px] font-mono text-blue-200 mt-0.5">{settings.tax_id}</p>}
              </div>
              <div className="text-right">
                <span className="inline-block bg-white text-blue-900 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  📱 SERVICE JOB CARD & INTAKE SLIP
                </span>
                <p className="text-lg font-mono font-bold text-white mt-1.5">{invoice.invoice_number}</p>
                <p className="text-[11px] text-blue-200">Customer Proof of Deposit</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-5 text-xs text-gray-800">
            {/* Meta Row: Status & Dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Intake Date & Time</span>
                <strong className="text-gray-900 text-xs">{invoice.invoice_date} {invoice.intake_time || ''}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Expected Delivery</span>
                <strong className="text-blue-900 text-xs">{invoice.expected_delivery || invoice.due_date || 'Same Day / Tomorrow'}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Job Card Status</span>
                <strong className="text-emerald-700 text-xs">{invoice.repair_status || 'Received'}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Received By</span>
                <strong className="text-gray-900 text-xs">{invoice.creator_name || 'Service Staff'}</strong>
              </div>
            </div>

            {/* Customer & Handset Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Box */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer Details</p>
                <p className="text-sm font-bold text-gray-900">{invoice.customer_name || 'Walk-in Customer'}</p>
                <p className="text-xs text-gray-700">Phone: <strong>{invoice.customer_phone || 'Not provided'}</strong></p>
                <p className="text-xs text-gray-500">State / Region: {settings.state_name || 'Tamil Nadu'}</p>
              </div>

              {/* Handset Box */}
              <div className="p-4 rounded-xl border-2 border-blue-200 bg-white space-y-1.5">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Handset Intake Details</p>
                <p className="text-sm font-black text-blue-950">📱 {invoice.device_model || 'Handset Model Not Specified'}</p>
                <div className="flex justify-between text-xs pt-0.5">
                  <span className="text-gray-600">IMEI / S/N: <strong className="font-mono">{invoice.imei_serial || '—'}</strong></span>
                  <span className="text-gray-600">Lock PIN/Pattern: <strong className="font-mono text-indigo-800">{invoice.device_passcode || 'None'}</strong></span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Physical Condition: <strong>{invoice.physical_condition || 'Standard condition with normal usage wear'}</strong>
                </p>
              </div>
            </div>

            {/* Problem & Fault Box */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Customer Reported Problem / Fault Description:</span>
              <p className="text-sm font-bold text-gray-900">{invoice.issue_reported || 'Diagnosis & Repair Service'}</p>
            </div>

            {/* Services/Items Quoted */}
            {items.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-bold text-[11px] text-gray-700 border-b border-gray-200 flex justify-between">
                  <span>Services / Work Order Item</span>
                  <span>Estimated Amount</span>
                </div>
                <div className="divide-y divide-gray-100 text-xs">
                  {items.map((it, idx) => (
                    <div key={idx} className="px-4 py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-gray-900">{it.product_name || it.description}</span>
                        {it.description && it.description !== it.product_name && (
                          <span className="text-gray-500 text-[11px] block">{it.description}</span>
                        )}
                      </div>
                      <span className="font-bold text-gray-800">{formatCurrency(it.amount || it.unit_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cost & Advance Summary */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Estimated Total Cost</span>
                <strong className="text-base font-black text-gray-900">{formatCurrency(invoice.estimated_cost || invoice.total)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Advance Received</span>
                <strong className="text-base font-bold text-emerald-700">{formatCurrency(invoice.advance_paid || '0')}</strong>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Balance Due on Delivery</span>
                <strong className="text-base font-black text-blue-900">
                  {formatCurrency(Math.max(0, (parseFloat(invoice.estimated_cost || invoice.total) || 0) - (parseFloat(invoice.advance_paid) || 0)))}
                </strong>
              </div>
            </div>

            {/* Customer Declaration & Terms */}
            <div className="p-3 bg-gray-50/70 rounded-xl border border-gray-200 space-y-1 text-[11px] text-gray-600 leading-relaxed">
              <p className="font-bold text-gray-800 uppercase text-[10px]">Important Terms & Conditions for Customer:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Delivery of the device will be made strictly upon presentation of this original Job Slip.</li>
                <li>Customers are requested to take complete backup of all photos, contacts, and personal data. Service center is not liable for data loss.</li>
                <li>Water-damaged, dead, or previously tampered devices carry high risk of internal board failure during diagnosis/repair.</li>
                <li>Devices not collected within 30 days of completion notification will be disposed of.</li>
              </ol>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-200 text-center text-xs">
              <div className="pt-6">
                <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-gray-800">Customer Signature</p>
                <p className="text-[10px] text-gray-400">Accepted device handover terms</p>
              </div>
              <div className="pt-6">
                <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-gray-800">For {settings.company_name}</p>
                <p className="text-[10px] text-gray-400">Authorised Technician Seal / Sign</p>
              </div>
            </div>

            {/* ✂️ TEAR-OFF TECHNICIAN HANDSET TAG */}
            <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-400 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <span>✂️ TEAR-OFF HANDSET TAG (Tape directly to the mobile phone body)</span>
                <span>Job #{invoice.invoice_number}</span>
              </div>
              <div className="p-3.5 bg-yellow-50 border-2 border-dashed border-yellow-300 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 block">Job Card #</span>
                  <strong className="text-sm font-mono text-gray-900">{invoice.invoice_number}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Handset Model</span>
                  <strong className="text-xs text-blue-900">{invoice.device_model || '—'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Customer Name</span>
                  <strong className="text-xs text-gray-900">{invoice.customer_name} ({invoice.customer_phone})</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Lock PIN / Pattern</span>
                  <strong className="text-xs font-mono text-indigo-900">{invoice.device_passcode || 'None'}</strong>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-[10px] text-gray-500 block">Fault / Problem</span>
                  <strong className="text-xs text-gray-900">{invoice.issue_reported || 'Repair'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Date & Time</span>
                  <span className="text-[11px] text-gray-700">{invoice.invoice_date} {invoice.intake_time || ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* THERMAL POS RECEIPT (80mm / 58mm Indian Standard) */
        <div className="flex justify-center">
          <div
            ref={printRef}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 text-gray-900 font-mono text-xs w-[340px] space-y-3 print:border-none print:shadow-none print:w-full print:m-0"
          >
            {/* Store Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-gray-400 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-tight">{settings.company_name}</h2>
              {settings.company_tagline && <p className="text-[9px] text-gray-500">{settings.company_tagline}</p>}
              <p className="text-[10px] text-gray-600">{settings.company_address}</p>
              <p className="text-[10px]">Tel: <strong>{settings.company_phone}</strong></p>
              {settings.tax_id && <p className="text-[10px] font-bold font-mono">{settings.tax_id}</p>}
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-gray-400 pb-2">
              <div className="flex justify-between">
                <span>Bill #:</span>
                <strong>{invoice.invoice_number}</strong>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{invoice.invoice_date}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold truncate max-w-[160px]">{invoice.customer_name || 'Walk-in'}</span>
              </div>
              {invoice.customer_phone && (
                <div className="flex justify-between">
                  <span>Mobile:</span>
                  <span>{invoice.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Device / IMEI (If present) */}
            {hasDeviceDetails && (
              <div className="bg-gray-100 p-2 rounded text-[10px] space-y-0.5 border border-gray-300">
                <div className="font-bold uppercase text-center border-b border-gray-300 pb-0.5 mb-1">
                  📱 Mobile Service Record
                </div>
                <div>Handset: <strong>{invoice.device_model || '—'}</strong></div>
                {invoice.imei_serial && <div>IMEI: <strong className="font-mono">{invoice.imei_serial}</strong></div>}
                {invoice.device_passcode && <div>Lock PIN: <strong className="font-mono">{invoice.device_passcode}</strong></div>}
                {invoice.intake_time && <div>Time: <span>{invoice.intake_time}</span></div>}
                {invoice.issue_reported && <div>Problem: <span>{invoice.issue_reported}</span></div>}
                <div>Warranty: <strong className="text-emerald-800">{invoice.warranty_period || 'No Warranty'}</strong></div>
              </div>
            )}

            {/* Items List */}
            <div className="border-b border-dashed border-gray-400 pb-2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 border-b border-gray-200 pb-1">
                <span>Item</span>
                <span>Qty x Rate</span>
                <span>Amt</span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  <div className="font-bold leading-tight">{item.product_name || item.description}</div>
                  <div className="flex justify-between text-gray-600 text-[10px]">
                    <span>{item.quantity} {item.unit || ''} x {formatCurrency(item.unit_price)}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals & Tax Split */}
            <div className="space-y-1 text-xs border-b border-dashed border-gray-400 pb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>CGST:</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>SGST:</span>
                <span>{formatCurrency(sgst)}</span>
              </div>
              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-400">
                <span>NET TOTAL:</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-gray-600">
                <span>Pay Mode:</span>
                <strong>{invoice.payment_mode || 'Cash'}</strong>
              </div>
              {invoice.payment_mode === 'Cash' && parseFloat(invoice.cash_received) > 0 && (
                <>
                  <div className="flex justify-between text-[11px]">
                    <span>Cash Tendered:</span>
                    <span>{formatCurrency(invoice.cash_received)}</span>
                  </div>
                  {parseFloat(invoice.change_due) > 0 && (
                    <div className="flex justify-between text-[11px] font-bold text-emerald-800">
                      <span>Change:</span>
                      <span>{formatCurrency(invoice.change_due)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Scannable UPI QR on Thermal Bill */}
            {qrCodeUrl && (
              <div className="text-center py-2 border-b border-dashed border-gray-400 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-tight">Scan with Any UPI to Pay</p>
                <img src={qrCodeUrl} alt="UPI QR" className="w-24 h-24 mx-auto border border-gray-300 p-0.5" />
                <p className="text-[9px] text-gray-500 font-mono">{settings.upi_id}</p>
              </div>
            )}

            {/* Footer Note */}
            <div className="text-center space-y-1 pt-1 text-[10px] text-gray-500">
              <p className="font-bold text-gray-700">{invoice.notes || settings.default_notes || 'Thank you! Visit again!'}</p>
              <p className="text-[9px] leading-tight text-gray-400">
                {invoice.terms ? invoice.terms.split('\n')[0] : 'Please retain this bill for warranty & service verification.'}
              </p>
              <p className="text-[9px] font-mono pt-1">*** THANK YOU ***</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
