import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import db, { SHEET_NAMES } from '../services/googleSheets';
import { BUSINESS_PRESETS } from '../utils/presets';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  business_type: 'mobile_service',
  company_name: 'Sai Ram Mobile Care & Service Center',
  company_email: 'service@sairammobile.in',
  company_phone: '+91 98765 43210',
  company_address: 'Shop No. 14, Ground Floor, City Mobile Complex, 1st Cross, Market Road',
  company_website: 'www.sairammobile.in',
  company_tagline: 'Smartphone Display, Battery & Motherboard Specialists',
  company_logo: '',
  primary_color: '#2563eb',
  currency: 'INR',
  currency_symbol: '₹',
  tax_name: 'GST (18%)',
  default_tax_rate: '18',
  tax_id: 'GSTIN: 33AAAAA0000A1Z5',
  upi_id: 'sairammobile@upi',
  state_name: 'Tamil Nadu',
  state_code: '33',
  invoice_prefix: 'MOB-',
  invoice_next_number: '1006',
  payment_terms: 'Due on Delivery',
  default_notes: 'Thank you for choosing Sai Ram Mobile Care! Please keep this bill safe for warranty claims.',
  default_terms: '1. 90 Days warranty on Display Combo Touch replacement only.\n2. Physical break, line, or water damage completely voids warranty.\n3. 6 Months warranty on original battery replacement.\n4. Customers are requested to take data backup. Shop is not responsible for data loss.\n5. Delivery of the device will be made strictly upon presentation of this original bill.',
  enable_device_fields: 'true',
  enable_grocery_fields: 'false',
  catalog_admin_only: 'false',
  allow_custom_price: 'true',
  allow_custom_items: 'true',
  allow_user_discounts: 'true',
  max_discount_percent: '10',
  default_invoice_layout: 'standard_a4',
  thermal_paper_width: '80mm',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const allSettings = await db.getSettings();
      let needsPersist = false;
      
      // Auto-migrate any legacy "Vertex Invoicing Corp" or USD references
      if (allSettings.company_name === 'Vertex Invoicing Corp' || !allSettings.company_name) {
        allSettings.company_name = 'Sai Ram Mobile Care & Service Center';
        needsPersist = true;
      }
      if (allSettings.company_tagline === 'Enterprise Invoicing & Financial Operations' || !allSettings.company_tagline) {
        allSettings.company_tagline = 'Smartphone Display, Battery & Motherboard Specialists';
        needsPersist = true;
      }
      if (allSettings.currency !== 'INR' || allSettings.currency_symbol !== '₹') {
        allSettings.currency = 'INR';
        allSettings.currency_symbol = '₹';
        needsPersist = true;
      }
      if (allSettings.business_type !== 'mobile_service') {
        allSettings.business_type = 'mobile_service';
        needsPersist = true;
      }
      if (allSettings.allow_custom_items !== 'true') {
        allSettings.allow_custom_items = 'true';
        needsPersist = true;
      }
      if (allSettings.allow_custom_price !== 'true') {
        allSettings.allow_custom_price = 'true';
        needsPersist = true;
      }

      if (needsPersist) {
        try {
          await db.updateSetting('company_name', allSettings.company_name);
          await db.updateSetting('company_tagline', allSettings.company_tagline);
          await db.updateSetting('currency', 'INR');
          await db.updateSetting('currency_symbol', '₹');
          await db.updateSetting('business_type', 'mobile_service');
          await db.updateSetting('allow_custom_items', 'true');
          await db.updateSetting('allow_custom_price', 'true');
        } catch (e) {
          console.warn('Could not auto-persist migrated settings:', e);
        }
      }

      setSettings(prev => ({ ...prev, ...allSettings }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = useCallback(async (key, value) => {
    try {
      await db.updateSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to update setting:', error);
      throw error;
    }
  }, []);

  const updateMultipleSettings = useCallback(async (settingsObj) => {
    try {
      for (const [key, value] of Object.entries(settingsObj)) {
        await db.updateSetting(key, String(value));
      }
      setSettings(prev => ({ ...prev, ...settingsObj }));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }, []);

  const applyPreset = useCallback(async (presetKey, replaceProducts = true) => {
    const preset = BUSINESS_PRESETS[presetKey];
    if (!preset) return;
    try {
      await updateMultipleSettings(preset.settings);
      
      if (replaceProducts && preset.sampleProducts?.length) {
        // Clear existing products and load preset products
        const existingProducts = await db.fetchSheet(SHEET_NAMES.PRODUCTS);
        for (const p of existingProducts) {
          if (p.id) await db.deleteRow(SHEET_NAMES.PRODUCTS, p.id);
        }
        const now = new Date().toISOString();
        for (const p of preset.sampleProducts) {
          await db.appendRow(SHEET_NAMES.PRODUCTS, {
            ...p,
            created_by: '1',
            created_at: now,
            updated_at: now,
          });
        }
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
      throw error;
    }
  }, [updateMultipleSettings]);

  const value = {
    settings,
    loading,
    updateSetting,
    updateMultipleSettings,
    applyPreset,
    refreshSettings: loadSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default SettingsContext;
