import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Search, Loader, ShoppingCart,
  CheckCircle2, Truck, Clock, Settings, X, GripVertical,
  PlusCircle, Columns, Printer, Send, Sparkles, Table, Check, Package2, Calculator,
  Scissors, CheckSquare, Square, BarChart2, ChevronDown, ChevronUp, AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import ExcelOrderWorkbook from '../components/ExcelOrderWorkbook';
import { useAuth } from '../context/AuthContext';
import { calculateItemBOM, printOrderCutSheet } from '../utils/bomCalculator';
import { extractCutPieces, optimizeCutList, printCuttingSheet } from '../utils/cutOptimizer';


const STATUSES = ['Pending', 'In Production', 'Completed', 'Delivered', 'Cancelled'];
const DEFAULT_COLUMNS = ['Product Type', 'Width (ft)', 'Height (ft)', 'Qty', 'Color / Finish', 'Glass Type', 'Notes'];
const makeEmptyRow = (columns) => columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {});

// ─────────────────────────────────────────────────────────────
// Print helper — opens a new window with a premium printable document
// ─────────────────────────────────────────────────────────────
const printOrder = (order, columns, isEmployee = false) => {
  let prods = [];
  try {
    const raw = order.products;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) prods = parsed;
  } catch (_) {}

  const colsToShow = columns;
  const deliveryDate = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Not specified';
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const balance = Number(order.remaining_balance || (Number(order.order_amount) - Number(order.advance_paid)));

  const productRows = prods.length > 0
    ? prods.map((row, i) => `
        <tr>
          <td>${i + 1}</td>
          ${colsToShow.map(col => `<td>${row[col] || '—'}</td>`).join('')}
        </tr>`).join('')
    : `<tr><td colspan="${colsToShow.length + 1}" style="text-align:center;color:#888;padding:16px">No product details recorded</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Order #${order.id} — ${order.customer_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20px; }
    .page { max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 20px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1B2A4A; }
    .brand-sub { font-size: 11px; color: #f97316; font-weight: 600; margin-top: 2px; }
    .brand-addr { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.5; }
    .order-badge { text-align: right; }
    .order-id { font-size: 20px; font-weight: 800; color: #f97316; }
    .order-date { font-size: 10px; color: #64748b; margin-top: 2px; }
    .status-tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; margin-top: 6px; background: #fef9c3; color: #854d0e; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 4px; }
    .info-value { font-size: 13px; font-weight: 600; color: #1e293b; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1B2A4A; border-left: 3px solid #f97316; padding-left: 8px; margin-bottom: 10px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #1B2A4A; color: white; }
    thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 11px; }
    .payment-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
    .pay-box { border-radius: 8px; padding: 12px; text-align: center; }
    .pay-box.total   { background: #eff6ff; border: 1px solid #bfdbfe; }
    .pay-box.advance { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .pay-box.balance { background: ${balance > 0 ? '#fff7ed; border: 1px solid #fed7aa' : '#f0fdf4; border: 1px solid #bbf7d0'}; }
    .pay-label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .pay-amount { font-size: 18px; font-weight: 800; color: #1B2A4A; margin-top: 4px; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
    .footer small { color: #94a3b8; font-size: 9px; }
    @media print { body { padding: 10px; } @page { margin: 15mm; size: A4; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">Image Creator</div>
      <div class="brand-sub">UPVC Products &amp; Interiors</div>
      <div class="brand-addr">9th Cross, GBH Layout, Tatanagar Main Road<br/>Near UIDAI Office, Bangalore - 560094</div>
    </div>
    <div class="order-badge">
      <div class="order-id">ORDER #${order.id}</div>
      <div class="order-date">Order Date: ${orderDate}</div>
      <div class="status-tag">${order.status}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">Customer Name</div><div class="info-value">${order.customer_name}</div></div>
    <div class="info-box"><div class="info-label">Contact Number</div><div class="info-value">${order.contact || '—'}</div></div>
    <div class="info-box"><div class="info-label">Delivery Date</div><div class="info-value">${deliveryDate}</div></div>
    <div class="info-box"><div class="info-label">Order Status</div><div class="info-value">${order.status}</div></div>
  </div>
  <h2>Product / Item Details</h2>
  <table>
    <thead><tr><th>#</th>${colsToShow.map(col => `<th>${col}</th>`).join('')}</tr></thead>
    <tbody>${productRows}</tbody>
  </table>
  ${!isEmployee ? `
  <h2>Payment Summary</h2>
  <div class="payment-grid">
    <div class="pay-box total"><div class="pay-label">Total Amount</div><div class="pay-amount">₹${Number(order.order_amount).toLocaleString('en-IN')}</div></div>
    <div class="pay-box advance"><div class="pay-label">Advance Paid</div><div class="pay-amount">₹${Number(order.advance_paid).toLocaleString('en-IN')}</div></div>
    <div class="pay-box balance"><div class="pay-label">${balance > 0 ? 'Balance Due' : 'Fully Paid'}</div><div class="pay-amount">₹${Math.abs(balance).toLocaleString('en-IN')}</div></div>
  </div>` : ''}
  ${order.notes ? `<h2>Notes</h2><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px"><p style="color:#92400e;font-size:11px">${order.notes}</p></div>` : ''}
  <div class="footer">
    <small>Generated by Image Creator UPVC ERP &bull; ${new Date().toLocaleString('en-IN')}</small>
    <small>Order #${order.id} &bull; ${order.customer_name}</small>
  </div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=950,height=700');
  if (win) { win.document.write(html); win.document.close(); }
  else toast.error('Popup blocked. Please allow popups for this site.');
};

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Column Manager Modal (with Drag & Drop Reordering)
// ─────────────────────────────────────────────────────────────
const ColumnManagerModal = ({ isOpen, onClose, columns, onSave }) => {
  const [draft, setDraft] = useState([...columns]);
  const [newCol, setNewCol] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDraft([...columns]);
      setDraggedIdx(null);
      setDragOverIdx(null);
    }
  }, [isOpen, columns]);

  const addCol = () => {
    const trimmed = newCol.trim();
    if (!trimmed) return;
    if (draft.includes(trimmed)) { toast.error('Column already exists'); return; }
    setDraft(d => [...d, trimmed]);
    setNewCol('');
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...draft];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(dropIndex, 0, draggedItem);

    setDraft(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const moveColumn = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.length) return;
    const updated = [...draft];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    setDraft(updated);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-navy-800 rounded-lg flex items-center justify-center">
              <Columns size={16} className="text-white" />
            </div>
            <h3 className="font-bold text-navy-800 text-lg">Manage Columns</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <p className="text-xs text-slate-500 mb-3">
          Drag and drop using the handle grip or use arrow buttons to reorder columns to your preferred location.
        </p>

        <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
          {draft.map((col, idx) => {
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
                  isDragging
                    ? 'opacity-40 bg-slate-100 border-dashed border-navy-400'
                    : isDragOver
                    ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-navy-800 transition-colors"
                  title="Drag and drop to reorder position"
                >
                  <GripVertical size={16} />
                </div>

                <span className="text-xs font-mono font-bold text-slate-400 w-4 text-center">
                  {idx + 1}
                </span>

                <input
                  className="input flex-1 h-8 text-xs py-1"
                  value={col}
                  onChange={e => setDraft(d => d.map((c, i) => i === idx ? e.target.value : c))}
                />

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveColumn(idx, -1)}
                    className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-navy-800 disabled:opacity-30 rounded hover:bg-slate-100"
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === draft.length - 1}
                    onClick={() => moveColumn(idx, 1)}
                    className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-navy-800 disabled:opacity-30 rounded hover:bg-slate-100"
                    title="Move Down"
                  >
                    ▼
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (draft.length <= 1) { toast.error('Need at least one column'); return; }
                    const colName = draft[idx];
                    setDraft(d => d.filter((_, i) => i !== idx));
                    toast.success(`Removed column "${colName}"`);
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title={`Delete column "${col}"`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mb-5">
          <input
            className="input flex-1 h-9 text-xs py-1"
            placeholder="Add custom column name..."
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCol();
              }
            }}
          />
          <button type="button" onClick={addCol} className="btn-accent h-9 px-3 text-xs font-bold flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-outline text-xs">Cancel</button>
          <button
            type="button"
            onClick={() => {
              const cleaned = draft.map(c => c.trim()).filter(Boolean);
              if (!cleaned.length) { toast.error('Add at least one column'); return; }
              onSave(cleaned);
              onClose();
            }}
            className="btn-primary text-xs font-semibold"
          >
            Save Columns Order
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Custom Icons for uPVC Items List
// ─────────────────────────────────────────────────────────────

// Multi-Chamber L-Shaped uPVC Extrusion Profile Icon (dynamically styled by color finish)
const UpvcProfileIconL = ({ finishName, className = "w-4 h-4" }) => {
  const colorMap = {
    'White (Standard)': {
      bg: '#FFFFFF',
      border: '#475569',
      chamber: '#E2E8F0',
      accent: '#94A3B8'
    },
    'Dark Oak Woodgrain': {
      bg: '#78350F',
      border: '#451A03',
      chamber: '#92400E',
      accent: '#F59E0B'
    },
    'Walnut Woodgrain': {
      bg: '#3B1A0E',
      border: '#1C0B05',
      chamber: '#522515',
      accent: '#C2410C'
    },
    'Anthracite Grey': {
      bg: '#334155',
      border: '#0F172A',
      chamber: '#475569',
      accent: '#94A3B8'
    },
    'Mahogany Woodgrain': {
      bg: '#701A1E',
      border: '#3B0A0C',
      chamber: '#881337',
      accent: '#F43F5E'
    }
  };

  const c = colorMap[finishName] || {
    bg: '#64748B',
    border: '#1E293B',
    chamber: '#475569',
    accent: '#94A3B8'
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer L-Profile Extrusion Body */}
      <path
        d="M3 3H11V13H21V21H3V3Z"
        fill={c.bg}
        stroke={c.border}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Inner Chamber Wall 1 (Vertical Insulated Chamber) */}
      <rect
        x="5.5"
        y="5.5"
        width="3"
        height="13"
        rx="0.5"
        fill={c.chamber}
        stroke={c.accent}
        strokeWidth="0.8"
      />
      {/* Inner Chamber Wall 2 (Horizontal Insulated Chamber) */}
      <rect
        x="10.5"
        y="15.5"
        width="8"
        height="3"
        rx="0.5"
        fill={c.chamber}
        stroke={c.accent}
        strokeWidth="0.8"
      />
      {/* Chamber Corner Detailing */}
      <circle cx="7" cy="7" r="0.8" fill={c.border} />
      <circle cx="14.5" cy="17" r="0.8" fill={c.border} />
    </svg>
  );
};

// Glass Pane Architectural Icon
const GlassPaneIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
    <path d="M7 7L17 17" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 6L18 12" stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// uPVC Domain Presets & Interactive Visual Metadata
// ─────────────────────────────────────────────────────────────
const PRODUCT_TYPE_PRESETS = [
  '2-Track Sliding Window',
  '2.5-Track Sliding Window',
  '3-Track Sliding Window (with Mesh)',
  'Casement Window',
  'Casement Door',
  'Fixed Glass Window',
  'Top-Hung Ventilator',
  'Custom uPVC Frame'
];

const PRODUCT_CATEGORY_CARDS = [
  { id: '2-Track Sliding Window', label: '2-Track Sliding', tag: 'Sliding', icon: '🪟' },
  { id: '2.5-Track Sliding Window', label: '2.5-Track Sliding', tag: 'Sliding', icon: '🪟' },
  { id: '3-Track Sliding Window (with Mesh)', label: '3-Track + Mesh', tag: 'Flyscreen', icon: '🪟' },
  { id: 'Casement Window', label: 'Casement Window', tag: 'Openable', icon: '🪟' },
  { id: 'Casement Door', label: 'Casement Door', tag: 'Door', icon: '🚪' },
  { id: 'Fixed Glass Window', label: 'Fixed Glass', tag: 'Picture', icon: '🖼️' },
  { id: 'Top-Hung Ventilator', label: 'Top-Hung Vent', tag: 'Ventilator', icon: '💨' },
  { id: 'Custom uPVC Frame', label: 'Custom Frame', tag: 'Special', icon: '🛠️' },
];

const COLOR_FINISH_SWATCHES = [
  { id: 'White (Standard)', color: '#FFFFFF', border: '#cbd5e1', label: 'White' },
  { id: 'Dark Oak Woodgrain', color: '#78350F', border: '#451a03', label: 'Dark Oak' },
  { id: 'Mahogany Woodgrain', color: '#701A1E', border: '#3b0a0c', label: 'Mahogany' },
];

const FINISH_PRESETS = [
  'White (Standard)',
  'Dark Oak Woodgrain',
  'Mahogany Woodgrain'
];

const GLASS_PRESETS = [
  'Clear',
  'Toughened',
  'Frosted',
  'Tinted',
  'Textured',
];

const calculateRowsTotalSum = (rows) => {
  return rows.reduce((sum, row) => {
    const explicitTotal = parseFloat(row['Total Amount'] || row['Total'] || row['Item Total'] || 0);
    if (!isNaN(explicitTotal) && explicitTotal > 0) return sum + explicitTotal;

    const width = parseFloat(row['Width (ft)'] || row['Width'] || 0);
    const height = parseFloat(row['Height (ft)'] || row['Height'] || 0);
    const qty = parseInt(row['Qty'] || row['Quantity'] || 1, 10);
    const rate = parseFloat(row['Rate / Sq.Ft'] || row['Rate'] || 0);
    if (width > 0 && height > 0 && rate > 0) {
      return sum + (width * height * qty * rate);
    }
    return sum;
  }, 0);
};

const ProductBuilder = ({ columns, rows, setRows, onManageColumns, onAutoUpdateAmount }) => {
  const [mode, setMode] = useState('configurator'); // 'configurator' | 'spreadsheet'
  const [editingIdx, setEditingIdx] = useState(null);

  const [itemForm, setItemForm] = useState({
    productType: '2-Track Sliding Window',
    customType: '',
    width: '',
    height: '',
    unit: 'ft',
    qty: '1',
    colorFinish: 'White (Standard)',
    glassType: 'Clear',
    ratePerSqFt: '',
    totalAmount: '',
    notes: ''
  });

  // Unit conversion helpers – everything is stored as raw user input, converted to ft for calculations
  const UNIT_TO_FT = { ft: 1, mm: 1 / 304.8 };
  const UNIT_LABELS = { ft: 'ft', mm: 'mm' };
  const AREA_LABELS = { ft: 'Sq.Ft', mm: 'Sq.mm' };

  const rawW = parseFloat(itemForm.width) || 0;
  const rawH = parseFloat(itemForm.height) || 0;
  const convFactor = UNIT_TO_FT[itemForm.unit] || 1;
  const w = rawW * convFactor;  // always in feet
  const h = rawH * convFactor;  // always in feet
  const q = parseInt(itemForm.qty, 10) || 1;
  const r = parseFloat(itemForm.ratePerSqFt) || 0;
  const liveSqFt = (w > 0 && h > 0) ? (w * h * q) : 0;
  const liveComputedPrice = (liveSqFt > 0 && r > 0) ? (liveSqFt * r) : 0;

  const liveBOM = (w > 0 && h > 0)
    ? calculateItemBOM(
        itemForm.productType === 'Custom uPVC Frame' && itemForm.customType ? itemForm.customType : itemForm.productType,
        w, h, q, itemForm.glassType
      )
    : null;

  const handleEditRow = (row) => {
    let idx = (row.id) ? rows.findIndex(r => r.id === row.id) : -1;
    if (idx === -1) idx = rows.findIndex(r => r === row);
    if (idx === -1) return;
    setEditingIdx(idx);
    const prodTypeVal = row['Product Type'] || row['productType'] || '2-Track Sliding Window';
    const isStandardType = PRODUCT_TYPE_PRESETS.includes(prodTypeVal);

    setItemForm({
      productType: isStandardType ? prodTypeVal : 'Custom uPVC Frame',
      customType: isStandardType ? '' : prodTypeVal,
      width: row['Width (ft)'] || row['width'] || '',
      height: row['Height (ft)'] || row['height'] || '',
      qty: row['Qty'] || row['qty'] || '1',
      colorFinish: row['Color / Finish'] || row['colorFinish'] || 'White (Standard)',
      glassType: row['Glass Type'] || row['glassType'] || 'Clear',
      ratePerSqFt: row['Rate / Sq.Ft'] || row['ratePerSqFt'] || '',
      totalAmount: row['Total Amount'] || row['Total'] || '',
      notes: row['Notes'] || row['notes'] || ''
    });
  };

  const handleResetForm = () => {
    setEditingIdx(null);
    setItemForm(prev => ({
      productType: '2-Track Sliding Window',
      customType: '',
      width: '',
      height: '',
      unit: prev.unit || 'ft',  // keep selected unit across resets
      qty: '1',
      colorFinish: prev.colorFinish || 'White (Standard)',
      glassType: prev.glassType || 'Clear',
      ratePerSqFt: '',
      totalAmount: '',
      notes: ''
    }));
  };

  const handleSaveItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const finalProductType = itemForm.productType === 'Custom uPVC Frame' && itemForm.customType
      ? itemForm.customType.trim()
      : itemForm.productType;

    if (!finalProductType) {
      toast.error('Please enter or select a Product Type');
      return;
    }

    const calculatedTotal = itemForm.totalAmount
      ? parseFloat(itemForm.totalAmount)
      : liveComputedPrice;

    const unitLabel = UNIT_LABELS[itemForm.unit] || 'ft';
    const newRow = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,8),
      'Product Type': finalProductType,
      [`Width (${unitLabel})`]: itemForm.width || '—',
      [`Height (${unitLabel})`]: itemForm.height || '—',
      'Qty': itemForm.qty || '1',
      'Color / Finish': itemForm.colorFinish,
      'Glass Type': itemForm.glassType,
      'Notes': itemForm.notes,
      'Sq.Ft': liveSqFt ? liveSqFt.toFixed(3) : '',
      'Rate / Sq.Ft': itemForm.ratePerSqFt ? itemForm.ratePerSqFt : '',
      'Total Amount': calculatedTotal ? calculatedTotal.toFixed(2) : ''
    };

    columns.forEach(col => {
      if (newRow[col] === undefined) {
        newRow[col] = '';
      }
    });

    let updatedRows = [];
    if (editingIdx !== null) {
      updatedRows = rows.map((r, i) => i === editingIdx ? newRow : r);
      toast.success('Item updated in list');
    } else {
      const cleaned = rows.filter(r => Object.values(r).some(val => val && val.toString().trim() !== ''));
      updatedRows = [...cleaned, newRow];
      toast.success('Item added to order!');
    }

    setRows(updatedRows);
    handleResetForm();

    const newSum = calculateRowsTotalSum(updatedRows);
    if (newSum > 0 && onAutoUpdateAmount) {
      onAutoUpdateAmount(newSum.toFixed(2));
    }
  };

  const handleRemoveRow = (idx) => {
    const updated = rows.filter((_, i) => i !== idx);
    setRows(updated);
    if (editingIdx === idx) handleResetForm();
    const newSum = calculateRowsTotalSum(updated);
    if (onAutoUpdateAmount) {
      onAutoUpdateAmount(newSum > 0 ? newSum.toFixed(2) : '');
    }
  };

  const addSpreadsheetRow = () => setRows(r => [...r, makeEmptyRow(columns)]);
  const updateSpreadsheetCell = (rowIdx, col, val) => setRows(r => r.map((row, i) => i === rowIdx ? { ...row, [col]: val } : row));

  const validRows = rows.filter(r => Object.values(r).some(val => val && val.toString().trim() !== ''));
  const totalWindowQty = validRows.reduce((s, r) => s + (parseInt(r['Qty'] || 1, 10) || 1), 0);
  const totalSqFtSum = validRows.reduce((s, r) => {
    const sq = parseFloat(r['Sq.Ft']) || (parseFloat(r['Width (ft)']) * parseFloat(r['Height (ft)']) * (parseInt(r['Qty'], 10) || 1));
    return s + (isNaN(sq) ? 0 : sq);
  }, 0);
  const calculatedGrandTotal = calculateRowsTotalSum(validRows);

  return (
    <div className="space-y-4">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-navy-800 flex items-center gap-1.5">
            <Sparkles size={16} className="text-orange-500" />
            Product &amp; Specification Configurator
          </h3>
          <p className="text-xs text-slate-500">Add window &amp; door items with instant area, rate &amp; BOM estimation</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('configurator')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${mode === 'configurator' ? 'bg-white text-navy-800 shadow-sm font-bold' : 'text-slate-600 hover:text-navy-800'}`}
            >
              <Sparkles size={13} /> Visual Form
            </button>
            <button
              type="button"
              onClick={() => setMode('spreadsheet')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${mode === 'spreadsheet' ? 'bg-white text-navy-800 shadow-sm font-bold' : 'text-slate-600 hover:text-navy-800'}`}
            >
              <Table size={13} /> Spreadsheet
            </button>
          </div>
          <button
            type="button"
            onClick={onManageColumns}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-navy-800 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg bg-white shadow-xs transition-all"
            title="Customize Table Columns"
          >
            <Settings size={13} /> Columns
          </button>
        </div>
      </div>

      {mode === 'configurator' ? (
        <div className="space-y-4">
          {/* Interactive Item Builder Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
            {/* Header / Active Editing Notice */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  {editingIdx !== null ? `Editing Item #${editingIdx + 1}` : 'Select Window / Door Product'}
                </span>
              </div>
              {editingIdx !== null && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200"
                >
                  ✕ Cancel Edit
                </button>
              )}
            </div>

            {/* 1. Visual Product Type Selection Grid */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                1. Product Type Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRODUCT_CATEGORY_CARDS.map(cat => {
                  const isSelected = itemForm.productType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setItemForm(p => ({ ...p, productType: cat.id }))}
                      className={`relative p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                        isSelected
                          ? 'border-orange-500 bg-gradient-to-br from-orange-50/80 to-amber-50/50 shadow-md ring-2 ring-orange-400/30'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{cat.icon}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {cat.tag}
                        </span>
                      </div>
                      <p className={`text-xs font-bold truncate mt-1 ${isSelected ? 'text-orange-950' : 'text-navy-900'}`}>
                        {cat.label}
                      </p>
                    </button>
                  );
                })}
              </div>

              {itemForm.productType === 'Custom uPVC Frame' && (
                <div className="mt-2.5">
                  <input
                    className="input text-xs h-9 bg-slate-50 focus:bg-white"
                    placeholder="Enter custom frame name (e.g. Arch Window, Corner Fixed Frame, L-Shape Sliding)..."
                    value={itemForm.customType}
                    onChange={e => setItemForm(p => ({ ...p, customType: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* 2. Dimensions & Live Proportioned Preview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
              <div className="md:col-span-8 space-y-3">
                {/* Section label + Unit Selector */}
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    2. Dimensions &amp; Quantity
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <span className="text-[10px] font-bold text-slate-400 pl-1.5 pr-1">Unit:</span>
                    {['ft', 'mm'].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setItemForm(p => ({ ...p, unit: u, width: '', height: '' }))}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                          itemForm.unit === u
                            ? 'bg-orange-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Width ({UNIT_LABELS[itemForm.unit]}) *
                    </label>
                    <input
                      type="number"
                      step={itemForm.unit === 'mm' ? '1' : '0.01'}
                      placeholder={itemForm.unit === 'mm' ? 'e.g. 1524' : 'e.g. 5.0'}
                      className="input text-xs h-9 font-mono font-bold bg-slate-50/50 focus:bg-white"
                      value={itemForm.width}
                      onChange={e => setItemForm(p => ({ ...p, width: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Height ({UNIT_LABELS[itemForm.unit]}) *
                    </label>
                    <input
                      type="number"
                      step={itemForm.unit === 'mm' ? '1' : '0.01'}
                      placeholder={itemForm.unit === 'mm' ? 'e.g. 1219' : 'e.g. 4.0'}
                      className="input text-xs h-9 font-mono font-bold bg-slate-50/50 focus:bg-white"
                      value={itemForm.height}
                      onChange={e => setItemForm(p => ({ ...p, height: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="input text-xs h-9 font-mono font-bold bg-slate-50/50 focus:bg-white"
                      value={itemForm.qty}
                      onChange={e => setItemForm(p => ({ ...p, qty: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 3. Color Finish & Glass Type Selector Pills */}
                <div className="space-y-2 pt-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    3. Color Finish &amp; Glass Spec
                  </label>

                  {/* Finish Swatches */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-400 font-medium mr-1">Finish:</span>
                    {COLOR_FINISH_SWATCHES.map(swatch => {
                      const isSelected = itemForm.colorFinish === swatch.id;
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          onClick={() => setItemForm(p => ({ ...p, colorFinish: swatch.id }))}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'border-navy-800 bg-navy-800 text-white shadow-xs'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <span
                            style={{ backgroundColor: swatch.color, borderColor: swatch.border }}
                            className="w-3.5 h-3.5 rounded-full border shadow-xs inline-block"
                          />
                          {swatch.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Glass – Quick-pick pills + free-text custom input */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 font-medium mr-1">Glass:</span>
                      {GLASS_PRESETS.map(glass => {
                        const isSelected = itemForm.glassType === glass;
                        return (
                          <button
                            key={glass}
                            type="button"
                            onClick={() => setItemForm(p => ({ ...p, glassType: glass }))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                              isSelected
                                ? 'border-cyan-600 bg-cyan-50 text-cyan-800 font-bold shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {glass}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      className="input text-xs h-8 bg-slate-50/60 focus:bg-white placeholder:text-slate-400"
                      placeholder="Or type a custom glass spec (e.g. 8mm Toughened, 32mm Triple DGU, Argon-Filled)..."
                      value={GLASS_PRESETS.includes(itemForm.glassType) ? '' : itemForm.glassType}
                      onChange={e => setItemForm(p => ({ ...p, glassType: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Rate & Pricing Row */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Rate / Sq.Ft (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 350"
                      className="input text-xs h-9 bg-white font-mono"
                      value={itemForm.ratePerSqFt}
                      onChange={e => setItemForm(p => ({ ...p, ratePerSqFt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">
                      Item Total (₹) {liveComputedPrice > 0 && <span className="text-green-600 font-bold">(Calculated)</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={liveComputedPrice ? liveComputedPrice.toFixed(2) : "0.00"}
                      className="input text-xs h-9 bg-slate-50 font-mono font-bold text-navy-900"
                      value={itemForm.totalAmount}
                      onChange={e => setItemForm(p => ({ ...p, totalAmount: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Item Notes */}
                <div>
                  <input
                    className="input text-xs h-8 bg-slate-50/50 placeholder:text-slate-400"
                    placeholder="Add item notes (e.g. SS 304 Mesh included, handle on right, granite sill alignment)..."
                    value={itemForm.notes}
                    onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Proportioned Visual Aspect Ratio Frame Preview Card */}
              <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between items-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Visual Frame Preview
                </span>

                <div className="my-2 flex flex-col items-center justify-center w-full h-32 relative">
                  {w > 0 && h > 0 ? (
                    <div
                      style={{
                        width: Math.min(130, Math.max(50, (w / (h || 1)) * 70)),
                        height: Math.min(100, Math.max(50, (h / (w || 1)) * 70)),
                        borderColor: COLOR_FINISH_SWATCHES.find(s => s.id === itemForm.colorFinish)?.border || '#334155',
                        backgroundColor: itemForm.colorFinish.includes('White') ? '#ffffff' : '#f8fafc',
                      }}
                      className="border-4 rounded shadow-md relative flex items-center justify-center transition-all duration-300"
                    >
                      {/* Glass Glaze Reflection Line */}
                      <div className="absolute inset-1 bg-gradient-to-br from-cyan-200/30 to-blue-300/10 border border-cyan-300/40 rounded flex items-center justify-center">
                        <span className="text-[10px] font-bold font-mono text-cyan-900 bg-white/80 px-1 rounded shadow-2xs">
                          {rawW}{itemForm.unit === 'ft' ? '\u2032' : itemForm.unit} × {rawH}{itemForm.unit === 'ft' ? '\u2032' : itemForm.unit}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400">
                      <UpvcProfileIconL finishName={itemForm.colorFinish} className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[10px]">Enter W × H</span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-white rounded-lg p-2 border border-slate-200 shadow-xs space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Area (Sq.Ft):</span>
                    <span className="font-mono font-bold text-orange-600">{liveSqFt ? liveSqFt.toFixed(3) : '0.000'} ft²</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Est. Price:</span>
                    <span className="font-mono font-bold text-green-700">
                      ₹{liveComputedPrice ? liveComputedPrice.toLocaleString('en-IN') : (parseFloat(itemForm.totalAmount) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="w-full mt-2.5 btn-accent text-xs h-9 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus size={15} />
                  {editingIdx !== null ? 'Update Item' : 'Add Item to Order'}
                </button>
              </div>
            </div>

            {/* Live BOM Breakdown Expandable Card */}
            {liveBOM && (
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                  <span className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
                    <Calculator size={14} className="text-blue-600" />
                    Live Material BOM Estimate ({w} ft × {h} ft / {liveBOM.dimensions.wMm} × {liveBOM.dimensions.hMm} mm)
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    Est. Material Cost: ₹{liveBOM.costTotal.toLocaleString('en-IN')} ({q} Unit{q > 1 ? 's' : ''})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">📐 uPVC Profiles</p>
                    {liveBOM.total.profiles.map((p, idx) => (
                      <p key={idx} className="text-[11px] text-slate-700 font-medium truncate">
                        {p.name}: <strong className="text-blue-700 font-mono">{p.qtyTotal} m</strong>
                      </p>
                    ))}
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🪟 Glass Panel</p>
                    {liveBOM.total.glass.map((g, idx) => (
                      <p key={idx} className="text-[11px] text-slate-700 font-medium">
                        {g.name}: <strong className="text-cyan-700 font-mono">{g.qtyTotal} sq.ft</strong>
                      </p>
                    ))}
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🔩 Hardware &amp; Gaskets</p>
                    <p className="text-[11px] text-slate-700">
                      Hardware: <strong className="text-amber-700 font-mono">{liveBOM.summary.totalHardwarePcs} pcs</strong>
                    </p>
                    <p className="text-[11px] text-slate-700">
                      Rubber Gaskets: <strong className="text-emerald-700 font-mono">{liveBOM.total.gaskets.reduce((s, g) => s + g.qtyTotal, 0)} m</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Added Products Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-navy-800 rounded-full" />
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Order Line Items ({validRows.length})
                </h4>
              </div>

              {validRows.length > 0 && (
                <div className="text-xs text-slate-600 font-mono flex items-center gap-3 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <span>Units: <strong className="text-navy-900 font-bold">{totalWindowQty}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Area: <strong className="text-navy-900 font-bold">{totalSqFtSum.toFixed(2)} Sq.Ft</strong></span>
                  {calculatedGrandTotal > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>Subtotal: <strong className="text-green-700 font-bold">₹{calculatedGrandTotal.toLocaleString('en-IN')}</strong></span>
                    </>
                  )}
                </div>
              )}
            </div>

            {validRows.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/60 border border-dashed border-slate-300 rounded-2xl">
                <ShoppingCart size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No items added to order yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Select product type and dimensions above, then click "Add Item to Order".</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-navy-900 text-white font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-10">#</th>
                      <th className="px-3 py-2.5">Product Specification</th>
                      <th className="px-3 py-2.5 text-center">Size (W × H)</th>
                      <th className="px-3 py-2.5 text-center">Qty</th>
                      <th className="px-3 py-2.5 text-center">Area (Sq.Ft)</th>
                      <th className="px-3 py-2.5">Finish</th>
                      <th className="px-3 py-2.5">Glass Spec</th>
                      <th className="px-3 py-2.5 text-right">Total (₹)</th>
                      <th className="px-3 py-2.5 text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {validRows.map((row, idx) => {
                      const rowsIdx = rows.indexOf(row);
                      const prodName = row['Product Type'] || 'uPVC Item';
                      const width = row['Width (ft)'];
                      const height = row['Height (ft)'];
                      const qty = row['Qty'] || '1';
                      const finish = row['Color / Finish'];
                      const glass = row['Glass Type'];
                      const sqft = row['Sq.Ft'] || (parseFloat(width) && parseFloat(height) ? (parseFloat(width) * parseFloat(height) * parseFloat(qty)).toFixed(2) : '—');
                      const rate = row['Rate / Sq.Ft'];
                      const itemTotal = row['Total Amount'] || row['Total'] || (sqft !== '—' && rate ? (parseFloat(sqft) * parseFloat(rate)).toFixed(2) : '—');
                      const isEditing = editingIdx === rowsIdx;
                      const swatch = COLOR_FINISH_SWATCHES.find(s => s.id === finish);

                      return (
                        <tr
                          key={row.id || idx}
                          className={`transition-colors ${
                            isEditing ? 'bg-orange-50/80 ring-1 ring-inset ring-orange-400' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')
                          } hover:bg-slate-100/60`}
                        >
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-bold text-navy-900">
                            <div>{prodName}</div>
                            {row['Notes'] && <div className="text-[10px] text-slate-500 font-normal italic">Note: {row['Notes']}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-700 whitespace-nowrap">
                            {(width && height && width !== '—' && height !== '—') ? `${width} ft × ${height} ft` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-navy-800">{qty}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                            {sqft !== '—' ? `${Number(sqft).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              {swatch && (
                                <span style={{ backgroundColor: swatch.color, borderColor: swatch.border }} className="w-3 h-3 rounded-full border shadow-2xs inline-block" />
                              )}
                              {finish || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{glass || '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700">
                            {itemTotal !== '—' ? `₹${Number(itemTotal).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditRow(row)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                title="Edit Item"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(rowsIdx)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Delete Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (

        /* Spreadsheet Mode */
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-navy-800 text-white">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold w-8">#</th>
                  {columns.map(col => <th key={col} className="text-left px-3 py-2 text-xs font-semibold whitespace-nowrap">{col}</th>)}
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={`border-t border-slate-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-3 py-1.5 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                    {columns.map(col => (
                      <td key={col} className="px-1 py-1">
                        <input
                          className="w-full min-w-[80px] px-2 py-1.5 text-xs border border-transparent hover:border-slate-200 focus:border-orange-400 focus:outline-none rounded-lg bg-transparent focus:bg-white transition-all"
                          value={row[col] || ''}
                          onChange={e => updateSpreadsheetCell(rowIdx, col, e.target.value)}
                          placeholder={col}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => handleRemoveRow(rowIdx)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addSpreadsheetRow}
            className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium border border-dashed border-orange-300 hover:border-orange-500 w-full justify-center py-2 rounded-xl transition-all hover:bg-orange-50">
            <PlusCircle size={15} /> Add Row
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Cut Optimizer Modal — embedded in Orders page as a BOM action
// ─────────────────────────────────────────────────────────────
const CUT_TRACK_ORDER = [
  '2-Track Sliding Window', '2.5-Track Sliding Window', '3-Track Sliding Window',
  'Ventilator Window', 'Casement Window', 'Tilt & Turn Window', 'Fixed / Picture Window',
];
const CUT_CATEGORY_ORDER = ['outer frame', 'sash', 'glazing bead', 'bead', 'interlock', 'mullion', 'other'];
const getCutCategory = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('outer frame') || n.includes('fixed outer')) return 'outer frame';
  if (n.includes('sash')) return 'sash';
  if (n.includes('glazing bead') || n.includes('bead')) return 'glazing bead';
  if (n.includes('interlock')) return 'interlock';
  if (n.includes('mullion')) return 'mullion';
  return 'other';
};
const cutCatOrder = (name) => { const i = CUT_CATEGORY_ORDER.indexOf(getCutCategory(name)); return i === -1 ? 99 : i; };
const cutTrackOrder = (t) => { const i = CUT_TRACK_ORDER.indexOf(t); return i === -1 ? 99 : i; };

const TRACK_COLORS_MAP = {
  '2-Track Sliding Window':   { hdr: 'bg-blue-700',   badge: 'bg-blue-100 text-blue-800',   border: 'border-blue-200' },
  '2.5-Track Sliding Window': { hdr: 'bg-indigo-700', badge: 'bg-indigo-100 text-indigo-800', border: 'border-indigo-200' },
  '3-Track Sliding Window':   { hdr: 'bg-violet-700', badge: 'bg-violet-100 text-violet-800', border: 'border-violet-200' },
  'Ventilator Window':        { hdr: 'bg-cyan-700',   badge: 'bg-cyan-100 text-cyan-800',   border: 'border-cyan-200' },
  'Casement Window':          { hdr: 'bg-amber-700',  badge: 'bg-amber-100 text-amber-800',  border: 'border-amber-200' },
  'Tilt & Turn Window':       { hdr: 'bg-rose-700',   badge: 'bg-rose-100 text-rose-800',   border: 'border-rose-200' },
  'Fixed / Picture Window':   { hdr: 'bg-slate-600',  badge: 'bg-slate-100 text-slate-700',  border: 'border-slate-200' },
};
const tc = (track) => TRACK_COLORS_MAP[track] || { hdr: 'bg-navy-700', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200' };

const BAR_SEGMENT_COLORS = ['#1B3A6B','#2563EB','#7C3AED','#0891B2','#B45309','#065F46','#9F1239','#374151','#1D4ED8','#6D28D9'];

const CutOptimizerModal = ({ isOpen, onClose, order }) => {
  const [stockLength, setStockLength] = useState(6000);
  const [sawKerf, setSawKerf]         = useState(4);
  const [minOffcut, setMinOffcut]     = useState(300);
  const [barsDone, setBarsDone]       = useState({});
  const [collapsed, setCollapsed]     = useState({});

  // Extract pieces from order items whenever order changes
  const pieces = useMemo(() => {
    if (!order) return [];
    let prods = [];
    try { const r = order.products; prods = typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch { prods = []; }
    if (!prods.length) return [];
    const itemsWithId = prods.map(p => ({ ...p, orderId: order.id }));
    return extractCutPieces(itemsWithId);
  }, [order]);

  const optimization = useMemo(() =>
    optimizeCutList(pieces, stockLength, sawKerf, minOffcut),
    [pieces, stockLength, sawKerf, minOffcut]
  );
  const { bars, summary } = optimization;

  // Group bars by track → profile for display
  const grouped = useMemo(() => {
    const g = {};
    bars.forEach(b => {
      const tk = b.trackType || 'General';
      if (!g[tk]) g[tk] = {};
      if (!g[tk][b.profileType]) g[tk][b.profileType] = [];
      g[tk][b.profileType].push(b);
    });
    return g;
  }, [bars]);
  const orderedTracks = CUT_TRACK_ORDER.filter(t => grouped[t]);

  const toggleBar = (n) => setBarsDone(p => ({ ...p, [n]: !p[n] }));
  const doneBars  = bars.filter(b => barsDone[b.barNumber]).length;
  const allDone   = bars.length > 0 && doneBars === bars.length;

  const handlePrint = () =>
    printCuttingSheet(optimization, {
      title: `Order #${order?.id} — ${order?.customer_name || ''}`,
      customer: order?.customer_name,
      orderId: order?.id,
    });

  // Reset state when modal opens for a new order
  useEffect(() => { if (isOpen) { setBarsDone({}); setCollapsed({}); } }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`✂ Profile Cut Plan — Order #${order.id}`} size="xl">
      <div className="space-y-4">
        {/* Parameters row */}
        <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Stock Bar Length (mm)</span>
            <input type="number" min="3000" max="9000" step="100" value={stockLength}
              onChange={e => setStockLength(parseFloat(e.target.value)||6000)}
              className="input h-8 text-xs font-mono font-bold w-28" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Saw Kerf (mm)</span>
            <input type="number" min="1" max="10" step="0.5" value={sawKerf}
              onChange={e => setSawKerf(parseFloat(e.target.value)||4)}
              className="input h-8 text-xs font-mono font-bold w-20" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Min Reusable Off-cut (mm)</span>
            <input type="number" min="50" max="2000" step="50" value={minOffcut}
              onChange={e => setMinOffcut(parseFloat(e.target.value)||300)}
              className="input h-8 text-xs font-mono font-bold w-28" />
          </div>
          <div className="flex-1" />
          {bars.length > 0 && (
            <button onClick={handlePrint} className="btn-accent flex items-center gap-2 text-xs h-8 px-4 shadow">
              <Printer size={13} /> Print Cutting Sheet
            </button>
          )}
        </div>

        {/* Piece count info */}
        {pieces.length > 0 ? (
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span className="font-bold text-navy-800">{pieces.length}</span> individual cut pieces extracted from order
            <span className="text-slate-300">|</span>
            <span className="font-bold text-navy-800">{summary.totalBarsNeeded}</span> bars needed
            <span className="text-slate-300">|</span>
            <span className={`font-bold ${summary.utilizationPct>=80?'text-green-600':summary.utilizationPct>=60?'text-amber-500':'text-red-500'}`}>
              {summary.utilizationPct}% utilization
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-bold text-red-500">{summary.totalScrapMm} mm scrap</span>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Scissors size={28} className="mx-auto mb-2 opacity-30" />
            <p>No valid product dimensions found in this order.</p>
            <p className="text-xs">Add Width (ft), Height (ft), and Product Type to order items first.</p>
          </div>
        )}

        {/* Confirmation progress */}
        {bars.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-max">
              {allDone
                ? <CheckCircle2 size={15} className="text-green-500" />
                : <AlertCircle size={15} className="text-amber-500" />}
              <span className="text-xs font-bold text-navy-800">
                {allDone ? 'All bars confirmed!' : `${doneBars}/${bars.length} bars confirmed`}
              </span>
            </div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className={`h-full rounded-full transition-all duration-500 ${allDone?'bg-green-500':'bg-orange-500'}`}
                style={{width:`${bars.length?(doneBars/bars.length)*100:0}%`}} />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500">{bars.length?Math.round((doneBars/bars.length)*100):0}%</span>
          </div>
        )}

        {/* Bar-by-bar cutting plan grouped by track → profile */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {orderedTracks.map(track => {
            const profileGroups = grouped[track];
            const color = tc(track);
            const trackBars = Object.values(profileGroups).flat();
            const trackDone = trackBars.filter(b => barsDone[b.barNumber]).length;
            const isCollapsed = collapsed[track];
            const sortedProfiles = Object.keys(profileGroups).sort((a,b) => cutCatOrder(a)-cutCatOrder(b));

            return (
              <div key={track} className={`rounded-xl border-2 overflow-hidden ${color.border}`}>
                {/* Track header */}
                <button
                  className={`w-full ${color.hdr} text-white flex items-center justify-between px-4 py-2.5`}
                  onClick={() => setCollapsed(p => ({...p, [track]: !p[track]}))}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-xs tracking-wide uppercase">{track}</span>
                    <span className="text-white/60 text-[10px]">{trackBars.length} bars</span>
                    {trackDone===trackBars.length && trackBars.length>0 &&
                      <span className="bg-green-400 text-green-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">✓ DONE</span>}
                  </div>
                  <div className="flex items-center gap-2 text-white/70 text-[10px]">
                    {trackDone}/{trackBars.length} done
                    {isCollapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="bg-white">
                    {sortedProfiles.map((profileType, ptIdx) => {
                      const ptBars = profileGroups[profileType];
                      return (
                        <div key={profileType} className={ptIdx>0?'border-t border-slate-100':''}>
                          {/* Profile sub-header */}
                          <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <Scissors size={11} className="text-orange-500" />
                              <span className="text-[11px] font-extrabold text-navy-800 uppercase tracking-wider">{profileType}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${color.badge}`}>
                                {ptBars.length} bar{ptBars.length!==1?'s':''} · {ptBars.reduce((s,b)=>s+b.cuts.length,0)} cuts
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {ptBars.reduce((s,b)=>s+b.usedLength,0)} mm used
                            </span>
                          </div>

                          {/* Individual bars */}
                          <div className="p-3 space-y-2">
                            {ptBars.map(bar => {
                              const isDone = barsDone[bar.barNumber];
                              return (
                                <div key={bar.barNumber}
                                  className={`rounded-lg border-2 transition-all ${
                                    isDone ? 'border-green-400 bg-green-50/30' : 'border-slate-200 hover:border-slate-300'
                                  }`}>
                                  {/* Bar header row */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded text-white ${color.hdr}`}>BAR #{bar.barNumber}</span>
                                      <span className="text-[11px] font-semibold text-slate-600">{bar.finish}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono text-slate-500">Used: <strong className="text-navy-800">{bar.usedLength}mm</strong></span>
                                      <span className={`text-[10px] font-mono font-bold ${
                                        bar.isUsableOffcut?'text-green-600':'text-red-500'
                                      }`}>
                                        Off-cut: {bar.scrap}mm {bar.isUsableOffcut?'↩':'✗'}
                                      </span>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        bar.efficiencyPct>=80?'bg-green-100 text-green-800':bar.efficiencyPct>=60?'bg-amber-100 text-amber-800':'bg-red-100 text-red-700'
                                      }`}>{bar.efficiencyPct}%</span>
                                      {/* Confirmation tick button */}
                                      <button
                                        onClick={() => toggleBar(bar.barNumber)}
                                        title={isDone?'Mark as pending':'Mark bar as cut'}
                                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border-2 transition-all ${
                                          isDone
                                            ? 'border-green-500 bg-green-500 text-white'
                                            : 'border-slate-300 text-slate-400 hover:border-green-400 hover:text-green-600'
                                        }`}
                                      >
                                        {isDone ? <CheckSquare size={11}/> : <Square size={11}/>}
                                        {isDone ? 'Done ✓' : 'Confirm'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Visual bar diagram */}
                                  <div className="px-3 pb-1">
                                    <div className="w-full h-7 bg-slate-100 rounded overflow-hidden flex border border-slate-200">
                                      {bar.cuts.map((cut, i) => {
                                        const pct = (cut.lengthMm/bar.stockLength)*100;
                                        const kpct = ((cut.kerfBefore||0)/bar.stockLength)*100;
                                        const col = BAR_SEGMENT_COLORS[i%BAR_SEGMENT_COLORS.length];
                                        return (
                                          <React.Fragment key={i}>
                                            {kpct>0 && <div style={{width:`${kpct}%`}} className="bg-red-400 h-full" title="Kerf"/>}
                                            <div style={{width:`${pct}%`,backgroundColor:col}}
                                              className="h-full border-r border-white/20 flex items-center justify-center text-[8px] font-bold text-white font-mono overflow-hidden"
                                              title={`${cut.pieceDesc||cut.label}: ${cut.lengthMm}mm`}>
                                              {cut.lengthMm}
                                            </div>
                                          </React.Fragment>
                                        );
                                      })}
                                      {bar.scrap>0 && (
                                        <div style={{width:`${(bar.scrap/bar.stockLength)*100}%`}}
                                          className={`h-full flex items-center justify-center text-[8px] font-bold font-mono ${
                                            bar.isUsableOffcut?'bg-green-200 text-green-800':'bg-red-100 text-red-600'
                                          }`}>
                                          {bar.scrap}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Cut sequence text */}
                                  <div className="px-3 pb-2 flex flex-wrap gap-1 items-center">
                                    <span className="text-[9px] font-bold text-slate-400 mr-1">Cut Order:</span>
                                    {bar.cuts.map((c,i) => (
                                      <span key={i} className="text-[9px] font-mono bg-navy-50 border border-navy-200 text-navy-700 px-1.5 py-0.5 rounded" title={c.label}>
                                        {i+1}. <strong>{c.lengthMm}mm</strong> {c.pieceDesc?`(${c.pieceDesc})`:''}
                                      </span>
                                    ))}
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

        {bars.length === 0 && pieces.length > 0 && (
          <p className="text-center text-sm text-slate-400 py-4">Adjust parameters above to generate the cutting plan.</p>
        )}
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Orders component
// ─────────────────────────────────────────────────────────────
const EMPTY_ORDER = { customer_name: '', contact: '', delivery_date: '', order_amount: '', advance_paid: '', status: 'Pending', notes: '' };

const Orders = () => {
  const { isEmployee, can } = useAuth();
  const [orders,      setOrders]      = useState([]);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [colModal,    setColModal]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [viewing,     setViewing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY_ORDER);
  const [saving,      setSaving]      = useState(false);
  const [columns,     setColumns]     = useState(DEFAULT_COLUMNS);
  const [rows,        setRows]        = useState([makeEmptyRow(DEFAULT_COLUMNS)]);
  const [nudgeModal,  setNudgeModal]  = useState(false);
  const [nudgeOrder,  setNudgeOrder]  = useState(null);
  const [nudgeType,   setNudgeType]   = useState('payment_reminder');
  const [nudging,     setNudging]     = useState(false);
  const [waConnected, setWaConnected] = useState(true); // WhatsApp connection status
  const [cutModal,    setCutModal]    = useState(false);
  const [cutOrder,    setCutOrder]    = useState(null);
  const [orderEntryMode, setOrderEntryMode] = useState('excel'); // 'excel' | 'classic'
  const [ratePerSqFt,    setRatePerSqFt]    = useState('350');
  const [viewTab,        setViewTab]        = useState('workbook'); // 'workbook' | 'overview'

  // Check WhatsApp connection status on mount
  useEffect(() => {
    api.get('/whatsapp/status')
      .then(res => setWaConnected(res.data?.data?.connected === true))
      .catch(() => setWaConnected(false));
  }, []);

  const warnIfWaOffline = () => {
    if (!waConnected) {
      toast.error(
        '⚠️ WhatsApp is not connected — no messages will be sent!\nGo to the WhatsApp page to reconnect.',
        { duration: 6000, id: 'wa-offline' }
      );
    }
  };

  const openNudge = (o) => {
    setNudgeOrder(o);
    const hasPending = Number(o.remaining_balance || (Number(o.order_amount) - Number(o.advance_paid))) > 0;
    setNudgeType(hasPending ? 'payment_reminder' : 'delivery_reminder');
    setNudgeModal(true);
  };

  const triggerNudge = async (typeToSend) => {
    if (!nudgeOrder) return;
    if (!waConnected) {
      toast.error('⚠️ WhatsApp is not connected. Go to the WhatsApp page and reconnect first.', { duration: 5000 });
      return;
    }
    setNudging(true);
    try {
      const res = await api.post('/whatsapp/nudge', { orderId: nudgeOrder.id, nudgeType: typeToSend || nudgeType });
      if (res.data.success) {
        toast.success(`WhatsApp ${typeToSend === 'delivery_reminder' ? 'Delivery update' : 'Payment reminder'} sent to ${nudgeOrder.customer_name}!`);
        setNudgeModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send WhatsApp message.');
    } finally {
      setNudging(false);
    }
  };

  const loadColumns = useCallback(async () => {
    // 1. Load from local browser storage instantly
    const local = localStorage.getItem('upvc_order_columns');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumns(parsed);
        }
      } catch (_) {}
    }

    // 2. Fetch latest from MySQL backend database
    try {
      const res = await api.get('/settings/order_columns');
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        setColumns(res.data.data);
        localStorage.setItem('upvc_order_columns', JSON.stringify(res.data.data));
      }
    } catch (_) {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/orders'); setOrders(res.data.data || []); }
    catch { toast.error('Failed to load orders.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); loadColumns(); }, [load, loadColumns]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_ORDER);
    setRows([]);
    setOrderEntryMode('excel');
    setModal(true);
  };

  const openEdit = (o) => {
    setEditing(o.id);
    setForm({
      customer_name: o.customer_name,
      contact: o.contact || '',
      delivery_date: o.delivery_date?.split('T')[0] || '',
      order_amount: o.order_amount,
      advance_paid: o.advance_paid,
      status: o.status,
      notes: o.notes || '',
    });
    let existingRows = [];
    try {
      const raw = o.products;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        existingRows = parsed.map((r, i) => {
          const base = makeEmptyRow(columns);
          // Ensure every row has a stable id so handleEditRow can find it
          const id = r.id || (Date.now().toString() + i + Math.random().toString(36).substring(2, 6));
          return { ...base, ...r, id };
        });
      }
    } catch (_) {}
    setRows(existingRows);
    setOrderEntryMode('excel');
    setModal(true);
  };

  const openView = async (o, defaultTab = 'workbook') => {
    try {
      const res = await api.get(`/orders/${o.id}`);
      setViewing(res.data.data);
      setViewTab(defaultTab);
      setViewModal(true);
    } catch {
      toast.error('Failed to load order details.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.order_amount) return toast.error('Customer name and amount are required.');
    // Warn if WhatsApp is offline (order creation/status change triggers a message)
    warnIfWaOffline();
    setSaving(true);
    try {
      const cleanedRows = rows.filter(r => Object.values(r).some(val => val && val.toString().trim() !== ''));
      const payload = { ...form, products: cleanedRows, columns };
      if (editing) { await api.put(`/orders/${editing}`, payload); toast.success('Order updated!'); }
      else { await api.post('/orders', payload); toast.success('Order created! Production stages auto-created.'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try { await api.delete(`/orders/${id}`); toast.success('Deleted.'); load(); }
    catch { toast.error('Delete failed.'); }
  };

  const handleStatus = async (id, status) => {
    const order = orders.find(o => o.id === id);
    const willNotify = order?.contact && ['Completed', 'Delivered', 'Cancelled', 'In Production'].includes(status);
    if (willNotify) {
      const confirmMsg = `Update order #${id} status to "${status}"?\n\nAn automated WhatsApp notification will be sent to ${order.customer_name} (${order.contact}).`;
      if (!window.confirm(confirmMsg)) return;
    }
    warnIfWaOffline();
    try { await api.patch(`/orders/${id}/status`, { status }); toast.success(`Status → ${status}`); load(); }
    catch { toast.error('Update failed.'); }
  };

  const handleSaveColumns = async (newCols) => {
    try {
      // 1. Immediately save to localStorage
      localStorage.setItem('upvc_order_columns', JSON.stringify(newCols));
      setColumns(newCols);
      setRows(r => r.map(row => {
        const newRow = makeEmptyRow(newCols);
        newCols.forEach(col => { if (row[col] !== undefined) newRow[col] = row[col]; });
        return newRow;
      }));

      // 2. Persist to MySQL database settings table
      await api.put('/settings/order_columns', { value: newCols });
      toast.success('Columns saved permanently!');
    } catch (err) {
      console.warn('Backend sync warning:', err);
      toast.success('Columns saved locally!');
    }
  };

  const filtered = orders.filter(o =>
    (filter === 'All' || o.status === filter) &&
    o.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = orders.reduce((s, o) => s + Number(o.order_amount), 0);
  const totalPending = orders.reduce((s, o) => s + Number(o.remaining_balance || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Order Management</h1>
          <p className="page-subtitle">
            {isEmployee ? `${orders.length} total orders` : `${orders.length} total orders · ₹${totalRevenue.toLocaleString('en-IN')} revenue`}
          </p>
        </div>
        {can('orders', 'add') && (
          <button onClick={openAdd} className="btn-accent"><Plus size={16} /> New Order</button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.slice(0, 4).map(s => {
          const count = orders.filter(o => o.status === s).length;
          const icon = { Pending: Clock, 'In Production': ShoppingCart, Completed: CheckCircle2, Delivered: Truck }[s] || ShoppingCart;
          const IconComp = icon;
          return (
            <button key={s} onClick={() => setFilter(filter === s ? 'All' : s)}
              className={`card text-left transition-all ${filter === s ? 'ring-2 ring-orange-500 bg-orange-50' : 'hover:shadow-md'}`}>
              <div className="flex items-center gap-2 mb-1">
                <IconComp size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-500">{s}</span>
              </div>
              <p className="text-2xl font-bold text-navy-800">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 h-9 text-xs" placeholder="Search by customer name..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader size={28} className="animate-spin text-navy-800" /></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Products</th>
                {!isEmployee && <th>Amount</th>}
                {!isEmployee && <th>Advance</th>}
                {!isEmployee && <th>Balance</th>}
                <th>Delivery</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isEmployee ? 6 : 9} className="text-center py-10 text-slate-400">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />No orders found
                </td></tr>
              ) : filtered.map(o => {
                let prods = null;
                try {
                  const raw = o.products;
                  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                  if (Array.isArray(parsed) && parsed.length > 0) prods = parsed;
                } catch (_) {}

                return (
                  <tr
                    key={o.id}
                    onClick={() => openView(o)}
                    className="cursor-pointer hover:bg-orange-50/60 transition-colors"
                    title="Click anywhere on the row to view order details"
                  >
                    <td className="font-mono text-xs text-slate-400">#{o.id}</td>
                    <td>
                      <p className="font-semibold text-navy-800">{o.customer_name}</p>
                      <p className="text-xs text-slate-400">{o.contact}</p>
                    </td>
                    <td>
                      {prods ? (
                        <div className="space-y-0.5">
                          {prods.slice(0, 2).map((row, i) => (
                            <p key={i} className="text-xs text-slate-600 truncate max-w-[200px]">
                              <span className="text-slate-400 font-mono mr-1">{i + 1}.</span>
                              {Object.values(row).filter(Boolean).slice(0, 3).join(' · ')}
                            </p>
                          ))}
                          {prods.length > 2 && <p className="text-xs text-orange-500 font-medium">+{prods.length - 2} more</p>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No products</span>
                      )}
                    </td>
                    {!isEmployee && <td className="font-semibold text-navy-800">₹{Number(o.order_amount).toLocaleString('en-IN')}</td>}
                    {!isEmployee && <td className="text-green-600">₹{Number(o.advance_paid).toLocaleString('en-IN')}</td>}
                    {!isEmployee && (
                      <td className={`font-semibold ${Number(o.remaining_balance) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        ₹{Number(o.remaining_balance || 0).toLocaleString('en-IN')}
                      </td>
                    )}
                    <td className="text-xs text-slate-500">{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {isEmployee || !can('orders', 'edit') ? (
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold inline-block ${
                          o.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          o.status === 'In Production' ? 'bg-blue-100 text-blue-700' :
                          o.status === 'Delivered' ? 'bg-purple-100 text-purple-700' :
                          o.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {o.status}
                        </span>
                      ) : (
                        <select value={o.status} onChange={e => handleStatus(o.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold border border-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white">
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {!isEmployee && (
                          <button
                            onClick={() => openNudge(o)}
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                            title="Send WhatsApp Message"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => openView(o, 'workbook')}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View Excel Category Pivot & Measurement Sheets"
                        >
                          <FileSpreadsheet size={14} />
                        </button>
                        <button
                          onClick={() => printOrderCutSheet(o)}
                          className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Print Raw Material BOM"
                        >
                          <Package2 size={14} />
                        </button>
                        <button
                          onClick={() => { setCutOrder(o); setCutModal(true); }}
                          className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Profile Cut Optimizer"
                        >
                          <Scissors size={14} />
                        </button>
                        <button
                          onClick={() => printOrder(o, columns, isEmployee)}
                          className="p-1.5 text-navy-700 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Print Order Sheet"
                        >
                          <Printer size={14} />
                        </button>
                        {can('orders', 'edit') && (
                          <button onClick={() => openEdit(o)} className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-navy-50 rounded-lg transition-colors" title="Edit"><Edit2 size={14} /></button>
                        )}
                        {can('orders', 'delete') && (
                          <button onClick={() => handleDelete(o.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Balance */}
      {!isEmployee && totalPending > 0 && (
        <div className="card flex items-center justify-between bg-orange-50 border-orange-200">
          <p className="text-sm font-medium text-orange-800">Total Pending Balance:</p>
          <p className="text-xl font-bold text-orange-600">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Order Details' : 'Create New Factory Order'} size="wide">
        <form onSubmit={handleSave} className="space-y-6">

          {/* Stepped Section 1: Customer Details */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-xs shadow-xs">
                1
              </span>
              <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Customer &amp; Project Info
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">Customer Name *</label>
                <input className="input text-xs h-9" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="e.g. Mr. Ramesh Nair" required />
              </div>
              <div>
                <label className="label text-xs">Contact Number (WhatsApp)</label>
                <input className="input text-xs h-9 font-mono" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} placeholder="e.g. 9845012345" />
              </div>
              <div>
                <label className="label text-xs">Expected Delivery Date</label>
                <input type="date" className="input text-xs h-9" value={form.delivery_date} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} />
              </div>

              {editing && (
                <div className="sm:col-span-3 pt-2 border-t border-slate-100">
                  <label className="label mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Status Stage</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { value: 'Pending', label: 'Pending', icon: '⏳' },
                      { value: 'In Production', label: 'Production', icon: '⚡' },
                      { value: 'Completed', label: 'Completed', icon: '✓' },
                      { value: 'Delivered', label: 'Delivered', icon: '📦' },
                      { value: 'Cancelled', label: 'Cancelled', icon: '✗' }
                    ].map(s => {
                      const isActive = form.status === s.value;
                      
                      const activeClasses = {
                        Pending: 'border-slate-400 bg-slate-100 text-slate-800 shadow-sm ring-2 ring-slate-200',
                        'In Production': 'border-orange-500 bg-orange-50 text-orange-800 shadow-sm ring-2 ring-orange-200',
                        Completed: 'border-green-500 bg-green-50 text-green-800 shadow-sm ring-2 ring-green-200',
                        Delivered: 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm ring-2 ring-blue-200',
                        Cancelled: 'border-red-500 bg-red-50 text-red-800 shadow-sm ring-2 ring-red-200'
                      }[s.value];

                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, status: s.value }))}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isActive 
                              ? `${activeClasses} font-bold` 
                              : 'border-slate-200 text-slate-500 font-medium hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-base mb-0.5">{s.icon}</span>
                          <span className="text-xs">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {editing && (() => {
                const originalOrder = orders.find(o => o.id === editing);
                const isStatusChanged = form.status !== originalOrder?.status;
                const hasPhone = form.contact || originalOrder?.contact;

                if (isStatusChanged && hasPhone) {
                  return (
                    <div className="sm:col-span-3 p-3 bg-green-50 text-green-800 rounded-xl border border-green-200 text-xs flex items-start gap-2 animate-fade-in">
                      <span className="font-semibold text-base leading-none">💬</span>
                      <div>
                        <p className="font-bold">Automated WhatsApp Notification Ready</p>
                        <p className="mt-0.5">Saving status change to <strong>{form.status}</strong> will immediately alert <strong>{form.customer_name}</strong> on WhatsApp at <strong>{form.contact}</strong>.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Stepped Section 2: Measurement Sheets & Production Specifications */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-xs shadow-xs">
                  2
                </span>
                <div>
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                    Measurement Sheets &amp; Production Specifications
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Category Pivot Dashboard, Master Measurement Database, &amp; Single-Product Sheets
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setOrderEntryMode('excel')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    orderEntryMode === 'excel'
                      ? 'bg-[#1B3A6B] text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-navy-900'
                  }`}
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span>Excel Workbook Mode</span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                    Pivot &amp; Sheets
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderEntryMode('classic')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    orderEntryMode === 'classic'
                      ? 'bg-white text-navy-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-navy-900'
                  }`}
                >
                  <Sparkles size={14} className="text-orange-500" />
                  <span>Item Configurator Form</span>
                </button>
              </div>
            </div>

            {orderEntryMode === 'excel' ? (
              <div className="space-y-2">
                <ExcelOrderWorkbook
                  items={rows}
                  onChange={(updated) => setRows(updated)}
                  onAutoUpdateAmount={(computedSum) => {
                    setForm(p => ({ ...p, order_amount: computedSum }));
                  }}
                  ratePerSqFt={ratePerSqFt}
                  orderInfo={{ id: editing, customer_name: form.customer_name }}
                />
              </div>
            ) : (
              <ProductBuilder
                columns={columns}
                rows={rows}
                setRows={setRows}
                onManageColumns={() => setColModal(true)}
                onAutoUpdateAmount={(computedSum) => {
                  setForm(p => ({ ...p, order_amount: computedSum }));
                }}
              />
            )}
          </div>

          {/* Stepped Section 3: Financial Summary & Payment Breakdown */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-xs shadow-xs">
                  3
                </span>
                <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Financial Summary &amp; Payment Details
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label text-xs">Total Order Amount (₹) *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input text-sm font-mono font-bold text-navy-900"
                    value={form.order_amount}
                    onChange={e => setForm(p => ({ ...p, order_amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                  {rows.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Auto-Synced
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="label text-xs">Rate / Sq.Ft (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input text-sm font-mono font-bold text-slate-800"
                    value={ratePerSqFt}
                    onChange={e => {
                      const r = e.target.value;
                      setRatePerSqFt(r);
                      const rateVal = parseFloat(r) || 0;
                      if (rateVal > 0) {
                        const totalSqFt = rows.reduce((s, it) => s + (parseFloat(it.area_sqft || it['Sq.Ft']) || 0), 0);
                        if (totalSqFt > 0) {
                          setForm(p => ({ ...p, order_amount: (totalSqFt * rateVal).toFixed(2) }));
                        }
                      }
                    }}
                    placeholder="e.g. 350"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    ₹/sq.ft
                  </span>
                </div>
              </div>

              <div>
                <label className="label text-xs">Advance Payment Received (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input text-sm font-mono font-bold text-green-700"
                  value={form.advance_paid}
                  onChange={e => setForm(p => ({ ...p, advance_paid: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Financial Overview Cards */}
            {Boolean(form.order_amount) && (() => {
              const totalAmt = parseFloat(form.order_amount) || 0;
              const advAmt = parseFloat(form.advance_paid) || 0;
              const remaining = totalAmt - advAmt;
              const isPaid = remaining <= 0;

              return (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                    <p className="text-sm font-extrabold text-navy-900 mt-0.5">₹{totalAmt.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center border-x border-slate-200 px-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advance Paid</p>
                    <p className="text-sm font-extrabold text-green-600 mt-0.5">₹{advAmt.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {isPaid ? 'Payment Status' : 'Balance Due'}
                    </p>
                    <p className={`text-sm font-extrabold mt-0.5 ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                      {isPaid ? '✓ Fully Paid' : `₹${remaining.toLocaleString('en-IN')}`}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="label text-xs">Order Notes / Internal Instructions</label>
              <textarea
                className="input text-xs resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Special delivery instructions, hardware choices, installation notes..."
              />
            </div>
          </div>

          {/* Sticky Modal Submit Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(false)} className="btn-outline text-xs">
              Cancel
            </button>

            <button type="submit" disabled={saving} className="btn-accent px-6 py-2.5 text-xs font-bold flex items-center gap-2 shadow-md">
              {saving ? (
                <><Loader size={14} className="animate-spin" /> Saving Order...</>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  {editing ? 'Update Order Details' : `Create Order ${form.order_amount ? `(₹${Number(form.order_amount).toLocaleString('en-IN')})` : ''}`}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Column Manager */}
      <ColumnManagerModal isOpen={colModal} onClose={() => setColModal(false)} columns={columns} onSave={handleSaveColumns} />

      {/* Nudge Confirmation & Message Preview Modal (Admin & Manager only) */}
      <Modal isOpen={nudgeModal} onClose={() => setNudgeModal(false)} title="Confirm WhatsApp Message" size="md">
        {nudgeOrder && (() => {
          let prods = [];
          try {
            const raw = nudgeOrder.products;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) prods = parsed;
          } catch (_) {}
          const firstProduct = prods[0]?.[columns?.[0]] || nudgeOrder.product_type || 'UPVC Products';
          const productSummary = prods.length > 1 ? `${firstProduct} (+${prods.length - 1} more)` : firstProduct;
          const delDate = nudgeOrder.delivery_date
            ? new Date(nudgeOrder.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'To be confirmed';
          const balance = Number(nudgeOrder.remaining_balance || (Number(nudgeOrder.order_amount) - Number(nudgeOrder.advance_paid)));
          const isPayReminder = nudgeType === 'payment_reminder';

          return (
            <div className="space-y-4">
              {/* Recipient info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Customer Name</p>
                  <p className="text-sm font-bold text-navy-900">{nudgeOrder.customer_name}</p>
                  <p className="text-[11px] text-slate-400">Order #{nudgeOrder.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 font-medium">WhatsApp Number</p>
                  <p className={`text-sm font-bold font-mono ${nudgeOrder.contact ? 'text-green-700' : 'text-red-500 italic'}`}>
                    {nudgeOrder.contact || 'No phone recorded'}
                  </p>
                  <span className="inline-block text-[10px] bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full mt-0.5">
                    WhatsApp Recipient
                  </span>
                </div>
              </div>

              {/* Message Type Selector */}
              <div>
                <label className="block text-xs font-bold text-navy-800 mb-1.5">Choose Message Template:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNudgeType('payment_reminder')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      nudgeType === 'payment_reminder'
                        ? 'border-green-500 bg-green-50 text-green-900 ring-2 ring-green-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>💰</span>
                      <span>Payment Reminder</span>
                    </div>
                    <p className="text-[11px] font-normal text-slate-500 mt-1 truncate">
                      ₹{balance.toLocaleString('en-IN')} pending
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNudgeType('delivery_reminder')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      nudgeType === 'delivery_reminder'
                        ? 'border-green-500 bg-green-50 text-green-900 ring-2 ring-green-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🚚</span>
                      <span>Delivery Update</span>
                    </div>
                    <p className="text-[11px] font-normal text-slate-500 mt-1 truncate">
                      Delivery: {delDate}
                    </p>
                  </button>
                </div>
              </div>

              {/* Formatted WhatsApp Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-navy-800">Message Preview (Exact Text):</label>
                  <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Preview
                  </span>
                </div>
                <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-[#D1D7DB]">
                  <div className="bg-white rounded-lg p-3 shadow-xs border border-slate-200/70 text-xs text-slate-800 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-navy-900">
                      🏭 Image Creator — {isPayReminder ? 'Payment Reminder' : 'Delivery Update'}
                    </p>
                    <p className="border-t border-slate-100 pt-1">
                      Dear <strong>{nudgeOrder.customer_name}</strong>,
                    </p>
                    {isPayReminder ? (
                      <>
                        <p>This is a gentle payment reminder regarding your Order <strong>#{nudgeOrder.id}</strong>.</p>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-0.5 text-[11px]">
                          <p>📦 <strong>Product:</strong> {productSummary}</p>
                          <p>💰 <strong>Total Amount:</strong> ₹{Number(nudgeOrder.order_amount).toLocaleString('en-IN')}</p>
                          <p>✅ <strong>Advance Paid:</strong> ₹{Number(nudgeOrder.advance_paid).toLocaleString('en-IN')}</p>
                          <p className="text-red-600 font-semibold">⏳ <strong>Balance Due:</strong> ₹{balance.toLocaleString('en-IN')}</p>
                          <p>📅 <strong>Delivery Date:</strong> {delDate}</p>
                        </div>
                        <p className="text-slate-600">Kindly arrange for the balance settlement at your earliest convenience.</p>
                      </>
                    ) : (
                      <>
                        <p>This is a quick update regarding your Order <strong>#{nudgeOrder.id}</strong>.</p>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-0.5 text-[11px]">
                          <p>📦 <strong>Product:</strong> {productSummary}</p>
                          <p>📅 <strong>Expected Delivery Date:</strong> {delDate}</p>
                          <p>⏳ <strong>Current Balance:</strong> ₹{balance.toLocaleString('en-IN')}</p>
                        </div>
                        <p className="text-slate-600">Our factory team is actively processing your order with highest quality standards.</p>
                      </>
                    )}
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                      Image Creator UPVC Products & Interiors
                    </p>
                  </div>
                </div>
              </div>

              {!nudgeOrder.contact && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>No customer phone number recorded. Please edit the order to add a contact number first.</span>
                </div>
              )}

              {/* Confirmation Notice */}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0 text-amber-600" />
                <span>Please confirm that all customer and order details above are accurate before sending.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNudgeModal(false)}
                  className="btn-outline text-xs px-4 py-2"
                  disabled={nudging}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => triggerNudge(nudgeType)}
                  disabled={nudging || !nudgeOrder.contact}
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {nudging ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                  Confirm &amp; Send Message
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* View Order Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title={`Order #${viewing?.id} — ${viewing?.customer_name}`} size="wide">
        {viewing && (() => {
          let viewProds = [];
          try {
            const raw = viewing.products;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) viewProds = parsed;
          } catch (_) {}

          return (
            <div className="space-y-4">
              {/* Action Buttons & View Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                {/* View Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewTab('workbook')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      viewTab === 'workbook'
                        ? 'bg-[#1B3A6B] text-white shadow-sm font-bold'
                        : 'text-slate-600 hover:text-navy-900'
                    }`}
                  >
                    <FileSpreadsheet size={14} className="text-emerald-400" />
                    <span>Excel Measurement Sheets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('overview')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      viewTab === 'overview'
                        ? 'bg-white text-navy-900 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-navy-900'
                    }`}
                  >
                    <Table size={14} className="text-orange-500" />
                    <span>Order Summary &amp; Financials</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {!isEmployee && (
                    <button
                      onClick={() => { setViewModal(false); openNudge(viewing); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                    >
                      <Send size={13} /> WhatsApp Nudge
                    </button>
                  )}
                  {can('orders', 'edit') && (
                    <button onClick={() => { setViewModal(false); openEdit(viewing); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs">
                      <Edit2 size={13} /> Edit Order
                    </button>
                  )}
                  <button onClick={() => printOrderCutSheet(viewing)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs">
                    <Package2 size={13} /> Raw Material BOM
                  </button>
                  <button
                    onClick={() => { setViewModal(false); setCutOrder(viewing); setCutModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                  >
                    <Scissors size={13} /> Cut Plan
                  </button>
                  <button onClick={() => printOrder(viewing, columns, isEmployee)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs">
                    <Printer size={13} /> Print PDF
                  </button>
                </div>
              </div>

              {viewTab === 'workbook' ? (
                <div className="space-y-3">
                  <ExcelOrderWorkbook
                    items={viewProds}
                    readOnly={true}
                    orderInfo={viewing}
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Order Info */}
                  {(() => {
                    const infoFields = [
                      ['Customer', viewing.customer_name],
                      ['Contact', viewing.contact || '—'],
                      ['Delivery Date', viewing.delivery_date ? new Date(viewing.delivery_date).toLocaleDateString('en-IN') : '—'],
                      ['Status', viewing.status],
                    ];
                    if (!isEmployee) {
                      infoFields.push(
                        ['Order Amount', `₹${Number(viewing.order_amount).toLocaleString('en-IN')}`],
                        ['Advance Paid', `₹${Number(viewing.advance_paid).toLocaleString('en-IN')}`],
                        ['Balance Due', `₹${Number(viewing.remaining_balance || 0).toLocaleString('en-IN')}`]
                      );
                    }
                    return (
                      <div className={`grid ${isEmployee ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-3 text-sm`}>
                        {infoFields.map(([k, v]) => (
                          <div key={k} className="bg-slate-50 rounded-lg p-3">
                            <p className="text-slate-500 text-xs mb-0.5">{k}</p>
                            <p className="font-semibold text-navy-800">{v}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Products Table */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-navy-800 flex items-center gap-2">
                        <span className="w-1 h-4 bg-orange-500 rounded-full inline-block" />
                        Products / Items
                        <span className="text-xs font-normal text-slate-400 ml-1">({viewProds.length} item{viewProds.length !== 1 ? 's' : ''})</span>
                      </h4>
                      {can('orders', 'edit') && (
                        <button onClick={() => { setViewModal(false); openEdit(viewing); }}
                          className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-semibold border border-orange-200 hover:border-orange-400 px-2.5 py-1.5 rounded-lg transition-all bg-orange-50/50">
                          <Plus size={12} /> Add / Edit Items
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-navy-800 text-white">
                          <tr>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold w-8">#</th>
                            {columns.map(col => (
                              <th key={col} className="text-left px-3 py-2.5 text-xs font-semibold whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {viewProds.length === 0 ? (
                            <tr>
                              <td colSpan={columns.length + 1} className="text-center py-8 text-slate-400 italic text-sm">
                                No product details recorded for this order
                              </td>
                            </tr>
                          ) : viewProds.map((row, i) => (
                            <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                              <td className="px-3 py-2.5 text-xs text-slate-400 font-mono font-semibold">{i + 1}</td>
                              {columns.map(col => (
                                <td key={col} className="px-3 py-2.5 text-sm text-slate-700">{row[col] || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  {viewing.notes && (
                    <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-800">
                      <span className="font-medium">Notes:</span> {viewing.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Cut Optimizer Modal */}
      <CutOptimizerModal
        isOpen={cutModal}
        onClose={() => { setCutModal(false); setCutOrder(null); }}
        order={cutOrder}
      />
    </div>
  );
};

export default Orders;
