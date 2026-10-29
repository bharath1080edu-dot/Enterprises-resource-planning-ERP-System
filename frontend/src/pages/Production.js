import React, { useEffect, useState, useCallback } from 'react';
import { Factory, Edit2, Loader, AlertCircle, ChevronRight, Wrench, Search, Package as PackageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';



const SawBladeIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2l1.5 3h-3z" />
    <path d="M22 12l-3 1.5v-3z" />
    <path d="M12 22l-1.5-3h3z" />
    <path d="M2 12l3-1.5v3z" />
    <path d="M4.93 4.93l3.18 1.06-1.06 3.18z" />
    <path d="M19.07 19.07l-3.18-1.06 1.06-3.18z" />
    <path d="M19.07 4.93l-1.06 3.18-3.18-1.06z" />
    <path d="M4.93 19.07l1.06-3.18 3.18 1.06z" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const WeldCornerIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 22V8h14" />
    <path d="M2 22V2h20" />
    <path d="M2 2l6 6" />
    <path d="M2 8L0 7" />
    <path d="M8 2L7 0" />
    <path d="M1 3L0 2" />
    <path d="M3 1L2 0" />
  </svg>
);

const STAGES = ['Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing'];
const STAGE_ICONS = { 
  Cutting: <SawBladeIcon size={18} className="text-slate-600" />, 
  Welding: <WeldCornerIcon size={18} className="text-orange-500" />, 
  Assembly: <Wrench size={18} className="text-blue-500" />, 
  'Quality Check': <Search size={18} className="text-indigo-500" />, 
  Packing: <PackageIcon size={18} className="text-green-500" /> 
};

const StatusDot = ({ status }) => {
  const c = { Completed: 'bg-green-500', 'In Progress': 'bg-orange-500', Pending: 'bg-slate-300' }[status];
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
};

const Production = () => {
  const [productions, setProductions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [editStage,   setEditStage]   = useState(null);
  const [form,        setForm]        = useState({ status: 'Pending', notes: '' });
  const [saving,      setSaving]      = useState(false);
  const [waConnected, setWaConnected] = useState(true);

  useEffect(() => {
    api.get('/whatsapp/status')
      .then(res => setWaConnected(res.data?.data?.connected === true))
      .catch(() => setWaConnected(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/production');
      setProductions(res.data.data || []);
    } catch { toast.error('Failed to load production data.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (stage) => {
    setEditStage(stage);
    setForm({ status: stage.status, notes: stage.notes || '' });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!waConnected) {
      toast.error(
        '⚠️ WhatsApp is not connected — customer will NOT receive a stage update message.\nGo to the WhatsApp page to reconnect first.',
        { duration: 6000, id: 'wa-offline-prod' }
      );
    }
    const orderInfo = productions.find(p => p.stages?.some(s => s.id === editStage.id));
    if (orderInfo?.customer_phone && ['In Progress', 'Completed'].includes(form.status)) {
      const ok = window.confirm(`Confirm stage update to "${form.status}"?\n\nAn automated WhatsApp notification will be sent to ${orderInfo.customer_name} (${orderInfo.customer_phone}).`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api.patch(`/production/${editStage.id}`, { ...form, worker_assigned: '', machine_used: '' });
      toast.success('Stage updated!');
      setModal(false);
      load();
    } catch { toast.error('Update failed.'); }
    finally { setSaving(false); }
  };

  const getStageStatus = (stages, stageName) => stages?.find(s => s.stage === stageName);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Production Tracking</h1>
          <p className="page-subtitle">{productions.length} active orders in production pipeline</p>
        </div>
      </div>

      {/* Stage Legend */}
      <div className="card">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Production Pipeline Stages</p>
        <div className="flex items-center gap-2 flex-wrap">
          {STAGES.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-sm">
                <span>{STAGE_ICONS[s]}</span>
                <span className="text-navy-800 font-medium text-xs">{s}</span>
              </div>
              {i < STAGES.length - 1 && <ChevronRight size={14} className="text-slate-400" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader size={28} className="animate-spin text-navy-800" /></div>
      ) : productions.length === 0 ? (
        <div className="card text-center py-16">
          <Factory size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">No production orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productions.map(prod => (
            <div key={prod.order_id} className="card hover:shadow-md transition-shadow">
              {/* Order Header */}
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">#{prod.order_id}</span>
                    <span className={`badge ${prod.order_status === 'In Production' ? 'badge-navy' : prod.order_status === 'Completed' ? 'badge-green' : 'badge-yellow'}`}>
                      {prod.order_status}
                    </span>
                  </div>
                  <h3 className="font-bold text-navy-800">{prod.customer_name}</h3>
                  <p className="text-sm text-slate-500">{prod.product_type}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Overall Progress</p>
                    <p className="text-2xl font-bold text-navy-800">{prod.completion}%</p>
                    <div className="progress-bar mt-1 w-32">
                      <div className="progress-fill" style={{ width: `${prod.completion}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Stage */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-orange-50 rounded-lg">
                <AlertCircle size={14} className="text-orange-500 flex-shrink-0" />
                <p className="text-xs font-medium text-orange-700">
                  Current Stage: <strong>{prod.current_stage}</strong>
                </p>
              </div>

              {/* Stages Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {STAGES.map((stageName) => {
                  const stage = getStageStatus(prod.stages, stageName);
                  if (!stage) return null;
                  return (
                    <div key={stageName}
                      className={`p-3 rounded-xl border-2 transition-all ${stage.status === 'Completed' ? 'bg-green-50 border-green-200' : stage.status === 'In Progress' ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{STAGE_ICONS[stageName]}</span>
                        <StatusDot status={stage.status} />
                      </div>
                      <p className="text-xs font-bold text-navy-800 mb-1">{stageName}</p>
                      <p className={`text-xs font-medium ${stage.status === 'Completed' ? 'text-green-600' : stage.status === 'In Progress' ? 'text-orange-500' : 'text-slate-400'}`}>
                        {stage.status}
                      </p>
                      <button onClick={() => openEdit(stage)}
                        className="mt-2 w-full text-xs py-1 px-2 rounded-lg bg-white border border-slate-200 hover:border-navy-400 hover:text-navy-800 transition-colors flex items-center justify-center gap-1">
                        <Edit2 size={10} /> Update
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stage Update Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={`Update Stage: ${editStage?.stage}`} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Stage Status</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'Pending', label: 'Pending', icon: '⏳' },
                { value: 'In Progress', label: 'In Progress', icon: '⚡' },
                { value: 'Completed', label: 'Completed', icon: '✓' }
              ].map(s => {
                const isActive = form.status === s.value;
                const activeClasses = {
                  Pending: 'border-slate-400 bg-slate-50 text-slate-700 shadow-sm ring-2 ring-slate-100',
                  'In Progress': 'border-orange-500 bg-orange-50/50 text-orange-700 shadow-sm ring-2 ring-orange-100',
                  Completed: 'border-green-500 bg-green-50/50 text-green-700 shadow-sm ring-2 ring-green-100'
                }[s.value];
                
                const hoverClasses = {
                  Pending: 'hover:border-slate-300 hover:bg-slate-50/30',
                  'In Progress': 'hover:border-orange-300 hover:bg-orange-50/20',
                  Completed: 'hover:border-green-300 hover:bg-green-50/20'
                }[s.value];

                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, status: s.value }))}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive 
                        ? `${activeClasses} border-2 font-bold` 
                        : `border-slate-200 text-slate-500 font-medium ${hoverClasses}`
                    }`}
                  >
                    <span className="text-lg mb-1">{s.icon}</span>
                    <span className="text-xs">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(() => {
            const orderInfo = productions.find(p => p.order_id === editStage?.order_id);
            if (orderInfo && ['In Progress', 'Completed'].includes(form.status)) {
              return (
                <div className="p-3 bg-green-50 text-green-800 rounded-xl border border-green-200 text-xs flex items-start gap-2 animate-fade-in">
                  <span className="font-semibold text-base leading-none">💬</span>
                  <div>
                    <p className="font-bold">WhatsApp Alert Enabled</p>
                    <p className="mt-0.5">Saving this stage will send an automated WhatsApp message to <strong>{orderInfo.customer_name}</strong> at <strong>{orderInfo.customer_phone || 'no phone'}</strong>.</p>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          {/* Removed worker_assigned and machine_used input fields */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Progress notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : 'Update Stage'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Production;
