import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const BREADCRUMB_MAP = {
  '/dashboard':      ['Dashboard'],
  '/inventory':      ['Dashboard', 'Inventory'],
  '/orders':         ['Dashboard', 'Orders'],
  '/production':     ['Dashboard', 'Production'],
  '/employees':      ['Dashboard', 'Employees'],
  '/attendance':     ['Dashboard', 'Attendance'],
  '/payments':       ['Dashboard', 'Payments'],
  '/reports':        ['Dashboard', 'Reports'],
  '/notifications':  ['Dashboard', 'Notifications'],
  '/whatsapp':       ['Dashboard', 'System', 'WhatsApp'],
};

const Navbar = ({ setMobileOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();
  const [unreadCount, setUnreadCount]   = useState(0);
  const [showProfile, setShowProfile]   = useState(false);

  const crumbs = BREADCRUMB_MAP[location.pathname] || ['Dashboard'];

  useEffect(() => {
    api.get('/notifications').then(r => setUnreadCount(r.data.unread_count || 0)).catch(() => {});
  }, [location.pathname]);

  return (
    <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
      {/* Left: Menu + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
        >
          <Menu size={20} />
        </button>
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              {idx > 0 && <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
              <span className={idx === crumbs.length - 1
                ? 'font-semibold text-navy-800 truncate'
                : 'text-slate-500 hover:text-navy-800 cursor-pointer'
              }>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(p => !p)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-navy-800 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-navy-800 leading-tight">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fade-in">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-navy-800">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <span className="badge-navy mt-1">{user?.role}</span>
              </div>
              <button
                onClick={() => { logout(); setShowProfile(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
