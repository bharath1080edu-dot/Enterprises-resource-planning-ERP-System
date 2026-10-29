import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Calculator, Download, User, Building, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportQuotationToExcel } from '../utils/exportUtils';

const QuotationBuilder = () => {
  const [quotationInfo, setQuotationInfo] = useState({
    quotationNo: `QUO-${Date.now().toString().slice(-6)}`,
    customerName: '',
    phone: '',
    email: '',
    siteAddress: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [items, setItems] = useState([
    { id: 1, description: '', hsnCode: '39252000', rate: 0, quantity: 1, unit: 'UNT', taxableValue: 0, taxAmount: 0, totalAmount: 0 }
  ]);

  const [summary, setSummary] = useState({
    totalTaxableValue: 0,
    cgst: 0,
    sgst: 0,
    roundOff: 0,
    grandTotal: 0
  });

  const units = ['UNT', 'SQF', 'MTR', 'KGS', 'Ltr', 'Box'];

  const calculateRow = (item) => {
    const rate = parseFloat(item.rate) || 0;
    const qty = parseFloat(item.quantity) || 0;
    const taxableValue = rate * qty;
    // Assuming 18% GST (9% CGST + 9% SGST)
    const taxAmount = taxableValue * 0.18;
    const totalAmount = taxableValue + taxAmount;

    return {
      ...item,
      taxableValue,
      taxAmount,
      totalAmount
    };
  };

  const handleInfoChange = (field, value) => {
    setQuotationInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate if rate or quantity changes
        if (field === 'rate' || field === 'quantity') {
          return calculateRow(updatedItem);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      description: '',
      hsnCode: '39252000',
      rate: 0,
      quantity: 1,
      unit: 'UNT',
      taxableValue: 0,
      taxAmount: 0,
      totalAmount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  useEffect(() => {
    // Calculate Summary
    const totalTaxableValue = items.reduce((sum, item) => sum + (item.taxableValue || 0), 0);
    const cgst = items.reduce((sum, item) => sum + ((item.taxableValue || 0) * 0.09), 0);
    const sgst = items.reduce((sum, item) => sum + ((item.taxableValue || 0) * 0.09), 0);
    const exactTotal = totalTaxableValue + cgst + sgst;
    const grandTotal = Math.round(exactTotal);
    const roundOff = Number((grandTotal - exactTotal).toFixed(2));

    setSummary({
      totalTaxableValue,
      cgst,
      sgst,
      roundOff,
      grandTotal
    });
  }, [items]);

  const handleExportExcel = () => {
    if (!items.length) {
      toast.error('Quotation has no line items.');
      return;
    }
    exportQuotationToExcel({
      items,
      summary,
      quotationInfo,
    });
  };

  return (
    <div className="card max-w-6xl mx-auto my-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-navy-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-orange-500" />
            Quotation Builder
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create and export executive-grade quotations with corporate branding</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-navy-50 text-navy-800 px-3 py-1.5 rounded-lg border border-navy-200">
            Ref: {quotationInfo.quotationNo}
          </span>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            title="Download formatted Excel spreadsheet"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Customer & Project Metadata */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
        <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-orange-500" />
          Client &amp; Site Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Client / Customer Name</label>
            <input
              type="text"
              placeholder="e.g. Mr. Rajesh Kumar"
              className="input py-1.5 text-xs"
              value={quotationInfo.customerName}
              onChange={(e) => handleInfoChange('customerName', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              className="input py-1.5 text-xs"
              value={quotationInfo.phone}
              onChange={(e) => handleInfoChange('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Email Address</label>
            <input
              type="email"
              placeholder="e.g. client@email.com"
              className="input py-1.5 text-xs"
              value={quotationInfo.email}
              onChange={(e) => handleInfoChange('email', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Project / Site Address</label>
            <input
              type="text"
              placeholder="e.g. Villa #42, Whitefield, Bangalore"
              className="input py-1.5 text-xs"
              value={quotationInfo.siteAddress}
              onChange={(e) => handleInfoChange('siteAddress', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-container overflow-visible">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th className="w-1/3">Item Description</th>
              <th className="w-24">HSN Code</th>
              <th className="w-24">Qty</th>
              <th className="w-24">Unit</th>
              <th className="w-32">Rate (₹)</th>
              <th className="w-32">Taxable (₹)</th>
              <th className="w-24">GST (18%)</th>
              <th className="w-32">Total (₹)</th>
              <th className="w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center font-medium">{index + 1}</td>
                <td>
                  <input
                    type="text"
                    placeholder="e.g. 2.5 Track Sliding Window with Bug Mesh"
                    className="input py-1.5 text-xs"
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="HSN"
                    className="input py-1.5 text-xs font-mono"
                    value={item.hsnCode}
                    onChange={(e) => handleItemChange(item.id, 'hsnCode', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    className="input py-1.5 text-xs"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="select py-1.5 text-xs"
                    value={item.unit}
                    onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                  >
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input py-1.5 text-xs"
                    value={item.rate}
                    onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                  />
                </td>
                <td className="font-medium text-slate-700 bg-slate-50 text-right">
                  {item.taxableValue.toFixed(2)}
                </td>
                <td className="text-sm text-slate-500 text-right">
                  {item.taxAmount.toFixed(2)}
                </td>
                <td className="font-semibold text-navy-800 text-right">
                  {item.totalAmount.toFixed(2)}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={addItem} className="btn-outline btn-sm">
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="flex justify-end">
        <div className="w-84 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-navy-600" />
            <h3 className="font-semibold text-navy-800">Calculation Summary</h3>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Total Taxable Value</span>
              <span className="font-medium">₹{summary.totalTaxableValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST (9%)</span>
              <span className="font-medium">₹{summary.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGST (9%)</span>
              <span className="font-medium">₹{summary.sgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pb-3 border-b border-slate-100">
              <span>Round Off</span>
              <span className="font-medium">
                {summary.roundOff > 0 ? '+' : ''}{summary.roundOff.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-navy-800 text-base">Grand Total</span>
              <span className="font-bold text-orange-600 text-xl">
                ₹{summary.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleExportExcel}
          className="btn-outline text-xs px-4 py-2 flex items-center gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-300"
        >
          <Download className="w-4 h-4" /> Download Excel Sheet
        </button>
        <button className="btn-ghost">Save as Draft</button>
        <button className="btn-primary">Generate Quotation</button>
      </div>
    </div>
  );
};

export default QuotationBuilder;

