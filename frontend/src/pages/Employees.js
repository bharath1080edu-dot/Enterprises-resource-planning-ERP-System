import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, Loader, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import ManageableSelect from '../components/ManageableSelect';

const ROLES  = ['Production Manager', 'Machine Operator', 'Welder', 'Quality Inspector', 'Accountant', 'Installation Tech', 'Supervisor', 'Helper', 'Driver', 'Other'];
const SHIFTS = ['Morning', 'Evening', 'Night', 'Flexible'];
const DEPTS  = ['Production', 'Quality', 'Finance', 'Installation', 'Administration', 'Maintenance'];

const EMPTY = { name:'', role:'Machine Operator', department:'Production', salary:'', shift:'Morning', phone:'', email:'', address:'', joining_date:'', status:'Active' };

// Helper: safely parse date from ISO or date-string → YYYY-MM-DD
const toDateInput = (val) => {
  if (!val) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // ISO string like 2023-01-14T18:30:00.000Z — take the date part directly
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState(null); // confirm delete state

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.data || []);
    } catch {
      toast.error('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModal(true); };

  const openEdit = (emp) => {
    setEditing(emp.id);
    setForm({
      name:         emp.name        || '',
      role:         emp.role        || '',
      department:   emp.department  || '',
      salary:       emp.salary      || '',
      shift:        emp.shift       || 'Morning',
      phone:        emp.phone       || '',
      email:        emp.email       || '',
      address:      emp.address     || '',
      joining_date: toDateInput(emp.joining_date),
      status:       emp.status      || 'Active',
    });
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY); };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) return toast.error('Employee name is required.');

    setSaving(true);
    const payload = {
      ...form,
      name:         trimmedName,
      salary:       form.salary === '' ? 0 : Number(form.salary),
      joining_date: form.joining_date || null,
    };

    try {
      if (editing) {
        await api.put(`/employees/${editing}`, payload);
        toast.success('Employee updated!');
      } else {
        await api.post('/employees', payload);
        toast.success('Employee added!');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id) => setDeleteId(id);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/employees/${deleteId}`);
      toast.success('Employee removed.');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Delete failed.');
    }
  };

  const filtered    = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.role  || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const totalSalary = employees.filter(e => e.status === 'Active').reduce((s, e) => s + Number(e.salary || 0), 0);

  const SHIFT_BADGE  = { Morning:'badge-navy', Evening:'badge-orange', Night:'badge-gray', Flexible:'badge-green' };
  const STATUS_BADGE = { Active:'badge-green', Inactive:'badge-gray', 'On Leave':'badge-yellow' };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">
            {activeCount} active · Monthly payroll: ₹{totalSalary.toLocaleString('en-IN')}
          </p>
        </div>
        <button onClick={openAdd} className="btn-accent"><Plus size={16} /> Add Employee</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-navy-800">{employees.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total Employees</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{activeCount}</p>
          <p className="text-sm text-slate-500 mt-1">Active</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-orange-500">₹{(totalSalary / 1000).toFixed(0)}k</p>
          <p className="text-sm text-slate-500 mt-1">Monthly Payroll</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9 h-9 text-xs"
          placeholder="Search by name, role or department..."
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader size={28} className="animate-spin text-navy-800" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Role</th><th>Department</th>
                <th>Salary</th><th>Shift</th><th>Phone</th><th>Joined</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    No employees found
                  </td>
                </tr>
              ) : filtered.map((emp, idx) => (
                <tr key={emp.id}>
                  <td className="text-slate-400 text-xs">{idx + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-navy-800 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {emp.name[0].toUpperCase()}
                      </div>
                      <span className="font-semibold text-navy-800">{emp.name}</span>
                    </div>
                  </td>
                  <td className="text-slate-600">{emp.role || '—'}</td>
                  <td className="text-slate-500 text-xs">{emp.department || '—'}</td>
                  <td className="font-semibold text-navy-800">₹{Number(emp.salary || 0).toLocaleString('en-IN')}</td>
                  <td><span className={SHIFT_BADGE[emp.shift] || 'badge-gray'}>{emp.shift || '—'}</span></td>
                  <td className="text-slate-500 text-xs">{emp.phone || '—'}</td>
                  <td className="text-slate-500 text-xs">
                    {emp.joining_date ? new Date(emp.joining_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td><span className={STATUS_BADGE[emp.status] || 'badge-gray'}>{emp.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-navy-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => confirmDelete(emp.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={modal} onClose={closeModal} title={editing ? 'Edit Employee' : 'Add Employee'} size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4" noValidate>

          {/* Full Name */}
          <div className="col-span-2">
            <label className="label">Full Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Employee full name"
              autoFocus
            />
          </div>

          {/* Role */}
          <ManageableSelect
            label="Role / Designation"
            settingKey="employee_roles"
            value={form.role}
            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            defaultOptions={ROLES}
          />

          {/* Department */}
          <ManageableSelect
            label="Department"
            settingKey="employee_departments"
            value={form.department}
            onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
            defaultOptions={DEPTS}
          />

          {/* Salary */}
          <div>
            <label className="label">Salary (₹/month)</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.salary}
              onChange={e => setForm(p => ({ ...p, salary: e.target.value }))}
              placeholder="20000"
            />
          </div>

          {/* Shift */}
          <ManageableSelect
            label="Shift"
            settingKey="employee_shifts"
            value={form.shift}
            onChange={e => setForm(p => ({ ...p, shift: e.target.value }))}
            defaultOptions={SHIFTS}
          />

          {/* Phone */}
          <div>
            <label className="label">Phone Number</label>
            <input
              className="input"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="98XXXXXXXX"
            />
          </div>

          {/* Email */}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </div>

          {/* Joining Date */}
          <div>
            <label className="label">Joining Date</label>
            <input
              type="date"
              className="input"
              value={form.joining_date}
              onChange={e => setForm(p => ({ ...p, joining_date: e.target.value }))}
            />
          </div>

          {/* Status — only when editing */}
          {editing && (
            <div>
              <label className="label">Status</label>
              <select
                className="select"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              >
                <option>Active</option>
                <option>Inactive</option>
                <option>On Leave</option>
              </select>
            </div>
          )}

          {/* Address */}
          <div className={editing ? 'col-span-2' : 'col-span-2'}>
            <label className="label">Address</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Residential address"
            />
          </div>

          {/* Footer Buttons */}
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={closeModal} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving
                ? <><Loader size={14} className="animate-spin" /> Saving...</>
                : editing ? 'Update Employee' : 'Add Employee'
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to remove this employee? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setDeleteId(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Employee</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Employees;
