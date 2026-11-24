const express = require('express');
const router = express.Router();
const googleSheetService = require('../services/googleSheetService');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');

// Public sheets that can be read before login (e.g. app branding, currency, shop directory)
const PUBLIC_READ_SHEETS = ['Settings', 'Companies'];

/**
 * GET /api/data/next-invoice-number
 * Atomically generates next invoice number (Requires JWT)
 */
router.get('/next-invoice-number', authenticateJWT, async (req, res) => {
  try {
    const settings = await googleSheetService.fetchSheet('Settings');
    const userCompanyId = String(req.user.companyId || '1');

    // Find company specific prefix or default
    const prefixSetting = settings.find(s => s.key === `invoice_prefix_${userCompanyId}`) ||
                          settings.find(s => s.key === 'invoice_prefix');
    const prefix = prefixSetting ? prefixSetting.value : (req.user.invoice_prefix || 'MOB-');

    const nextSettingKey = `invoice_next_number_${userCompanyId}`;
    let nextSetting = settings.find(s => s.key === nextSettingKey) ||
                      settings.find(s => s.key === 'invoice_next_number');

    let nextNum = nextSetting ? parseInt(nextSetting.value) || 1001 : 1001;

    // Update counter for next bill
    if (nextSetting) {
      await googleSheetService.updateRow('Settings', nextSetting.id, {
        ...nextSetting,
        value: String(nextNum + 1),
        updated_at: new Date().toISOString(),
      });
    } else {
      await googleSheetService.appendRow('Settings', {
        key: nextSettingKey,
        value: String(nextNum + 1),
        category: 'invoice',
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      invoiceNumber: `${prefix}${nextNum}`,
      prefix,
      number: nextNum,
    });
  } catch (err) {
    console.error('Error generating invoice number:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/data/:sheet
 * Fetch records for a sheet with automatic multi-tenant isolation
 */
router.get('/:sheet', optionalAuth, async (req, res) => {
  try {
    const sheetName = req.params.sheet;
    const isPublic = PUBLIC_READ_SHEETS.includes(sheetName);

    // If sheet is private and user is not authenticated, reject with 401
    if (!isPublic && !req.user) {
      return res.status(401).json({
        success: false,
        error: `Authentication required to access ${sheetName}.`,
        code: 'NO_TOKEN',
      });
    }

    const records = await googleSheetService.fetchSheet(sheetName);

    // If Admin or reading public sheet without login, return records
    if (!req.user || req.user.role === 'admin' || sheetName === 'Settings') {
      return res.json({
        success: true,
        sheet: sheetName,
        count: records.length,
        data: records,
      });
    }

    // For Authenticated Client: Enforce Tenant Isolation
    const clientCompanyId = String(req.user.companyId || '1');
    const clientUserId = String(req.user.id);

    const filteredRecords = records.filter(item => {
      // Companies sheet: client sees only their company or active companies
      if (sheetName === 'Companies') {
        return String(item.id) === clientCompanyId;
      }

      // Match by company_id
      if (item.company_id && String(item.company_id) === clientCompanyId) {
        return true;
      }

      // Match by created_by user
      if (item.created_by && String(item.created_by) === clientUserId) {
        return true;
      }

      // Legacy records with no company_id: default company 1
      if (!item.company_id && clientCompanyId === '1') {
        return true;
      }

      return false;
    });

    return res.json({
      success: true,
      sheet: sheetName,
      count: filteredRecords.length,
      data: filteredRecords,
    });
  } catch (err) {
    console.error(`Error fetching sheet ${req.params.sheet}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/data/:sheet
 * Append a new record (strictly requires JWT)
 */
router.post('/:sheet', authenticateJWT, async (req, res) => {
  try {
    const sheetName = req.params.sheet;
    const incomingData = req.body || {};

    const now = new Date().toISOString();
    const dataToSave = {
      ...incomingData,
      created_at: incomingData.created_at || now,
      updated_at: now,
    };

    // Enforce Tenant Ownership
    if (req.user.role !== 'admin') {
      dataToSave.company_id = String(req.user.companyId || '1');
      dataToSave.created_by = String(req.user.id);
    } else {
      if (!dataToSave.company_id) {
        dataToSave.company_id = String(req.user.companyId || '1');
      }
      if (!dataToSave.created_by) {
        dataToSave.created_by = String(req.user.id);
      }
    }

    const saved = await googleSheetService.appendRow(sheetName, dataToSave);

    return res.json({
      success: true,
      sheet: sheetName,
      data: saved,
    });
  } catch (err) {
    console.error(`Error saving to sheet ${req.params.sheet}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/data/:sheet/:id
 * Update an existing record (strictly requires JWT and verifies ownership)
 */
router.put('/:sheet/:id', authenticateJWT, async (req, res) => {
  try {
    const sheetName = req.params.sheet;
    const recordId = req.params.id;
    const updateData = req.body || {};

    // Verify ownership if not admin
    if (req.user.role !== 'admin') {
      const records = await googleSheetService.fetchSheet(sheetName);
      const target = records.find(r => String(r.id) === String(recordId));

      if (target) {
        const targetCompany = String(target.company_id || '');
        const targetCreator = String(target.created_by || '');
        const clientCompany = String(req.user.companyId || '1');
        const clientUser = String(req.user.id);

        if (targetCompany !== clientCompany && targetCreator !== clientUser) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden. You do not have permission to modify this record.',
          });
        }
      }
    }

    const updated = await googleSheetService.updateRow(sheetName, recordId, {
      ...updateData,
      updated_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      sheet: sheetName,
      data: updated,
    });
  } catch (err) {
    console.error(`Error updating record ${req.params.id}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/data/:sheet/:id
 * Delete a record (strictly requires JWT and verifies ownership)
 */
router.delete('/:sheet/:id', authenticateJWT, async (req, res) => {
  try {
    const sheetName = req.params.sheet;
    const recordId = req.params.id;

    // Verify ownership if not admin
    if (req.user.role !== 'admin') {
      const records = await googleSheetService.fetchSheet(sheetName);
      const target = records.find(r => String(r.id) === String(recordId));

      if (target) {
        const targetCompany = String(target.company_id || '');
        const targetCreator = String(target.created_by || '');
        const clientCompany = String(req.user.companyId || '1');
        const clientUser = String(req.user.id);

        if (targetCompany !== clientCompany && targetCreator !== clientUser) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden. You do not have permission to delete this record.',
          });
        }
      }
    }

    const result = await googleSheetService.deleteRow(sheetName, recordId);

    return res.json({
      success: true,
      sheet: sheetName,
      ...result,
    });
  } catch (err) {
    console.error(`Error deleting record ${req.params.id}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
