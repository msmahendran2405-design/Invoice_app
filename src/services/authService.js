/**
 * Authentication Service
 * Handles user login, registration, and session management.
 * Passwords are hashed using a simple hash for localStorage mode.
 */

import db, { SHEET_NAMES } from './googleSheets';
import apiClient from './apiClient';

const AUTH_SESSION_KEY = 'invoice_app_session';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.loadSession();
  }

  // Simple hash function for password (bcryptjs would be used in production)
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'hash_' + Math.abs(hash).toString(36);
  }

  loadSession() {
    try {
      const session = localStorage.getItem(AUTH_SESSION_KEY);
      if (session) {
        this.currentUser = JSON.parse(session);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  saveSession(user) {
    const sessionUser = { ...user };
    delete sessionUser.password_hash;
    this.currentUser = sessionUser;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser));
  }

  clearSession() {
    this.currentUser = null;
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  isAdmin() {
    return this.currentUser?.role === 'admin' || this.currentUser?.username === 'admin@invoice.com';
  }

  isClient() {
    return this.currentUser?.role === 'client';
  }

  async login(username, password) {
    try {
      const res = await apiClient.post('/auth/login', { username, password });
      if (res && res.token) {
        apiClient.setToken(res.token);
      }
      if (res && res.user) {
        this.saveSession(res.user);
        return res.user;
      }
    } catch (apiErr) {
      console.warn('API login failed, checking fallback:', apiErr.message);
      // If server unreachable or error, try local check as graceful offline fallback
      try {
        const users = await db.fetchSheet(SHEET_NAMES.USERS);
        const cleanUsername = (username || '').trim().toLowerCase();
        const user = users.find(u => 
          (u.username?.toLowerCase() === cleanUsername || u.email?.toLowerCase() === cleanUsername) && 
          u.is_active !== 'false'
        );
        if (user) {
          const defaultPasswords = {
            'admin@invoice.com': 'mahendran@123',
            admin: 'mahendran@123',
            client1: 'client123',
          };
          if (
            (defaultPasswords[user.username] && password === defaultPasswords[user.username]) ||
            (defaultPasswords[cleanUsername] && password === defaultPasswords[cleanUsername]) ||
            user.password === password
          ) {
            this.saveSession(user);
            return user;
          }
        }
      } catch (fbErr) {
        // Fall through
      }
      throw new Error(apiErr.message || 'Invalid username or password');
    }
    throw new Error('Invalid username or password');
  }

  logout() {
    apiClient.clearToken();
    this.clearSession();
  }

  async register(userData) {
    const users = await db.fetchSheet(SHEET_NAMES.USERS);
    
    // Check if username exists
    if (users.find(u => u.username === userData.username)) {
      throw new Error('Username already exists');
    }

    // Check if email exists
    if (userData.email && users.find(u => u.email === userData.email)) {
      throw new Error('Email already exists');
    }

    const now = new Date().toISOString();
    const avatarColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    
    const newUser = {
      username: userData.username,
      password_hash: this.simpleHash(userData.password),
      role: userData.role || 'client',
      full_name: userData.full_name || userData.username,
      email: userData.email || '',
      phone: userData.phone || '',
      company_name: userData.company_name || 'My Mobile Service Center',
      gstin: userData.gstin || '',
      address: userData.address || '',
      city: userData.city || '',
      state: userData.state || 'Tamil Nadu',
      upi_id: userData.upi_id || '',
      invoice_prefix: userData.invoice_prefix || 'MOB-',
      subscription_valid_until: userData.subscription_valid_until || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      avatar_color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
      is_active: 'true',
      created_at: now,
      updated_at: now,
    };

    return await db.appendRow(SHEET_NAMES.USERS, newUser);
  }

  async updateUser(id, userData) {
    const updateData = { ...userData, updated_at: new Date().toISOString() };
    
    if (userData.password) {
      updateData.password_hash = this.simpleHash(userData.password);
      delete updateData.password;
    }

    return await db.updateRow(SHEET_NAMES.USERS, id, updateData);
  }

  async changePassword(userId, oldPassword, newPassword) {
    const users = await db.fetchSheet(SHEET_NAMES.USERS);
    const user = users.find(u => String(u.id) === String(userId));
    
    if (!user) throw new Error('User not found');

    // Verify old password
    if (user.password_hash !== '$2a$10$defaulthash') {
      const oldHash = this.simpleHash(oldPassword);
      if (user.password_hash !== oldHash) {
        throw new Error('Current password is incorrect');
      }
    }

    const newHash = this.simpleHash(newPassword);
    await db.updateRow(SHEET_NAMES.USERS, userId, {
      ...user,
      password_hash: newHash,
      updated_at: new Date().toISOString(),
    });

    return true;
  }

  async getAllUsers() {
    return await db.fetchSheet(SHEET_NAMES.USERS);
  }

  async deleteUser(id) {
    return await db.deleteRow(SHEET_NAMES.USERS, id);
  }

  logout() {
    this.clearSession();
  }
}

const authService = new AuthService();
export default authService;
