const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG_FILE_PATH = path.join(__dirname, 'data', 'config.json');

const defaultConfig = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'invoice_app_jwt_super_secret_key_2026_secure',
  JWT_EXPIRES_IN: '7d',
  GOOGLE_SHEET_WEBAPP_URL: process.env.GOOGLE_SHEET_WEBAPP_URL || '',
};

function loadStoredConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...defaultConfig, ...parsed };
    }
  } catch (err) {
    console.warn('Error reading config.json, using defaults:', err.message);
  }
  return { ...defaultConfig };
}

let activeConfig = loadStoredConfig();

function saveConfig(newConfig) {
  activeConfig = { ...activeConfig, ...newConfig };
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(activeConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write config.json:', err.message);
  }
  return activeConfig;
}

module.exports = {
  getConfig: () => activeConfig,
  saveConfig,
};
