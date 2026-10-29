import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scissors, Printer, Plus, Trash2, Layers, CheckCircle2, AlertTriangle,
  Package, ChevronDown, ChevronUp, CheckSquare, Square, RefreshCw,
  BarChart2, AlertCircle, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { extractCutPieces, optimizeCutList, printCuttingSheet } from '../utils/cutOptimizer';

// ── Profile type options for manual input ─────────────────────────────────
const PROFILE_OPTIONS = [
  '2-Track Outer Frame (60mm)',
  '2-Track Sash Profile',
  '2-Track Glazing Bead',
  '2-Track Interlock Profile',
  '2.5-Track Outer Frame',
  '2.5-Track Sash Profile',
  '2.5-Track Glazing Bead',
  '2.5-Track Interlock',
  '3-Track Outer Frame',
  '3-Track Sash Profile',
  '3-Track Glazing Bead',
  '3-Track Interlock',
  'Ventilator Outer Frame',
  'Ventilator Sash Profile',
  'Ventilator Glazing Bead',
  'Casement Outer Frame (60mm)',
  'Casement Sash Profile',
  'Casement Glazing Bead',
  'Fixed Outer Frame (60mm)',
  'Fixed Glazing Bead',
  'Mullion Profile',
];

// Track type display order — mirrors the factory cutting sequence
const TRACK_ORDER = [
  '2-Track Sliding Window',
  '2.5-Track Sliding Window',
  '3-Track Sliding Window',
  'Ventilator Window',
  'Casement Window',
  'Tilt & Turn Window',
  'Fixed / Picture Window',
];

// Category order within a track
const CATEGORY_ORDER = ['outer frame', 'sash', 'glazing bead', 'bead', 'interlock', 'mullion', 'other'];

const getCategoryLabel = (profileName = '') => {
  const n = profileName.toLowerCase();
  if (n.includes('outer frame') || n.includes('fixed outer')) return 'outer frame';
  if (n.includes('sash')) return 'sash';
  if (n.includes('glazing bead') || n.includes('bead')) return 'glazing bead';
  if (n.includes('interlock')) return 'interlock';
  if (n.includes('mullion')) return 'mullion';
  return 'other';
};

const categoryOrder = (name) => {
  const idx = CATEGORY_ORDER.indexOf(getCategoryLabel(name));
  return idx === -1 ? 99 : idx;
};

// ── Color coding per track type ─────────────────────────────────────────
const TRACK_COLORS = {
  '2-Track Sliding Window':     { bg: 'bg-blue-700',    text: 'text-white',    accent: 'border-blue-300',    badge: 'bg-blue-100 text-blue-800' },
  '2.5-Track Sliding Window':   { bg: 'bg-indigo-700',  text: 'text-white',    accent: 'border-indigo-300',  badge: 'bg-indigo-100 text-indigo-800' },
  '3-Track Sliding Window':     { bg: 'bg-violet-700',  text: 'text-white',    accent: 'border-violet-300',  badge: 'bg-violet-100 text-violet-800' },
  'Ventilator Window':          { bg: 'bg-cyan-700',    text: 'text-white',    accent: 'border-cyan-300',    badge: 'bg-cyan-100 text-cyan-800' },
  'Casement Window':            { bg: 'bg-amber-700',   text: 'text-white',    accent: 'border-amber-300',   badge: 'bg-amber-100 text-amber-800' },
  'Tilt & Turn Window':         { bg: 'bg-rose-700',    text: 'text-white',    accent: 'border-rose-300',    badge: 'bg-rose-100 text-rose-800' },
  'Fixed / Picture Window':     { bg: 'bg-slate-600',   text: 'text-white',    accent: 'border-slate-300',   badge: 'bg-slate-100 text-slate-700' },
};

const trackColor = (track) =>
  TRACK_COLORS[track] || { bg: 'bg-navy-700', text: 'text-white', accent: 'border-slate-300', badge: 'bg-slate-100 text-slate-700' };

// ── CUT SEGMENTS per-bar visual ────────────────────────────────────────────
const BAR_COLORS = [
  '#1B3A6B', '#2563EB', '#7C3AED', '#0891B2', '#B45309',
  '#065F46', '#9F1239', '#374151', '#1D4ED8', '#6D28D9',
];

const CutOptimizer = () => {
  // ── Parameters ────────────────────────────────────────────────────────
  const [stockLength, setStockLength]     = useState(6000);
  const [sawKerf, setSawKerf]             = useState(4);
  const [minUsableOffcut, setMinUsableOffcut] = useState(300);

  // ── Orders ────────────────────────────────────────────────────────────
  const [orders, setOrders]               = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrder, setLoadingOrder]   = useState(false);

  // ── Cut pieces (extracted from order) ─────────────────────────────────
  const [pieces, setPieces]               = useState([]);   // flat list of individual pieces
  const [orderInfo, setOrderInfo]         = useState({});

  // ── Manual add form ───────────────────────────────────────────────────
  const [newItem, setNewItem] = useState({
    label: '', profileType: PROFILE_OPTIONS[0],
    trackType: '2-Track Sliding Window', finish: 'White',
    lengthMm: '', category: 'outer frame',
  });

  // ── Confirmation checkboxes (barNumber → bool) ─────────────────────
  const [barsDone, setBarsDone] = useState({});

  // ── Collapse sections ─────────────────────────────────────────────────
  const [collapsedTracks, setCollapsedTracks] = useState({});

  // ── Fetch orders on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        const res = await api.get('/orders');
        setOrders(res.data.data || []);
      } catch {
        toast.error('Could not load orders.');
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, []);

  // ── Load an order and extract exact cut pieces ─────────────────────
  const handleSelectOrder = useCallback(async (e) => {
    const orderId = e.target.value;
    setSelectedOrderId(orderId);
    if (!orderId) {
      setPieces([]);
      setSelectedOrder(null);
      setOrderInfo({});
      return;
    }

    setLoadingOrder(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      const order = res.data.data || res.data;
      setSelectedOrder(order);

      let prods = [];
      try {
        const raw = order.products;
        prods = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      } catch { prods = []; }

      if (!prods.length) {
        toast.error('No product items found in this order.');
        setPieces([]);
        setLoadingOrder(false);
        return;
      }

      // Attach orderId to each item so extractCutPieces can label them
      const itemsWithId = prods.map(p => ({ ...p, orderId }));
      const extracted = extractCutPieces(itemsWithId);

      if (!extracted.length) {
        toast.error('No valid dimensions found in order items. Check width/height fields.');
        setPieces([]);
        setLoadingOrder(false);
        return;
      }

      setPieces(extracted);
      setBarsDone({});
      setOrderInfo({
        title: `Order #${orderId} — ${order.customer_name || ''}`,
        customer: order.customer_name || '',
        orderId,
        date: order.order_date || '',
        productCount: prods.length,
      });
      toast.success(`✅ Loaded ${extracted.length} individual cut pieces from Order #${orderId} (${prods.length} items)`);
    } catch (err) {
      toast.error('Failed to load order details.');
      console.error(err);
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  // ── Add manual piece ──────────────────────────────────────────────────
  const handleAddManual = (e) => {
    e.preventDefault();
    const len = parseFloat(newItem.lengthMm);
    if (!len || len <= 0 || len > stockLength) {
      toast.error(`Enter a valid length between 1 and ${stockLength} mm.`);
      return;
    }
    const piece = {
      label: newItem.label || `Manual Piece ${pieces.length + 1}`,
      profileType: newItem.profileType,
      trackType: newItem.trackType,
      finish: newItem.finish || 'White',
      lengthMm: len,
      pieceDesc: newItem.label || 'Manual',
      category: getCategoryLabel(newItem.profileType),
    };
    setPieces(prev => [...prev, piece]);
    setNewItem(p => ({ ...p, label: '', lengthMm: '' }));
    toast.success('Manual piece added to cut list.');
  };

  // ── Run optimization ──────────────────────────────────────────────────
  const optimization = useMemo(() =>
    optimizeCutList(pieces, stockLength, sawKerf, minUsableOffcut),
    [pieces, stockLength, sawKerf, minUsableOffcut]
  );
  const { bars, summary } = optimization;

  // ── Group bars by track type then profile type ─────────────────────
  const groupedBars = useMemo(() => {
    const groups = {};
    bars.forEach(bar => {
      const tk = bar.trackType || 'General';
      if (!groups[tk]) groups[tk] = {};
      const pt = bar.profileType;
      if (!groups[tk][pt]) groups[tk][pt] = [];
      groups[tk][pt].push(bar);
    });
    return groups;
  }, [bars]);

  const orderedTracks = TRACK_ORDER.filter(t => groupedBars[t]);

  // ── Bar confirmation ──────────────────────────────────────────────────
  const toggleBarDone = (barNum) =>
    setBarsDone(prev => ({ ...prev, [barNum]: !prev[barNum] }));

  const markAllDone = () => {
    const all = {};
    bars.forEach(b => { all[b.barNumber] = true; });
    setBarsDone(all);
    toast.success('All bars marked as done!');
  };

  const doneBars = bars.filter(b => barsDone[b.barNumber]).length;
  const allDone = bars.length > 0 && doneBars === bars.length;

  // ── Print ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!bars.length) { toast.error('No cutting plan generated yet.'); return; }
    printCuttingSheet(optimization, orderInfo);
  };

  // ── Stats ─────────────────────────────────────────────────────────────
  const utilizationColor = summary.utilizationPct >= 85
    ? 'text-green-600' : summary.utilizationPct >= 65
    ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <Scissors size={24} className="text-orange-500" />
            Profile Cut Optimizer
          </h1>
          <p className="page-subtitle">
            1D Bin Packing — Best-Fit Decreasing · All dimensions in <strong>mm</strong> · Stock bar = {stockLength}mm
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bars.length > 0 && !allDone && (
            <button onClick={markAllDone} className="btn-secondary flex items-center gap-2 text-xs">
              <CheckSquare size={14} /> Mark All Bars Done
            </button>
          )}
          {bars.length > 0 && (
            <button onClick={handlePrint} className="btn-accent flex items-center gap-2 shadow-md">
              <Printer size={16} /> Print Cutting Sheet
            </button>
          )}
        </div>
      </div>

      {/* ── Order Selection + Parameters ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Load Order */}
        <div className="card space-y-3">
          <label className="label flex items-center gap-1.5 font-bold text-navy-800">
            <Package size={15} className="text-orange-500" /> Auto-Load Customer Order
          </label>
          <select
            value={selectedOrderId}
            onChange={handleSelectOrder}
            disabled={loadingOrders || loadingOrder}
            className="input text-xs font-semibold border-navy-300 focus:border-orange-500"
          >
            <option value="">— Select order to calculate cuts —</option>
            {orders.map(o => (
              <option key={o.id} value={o.id}>
                Order #{o.id} · {o.customer_name} ({o.status || 'Active'})
              </option>
            ))}
          </select>
          {loadingOrder && (
            <p className="text-xs text-orange-500 flex items-center gap-1 animate-pulse">
              <RefreshCw size={12} className="animate-spin" /> Extracting cut dimensions…
            </p>
          )}
          {orderInfo.title && (
            <div className="text-xs bg-green-50 border border-green-200 rounded-lg p-2.5 space-y-1">
              <p className="font-bold text-green-700">{orderInfo.title}</p>
              <p className="text-green-600">📦 {orderInfo.productCount} product items → <strong>{pieces.length}</strong> individual cut pieces extracted</p>
            </div>
          )}
        </div>

        {/* Parameters */}
        <div className="card space-y-3 md:col-span-2">
          <label className="label font-bold text-navy-800 flex items-center gap-1.5">
            <Layers size={15} className="text-navy-600" /> Optimization Parameters
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Stock Bar Length (mm)</span>
              <input
                type="number" min="3000" max="9000" step="100"
                value={stockLength}
                onChange={e => setStockLength(parseFloat(e.target.value) || 6000)}
                className="input h-8 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Saw Blade Kerf (mm)</span>
              <input
                type="number" min="1" max="10" step="0.5"
                value={sawKerf}
                onChange={e => setSawKerf(parseFloat(e.target.value) || 4)}
                className="input h-8 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Min Reusable Off-cut (mm)</span>
              <input
                type="number" min="50" max="2000" step="50"
                value={minUsableOffcut}
                onChange={e => setMinUsableOffcut(parseFloat(e.target.value) || 300)}
                className="input h-8 text-xs font-mono font-bold"
              />
            </div>
          </div>
          <p className="text-[10.5px] text-slate-400">
            <Info size={11} className="inline mr-1" />
            Kerf waste is deducted between every consecutive cut on each bar. Off-cuts ≥ {minUsableOffcut}mm are flagged as reusable stock.
          </p>
        </div>
      </div>

      {/* ── KPI Summary ── */}
      {bars.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="card text-center bg-navy-900 border-0 text-white shadow-lg">
            <p className="text-3xl font-extrabold text-orange-400 font-mono">{summary.totalBarsNeeded}</p>
            <p className="text-[11px] text-slate-300 mt-1 font-medium">Bars Needed ({summary.stockLengthMm}mm)</p>
          </div>
          <div className="card text-center bg-slate-50 shadow-sm">
            <p className="text-3xl font-extrabold text-navy-800 font-mono">{summary.totalPieces}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">Individual Cut Pieces</p>
          </div>
          <div className="card text-center shadow-sm">
            <p className={`text-3xl font-extrabold font-mono ${utilizationColor}`}>{summary.utilizationPct}%</p>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">Material Utilization</p>
          </div>
          <div className="card text-center bg-green-50 border-green-200 shadow-sm">
            <p className="text-3xl font-extrabold text-green-700 font-mono">{summary.totalUsableOffcutMm}</p>
            <p className="text-[11px] text-green-700 mt-1 font-semibold">Reusable Off-cut (mm)</p>
          </div>
          <div className="card text-center bg-red-50 border-red-200 shadow-sm">
            <p className="text-3xl font-extrabold text-red-600 font-mono">{summary.totalScrapMm}</p>
            <p className="text-[11px] text-red-700 mt-1 font-semibold">Scrap Waste (mm)</p>
          </div>
        </div>
      )}

      {/* ── Progress Bar for Confirmation ── */}
      {bars.length > 0 && (
        <div className="card p-3 flex items-center gap-4">
          <div className="flex items-center gap-2 min-w-max">
            {allDone
              ? <CheckCircle2 size={18} className="text-green-500" />
              : <AlertCircle size={18} className="text-amber-500" />}
            <span className="text-sm font-bold text-navy-800">
              {allDone ? 'All bars confirmed!' : `${doneBars} / ${bars.length} bars confirmed`}
            </span>
          </div>
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${bars.length ? (doneBars / bars.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 min-w-max">
            {bars.length ? Math.round((doneBars / bars.length) * 100) : 0}%
          </span>
        </div>
      )}

      {/* ── Manual Add Form + Loaded Pieces ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Manual Form */}
        <div className="card space-y-3">
          <h3 className="font-bold text-navy-800 text-sm flex items-center gap-1.5">
            <Plus size={15} className="text-orange-500" /> Add Piece Manually
          </h3>
          <form onSubmit={handleAddManual} className="space-y-2.5">
            <div>
              <label className="label text-xs">Label / Description</label>
              <input
                className="input text-xs" placeholder="e.g. W1 Frame Top"
                value={newItem.label}
                onChange={e => setNewItem(p => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="label text-xs">Profile Type</label>
              <select
                className="input text-xs font-semibold"
                value={newItem.profileType}
                onChange={e => setNewItem(p => ({ ...p, profileType: e.target.value }))}
              >
                {PROFILE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Track Type</label>
              <select
                className="input text-xs font-semibold"
                value={newItem.trackType}
                onChange={e => setNewItem(p => ({ ...p, trackType: e.target.value }))}
              >
                {TRACK_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Color / Finish</label>
                <input
                  className="input text-xs" placeholder="White"
                  value={newItem.finish}
                  onChange={e => setNewItem(p => ({ ...p, finish: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">Length (mm)</label>
                <input
                  type="number" min="1" max={stockLength}
                  className="input text-xs font-mono font-bold"
                  placeholder="e.g. 1450"
                  value={newItem.lengthMm}
                  onChange={e => setNewItem(p => ({ ...p, lengthMm: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="btn-accent w-full flex items-center justify-center gap-1 text-xs py-2">
              <Plus size={13} /> Add to Cut List
            </button>
          </form>
        </div>

        {/* Loaded Pieces List */}
        <div className="lg:col-span-2 card space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-navy-800 text-sm flex items-center gap-1.5">
              <Scissors size={14} className="text-orange-500" />
              Cut List — {pieces.length} individual pieces
            </h3>
            {pieces.length > 0 && (
              <button
                onClick={() => { setPieces([]); setBarsDone({}); setSelectedOrderId(''); setSelectedOrder(null); setOrderInfo({}); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>

          {pieces.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No pieces loaded</p>
              <p className="text-xs mt-1">Select a customer order above or add pieces manually.</p>
            </div>
          ) : (
            <div className="table-container max-h-[320px] overflow-y-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Profile Type</th>
                    <th>Finish</th>
                    <th className="text-right">Length (mm)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pieces.map((p, i) => (
                    <tr key={i}>
                      <td className="text-slate-400 font-mono font-bold">{i + 1}</td>
                      <td className="font-semibold text-navy-800 max-w-[180px] truncate" title={p.label}>{p.pieceDesc || p.label}</td>
                      <td className="text-slate-600">{p.profileType}</td>
                      <td><span className="badge-gray text-[9px]">{p.finish}</span></td>
                      <td className="text-right font-mono font-bold text-navy-800">{p.lengthMm}</td>
                      <td>
                        <button
                          onClick={() => setPieces(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Visual Bar-by-Bar Cutting Plan (grouped by track → profile) ── */}
      {bars.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy-800 flex items-center gap-2">
              <BarChart2 size={18} className="text-orange-500" />
              Bar-by-Bar Cutting Plan — {bars.length} Bars
            </h2>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              Stock: {stockLength}mm | Kerf: {sawKerf}mm | Min Offcut: {minUsableOffcut}mm
            </span>
          </div>

          {/* Factory sequence: Track → Profile Category */}
          {orderedTracks.map(track => {
            const profileGroups = groupedBars[track];
            const tc = trackColor(track);
            const collapsed = collapsedTracks[track];
            const trackBars = Object.values(profileGroups).flat();
            const trackDone = trackBars.filter(b => barsDone[b.barNumber]).length;
            const trackTotal = trackBars.length;

            // Sort profile types by category order
            const sortedProfileTypes = Object.keys(profileGroups)
              .sort((a, b) => categoryOrder(a) - categoryOrder(b));

            return (
              <div key={track} className={`rounded-xl border-2 overflow-hidden shadow-sm ${tc.accent}`}>
                {/* Track Header */}
                <button
                  className={`w-full ${tc.bg} ${tc.text} flex items-center justify-between px-5 py-3 cursor-pointer`}
                  onClick={() => setCollapsedTracks(prev => ({ ...prev, [track]: !prev[track] }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-sm tracking-wide uppercase">{track}</span>
                    <span className="text-white/70 text-xs font-medium">
                      {trackTotal} bars · {trackBars.reduce((s, b) => s + b.cuts.length, 0)} pieces
                    </span>
                    {trackDone === trackTotal && trackTotal > 0 && (
                      <span className="bg-green-400 text-green-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/80 text-xs font-mono">{trackDone}/{trackTotal} confirmed</span>
                    {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </div>
                </button>

                {!collapsed && (
                  <div className="bg-white">
                    {sortedProfileTypes.map((profileType, ptIdx) => {
                      const ptBars = profileGroups[profileType];

                      return (
                        <div key={profileType} className={ptIdx > 0 ? 'border-t border-slate-100' : ''}>
                          {/* Profile type sub-header */}
                          <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-5 py-2">
                            <div className="flex items-center gap-2">
                              <Scissors size={13} className="text-orange-500" />
                              <span className="text-xs font-extrabold text-navy-800 uppercase tracking-wider">{profileType}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>
                                {ptBars.length} bars · {ptBars.reduce((s, b) => s + b.cuts.length, 0)} cuts
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {ptBars.reduce((s, b) => s + b.usedLength, 0)} mm used in profile
                            </span>
                          </div>

                          {/* Individual bars */}
                          <div className="p-4 space-y-3">
                            {ptBars.map(bar => {
                              const isDone = barsDone[bar.barNumber];

                              return (
                                <div
                                  key={bar.barNumber}
                                  className={`rounded-xl border-2 transition-all duration-200 ${isDone ? 'border-green-400 bg-green-50/40' : 'border-slate-200 bg-white hover:border-navy-300'}`}
                                >
                                  {/* Bar Header Row */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
                                    <div className="flex items-center gap-2.5">
                                      <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md text-white ${tc.bg}`}>
                                        BAR #{bar.barNumber}
                                      </span>
                                      <span className="text-xs font-bold text-navy-800">{bar.profileType}</span>
                                      <span className="text-xs text-slate-500">({bar.finish})</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] font-mono text-slate-600">
                                        Used: <strong className="text-navy-800">{bar.usedLength}mm</strong>
                                      </span>
                                      <span className={`text-[11px] font-mono font-bold ${bar.isUsableOffcut ? 'text-green-600' : 'text-red-500'}`}>
                                        Off-cut: {bar.scrap}mm {bar.isUsableOffcut ? '↩ Reusable' : '✗ Scrap'}
                                      </span>
                                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bar.efficiencyPct >= 80 ? 'bg-green-100 text-green-800' : bar.efficiencyPct >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                        {bar.efficiencyPct}%
                                      </span>

                                      {/* ── Confirmation Tick ── */}
                                      <button
                                        onClick={() => toggleBarDone(bar.barNumber)}
                                        title={isDone ? 'Mark as pending' : 'Mark bar as cut & done'}
                                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all duration-150 ${
                                          isDone
                                            ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                            : 'border-slate-300 text-slate-400 hover:border-green-400 hover:text-green-600'
                                        }`}
                                      >
                                        {isDone ? <CheckSquare size={14} /> : <Square size={14} />}
                                        {isDone ? 'Done ✓' : 'Confirm'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Graphical Bar Diagram */}
                                  <div className="px-4 pb-2">
                                    <div className="w-full h-10 bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200 shadow-inner">
                                      {bar.cuts.map((cut, idx) => {
                                        const pct = (cut.lengthMm / bar.stockLength) * 100;
                                        const kerfPct = ((cut.kerfBefore || 0) / bar.stockLength) * 100;
                                        const color = BAR_COLORS[idx % BAR_COLORS.length];
                                        return (
                                          <React.Fragment key={idx}>
                                            {kerfPct > 0 && (
                                              <div style={{ width: `${kerfPct}%` }} className="bg-red-400 h-full" title="Saw Kerf" />
                                            )}
                                            <div
                                              style={{ width: `${pct}%`, backgroundColor: color }}
                                              className="h-full border-r border-white/30 flex items-center justify-center px-1 text-[9px] font-bold text-white font-mono overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-90 transition-all"
                                              title={`${cut.pieceDesc || cut.label}: ${cut.lengthMm}mm`}
                                            >
                                              {cut.lengthMm}
                                            </div>
                                          </React.Fragment>
                                        );
                                      })}
                                      {bar.scrap > 0 && (
                                        <div
                                          style={{ width: `${(bar.scrap / bar.stockLength) * 100}%` }}
                                          className={`h-full flex items-center justify-center text-[9px] font-bold font-mono ${
                                            bar.isUsableOffcut
                                              ? 'bg-green-200 text-green-800 border-l border-green-400'
                                              : 'bg-red-100 text-red-600 border-l border-red-200'
                                          }`}
                                          title={`${bar.isUsableOffcut ? 'Reusable off-cut' : 'Scrap'}: ${bar.scrap}mm`}
                                        >
                                          {bar.scrap}mm
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Numbered Cut Sequence */}
                                  <div className="px-4 pb-3 flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[10px] font-bold text-slate-500 mr-1">Cut Order:</span>
                                    {bar.cuts.map((c, i) => (
                                      <span
                                        key={i}
                                        className="text-[10px] font-mono font-semibold bg-navy-50 border border-navy-200 text-navy-700 px-2 py-0.5 rounded"
                                        title={c.label}
                                      >
                                        {i + 1}. <strong>{c.lengthMm}mm</strong>
                                        {c.pieceDesc ? ` (${c.pieceDesc})` : ''}
                                      </span>
                                    ))}
                                    {bar.kerfBefore > 0 && (
                                      <span className="text-[10px] text-red-400 font-mono">+{bar.sawWaste}mm kerf waste</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {pieces.length === 0 && bars.length === 0 && !loadingOrder && (
        <div className="card text-center py-16 space-y-3">
          <Scissors size={40} className="mx-auto text-slate-200" />
          <p className="text-base font-bold text-slate-500">No Cut Plan Generated</p>
          <p className="text-sm text-slate-400">
            Select a customer order above to automatically calculate exact profile cut dimensions,<br />
            or add cut pieces manually using the form.
          </p>
        </div>
      )}
    </div>
  );
};

export default CutOptimizer;
