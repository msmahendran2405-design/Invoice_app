import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import authService from '../services/authService';
import apiClient from '../services/apiClient';
import db, { SHEET_NAMES } from '../services/googleSheets';

const AuthContext = createContext(null);
const ACTIVE_COMPANY_KEY = 'invoice_active_company_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState('1');

  const loadCompanies = useCallback(async () => {
    try {
      const data = await db.fetchSheet(SHEET_NAMES.COMPANIES);
      const valid = data.filter(c => c.id && c.is_active !== 'false');
      setCompanies(valid);
      return valid;
    } catch (err) {
      console.warn('Failed to fetch companies:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    // Check for existing session and verify JWT token exists
    const token = apiClient.getToken();
    const currentUser = authService.getCurrentUser();

    if (currentUser && !token) {
      // Legacy session without JWT token: clear it so user logs in cleanly with a JWT token
      authService.logout();
      setUser(null);
    } else if (currentUser && token) {
      setUser(currentUser);
    } else {
      setUser(null);
    }

    const savedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
    if (savedCompanyId) {
      setActiveCompanyId(savedCompanyId);
    } else if (currentUser?.company_id) {
      setActiveCompanyId(currentUser.company_id);
    }

    loadCompanies().finally(() => {
      setLoading(false);
    });
  }, [loadCompanies]);

  useEffect(() => {
    const handleUnauthorized = () => {
      authService.logout();
      setUser(null);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const switchCompany = useCallback((companyId) => {
    setActiveCompanyId(String(companyId));
    localStorage.setItem(ACTIVE_COMPANY_KEY, String(companyId));
  }, []);

  const login = useCallback(async (username, password) => {
    const loggedInUser = await authService.login(username, password);
    const sessionUser = { ...loggedInUser };
    delete sessionUser.password_hash;
    setUser(sessionUser);

    if (sessionUser.company_id) {
      setActiveCompanyId(String(sessionUser.company_id));
      localStorage.setItem(ACTIVE_COMPANY_KEY, String(sessionUser.company_id));
    }
    await loadCompanies();
    return sessionUser;
  }, [loadCompanies]);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const updateCurrentUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
    authService.saveSession({ ...user, ...userData });
  }, [user]);

  const isSuperAdmin = user?.username === 'admin@invoice.com' || user?.role === 'superadmin';
  const isAdmin = isSuperAdmin || user?.role === 'admin' || user?.role === 'company_admin';
  const isClient = user?.role === 'client';

  const clientCompany = (user?.role === 'client' && user?.company_name) ? {
    id: user.id || 'client',
    name: user.company_name,
    gstin: user.gstin || '',
    address: user.address || '',
    city: user.city || '',
    state: user.state || 'Tamil Nadu',
    state_code: '33',
    upi_id: user.upi_id || '',
    phone: user.phone || '',
    email: user.email || '',
    invoice_prefix: user.invoice_prefix || 'MOB-',
    currency: 'INR',
    currency_symbol: '₹',
  } : null;

  const currentCompany = clientCompany ||
    companies.find(c => String(c.id) === String(activeCompanyId)) ||
    companies[0] || {
      id: '1',
      name: 'Sai Ram Mobile Care & Service Center',
      gstin: '33AAAAA0000A1Z5',
      state: 'Tamil Nadu',
      state_code: '33',
      city: 'Coimbatore',
      pincode: '641012',
      phone: '+91 98765 43210',
      email: 'service@sairammobile.in',
      invoice_prefix: 'MOB-',
      currency: 'INR',
      currency_symbol: '₹',
    };

  const value = {
    user,
    loading,
    login,
    logout,
    updateCurrentUser,
    companies,
    currentCompany,
    activeCompanyId,
    switchCompany,
    loadCompanies,
    isSuperAdmin,
    isAdmin,
    isClient,
    isAuthenticated: !!user && !!apiClient.getToken(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
