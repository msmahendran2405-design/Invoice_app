/**
 * Indian Localization Utilities
 * Currency formatting (Lakhs/Crores), Words conversion, GST calculation, and UPI integration.
 */

// List of Indian States and Union Territories with 2-digit GST state codes
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

/**
 * Format numbers using the Indian numbering system (Lakhs and Crores)
 * e.g., 1250000.50 -> ₹12,50,000.50
 */
export function formatIndianCurrency(amount, symbol = '₹') {
  const num = parseFloat(amount || 0);
  if (isNaN(num)) return `${symbol}0.00`;

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian comma formatting
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  return `${isNegative ? '-' : ''}${symbol}${integerPart}.${decimalPart}`;
}

/**
 * Convert number to words in Indian Rupees (Lakhs / Crores)
 * e.g., 1540 -> "Rupees One Thousand Five Hundred Forty Only"
 */
export function numberToIndianWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(parseFloat(num) || 0));
  if (n === 0) return 'Rupees Zero Only';

  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const words = inWords(n).trim();
  return `Rupees ${words} Only`;
}

/**
 * Generate UPI Payment URL compatible with GPay, PhonePe, Paytm, BHIM
 */
export function generateUpiUrl({ upiId, name = '', amount = 0, invoiceNumber = '' }) {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(name.trim() || 'Store');
  const cleanInv = encodeURIComponent(invoiceNumber.trim() || 'Bill');
  const amt = parseFloat(amount || 0).toFixed(2);

  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${amt}&cu=INR&tn=Invoice-${cleanInv}`;
}

/**
 * Generate UPI QR Code image URL via reliable QR rendering API
 */
export function getUpiQrCodeImgUrl({ upiId, name, amount, invoiceNumber, size = 150 }) {
  const upiUrl = generateUpiUrl({ upiId, name, amount, invoiceNumber });
  if (!upiUrl) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(upiUrl)}`;
}

/**
 * Generate WhatsApp share link with Indian mobile (+91)
 */
export function getWhatsAppShareUrl({ phone, invoiceNumber, customerName, total, storeName, currencySymbol = '₹' }) {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  if (!cleanPhone.startsWith('91')) {
    cleanPhone = '91' + cleanPhone;
  }

  const msg = `Dear ${customerName || 'Customer'},\n\nYour invoice *${invoiceNumber}* for *${currencySymbol}${total}* from *${storeName}* is ready.\n\nThank you for choosing us!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}

/**
 * Format date in DD/MM/YYYY format
 */
export function formatIndianDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
