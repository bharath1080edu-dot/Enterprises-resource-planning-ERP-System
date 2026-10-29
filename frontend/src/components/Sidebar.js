import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VISIBLE_ROUTES } from '../utils/permissions';
import api from '../api/axios';
import {
  LayoutDashboard, Package, ShoppingCart, Factory, Users,
  Clock, CreditCard, BarChart3, Bell, ChevronLeft, ChevronRight,
  LogOut, X, MessageSquare
} from 'lucide-react';

const ALL_NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/inventory',     icon: Package,         label: 'Inventory'     },
  { to: '/orders',        icon: ShoppingCart,    label: 'Orders'        },
  { to: '/production',    icon: Factory,         label: 'Production'    },
  { to: '/employees',     icon: Users,           label: 'Employees'     },
  { to: '/attendance',    icon: Clock,           label: 'Attendance'    },
  { to: '/payments',      icon: CreditCard,      label: 'Payments'      },
  { to: '/reports',       icon: BarChart3,       label: 'Reports'       },
  { to: '/notifications', icon: Bell,            label: 'Notifications' },
];

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Fetch live WhatsApp status for the sidebar indicator
  const [waConnected, setWaConnected] = useState(null); // null=unknown, true=connected, false=disconnected

  const isAdmin = user?.role === 'Admin';
  const allowedRoutes = VISIBLE_ROUTES[user?.role] || [];

  useEffect(() => {
    if (!isAdmin) return;
    const check = () =>
      api.get('/whatsapp/status')
        .then(r => setWaConnected(r.data?.data?.connected ?? false))
        .catch(() => setWaConnected(false));
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => allowedRoutes.includes(item.to));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-navy-700/50">
        <div className="w-9 h-9 rounded-lg bg-white shadow flex items-center justify-center flex-shrink-0 p-1 overflow-hidden">
          <img src="/ic-logo.png" alt="IC" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight">Image Creator</p>
            <p className="text-orange-400 text-xs font-medium">UPVC Products & Interiors</p>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-navy-400 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
            Main Menu
          </p>
        )}
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen?.(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <div className="relative flex-shrink-0">
              <Icon size={18} />
            </div>
            {!collapsed && <span className="flex-1">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── WhatsApp System Section (Admin only) ──────────── */}
      {isAdmin && (
        <div className={`px-3 pb-2 ${!collapsed ? 'space-y-1' : ''}`}>
          {!collapsed && (
            <p className="text-navy-400 text-xs font-semibold uppercase tracking-wider px-2 mb-1">
              System
            </p>
          )}
          <NavLink
            to="/whatsapp"
            onClick={() => setMobileOpen?.(false)}
            title={collapsed ? 'WhatsApp Notifications' : undefined}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''} relative group`
            }
          >
            {/* WhatsApp green icon */}
            <div className="relative flex-shrink-0">
              <MessageSquare size={18} className="text-[#25D366]" />
              {/* Live status dot */}
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#1B2A4A] ${
                waConnected === true  ? 'bg-green-400' :
                waConnected === false ? 'bg-red-400'   : 'bg-yellow-400'
              } ${waConnected === true ? 'animate-pulse' : ''}`} />
            </div>
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span>WhatsApp</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  waConnected === true  ? 'bg-green-500/20 text-green-300' :
                  waConnected === false ? 'bg-red-500/20 text-red-300'     : 'bg-yellow-500/20 text-yellow-300'
                }`}>
                  {waConnected === true ? 'LIVE' : waConnected === false ? 'OFF' : '...'}
                </span>
              </div>
            )}
          </NavLink>
        </div>
      )}

      {/* Divider before user profile */}
      <div className="mx-3 border-t border-navy-700/30" />
      <div className="border-t border-navy-700/50 p-3">
        <div className={`flex items-center gap-3 p-2 rounded-lg hover:bg-navy-700/50 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.name || 'User'}</p>
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                user?.role === 'Admin' ? 'bg-orange-500 text-white' :
                user?.role === 'Manager' ? 'bg-blue-500 text-white' :
                'bg-navy-600 text-navy-300'
              }`}>{user?.role || 'Employee'}</span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-navy-400 hover:text-red-400 transition-colors p-1 rounded"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={logout}
            className="w-full flex justify-center mt-1 text-navy-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-navy-700/50"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-brand-gradient transition-all duration-300 ease-in-out flex-shrink-0 relative
          ${collapsed ? 'w-16' : 'w-64'}`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-orange-600 transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-brand-gradient flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-navy-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
