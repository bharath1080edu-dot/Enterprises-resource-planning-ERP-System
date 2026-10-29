import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form,    setForm]    = useState({ email: '', password: '', role: 'Admin' });
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);

  const DEMO_ACCOUNTS = [
    { role: 'Admin',    email: 'admin@imagecreator.com',    password: 'Admin@123' },
    { role: 'Manager',  email: 'manager@imagecreator.com',  password: 'Admin@123' },
    { role: 'Employee', email: 'employee@imagecreator.com', password: 'Admin@123' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}! 👋`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password, role: account.role });
  };

  return (
    <div className="min-h-screen bg-brand-gradient flex">
      {/* Left Panel — Company Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative dots */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-2 h-2 bg-orange-400 rounded-full animate-pulse-slow"
              style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, animationDelay: `${(i * 0.3) % 3}s` }} />
          ))}
        </div>

        <div className="relative z-10 text-center w-full max-w-sm">
          {/* Logo Image */}
          <div className="flex justify-center mb-4">
            <div className="w-32 h-32 rounded-2xl bg-white shadow-2xl shadow-orange-500/20 flex items-center justify-center p-2 overflow-hidden">
              <img src="/ic-logo.png" alt="Image Creator Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Company Name */}
          <h1 className="text-4xl font-bold mb-1">
            <span className="text-white">Image</span>
            <span className="text-orange-400"> Creator</span>
          </h1>

          {/* Tagline with decorative lines */}
          <div className="flex items-center gap-3 my-3 justify-center">
            <div className="flex-1 h-px bg-orange-500/40" />
            <p className="text-orange-400 text-sm font-bold tracking-widest uppercase whitespace-nowrap">
              UPVC Products &amp; Interiors
            </p>
            <div className="flex-1 h-px bg-orange-500/40" />
          </div>

          {/* Address */}
          <p className="text-navy-300 text-sm leading-relaxed mb-6">
            9th Cross, GBH Layout, Tatanagar Main Road<br />
            Near UIDAI Office, Bangalore – 560094
          </p>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <div className="bg-navy-700/50 rounded-xl px-4 py-3 backdrop-blur-sm border border-navy-600/50 flex items-center justify-between">
              <span className="text-navy-400 text-xs font-semibold uppercase tracking-wider">Mobile</span>
              <span className="text-white text-sm font-bold">9945263546</span>
            </div>
            <div className="bg-navy-700/50 rounded-xl px-4 py-3 backdrop-blur-sm border border-navy-600/50 flex items-center justify-between">
              <span className="text-navy-400 text-xs font-semibold uppercase tracking-wider">GST</span>
              <span className="text-orange-400 text-sm font-mono font-bold">29ASHPJ3036A1Z4</span>
            </div>
            <div className="bg-navy-700/50 rounded-xl px-4 py-3 backdrop-blur-sm border border-navy-600/50 flex items-center justify-between">
              <span className="text-navy-400 text-xs font-semibold uppercase tracking-wider">Email</span>
              <span className="text-white text-xs font-medium">imagecreatorinteriors@outlook.com</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Orders', value: '150+' },
              { label: 'Employees', value: '20+' },
              { label: 'Products', value: '50+' },
            ].map(s => (
              <div key={s.label} className="bg-navy-700/50 rounded-xl p-3 backdrop-blur-sm border border-navy-600/50">
                <p className="text-xl font-bold text-orange-400">{s.value}</p>
                <p className="text-navy-300 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-white shadow border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
              <img src="/ic-logo.png" alt="Image Creator" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-bold text-navy-800 text-lg leading-tight">Image Creator</p>
              <p className="text-orange-500 text-xs font-medium">UPVC Products &amp; Interiors</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-navy-800">Welcome Back</h2>
            <p className="text-slate-500 mt-1.5">Sign in to your ERP account</p>
          </div>

          {/* Demo Accounts */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button key={acc.role} onClick={() => fillDemo(acc)}
                  className="py-2 px-3 rounded-lg border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 text-xs font-semibold text-slate-600 hover:text-orange-600 transition-all duration-200">
                  {acc.role}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or sign in manually</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input pl-10"
                  placeholder="admin@imagecreator.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input pl-10 pr-10"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShow(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-800 transition-colors">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading ? <><Loader size={16} className="animate-spin" /> Signing in...</> : 'Sign In to ERP'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-orange-500 font-semibold hover:text-orange-600">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;