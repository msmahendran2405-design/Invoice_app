import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Receipt, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    try {
      const loggedIn = await login(username.trim(), password);
      toast.success('Welcome back!');
      if (loggedIn?.role === 'admin' || loggedIn?.username === 'admin@invoice.com') {
        navigate('/users');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
            <Receipt className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Invoice Pro</h1>
          <p className="text-primary-200 text-sm">Professional Invoice Management System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter your username"
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* 2-Role Login Selection / Quick Fill */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Login Options</p>
              <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                2 Roles: Admin & Client
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { setUsername('admin@invoice.com'); setPassword('mahendran@123'); }}
                className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-medium text-left transition-all border border-blue-200 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">👑 Admin</span>
                  <span className="text-[10px] text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-100 font-mono truncate max-w-[90px]">admin@invoice.com</span>
                </div>
                <p className="text-[10px] text-blue-600/80 mt-1">Full control, DB & Clients</p>
              </button>

              <button
                type="button"
                onClick={() => { setUsername('client1'); setPassword('client123'); }}
                className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-medium text-left transition-all border border-emerald-200 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">👤 Client</span>
                  <span className="text-[10px] text-emerald-600 bg-white px-1.5 py-0.5 rounded border border-emerald-100 font-mono">client1</span>
                </div>
                <p className="text-[10px] text-emerald-600/80 mt-1">Billing & Service only</p>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              Admin creates and manages all client login credentials. Clients cannot edit master database or company setup.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-300 text-xs mt-6">
          © {new Date().getFullYear()} Invoice Pro • Secure Two-Role Management System
        </p>
      </div>
    </div>
  );
}
