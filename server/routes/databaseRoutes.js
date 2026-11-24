const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../config');
const googleSheetService = require('../services/googleSheetService');
const { authenticateJWT, requireAdmin } = require('../middleware/auth');

/**
 * All routes here require Admin JWT authentication
 */
router.use(authenticateJWT);
router.use(requireAdmin);

/**
 * GET /api/database/config
 * Retrieve current Google Sheets configuration
 */
router.get('/config', async (req, res) => {
  const config = getConfig();
  const isConfigured = Boolean(config.GOOGLE_SHEET_WEBAPP_URL);
  
  let pingResult = null;
  if (isConfigured) {
    pingResult = await googleSheetService.testConnection(config.GOOGLE_SHEET_WEBAPP_URL);
  }

  return res.json({
    success: true,
    webAppUrl: config.GOOGLE_SHEET_WEBAPP_URL,
    isConfigured,
    status: pingResult?.success ? 'connected' : (isConfigured ? 'error' : 'offline'),
    details: pingResult,
  });
});

/**
 * POST /api/database/config
 * Save new Google Sheet Web App URL
 */
router.post('/config', async (req, res) => {
  try {
    const { webAppUrl } = req.body;
    const cleanUrl = String(webAppUrl || '').trim();

    if (!cleanUrl) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Google Sheet Web App URL.',
      });
    }

    if (!cleanUrl.startsWith('https://script.google.com/')) {
      return res.status(400).json({
        success: false,
        error: 'URL must start with https://script.google.com/...',
      });
    }

    // Save to server config
    saveConfig({ GOOGLE_SHEET_WEBAPP_URL: cleanUrl });

    // Test connection
    const testResult = await googleSheetService.testConnection(cleanUrl);

    return res.json({
      success: true,
      message: 'Google Sheet Web App URL saved successfully on secure API server!',
      testResult,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/database/test
 * Test connection to a URL
 */
router.post('/test', async (req, res) => {
  try {
    const { webAppUrl } = req.body;
    const targetUrl = (webAppUrl || getConfig().GOOGLE_SHEET_WEBAPP_URL || '').trim();

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'No Google Sheet Web App URL provided to test.',
      });
    }

    const result = await googleSheetService.testConnection(targetUrl);
    return res.json({
      success: result.success,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
