import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader, CreditCard, TrendingUp, TrendingDown, AlertCircle, Trash2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import ManageableSelect from '../components/ManageableSelect';
import { useAuth } from '../context/AuthContext';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];
const PAYMENT_TYPES   = ['Advance', 'Partial', 'Full', 'Refund'];
const EXPENSE_CATS    = ['Electricity', 'Transport', 'Maintenance', 'Raw Material', 'Salaries', 'Rent', 'Tools', 'Other'];

const Payments = () => {
  const { user } = useAuth();
  const [payments,  setPayments]  = useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [pending,   setPending]   = useState([]);
  const [summary,   setSummary]   = useState({ revenue:0, expenses:0, profit:0 });
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [payModal,  setPayModal]  = useState(false);
  const [expModal,  setExpModal]  = useState(false);
  const [tab,       setTab]       = useState('payments');
  const [saving,    setSaving]    = useState(false);
  const [payForm,   setPayForm]   = useState({ order_id:'', payment_type:'Partial', amount:'', payment_method:'Cash', payment_date: new Date().toISOString().split('T')[0], notes:'' });
  const [expForm,   setExpForm]   = useState({ category:'Electricity', description:'', amount:'', vendor:'', expense_date: new Date().toISOString().split('T')[0], payment_method:'Cash' });
  const [nudgingId, setNudgingId] = useState(null);
  const [nudgeOrder, setNudgeOrder] = useState(null);
  const [nudgeModal, setNudgeModal] = useState(false);

  const handleNudge = async (orderId, nudgeType) => {
    setNudgingId(orderId);
    try {
      const res = await api.post('/whatsapp/nudge', { orderId, nudgeType });
      if (res.data.success) {
        toast.success('Nudge message sent successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send WhatsApp nudge.');
    } finally {
      setNudgingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ex, pen, sum, ord] = await Promise.all([
        api.get('/payments'),
        api.get('/payments/expenses'),
        api.get('/payments/pending'),
        api.get('/payments/summary'),
        api.get('/orders'),
      ]);
      setPayments(p.data.data || []);
      setExpenses(ex.data.data || []);
      setPending(pen.data.data || []);
      setSummary(sum.data.data || {});
      setOrders(ord.data.data || []);
    } catch { toast.error('Failed to load payment data.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !payForm.payment_date) return toast.error('Amount and date required.');
    setSaving(true);
    try { await api.post('/payments', payForm); toast.success('Payment recorded!'); setPayModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleExpense = async (e) => {
    e.preventDefault();
    if (!expForm.amount || !expForm.expense_date) return toast.error('Amount and date required.');
    setSaving(true);
    try { await api.post('/payments/expenses', expForm); toast.success('Expense recorded!'); setExpModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.delete(`/payments/expenses/${id}`); toast.success('Deleted.'); load(); }
    catch { toast.error('Delete failed.'); }
  };

  const profitColor = (summary.profit || 0) >= 0 ? 'text-green-600' : 'text-red-500';

  const isManager = user?.role === 'Manager';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Payment Module</h1>
          <p className="page-subtitle">
            {isManager ? 'Track outstanding dues and collections' : 'Revenue, expenses & pending dues'}
          </p>
        </div>
        {!isManager && (
          <div className="flex gap-2">
            <button onClick={() => setPayModal(true)} className="btn-accent"><Plus size={16} /> Record Payment</button>
            <button onClick={() => setExpModal(true)} className="btn-outline"><Plus size={16} /> Add Expense</button>
          </div>
        )}
      </div>

      {/* P&L Summary */}
      {!isManager && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-green-100"><TrendingUp size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-slate-500">This Month Revenue</p>
                <p className="text-xl font-bold text-green-600">₹{Number(summary.revenue||0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
          <div className="card border-l-4 border-red-400">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-red-100"><TrendingDown size={20} className="text-red-500" /></div>
              <div>
                <p className="text-xs text-slate-500">This Month Expenses</p>
                <p className="text-xl font-bold text-red-500">₹{Number(summary.expenses||0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
          <div className={`card border-l-4 ${(summary.profit||0)>=0?'border-green-500':'border-red-400'}`}>
            <div className="flex items-center gap-3">
              <div className={`stat-icon ${(summary.profit||0)>=0?'bg-green-100':'bg-red-100'}`}>
                <CreditCard size={20} className={profitColor} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Net Profit / Loss</p>
                <p className={`text-xl font-bold ${profitColor}`}>
                  {(summary.profit||0)>=0?'+':''}₹{Math.abs(Number(summary.profit||0)).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isManager ? (
        /* Manager View: Full Page Pending Dues Table */
        <div className="card">
          <h3 className="font-bold text-navy-800 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-orange-500" /> Outstanding Collections / Pending Dues
            <span className="text-xs font-normal text-slate-400">({pending.length} orders pending payment)</span>
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader size={28} className="animate-spin text-navy-800" /></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Remaining Balance</th>
                    <th>Order Amount</th>
                    <th>Advance Paid</th>
                    <th>Delivery Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        No pending collections found
                      </td>
                    </tr>
                  ) : (
                    pending.map(o => (
                      <tr key={o.id}>
                        <td className="font-mono text-xs text-slate-400">#{o.id}</td>
                        <td className="font-semibold text-navy-800">{o.customer_name}</td>
                        <td className="text-sm text-slate-500">{o.contact || '—'}</td>
                        <td className="font-bold text-orange-600">₹{Number(o.remaining_balance).toLocaleString('en-IN')}</td>
                        <td className="text-slate-600">₹{Number(o.order_amount).toLocaleString('en-IN')}</td>
                        <td className="text-green-600">₹{Number(o.advance_paid).toLocaleString('en-IN')}</td>
                        <td className="text-xs text-slate-500">{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td>
                          <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            o.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            o.status === 'In Production' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{o.status}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => { setNudgeOrder(o); setNudgeModal(true); }}
                            disabled={nudgingId === o.id}
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold disabled:opacity-60"
                            title="Send WhatsApp Nudge"
                          >
                            {nudgingId === o.id ? (
                              <Loader size={12} className="animate-spin" />
                            ) : (
                              <Send size={12} />
                            )}
                            Nudge
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Admin View: Traditional Tabs + Pending Dues Alert Box */
        <>
          {/* Pending Dues */}
          {pending.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-navy-800 mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" /> Pending Dues ({pending.length} orders)
              </h3>
              <div className="space-y-2">
                {pending.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                    <div>
                      <p className="text-sm font-semibold text-navy-800">{o.customer_name}</p>
                      <p className="text-xs text-slate-500">{o.product_type} · #{o.id}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-600">₹{Number(o.remaining_balance).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-400">Due balance</p>
                      </div>
                      <button
                        onClick={() => { setNudgeOrder(o); setNudgeModal(true); }}
                        disabled={nudgingId === o.id}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100/50 rounded-lg transition-colors flex items-center justify-center disabled:opacity-60"
                        title="Send WhatsApp Nudge"
                      >
                        {nudgingId === o.id ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            {[['payments','💳 Payments'], ['expenses','💸 Expenses']].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-navy-800'}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader size={28} className="animate-spin text-navy-800" /></div>
          ) : tab === 'payments' ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>#</th><th>Customer</th><th>Type</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No payments recorded</td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs text-slate-400">#{p.id}</td>
                      <td className="font-semibold text-navy-800">{p.customer_name || '—'}<br /><span className="text-xs text-slate-400">Order #{p.order_id}</span></td>
                      <td><span className="badge-navy">{p.payment_type}</span></td>
                      <td className="font-bold text-green-600">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td className="text-slate-500 text-sm">{p.payment_method}</td>
                      <td className="text-slate-500 text-xs">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>#</th><th>Category</th><th>Description</th><th>Vendor</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">No expenses recorded</td></tr>
                  ) : expenses.map(ex => (
                    <tr key={ex.id}>
                      <td className="font-mono text-xs text-slate-400">#{ex.id}</td>
                      <td><span className="badge-orange">{ex.category}</span></td>
                      <td className="text-slate-600 text-sm">{ex.description || '—'}</td>
                      <td className="text-slate-500 text-sm">{ex.vendor || '—'}</td>
                      <td className="font-bold text-red-500">₹{Number(ex.amount).toLocaleString('en-IN')}</td>
                      <td className="text-slate-500 text-xs">{new Date(ex.expense_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button onClick={() => deleteExpense(ex.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Record Payment Modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Record Customer Payment" size="md">
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="label">Order</label>
            <select className="select" value={payForm.order_id} onChange={e => setPayForm(p=>({...p,order_id:e.target.value}))}>
              <option value="">— Select Order —</option>
              {orders.map(o => <option key={o.id} value={o.id}>#{o.id} - {o.customer_name} (₹{Number(o.remaining_balance||0).toLocaleString('en-IN')} pending)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ManageableSelect
              label="Payment Type"
              settingKey="payment_types"
              value={payForm.payment_type}
              onChange={e => setPayForm(p=>({...p,payment_type:e.target.value}))}
              defaultOptions={PAYMENT_TYPES}
            />
            <ManageableSelect
              label="Method"
              settingKey="payment_methods"
              value={payForm.payment_method}
              onChange={e => setPayForm(p=>({...p,payment_method:e.target.value}))}
              defaultOptions={PAYMENT_METHODS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" className="input" value={payForm.amount} onChange={e => setPayForm(p=>({...p,amount:e.target.value}))} required />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input type="date" className="input" value={payForm.payment_date} onChange={e => setPayForm(p=>({...p,payment_date:e.target.value}))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={payForm.notes} onChange={e => setPayForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setPayModal(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Expense Modal */}
      <Modal isOpen={expModal} onClose={() => setExpModal(false)} title="Add Expense" size="md">
        <form onSubmit={handleExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ManageableSelect
              label="Category"
              settingKey="expense_categories"
              value={expForm.category}
              onChange={e => setExpForm(p=>({...p,category:e.target.value}))}
              defaultOptions={EXPENSE_CATS}
            />
            <ManageableSelect
              label="Method"
              settingKey="payment_methods"
              value={expForm.payment_method}
              onChange={e => setExpForm(p=>({...p,payment_method:e.target.value}))}
              defaultOptions={PAYMENT_METHODS}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={expForm.description} onChange={e => setExpForm(p=>({...p,description:e.target.value}))} placeholder="Brief description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vendor / Payee</label>
              <input className="input" value={expForm.vendor} onChange={e => setExpForm(p=>({...p,vendor:e.target.value}))} placeholder="Vendor name" />
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" className="input" value={expForm.amount} onChange={e => setExpForm(p=>({...p,amount:e.target.value}))} required />
            </div>
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={expForm.expense_date} onChange={e => setExpForm(p=>({...p,expense_date:e.target.value}))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setExpModal(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Nudge Confirmation Modal */}
      <Modal isOpen={nudgeModal} onClose={() => setNudgeModal(false)} title="Confirm WhatsApp Nudge" size="sm">
        {nudgeOrder && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Are you sure you want to send a manual WhatsApp payment reminder to <strong>{nudgeOrder.customer_name}</strong>?
            </p>
            
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="text-slate-500">Recipient Phone: <strong className="text-navy-800">{nudgeOrder.contact || 'None'}</strong></p>
              <p className="text-slate-500">Remaining Balance: <strong className="text-orange-600">₹{Number(nudgeOrder.remaining_balance).toLocaleString('en-IN')}</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setNudgeModal(false)} className="btn-outline py-1.5 px-3 text-xs font-semibold">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setNudgeModal(false);
                  handleNudge(nudgeOrder.id, 'payment_reminder');
                }}
                disabled={nudgingId === nudgeOrder.id}
                className="btn-accent py-1.5 px-3 flex items-center gap-1 text-xs font-semibold"
              >
                {nudgingId === nudgeOrder.id ? (
                  <Loader size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                Send Nudge
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payments;
