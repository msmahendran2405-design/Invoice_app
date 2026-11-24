/**
 * =========================================================================
 * GOOGLE APPS SCRIPT FOR MULTI-COMPANY INVOICE & SERVICE MANAGEMENT ERP
 * =========================================================================
 * 
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet (https://sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Replace all code in the editor with this script
 * 4. Click the blue "Deploy" button at top right > "New deployment"
 * 5. Select type: "Web app"
 *    - Description: "Invoice ERP Database"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Click "Deploy", authorize permissions, and copy the Web App URL!
 * 7. Paste that Web App URL in your Admin Database API page!
 */

const SHEET_COLUMNS = {
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

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const cols = SHEET_COLUMNS[sheetName] || ['id', 'created_at'];
    sheet.appendRow(cols);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const params = e ? e.parameter || {} : {};
  const action = params.action || '';
  const sheetName = params.sheet || '';

  // Ping / healthcheck action
  if (action === 'ping' || !sheetName) {
    return responseJSON({
      status: 'success',
      message: 'Google Sheets Database API connected successfully!',
      spreadsheet: ss.getName()
    });
  }

  try {
    const sheet = getOrCreateSheet(ss, sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return responseJSON({ status: 'success', sheet: sheetName, count: 0, data: [] });
    }

    const headers = data[0];
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && row[0] !== 0) continue;
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = row[idx] !== undefined ? String(row[idx]) : '';
      });
      records.push(item);
    }

    return responseJSON({ status: 'success', sheet: sheetName, count: records.length, data: records });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const contents = e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(contents);
    const action = payload.action;
    const sheetName = payload.sheet;
    const sheet = getOrCreateSheet(ss, sheetName);
    const cols = SHEET_COLUMNS[sheetName] || [];

    if (action === 'append') {
      const item = payload.data || {};
      const rowValues = cols.map(c => item[c] !== undefined ? item[c] : '');
      sheet.appendRow(rowValues);
      return responseJSON({ status: 'success', action: 'append', id: item.id });
    }

    if (action === 'update') {
      const id = String(payload.id);
      const updateData = payload.data || {};
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === id) {
          const rowNumber = i + 1;
          headers.forEach((h, colIdx) => {
            if (updateData[h] !== undefined) {
              sheet.getRange(rowNumber, colIdx + 1).setValue(updateData[h]);
            }
          });
          return responseJSON({ status: 'success', action: 'update', id });
        }
      }
      return responseJSON({ status: 'not_found', id });
    }

    if (action === 'delete') {
      const id = String(payload.id);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === id) {
          sheet.deleteRow(i + 1);
          return responseJSON({ status: 'success', action: 'delete', id });
        }
      }
      return responseJSON({ status: 'not_found', id });
    }

    return responseJSON({ status: 'unknown_action', action });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
