/**
 * Central API Client for making JWT-authenticated calls to the backend API layer
 */

const API_BASE_URL = '/api';
const TOKEN_KEY = 'invoice_app_jwt_token';

class ApiClient {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers = this.getHeaders(options.headers);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiry or unauthorized
    if (response.status === 401) {
      this.clearToken();
      localStorage.removeItem('invoice_app_session');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body || {}),
      ...options,
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body || {}),
      ...options,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }
}

const apiClient = new ApiClient();
export default apiClient;
