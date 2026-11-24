import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Wrench, FileText, History, Settings,
  UserCog, Database
} from 'lucide-react';

export default function MobileBottomNav() {
  const { isAdmin } = useAuth();

  const navItems = isAdmin
    ? [
        { path: '/users', icon: UserCog, label: 'Clients' },
        { path: '/admin/database', icon: Database, label: 'Sheet DB' },
      ]
    : [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
        { path: '/services', icon: Wrench, label: 'Service' },
        { path: '/invoices', icon: FileText, label: 'Billing' },
        { path: '/history', icon: History, label: 'History' },
        { path: '/settings', icon: Settings, label: 'Settings' },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-blue-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
