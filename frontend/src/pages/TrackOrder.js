import React, { useState } from 'react';
import axios from 'axios';
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, Truck,
  ChevronRight, RotateCcw, Phone, Calendar, CreditCard,
  Scissors, Wrench, Settings2, ShieldCheck, Archive,
  ArrowRight, MapPin, Building2, Loader2
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  'Pending':       { color: 'from-amber-500 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800',   icon: Clock       },
  'In Production': { color: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-800',     icon: Settings2   },
  'Completed':     { color: 'from-emerald-500 to-teal-500',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-800',icon: CheckCircle2},
  'Delivered':     { color: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-800', icon: Truck       },
  'Cancelled':     { color: 'from-red-400 to-rose-600',       bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',   badge: 'bg-red-100 text-red-800',       icon: AlertCircle },
};

const STAGE_META = {
  'Cutting':       { icon: Scissors,    label: 'Cutting',       desc: 'Raw profiles are precision-cut to size' },
  'Welding':       { icon: Wrench,      label: 'Welding',       desc: 'Corners are welded for a strong frame' },
  'Assembly':      { icon: Settings2,   label: 'Assembly',      desc: 'Hardware, hinges & handles fitted' },
  'Quality Check': { icon: ShieldCheck, label: 'Quality Check', desc: 'Full inspection for finish & fit' },
  'Packing':       { icon: Archive,     label: 'Packing',       desc: 'Wrapped & ready for dispatch' },
};

const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

const fmtTime = (ts) => {
  if (!ts) return null;
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StageStep = ({ stage, index, total }) => {
  const meta  = STAGE_META[stage.stage] || {};
  const Icon  = meta.icon || Package;
  const isDone   = stage.status === 'Completed';
  const isActive = stage.status === 'In Progress';
  const isPending = stage.status === 'Pending';
  const isLast = index === total - 1;

  return (
    <div className="flex gap-4 relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-200 z-0">
          {isDone && <div className="w-full bg-emerald-400 h-full transition-all duration-700" />}
        </div>
      )}

      {/* Icon bubble */}
      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-md
        ${isDone   ? 'bg-emerald-500 shadow-emerald-200' :
          isActive ? 'bg-blue-500 shadow-blue-200 ring-4 ring-blue-100' :
                     'bg-slate-200'}`}>
        {isDone
          ? <CheckCircle2 size={18} className="text-white" />
          : <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
        }
        {isActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <p className={`font-semibold text-sm ${isDone ? 'text-emerald-700' : isActive ? 'text-blue-700' : 'text-slate-400'}`}>
            {meta.label || stage.stage}
          </p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
            ${isDone   ? 'bg-emerald-100 text-emerald-700' :
              isActive ? 'bg-blue-100 text-blue-700' :
                         'bg-slate-100 text-slate-400'}`}>
            {isDone ? 'Done' : isActive ? 'In Progress' : 'Pending'}
          </span>
        </div>
        <p className={`text-xs mb-1 ${isPending ? 'text-slate-300' : 'text-slate-500'}`}>
          {meta.desc}
        </p>
        {(stage.start_time || stage.end_time) && (
          <div className="flex gap-3 mt-1 text-xs text-slate-400">
            {stage.start_time && <span>Started: {fmtTime(stage.start_time)}</span>}
            {stage.end_time   && <span>· Finished: {fmtTime(stage.end_time)}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const TrackOrder = () => {
  const [orderId,  setOrderId]  = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [result,   setResult]   = useState(null);

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderId.trim() || !phone.trim()) {
      setError('Please enter both Order ID and Phone Number.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post('http://localhost:5000/api/track', {
        order_id: orderId.trim(),
        contact:  phone.trim(),
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No order found. Please check your Order ID and phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setOrderId('');
    setPhone('');
  };

  const statusCfg = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG['Pending']) : null;
  const StatusIcon = statusCfg?.icon;

  const isOverdue = result?.delivery_date && result.status !== 'Delivered' && result.status !== 'Cancelled'
    && new Date(result.delivery_date) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 flex flex-col">

      {/* ── Decorative blobs ───────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="relative z-10 px-6 pt-8 pb-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
            <img src="/ic-logo.png" alt="IC" className="w-full h-full object-contain p-1"
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
            />
            <Building2 size={20} className="text-orange-400 hidden" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Image Creator</p>
            <p className="text-orange-400 text-xs font-medium">UPVC Products & Interiors</p>
          </div>
          <a href="tel:+91" className="ml-auto flex items-center gap-1.5 text-xs text-navy-300 hover:text-orange-400 transition-colors">
            <Phone size={12} />
            <span>Need help?</span>
          </a>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="relative z-10 flex-1 px-4 pb-12">
        <div className="max-w-2xl mx-auto">

          {/* ── Hero ─────────────────────────────────────────── */}
          {!result && (
            <div className="text-center mb-8 mt-6">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-orange-300 text-xs font-semibold px-4 py-1.5 rounded-full border border-orange-400/30 mb-4">
                <Truck size={12} />
                Order Tracking Portal
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
                Track Your <span className="text-orange-400">Order</span>
              </h1>
              <p className="text-navy-300 text-sm max-w-sm mx-auto leading-relaxed">
                Enter your Order ID and registered phone number to see the live status of your UPVC window or door.
              </p>
            </div>
          )}

          {/* ── Back button when viewing results ─────────────── */}
          {result && (
            <button onClick={handleReset}
              className="flex items-center gap-2 text-navy-300 hover:text-orange-400 text-sm font-medium mb-6 mt-4 transition-colors group">
              <RotateCcw size={14} className="group-hover:rotate-90 transition-transform duration-300" />
              Track Another Order
            </button>
          )}

          {/* ── Lookup Form ──────────────────────────────────── */}
          {!result && (
            <form onSubmit={handleTrack}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl mb-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-navy-200 text-sm font-medium mb-2">
                    Order ID
                  </label>
                  <div className="relative">
                    <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                    <input
                      id="track-order-id"
                      type="number"
                      value={orderId}
                      onChange={e => setOrderId(e.target.value)}
                      placeholder="e.g. 1001"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3
                                 text-white placeholder-navy-400 text-sm focus:outline-none
                                 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/60
                                 transition-all duration-200"
                    />
                  </div>
                  <p className="text-navy-400 text-xs mt-1.5">You received this in your order confirmation</p>
                </div>

                <div>
                  <label className="block text-navy-200 text-sm font-medium mb-2">
                    Registered Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                    <input
                      id="track-phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={15}
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3
                                 text-white placeholder-navy-400 text-sm focus:outline-none
                                 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/60
                                 transition-all duration-200"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <button
                  id="track-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600
                             active:bg-orange-700 text-white font-bold py-3.5 rounded-xl
                             transition-all duration-200 shadow-lg shadow-orange-500/30
                             hover:shadow-orange-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Looking up your order...</>
                    : <><Search size={16} /> Track My Order <ArrowRight size={14} /></>
                  }
                </button>
              </div>
            </form>
          )}

          {/* ── Info pills ───────────────────────────────────── */}
          {!result && (
            <div className="flex flex-wrap justify-center gap-3 text-xs text-navy-400">
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> No login required</span>
              <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-blue-400" /> Secure lookup</span>
              <span className="flex items-center gap-1"><Clock size={11} className="text-orange-400" /> Live status</span>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────── */}
          {result && (
            <div className="space-y-4 animate-fade-in">

              {/* Status hero card */}
              <div className={`bg-gradient-to-r ${statusCfg.color} rounded-2xl p-5 shadow-xl`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full">
                    <StatusIcon size={13} className="text-white" />
                    <span className="text-white text-xs font-bold">{result.status}</span>
                  </div>
                  <span className="text-white/70 text-xs font-medium">Order #{result.order_id}</span>
                </div>

                <h2 className="text-white text-xl font-bold mb-1">
                  Hello, {result.customer_name.split(' ')[0]}! 👋
                </h2>
                <p className="text-white/80 text-sm mb-4">
                  {result.status === 'Delivered'
                    ? 'Your order has been delivered. Thank you for choosing Image Creator!'
                    : result.status === 'Completed'
                    ? 'Your order is ready and awaiting dispatch.'
                    : result.status === 'Cancelled'
                    ? 'This order has been cancelled. Contact us for assistance.'
                    : `Your order is currently in ${result.status === 'Pending' ? 'queue' : 'production'}.`}
                </p>

                {/* Progress bar */}
                {result.status !== 'Cancelled' && (
                  <div>
                    <div className="flex justify-between text-white/70 text-xs mb-1.5">
                      <span>Production Progress</span>
                      <span className="font-bold text-white">{result.completion_percent}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-white transition-all duration-700 ease-out"
                        style={{ width: `${result.completion_percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order Details card */}
              <div className="bg-white rounded-2xl p-5 shadow-lg">
                <h3 className="font-bold text-navy-800 text-sm mb-4 flex items-center gap-2">
                  <Package size={15} className="text-orange-500" /> Order Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">Product</p>
                    <p className="text-navy-800 font-semibold text-sm leading-tight">{result.product_type || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">Size</p>
                    <p className="text-navy-800 font-semibold text-sm">{result.size || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">Quantity</p>
                    <p className="text-navy-800 font-semibold text-sm">{result.quantity} unit{result.quantity !== 1 ? 's' : ''}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
                    <p className={`text-xs mb-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                      <Calendar size={10} />
                      {isOverdue ? 'Was Due' : 'Delivery Date'}
                    </p>
                    <p className={`font-semibold text-sm ${isOverdue ? 'text-red-600' : 'text-navy-800'}`}>
                      {fmt(result.delivery_date)}
                      {isOverdue && <span className="text-xs font-normal ml-1">(Delayed)</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                  <MapPin size={11} />
                  <span>Order placed on {fmt(result.order_date)}</span>
                </div>
              </div>

              {/* Production Pipeline card */}
              {result.status !== 'Cancelled' && (
                <div className="bg-white rounded-2xl p-5 shadow-lg">
                  <h3 className="font-bold text-navy-800 text-sm mb-1 flex items-center gap-2">
                    <Settings2 size={15} className="text-orange-500" /> Production Pipeline
                  </h3>
                  <p className="text-slate-400 text-xs mb-5">
                    Currently at: <span className="font-semibold text-blue-600">{result.current_stage}</span>
                  </p>
                  <div>
                    {result.stages.map((stage, idx) => (
                      <StageStep key={stage.stage} stage={stage} index={idx} total={result.stages.length} />
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Summary card */}
              <div className="bg-white rounded-2xl p-5 shadow-lg">
                <h3 className="font-bold text-navy-800 text-sm mb-4 flex items-center gap-2">
                  <CreditCard size={15} className="text-orange-500" /> Payment Summary
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-1">Order Value</p>
                    <p className="text-navy-800 font-bold text-base">₹{Number(result.total_amount).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center bg-emerald-50 rounded-xl p-3">
                    <p className="text-emerald-500 text-xs mb-1">Paid</p>
                    <p className="text-emerald-700 font-bold text-base">₹{Number(result.amount_paid).toLocaleString('en-IN')}</p>
                  </div>
                  <div className={`text-center rounded-xl p-3 ${result.remaining_balance > 0 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                    <p className={`text-xs mb-1 ${result.remaining_balance > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>Balance</p>
                    <p className={`font-bold text-base ${result.remaining_balance > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {result.remaining_balance > 0 ? `₹${Number(result.remaining_balance).toLocaleString('en-IN')}` : '✓ Cleared'}
                    </p>
                  </div>
                </div>

                {result.payments && result.payments.length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Payment History</p>
                    <div className="space-y-2">
                      {result.payments.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                            </span>
                            <div>
                              <p className="font-medium text-navy-700 text-xs">{p.payment_type} · {p.payment_method}</p>
                              <p className="text-slate-400 text-xs">{fmt(p.payment_date)}</p>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-700 text-sm">
                            +₹{Number(p.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.remaining_balance > 0 && (
                  <div className="mt-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                    <AlertCircle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-orange-700 text-xs">
                      A balance of <strong>₹{Number(result.remaining_balance).toLocaleString('en-IN')}</strong> is pending.
                      Please settle before delivery. Contact us at <strong>Image Creator</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 text-center">
                <p className="text-navy-200 text-sm mb-3">Have a question about your order?</p>
                <a href="tel:+91"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/30">
                  <Phone size={14} /> Call Us
                </a>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-4 border-t border-white/10">
        <p className="text-navy-500 text-xs">© 2025 Image Creator UPVC Products & Interiors. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default TrackOrder;
