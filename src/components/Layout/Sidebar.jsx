import React, { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  LayoutDashboard, Users, Wrench, FileText, Settings, Database,
  LogOut, ChevronLeft, ChevronRight, Smartphone, Plus,
  ShieldAlert, History, Clock, UserCog, Building
} from 'lucide-react';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin, isClient, currentCompany } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Strictly separated roles:
  // Admin manages client accounts and Google Sheet DB connection
  // Client has the simplified 5 shop pages
  const navItems = isAdmin
    ? [
        { path: '/users', icon: UserCog, label: 'Client Accounts' },
        { path: '/admin/database', icon: Database, label: 'Google Sheet DB' },
      ]
    : [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/services', icon: Wrench, label: 'Customer Service' },
        { path: '/invoices', icon: FileText, label: 'Invoice & Bill Generation' },
        { path: '/history', icon: History, label: 'History & Records' },
        { divider: true },
        { path: '/settings', icon: Settings, label: 'Settings' },
      ];

  const shopName = isAdmin
    ? 'Software Licensing Hub'
    : (user?.company_name || currentCompany?.name || 'Sai Ram Mobile Care');

  const shopTagline = isAdmin
    ? 'Admin & Client Manager'
    : `${user?.city || currentCompany?.city || 'HQ'} • ${user?.gstin ? 'GSTIN Active' : 'Invoice & Repair'}`;

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-slate-800 h-screen flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0 z-30`}>
      {/* Brand Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'px-4'} h-16 border-b border-slate-800 bg-slate-950/60`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 border border-blue-400/30">
            {isAdmin ? <ShieldAlert className="w-5 h-5 text-white" /> : <Smartphone className="w-5 h-5 text-white" />}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-bold text-xs tracking-tight truncate leading-tight" title={shopName}>
                {shopName}
              </h1>
              <p className="text-blue-300/80 text-[10px] font-medium truncate flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse"></span>
                <span className="truncate">{shopTagline}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-5 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors z-40 shadow-md cursor-pointer hover:bg-slate-700"
        title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Quick Action Button */}
      <div className="p-3">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              navigate('/users?action=new');
              window.dispatchEvent(new CustomEvent('open-client-modal'));
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer ${
              collapsed ? 'px-2' : ''
            }`}
            title="Register New Client Account"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Add New Client</span>}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              navigate('/services');
              window.dispatchEvent(new CustomEvent('open-service-modal'));
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer ${
              collapsed ? 'px-2' : ''
            }`}
            title="Create New Service Job Card"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>New Service Job</span>}
          </button>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-1 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item, index) => {
            if (item.divider) {
              return <li key={`div-${index}`} className="my-1.5 border-t border-white/10" />;
            }
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group text-xs ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Footer */}
      <div className={`border-t border-white/10 p-3 bg-slate-950/30 ${collapsed ? 'px-2' : ''}`}>
        <NavLink
          to={isAdmin ? '/users' : '/profile'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 mb-1.5 ${
              isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`
          }
          title={collapsed ? user?.full_name : undefined}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ring-2 ring-blue-500/30"
            style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400">
                {isAdmin ? '👑 Software Seller (Admin)' : '👤 Client User'}
              </p>
            </div>
          )}
        </NavLink>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full text-xs font-medium ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
