/**
 * Google Sheets Database Service
 * 
 * Supports two Google Sheets connection modes:
 * 1. Google Apps Script Web App URL (Recommended: Full Read + Write with 0 CORS issues)
 * 2. Google Sheets REST API v4 (Spreadsheet ID + API Key)
 * 3. Offline Local Database fallback with initial seed data
 */

const SHEETS_CONFIG_KEY = 'google_sheets_config';
import apiClient from './apiClient';

// Default configuration
const DEFAULT_CONFIG = {
  webAppUrl: '',
  spreadsheetId: '',
  apiKey: '',
  syncMode: 'auto', // 'webapp', 'api', 'local'
  isConfigured: false,
};

// Sheet names (tabs) in the Google Spreadsheet
export const SHEET_NAMES = {
  COMPANIES: 'Companies',
  USERS: 'Users',
  CUSTOMERS: 'Customers',
  PRODUCTS: 'Products',
  SERVICE_ORDERS: 'ServiceOrders',
  SERVICE_STATUS_HISTORY: 'ServiceStatusHistory',
  INVOICES: 'Invoices',
  INVOICE_ITEMS: 'InvoiceItems',
  PAYMENTS: 'Payments',
  EXPENSES: 'Expenses',
  QUOTATIONS: 'Quotations',
  PURCHASES: 'Purchases',
  SETTINGS: 'Settings',
};

// Column definitions for each sheet
export const SHEET_COLUMNS = {
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
  ServiceStatusHistory: [
    'id', 'company_id', 'service_order_id', 'from_status', 'to_status', 'notes', 'updated_by', 'timestamp'
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

class GoogleSheetsDB {
  constructor() {
    this.config = this.loadConfig();
    this.cache = {};
    this.cacheTimeout = 30000;
    this.cacheTimestamps = {};
  }

  // ==================== Configuration ====================

  loadConfig() {
    try {
      const saved = localStorage.getItem(SHEETS_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(config) {
    this.config = { ...this.config, ...config };
    this.config.isConfigured = Boolean(this.config.webAppUrl || (this.config.spreadsheetId && this.config.apiKey));
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(this.config));
    this.clearCache();
  }

  getConfig() {
    return { ...this.config };
  }

  isConfigured() {
    return Boolean(this.config.webAppUrl || (this.config.spreadsheetId && this.config.apiKey));
  }

  // ==================== Cache Management ====================

  clearCache() {
    this.cache = {};
    this.cacheTimestamps = {};
  }

  isCacheValid(sheetName) {
    const timestamp = this.cacheTimestamps[sheetName];
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTimeout;
  }

  setCache(sheetName, data) {
    this.cache[sheetName] = data;
    this.cacheTimestamps[sheetName] = Date.now();
  }

  // ==================== Core Fetch / Save ====================

  async fetchSheet(sheetName, forceRefresh = false) {
    if (!forceRefresh && this.isCacheValid(sheetName)) {
      return this.cache[sheetName];
    }

    // Call secure API layer (JWT-authenticated)
    try {
      const res = await apiClient.get(`/data/${encodeURIComponent(sheetName)}`);
      if (res && res.success && Array.isArray(res.data)) {
        this.setCache(sheetName, res.data);
        this.saveLocalData(sheetName, res.data);
        return res.data;
      }
    } catch (err) {
      console.warn(`[API Layer] Error fetching /api/data/${sheetName}, checking local cache:`, err.message);
    }

    // Graceful offline fallback
    const local = this.getLocalData(sheetName);
    this.setCache(sheetName, local);
    return local;
  }

  async appendRow(sheetName, data) {
    // Save to local storage for instantaneous optimistic UI
    const savedLocal = this.appendLocalData(sheetName, data);

    // Call secure API layer (JWT-authenticated)
    try {
      const res = await apiClient.post(`/data/${encodeURIComponent(sheetName)}`, data);
      if (res && res.success && res.data) {
        this.clearCache();
        return res.data;
      }
    } catch (err) {
      console.warn(`[API Layer] Error posting to /api/data/${sheetName}:`, err.message);
    }

    this.clearCache();
    return savedLocal;
  }

  async updateRow(sheetName, id, data) {
    const updated = this.updateLocalData(sheetName, id, data);

    // Call secure API layer (JWT-authenticated)
    try {
      const res = await apiClient.put(`/data/${encodeURIComponent(sheetName)}/${id}`, data);
      if (res && res.success && res.data) {
        this.clearCache();
        return res.data;
      }
    } catch (err) {
      console.warn(`[API Layer] Error updating /api/data/${sheetName}/${id}:`, err.message);
    }

    this.clearCache();
    return updated;
  }

  async deleteRow(sheetName, id) {
    const result = this.deleteLocalData(sheetName, id);

    // Call secure API layer (JWT-authenticated)
    try {
      await apiClient.delete(`/data/${encodeURIComponent(sheetName)}/${id}`);
    } catch (err) {
      console.warn(`[API Layer] Error deleting /api/data/${sheetName}/${id}:`, err.message);
    }

    this.clearCache();
    return result;
  }

  // ==================== Local Storage Cache & Seed ====================

  getLocalData(sheetName) {
    try {
      const data = localStorage.getItem(`sheet_${sheetName}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (sheetName === SHEET_NAMES.USERS && Array.isArray(parsed)) {
          // If old users with vendor/seller are found or admin@invoice.com is not yet set, upgrade users
          const hasOldRoles = parsed.some(u => u.role === 'vendor' || u.role === 'seller');
          const hasNewAdmin = parsed.some(u => u.username === 'admin@invoice.com');
          if (hasOldRoles || !hasNewAdmin) {
            return this.getDefaultData(sheetName);
          }
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return this.getDefaultData(sheetName);
  }

  saveLocalData(sheetName, data) {
    localStorage.setItem(`sheet_${sheetName}`, JSON.stringify(data));
  }

  appendLocalData(sheetName, data) {
    const existing = this.getLocalData(sheetName);
    const index = existing.findIndex(r => String(r.id) === String(data.id));
    if (index >= 0) {
      existing[index] = data;
    } else {
      existing.push(data);
    }
    this.saveLocalData(sheetName, existing);
    return data;
  }

  updateLocalData(sheetName, id, data) {
    const existing = this.getLocalData(sheetName);
    const index = existing.findIndex(r => String(r.id) === String(id));
    if (index !== -1) {
      existing[index] = { ...existing[index], ...data };
      this.saveLocalData(sheetName, existing);
      return existing[index];
    }
    return null;
  }

  deleteLocalData(sheetName, id) {
    const existing = this.getLocalData(sheetName);
    const filtered = existing.filter(r => String(r.id) !== String(id));
    this.saveLocalData(sheetName, filtered);
    return true;
  }

  // ==================== Default Seed Data ====================

  getDefaultData(sheetName) {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

    if (sheetName === SHEET_NAMES.COMPANIES) {
      const defaultCompanies = [
        {
          id: '1',
          name: 'Sai Ram Mobile Care & Service Center',
          logo: '',
          gstin: '33AAAAA0000A1Z5',
          address: 'Shop No. 14, Ground Floor, City Mobile Complex, 1st Cross, Market Road',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          state_code: '33',
          pincode: '641012',
          email: 'service@sairammobile.in',
          phone: '+91 98765 43210',
          website: 'www.sairammobile.in',
          invoice_prefix: 'MOB-',
          bank_name: 'State Bank of India',
          bank_acc_no: '332211445566',
          bank_ifsc: 'SBIN0001234',
          upi_id: 'sairammobile@upi',
          terms_conditions: '1. 90-day warranty on replaced display & battery assemblies.\n2. Water-damaged phones carry no warranty.\n3. Goods once sold will not be taken back.',
          is_active: 'true',
          subscription_plan: 'Enterprise',
          subscription_expiry: '2028-12-31',
          created_at: now,
          updated_at: now,
        },
        {
          id: '2',
          name: 'Apex Smartphone Solutions',
          logo: '',
          gstin: '29ABCDE1234F1Z5',
          address: '42, Brigade Road, Commercial Street Junction',
          city: 'Bengaluru',
          state: 'Karnataka',
          state_code: '29',
          pincode: '560001',
          email: 'support@apexsolutions.in',
          phone: '+91 98800 11223',
          website: 'www.apexsolutions.in',
          invoice_prefix: 'APX-',
          bank_name: 'HDFC Bank',
          bank_acc_no: '5010022334455',
          bank_ifsc: 'HDFC0000456',
          upi_id: 'apexsolutions@upi',
          terms_conditions: '1. Standard 60-day hardware service warranty.\n2. Customer must backup data before chip-level repair.',
          is_active: 'true',
          subscription_plan: 'Professional',
          subscription_expiry: '2027-12-31',
          created_at: now,
          updated_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultCompanies);
      return defaultCompanies;
    }

    if (sheetName === SHEET_NAMES.USERS) {
      const defaultUsers = [
        {
          id: '1',
          company_id: '1',
          username: 'admin@invoice.com',
          password_hash: '$2a$10$defaulthash',
          role: 'admin',
          full_name: 'Software Owner & Admin',
          email: 'admin@invoice.com',
          phone: '+91 98765 43210',
          company_name: 'Invoice ERP Master License',
          gstin: '',
          address: 'Main Administrative Center',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          upi_id: '',
          invoice_prefix: 'ADM-',
          subscription_valid_until: '2099-12-31',
          avatar_color: '#2563eb',
          is_active: 'true',
          created_at: now,
          updated_at: now,
        },
        {
          id: '2',
          company_id: '1',
          username: 'client1',
          password_hash: '$2a$10$defaulthash',
          role: 'client',
          full_name: 'Suresh Kumar',
          email: 'client1@company.com',
          phone: '+91 98401 22334',
          company_name: 'Sai Ram Mobile Care & Service Center',
          gstin: '33AAAAA0000A1Z5',
          address: 'Shop No. 14, City Mobile Complex, Market Road',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          upi_id: 'sairammobile@upi',
          invoice_prefix: 'MOB-',
          subscription_valid_until: '2027-11-21',
          avatar_color: '#059669',
          is_active: 'true',
          created_at: now,
          updated_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultUsers);
      return defaultUsers;
    }

    if (sheetName === SHEET_NAMES.CUSTOMERS) {
      const defaultCustomers = [
        {
          id: '1',
          name: 'Ramesh Kumar',
          email: 'ramesh.k@gmail.com',
          phone: '+91 98401 23456',
          company: 'Individual',
          address: '24, Bharathiyar Street, Gandhipuram',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          zip: '641012',
          country: 'India',
          category: 'Regular',
          notes: 'Redmi Note 12 Pro regular customer',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '2',
          name: 'Priya Sharma',
          email: 'priya.sharma@yahoo.com',
          phone: '+91 97910 87654',
          company: 'Individual',
          address: '15/B, Lake View Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          zip: '600028',
          country: 'India',
          category: 'VIP',
          notes: 'iPhone 13 screen replacement',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '3',
          name: 'Anand Verma',
          email: 'anand.verma@outlook.com',
          phone: '+91 98840 99881',
          company: 'Verma Electronics',
          address: '42, Market Complex',
          city: 'Madurai',
          state: 'Tamil Nadu',
          zip: '625001',
          country: 'India',
          category: 'Regular',
          notes: 'Samsung Galaxy A52 battery change',
          created_by: '2',
          created_at: now,
          updated_at: now,
        },
        {
          id: '4',
          name: 'Karthik Sundar',
          email: 'karthik.s@gmail.com',
          phone: '+91 99402 33221',
          company: 'Individual',
          address: '77, Anna Salai',
          city: 'Salem',
          state: 'Tamil Nadu',
          zip: '636007',
          country: 'India',
          category: 'Regular',
          notes: 'Vivo V27 charging & boot issue',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '5',
          name: 'Walk-in Customer',
          email: '',
          phone: '+91 91234 56789',
          company: '',
          address: 'Counter Sale',
          city: '',
          state: 'Tamil Nadu',
          zip: '',
          country: 'India',
          category: 'Retail',
          notes: 'Store counter purchase',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultCustomers);
      return defaultCustomers;
    }

    if (sheetName === SHEET_NAMES.PRODUCTS) {
      const defaultProducts = [
        {
          id: '1',
          name: 'iPhone 13/14 OLED Display Combo',
          sku: 'SAC-9987-IP',
          description: 'Original high-grade OLED display assembly with touch digitizer',
          category: 'Services',
          unit: 'Service',
          price: '3500.00',
          tax_rate: '18',
          stock_qty: '15',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '2',
          name: 'Redmi / Realme / Vivo Display Assembly',
          sku: 'SAC-9987-AND',
          description: 'Grade A+ FHD+ display combo replacement & fitting',
          category: 'Services',
          unit: 'Service',
          price: '1650.00',
          tax_rate: '18',
          stock_qty: '30',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '3',
          name: 'Original High-Capacity Battery',
          sku: 'SAC-9987-BAT',
          description: 'Zero-cycle battery replacement with 6-month warranty',
          category: 'Services',
          unit: 'Service',
          price: '850.00',
          tax_rate: '18',
          stock_qty: '40',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '4',
          name: 'Type-C / Micro USB Charging CC Board',
          sku: 'SAC-9987-CHG',
          description: 'Charging port connector & sub-board replacement',
          category: 'Services',
          unit: 'Service',
          price: '350.00',
          tax_rate: '18',
          stock_qty: '50',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '5',
          name: 'Water Damage Ultrasonic Service & Dead Fix',
          sku: 'SAC-9987-WTR',
          description: 'Ultrasonic chemical cleaning, short-circuit diagnosis & motherboard rework',
          category: 'Services',
          unit: 'Service',
          price: '500.00',
          tax_rate: '18',
          stock_qty: '99',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '6',
          name: 'Software Flashing / FRP Lock / Pattern Reset',
          sku: 'SAC-9987-SFT',
          description: 'Firmware flashing, software error fixing and bootloop recovery',
          category: 'Services',
          unit: 'Service',
          price: '300.00',
          tax_rate: '18',
          stock_qty: '99',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '7',
          name: '11D Shatterproof Tempered Glass',
          sku: 'HSN-8517-TMP',
          description: 'Oleophobic premium screen protector with curved edges',
          category: 'Hardware',
          unit: 'Piece',
          price: '120.00',
          tax_rate: '18',
          stock_qty: '120',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '8',
          name: 'Premium Shockproof Mobile Back Cover',
          sku: 'HSN-8517-CVR',
          description: 'Camera lens protection bumper case with matte finish',
          category: 'Hardware',
          unit: 'Piece',
          price: '199.00',
          tax_rate: '18',
          stock_qty: '75',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '9',
          name: '33W Super Fast Type-C Charger Adapter',
          sku: 'HSN-8517-ADP',
          description: 'BIS certified fast charging power adapter',
          category: 'Hardware',
          unit: 'Piece',
          price: '499.00',
          tax_rate: '18',
          stock_qty: '35',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '10',
          name: 'Braided Fast Charging Data Cable 65W',
          sku: 'HSN-8517-CBL',
          description: 'Heavy-duty nylon braided 1.2M fast sync & charge cable',
          category: 'Hardware',
          unit: 'Piece',
          price: '150.00',
          tax_rate: '18',
          stock_qty: '80',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
        {
          id: '11',
          name: 'Bluetooth Wireless Neckband Earphones',
          sku: 'HSN-8517-NKB',
          description: 'Deep bass magnetic wireless earphones with 30-hour battery',
          category: 'Hardware',
          unit: 'Piece',
          price: '699.00',
          tax_rate: '18',
          stock_qty: '25',
          is_active: 'true',
          created_by: '1',
          created_at: now,
          updated_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultProducts);
      return defaultProducts;
    }

    if (sheetName === SHEET_NAMES.INVOICES) {
      const dNow = new Date();
      const d2DaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
      const d4DaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];
      const d15DaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];

      const defaultInvoices = [
        {
          id: '1',
          invoice_number: 'MOB-1001',
          customer_id: '3',
          customer_name: 'Anand Verma',
          customer_phone: '+91 98840 99881',
          created_by: '1',
          creator_name: 'Administrator',
          invoice_date: d15DaysAgo,
          due_date: d15DaysAgo,
          status: 'paid',
          payment_mode: 'UPI (GPay / PhonePe / Paytm / BHIM)',
          cash_received: '0',
          change_due: '0.00',
          subtotal: '970.00',
          tax_amount: '174.60',
          discount_type: 'percentage',
          discount_value: '0',
          discount_amount: '0.00',
          total: '1144.60',
          amount_paid: '1144.60',
          currency: 'INR',
          device_model: 'Samsung Galaxy A52',
          imei_serial: '864201045982110',
          issue_reported: 'Battery draining fast; requested screen guard',
          warranty_period: '6 Months Warranty (Battery)',
          repair_status: 'Delivered to Customer',
          notes: 'Replaced original Samsung battery + 11D glass applied.',
          terms: '6 Months warranty on original battery replacement. Physical or water damage voids warranty.',
          created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
        {
          id: '2',
          invoice_number: 'MOB-1002',
          customer_id: '2',
          customer_name: 'Priya Sharma',
          customer_phone: '+91 97910 87654',
          created_by: '1',
          creator_name: 'Administrator',
          invoice_date: d4DaysAgo,
          due_date: d4DaysAgo,
          status: 'paid',
          payment_mode: 'Debit / Credit Card (RuPay/Visa)',
          cash_received: '0',
          change_due: '0.00',
          subtotal: '3699.00',
          tax_amount: '665.82',
          discount_type: 'percentage',
          discount_value: '0',
          discount_amount: '0.00',
          total: '4364.82',
          amount_paid: '4364.82',
          currency: 'INR',
          device_model: 'iPhone 13',
          imei_serial: '356891048291034',
          issue_reported: 'Fell down, cracked display and touch digitizer failure',
          warranty_period: '90 Days Warranty (Display Combo)',
          repair_status: 'Delivered to Customer',
          notes: 'High-grade OLED combo installed + camera protection back case.',
          terms: '90 Days warranty on Display Combo Touch only. Lines or break voids warranty.',
          created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        },
        {
          id: '3',
          invoice_number: 'MOB-1003',
          customer_id: '4',
          customer_name: 'Karthik Sundar',
          customer_phone: '+91 99402 33221',
          created_by: '1',
          creator_name: 'Administrator',
          invoice_date: d2DaysAgo,
          due_date: d2DaysAgo,
          status: 'paid',
          payment_mode: 'Cash',
          cash_received: '800',
          change_due: '33.00',
          subtotal: '650.00',
          tax_amount: '117.00',
          discount_type: 'percentage',
          discount_value: '0',
          discount_amount: '0.00',
          total: '767.00',
          amount_paid: '767.00',
          currency: 'INR',
          device_model: 'Vivo V27',
          imei_serial: '869102047382912',
          issue_reported: 'Charging port not detecting cable & software bootloop',
          warranty_period: '30 Days Warranty',
          repair_status: 'Delivered to Customer',
          notes: 'Type-C CC sub-board replaced and fresh firmware flashed.',
          terms: '30 Days warranty on sub-board hardware replacement.',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
        {
          id: '4',
          invoice_number: 'MOB-1004',
          customer_id: '1',
          customer_name: 'Ramesh Kumar',
          customer_phone: '+91 98401 23456',
          created_by: '1',
          creator_name: 'Administrator',
          invoice_date: today,
          due_date: today,
          status: 'paid',
          payment_mode: 'UPI (GPay / PhonePe / Paytm / BHIM)',
          cash_received: '0',
          change_due: '0.00',
          subtotal: '1770.00',
          tax_amount: '318.60',
          discount_type: 'percentage',
          discount_value: '0',
          discount_amount: '0.00',
          total: '2088.60',
          amount_paid: '2088.60',
          currency: 'INR',
          device_model: 'Redmi Note 12 Pro',
          imei_serial: '865201049281920',
          issue_reported: 'Display combo broken + wants full edge-to-edge tempered glass',
          warranty_period: '90 Days Warranty (Display Combo)',
          repair_status: 'Repaired / Ready for Pickup',
          notes: 'Brand new FHD+ combo fitted & 11D tempered glass applied.',
          terms: '90 Days warranty on Display Combo Touch replacement only.',
          created_at: now,
          updated_at: now,
        },
        {
          id: '5',
          invoice_number: 'MOB-1005',
          customer_id: '5',
          customer_name: 'Walk-in Customer',
          customer_phone: '+91 91234 56789',
          created_by: '1',
          creator_name: 'Administrator',
          invoice_date: today,
          due_date: today,
          status: 'paid',
          payment_mode: 'Cash',
          cash_received: '1000',
          change_due: '234.18',
          subtotal: '649.00',
          tax_amount: '116.82',
          discount_type: 'percentage',
          discount_value: '0',
          discount_amount: '0.00',
          total: '765.82',
          amount_paid: '765.82',
          currency: 'INR',
          device_model: 'OnePlus Nord CE',
          imei_serial: '',
          issue_reported: 'Counter purchase: Fast charger & cable',
          warranty_period: '6 Months Warranty',
          repair_status: 'Delivered to Customer',
          notes: '33W Super Fast Adapter + Braided 65W Type-C Cable.',
          terms: '6 Months replacement warranty on charger adapter with box.',
          created_at: now,
          updated_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultInvoices);
      return defaultInvoices;
    }

    if (sheetName === SHEET_NAMES.INVOICE_ITEMS) {
      const defaultItems = [
        // MOB-1001 (15 days ago)
        {
          id: '1',
          invoice_id: '1',
          product_id: '3',
          item_type: 'service',
          product_name: 'Original High-Capacity Battery',
          description: 'Samsung Galaxy A52 battery replacement with 6-month warranty',
          quantity: '1',
          unit: 'Service',
          unit_price: '850.00',
          tax_rate: '18',
          tax_amount: '153.00',
          amount: '850.00',
          barcode: 'SAC-9987-BAT',
        },
        {
          id: '2',
          invoice_id: '1',
          product_id: '7',
          item_type: 'product',
          product_name: '11D Shatterproof Tempered Glass',
          description: 'Samsung A52 Oleophobic screen protector',
          quantity: '1',
          unit: 'Piece',
          unit_price: '120.00',
          tax_rate: '18',
          tax_amount: '21.60',
          amount: '120.00',
          barcode: 'HSN-8517-TMP',
        },
        // MOB-1002 (4 days ago)
        {
          id: '3',
          invoice_id: '2',
          product_id: '1',
          item_type: 'service',
          product_name: 'iPhone 13/14 OLED Display Combo',
          description: 'Original OLED touch screen assembly with 90 days warranty',
          quantity: '1',
          unit: 'Service',
          unit_price: '3500.00',
          tax_rate: '18',
          tax_amount: '630.00',
          amount: '3500.00',
          barcode: 'SAC-9987-IP',
        },
        {
          id: '4',
          invoice_id: '2',
          product_id: '8',
          item_type: 'product',
          product_name: 'Premium Shockproof Mobile Back Cover',
          description: 'iPhone 13 camera lens protection matte cover',
          quantity: '1',
          unit: 'Piece',
          unit_price: '199.00',
          tax_rate: '18',
          tax_amount: '35.82',
          amount: '199.00',
          barcode: 'HSN-8517-CVR',
        },
        // MOB-1003 (2 days ago)
        {
          id: '5',
          invoice_id: '3',
          product_id: '4',
          item_type: 'service',
          product_name: 'Type-C / Micro USB Charging CC Board',
          description: 'Vivo V27 charging connector and sub-board replacement',
          quantity: '1',
          unit: 'Service',
          unit_price: '350.00',
          tax_rate: '18',
          tax_amount: '63.00',
          amount: '350.00',
          barcode: 'SAC-9987-CHG',
        },
        {
          id: '6',
          invoice_id: '3',
          product_id: '6',
          item_type: 'service',
          product_name: 'Software Flashing / FRP Lock / Pattern Reset',
          description: 'Vivo V27 bootloop firmware restore',
          quantity: '1',
          unit: 'Service',
          unit_price: '300.00',
          tax_rate: '18',
          tax_amount: '54.00',
          amount: '300.00',
          barcode: 'SAC-9987-SFT',
        },
        // MOB-1004 (Today)
        {
          id: '7',
          invoice_id: '4',
          product_id: '2',
          item_type: 'service',
          product_name: 'Redmi / Realme / Vivo Display Assembly',
          description: 'Redmi Note 12 Pro FHD+ display combo fitting',
          quantity: '1',
          unit: 'Service',
          unit_price: '1650.00',
          tax_rate: '18',
          tax_amount: '297.00',
          amount: '1650.00',
          barcode: 'SAC-9987-AND',
        },
        {
          id: '8',
          invoice_id: '4',
          product_id: '7',
          item_type: 'product',
          product_name: '11D Shatterproof Tempered Glass',
          description: 'Redmi Note 12 Pro full glue screen protector',
          quantity: '1',
          unit: 'Piece',
          unit_price: '120.00',
          tax_rate: '18',
          tax_amount: '21.60',
          amount: '120.00',
          barcode: 'HSN-8517-TMP',
        },
        // MOB-1005 (Today)
        {
          id: '9',
          invoice_id: '5',
          product_id: '9',
          item_type: 'product',
          product_name: '33W Super Fast Type-C Charger Adapter',
          description: 'Fast charging adapter with BIS certification',
          quantity: '1',
          unit: 'Piece',
          unit_price: '499.00',
          tax_rate: '18',
          tax_amount: '89.82',
          amount: '499.00',
          barcode: 'HSN-8517-ADP',
        },
        {
          id: '10',
          invoice_id: '5',
          product_id: '10',
          item_type: 'product',
          product_name: 'Braided Fast Charging Data Cable 65W',
          description: 'Nylon braided 1.2M Type-C fast cable',
          quantity: '1',
          unit: 'Piece',
          unit_price: '150.00',
          tax_rate: '18',
          tax_amount: '27.00',
          amount: '150.00',
          barcode: 'HSN-8517-CBL',
        },
      ];
      this.saveLocalData(sheetName, defaultItems);
      return defaultItems;
    }

    if (sheetName === SHEET_NAMES.PAYMENTS) {
      const defaultPayments = [
        {
          id: '1',
          invoice_id: '1',
          invoice_number: 'MOB-1001',
          customer_name: 'Anand Verma',
          amount: '1144.60',
          method: 'UPI (GPay / PhonePe / Paytm / BHIM)',
          reference: 'UPI-9884-0192',
          payment_date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
          notes: 'Full payment via GPay',
          recorded_by: '1',
          recorder_name: 'Administrator',
          created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
        {
          id: '2',
          invoice_id: '2',
          invoice_number: 'MOB-1002',
          customer_name: 'Priya Sharma',
          amount: '4364.82',
          method: 'Debit / Credit Card (RuPay/Visa)',
          reference: 'POS-TXN-7731',
          payment_date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
          notes: 'Card payment swiped at POS',
          recorded_by: '1',
          recorder_name: 'Administrator',
          created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        },
        {
          id: '3',
          invoice_id: '3',
          invoice_number: 'MOB-1003',
          customer_name: 'Karthik Sundar',
          amount: '767.00',
          method: 'Cash',
          reference: 'CASH-003',
          payment_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
          notes: 'Cash received at counter',
          recorded_by: '1',
          recorder_name: 'Administrator',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
        {
          id: '4',
          invoice_id: '4',
          invoice_number: 'MOB-1004',
          customer_name: 'Ramesh Kumar',
          amount: '2088.60',
          method: 'UPI (GPay / PhonePe / Paytm / BHIM)',
          reference: 'UPI-9840-7711',
          payment_date: today,
          notes: 'PhonePe QR code payment',
          recorded_by: '1',
          recorder_name: 'Administrator',
          created_at: now,
        },
        {
          id: '5',
          invoice_id: '5',
          invoice_number: 'MOB-1005',
          customer_name: 'Walk-in Customer',
          amount: '765.82',
          method: 'Cash',
          reference: 'CASH-005',
          payment_date: today,
          notes: 'Counter cash received',
          recorded_by: '1',
          recorder_name: 'Administrator',
          created_at: now,
        },
      ];
      this.saveLocalData(sheetName, defaultPayments);
      return defaultPayments;
    }

    if (sheetName === SHEET_NAMES.SETTINGS) {
      const defaultSettings = [
        { id: '1', key: 'company_name', value: 'Sai Ram Mobile Care & Service Center', category: 'branding', updated_at: now },
        { id: '2', key: 'company_email', value: 'service@sairammobile.in', category: 'branding', updated_at: now },
        { id: '3', key: 'company_phone', value: '+91 98765 43210', category: 'branding', updated_at: now },
        { id: '4', key: 'company_address', value: 'Shop No. 14, Ground Floor, City Mobile Complex, 1st Cross, Market Road', category: 'branding', updated_at: now },
        { id: '5', key: 'company_website', value: 'www.sairammobile.in', category: 'branding', updated_at: now },
        { id: '6', key: 'company_tagline', value: 'Smartphone Display, Battery & Motherboard Specialists', category: 'branding', updated_at: now },
        { id: '7', key: 'primary_color', value: '#2563eb', category: 'theme', updated_at: now },
        { id: '8', key: 'currency', value: 'INR', category: 'invoice', updated_at: now },
        { id: '9', key: 'currency_symbol', value: '₹', category: 'invoice', updated_at: now },
        { id: '10', key: 'tax_name', value: 'GST (18%)', category: 'invoice', updated_at: now },
        { id: '11', key: 'default_tax_rate', value: '18', category: 'invoice', updated_at: now },
        { id: '12', key: 'tax_id', value: 'GSTIN: 33AAAAA0000A1Z5', category: 'invoice', updated_at: now },
        { id: '13', key: 'upi_id', value: 'sairammobile@upi', category: 'invoice', updated_at: now },
        { id: '14', key: 'state_name', value: 'Tamil Nadu', category: 'invoice', updated_at: now },
        { id: '15', key: 'state_code', value: '33', category: 'invoice', updated_at: now },
        { id: '16', key: 'invoice_prefix', value: 'MOB-', category: 'invoice', updated_at: now },
        { id: '17', key: 'invoice_next_number', value: '1006', category: 'invoice', updated_at: now },
        { id: '18', key: 'payment_terms', value: 'Due on Delivery', category: 'invoice', updated_at: now },
        { id: '19', key: 'default_notes', value: 'Thank you for choosing Sai Ram Mobile Care! Please keep this bill safe for warranty claims.', category: 'invoice', updated_at: now },
        { id: '20', key: 'default_terms', value: '1. 90 Days warranty on Display Combo Touch replacement only.\n2. Physical break, line, or water damage completely voids warranty.\n3. 6 Months warranty on original battery replacement.\n4. Customers are requested to back up device data. Shop is not responsible for data loss.\n5. Handset delivery only against presentation of this bill.', category: 'invoice', updated_at: now },
        { id: '21', key: 'business_type', value: 'mobile_service', category: 'business', updated_at: now },
        { id: '22', key: 'enable_device_fields', value: 'true', category: 'business', updated_at: now },
        { id: '23', key: 'enable_grocery_fields', value: 'false', category: 'business', updated_at: now },
        { id: '24', key: 'catalog_admin_only', value: 'false', category: 'permissions', updated_at: now },
        { id: '25', key: 'allow_custom_price', value: 'true', category: 'permissions', updated_at: now },
        { id: '26', key: 'allow_custom_items', value: 'true', category: 'permissions', updated_at: now },
        { id: '27', key: 'allow_user_discounts', value: 'true', category: 'permissions', updated_at: now },
        { id: '28', key: 'max_discount_percent', value: '10', category: 'permissions', updated_at: now },
        { id: '29', key: 'default_invoice_layout', value: 'standard_a4', category: 'invoice', updated_at: now },
        { id: '30', key: 'thermal_paper_width', value: '80mm', category: 'invoice', updated_at: now },
        { id: '27', key: 'tax_id', value: 'GSTIN: 33AAAAA0000A1Z5', category: 'invoice', updated_at: now },
        { id: '28', key: 'upi_id', value: 'sairammobile@upi', category: 'invoice', updated_at: now },
        { id: '29', key: 'state_name', value: 'Tamil Nadu', category: 'invoice', updated_at: now },
        { id: '30', key: 'state_code', value: '33', category: 'invoice', updated_at: now },
      ];
      this.saveLocalData(sheetName, defaultSettings);
      return defaultSettings;
    }

    return [];
  }

  // ==================== Helper Methods ====================

  generateId(existingData) {
    if (!existingData || existingData.length === 0) return '1';
    const maxId = Math.max(...existingData.map(r => parseInt(r.id) || 0));
    return String(maxId + 1);
  }

  async getNextInvoiceNumber() {
    try {
      const res = await apiClient.get('/data/next-invoice-number');
      if (res && res.invoiceNumber) {
        return res.invoiceNumber;
      }
    } catch (e) {
      console.warn('API getNextInvoiceNumber failed, using local generation:', e.message);
    }

    const settings = await this.fetchSheet(SHEET_NAMES.SETTINGS);
    const prefix = settings.find(s => s.key === 'invoice_prefix')?.value || 'INV-';
    const nextNum = settings.find(s => s.key === 'invoice_next_number')?.value || '1004';
    
    // Increment next number
    const numSetting = settings.find(s => s.key === 'invoice_next_number');
    if (numSetting) {
      await this.updateRow(SHEET_NAMES.SETTINGS, numSetting.id, {
        ...numSetting,
        value: String(parseInt(nextNum) + 1),
        updated_at: new Date().toISOString(),
      });
    }

    return `${prefix}${nextNum}`;
  }

  async getSetting(key) {
    const settings = await this.fetchSheet(SHEET_NAMES.SETTINGS);
    const setting = settings.find(s => s.key === key);
    let val = setting?.value || '';
    if (key === 'company_name' && (!val || val === 'Vertex Invoicing Corp')) return 'Sai Ram Mobile Care & Service Center';
    if (key === 'company_tagline' && (!val || val === 'Enterprise Invoicing & Financial Operations')) return 'Smartphone Display, Battery & Motherboard Specialists';
    if (key === 'currency' && (!val || val !== 'INR')) return 'INR';
    if (key === 'currency_symbol' && (!val || val !== '₹')) return '₹';
    return val;
  }

  async getSettings() {
    const settings = await this.fetchSheet(SHEET_NAMES.SETTINGS);
    const result = {};
    settings.forEach(s => {
      result[s.key] = s.value;
    });
    if (!result.company_name || result.company_name === 'Vertex Invoicing Corp') {
      result.company_name = 'Sai Ram Mobile Care & Service Center';
    }
    if (!result.company_tagline || result.company_tagline === 'Enterprise Invoicing & Financial Operations') {
      result.company_tagline = 'Smartphone Display, Battery & Motherboard Specialists';
    }
    if (!result.currency || result.currency !== 'INR') {
      result.currency = 'INR';
      result.currency_symbol = '₹';
    }
    if (!result.currency_symbol) {
      result.currency_symbol = '₹';
    }
    return result;
  }

  async updateSetting(key, value) {
    const settings = await this.fetchSheet(SHEET_NAMES.SETTINGS);
    const existing = settings.find(s => s.key === key);
    
    if (existing) {
      return this.updateRow(SHEET_NAMES.SETTINGS, existing.id, {
        ...existing,
        value,
        updated_at: new Date().toISOString(),
      });
    } else {
      return this.appendRow(SHEET_NAMES.SETTINGS, {
        key,
        value,
        category: 'general',
        updated_at: new Date().toISOString(),
      });
    }
  }
}

const db = new GoogleSheetsDB();
export default db;
