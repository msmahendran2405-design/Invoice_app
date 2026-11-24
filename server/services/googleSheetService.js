const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');

const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Initial default seed data
const DEFAULT_SEED_DATA = {
  Companies: [
    {
      id: '1',
      name: 'Sai Ram Mobile Care & Service Center',
      gstin: '33AAAAA0000A1Z5',
      address: 'Shop No. 14, Ground Floor, City Mobile Complex, 1st Cross, Market Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      state_code: '33',
      pincode: '641012',
      email: 'service@sairammobile.in',
      phone: '+91 98765 43210',
      invoice_prefix: 'MOB-',
      upi_id: 'sairammobile@upi',
      is_active: 'true',
      subscription_plan: 'Enterprise',
      subscription_expiry: '2028-12-31',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Apex Smartphone Solutions',
      gstin: '29ABCDE1234F1Z5',
      address: '42, Brigade Road, Commercial Street Junction',
      city: 'Bengaluru',
      state: 'Karnataka',
      state_code: '29',
      pincode: '560001',
      email: 'support@apexsolutions.in',
      phone: '+91 98800 11223',
      invoice_prefix: 'APX-',
      upi_id: 'apexsolutions@upi',
      is_active: 'true',
      subscription_plan: 'Professional',
      subscription_expiry: '2027-12-31',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  Users: [
    {
      id: '1',
      company_id: '1',
      username: 'admin@invoice.com',
      password: 'mahendran@123',
      role: 'admin',
      full_name: 'Mahendran (Admin & Owner)',
      email: 'admin@invoice.com',
      phone: '+91 98765 43210',
      company_name: 'Master Invoice Software ERP',
      is_active: 'true',
      subscription_valid_until: '2099-12-31',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      company_id: '1',
      username: 'client1',
      password: 'client123',
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
      is_active: 'true',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  Customers: [
    {
      id: '1',
      company_id: '1',
      name: 'Ramesh Kumar',
      phone: '+91 98401 23456',
      email: 'ramesh.k@gmail.com',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      created_by: '2',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      company_id: '1',
      name: 'Priya Sharma',
      phone: '+91 97910 87654',
      email: 'priya.sharma@yahoo.com',
      city: 'Chennai',
      state: 'Tamil Nadu',
      created_by: '2',
      created_at: new Date().toISOString(),
    },
  ],
  Invoices: [
    {
      id: '1',
      company_id: '1',
      invoice_number: 'MOB-1001',
      customer_name: 'Ramesh Kumar',
      customer_phone: '+91 98401 23456',
      device_model: 'Redmi Note 12 Pro',
      issue_reported: 'Display combo touch broken',
      repair_status: 'Ready for Pickup',
      invoice_date: new Date().toISOString().split('T')[0],
      subtotal: '1650.00',
      tax_amount: '0.00',
      total: '1650.00',
      status: 'paid',
      payment_mode: 'Cash',
      created_by: '2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  InvoiceItems: [],
  ServiceOrders: [],
  Products: [],
  Payments: [],
  Expenses: [],
  Settings: [
    { id: '1', key: 'invoice_prefix', value: 'MOB-', category: 'invoice' },
    { id: '2', key: 'invoice_next_number', value: '1002', category: 'invoice' },
    { id: '3', key: 'currency', value: 'INR', category: 'general' },
    { id: '4', key: 'currency_symbol', value: '₹', category: 'general' },
  ],
};

function loadLocalStore() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Error reading local db.json, initializing defaults:', err.message);
  }
  saveLocalStore(DEFAULT_SEED_DATA);
  return { ...DEFAULT_SEED_DATA };
}

function saveLocalStore(store) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing local db.json:', err.message);
  }
}

class GoogleSheetService {
  /**
   * Fetch all records for a sheet
   */
  async fetchSheet(sheetName) {
    const config = getConfig();
    const url = config.GOOGLE_SHEET_WEBAPP_URL;

    if (url && url.startsWith('http')) {
      try {
        const fetchUrl = `${url}?action=read&sheet=${encodeURIComponent(sheetName)}`;
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && Array.isArray(json.data)) {
            // Also keep local fallback updated
            const localStore = loadLocalStore();
            localStore[sheetName] = json.data;
            saveLocalStore(localStore);
            return json.data;
          }
        }
      } catch (err) {
        console.warn(`[GoogleSheetService] Error fetching ${sheetName} from Sheets API, using local backup:`, err.message);
      }
    }

    // Local fallback
    const localStore = loadLocalStore();
    return localStore[sheetName] || [];
  }

  /**
   * Append a row to sheet
   */
  async appendRow(sheetName, data) {
    const localStore = loadLocalStore();
    if (!localStore[sheetName]) localStore[sheetName] = [];

    // Ensure ID
    if (!data.id) {
      const maxId = localStore[sheetName].reduce((max, r) => Math.max(max, parseInt(r.id) || 0), 0);
      data.id = String(maxId + 1);
    }

    // Save to local backup first
    localStore[sheetName].push(data);
    saveLocalStore(localStore);

    // Sync to Google Sheet Web App if configured
    const config = getConfig();
    const url = config.GOOGLE_SHEET_WEBAPP_URL;
    if (url && url.startsWith('http')) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'append', sheet: sheetName, data }),
        });
      } catch (err) {
        console.warn(`[GoogleSheetService] Error appending to Sheets API:`, err.message);
      }
    }

    return data;
  }

  /**
   * Update an existing row
   */
  async updateRow(sheetName, id, updateData) {
    const localStore = loadLocalStore();
    const records = localStore[sheetName] || [];
    const idx = records.findIndex(r => String(r.id) === String(id));

    let updatedRecord = { ...updateData, id: String(id) };
    if (idx !== -1) {
      records[idx] = { ...records[idx], ...updateData };
      updatedRecord = records[idx];
      saveLocalStore(localStore);
    }

    // Sync to Google Sheet
    const config = getConfig();
    const url = config.GOOGLE_SHEET_WEBAPP_URL;
    if (url && url.startsWith('http')) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'update', sheet: sheetName, id: String(id), data: updateData }),
        });
      } catch (err) {
        console.warn(`[GoogleSheetService] Error updating on Sheets API:`, err.message);
      }
    }

    return updatedRecord;
  }

  /**
   * Delete a row by ID
   */
  async deleteRow(sheetName, id) {
    const localStore = loadLocalStore();
    const records = localStore[sheetName] || [];
    localStore[sheetName] = records.filter(r => String(r.id) !== String(id));
    saveLocalStore(localStore);

    // Sync to Google Sheet
    const config = getConfig();
    const url = config.GOOGLE_SHEET_WEBAPP_URL;
    if (url && url.startsWith('http')) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'delete', sheet: sheetName, id: String(id) }),
        });
      } catch (err) {
        console.warn(`[GoogleSheetService] Error deleting on Sheets API:`, err.message);
      }
    }

    return { success: true, id };
  }

  /**
   * Test connection to Google Apps Script Web App
   */
  async testConnection(targetUrl) {
    const url = targetUrl || getConfig().GOOGLE_SHEET_WEBAPP_URL;
    if (!url) {
      return { success: false, error: 'No Google Sheet Web App URL configured' };
    }

    const startTime = Date.now();
    try {
      const pingUrl = `${url}?action=ping`;
      const res = await fetch(pingUrl);
      const elapsed = Date.now() - startTime;

      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          latency: elapsed,
          message: json.message || 'Connected successfully to Google Sheet Web App!',
          spreadsheet: json.spreadsheet || 'Active Google Spreadsheet',
        };
      }
      return { success: false, error: `Google Sheets returned HTTP status ${res.status}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new GoogleSheetService();
