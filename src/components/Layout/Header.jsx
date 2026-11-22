import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { BUSINESS_PRESETS } from '../../utils/presets';
import { Bell, Search, ShieldCheck, Plus, Smartphone, IndianRupee } from 'lucide-react';

const pageTitles = {
  '/dashboard': 'Dashboard — Day, Week & Month Tracker',
  '/invoices': 'Bill History & Status Tracking',
  '/invoices/new': 'Generate Bill / Phone Service Intake',
  '/customers': 'Customer Service History',
  '/products': 'Devices, Accessories & Repair Catalog',
  '/reports': 'Sales & GST Reports',
  '/settings': 'Shop Profile & GST Settings',
  '/profile': 'User Profile',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const activePreset = BUSINESS_PRESETS[settings.business_type];

  const getPageTitle = () => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname];
    for (const [path, title] of Object.entries(pageTitles)) {
      if (location.pathname.startsWith(path)) return title;
    }
    return 'Dashboard';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getAdminTitle = () => {
    if (location.pathname.startsWith('/database')) return 'Google Sheets Central Database Management';
    return 'Client Accounts & Licensing';
  };

  const getAdminSubtitle = () => {
    if (location.pathname.startsWith('/database')) return 'Software Owner Portal • Google Apps Script Cloud Engine';
    return 'Software Owner Portal • Create & Manage Clients';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight truncate">
            {isAdmin ? getAdminTitle() : getPageTitle()}
          </h2>
          {!isAdmin && location.pathname === '/dashboard' && (
            <p className="text-xs text-gray-500 truncate">{getGreeting()}, {user?.full_name?.split(' ')[0]}! 👋</p>
          )}
          {isAdmin && (
            <p className="text-xs text-purple-600 font-medium">{getAdminSubtitle()}</p>
          )}
        </div>
        {!isAdmin && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Service</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span>🇮🇳 ₹ INR Active</span>
            </span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3 flex-shrink-0">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              navigate('/users?action=new');
              window.dispatchEvent(new CustomEvent('open-client-modal'));
            }}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Client</span>
          </button>
        ) : (
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Bill</span>
          </Link>
        )}

        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
          isAdmin
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {isAdmin ? '👑 Admin (Seller)' : '👤 Client (Shop)'}
        </span>

        {/* Date (Indian Locale) */}
        <div className="hidden lg:block text-right border-l border-gray-200 pl-3">
          <p className="text-xs font-semibold text-gray-800">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </header>
  );
}
