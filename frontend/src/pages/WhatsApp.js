import React, { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Loader, RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff,
  Send, Phone, Clock, MessageSquare, ShieldCheck, AlertTriangle,
  Activity, LogOut, User, Timer, RotateCcw, FileText, Check,
  Users, Plus, Pencil, Trash2, ArrowRightLeft, CheckCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

/* ── helpers ────────────────────────────────────────────── */
const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};
const truncate = (str, n = 90) =>
  str && str.length > n ? str.slice(0, n) + '…' : str;

const DEFAULT_TEMPLATES = {
  new_order: "*🏭 UPVC Factory — Order Confirmed!*\n━━━━━━━━━━━━━━━━━━━━\n🎉 Dear *{customerName}*, your order has been placed!\n\n📦 *Order ID:* #{orderId}\n🪟 *Product:* {productType}\n💰 *Order Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* ₹{balanceDue}\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Thank you for choosing Image Creator UPVC!_",
  status_in_production: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🔧 Your Order *#{orderId}* is now in *In Production*!\n\nOur team has started working on your order!\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_completed: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🎉 Your Order *#{orderId}* is now *Completed*!\n\nYour order is ready! We will contact you soon for dispatch.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_delivered: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🚚 Your Order *#{orderId}* has been *Delivered*!\n\nThank you for your business!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_cancelled: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n❌ Your Order *#{orderId}* has been *Cancelled*.\n\nWe're sorry for any inconvenience caused.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  production_stage: "*🏭 UPVC Factory — Production Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n📋 *Order #{orderId}* update:\n{emoji} *Stage:* {stage}\n📊 *Status:* {status}\n{allDoneMessage}━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  payment_reminder: "*🏭 UPVC Factory — Payment Reminder*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is a friendly reminder regarding your Order *#{orderId}*.\n\n💰 *Total Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* *₹{balanceDue}*\n\nPlease arrange for the payment at your earliest convenience.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  delivery_reminder: "*🏭 UPVC Factory — Delivery Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is an update regarding the delivery of your Order *#{orderId}*.\n\n📅 *Expected Delivery:* *{deliveryDate}*\n🪟 *Product:* {productType}\n\nOur team is working hard to ensure timely delivery!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_"
};

const TEMPLATE_KEYS = [
  { key: 'new_order', label: 'New Order Confirmed', desc: 'Sent automatically when a new order is registered.', placeholders: ['{customerName}', '{orderId}', '{productType}', '{orderAmount}', '{advancePaid}', '{balanceDue}', '{deliveryDate}', '{randomQuote}'] },
  { key: 'status_in_production', label: 'Status: In Production', desc: 'Sent when the order enters the In Production phase.', placeholders: ['{customerName}', '{orderId}', '{status}', '{deliveryDate}', '{randomQuote}'] },
  { key: 'status_completed', label: 'Status: Completed', desc: 'Sent when all production stages are completed.', placeholders: ['{customerName}', '{orderId}', '{status}', '{randomQuote}'] },
  { key: 'status_delivered', label: 'Status: Delivered', desc: 'Sent when the order status is set to Delivered.', placeholders: ['{customerName}', '{orderId}', '{status}', '{randomQuote}'] },
  { key: 'status_cancelled', label: 'Status: Cancelled', desc: 'Sent if the order is cancelled.', placeholders: ['{customerName}', '{orderId}', '{status}', '{randomQuote}'] },
  { key: 'production_stage', label: 'Production Stage Update', desc: 'Sent when a single stage (e.g., Welding) status is updated.', placeholders: ['{customerName}', '{orderId}', '{emoji}', '{stage}', '{status}', '{allDoneMessage}', '{randomQuote}'] },
  { key: 'payment_reminder', label: 'Payment Reminder Nudge', desc: 'Sent manually as a payment follow-up nudging for pending balance.', placeholders: ['{customerName}', '{orderId}', '{productType}', '{orderAmount}', '{advancePaid}', '{balanceDue}', '{deliveryDate}', '{randomQuote}'] },
  { key: 'delivery_reminder', label: 'Delivery Reminder Nudge', desc: 'Sent manually as a delivery update notification.', placeholders: ['{customerName}', '{orderId}', '{productType}', '{orderAmount}', '{advancePaid}', '{balanceDue}', '{deliveryDate}', '{randomQuote}'] }
];

const EMOJI_OPTIONS = ['👤','👨','👩','👴','👵','🏢','📱','💼','🏭','👨‍💼','👩‍💼','🧑‍💼','⭐','🔑','🌟'];

/* ═══════════════════════════════════════════════════════════
   Account Editor Modal
   ═══════════════════════════════════════════════════════════ */
const AccountModal = ({ account, onSave, onClose }) => {
  const [form, setForm] = useState(
    account || { id: '', label: '', emoji: '👤', description: '' }
  );
  const isEdit = !!account;

  const handleSave = () => {
    if (!form.label.trim()) { toast.error('Account name is required'); return; }
    if (!isEdit && !form.id.trim()) { toast.error('Account ID is required'); return; }
    const id = isEdit ? form.id : form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    onSave({ ...form, id });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 480, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        padding: '28px 28px 24px',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f2027', marginBottom: 20 }}>
          {isEdit ? '✏️ Edit Account' : '➕ Add Account'}
        </h2>

        {/* Emoji picker */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
              style={{
                width: 38, height: 38, borderRadius: 10, fontSize: 20,
                border: form.emoji === e ? '2px solid #25D366' : '2px solid #e2e8f0',
                background: form.emoji === e ? '#f0fdf4' : '#f8fafc',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{e}</button>
          ))}
        </div>

        {/* Label */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
          Account Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder="e.g. Father's Number"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 14,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* ID — only for new accounts */}
        {!isEdit && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
              Account ID <span style={{ color: '#ef4444' }}>*</span>{' '}
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>(lowercase, no spaces)</span>
            </label>
            <input
              value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
              placeholder="e.g. father"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 14,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
              }}
            />
          </>
        )}

        {/* Description */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
          Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="e.g. +91 98765 43210"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 24,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0',
            background: '#f8fafc', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#25D366,#128C7E)',
            color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}>
            {isEdit ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   WhatsApp Page Component
   ═══════════════════════════════════════════════════════════ */
const WhatsApp = () => {
  const [status,       setStatus]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [disconnecting,setDisconnecting]= useState(false);
  const [activeTab,    setActiveTab]    = useState('logs'); // 'logs' | 'templates' | 'accounts'

  // Templates states
  const [templates,    setTemplates]    = useState({});
  const [selectedKey,  setSelectedKey]  = useState('new_order');
  const [editedText,   setEditedText]   = useState('');
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Accounts states
  const [accounts,      setAccounts]      = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [switchingId,   setSwitchingId]   = useState(null); // which account is switching
  const [modalAccount,  setModalAccount]  = useState(null); // null=closed, {}=new, {...}=edit
  const [savingAccounts, setSavingAccounts] = useState(false);

  // Adaptive polling
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setStatus(res.data.data);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Adaptive polling interval
  useEffect(() => {
    const connected    = status?.connected;
    const initializing = status?.initializing;
    const switching    = status?.switching;
    const hasQR        = !!status?.qr;

    const interval = (hasQR || initializing || switching) ? 3000 : connected ? 12000 : 8000;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchStatus, interval);
    return () => clearInterval(timerRef.current);
  }, [status?.connected, status?.initializing, status?.switching, !!status?.qr, fetchStatus]);

  // Clear switching state when done
  useEffect(() => {
    if (!status?.switching && switchingId) {
      setSwitchingId(null);
    }
  }, [status?.switching]);

  // ── Accounts ────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await api.get('/whatsapp/accounts');
      if (res.data.success) setAccounts(res.data.data);
    } catch {
      toast.error('Failed to load accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'accounts') fetchAccounts();
  }, [activeTab, fetchAccounts]);

  const handleSwitch = async (accountId) => {
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) return;

    const alreadyActive = status?.currentAccountId === accountId;
    if (alreadyActive && status?.connected) {
      toast('Already connected to this account!', { icon: 'ℹ️' });
      return;
    }

    setSwitchingId(accountId);
    try {
      const res = await api.post('/whatsapp/switch', { accountId });
      if (res.data.success) {
        if (!acct.hasSession) {
          toast('📲 Generating QR code… scan with that phone!', { duration: 4000 });
        } else {
          toast.success(`Switching to ${acct.emoji || ''} ${acct.label}…`);
        }
        fetchAccounts();
        setTimeout(fetchStatus, 800);
        setTimeout(fetchStatus, 2000);
        setTimeout(fetchStatus, 4000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Switch failed.');
    } finally {
      setTimeout(() => {
        setSwitchingId(null);
        fetchAccounts();
      }, 2000);
    }
  };

  const handleSaveAccounts = async (updatedList) => {
    setSavingAccounts(true);
    try {
      await api.post('/whatsapp/accounts', { accounts: updatedList });
      setAccounts(updatedList.map(a => ({ ...a })));
      toast.success('Accounts saved!');
    } catch {
      toast.error('Failed to save accounts.');
    } finally {
      setSavingAccounts(false);
    }
  };

  const handleAddAccount = (newAcct) => {
    if (accounts.find(a => a.id === newAcct.id)) {
      toast.error(`An account with ID "${newAcct.id}" already exists.`);
      return;
    }
    const updated = [...accounts, newAcct];
    handleSaveAccounts(updated);
    setModalAccount(null);
  };

  const handleEditAccount = (updatedAcct) => {
    const updated = accounts.map(a => a.id === updatedAcct.id ? updatedAcct : a);
    handleSaveAccounts(updated);
    setModalAccount(null);
  };

  const handleDeleteAccount = (accountId) => {
    if (status?.currentAccountId === accountId) {
      toast.error('Cannot delete the currently active account.');
      return;
    }
    if (!window.confirm('Delete this account profile?\n\nNote: Saved WhatsApp session on disk is not deleted.')) return;
    const updated = accounts.filter(a => a.id !== accountId);
    handleSaveAccounts(updated);
  };

  // ── Templates ───────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/settings/whatsapp_templates');
      if (res.data.success) {
        setTemplates(res.data.data);
        setEditedText(res.data.data[selectedKey] || DEFAULT_TEMPLATES[selectedKey] || '');
      }
    } catch { toast.error('Failed to load WhatsApp templates.'); }
  }, [selectedKey]);

  useEffect(() => {
    if (activeTab === 'templates') loadTemplates();
  }, [activeTab, loadTemplates]);

  useEffect(() => {
    if (templates && templates[selectedKey] !== undefined) {
      setEditedText(templates[selectedKey]);
    } else {
      setEditedText(DEFAULT_TEMPLATES[selectedKey] || '');
    }
  }, [selectedKey, templates]);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await api.post('/whatsapp/reconnect');
      toast.success('WhatsApp reconnecting…');
      setTimeout(fetchStatus, 2000);
    } catch {
      toast.error('Reconnect failed — check server logs');
    } finally { setReconnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(
      `Disconnect ${status?.phone || 'this device'} from WhatsApp?\n\nYou will need to scan a new QR code to reconnect.`
    )) return;

    setDisconnecting(true);
    try {
      await api.post('/whatsapp/disconnect');
      toast.success('Session cleared — QR code will appear shortly.');
      setTimeout(fetchStatus, 2000);
    } catch {
      toast.error('Disconnect failed');
    } finally { setDisconnecting(false); }
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      const updated = { ...templates, [selectedKey]: editedText };
      const res = await api.put('/settings/whatsapp_templates', { value: updated });
      if (res.data.success) {
        setTemplates(updated);
        toast.success('Template saved successfully!');
      }
    } catch { toast.error('Failed to save templates.'); }
    finally { setSavingTemplates(false); }
  };

  const handleResetTemplate = () => {
    if (window.confirm('Reset this template to the default factory message?')) {
      setEditedText(DEFAULT_TEMPLATES[selectedKey] || '');
    }
  };

  const getMockPreviewText = (rawText) => {
    if (!rawText) return '';
    return rawText
      .replace(/{customerName}/g, 'Ramesh Nair')
      .replace(/{orderId}/g, '104')
      .replace(/{productType}/g, 'Sliding Window (4x3 feet)')
      .replace(/{orderAmount}/g, '45,000')
      .replace(/{advancePaid}/g, '15,000')
      .replace(/{balanceDue}/g, '30,000')
      .replace(/{deliveryDate}/g, '28-July-2026')
      .replace(/{status}/g, 'In Production')
      .replace(/{emoji}/g, '🔥')
      .replace(/{stage}/g, 'Welding')
      .replace(/{allDoneMessage}/g, '\n🎉 *All stages complete! Order is ready.*\n\n')
      .replace(/{randomQuote}/g, '✨ _"Success is the sum of small efforts repeated day in and day out."_ — Robert Collier');
  };

  const renderFormattedWhatsAppText = (text) => {
    if (!text) return null;
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  /* ── Derived state ────────────────────────────────── */
  const connected    = status?.connected;
  const hasQR        = !!status?.qr;
  const initializing = status?.initializing;
  const switching    = status?.switching;
  const msgLog       = status?.messageLog || [];
  const msgCount     = msgLog.length;
  const sentCount    = msgLog.filter(m => m.status === 'sent').length;
  const failCount    = msgCount - sentCount;
  const activeAccountId = status?.currentAccountId || 'personal';

  const statusLabel = switching    ? 'Switching…'
                    : connected    ? 'Connected'
                    : hasQR        ? 'Scan QR'
                    : initializing ? 'Starting…'
                    : 'Disconnected';
  const statusColor = switching    ? { dot: '#F59E0B', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
                    : connected    ? { dot: '#22C55E', badge: 'bg-green-500/15 text-green-400 border-green-500/30' }
                    : hasQR        ? { dot: '#F59E0B', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
                    : initializing ? { dot: '#3B82F6', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
                    : { dot: '#EF4444', badge: 'bg-red-500/15 text-red-400 border-red-500/30' };

  const currentTemplateDetail = TEMPLATE_KEYS.find(t => t.key === selectedKey);

  // Find active account profile from accounts list
  const activeAccountProfile = accounts.find(a => a.id === activeAccountId);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="space-y-6 animate-fade-in">

      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div style={{
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
          }} className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MessageSquare size={28} color="white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-800 leading-tight">WhatsApp Notifications</h1>
            <p className="text-slate-500 text-sm mt-0.5">Automated messaging — attendance, orders &amp; production</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!loading && (
            <div style={{ borderColor: statusColor.dot + '40' }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${statusColor.badge}`}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor.dot,
                boxShadow: (connected || hasQR || initializing || switching) ? `0 0 0 3px ${statusColor.dot}40` : 'none',
                animation: (connected || hasQR || initializing || switching) ? 'pulse 2s infinite' : 'none',
                flexShrink: 0, display: 'inline-block',
              }} />
              {statusLabel}
            </div>
          )}
          {connected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <LogOut size={15} />
              {disconnecting ? 'Disconnecting…' : 'Disconnect Device'}
            </button>
          )}
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="btn-outline flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={15} className={reconnecting ? 'animate-spin' : ''} />
            {reconnecting ? 'Reconnecting…' : 'Reconnect'}
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'logs' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-navy-800'
          }`}
        >
          <Activity size={15} />
          Dashboard &amp; Logs
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'accounts' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-navy-800'
          }`}
        >
          <Users size={15} />
          Accounts
          <span style={{
            fontSize: 10, fontWeight: 800,
            background: 'linear-gradient(135deg,#25D366,#128C7E)',
            color: '#fff', padding: '1px 7px', borderRadius: 99,
          }}>
            {activeAccountProfile?.emoji || '📱'} {activeAccountProfile?.label || activeAccountId}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'templates' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-navy-800'
          }`}
        >
          <FileText size={15} />
          Message Templates
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader size={32} className="animate-spin text-navy-800" />
            <p className="text-slate-500 text-sm">Connecting to WhatsApp service…</p>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        <>
          {/* ── Stats row ──────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Connection',    value: connected ? 'Active' : 'Offline',
                icon: connected ? Wifi : WifiOff,
                color: connected ? '#22C55E' : '#EF4444',
                bg:   connected ? 'from-green-500/10 to-green-600/5' : 'from-red-500/10 to-red-600/5',
              },
              { label: 'Sent',    value: sentCount, icon: Send,          color: '#3B82F6', bg: 'from-blue-500/10 to-blue-600/5' },
              { label: 'Failed',  value: failCount, icon: AlertTriangle, color: '#F59E0B', bg: 'from-amber-500/10 to-amber-600/5' },
              { label: 'Retries', value: status?.retryCount ?? 0, icon: RotateCcw, color: '#8B5CF6', bg: 'from-violet-500/10 to-violet-600/5' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label}
                style={{ border: `1px solid ${color}25` }}
                className={`card bg-gradient-to-br ${bg} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                  <Icon size={16} style={{ color }} />
                </div>
                <p className="text-2xl font-bold text-navy-800">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Connected device info card ── */}
          {connected && (
            <div style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.04)' }}
              className="card rounded-2xl">
              <div className="flex items-center gap-4 flex-wrap">
                <div style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow:'0 4px 16px rgba(37,211,102,0.3)' }}
                   className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">
                  {activeAccountProfile?.emoji || '📱'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-green-700 text-base">Linked &amp; Active</p>
                    {activeAccountProfile && (
                      <span className="text-sm font-semibold text-green-700">
                        — {activeAccountProfile.label}
                      </span>
                    )}
                    <span style={{ background:'#22C55E18', border:'1px solid #22C55E40' }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-green-700 px-2.5 py-1 rounded-full">
                      <span style={{ width:6,height:6,borderRadius:'50%',background:'#22C55E',display:'inline-block',animation:'pulse 2s infinite' }} />
                      LIVE
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 leading-none">Phone Number</p>
                        <p className="text-sm font-bold text-navy-800 mt-0.5">{status?.phone || '—'}</p>
                      </div>
                    </div>
                    {status?.name && (
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 leading-none">Account Name</p>
                          <p className="text-sm font-bold text-navy-800 mt-0.5">{status.name}</p>
                        </div>
                      </div>
                    )}
                    {status?.uptime && (
                      <div className="flex items-center gap-2">
                        <Timer size={13} className="text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 leading-none">Connected For</p>
                          <p className="text-sm font-bold text-navy-800 mt-0.5">{status.uptime}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {status?.connectedAt && (
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock size={10} /> Since {fmtTime(status.connectedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Switching notice ── */}
          {switching && (
            <div style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)' }}
              className="card flex items-center gap-4 rounded-xl py-5">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft size={20} className="text-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-navy-800">Switching WhatsApp account…</p>
                <p className="text-sm text-slate-500 mt-0.5">This takes a few seconds. The QR or connected status will update shortly.</p>
              </div>
            </div>
          )}

          {/* ── QR Panel ── */}
          {!connected && !switching && hasQR && (
            <div style={{
              background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
              border: '1px solid rgba(37,211,102,0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }} className="card text-center py-10 rounded-2xl">
              <div className="flex items-center justify-center gap-3 mb-2">
                <MessageSquare size={24} color="#25D366" />
                <h3 className="text-xl font-bold text-white">Scan to Connect WhatsApp</h3>
              </div>
              {activeAccountProfile && (
                <p className="text-amber-300 text-sm font-semibold mb-1">
                  {activeAccountProfile.emoji} {activeAccountProfile.label}
                  {activeAccountProfile.description ? ` — ${activeAccountProfile.description}` : ''}
                </p>
              )}
              <p className="text-slate-400 text-sm mb-8">
                Open WhatsApp →{' '}
                <span className="text-white font-semibold">⋮ Menu</span> →{' '}
                <span className="text-white font-semibold">Linked Devices</span> →{' '}
                <span className="text-white font-semibold">Link a Device</span>
              </p>
              <div className="flex justify-center">
                <div style={{
                  padding: 20, background: '#fff', borderRadius: 20,
                  boxShadow: '0 0 0 6px rgba(37,211,102,0.25), 0 20px 60px rgba(0,0,0,0.4)',
                }}>
                  <QRCodeSVG value={status.qr} size={220} bgColor="#ffffff" fgColor="#0D1F2D" level="M" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-6 flex items-center justify-center gap-1.5">
                <Clock size={12} className="text-slate-400" />
                QR refreshes automatically every 3 seconds
              </p>
            </div>
          )}

          {/* ── Disconnected / Initializing notice ── */}
          {!connected && !hasQR && !switching && (
            <div style={{
              border: initializing ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(239,68,68,0.2)',
              background: initializing ? 'rgba(59,130,246,0.04)' : 'rgba(239,68,68,0.04)',
            }} className="card flex items-center gap-4 rounded-xl py-5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                initializing ? 'bg-blue-50' : 'bg-red-50'
              }`}>
                {initializing
                  ? <Loader size={20} className="text-blue-500 animate-spin" />
                  : <WifiOff size={20} className="text-red-500" />
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-navy-800">
                  {initializing ? 'WhatsApp is starting up…' : 'WhatsApp is disconnected'}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {initializing
                    ? 'Please wait — a QR code will appear here shortly.'
                    : 'The service will reconnect automatically, or click Reconnect to force a new attempt.'}
                </p>
                {!initializing && (status?.retryCount || 0) > 0 && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <RotateCcw size={10} /> {status.retryCount} reconnect attempt{status.retryCount !== 1 ? 's' : ''} made
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Message History ── */}
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="font-bold text-navy-800 flex items-center gap-2">
                <Activity size={16} className="text-orange-500" />
                Message History
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full font-semibold">
                  ✓ {sentCount} sent
                </span>
                {failCount > 0 && (
                  <span className="text-xs px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-semibold">
                    ✗ {failCount} failed
                  </span>
                )}
                <span className="text-xs text-slate-400">{msgCount} total</span>
              </div>
            </div>

            {!msgCount ? (
              <div className="text-center py-16">
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#25D366,#128C7E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', opacity: 0.25,
                }}>
                  <MessageSquare size={32} color="white" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No messages sent yet</p>
                <p className="text-slate-300 text-xs mt-1">
                  Messages appear here once attendance, orders, or production actions are taken.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {msgLog.map((msg, i) => (
                  <div key={i}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                      msg.status === 'sent'
                        ? 'bg-green-50/60 border-green-100 hover:bg-green-50'
                        : 'bg-red-50/60 border-red-100 hover:bg-red-50'
                    }`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {msg.status === 'sent'
                        ? <CheckCircle2 size={18} className="text-green-500" />
                        : <XCircle      size={18} className="text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-navy-800">{msg.label}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone size={10} /> {msg.phone}
                        </span>
                        {msg.account && (
                          <span className="text-xs text-slate-400 italic">
                            via {accounts.find(a => a.id === msg.account)?.emoji || ''} {msg.account}
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          msg.status === 'sent' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                        }`}>
                          {msg.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-mono leading-relaxed line-clamp-2">
                        {truncate(msg.text)}
                      </p>
                      {msg.error && <p className="text-xs text-red-500 mt-0.5">{msg.error}</p>}
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {fmtTime(msg.sentAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>

      ) : activeTab === 'accounts' ? (
        /* ══════════════════════════════════════════════════════
           Accounts Tab
           ══════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-navy-800 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-orange-500" />
                Switch WhatsApp Account
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Tap <strong>Switch</strong> to change the active number. Saved sessions reconnect instantly.
              </p>
            </div>
            <button
              onClick={() => setModalAccount({})}
              className="btn-accent flex items-center gap-2"
            >
              <Plus size={16} /> Add Account
            </button>
          </div>

          {accountsLoading ? (
            <div className="flex justify-center py-16">
              <Loader size={28} className="animate-spin text-slate-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="card text-center py-16">
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg,#25D366,#128C7E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', opacity: 0.3,
              }}>
                <Users size={28} color="white" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No accounts set up yet</p>
              <p className="text-slate-300 text-xs mt-1">Click "Add Account" to create your first profile.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Inline QR panel: shown when active account needs scanning ── */}
              {hasQR && !connected && !switching && (
                <div style={{
                  background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
                  border: '1px solid rgba(37,211,102,0.35)',
                  borderRadius: 20,
                  padding: '32px 24px',
                  textAlign: 'center',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                    <MessageSquare size={22} color="#25D366" />
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: 0 }}>Scan QR to Link WhatsApp</p>
                  </div>
                  {activeAccountProfile && (
                    <p style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      {activeAccountProfile.emoji} {activeAccountProfile.label}
                      {activeAccountProfile.description ? ` — ${activeAccountProfile.description}` : ''}
                    </p>
                  )}
                  <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
                    Open WhatsApp on that phone → <strong style={{ color: '#e2e8f0' }}>⋮ Menu</strong> → <strong style={{ color: '#e2e8f0' }}>Linked Devices</strong> → <strong style={{ color: '#e2e8f0' }}>Link a Device</strong>
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      padding: 18, background: '#fff', borderRadius: 18,
                      boxShadow: '0 0 0 8px rgba(37,211,102,0.2), 0 20px 60px rgba(0,0,0,0.4)',
                    }}>
                      <QRCodeSVG value={status.qr} size={240} bgColor="#ffffff" fgColor="#0D1F2D" level="M" />
                    </div>
                  </div>
                  <p style={{ color: '#64748b', fontSize: 12, marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Clock size={12} /> QR refreshes automatically every 3 seconds
                  </p>
                </div>
              )}

              {/* ── Switching notice inline ── */}
              {switching && (
                <div style={{
                  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 16, padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowRightLeft size={20} style={{ color: '#d97706' }} className="animate-pulse" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#92400e', margin: 0 }}>Switching account…</p>
                    <p style={{ fontSize: 13, color: '#b45309', margin: '3px 0 0' }}>Please wait, the QR or connected status will appear here shortly.</p>
                  </div>
                </div>
              )}

              {/* ── Account cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(acct => {
                const isActive        = acct.id === activeAccountId;
                const isConnected     = isActive && connected;
                const isWaitingForQR  = isActive && hasQR && !connected && !switching;
                const isSwitchingThis = switchingId === acct.id;
                const saved           = acct.hasSession;

                return (
                  <div key={acct.id} style={{
                    border: isWaitingForQR
                      ? '2px solid rgba(37,211,102,0.6)'
                      : isActive
                      ? '2px solid rgba(37,211,102,0.45)'
                      : '1px solid rgba(148,163,184,0.2)',
                    background: isWaitingForQR
                      ? 'linear-gradient(135deg, rgba(15,32,39,0.03), rgba(37,211,102,0.05))'
                      : isActive
                      ? 'linear-gradient(135deg, rgba(37,211,102,0.06), rgba(18,140,126,0.04))'
                      : '#fff',
                    borderRadius: 18,
                    padding: '20px',
                    position: 'relative',
                    transition: 'all 0.2s',
                    boxShadow: isActive
                      ? '0 4px 24px rgba(37,211,102,0.15)'
                      : '0 1px 8px rgba(0,0,0,0.06)',
                  }}>
                    {/* Status badge top-right */}
                    {isConnected && (
                      <div style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'linear-gradient(135deg,#25D366,#128C7E)',
                        color: '#fff', fontSize: 10, fontWeight: 800,
                        padding: '3px 10px', borderRadius: 99,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width:5,height:5,borderRadius:'50%',background:'#fff',animation:'pulse 2s infinite',display:'inline-block' }} />
                        ACTIVE
                      </div>
                    )}
                    {isWaitingForQR && (
                      <div style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                        color: '#fff', fontSize: 10, fontWeight: 800,
                        padding: '3px 10px', borderRadius: 99,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width:5,height:5,borderRadius:'50%',background:'#fff',animation:'pulse 2s infinite',display:'inline-block' }} />
                        SCAN QR ↑
                      </div>
                    )}
                    {isSwitchingThis && !isWaitingForQR && (
                      <div style={{
                        position: 'absolute', top: 14, right: 14,
                        background: '#64748b', color: '#fff', fontSize: 10, fontWeight: 800,
                        padding: '3px 10px', borderRadius: 99,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Loader size={8} className="animate-spin" /> SWITCHING
                      </div>
                    )}

                    {/* Emoji + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14, fontSize: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'rgba(37,211,102,0.1)' : '#f1f5f9',
                        border: isActive ? '1px solid rgba(37,211,102,0.3)' : '1px solid #e2e8f0',
                      }}>
                        {acct.emoji || '📱'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: '#0f2027', marginBottom: 2 }}>
                          {acct.label}
                        </p>
                        {acct.description && (
                          <p style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {acct.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Session status pill */}
                    <div style={{ marginBottom: 16 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 99,
                        background: isConnected ? 'rgba(34,197,94,0.1)' : saved ? 'rgba(59,130,246,0.1)' : 'rgba(148,163,184,0.12)',
                        color: isConnected ? '#16a34a' : saved ? '#1d4ed8' : '#64748b',
                        border: isConnected ? '1px solid rgba(34,197,94,0.25)' : saved ? '1px solid rgba(59,130,246,0.25)' : '1px solid #e2e8f0',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        {isConnected
                          ? <><Wifi size={11} /> Connected</>
                          : saved
                          ? <><CheckCheck size={11} /> Session Saved</>
                          : <><Phone size={11} /> Not Linked Yet</>
                        }
                      </span>
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isConnected ? (
                        <div style={{
                          flex: 1, textAlign: 'center', padding: '9px 0',
                          background: 'rgba(37,211,102,0.08)', borderRadius: 10,
                          color: '#16a34a', fontWeight: 700, fontSize: 13,
                          border: '1px solid rgba(37,211,102,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <Wifi size={14} /> Currently Active
                        </div>
                      ) : isWaitingForQR ? (
                        <div style={{
                          flex: 1, textAlign: 'center', padding: '9px 0',
                          background: 'rgba(245,158,11,0.1)', borderRadius: 10,
                          color: '#92400e', fontWeight: 700, fontSize: 13,
                          border: '1px solid rgba(245,158,11,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <span style={{ fontSize: 16 }}>📲</span> Scan QR above
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSwitch(acct.id)}
                          disabled={!!switchingId}
                          style={{
                            flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                            background: isSwitchingThis
                              ? 'linear-gradient(135deg,#94a3b8,#64748b)'
                              : saved
                              ? 'linear-gradient(135deg,#25D366,#128C7E)'
                              : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            opacity: switchingId && !isSwitchingThis ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'all 0.2s',
                          }}
                        >
                          {isSwitchingThis
                            ? <><Loader size={13} className="animate-spin" /> Switching…</>
                            : saved
                            ? <><ArrowRightLeft size={13} /> Switch</>
                            : <><span>📲</span> Link WhatsApp</>
                          }
                        </button>
                      )}

                      <button
                        onClick={() => setModalAccount(acct)}
                        style={{
                          width: 38, height: 38, borderRadius: 10,
                          border: '1px solid #e2e8f0', background: '#f8fafc',
                          color: '#64748b', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Edit account"
                      >
                        <Pencil size={14} />
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => handleDeleteAccount(acct.id)}
                          style={{
                            width: 38, height: 38, borderRadius: 10,
                            border: '1px solid #fecaca', background: '#fef2f2',
                            color: '#ef4444', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                          title="Delete account"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Tips box */}
          <div style={{
            background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 14, padding: '16px 20px',
          }}>
            <p style={{ fontSize: 13, color: '#1e40af', fontWeight: 700, marginBottom: 6 }}>💡 How Switching Works</p>
            <ul style={{ fontSize: 12, color: '#3b82f6', margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong>First time linking</strong> a number → a QR code will appear. Scan with that phone's WhatsApp.</li>
              <li><strong>Returning session</strong> → reconnects silently in 2–3 seconds. No QR needed!</li>
              <li>Each account's session is saved separately. Switching never logs out the other accounts.</li>
              <li>Messages sent will always show which account was active at that time in the log.</li>
            </ul>
          </div>
        </div>

      ) : (
        /* ── Template Editor View ─────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Selector & Placeholders (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="card space-y-4">
              <div>
                <label className="label text-sm font-semibold">Select Notification Template</label>
                <select
                  value={selectedKey}
                  onChange={e => setSelectedKey(e.target.value)}
                  className="select mt-1"
                >
                  {TEMPLATE_KEYS.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {currentTemplateDetail && (
                <div>
                  <p className="text-xs text-slate-500 italic leading-relaxed">
                    💡 {currentTemplateDetail.desc}
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-bold text-navy-800 text-sm mb-3 flex items-center gap-1.5">
                <FileText size={15} className="text-orange-500" />
                Available Placeholder Tags
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Click any tag below to copy it. Paste it in your template editor on the right; it will be replaced with real data dynamically.
              </p>
              
              <div className="flex flex-wrap gap-2">
                {currentTemplateDetail?.placeholders.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      navigator.clipboard.writeText(tag);
                      toast.success(`Copied: ${tag}`);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 rounded-md text-xs font-mono border border-slate-200 hover:border-orange-200 transition-colors flex items-center gap-1"
                    title="Click to copy tag"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Text Editor & Mock Preview (7 columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-navy-800">Edit Template Content</h3>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1"
                >
                  Reset to Default
                </button>
              </div>

              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="input font-mono text-sm leading-relaxed"
                rows={12}
                placeholder="Write your template text here..."
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleSaveTemplates}
                  disabled={savingTemplates}
                  className="btn-accent px-5 py-2.5 flex items-center gap-2"
                >
                  {savingTemplates ? (
                    <><Loader size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    <>Save Template</>
                  )}
                </button>
              </div>
            </div>

            {/* Premium WhatsApp-style Preview Box */}
            <div className="card overflow-hidden">
              <h3 className="font-bold text-navy-800 mb-3 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#25D366]" /> Live Mobile Preview
              </h3>
              
              <div style={{
                backgroundColor: '#e5ddd5',
                backgroundImage: 'radial-gradient(circle, #d2c9bd 10%, transparent 11%)',
                backgroundSize: '12px 12px',
                minHeight: '260px'
              }} className="rounded-xl p-4 flex flex-col justify-end">
                
                <div style={{
                  maxWidth: '85%',
                  backgroundColor: '#d9fdd3',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  alignSelf: 'flex-start'
                }} className="rounded-xl rounded-tl-none p-3.5 relative border border-green-100 flex flex-col text-slate-800 text-sm">
                  
                  <div className="whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
                    {renderFormattedWhatsAppText(getMockPreviewText(editedText))}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 self-end">
                    <span>{new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    <span className="flex items-center text-[#53bdeb] ml-0.5 font-bold">
                      <Check size={12} className="stroke-[3]" />
                      <Check size={12} className="-ml-1.5 stroke-[3]" />
                    </span>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Account Modal ──────────────────────────────── */}
      {modalAccount !== null && (
        <AccountModal
          account={Object.keys(modalAccount).length > 0 ? modalAccount : null}
          onSave={Object.keys(modalAccount).length > 0 ? handleEditAccount : handleAddAccount}
          onClose={() => setModalAccount(null)}
        />
      )}

    </div>
  );
};

export default WhatsApp;
