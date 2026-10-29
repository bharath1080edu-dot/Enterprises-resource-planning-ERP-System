import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, Loader, Package, ShoppingCart, CreditCard, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const TYPE_CONFIG = {
  'Low Stock':       { icon: Package,       color: 'text-red-500',    bg: 'bg-red-50',    badge: 'badge-red'    },
  'Delayed Order':   { icon: ShoppingCart,  color: 'text-orange-500', bg: 'bg-orange-50', badge: 'badge-orange' },
  'Pending Payment': { icon: CreditCard,    color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'badge-yellow' },
  'Employee Absent': { icon: Users,         color: 'text-blue-500',   bg: 'bg-blue-50',   badge: 'badge-navy'   },
  'General':         { icon: Bell,          color: 'text-slate-500',  bg: 'bg-slate-50',  badge: 'badge-gray'   },
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
    } catch { toast.error('Failed to load notifications.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { toast.error('Failed to mark as read.'); }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read.');
    } catch { toast.error('Failed.'); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification dismissed.');
    } catch { toast.error('Failed to delete.'); }
  };

  const FILTERS = ['All', 'Unread', ...Object.keys(TYPE_CONFIG)];
  const filtered = notifications.filter(n => {
    if (filter === 'Unread') return !n.is_read;
    if (filter !== 'All') return n.type === filter;
    return true;
  });
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread · {notifications.length} total</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-outline gap-2">
            <CheckCheck size={16} /> Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-400'}`}>
            {f}
            {f === 'Unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader size={28} className="animate-spin text-navy-800" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500 font-medium">No notifications</p>
          <p className="text-slate-400 text-sm mt-1">You're all caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG['General'];
            const IconComp = config.icon;
            return (
              <div key={notif.id}
                className={`card flex items-start gap-4 transition-all ${!notif.is_read ? 'border-l-4 border-orange-500' : 'opacity-70'}`}>
                <div className={`${config.bg} rounded-xl p-2.5 flex-shrink-0`}>
                  <IconComp size={18} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={config.badge}>{notif.type}</span>
                    {!notif.is_read && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                  </div>
                  <p className="text-sm text-navy-800 font-medium">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(notif.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <button onClick={() => markRead(notif.id)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Mark as read">
                      <CheckCheck size={14} />
                    </button>
                  )}
                  <button onClick={() => remove(notif.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Dismiss">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
