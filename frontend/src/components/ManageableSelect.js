import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from './Modal';

const ManageableSelect = ({ settingKey, value, onChange, label, required = false, defaultOptions = [] }) => {
    // Always guarantee options is an array
    const safeDefault = Array.isArray(defaultOptions) ? defaultOptions : [];
    const [options, setOptions] = useState(safeDefault);
    const [manageModal, setManageModal] = useState(false);
    const [newOption, setNewOption] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await api.get(`/settings/${settingKey}`);
                if (res.data.success) {
                    // Guard: only set if the response is actually an array
                    const data = res.data.data;
                    setOptions(Array.isArray(data) ? data : safeDefault);
                }
            } catch (err) {
                console.error(`Failed to fetch settings for ${settingKey}`, err);
                // Fall back to defaultOptions on network/parse error
                setOptions(safeDefault);
            }
        };
        fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingKey]);

    const handleSaveOptions = async (updatedOptions) => {
        setSaving(true);
        try {
            await api.put(`/settings/${settingKey}`, { value: updatedOptions });
            setOptions(updatedOptions);
            toast.success('Options updated');
        } catch (err) {
            toast.error('Failed to update options');
        } finally {
            setSaving(false);
        }
    };

    const handleAdd = () => {
        if (!newOption.trim()) return;
        if (options.includes(newOption.trim())) {
            toast.error('Option already exists');
            return;
        }
        const updated = [...options, newOption.trim()];
        handleSaveOptions(updated);
        setNewOption('');
    };

    const handleDelete = (optToRemove) => {
        if (!window.confirm(`Delete "${optToRemove}"?`)) return;
        const updated = options.filter(opt => opt !== optToRemove);
        handleSaveOptions(updated);
        // If the removed option is currently selected, clear the selection
        if (value === optToRemove) {
            onChange({ target: { value: updated.length > 0 ? updated[0] : '' } });
        }
    };

    return (
        <div className="flex flex-col w-full relative group">
            {label && <label className="label">{label}</label>}
            <div className="flex items-center gap-2">
                <select
                    className="select flex-1"
                    value={value}
                    onChange={onChange}
                    required={required}
                >
                    <option value="">— Select —</option>
                    {options.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setManageModal(true)}
                    className="p-2 text-slate-400 hover:text-navy-600 hover:bg-navy-50 rounded-lg transition-colors border border-transparent hover:border-navy-100"
                    title="Manage Options"
                >
                    <Settings size={18} />
                </button>
            </div>

            <Modal
                isOpen={manageModal}
                onClose={() => setManageModal(false)}
                title={`Manage ${label || 'Options'}`}
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="input flex-1"
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            placeholder="Add new option..."
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={saving}
                            className="btn-accent px-3 py-2"
                        >
                            {saving ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl max-h-60 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-400">No options found.</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {options.map((opt, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-3 hover:bg-slate-100/50 transition-colors">
                                        <span className="text-sm font-medium text-navy-800">{opt}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(opt)}
                                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ManageableSelect;
