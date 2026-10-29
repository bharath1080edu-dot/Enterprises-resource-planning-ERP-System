import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, Search, Filter, RefreshCw, Loader, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import ManageableSelect from '../components/ManageableSelect';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Profiles', 'Glass', 'Hardware', 'Accessories', 'Steel', 'Chemicals', 'Other'];
const UNITS = ['meters', 'sq.ft', 'pieces', 'units', 'pairs', 'tubes', 'kg', 'liters'];

const EMPTY = { material_name:'', category:'Profiles', quantity:'', unit:'meters', supplier_id:'', cost:'', low_stock_threshold:'10', date_added: new Date().toISOString().split('T')[0] };

const Inventory = () => {
  const [items,     setItems]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const { can } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, sup] = await Promise.all([api.get('/inventory'), api.get('/inventory/suppliers')]);
      setItems(inv.data.data || []);
      setSuppliers(sup.data.data || []);
    } catch { toast.error('Failed to load inventory.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      material_name: item.material_name, category: item.category, quantity: item.quantity,
      unit: item.unit, supplier_id: item.supplier_id || '', cost: item.cost,
      low_stock_threshold: item.low_stock_threshold,
      date_added: item.date_added?.split('T')[0] || new Date().toISOString().split('T')[0]
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.material_name) return toast.error('Material name is required.');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/inventory/${editing}`, form);
        toast.success('Updated successfully!');
      } else {
        await api.post('/inventory', form);
        toast.success('Material added!');
      }
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleAddSupplier = async () => {
    const name = window.prompt("Enter new supplier name:");
    if (!name || !name.trim()) return;
    try {
      await api.post('/inventory/suppliers', { name: name.trim() });
      toast.success('Supplier added!');
      load(); // Reload suppliers
    } catch (err) {
      toast.error('Failed to add supplier.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Deleted.');
      load();
    } catch { toast.error('Delete failed.'); }
  };

  const filtered = items.filter(i =>
    (catFilter === 'All' || i.category === catFilter) &&
    i.material_name.toLowerCase().includes(search.toLowerCase())
  );
  const lowStockCount = items.filter(i => i.is_low_stock).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{items.length} materials · {lowStockCount > 0 && <span className="text-red-500 font-semibold">{lowStockCount} low stock</span>}</p>
        </div>
        {can('inventory', 'add') && (
          <button onClick={openAdd} className="btn-accent"><Plus size={16} /> Add Material</button>
        )}
      </div>

      {/* Low Stock Banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <p className="text-sm font-medium">{lowStockCount} material(s) are at or below minimum stock levels. Please reorder.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 h-9 text-xs" placeholder="Search materials..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${catFilter === c ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-400'}`}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader size={28} className="animate-spin text-navy-800" /></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Supplier</th>
                <th>Cost/Unit</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  No materials found
                </td></tr>
              ) : filtered.map((item, idx) => (
                <tr key={item.id}>
                  <td className="text-slate-400 text-xs">{idx + 1}</td>
                  <td className="font-semibold text-navy-800">{item.material_name}</td>
                  <td><span className="badge-navy">{item.category}</span></td>
                  <td className={`font-bold ${item.is_low_stock ? 'text-red-500' : 'text-navy-800'}`}>{Number(item.quantity).toLocaleString()}</td>
                  <td className="text-slate-500">{item.unit}</td>
                  <td className="text-slate-600">{item.supplier_name || '—'}</td>
                  <td className="text-slate-700">₹{Number(item.cost).toLocaleString('en-IN')}</td>
                  <td className="font-semibold text-navy-800">₹{(Number(item.quantity) * Number(item.cost)).toLocaleString('en-IN')}</td>
                  <td>
                    {item.is_low_stock
                      ? <span className="badge-red flex items-center gap-1"><AlertTriangle size={10} />Low Stock</span>
                      : <span className="badge-green">In Stock</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {can('inventory', 'edit') && (
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-navy-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {can('inventory', 'delete') && (
                        <button onClick={() => handleDelete(item.id, item.material_name)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                      {!can('inventory', 'edit') && !can('inventory', 'delete') && (
                        <span className="text-xs text-slate-400 italic">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Material' : 'Add Raw Material'} size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Material Name *</label>
            <input className="input" value={form.material_name} onChange={e => setForm(p => ({...p, material_name: e.target.value}))} placeholder="e.g. UPVC White Profiles" required />
          </div>
          <ManageableSelect 
            label="Category" 
            settingKey="inventory_categories" 
            value={form.category} 
            onChange={e => setForm(p => ({...p, category: e.target.value}))} 
            defaultOptions={CATEGORIES}
          />
          <ManageableSelect 
            label="Unit" 
            settingKey="inventory_units" 
            value={form.unit} 
            onChange={e => setForm(p => ({...p, unit: e.target.value}))} 
            defaultOptions={UNITS}
          />
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="0" step="0.01" className="input" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} placeholder="0" />
          </div>
          <div>
            <label className="label">Cost per Unit (₹)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.cost} onChange={e => setForm(p => ({...p, cost: e.target.value}))} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Supplier</label>
            <div className="flex items-center gap-2">
              <select className="select flex-1" value={form.supplier_id} onChange={e => setForm(p => ({...p, supplier_id: e.target.value}))}>
                <option value="">— Select Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={handleAddSupplier} className="p-2 text-slate-400 hover:text-navy-600 hover:bg-navy-50 rounded-lg transition-colors border border-transparent hover:border-navy-100" title="Add Supplier">
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">Low Stock Alert Threshold</label>
            <input type="number" min="0" className="input" value={form.low_stock_threshold} onChange={e => setForm(p => ({...p, low_stock_threshold: e.target.value}))} />
          </div>
          <div>
            <label className="label">Date Added</label>
            <input type="date" className="input" value={form.date_added} onChange={e => setForm(p => ({...p, date_added: e.target.value}))} />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : editing ? 'Update Material' : 'Add Material'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
