import React, { useEffect, useState, useCallback } from 'react';
import { Edit2, Clock, Loader, User, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { printIndividualAttendance } from '../utils/exportUtils';

const STATUS_MAP = {
  Present:    { class: 'badge-green',  icon: '✅' },
  Absent:     { class: 'badge-red',    icon: '❌' },
  Late:       { class: 'badge-yellow', icon: '⏰' },
  'Half Day': { class: 'badge-orange', icon: '🔆' },
  Leave:      { class: 'badge-gray',   icon: '🏖️' },
};

// ── IST-safe "today" date string ──────────────────────────────
// Using Date.toISOString() uses UTC and can return yesterday in IST (+5:30).
// We build YYYY-MM-DD from local clock parts instead.
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Convert "14:30" → "2:30 PM"
const fmt12h = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const Attendance = () => {
  const { can, isEmployee } = useAuth();

  // ── Tab ────────────────────────────────────────────────────
  const [tab, setTab] = useState('daily'); // 'daily' | 'summary'

  // ── Daily State ───────────────────────────────────────────
  const [date,    setDate]    = useState(localDateStr());
  const [daily,   setDaily]   = useState({ data: [], unmarked: [], selfView: false });
  const [loading, setLoading] = useState(true);

  // ── Summary State ─────────────────────────────────────────
  const today = new Date();
  const [sumMonth, setSumMonth] = useState(today.getMonth() + 1);
  const [sumYear,  setSumYear]  = useState(today.getFullYear());
  const [summary,  setSummary]  = useState([]);
  const [sumLoading, setSumLoading] = useState(false);

  // ── Modal / Form State ────────────────────────────────────
  const [modal,    setModal]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({
    employee_id: '', date: '', check_in: '09:00', check_out: '18:00',
    status: 'Present', overtime_hours: 0, notes: '',
  });

  // ── Load Daily ────────────────────────────────────────────
  const loadDaily = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance?date=${date}`);
      setDaily(res.data);
    } catch { toast.error('Failed to load attendance.'); }
    finally { setLoading(false); }
  }, [date]);

  // ── Load Monthly Summary ──────────────────────────────────
  const loadSummary = useCallback(async () => {
    setSumLoading(true);
    try {
      const res = await api.get(`/attendance/summary?month=${sumMonth}&year=${sumYear}`);
      setSummary(res.data.data || []);
    } catch { toast.error('Failed to load summary.'); }
    finally { setSumLoading(false); }
  }, [sumMonth, sumYear]);

  useEffect(() => {
    if (tab === 'daily') loadDaily();
  }, [tab, loadDaily]);

  useEffect(() => {
    if (tab === 'summary') loadSummary();
  }, [tab, loadSummary]);

  // ── Month Navigation ──────────────────────────────────────
  const prevMonth = () => {
    if (sumMonth === 1) { setSumMonth(12); setSumYear(y => y - 1); }
    else setSumMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (sumMonth === 12) { setSumMonth(1); setSumYear(y => y + 1); }
    else setSumMonth(m => m + 1);
  };
  const sumMonthLabel = new Date(sumYear, sumMonth - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // ── Open Mark Modal ───────────────────────────────────────
  const openMark = (emp) => {
    setEditMode(false);
    setEditId(null);
    setForm({ employee_id: emp.id, date, check_in: '09:00', check_out: '18:00', status: 'Present', overtime_hours: 0, notes: '' });
    setModal(true);
  };

  // ── Open Edit Modal ───────────────────────────────────────
  const openEdit = (att) => {
    setEditMode(true);
    setEditId(att.id);
    setForm({
      employee_id: att.employee_id,
      date: att.date?.split('T')[0] || att.date,
      check_in: att.check_in || '',
      check_out: att.check_out || '',
      status: att.status,
      overtime_hours: att.overtime_hours || 0,
      notes: att.notes || '',
    });
    setModal(true);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editMode) { await api.put(`/attendance/${editId}`, form); toast.success('Attendance updated!'); }
      else          { await api.post('/attendance', form);           toast.success('Attendance marked!'); }
      setModal(false);
      loadDaily();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  // ── Print Individual Summary ──────────────────────────────
  const handlePrintEmployee = async (emp) => {
    try {
      const fromDate = `${sumYear}-${String(sumMonth).padStart(2, '0')}-01`;
      const lastDay  = new Date(sumYear, sumMonth, 0).getDate();
      const toDate   = `${sumYear}-${String(sumMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await api.get(`/reports/attendance?from=${fromDate}&to=${toDate}&employee_id=${emp.id}`);
      const sum = res.data?.summary || { present: emp.present, absent: emp.absent, late: emp.late, totalOvertime: emp.total_overtime };
      printIndividualAttendance(emp, res.data?.data || [], fromDate, toDate, sum);
    } catch { toast.error('Failed to load records for printing.'); }
  };

  // ── Derived ───────────────────────────────────────────────
  const selfView     = daily.selfView || isEmployee;
  const presentCount = daily.data?.filter(a => a.status === 'Present').length || 0;
  const lateCount    = daily.data?.filter(a => a.status === 'Late').length || 0;
  const absentCount  = daily.data?.filter(a => a.status === 'Absent').length || 0;
  const halfDayCount = daily.data?.filter(a => a.status === 'Half Day').length || 0;

  // ── Date Display ──────────────────────────────────────────
  const dateDisplay = (() => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">{selfView ? 'My Attendance' : 'Attendance System'}</h1>
          <p className="page-subtitle">
            {tab === 'daily'
              ? (selfView ? 'Your personal attendance record' : dateDisplay)
              : `Monthly summary — ${sumMonthLabel}`}
          </p>
        </div>
        {tab === 'daily' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Date:</label>
            <input
              type="date"
              value={date}
              max={localDateStr()}
              onChange={e => setDate(e.target.value)}
              className="input h-9 text-xs w-auto"
            />
          </div>
        )}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'daily',   label: '📅 Daily View' },
          { id: 'summary', label: '📊 Monthly Summary' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-navy-800 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-400 hover:text-navy-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* DAILY VIEW                                           */}
      {/* ════════════════════════════════════════════════════ */}
      {tab === 'daily' && (
        <>
          {/* Stats (Admin / Manager only) */}
          {!selfView && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Present',  count: presentCount,              color: 'text-green-600',  bg: 'bg-green-50' },
                { label: 'Absent',   count: absentCount,               color: 'text-red-500',    bg: 'bg-red-50' },
                { label: 'Late',     count: lateCount,                 color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { label: 'Half Day', count: halfDayCount,              color: 'text-orange-600', bg: 'bg-orange-50' },
              ].map(s => (
                <div key={s.label} className={`card text-center ${s.bg} border-0 shadow-sm`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader size={28} className="animate-spin text-navy-800" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Attendance Table */}
              {daily.data?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        {!selfView && <th>Employee</th>}
                        {!selfView && <th>Role</th>}
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Status</th>
                        <th>Overtime</th>
                        {!selfView && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {daily.data.map(att => {
                        // Safe date display — parse parts to avoid UTC offset shifting the day
                        const [ay, am, ad] = (att.date?.split('T')[0] || att.date || '').split('-').map(Number);
                        const attDateDisplay = (ay && am && ad)
                          ? new Date(ay, am - 1, ad).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—';
                        return (
                          <tr key={att.id}>
                            {!selfView && <td className="font-semibold text-navy-800">{att.employee_name}</td>}
                            {!selfView && <td className="text-slate-500 text-xs">{att.role}</td>}
                            <td className="text-xs text-slate-700 font-medium">{attDateDisplay}</td>
                            <td className="font-mono text-sm text-slate-700">{fmt12h(att.check_in)}</td>
                            <td className="font-mono text-sm text-slate-700">{fmt12h(att.check_out)}</td>
                            <td>
                              <span className={STATUS_MAP[att.status]?.class || 'badge-gray'}>
                                {STATUS_MAP[att.status]?.icon} {att.status}
                              </span>
                            </td>
                            <td className="text-slate-600 text-sm">
                              {Number(att.overtime_hours) > 0 ? `${att.overtime_hours}h` : '—'}
                            </td>
                            {!selfView && (
                              <td>
                                {can('attendance', 'edit') ? (
                                  <button
                                    onClick={() => openEdit(att)}
                                    className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-navy-50 rounded-lg"
                                    title="Edit Attendance"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">View only</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <Clock size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-500">No attendance recorded for {dateDisplay}</p>
                  {selfView && (
                    <p className="text-slate-400 text-sm mt-1">Your attendance has not been marked yet.</p>
                  )}
                </div>
              )}

              {/* Unmarked Employees */}
              {!selfView && daily.unmarked?.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-navy-800 mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-orange-500" />
                    Not Yet Marked Today ({daily.unmarked.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {daily.unmarked.map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-navy-800 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {emp.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-navy-800">{emp.name}</p>
                            <p className="text-[11px] text-slate-400">{emp.role}</p>
                          </div>
                        </div>
                        {can('attendance', 'add') && (
                          <button onClick={() => openMark(emp)} className="btn-sm btn-accent text-xs">
                            Mark
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* MONTHLY SUMMARY                                      */}
      {/* ════════════════════════════════════════════════════ */}
      {tab === 'summary' && (
        <div className="space-y-4">
          {/* Month Navigator */}
          <div className="card flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-navy-800 transition-all">
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => { setSumMonth(today.getMonth() + 1); setSumYear(today.getFullYear()); }}
                  className="px-3 py-1 text-xs font-bold text-navy-800 hover:bg-white rounded-md transition-all"
                >
                  This Month
                </button>
                <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-navy-800 transition-all">
                  <ChevronRight size={18} />
                </button>
              </div>
              <h2 className="text-base font-bold text-navy-800">{sumMonthLabel}</h2>
            </div>
            <p className="text-xs text-slate-500">Showing attendance totals for all active employees</p>
          </div>

          {/* Summary Table */}
          {sumLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader size={28} className="animate-spin text-navy-800" />
            </div>
          ) : summary.length === 0 ? (
            <div className="card text-center py-12">
              <User size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-500">No attendance data for {sumMonthLabel}</p>
            </div>
          ) : (
            <div className="table-container shadow-sm">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employee</th>
                    <th>Role</th>
                    <th className="text-green-600">✅ Present</th>
                    <th className="text-red-500">❌ Absent</th>
                    <th className="text-yellow-600">⏰ Late</th>
                    <th className="text-orange-600">🔆 Half Day</th>
                    <th className="text-blue-600">🏖️ Leave</th>
                    <th>Overtime (h)</th>
                    {can('reports', 'generate') && <th>Print Sheet</th>}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((emp, idx) => {
                    const total  = (emp.present || 0) + (emp.absent || 0) + (emp.late || 0) + (emp.half_day || 0) + (emp.leave || 0);
                    const attRate = total > 0
                      ? Math.round(((emp.present + emp.late + (emp.half_day || 0) * 0.5) / total) * 100)
                      : 0;
                    return (
                      <tr key={emp.id}>
                        <td className="text-slate-400 text-xs font-mono">{idx + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-navy-800 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {emp.name?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-navy-800 text-sm">{emp.name}</p>
                              <p className="text-[10px] text-slate-400">{attRate}% attendance</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-slate-500 text-xs">{emp.role}</td>
                        <td className="text-green-600 font-bold text-center">{emp.present || 0}</td>
                        <td className="text-red-500 font-bold text-center">{emp.absent || 0}</td>
                        <td className="text-yellow-600 font-bold text-center">{emp.late || 0}</td>
                        <td className="text-orange-600 font-bold text-center">{emp.half_day || 0}</td>
                        <td className="text-blue-600 font-bold text-center">{emp.leave || 0}</td>
                        <td className="text-navy-800 font-medium text-center">{Number(emp.total_overtime || 0).toFixed(1)}</td>
                        {can('reports', 'generate') && (
                          <td>
                            <button
                              type="button"
                              onClick={() => handlePrintEmployee(emp)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-colors"
                              title={`Print individual attendance sheet for ${emp.name}`}
                            >
                              <Printer size={12} /> Print
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Mark / Edit Modal ── */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editMode ? `Edit Attendance — ${form.date}` : `Mark Attendance — ${form.date}`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Date (shown in edit mode so user knows which day) */}
          {editMode && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
              <span className="font-semibold text-navy-800">Date: </span>
              {(() => {
                const [y, m, d] = (form.date || '').split('-').map(Number);
                return (y && m && d)
                  ? new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : form.date;
              })()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Check In</label>
              <input type="time" className="input" value={form.check_in}
                onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))} />
            </div>
            <div>
              <label className="label">Check Out</label>
              <input type="time" className="input" value={form.check_out}
                onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(STATUS_MAP).map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, status: s }))}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${
                    form.status === s
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {STATUS_MAP[s].icon} {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Overtime (hours)</label>
            <input type="number" min="0" step="0.5" className="input" value={form.overtime_hours}
              onChange={e => setForm(p => ({ ...p, overtime_hours: e.target.value }))} />
          </div>

          <div>
            <label className="label">Notes / Reason</label>
            <input className="input" value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes or reason..." />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(false)} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? <><Loader size={14} className="animate-spin" /> Saving...</> : editMode ? 'Update' : 'Mark Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Attendance;
