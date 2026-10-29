import jsPDF from 'jspdf';
import 'jspdf-autotable';
import XLSX_STYLE from 'xlsx-js-style';
import toast from 'react-hot-toast';

const XLSX = XLSX_STYLE?.default || XLSX_STYLE;

const COMPANY = {
  name:    'Image Creator UPVC Products & Interiors',
  address: '9th Cross, GBH Layout, Tatanagar Main Road, Near UIDAI Office, Bangalore - 560094',
  phone:   '9945263546',
  gst:     '29ASHPJ3036A1Z4',
  email:   'imagecreatorinteriors@outlook.com',
};

// ─────────────────────────────────────────────────────────────
// Print Individual Employee Attendance Sheet
// ─────────────────────────────────────────────────────────────
export const printIndividualAttendance = (employee, records = [], fromDate, toDate, summary) => {
  const from = fromDate ? new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
  const to   = toDate   ? new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End';
  const genDate = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const empName = employee?.name || records[0]?.employee_name || 'Employee';
  const empRole = employee?.role || records[0]?.role || 'Staff';
  const empPhone = employee?.phone || records[0]?.phone || '—';
  const empDept = employee?.department || records[0]?.department || 'Production';

  const presentCount = summary?.present ?? records.filter(r => r.status === 'Present').length;
  const absentCount  = summary?.absent  ?? records.filter(r => r.status === 'Absent').length;
  const lateCount    = summary?.late    ?? records.filter(r => r.status === 'Late').length;
  const halfDayCount = summary?.halfDay ?? records.filter(r => r.status === 'Half Day').length;
  const leaveCount   = summary?.leave   ?? records.filter(r => r.status === 'Leave').length;
  const otHours      = summary?.totalOvertime ?? records.reduce((s, r) => s + (Number(r.overtime_hours) || 0), 0);
  const totalDays    = records.length;
  const attendanceRate = totalDays > 0 ? Math.round(((presentCount + lateCount + halfDayCount * 0.5) / totalDays) * 100) : 0;

  const rowsHtml = records.length > 0 ? records.map((r, i) => {
    const d = new Date(r.date);
    const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dateFormatted = isNaN(d.getTime()) ? r.date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    let statusStyle = 'color:#334155; background:#f1f5f9; border:1px solid #cbd5e1;';
    if (r.status === 'Present')   statusStyle = 'color:#166534; background:#f0fdf4; border:1px solid #bbf7d0;';
    else if (r.status === 'Absent')    statusStyle = 'color:#991b1b; background:#fef2f2; border:1px solid #fecaca;';
    else if (r.status === 'Late')      statusStyle = 'color:#854d0e; background:#fefce8; border:1px solid #fef08a;';
    else if (r.status === 'Half Day')  statusStyle = 'color:#9a3412; background:#fff7ed; border:1px solid #fed7aa;';
    else if (r.status === 'Leave')     statusStyle = 'color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe;';

    return `
      <tr>
        <td style="text-align:center;color:#64748b;font-weight:600">${i + 1}</td>
        <td><strong>${dateFormatted}</strong> <span style="color:#64748b;font-size:10px">(${dayName})</span></td>
        <td style="font-family:monospace;font-size:11px">${r.check_in || '—'}</td>
        <td style="font-family:monospace;font-size:11px">${r.check_out || '—'}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-weight:700;font-size:10px;${statusStyle}">${r.status}</span></td>
        <td style="font-weight:600;color:${Number(r.overtime_hours) > 0 ? '#1B2A4A' : '#94a3b8'}">${Number(r.overtime_hours) > 0 ? `${r.overtime_hours}h` : '—'}</td>
        <td style="color:#64748b;font-size:11px">${r.notes || '—'}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic">No attendance records found for this period</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Attendance Report — ${empName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
    .page { max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 20px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1B2A4A; }
    .brand-sub { font-size: 11px; color: #f97316; font-weight: 700; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .brand-addr { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.4; }
    .doc-badge { text-align: right; }
    .doc-title { font-size: 16px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-date { font-size: 10px; color: #64748b; margin-top: 3px; }
    .period-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 6px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    
    .emp-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 14px; }
    .emp-field-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; letter-spacing: 0.5px; }
    .emp-field-val { font-size: 13px; font-weight: 700; color: #1e293b; }

    .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
    .sum-box { border-radius: 10px; padding: 12px 6px; text-align: center; border: 1px solid transparent; }
    .sum-box.present  { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .sum-box.absent   { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .sum-box.late     { background: #fefce8; border-color: #fef08a; color: #854d0e; }
    .sum-box.halfday  { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
    .sum-box.leave    { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
    .sum-box.overtime { background: #faf5ff; border-color: #e9d5ff; color: #6b21a8; }
    .sum-val { font-size: 22px; font-weight: 800; line-height: 1.1; }
    .sum-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.3px; }

    h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1B2A4A; border-left: 4px solid #f97316; padding-left: 8px; margin-bottom: 12px; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
    thead tr { background: #1B2A4A; color: white; }
    thead th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; }

    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 45px; padding-top: 20px; }
    .sig-box { border-top: 1px dashed #94a3b8; padding-top: 8px; text-align: center; color: #64748b; font-size: 11px; }

    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print { body { padding: 12px; } @page { margin: 12mm; size: A4; } }
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
    <div class="doc-badge">
      <div class="doc-title">Individual Attendance Report</div>
      <div class="period-badge">📅 ${from} — ${to}</div>
      <div class="doc-date">Generated: ${genDate}</div>
    </div>
  </div>

  <div class="emp-card">
    <div>
      <div class="emp-field-label">Employee Name</div>
      <div class="emp-field-val" style="font-size:15px;color:#1B2A4A">${empName}</div>
    </div>
    <div>
      <div class="emp-field-label">Role / Position</div>
      <div class="emp-field-val">${empRole}</div>
    </div>
    <div>
      <div class="emp-field-label">Department</div>
      <div class="emp-field-val">${empDept}</div>
    </div>
    <div>
      <div class="emp-field-label">Contact Phone</div>
      <div class="emp-field-val">${empPhone}</div>
    </div>
  </div>

  <h3>Attendance Breakdown &amp; Statistics</h3>
  <div class="summary-grid">
    <div class="sum-box present">
      <div class="sum-val">${presentCount}</div>
      <div class="sum-lbl">✅ Present</div>
    </div>
    <div class="sum-box absent">
      <div class="sum-val">${absentCount}</div>
      <div class="sum-lbl">❌ Absent</div>
    </div>
    <div class="sum-box late">
      <div class="sum-val">${lateCount}</div>
      <div class="sum-lbl">⏰ Late</div>
    </div>
    <div class="sum-box halfday">
      <div class="sum-val">${halfDayCount}</div>
      <div class="sum-lbl">🔆 Half Day</div>
    </div>
    <div class="sum-box leave">
      <div class="sum-val">${leaveCount}</div>
      <div class="sum-lbl">🏖️ Leave / Other</div>
    </div>
    <div class="sum-box overtime">
      <div class="sum-val">${Number(otHours).toFixed(1)}h</div>
      <div class="sum-lbl">⏳ Overtime</div>
    </div>
  </div>

  <h3>Daily Attendance Log (${totalDays} Logged Days &bull; ${attendanceRate}% Attendance Rate)</h3>
  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center">#</th>
        <th>Date &amp; Day</th>
        <th>Check In</th>
        <th>Check Out</th>
        <th>Status</th>
        <th>Overtime</th>
        <th>Notes / Reason</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="sig-section">
    <div class="sig-box">
      <strong>${empName}</strong><br/>
      Employee Signature
    </div>
    <div class="sig-box">
      <strong>Authorized Signatory</strong><br/>
      Factory Manager / HR Supervisor
    </div>
  </div>

  <div class="footer">
    <span>Image Creator UPVC ERP &bull; Confidential Attendance Record</span>
    <span>Employee: ${empName} &bull; Period: ${from} — ${to}</span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=950,height=750');
  if (win) { win.document.write(html); win.document.close(); }
  else toast.error('Popup blocked. Please allow popups for this site.');
};

// ── PDF Export ───────────────────────────────────────────
export const exportToPDF = (data) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(27, 42, 74); // Navy
  doc.rect(0, 0, pageW, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(COMPANY.name, pageW / 2, 14, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text(COMPANY.address, pageW / 2, 20, { align: 'center' });
  doc.text(`📞 ${COMPANY.phone}  |  ✉ ${COMPANY.email}  |  GST: ${COMPANY.gst}`, pageW / 2, 26, { align: 'center' });

  // Title
  doc.setTextColor(245, 166, 35); // Orange
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(data.label, pageW / 2, 35, { align: 'center' });

  // Date range
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(
    `Period: ${new Date(data.from).toLocaleDateString('en-IN')} — ${new Date(data.to).toLocaleDateString('en-IN')}   |   Generated: ${new Date().toLocaleString('en-IN')}`,
    pageW / 2, 48, { align: 'center' }
  );

  // Special case: P&L
  if (data.type === 'profit' && data.summary) {
    doc.autoTable({
      startY: 55,
      head: [['Revenue', 'Expenses', 'Net Profit/Loss']],
      body: [[
        `₹${Number(data.summary.revenue).toLocaleString('en-IN')}`,
        `₹${Number(data.summary.expenses).toLocaleString('en-IN')}`,
        `${data.summary.profit >= 0 ? '+' : ''}₹${Number(data.summary.profit).toLocaleString('en-IN')}`,
      ]],
      headStyles: { fillColor: [27, 42, 74] },
      bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold' },
    });
    doc.save(`${data.type}_report_${Date.now()}.pdf`);
    return;
  }

  // Attendance Special Summary Box in PDF
  let startY = 55;
  if (data.type === 'attendance' && data.summary) {
    const s = data.summary;
    doc.autoTable({
      startY: 54,
      head: [['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Overtime (h)']],
      body: [[
        String(s.present || 0),
        String(s.absent || 0),
        String(s.late || 0),
        String(s.halfDay || 0),
        String(s.leave || 0),
        `${Number(s.totalOvertime || 0).toFixed(1)}h`,
      ]],
      headStyles: { fillColor: [27, 42, 74], halign: 'center', fontSize: 8 },
      bodyStyles: { halign: 'center', fontSize: 11, fontStyle: 'bold' },
      theme: 'grid',
    });
    startY = doc.lastAutoTable.finalY + 8;
  }

  // Table columns
  const COLS = {
    sales:      [['#','Customer','Type','Amount','Method','Date']],
    inventory:  [['#','Material','Category','Qty','Unit','Cost','Total Value','Status']],
    attendance: [['#','Employee','Role','Date','Check In','Check Out','Status','OT (h)']],
    production: [['#','Order#','Customer','Product','Current Stage','Progress']],
  };

  const ROWS = {
    sales:      (r,i) => [i+1, r.customer_name||'—', r.payment_type, `₹${Number(r.amount).toLocaleString('en-IN')}`, r.payment_method, new Date(r.payment_date).toLocaleDateString('en-IN')],
    inventory:  (r,i) => [i+1, r.material_name, r.category, r.quantity, r.unit, `₹${Number(r.cost).toLocaleString('en-IN')}`, `₹${(Number(r.quantity)*Number(r.cost)).toLocaleString('en-IN')}`, r.is_low_stock?'Low Stock':'In Stock'],
    attendance: (r,i) => [i+1, r.employee_name, r.role || '—', new Date(r.date).toLocaleDateString('en-IN'), r.check_in||'—', r.check_out||'—', r.status, (Number(r.overtime_hours) > 0 ? `${r.overtime_hours}h` : '—')],
    production: (r,i) => [i+1, '#'+r.order_id, r.customer_name, r.product_type, r.current_stage, r.completion+'%'],
  };

  const colCount = (COLS[data.type] && COLS[data.type][0]?.length) || 1;
  const footRow = Array(colCount).fill('');
  if (colCount >= 2) {
    footRow[colCount - 2] = 'Total Records:';
    footRow[colCount - 1] = String(data.rows.length);
  } else {
    footRow[0] = `Total Records: ${data.rows.length}`;
  }

  doc.autoTable({
    startY,
    head: COLS[data.type] || [['Data']],
    body: data.rows.map((r,i) => ROWS[data.type]?.(r,i) || [JSON.stringify(r)]),
    headStyles: { fillColor: [27, 42, 74] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8 },
    foot: [footRow],
    footStyles: { fillColor: [245, 166, 35], textColor: [255,255,255], fontStyle: 'bold' },
  });

  doc.save(`${data.type}_report_${Date.now()}.pdf`);
};

// ─────────────────────────────────────────────────────────────
// Corporate Excel Styling & Color Palette (Minimal & Elegant)
// ─────────────────────────────────────────────────────────────

export const EXCEL_PALETTE = {
  navyDark:     '1B2A4A', // Deep corporate navy for primary titles
  navyHeader:   '1B365D', // Slate navy for table headers
  navyLight:    'EFF6FF', // Soft ice blue for totals / accents
  slateHeader:  '334155', // Slate header
  slateDark:    '1E293B', // Charcoal text for high contrast readability
  slateMuted:   '64748B', // Secondary text
  slateLight:   'F8FAFC', // Subtle 2% zebra striping row
  white:        'FFFFFF', // Pure white
  borderGray:   'CBD5E1', // Hairline border
  borderLight:  'E2E8F0', // Very light cell border
  // Refined subtle KPI / Badge tints:
  greenText:    '166534',
  greenBg:      'F0FDF4', // Soft mint / emerald tint
  redText:      '991B1B',
  redBg:        'FEF2F2', // Soft rose tint
  amberText:    '92400E',
  amberBg:      'FFFBEB', // Soft amber tint
  orangeText:   '9A3412',
  orangeBg:     'FFF7ED', // Soft orange tint
  blueText:     '1E40AF',
  blueBg:       'EFF6FF', // Soft blue tint
  purpleText:   '6B21A8',
  purpleBg:     'FAF5FF', // Soft purple tint
};

const BORDER_THIN = {
  top:    { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
  bottom: { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
  left:   { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
  right:  { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
};

const BORDER_TOTAL = {
  top:    { style: 'thin', color: { rgb: EXCEL_PALETTE.borderGray } },
  bottom: { style: 'double', color: { rgb: EXCEL_PALETTE.navyDark } },
  left:   { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
  right:  { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } },
};

export const EXCEL_STYLES = {
  companyTitle: {
    fill: { fgColor: { rgb: EXCEL_PALETTE.navyDark } },
    font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: EXCEL_PALETTE.white } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  companySubtitle: {
    fill: { fgColor: { rgb: EXCEL_PALETTE.navyHeader } },
    font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  companyDetails: {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { name: 'Segoe UI', sz: 9, color: { rgb: '475569' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: EXCEL_PALETTE.borderLight } }
    }
  },
  docTitle: {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: 'Segoe UI', sz: 12, bold: true, color: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top:    { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
      left:   { style: 'thin', color: { rgb: 'CBD5E1' } },
      right:  { style: 'thin', color: { rgb: 'CBD5E1' } },
    }
  },
  metadata: {
    fill: { fgColor: { rgb: EXCEL_PALETTE.white } },
    font: { name: 'Segoe UI', sz: 9, color: { rgb: EXCEL_PALETTE.slateMuted } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: EXCEL_PALETTE.borderGray } }
    }
  },
  sectionBanner: {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: EXCEL_PALETTE.navyDark } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: BORDER_THIN,
  },
  kpiLabel: {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '334155' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_THIN,
  },
  kpiValue: (bgColor, textColor) => ({
    fill: { fgColor: { rgb: bgColor || EXCEL_PALETTE.white } },
    font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: textColor || EXCEL_PALETTE.navyDark } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_THIN,
  }),
  tableHeader: {
    fill: { fgColor: { rgb: EXCEL_PALETTE.navyHeader } },
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: EXCEL_PALETTE.white } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'medium', color: { rgb: EXCEL_PALETTE.navyDark } },
      bottom: { style: 'medium', color: { rgb: '0F172A' } },
      left:   { style: 'thin', color: { rgb: '334E68' } },
      right:  { style: 'thin', color: { rgb: '334E68' } },
    }
  },
  dataRowEven: (align = 'left') => ({
    fill: { fgColor: { rgb: EXCEL_PALETTE.white } },
    font: { name: 'Segoe UI', sz: 10, color: { rgb: EXCEL_PALETTE.slateDark } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
  }),
  dataRowOdd: (align = 'left') => ({
    fill: { fgColor: { rgb: EXCEL_PALETTE.slateLight } },
    font: { name: 'Segoe UI', sz: 10, color: { rgb: EXCEL_PALETTE.slateDark } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
  }),
  totalRow: (align = 'right') => ({
    fill: { fgColor: { rgb: EXCEL_PALETTE.navyLight } },
    font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_TOTAL,
  }),
  frameCutCell: (align = 'center') => ({
    fill: { fgColor: { rgb: 'EFF6FF' } }, // Soft ice blue
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '1E40AF' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
  }),
  glassCutCell: (align = 'center') => ({
    fill: { fgColor: { rgb: 'F0FDF4' } }, // Soft mint
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '166534' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
  }),
  badgeCell: (bgRgb, textRgb, align = 'center') => ({
    fill: { fgColor: { rgb: bgRgb } },
    font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: textRgb } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
  }),
  disclaimer: {
    fill: { fgColor: { rgb: EXCEL_PALETTE.slateLight } },
    font: { name: 'Segoe UI', sz: 8, italic: true, color: { rgb: '94A3B8' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
};

/**
 * Auto-fits worksheet columns dynamically based on cell content.
 * Skips horizontally merged rows so wide titles don't over-expand Column A.
 */
export const autoFitWorksheetColumns = (ws, startRow = 0, customMinWidths = {}) => {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const merges = ws['!merges'] || [];

  const horizontallyMergedCells = new Set();
  merges.forEach(m => {
    if (m.e.c > m.s.c) {
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          horizontallyMergedCells.add(`${r}:${c}`);
        }
      }
    }
  });

  const colWidths = [];

  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 0;
    for (let R = startRow; R <= range.e.r; ++R) {
      if (horizontallyMergedCells.has(`${R}:${C}`)) {
        continue; // Skip wide banners/disclaimers
      }
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== null) {
        let strVal = String(cell.v);
        if (strVal.includes('\n')) {
          const lines = strVal.split('\n');
          strVal = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
        }
        if (strVal.length > maxLen) {
          maxLen = strVal.length;
        }
      }
    }
    const minW = customMinWidths[C] || 12;
    const finalWidth = Math.min(Math.max(maxLen + 4, minW), 48);
    colWidths.push({ wch: finalWidth });
  }

  ws['!cols'] = colWidths;
};

/**
 * Creates standardized official company header rows and merge coordinates.
 */
export const createCompanyHeaderRows = (colCount, documentTitle, metadataText) => {
  const safeCols = Math.max(colCount, 6);
  const padRow = (firstVal) => {
    const row = [firstVal];
    for (let i = 1; i < safeCols; i++) row.push('');
    return row;
  };

  const rows = [
    padRow(COMPANY.name.toUpperCase()),
    padRow('Premium UPVC Windows, Doors, Architectural Glazing & Interior Solutions'),
    padRow(COMPANY.address),
    padRow(`Phone: +91 ${COMPANY.phone}   |   Email: ${COMPANY.email}   |   GSTIN: ${COMPANY.gst}`),
    padRow(''),
    padRow(`DOCUMENT: ${documentTitle.toUpperCase()}`),
    padRow(metadataText || `Generated on: ${new Date().toLocaleString('en-IN')}`),
    padRow(''),
  ];

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: safeCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: safeCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: safeCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: safeCols - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: safeCols - 1 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: safeCols - 1 } },
  ];

  const rowHeights = [
    { hpt: 26 }, // Company Name
    { hpt: 18 }, // Tagline
    { hpt: 18 }, // Address
    { hpt: 18 }, // Phone/Email/GST
    { hpt: 10 }, // Spacer
    { hpt: 22 }, // Document Title
    { hpt: 18 }, // Metadata
    { hpt: 10 }, // Spacer
  ];

  return { rows, merges, rowHeights };
};

/**
 * Applies corporate header, zebra data rows, borders and footer styles to any sheet
 */
export const applyCorporateStylesToSheet = (ws, {
  colCount,
  tableHeaderRow,
  dataRowCount = 0,
  totalRowIndex,
  disclaimerRowIndex,
  alignments = []
}) => {
  if (!ws || !ws['!ref']) return;

  const ensureCell = (r, c) => {
    const a = XLSX.utils.encode_cell({ r, c });
    if (!ws[a]) ws[a] = { t: 's', v: '' };
    return ws[a];
  };

  for (let c = 0; c < colCount; c++) {
    // Top Company Banner
    ensureCell(0, c).s = EXCEL_STYLES.companyTitle;
    ensureCell(1, c).s = EXCEL_STYLES.companySubtitle;
    ensureCell(2, c).s = EXCEL_STYLES.companyDetails;
    ensureCell(3, c).s = EXCEL_STYLES.companyDetails;
    ensureCell(5, c).s = EXCEL_STYLES.docTitle;
    ensureCell(6, c).s = EXCEL_STYLES.metadata;

    // Table Header
    if (tableHeaderRow !== undefined) {
      ensureCell(tableHeaderRow, c).s = EXCEL_STYLES.tableHeader;
    }

    // Data rows with alternating zebra striping and hairline borders
    if (tableHeaderRow !== undefined && dataRowCount > 0) {
      const align = alignments[c] || (c === 0 ? 'center' : 'left');
      for (let i = 0; i < dataRowCount; i++) {
        const r = tableHeaderRow + 1 + i;
        const cell = ensureCell(r, c);
        const isOdd = i % 2 === 1;
        cell.s = isOdd ? EXCEL_STYLES.dataRowOdd(align) : EXCEL_STYLES.dataRowEven(align);
      }
    }

    // Total Row
    if (totalRowIndex !== undefined) {
      const align = alignments[c] === 'right' ? 'right' : (c <= 1 ? 'left' : 'center');
      ensureCell(totalRowIndex, c).s = EXCEL_STYLES.totalRow(align);
    }

    // Disclaimer
    if (disclaimerRowIndex !== undefined) {
      ensureCell(disclaimerRowIndex, c).s = EXCEL_STYLES.disclaimer;
    }
  }
};

/**
 * Converts numbers into Indian Currency words representation
 */
export const numberToIndianWords = (amount) => {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  };

  let str = '';
  const crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  const hundred = Math.floor(remainder / 100);
  const tens = remainder % 100;

  if (crore > 0) str += `${inWords(crore)} Crore `;
  if (lakh > 0) str += `${inWords(lakh)} Lakh `;
  if (thousand > 0) str += `${inWords(thousand)} Thousand `;
  if (hundred > 0) str += `${inWords(hundred)} Hundred `;
  if (tens > 0) str += `${inWords(tens)} `;

  return `${str.trim()} Rupees Only`;
};

// ── Excel Export: Reports ─────────────────────────────────
export const exportToExcel = (data) => {
  try {
    const wb = XLSX.utils.book_new();
    const periodStr = data.from && data.to
      ? `Period: ${new Date(data.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(data.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}   |   Generated: ${new Date().toLocaleString('en-IN')}`
      : `Generated: ${new Date().toLocaleString('en-IN')}`;

    // 1. Special Case: Profit & Loss Statement
    if (data.type === 'profit' && data.summary) {
      const summary = data.summary;
      const rev = Number(summary.revenue) || 0;
      const exp = Number(summary.expenses) || 0;
      const profit = Number(summary.profit) || (rev - exp);
      const isProfitable = profit >= 0;

      const headerMeta = createCompanyHeaderRows(5, 'PROFIT & LOSS FINANCIAL STATEMENT', periodStr);
      const rows = [
        ...headerMeta.rows,
        ['FINANCIAL SUMMARY BREAKDOWN', '', '', '', ''],
        ['Metric / Account Head', 'Amount (₹)', 'Percentage of Revenue', 'Status', 'Account Classification'],
        ['Total Revenue (Collections)', rev, '100.0%', 'Realized Inflow', 'Credit / Sales Revenue'],
        ['Total Factory & Operational Expenses', exp, `${rev > 0 ? ((exp / rev) * 100).toFixed(1) : 0}%`, 'Factory Overhead & Procurement', 'Debit / Operating Cost'],
        ['Net Factory Profit / Loss', profit, `${rev > 0 ? ((profit / rev) * 100).toFixed(1) : 0}%`, isProfitable ? 'NET PROFIT (+)' : 'NET LOSS (-)', 'Net Bottom Line'],
        [''],
        ['* This financial report reflects recorded factory collections and expenses during the specified period. Confidential.']
      ];

      const merges = [
        ...headerMeta.merges,
        { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
        { s: { r: 14, c: 0 }, e: { r: 14, c: 4 } }
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!merges'] = merges;
      ws['!rows'] = [
        ...headerMeta.rowHeights,
        { hpt: 22 }, // Summary Title
        { hpt: 26 }, // Table Header
        { hpt: 22 }, // Rev
        { hpt: 22 }, // Exp
        { hpt: 26 }, // Net
        { hpt: 12 }, // Spacer
        { hpt: 18 }, // Footer
      ];

      // Apply corporate styles to P&L
      applyCorporateStylesToSheet(ws, {
        colCount: 5,
        disclaimerRowIndex: 14
      });

      // Section Banner style (Row 8)
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 8, c });
        if (ws[addr]) ws[addr].s = EXCEL_STYLES.sectionBanner;
      }

      // Headers (Row 9)
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 9, c });
        if (ws[addr]) ws[addr].s = EXCEL_STYLES.tableHeader;
      }

      // Rev Row (Row 10)
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 10, c });
        if (ws[addr]) ws[addr].s = {
          fill: { fgColor: { rgb: 'F0FDF4' } },
          font: { name: 'Segoe UI', sz: 10, color: { rgb: EXCEL_PALETTE.slateDark } },
          alignment: { horizontal: c === 1 ? 'right' : (c === 0 ? 'left' : 'center'), vertical: 'center' },
          border: BORDER_THIN
        };
      }

      // Exp Row (Row 11)
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 11, c });
        if (ws[addr]) ws[addr].s = {
          fill: { fgColor: { rgb: 'FEF2F2' } },
          font: { name: 'Segoe UI', sz: 10, color: { rgb: EXCEL_PALETTE.slateDark } },
          alignment: { horizontal: c === 1 ? 'right' : (c === 0 ? 'left' : 'center'), vertical: 'center' },
          border: BORDER_THIN
        };
      }

      // Net Profit/Loss Row (Row 12)
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 12, c });
        if (ws[addr]) ws[addr].s = {
          fill: { fgColor: { rgb: isProfitable ? EXCEL_PALETTE.greenBg : EXCEL_PALETTE.redBg } },
          font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: isProfitable ? EXCEL_PALETTE.greenText : EXCEL_PALETTE.redText } },
          alignment: { horizontal: c === 1 ? 'right' : (c === 0 ? 'left' : 'center'), vertical: 'center' },
          border: BORDER_TOTAL
        };
      }

      autoFitWorksheetColumns(ws, 9, { 0: 32, 1: 20, 2: 22, 3: 28, 4: 28 });
      XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
      const fileName = `ImageCreator_Profit_Loss_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Excel report exported: ${fileName}`);
      return;
    }

    // 2. Standard Tabular Reports: Sales, Inventory, Attendance, Production
    const HEADERS = {
      sales:      ['#', 'Customer Name', 'Payment Type', 'Amount (₹)', 'Payment Method', 'Transaction Date'],
      inventory:  ['#', 'Material Name', 'Category', 'Stock Qty', 'Unit', 'Unit Cost (₹)', 'Total Value (₹)', 'Stock Status'],
      attendance: ['#', 'Employee Name', 'Role / Position', 'Date', 'Day', 'Check In', 'Check Out', 'Status', 'Overtime (Hrs)', 'Notes'],
      production: ['#', 'Order ID', 'Customer Name', 'Product Specification', 'Current Stage', 'Progress (%)'],
    };

    const ALIGNMENTS = {
      sales:      ['center', 'left', 'center', 'right', 'center', 'center'],
      inventory:  ['center', 'left', 'left', 'right', 'center', 'right', 'right', 'center'],
      attendance: ['center', 'left', 'left', 'center', 'center', 'center', 'center', 'center', 'right', 'left'],
      production: ['center', 'center', 'left', 'left', 'center', 'center'],
    };

    const ROWS = {
      sales: (r, i) => [
        i + 1,
        r.customer_name || '—',
        r.payment_type || '—',
        Number(r.amount) || 0,
        r.payment_method || 'Cash / Bank',
        r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
      ],
      inventory: (r, i) => [
        i + 1,
        r.material_name || '—',
        r.category || 'General',
        Number(r.quantity) || 0,
        r.unit || 'Units',
        Number(r.cost) || 0,
        Number(r.quantity || 0) * Number(r.cost || 0),
        r.is_low_stock ? 'LOW STOCK ALERT' : 'In Stock'
      ],
      attendance: (r, i) => {
        const d = new Date(r.date);
        const dayStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { weekday: 'short' });
        const dateFormatted = isNaN(d.getTime()) ? (r.date || '—') : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return [
          i + 1,
          r.employee_name || '—',
          r.role || 'Production Staff',
          dateFormatted,
          dayStr,
          r.check_in || '—',
          r.check_out || '—',
          r.status || 'Present',
          Number(r.overtime_hours) || 0,
          r.notes || ''
        ];
      },
      production: (r, i) => [
        i + 1,
        `#${r.order_id}`,
        r.customer_name || '—',
        r.product_type || 'UPVC Window/Door Frame',
        r.current_stage || 'Queue',
        `${r.completion || 0}%`
      ],
    };

    const currentHeaders = HEADERS[data.type] || ['#', 'Item Details'];
    const colCount = currentHeaders.length;
    const headerMeta = createCompanyHeaderRows(colCount, data.label || `${data.type.toUpperCase()} REPORT`, periodStr);

    let middleRows = [];
    let middleMerges = [];
    let middleHeights = [];

    // Optional Attendance KPI Summary block
    if (data.type === 'attendance' && data.summary) {
      const s = data.summary;
      const startR = headerMeta.rows.length;
      middleRows = [
        ['ATTENDANCE SUMMARY STATISTICS', ...Array(colCount - 1).fill('')],
        ['Present', 'Absent', 'Late', 'Half Day', 'Leave / Other', 'Total Overtime', ...Array(Math.max(0, colCount - 6)).fill('')],
        [
          Number(s.present) || 0,
          Number(s.absent) || 0,
          Number(s.late) || 0,
          Number(s.halfDay) || 0,
          Number(s.leave) || 0,
          `${Number(s.totalOvertime || 0).toFixed(1)} hrs`,
          ...Array(Math.max(0, colCount - 6)).fill('')
        ],
        Array(colCount).fill('')
      ];
      middleMerges = [
        { s: { r: startR, c: 0 }, e: { r: startR, c: colCount - 1 } }
      ];
      middleHeights = [{ hpt: 20 }, { hpt: 22 }, { hpt: 24 }, { hpt: 10 }];
    }

    // Optional Sales Summary stats
    if (data.type === 'sales' && Array.isArray(data.rows)) {
      const totalSales = data.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const avgSale = data.rows.length > 0 ? (totalSales / data.rows.length) : 0;
      const startR = headerMeta.rows.length;
      middleRows = [
        ['SALES EXECUTIVE SUMMARY', ...Array(colCount - 1).fill('')],
        ['Total Invoiced Orders', 'Total Sales Revenue (₹)', 'Average Order Value (₹)', 'Scope', ...Array(Math.max(0, colCount - 4)).fill('')],
        [
          data.rows.length,
          totalSales,
          Math.round(avgSale),
          'Factory Direct & Customer Orders',
          ...Array(Math.max(0, colCount - 4)).fill('')
        ],
        Array(colCount).fill('')
      ];
      middleMerges = [
        { s: { r: startR, c: 0 }, e: { r: startR, c: colCount - 1 } }
      ];
      middleHeights = [{ hpt: 20 }, { hpt: 22 }, { hpt: 24 }, { hpt: 10 }];
    }

    // Optional Inventory Valuation summary
    if (data.type === 'inventory' && Array.isArray(data.rows)) {
      const totalValuation = data.rows.reduce((sum, r) => sum + (Number(r.quantity || 0) * Number(r.cost || 0)), 0);
      const lowStockCount = data.rows.filter(r => r.is_low_stock).length;
      const startR = headerMeta.rows.length;
      middleRows = [
        ['INVENTORY VALUATION SUMMARY', ...Array(colCount - 1).fill('')],
        ['Total SKU Items', 'Total Inventory Valuation (₹)', 'Low Stock Alert Items', 'Valuation Method', ...Array(Math.max(0, colCount - 4)).fill('')],
        [
          data.rows.length,
          totalValuation,
          lowStockCount,
          'Weighted Average Cost (WAC)',
          ...Array(Math.max(0, colCount - 4)).fill('')
        ],
        Array(colCount).fill('')
      ];
      middleMerges = [
        { s: { r: startR, c: 0 }, e: { r: startR, c: colCount - 1 } }
      ];
      middleHeights = [{ hpt: 20 }, { hpt: 22 }, { hpt: 24 }, { hpt: 10 }];
    }

    const tableRows = data.rows && data.rows.length > 0
      ? data.rows.map((r, i) => (ROWS[data.type] ? ROWS[data.type](r, i) : [i + 1, JSON.stringify(r)]))
      : [Array(colCount).fill('No records available for this period')];

    // Build Totals Footer Row
    const footerRow = Array(colCount).fill('');
    footerRow[0] = 'TOTAL';
    if (data.type === 'sales') {
      const sum = data.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      footerRow[1] = `${data.rows.length} Completed Transactions`;
      footerRow[3] = sum;
    } else if (data.type === 'inventory') {
      const totalVal = data.rows.reduce((s, r) => s + (Number(r.quantity || 0) * Number(r.cost || 0)), 0);
      const totalUnits = data.rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      footerRow[1] = `${data.rows.length} Total SKUs`;
      footerRow[3] = totalUnits;
      footerRow[6] = totalVal;
    } else if (data.type === 'attendance') {
      const totalOt = data.rows.reduce((s, r) => s + (Number(r.overtime_hours) || 0), 0);
      footerRow[1] = `${data.rows.length} Attendance Entries`;
      footerRow[8] = Number(totalOt).toFixed(1);
    } else {
      footerRow[1] = `${data.rows ? data.rows.length : 0} Total Records`;
    }

    const disclaimerRow = [
      '* Confidential report generated automatically by Image Creator UPVC Factory ERP. Valid without physical signature.',
      ...Array(colCount - 1).fill('')
    ];

    const allSheetRows = [
      ...headerMeta.rows,
      ...middleRows,
      currentHeaders,
      ...tableRows,
      footerRow,
      Array(colCount).fill(''),
      disclaimerRow
    ];

    const tableHeaderIdx = headerMeta.rows.length + middleRows.length;
    const totalRowIdx = tableHeaderIdx + 1 + tableRows.length;
    const disclaimerIdx = allSheetRows.length - 1;

    const merges = [
      ...headerMeta.merges,
      ...middleMerges,
      { s: { r: disclaimerIdx, c: 0 }, e: { r: disclaimerIdx, c: colCount - 1 } }
    ];

    const ws = XLSX.utils.aoa_to_sheet(allSheetRows);
    ws['!merges'] = merges;
    ws['!rows'] = [
      ...headerMeta.rowHeights,
      ...middleHeights,
      { hpt: 26 }, // Table Header
      ...tableRows.map(() => ({ hpt: 20 })),
      { hpt: 24 }, // Footer
      { hpt: 10 }, // Spacer
      { hpt: 18 }, // Disclaimer
    ];

    // Apply corporate styles to the worksheet
    applyCorporateStylesToSheet(ws, {
      colCount,
      tableHeaderRow: tableHeaderIdx,
      dataRowCount: tableRows.length,
      totalRowIndex: totalRowIdx,
      disclaimerRowIndex: disclaimerIdx,
      alignments: ALIGNMENTS[data.type] || []
    });

    // Style the middle KPI block if present
    if (middleRows.length > 0) {
      const startR = headerMeta.rows.length;
      for (let c = 0; c < colCount; c++) {
        const cAddr = (r) => XLSX.utils.encode_cell({ r, c });
        if (ws[cAddr(startR)]) ws[cAddr(startR)].s = EXCEL_STYLES.sectionBanner;
        if (ws[cAddr(startR + 1)]) ws[cAddr(startR + 1)].s = EXCEL_STYLES.kpiLabel;
        if (ws[cAddr(startR + 2)]) {
          // Minimal corporate color coding for KPI values
          let valBg = EXCEL_PALETTE.navyLight;
          let valText = EXCEL_PALETTE.navyDark;
          if (data.type === 'attendance') {
            if (c === 0) { valBg = EXCEL_PALETTE.greenBg; valText = EXCEL_PALETTE.greenText; }
            else if (c === 1) { valBg = EXCEL_PALETTE.redBg; valText = EXCEL_PALETTE.redText; }
            else if (c === 2) { valBg = EXCEL_PALETTE.amberBg; valText = EXCEL_PALETTE.amberText; }
            else if (c === 3) { valBg = EXCEL_PALETTE.orangeBg; valText = EXCEL_PALETTE.orangeText; }
            else if (c === 4) { valBg = EXCEL_PALETTE.blueBg; valText = EXCEL_PALETTE.blueText; }
            else if (c === 5) { valBg = EXCEL_PALETTE.purpleBg; valText = EXCEL_PALETTE.purpleText; }
          } else if (data.type === 'sales') {
            if (c === 1) { valBg = EXCEL_PALETTE.greenBg; valText = EXCEL_PALETTE.greenText; }
            else if (c === 2) { valBg = EXCEL_PALETTE.blueBg; valText = EXCEL_PALETTE.blueText; }
            else { valBg = 'F8FAFC'; valText = EXCEL_PALETTE.navyDark; }
          } else if (data.type === 'inventory') {
            if (c === 1) { valBg = EXCEL_PALETTE.greenBg; valText = EXCEL_PALETTE.greenText; }
            else if (c === 2) {
              const lowCount = Array.isArray(data.rows) ? data.rows.filter(r => r.is_low_stock).length : 0;
              valBg = lowCount > 0 ? EXCEL_PALETTE.redBg : EXCEL_PALETTE.greenBg;
              valText = lowCount > 0 ? EXCEL_PALETTE.redText : EXCEL_PALETTE.greenText;
            } else { valBg = 'F8FAFC'; valText = EXCEL_PALETTE.navyDark; }
          }
          ws[cAddr(startR + 2)].s = EXCEL_STYLES.kpiValue(valBg, valText);
        }
      }
    }

    // Specific cell styling: Low Stock alerts in Inventory
    if (data.type === 'inventory' && data.rows) {
      data.rows.forEach((r, idx) => {
        const rowNum = tableHeaderIdx + 1 + idx;
        const statusAddr = XLSX.utils.encode_cell({ r: rowNum, c: 7 });
        if (ws[statusAddr]) {
          if (r.is_low_stock) {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.redBg, EXCEL_PALETTE.redText, 'center');
          } else {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.greenBg, EXCEL_PALETTE.greenText, 'center');
          }
        }
      });
    }

    // Specific cell styling: Status column in Attendance
    if (data.type === 'attendance' && Array.isArray(data.rows)) {
      data.rows.forEach((r, idx) => {
        const rowNum = tableHeaderIdx + 1 + idx;
        const statusAddr = XLSX.utils.encode_cell({ r: rowNum, c: 7 });
        if (ws[statusAddr]) {
          const st = String(r.status || '').toLowerCase();
          if (st.includes('present')) {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.greenBg, EXCEL_PALETTE.greenText, 'center');
          } else if (st.includes('absent')) {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.redBg, EXCEL_PALETTE.redText, 'center');
          } else if (st.includes('late')) {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.amberBg, EXCEL_PALETTE.amberText, 'center');
          } else if (st.includes('half')) {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.orangeBg, EXCEL_PALETTE.orangeText, 'center');
          } else {
            ws[statusAddr].s = EXCEL_STYLES.badgeCell(EXCEL_PALETTE.blueBg, EXCEL_PALETTE.blueText, 'center');
          }
        }
      });
    }

    // Auto fit columns starting from table header row
    autoFitWorksheetColumns(ws, tableHeaderIdx, {
      0: 6,
      1: 24,
      2: 20,
      3: 18,
      4: 16,
      5: 18,
      6: 20,
      7: 18,
    });

    const sheetName = (data.label || data.type).slice(0, 31).replace(/[:\\/?*[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `ImageCreator_${data.type}_report_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Excel report exported: ${fileName}`);
  } catch (err) {
    console.error('Failed to export Excel report:', err);
    toast.error('Failed to export Excel report');
  }
};

// ── Excel Export: Quotation Estimate ──────────────────────
export const exportQuotationToExcel = ({
  items = [],
  summary = {},
  quotationInfo = {}
}) => {
  try {
    const wb = XLSX.utils.book_new();
    const quoNo = quotationInfo.quotationNo || `QUO-${Date.now().toString().slice(-6)}`;
    const quoDate = quotationInfo.date
      ? new Date(quotationInfo.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const validUntil = quotationInfo.validUntil
      ? new Date(quotationInfo.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const colCount = 10;
    const headerMeta = createCompanyHeaderRows(
      colCount,
      'OFFICIAL PRICE QUOTATION & ESTIMATE',
      `Quotation Ref: #${quoNo}   |   Issuance Date: ${quoDate}   |   Valid Until: ${validUntil}`
    );

    const customerRows = [
      ['CUSTOMER / CLIENT DETAILS', '', '', '', '', 'PROJECT / SITE DETAILS', '', '', '', ''],
      [
        'Client Name:',
        quotationInfo.customerName || 'Valued Customer',
        '',
        '',
        '',
        'Project Name / Site:',
        quotationInfo.siteAddress || 'Bangalore Site Project',
        '',
        '',
        ''
      ],
      [
        'Contact Phone:',
        quotationInfo.phone || '—',
        '',
        '',
        '',
        'Payment Terms:',
        '50% Advance with Order Confirmation, 50% Before Dispatch',
        '',
        '',
        ''
      ],
      ['Email Address:', quotationInfo.email || '—', '', '', '', 'Delivery Timeline:', '7 to 10 Working Days from final measurement', '', '', ''],
      Array(colCount).fill('')
    ];

    const customerMerges = [
      { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
      { s: { r: 8, c: 5 }, e: { r: 8, c: 9 } },
      { s: { r: 9, c: 1 }, e: { r: 9, c: 4 } },
      { s: { r: 9, c: 6 }, e: { r: 9, c: 9 } },
      { s: { r: 10, c: 1 }, e: { r: 10, c: 4 } },
      { s: { r: 10, c: 6 }, e: { r: 10, c: 9 } },
      { s: { r: 11, c: 1 }, e: { r: 11, c: 4 } },
      { s: { r: 11, c: 6 }, e: { r: 11, c: 9 } },
    ];

    const tableHeaders = [
      '#',
      'Item Description',
      'HSN/SAC',
      'Quantity',
      'Unit',
      'Rate (₹)',
      'Taxable Value (₹)',
      'GST Rate',
      'GST Amount (₹)',
      'Total Amount (₹)'
    ];

    const itemRows = items.map((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const taxable = Number(item.taxableValue) || (qty * rate);
      const tax = Number(item.taxAmount) || (taxable * 0.18);
      const total = Number(item.totalAmount) || (taxable + tax);
      return [
        idx + 1,
        item.description || 'UPVC Window / Door Element',
        item.hsnCode || '39252000',
        qty,
        item.unit || 'UNT',
        rate,
        taxable,
        '18%',
        tax,
        total
      ];
    });

    const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const taxableTotal = Number(summary.totalTaxableValue) || items.reduce((s, it) => s + (Number(it.taxableValue) || 0), 0);
    const cgstVal = Number(summary.cgst) || (taxableTotal * 0.09);
    const sgstVal = Number(summary.sgst) || (taxableTotal * 0.09);
    const roundVal = Number(summary.roundOff) || 0;
    const grandVal = Number(summary.grandTotal) || Math.round(taxableTotal + cgstVal + sgstVal);

    const subtotalRow = [
      'SUBTOTAL',
      `${items.length} Line Item(s)`,
      '',
      totalQty,
      '',
      '',
      taxableTotal,
      '',
      cgstVal + sgstVal,
      taxableTotal + cgstVal + sgstVal
    ];

    const summarySectionStartR = headerMeta.rows.length + customerRows.length + 1 + itemRows.length + 1;
    const summaryRows = [
      Array(colCount).fill(''),
      ['', '', '', '', '', '', 'Total Taxable Value:', '', '', taxableTotal],
      ['', '', '', '', '', '', 'Central GST (CGST @ 9%):', '', '', cgstVal],
      ['', '', '', '', '', '', 'State GST (SGST @ 9%):', '', '', sgstVal],
      ['', '', '', '', '', '', 'Round Off Adjustment:', '', '', roundVal],
      ['', '', '', '', '', '', 'FINAL GRAND TOTAL (₹):', '', '', grandVal],
      ['', '', '', '', '', '', 'Total Payable in Words:', '', '', numberToIndianWords(grandVal)],
      Array(colCount).fill(''),
      ['BANK PAYMENT DETAILS & NEFT / RTGS INFO', '', '', '', '', 'STANDARD TERMS & WARRANTY CONDITIONS', '', '', '', ''],
      ['Account Name:', 'Image Creator UPVC Products & Interiors', '', '', '', '1. Delivery within 7-10 working days from advance & measurement.', '', '', '', ''],
      ['Bank Name:', 'ICICI Bank Ltd', '', '', '', '2. 10 Years Warranty on UPVC profile structure & color.', '', '', '', ''],
      ['Account Number:', '025405004892', '', '', '', '3. 1 Year Warranty on hardware fittings, locks, rollers & weatherstrips.', '', '', '', ''],
      ['IFSC Code:', 'ICIC0000254', '', '', '', '4. Glass breakage or physical transit abuse not covered after site sign-off.', '', '', '', ''],
      ['Branch / City:', 'Tatanagar Branch, Bangalore', '', '', '', '5. Prices valid for 30 days from the date of quotation issuance.', '', '', '', ''],
      ['UPI / PhonePe / GPay:', '+91 9945263546 (imagecreatorinteriors@outlook.com)', '', '', '', '', '', '', '', ''],
      Array(colCount).fill(''),
      ['Authorized Signatory', '', '', '', '', 'Customer Acceptance Signature', '', '', '', ''],
      ['For Image Creator UPVC Products & Interiors', '', '', '', '', 'Authorized Sign & Company Seal', '', '', '', ''],
      Array(colCount).fill(''),
      ['* This quotation is generated electronically by Image Creator UPVC ERP. All dimensions and rates subject to final site confirmation.', ...Array(colCount - 1).fill('')]
    ];

    const termsStartR = summarySectionStartR + 8;
    const additionalMerges = [
      // Summary lines merges
      { s: { r: summarySectionStartR + 1, c: 6 }, e: { r: summarySectionStartR + 1, c: 8 } },
      { s: { r: summarySectionStartR + 2, c: 6 }, e: { r: summarySectionStartR + 2, c: 8 } },
      { s: { r: summarySectionStartR + 3, c: 6 }, e: { r: summarySectionStartR + 3, c: 8 } },
      { s: { r: summarySectionStartR + 4, c: 6 }, e: { r: summarySectionStartR + 4, c: 8 } },
      { s: { r: summarySectionStartR + 5, c: 6 }, e: { r: summarySectionStartR + 5, c: 8 } },
      { s: { r: summarySectionStartR + 6, c: 6 }, e: { r: summarySectionStartR + 6, c: 8 } },
      // Terms and Bank Details headers
      { s: { r: termsStartR, c: 0 }, e: { r: termsStartR, c: 4 } },
      { s: { r: termsStartR, c: 5 }, e: { r: termsStartR, c: 9 } },
      // Bank rows
      { s: { r: termsStartR + 1, c: 1 }, e: { r: termsStartR + 1, c: 4 } },
      { s: { r: termsStartR + 1, c: 6 }, e: { r: termsStartR + 1, c: 9 } },
      { s: { r: termsStartR + 2, c: 1 }, e: { r: termsStartR + 2, c: 4 } },
      { s: { r: termsStartR + 2, c: 6 }, e: { r: termsStartR + 2, c: 9 } },
      { s: { r: termsStartR + 3, c: 1 }, e: { r: termsStartR + 3, c: 4 } },
      { s: { r: termsStartR + 3, c: 6 }, e: { r: termsStartR + 3, c: 9 } },
      { s: { r: termsStartR + 4, c: 1 }, e: { r: termsStartR + 4, c: 4 } },
      { s: { r: termsStartR + 4, c: 6 }, e: { r: termsStartR + 4, c: 9 } },
      { s: { r: termsStartR + 5, c: 1 }, e: { r: termsStartR + 5, c: 4 } },
      { s: { r: termsStartR + 5, c: 6 }, e: { r: termsStartR + 5, c: 9 } },
      { s: { r: termsStartR + 6, c: 1 }, e: { r: termsStartR + 6, c: 4 } },
      // Signatures
      { s: { r: termsStartR + 8, c: 0 }, e: { r: termsStartR + 8, c: 4 } },
      { s: { r: termsStartR + 8, c: 5 }, e: { r: termsStartR + 8, c: 9 } },
      { s: { r: termsStartR + 9, c: 0 }, e: { r: termsStartR + 9, c: 4 } },
      { s: { r: termsStartR + 9, c: 5 }, e: { r: termsStartR + 9, c: 9 } },
    ];

    const allSheetRows = [
      ...headerMeta.rows,
      ...customerRows,
      tableHeaders,
      ...itemRows,
      subtotalRow,
      ...summaryRows
    ];

    const tableHeaderIdx = headerMeta.rows.length + customerRows.length;
    const subtotalIdx = tableHeaderIdx + 1 + itemRows.length;
    const finalDisclaimerIdx = allSheetRows.length - 1;
    additionalMerges.push({ s: { r: finalDisclaimerIdx, c: 0 }, e: { r: finalDisclaimerIdx, c: colCount - 1 } });

    const ws = XLSX.utils.aoa_to_sheet(allSheetRows);
    ws['!merges'] = [
      ...headerMeta.merges,
      ...customerMerges,
      ...additionalMerges
    ];

    ws['!rows'] = [
      ...headerMeta.rowHeights,
      { hpt: 20 }, // Customer Title
      { hpt: 20 }, // Cust 1
      { hpt: 20 }, // Cust 2
      { hpt: 20 }, // Cust 3
      { hpt: 10 }, // Spacer
      { hpt: 26 }, // Table Header
      ...itemRows.map(() => ({ hpt: 22 })),
      { hpt: 24 }, // Subtotal
      ...summaryRows.map(() => ({ hpt: 20 }))
    ];

    // Alignments for quotation table
    const quoAlignments = ['center', 'left', 'center', 'right', 'center', 'right', 'right', 'center', 'right', 'right'];

    // Apply corporate styles to top and table
    applyCorporateStylesToSheet(ws, {
      colCount,
      tableHeaderRow: tableHeaderIdx,
      dataRowCount: itemRows.length,
      totalRowIndex: subtotalIdx,
      disclaimerRowIndex: finalDisclaimerIdx,
      alignments: quoAlignments
    });

    // Style Customer Info Block (Row 8 to 11)
    for (let c = 0; c < colCount; c++) {
      const cAddr = (r) => XLSX.utils.encode_cell({ r, c });
      // Row 8: Customer & Project header
      if (ws[cAddr(8)]) ws[cAddr(8)].s = EXCEL_STYLES.sectionBanner;
      // Rows 9 to 11: Customer fields
      for (let r = 9; r <= 11; r++) {
        if (ws[cAddr(r)]) {
          const isLabel = c === 0 || c === 5;
          ws[cAddr(r)].s = {
            fill: { fgColor: { rgb: isLabel ? 'F1F5F9' : EXCEL_PALETTE.white } },
            font: { name: 'Segoe UI', sz: 9, bold: isLabel, color: { rgb: isLabel ? '334155' : EXCEL_PALETTE.slateDark } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDER_THIN
          };
        }
      }
    }

    // Style Calculation Summary block (summarySectionStartR + 1 to 6)
    for (let i = 1; i <= 6; i++) {
      const r = summarySectionStartR + i;
      const isGrandTotal = i === 5;
      for (let c = 6; c < colCount; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          if (isGrandTotal) {
            cell.s = {
              fill: { fgColor: { rgb: EXCEL_PALETTE.navyLight } },
              font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: '0F172A' } },
              alignment: { horizontal: c === 9 ? 'right' : 'left', vertical: 'center' },
              border: BORDER_TOTAL
            };
          } else {
            cell.s = {
              fill: { fgColor: { rgb: i % 2 === 1 ? 'F8FAFC' : EXCEL_PALETTE.white } },
              font: { name: 'Segoe UI', sz: 10, bold: c === 6, color: { rgb: EXCEL_PALETTE.slateDark } },
              alignment: { horizontal: c === 9 ? 'right' : 'left', vertical: 'center' },
              border: BORDER_THIN
            };
          }
        }
      }
    }

    // Style Terms & Bank details section
    for (let c = 0; c < colCount; c++) {
      const cAddr = (r) => XLSX.utils.encode_cell({ r, c });
      if (ws[cAddr(termsStartR)]) ws[cAddr(termsStartR)].s = EXCEL_STYLES.sectionBanner;
      for (let r = termsStartR + 1; r <= termsStartR + 6; r++) {
        if (ws[cAddr(r)]) {
          ws[cAddr(r)].s = {
            fill: { fgColor: { rgb: EXCEL_PALETTE.white } },
            font: { name: 'Segoe UI', sz: 9, color: { rgb: EXCEL_PALETTE.slateDark } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDER_THIN
          };
        }
      }
      // Signatures
      if (ws[cAddr(termsStartR + 8)]) {
        ws[cAddr(termsStartR + 8)].s = {
          font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: EXCEL_PALETTE.navyDark } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: { top: { style: 'thin', color: { rgb: '94A3B8' } } }
        };
      }
      if (ws[cAddr(termsStartR + 9)]) {
        ws[cAddr(termsStartR + 9)].s = {
          font: { name: 'Segoe UI', sz: 8, color: { rgb: '64748B' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    autoFitWorksheetColumns(ws, tableHeaderIdx, {
      0: 6,
      1: 34,
      2: 14,
      3: 12,
      4: 10,
      5: 16,
      6: 18,
      7: 12,
      8: 16,
      9: 20
    });

    XLSX.utils.book_append_sheet(wb, ws, `Quotation_${quoNo.slice(-8)}`);
    const fileName = `ImageCreator_Quotation_${quoNo}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Quotation spreadsheet exported: ${fileName}`);
  } catch (err) {
    console.error('Failed to export quotation Excel:', err);
    toast.error('Failed to export quotation Excel');
  }
};


