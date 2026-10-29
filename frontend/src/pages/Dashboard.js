import React, { useEffect, useState } from 'react';
import { ShoppingCart, Factory, Users, TrendingUp, TrendingDown, CreditCard, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatCard from '../components/StatCard';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#1B2A4A', '#F5A623', '#10b981', '#6366f1', '#f43f5e'];

const StatusBadge = ({ status }) => {
  const map = {
    'Pending':       'badge-yellow',
    'In Production': 'badge-navy',
    'Completed':     'badge-green',
    'Delivered':     'badge-green',
    'Cancelled':     'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats,        setStats]        = useState(null);
  const [salesTrend,   setSalesTrend]   = useState([]);
  const [prodTrend,    setProdTrend]    = useState([]);
  const [invUsage,     setInvUsage]     = useState([]);
  const [attSummary,   setAttSummary]   = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, sales, prod, inv, att, recent] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/sales-trend'),
          api.get('/dashboard/production-trend'),
          api.get('/dashboard/inventory-usage'),
          api.get('/dashboard/attendance-summary'),
          api.get('/dashboard/recent-orders'),
        ]);
        setStats(s.data.data);
        setSalesTrend(sales.data.data);
        setProdTrend(prod.data.data);
        setInvUsage(inv.data.data);
        setAttSummary(att.data.data);
        setRecentOrders(recent.data.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-navy-800 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const profitColor = (stats?.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-500';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Image Creator UPVC — Factory Overview</p>
        </div>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      {/* Company Info Banner */}
      <div className="card flex items-center gap-4 py-4 px-5">
        <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
          <img src="/ic-logo.png" alt="Image Creator" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-navy-800">Image</span>
            <span className="text-lg font-bold text-orange-500">Creator</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">— UPVC Products &amp; Interiors</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            9th Cross, GBH Layout, Tatanagar Main Road, Near UIDAI Office, Bangalore – 560094
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-right">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mobile</p>
            <p className="text-sm font-bold text-navy-800">9945263546</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">GST</p>
            <p className="text-sm font-mono font-bold text-orange-500">29ASHPJ3036A1Z4</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Email</p>
            <p className="text-xs font-medium text-navy-800">imagecreatorinteriors@outlook.com</p>
          </div>
        </div>
      </div>


      {/* Stat Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Orders"     value={stats?.totalOrders}     icon={ShoppingCart} iconBg="bg-navy-100"   iconColor="text-navy-800" />
        <StatCard title="Pending Orders"   value={stats?.pendingOrders}   icon={Clock}        iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="In Production"    value={stats?.inProduction}    icon={Factory}      iconBg="bg-blue-100"  iconColor="text-blue-600" />
        <StatCard title="Completed"        value={stats?.completedOrders} icon={CheckCircle2} iconBg="bg-green-100" iconColor="text-green-600" />
      </div>

      {/* Stat Cards - Row 2 */}
      <div className={`grid gap-4 ${user?.role === 'Admin' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
        {user?.role === 'Admin' && (
          <>
            <StatCard title="Monthly Revenue"  value={stats?.monthlyRevenue}  icon={TrendingUp}   iconBg="bg-green-100" iconColor="text-green-600"  prefix="₹" format />
            <StatCard title="Monthly Expenses" value={stats?.monthlyExpenses} icon={TrendingDown} iconBg="bg-red-100"   iconColor="text-red-500"   prefix="₹" format />
          </>
        )}
        <StatCard title="Pending Payments" value={stats?.pendingPayments} icon={CreditCard}   iconBg="bg-orange-100" iconColor="text-orange-600" prefix="₹" format />
        <StatCard title="Low Stock Items"  value={stats?.lowStockItems}   icon={AlertTriangle} iconBg="bg-red-100" iconColor="text-red-500" />
      </div>

      {/* Row 3: Today Attendance + Employees */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Today's Attendance" value={stats?.todayAttendance} icon={Users}   iconBg="bg-navy-100" iconColor="text-navy-800" />
        <StatCard title="Active Employees"   value={stats?.activeEmployees} icon={Users}   iconBg="bg-purple-100" iconColor="text-purple-600" />
      </div>

      {/* Charts Row 1 */}
      <div className={user?.role === 'Admin' ? "grid md:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
        {/* Sales Trend */}
        {user?.role === 'Admin' && (
          <div className="card">
            <h3 className="font-bold text-navy-800 mb-4">Monthly Revenue Trend</h3>
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1B2A4A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1B2A4A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#1B2A4A" strokeWidth={2} fill="url(#revenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-12">No data available</p>}
          </div>
        )}

        {/* Production Trend */}
        <div className="card">
          <h3 className="font-bold text-navy-800 mb-4">Monthly Orders Trend</h3>
          {prodTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={prodTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#F5A623" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-12">No data available</p>}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Inventory Usage by Category */}
        <div className="card">
          <h3 className="font-bold text-navy-800 mb-4">Inventory by Category</h3>
          {invUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={invUsage} dataKey="total_value" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {invUsage.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Value']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-12">No data available</p>}
        </div>

        {/* Attendance Summary */}
        <div className="card">
          <h3 className="font-bold text-navy-800 mb-4">Today's Attendance</h3>
          {attSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attSummary} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#64748b' }} width={70} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {attSummary.map((entry, idx) => {
                    const c = { Present:'#10b981', Absent:'#ef4444', Late:'#f59e0b', 'Half Day':'#6366f1', Leave:'#64748b' };
                    return <Cell key={idx} fill={c[entry.status] || '#1B2A4A'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Clock size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No attendance marked today</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-800">Recent Orders</h3>
          <a href="/orders" className="text-sm text-orange-500 hover:text-orange-600 font-medium">View all →</a>
        </div>
        {recentOrders.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs text-slate-400">#{order.id}</td>
                    <td className="font-medium text-navy-800">{order.customer_name}</td>
                    <td className="text-slate-600">{order.product_type}</td>
                    <td className="font-semibold text-navy-800">₹{Number(order.order_amount).toLocaleString('en-IN')}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="text-slate-500 text-xs">{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-slate-400 text-sm text-center py-8">No recent orders</p>}
      </div>

      {/* P&L Summary */}
      {user?.role === 'Admin' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-sm text-slate-500 mb-1">Monthly Revenue</p>
            <p className="text-xl font-bold text-green-600">₹{(stats?.monthlyRevenue || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-slate-500 mb-1">Monthly Expenses</p>
            <p className="text-xl font-bold text-red-500">₹{(stats?.monthlyExpenses || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-slate-500 mb-1">Net Profit/Loss</p>
            <p className={`text-xl font-bold ${profitColor}`}>
              {(stats?.profitLoss || 0) >= 0 ? '+' : ''}₹{Math.abs(stats?.profitLoss || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;