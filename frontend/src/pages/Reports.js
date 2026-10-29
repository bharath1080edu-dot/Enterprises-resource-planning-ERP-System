import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Loader, Printer, User, CheckCircle, Clock, XCircle, Sun, Umbrella } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { exportToPDF, exportToExcel, printIndividualAttendance } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = [
  { id: 'sales',      label: '💰 Sales Report',      desc: 'Monthly revenue & payment history' },
  { id: 'inventory',  label: '📦 Inventory Report',   desc: 'Stock levels, values & low stock' },
  { id: 'attendance', label: '👥 Attendance Report',  desc: 'Employee attendance, present/absent & overtime' },
  { id: 'production', label: '🏭 Production Report',  desc: 'Order stages & completion status' },
  { id: 'profit',     label: '📊 Profit/Loss Report', desc: 'Revenue vs expenses analysis' },
];

const Reports = () => {
  const { can, user } = useAuth();
  const isManagerOnly = user?.role === 'Manager';
  const allowedReportTypes = REPORT_TYPES.filter(rt => {
    if (isManagerOnly) {
      return rt.id !== 'sales' && rt.id !== 'profit';
    }
    return true;
  });

  const [reportType,        setReportType]        = useState(isManagerOnly ? 'inventory' : 'sales');
  const [dateFrom,          setDateFrom]          = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo,            setDateTo]            = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee,  setSelectedEmployee]  = useState('all');
  const [employees,         setEmployees]         = useState([]);
  const [data,              setData]              = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [generated,         setGenerated]         = useState(false);

  // Fetch employees list for filtering
  useEffect(() => {
    api.get('/employees')
      .then(res => setEmployees(res.data?.data || []))
      .catch(() => {});
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setData(null);
    setGenerated(false);
    try {
      let res;
      switch (reportType) {
        case 'sales':
          res = await api.get(`/reports/sales?from=${dateFrom}&to=${dateTo}`);
          setData({ type: reportType, label: 'Sales Report', rows: res.data.data || [], summary: res.data.summary, from: dateFrom, to: dateTo });
          break;
        case 'inventory':
          res = await api.get('/reports/inventory');
          setData({ type: reportType, label: 'Inventory Report', rows: res.data.data || [], summary: res.data.summary, from: dateFrom, to: dateTo });
          break;
        case 'attendance': {
          const empParam = selectedEmployee !== 'all' ? `&employee_id=${selectedEmployee}` : '';
          res = await api.get(`/reports/attendance?from=${dateFrom}&to=${dateTo}${empParam}`);
          const chosenEmp = selectedEmployee !== 'all' ? employees.find(e => String(e.id) === String(selectedEmployee)) : null;
          setData({
            type: reportType,
            label: chosenEmp ? `Individual Attendance Report — ${chosenEmp.name}` : 'Attendance Report',
            rows: res.data.data || [],
            summary: res.data.summary || {},
            from: dateFrom,
            to: dateTo,
            employee: chosenEmp,
          });
          break;
        }
        case 'production':
          res = await api.get('/reports/production');
          setData({ type: reportType, label: 'Production Report', rows: res.data.data || [], summary: res.data.summary, from: dateFrom, to: dateTo });
          break;
        case 'profit':
          res = await api.get(`/reports/profit?from=${dateFrom}&to=${dateTo}`);
          setData({ type: reportType, label: 'Profit/Loss Report', rows: res.data.data || [], summary: res.data.summary, from: dateFrom, to: dateTo });
          break;
        default: break;
      }
      setGenerated(true);
      toast.success('Report generated!');
    } catch (err) {
      toast.error('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintIndividual = (empObj, empRows, customSummary) => {
    const rowsToPrint = empRows || data?.rows || [];
    const empToPrint = empObj || data?.employee || { name: 'Employee', role: 'Staff' };
    printIndividualAttendance(empToPrint, rowsToPrint, data?.from || dateFrom, data?.to || dateTo, customSummary || data?.summary);
  };

  const renderTable = () => {
    if (!data) return null;

    if (data.type === 'profit') {
      return (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center bg-green-50 border-green-200">
            <p className="text-3xl font-bold text-green-600">₹{Number(data.summary.revenue).toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-500 mt-1">Total Revenue</p>
          </div>
          <div className="card text-center bg-red-50 border-red-200">
            <p className="text-3xl font-bold text-red-500">₹{Number(data.summary.expenses).toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-500 mt-1">Total Expenses</p>
          </div>
          <div className={`card text-center ${data.summary.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-3xl font-bold ${data.summary.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              ₹{Math.abs(data.summary.profit).toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-slate-500 mt-1">Net {data.summary.profit >= 0 ? 'Profit' : 'Loss'}</p>
          </div>
        </div>
      );
    }

    if (data.type === 'attendance') {
      const s = data.summary || {};
      const present = s.present || 0;
      const absent = s.absent || 0;
      const late = s.late || 0;
      const halfDay = s.halfDay || 0;
      const leave = s.leave || 0;
      const otHours = s.totalOvertime || 0;

      return (
        <div className="space-y-4">
          {/* Status Breakdown KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="card p-3 text-center bg-green-50/80 border border-green-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-green-700 mb-1">
                <CheckCircle size={14} />
                <span className="text-[11px] font-bold uppercase">Present</span>
              </div>
              <p className="text-2xl font-extrabold text-green-700">{present}</p>
            </div>

            <div className="card p-3 text-center bg-red-50/80 border border-red-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-red-700 mb-1">
                <XCircle size={14} />
                <span className="text-[11px] font-bold uppercase">Absent</span>
              </div>
              <p className="text-2xl font-extrabold text-red-700">{absent}</p>
            </div>

            <div className="card p-3 text-center bg-yellow-50/80 border border-yellow-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-yellow-800 mb-1">
                <Clock size={14} />
                <span className="text-[11px] font-bold uppercase">Late</span>
              </div>
              <p className="text-2xl font-extrabold text-yellow-800">{late}</p>
            </div>

            <div className="card p-3 text-center bg-orange-50/80 border border-orange-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-orange-800 mb-1">
                <Sun size={14} />
                <span className="text-[11px] font-bold uppercase">Half Day</span>
              </div>
              <p className="text-2xl font-extrabold text-orange-800">{halfDay}</p>
            </div>

            <div className="card p-3 text-center bg-blue-50/80 border border-blue-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-blue-800 mb-1">
                <Umbrella size={14} />
                <span className="text-[11px] font-bold uppercase">Leave / Other</span>
              </div>
              <p className="text-2xl font-extrabold text-blue-800">{leave}</p>
            </div>

            <div className="card p-3 text-center bg-purple-50/80 border border-purple-200 shadow-xs">
              <div className="flex items-center justify-center gap-1 text-purple-800 mb-1">
                <Clock size={14} />
                <span className="text-[11px] font-bold uppercase">Overtime</span>
              </div>
              <p className="text-2xl font-extrabold text-purple-800">{Number(otHours).toFixed(1)}h</p>
            </div>
          </div>

          {/* Attendance Log Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                  <th>Overtime</th>
                  <th>Notes</th>
                  <th>Individual Print</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">No attendance records for selected period</td></tr>
                ) : (
                  data.rows.map((row, idx) => {
                    const statusBadge =
                      row.status === 'Present' ? 'badge-green' :
                      row.status === 'Absent' ? 'badge-red' :
                      row.status === 'Late' ? 'badge-yellow' :
                      row.status === 'Half Day' ? 'badge-orange' : 'badge-navy';

                    return (
                      <tr key={row.id || idx}>
                        <td className="text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="font-semibold text-navy-800">{row.employee_name}</td>
                        <td className="text-slate-500 text-xs">{row.role || '—'}</td>
                        <td className="text-xs text-slate-700 font-medium">{new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="font-mono text-xs text-slate-700">{row.check_in || '—'}</td>
                        <td className="font-mono text-xs text-slate-700">{row.check_out || '—'}</td>
                        <td><span className={statusBadge}>{row.status}</span></td>
                        <td className="text-xs font-semibold">{Number(row.overtime_hours) > 0 ? `${row.overtime_hours}h` : '—'}</td>
                        <td className="text-xs text-slate-500 max-w-[150px] truncate">{row.notes || '—'}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              const empRows = data.rows.filter(r => r.employee_id === row.employee_id || r.employee_name === row.employee_name);
                              const empObj = {
                                id: row.employee_id,
                                name: row.employee_name,
                                role: row.role,
                                department: row.department,
                                phone: row.phone
                              };
                              handlePrintIndividual(empObj, empRows);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-colors"
                            title={`Print Individual Attendance Sheet for ${row.employee_name}`}
                          >
                            <Printer size={12} /> Print
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const HEADERS = {
      sales:      ['#', 'Customer', 'Type', 'Amount', 'Method', 'Date'],
      inventory:  ['#', 'Material', 'Category', 'Quantity', 'Unit', 'Cost', 'Total Value', 'Status'],
      production: ['#', 'Order ID', 'Customer', 'Product', 'Stage', 'Progress%'],
    };

    const renderRow = (row, idx) => {
      switch (data.type) {
        case 'sales': return (
          <tr key={row.id}><td>{idx+1}</td><td>{row.customer_name||'—'}</td><td><span className="badge-navy">{row.payment_type}</span></td><td className="font-bold text-green-600">₹{Number(row.amount).toLocaleString('en-IN')}</td><td>{row.payment_method}</td><td>{new Date(row.payment_date).toLocaleDateString('en-IN')}</td></tr>
        );
        case 'inventory': return (
          <tr key={row.id}><td>{idx+1}</td><td className="font-medium">{row.material_name}</td><td><span className="badge-navy">{row.category}</span></td><td>{Number(row.quantity).toLocaleString()}</td><td>{row.unit}</td><td>₹{Number(row.cost).toLocaleString('en-IN')}</td><td className="font-bold">₹{(Number(row.quantity)*Number(row.cost)).toLocaleString('en-IN')}</td><td>{row.is_low_stock ? <span className="badge-red">Low Stock</span> : <span className="badge-green">OK</span>}</td></tr>
        );
        case 'production': return (
          <tr key={row.order_id}><td>{idx+1}</td><td>#{row.order_id}</td><td>{row.customer_name}</td><td>{row.product_type}</td><td>{row.current_stage}</td><td><div className="flex items-center gap-2"><div className="progress-bar w-16"><div className="progress-fill" style={{width:`${row.completion}%`}}/></div><span className="text-xs">{row.completion}%</span></div></td></tr>
        );
        default: return null;
      }
    };

    return (
      <div className="table-container">
        <table className="table">
          <thead><tr>{HEADERS[data.type]?.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {data.rows.length === 0
              ? <tr><td colSpan={10} className="text-center py-8 text-slate-400">No data for selected period</td></tr>
              : data.rows.map((row, idx) => renderRow(row, idx))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate, analyze and export business &amp; individual attendance reports</p>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="card">
        <h3 className="font-bold text-navy-800 mb-4">Configure Report</h3>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {/* Report Type Selector */}
          <div className="md:col-span-1">
            <label className="label text-xs">Select Report Type</label>
            <div className="space-y-2">
              {allowedReportTypes.map(rt => (
                <button key={rt.id} onClick={() => setReportType(rt.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${reportType === rt.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className={`font-semibold text-sm ${reportType === rt.id ? 'text-orange-700' : 'text-navy-800'}`}>{rt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{rt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Filter Parameters */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label text-xs">Date From</label>
                <input type="date" className="input text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Date To</label>
                <input type="date" className="input text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>

            {/* Attendance Filter: Individual Employee vs All */}
            {reportType === 'attendance' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <label className="label text-xs flex items-center gap-1.5 font-bold text-navy-800">
                  <User size={14} className="text-orange-500" />
                  Filter by Individual Employee
                </label>
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className="input text-xs h-9 bg-white"
                >
                  <option value="all">👥 All Employees (Full Factory Report)</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      👤 {emp.name} ({emp.role} · {emp.department || 'Production'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  {selectedEmployee === 'all'
                    ? 'Generates overall attendance logs with individual print buttons for each employee.'
                    : 'Generates detailed individual attendance report with present, absent, late, half-day, and overtime breakdown.'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {can('reports', 'generate') ? (
                <button onClick={generateReport} disabled={loading} className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold shadow-md">
                  {loading ? <><Loader size={15} className="animate-spin" /> Generating Report...</> : <><BarChart3 size={15} /> Generate Report</>}
                </button>
              ) : (
                <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                  <p className="text-xs text-slate-500">You have <strong>View Only</strong> access to reports. Contact Admin to generate exports.</p>
                </div>
              )}

              {generated && data && can('reports', 'generate') && (
                <div className="flex gap-2">
                  {data.type === 'attendance' && (
                    <button
                      type="button"
                      onClick={() => handlePrintIndividual()}
                      className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
                      title="Print Individual Attendance Report"
                    >
                      <Printer size={14} /> Print Report
                    </button>
                  )}
                  <button onClick={() => exportToPDF(data)} className="btn-outline text-xs px-3 py-2 gap-1.5">
                    <Download size={14} /> PDF
                  </button>
                  <button onClick={() => exportToExcel(data)} className="btn-outline text-xs px-3 py-2 gap-1.5">
                    <Download size={14} /> Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Report Output */}
      {generated && data && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-navy-900 text-base">{data.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Period: {new Date(data.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — {new Date(data.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {data.rows?.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="badge-navy">{data.rows.length} total records</span>
                {data.type === 'attendance' && (
                  <button
                    onClick={() => handlePrintIndividual()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <Printer size={13} /> Print Full Sheet
                  </button>
                )}
              </div>
            )}
          </div>
          {renderTable()}
        </div>
      )}
    </div>
  );
};

export default Reports;
