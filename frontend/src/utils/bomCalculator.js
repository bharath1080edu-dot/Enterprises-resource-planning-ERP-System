/**
 * Frontend BOM Calculator Utility — Image Creator uPVC Factory ERP
 * ─────────────────────────────────────────────────────────────
 * Calculates uPVC profiles (Outer Frame, Sash, Interlock, Mullion, Glazing Bead),
 * Glass sq.ft, Hardware fittings, and Weather Gaskets.
 * (GI Reinforcement removed per customer workflow preference).
 */

const WELD_ALLOWANCE = 5; // mm per corner

const UNIT_COSTS = {
  outerFrameProfile: 85,  // ₹/meter
  sashProfile: 78,        // ₹/meter
  mullionProfile: 72,     // ₹/meter
  interlockProfile: 68,   // ₹/meter
  glazingBeadProfile: 45, // ₹/meter
  glass5mm: 55,           // ₹/sq.ft
  glass6mm: 70,           // ₹/sq.ft
  glassDoubleUnit: 220,   // ₹/sq.ft
  woolpileGasket: 8,      // ₹/meter
  epdmGasket: 6,          // ₹/meter
  roller: 45,             // ₹/piece
  touchLock: 80,          // ₹/piece
  casementHandle: 120,    // ₹/piece
  casementHinge: 55,      // ₹/piece
  frictionStay: 90,       // ₹/piece
  screws: 0.5,            // ₹/piece
};

const round2 = (n) => Math.round(n * 100) / 100;
const ftToMm = (ft) => parseFloat(ft) * 304.8;
const mmSqToSqFt = (w, h) => (w / 304.8) * (h / 304.8);

const profileLen = (size_mm, joints = 2) =>
  round2((size_mm - (WELD_ALLOWANCE * joints)) / 1000);

export const mapToStandardType = (productType) => {
  if (!productType) return '2-Track Sliding Window';
  const str = productType.toString().toLowerCase();
  if (str.includes('2.5') || str.includes('2.5-track') || str.includes('2.5 track')) return '2.5-Track Sliding Window';
  if (str.includes('3-track') || str.includes('3 track')) return '3-Track Sliding Window';
  if (str.includes('sliding')) return '2-Track Sliding Window';
  if (str.includes('casement') || str.includes('door') || str.includes('ventilator')) return 'Casement Window';
  if (str.includes('fixed')) return 'Fixed / Picture Window';
  if (str.includes('tilt')) return 'Tilt & Turn Window';
  return '2-Track Sliding Window';
};

export const mapToStandardGlass = (glassType) => {
  if (!glassType) return '5mm Clear';
  const str = glassType.toString().toLowerCase();
  if (str.includes('dgu') || str.includes('double')) return 'Double Glazed (24mm DGU)';
  if (str.includes('6mm') || str.includes('toughened') || str.includes('frosted')) return '6mm Toughened';
  if (str.includes('tinted') || str.includes('reflective')) return '6mm Tinted';
  return '5mm Clear';
};

/**
 * Calculates raw material BOM for a single uPVC window/door unit.
 */
export const calculateItemBOM = (productType, widthFt, heightFt, qty = 1, glassType = '5mm Clear Glass', notes = '') => {
  const wFt = parseFloat(widthFt) || 0;
  const hFt = parseFloat(heightFt) || 0;
  const Q = parseInt(qty, 10) || 1;

  if (wFt <= 0 || hFt <= 0) return null;

  const W = ftToMm(wFt);
  const H = ftToMm(hFt);
  const stdType = mapToStandardType(productType);
  const stdGlass = mapToStandardGlass(glassType);

  const hasMullionSpecified =
    productType.toString().toLowerCase().includes('mullion') ||
    notes.toString().toLowerCase().includes('mullion');

  let perUnit;

  if (stdType === '2-Track Sliding Window') {
    const frameTop = profileLen(W, 2);
    const frameBottom = profileLen(W, 2);
    const frameLeft = profileLen(H, 2);
    const frameRight = profileLen(H, 2);
    const outerFrameTotal = round2(frameTop + frameBottom + frameLeft + frameRight);

    const sashWidth = W / 2;
    const sashTop = profileLen(sashWidth, 2);
    const sashBottom = profileLen(sashWidth, 2);
    const sashSide = profileLen(H, 2);
    const sashTotal = round2(2 * (sashTop + sashBottom + 2 * sashSide));

    const interlockTotal = round2(2 * (H / 1000));
    const glazingBeadTotal = sashTotal;
    const glassWidth = sashWidth - 30;
    const glassHeight = H - 30;
    const glassArea = round2(2 * mmSqToSqFt(glassWidth, glassHeight));
    const woolpile = round2(2 * (2 * (sashWidth + H) / 1000));

    const profiles = [
      { name: '2-Track Outer Frame Profile (60mm)', qty: outerFrameTotal, unit: 'm' },
      { name: '2-Track Sash Profile', qty: sashTotal, unit: 'm' },
      { name: '2-Track Interlock Profile', qty: interlockTotal, unit: 'm' },
    ];

    if (hasMullionSpecified) {
      profiles.push({ name: 'Mullion Profile', qty: round2(H / 1000), unit: 'm' });
    }

    profiles.push({ name: '2-Track Glazing Bead Profile', qty: glazingBeadTotal, unit: 'm' });

    perUnit = {
      profiles,
      glass: [{ name: 'Glass Pane', qty: glassArea, unit: 'sq.ft' }],
      gaskets: [{ name: 'Woolpile Weatherstrip', qty: woolpile, unit: 'm' }],
      hardware: [
        { name: 'Rollers / Wheels', qty: 4, unit: 'pcs' },
        { name: 'Touch Lock', qty: 2, unit: 'pcs' },
        { name: 'Self-Drilling Screws', qty: 36, unit: 'pcs' },
      ],
    };
  } else if (stdType === '2.5-Track Sliding Window') {
    const outerFrameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
    const sashWidth = W / 2;
    const sashTotal = round2(3 * (2 * (sashWidth / 1000) + 2 * (H / 1000)));
    const glassSashTotal = round2(2 * (2 * (sashWidth / 1000) + 2 * (H / 1000)));
    const interlockTotal = round2(2 * (H / 1000));
    const mullionTotal = round2(H / 1000);
    const glazingBeadTotal = glassSashTotal;

    const glassWidth = sashWidth - 30;
    const glassHeight = H - 30;
    const glassArea = round2(2 * mmSqToSqFt(glassWidth, glassHeight));
    const woolpile = round2(3 * (2 * (sashWidth + H) / 1000));

    perUnit = {
      profiles: [
        { name: '2.5-Track Outer Frame Profile', qty: outerFrameTotal, unit: 'm' },
        { name: '2.5-Track Sash Profile', qty: sashTotal, unit: 'm' },
        { name: '2.5-Track Interlock Profile', qty: interlockTotal, unit: 'm' },
        { name: 'Mullion Profile', qty: mullionTotal, unit: 'm' },
        { name: '2.5-Track Glazing Bead Profile', qty: glazingBeadTotal, unit: 'm' },
      ],
      glass: [{ name: 'Glass Pane', qty: glassArea, unit: 'sq.ft' }],
      gaskets: [{ name: 'Woolpile Weatherstrip', qty: woolpile, unit: 'm' }],
      hardware: [
        { name: 'Rollers / Wheels', qty: 6, unit: 'pcs' },
        { name: 'Touch Lock', qty: 2, unit: 'pcs' },
        { name: 'Mosquito Mesh Roller', qty: 2, unit: 'pcs' },
        { name: 'Self-Drilling Screws', qty: 44, unit: 'pcs' },
      ],
    };
  } else if (stdType === '3-Track Sliding Window') {
    const outerFrameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
    const sashWidth = W / 3;
    const sashTotal = round2(3 * (2 * (sashWidth / 1000) + 2 * (H / 1000)));
    const mullionTotal = round2(2 * (H / 1000));
    const interlockTotal = round2(3 * (H / 1000));
    const glazingBeadTotal = sashTotal;

    const glassWidth = sashWidth - 30;
    const glassHeight = H - 30;
    const glassArea = round2(3 * mmSqToSqFt(glassWidth, glassHeight));
    const woolpile = round2(3 * (2 * (sashWidth + H) / 1000));

    perUnit = {
      profiles: [
        { name: '3-Track Outer Frame Profile', qty: outerFrameTotal, unit: 'm' },
        { name: '3-Track Sash Profile', qty: sashTotal, unit: 'm' },
        { name: '3-Track Interlock Profile', qty: interlockTotal, unit: 'm' },
        { name: 'Mullion Profile', qty: mullionTotal, unit: 'm' },
        { name: '3-Track Glazing Bead Profile', qty: glazingBeadTotal, unit: 'm' },
      ],
      glass: [{ name: 'Glass Pane', qty: glassArea, unit: 'sq.ft' }],
      gaskets: [{ name: 'Woolpile Weatherstrip', qty: woolpile, unit: 'm' }],
      hardware: [
        { name: 'Rollers / Wheels', qty: 6, unit: 'pcs' },
        { name: 'Touch Lock', qty: 2, unit: 'pcs' },
        { name: 'Self-Drilling Screws', qty: 52, unit: 'pcs' },
      ],
    };
  } else if (stdType === 'Casement Window') {
    const outerFrameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
    const sashTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
    const glazingBeadTotal = sashTotal;
    const glassArea = round2(mmSqToSqFt(W - 50, H - 50));
    const epdmLen = round2(2 * ((W + H) / 1000));

    const profiles = [
      { name: 'Casement Outer Frame Profile (60mm)', qty: outerFrameTotal, unit: 'm' },
      { name: 'Casement Sash Profile', qty: sashTotal, unit: 'm' },
    ];

    if (hasMullionSpecified || W > 1200) {
      profiles.push({ name: 'Mullion Profile', qty: round2(H / 1000), unit: 'm' });
    }

    profiles.push({ name: 'Casement Glazing Bead Profile', qty: glazingBeadTotal, unit: 'm' });

    perUnit = {
      profiles,
      glass: [{ name: 'Glass Pane', qty: glassArea, unit: 'sq.ft' }],
      gaskets: [{ name: 'EPDM Rubber Seal', qty: epdmLen, unit: 'm' }],
      hardware: [
        { name: 'Casement Handle', qty: 1, unit: 'pcs' },
        { name: 'Friction Stay Arm', qty: 2, unit: 'pcs' },
        { name: 'Self-Drilling Screws', qty: 28, unit: 'pcs' },
      ],
    };
  } else {
    // Fixed / Picture Window
    const frameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
    const glazingBeadTotal = frameTotal;
    const glassArea = round2(mmSqToSqFt(W - 30, H - 30));
    const epdmLen = round2(2 * ((W + H) / 1000));

    const profiles = [
      { name: 'Fixed Outer Frame Profile (60mm)', qty: frameTotal, unit: 'm' },
    ];

    if (hasMullionSpecified) {
      profiles.push({ name: 'Mullion Profile', qty: round2(H / 1000), unit: 'm' });
    }

    profiles.push({ name: 'Fixed Glazing Bead Profile', qty: glazingBeadTotal, unit: 'm' });

    perUnit = {
      profiles,
      glass: [{ name: 'Glass Pane', qty: glassArea, unit: 'sq.ft' }],
      gaskets: [{ name: 'EPDM Rubber Seal', qty: epdmLen, unit: 'm' }],
      hardware: [
        { name: 'Self-Drilling Screws', qty: 16, unit: 'pcs' },
      ],
    };
  }

  // Cost calculation
  let cost = 0;
  perUnit.profiles.forEach(p => {
    const name = p.name.toLowerCase();
    if (name.includes('sash')) cost += p.qty * UNIT_COSTS.sashProfile;
    else if (name.includes('mullion')) cost += p.qty * UNIT_COSTS.mullionProfile;
    else if (name.includes('interlock')) cost += p.qty * UNIT_COSTS.interlockProfile;
    else if (name.includes('bead')) cost += p.qty * UNIT_COSTS.glazingBeadProfile;
    else cost += p.qty * UNIT_COSTS.outerFrameProfile;
  });

  const glassRate = stdGlass.includes('Double') ? UNIT_COSTS.glassDoubleUnit : stdGlass.includes('6mm') ? UNIT_COSTS.glass6mm : UNIT_COSTS.glass5mm;
  perUnit.glass.forEach(g => { cost += g.qty * glassRate; });
  perUnit.gaskets.forEach(g => { cost += g.qty * UNIT_COSTS.woolpileGasket; });
  perUnit.hardware.forEach(h => {
    const name = h.name.toLowerCase();
    if (name.includes('roller')) cost += h.qty * UNIT_COSTS.roller;
    else if (name.includes('touch')) cost += h.qty * UNIT_COSTS.touchLock;
    else if (name.includes('handle')) cost += h.qty * UNIT_COSTS.casementHandle;
    else if (name.includes('friction')) cost += h.qty * UNIT_COSTS.frictionStay;
    else if (name.includes('screw')) cost += h.qty * UNIT_COSTS.screws;
  });

  const costPerUnit = Math.round(cost);

  const scale = (arr) => arr.map(item => ({
    ...item,
    qtyPerUnit: item.qty,
    qtyTotal: round2(item.qty * Q),
  }));

  const total = {
    profiles: scale(perUnit.profiles),
    glass: scale(perUnit.glass),
    gaskets: scale(perUnit.gaskets),
    hardware: scale(perUnit.hardware),
  };

  const summary = {
    totalProfileMeters: round2(total.profiles.reduce((s, p) => s + p.qtyTotal, 0)),
    totalGlassSqFt: round2(total.glass.reduce((s, g) => s + g.qtyTotal, 0)),
    totalHardwarePcs: total.hardware.reduce((s, h) => s + h.qtyTotal, 0),
  };

  return {
    dimensions: { wFt, hFt, wMm: Math.round(W), hMm: Math.round(H), qty: Q },
    perUnit,
    total,
    costPerUnit,
    costTotal: costPerUnit * Q,
    summary,
  };
};

/**
 * Raw Material BOM Print.
 * Generates separate dedicated layout tables for each window track/type (2-Track, 2.5-Track, 3-Track, Casement, Fixed),
 * complete with profile names, finish/colour, track subtotals, and an overall store grand total summary.
 */
export const printOrderCutSheet = (order) => {
  let prods = [];
  try {
    const raw = order.products;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) prods = parsed;
  } catch (_) { }

  if (!prods.length) {
    alert('No products recorded for this order to generate a BOM.');
    return;
  }

  // Build BOM for every item
  const boms = prods.map((row, idx) => {
    const w = parseFloat(row['Width (ft)'] || row['width'] || 0);
    const h = parseFloat(row['Height (ft)'] || row['height'] || 0);
    const q = parseInt(row['Qty'] || row['qty'] || 1, 10);
    const type = row['Product Type'] || row['productType'] || '2-Track Sliding Window';
    const glass = row['Glass Type'] || row['glassType'] || '5mm Clear Glass';
    const notes = row['Notes'] || row['notes'] || '';
    const bom = calculateItemBOM(type, w, h, q, glass, notes);
    return { no: idx + 1, type, finish: row['Color / Finish'] || 'White', width: w, height: h, qty: q, glass, bom };
  });

  // ── Group profiles by Track/Window Type AND Finish ────────────────
  const trackGroups = {};
  let overallGrandTotalM = 0;
  let overallGrandTotalBars = 0;

  boms.forEach(b => {
    if (!b.bom) return;
    const trackName = b.type || '2-Track Sliding Window';
    if (!trackGroups[trackName]) {
      trackGroups[trackName] = { units: 0, profiles: {} };
    }
    trackGroups[trackName].units += b.qty;

    b.bom.total.profiles.forEach(p => {
      const key = `${p.name}___${b.finish}`;
      if (!trackGroups[trackName].profiles[key]) {
        trackGroups[trackName].profiles[key] = { name: p.name, finish: b.finish, m: 0 };
      }
      trackGroups[trackName].profiles[key].m = round2(trackGroups[trackName].profiles[key].m + p.qtyTotal);
    });
  });

  // ── Aggregate hardware, glass, gaskets order-wide ───────────────
  const hardwareTotals = {};
  const glassTotals = {};
  const gasketTotals = {};

  boms.forEach(b => {
    if (!b.bom) return;
    b.bom.total.hardware.forEach(h => {
      if (!hardwareTotals[h.name]) hardwareTotals[h.name] = { qty: 0, unit: h.unit };
      hardwareTotals[h.name].qty += h.qtyTotal;
    });
    b.bom.total.glass.forEach(g => {
      glassTotals[b.glass] = round2((glassTotals[b.glass] || 0) + g.qtyTotal);
    });
    b.bom.total.gaskets.forEach(g => {
      gasketTotals[g.name] = round2((gasketTotals[g.name] || 0) + g.qtyTotal);
    });
  });

  const deliveryDate = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  // ── Unified Track styling ────────────────────────────────────────
  const st = { hdrBg: '#1B2A4A', text: '#ffffff', badgeBg: '#f1f5f9', badgeText: '#1B2A4A', border: '#cbd5e1' };

  // ── Generate separate layout cards for each track ────────────────
  const trackTablesHtml = Object.entries(trackGroups).map(([trackName, data]) => {
    let trackSubtotalM = 0;
    let trackSubtotalBars = 0;

    const rowsHtml = Object.values(data.profiles).map((p) => {
      const bars = Math.ceil(p.m / 6);
      trackSubtotalM = round2(trackSubtotalM + p.m);
      trackSubtotalBars += bars;
      return `
        <tr style="background:#ffffff">
          <td style="padding-left:14px;color:#1e293b"><strong>${p.name}</strong></td>
          <td style="text-align:center;font-weight:700;color:#0369a1">${p.finish}</td>
          <td style="text-align:center;font-size:9.5px;color:#0f766e;font-weight:700">uPVC Profile</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${p.m}&nbsp;m</td>
          <td style="text-align:right;font-family:monospace;font-weight:800;color:#1d4ed8">${bars}&nbsp;BAR(S)</td>
        </tr>`;
    }).join('');

    overallGrandTotalM = round2(overallGrandTotalM + trackSubtotalM);
    overallGrandTotalBars += trackSubtotalBars;

    return `
      <div style="margin-bottom:18px;border:1.5px solid ${st.border};border-radius:6px;overflow:hidden">
        <!-- Track Header Banner -->
        <div style="background:${st.hdrBg};color:${st.text};padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11.5px;font-weight:800;letter-spacing:0.5px">▶ ${trackName.toUpperCase()} REQUISITION</span>
          <span style="font-size:10px;background:rgba(255,255,255,0.22);padding:3px 10px;border-radius:12px;font-weight:700">
            ${data.units} Window Unit${data.units !== 1 ? 's' : ''}
          </span>
        </div>
        <!-- Track Profile Table -->
        <table style="margin:0">
          <tr style="background:#f1f5f9">
            <th>uPVC Profile Type</th>
            <th style="text-align:center;width:140px">Colour / Finish</th>
            <th style="text-align:center;width:100px">Category</th>
            <th style="text-align:right;width:100px">Total Length</th>
            <th style="text-align:right;width:110px">6m Bars Needed</th>
          </tr>
          ${rowsHtml}
          <!-- Track Subtotal Row -->
          <tr style="background:${st.badgeBg};border-top:2px solid ${st.border}">
            <td colspan="3" style="font-weight:800;color:${st.badgeText};padding:7px 12px">
              SUBTOTAL — ${trackName.toUpperCase()}
            </td>
            <td style="text-align:right;font-family:monospace;font-weight:800;color:${st.badgeText}">${trackSubtotalM}&nbsp;m</td>
            <td style="text-align:right;font-family:monospace;font-weight:800;color:${st.badgeText};font-size:11px">${trackSubtotalBars}&nbsp;BAR(S)</td>
          </tr>
        </table>
      </div>`;
  }).join('');

  // ── Item manifest rows ──────────────────────────────────────────
  const itemRows = boms.map(b => `
    <tr>
      <td style="text-align:center">${b.no}</td>
      <td>${b.type}</td>
      <td>${b.finish}</td>
      <td style="text-align:center">${b.width > 0 ? b.width + ' × ' + b.height + ' ft' : '—'}</td>
      <td style="text-align:center;font-weight:700">${b.qty}</td>
    </tr>`).join('');

  const hardwareRows = Object.entries(hardwareTotals).map(([name, h]) => `
    <tr>
      <td>${name}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700">${h.qty}&nbsp;${h.unit}</td>
    </tr>`).join('');

  const glassRows = Object.entries(glassTotals).map(([spec, sqft]) => `
    <tr>
      <td>${spec}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700">${sqft}&nbsp;sq.ft</td>
    </tr>`).join('');

  const gasketRows = Object.entries(gasketTotals).map(([name, m]) => `
    <tr>
      <td>${name}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700">${m}&nbsp;m</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Material BOM — Order #${order.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }

    .hdr { display:flex; justify-content:space-between; align-items:flex-start;
           border-bottom:3px solid #1B2A4A; padding-bottom:12px; margin-bottom:16px; }
    .brand  { font-size:17px; font-weight:800; color:#1B2A4A; }
    .brand-sub { font-size:9px; color:#f97316; font-weight:700; margin-top:2px; }
    .brand-addr { font-size:9px; color:#64748b; margin-top:3px; line-height:1.5; }
    .ord-id  { font-size:22px; font-weight:800; color:#1B2A4A; text-align:right; }
    .ord-meta { font-size:10px; color:#64748b; text-align:right; margin-top:2px; }

    h3 { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;
         background:#1B2A4A; color:#fff; padding:6px 10px; margin-top:14px; margin-bottom:10px; }

    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th    { background:#f1f5f9; padding:5px 8px; text-align:left; font-size:9.5px;
            text-transform:uppercase; border-bottom:1px solid #cbd5e1; color:#475569; }
    td    { padding:5px 8px; border-bottom:1px solid #e2e8f0; background:#ffffff; }

    .grand-card { background:#1B2A4A; color:#ffffff; border-radius:6px; padding:12px 16px;
                  display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
    .grand-lbl { font-size:12px; font-weight:800; letter-spacing:0.5px; }
    .grand-val { font-family:monospace; font-size:14px; font-weight:800; color:#facc15; }

    .two { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:14px; }

    .sig { display:grid; grid-template-columns:1fr 1fr 1fr; gap:22px; margin-top:30px; }
    .sig-box { text-align:center; padding-top:34px; border-top:1px solid #cbd5e1;
               font-size:10px; color:#64748b; font-weight:600; }

    .footer { margin-top:16px; border-top:1px solid #e2e8f0; padding-top:8px;
              display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; }

    @media print { @page { margin:10mm; size:A4; } }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="hdr">
    <div>
      <div class="brand">Image Creator</div>
      <div class="brand-sub">UPVC Products &amp; Interiors</div>
      <div class="brand-addr">9th Cross, GBH Layout, Tatanagar Main Road<br>Bangalore – 560094</div>
    </div>
    <div>
      <div class="ord-id">ORDER #${order.id}</div>
      <div class="ord-meta">Customer: <strong>${order.customer_name}</strong></div>
      <div class="ord-meta">Delivery: <strong>${deliveryDate}</strong></div>
      <div class="ord-meta" style="color:#7c3aed;font-weight:700;margin-top:3px">📦 RAW MATERIAL REQUISITION (BY TRACK)</div>
    </div>
  </div>

  <!-- Items manifest -->
  <h3>Order Items Manifest</h3>
  <table style="margin-bottom:16px">
    <tr>
      <th style="width:28px;text-align:center">#</th>
      <th>Product Type</th>
      <th>Finish / Colour</th>
      <th style="text-align:center">Size (W × H)</th>
      <th style="text-align:center">Qty</th>
    </tr>
    ${itemRows}
  </table>

  <!-- uPVC Profile Requirement — Separate Layout Card Per Track -->
  <h3>uPVC Profile Requirement — By Track / Window Type</h3>
  ${trackTablesHtml}

  <!-- Grand Total Summary Card -->
  <div class="grand-card">
    <div class="grand-lbl">📦 GRAND TOTAL STORE REQUISITION (ALL TRACKS COMBINED)</div>
    <div class="grand-val">${overallGrandTotalM} m &nbsp;|&nbsp; ${overallGrandTotalBars} BARS TOTAL</div>
  </div>

  <!-- Glass + Hardware (two columns) -->
  <div class="two">
    <div>
      <h3>Glass Required</h3>
      <table>
        <tr><th>Glass Specification</th><th style="text-align:right">Area (sq.ft)</th></tr>
        ${glassRows || '<tr><td colspan="2" style="color:#94a3b8;text-align:center">—</td></tr>'}
      </table>
      ${Object.keys(gasketTotals).length > 0 ? `
        <h3 style="margin-top:12px">Gaskets &amp; Seals</h3>
        <table>
          <tr><th>Item</th><th style="text-align:right">Qty (m)</th></tr>
          ${gasketRows}
        </table>` : ''}
    </div>
    <div>
      <h3>Hardware &amp; Fittings</h3>
      <table>
        <tr><th>Hardware Item</th><th style="text-align:right">Qty</th></tr>
        ${hardwareRows}
      </table>
    </div>
  </div>

  <!-- Signature blocks -->
  <div class="sig">
    <div class="sig-box">Prepared By (ERP)</div>
    <div class="sig-box">Store Incharge — Issued</div>
    <div class="sig-box">Production Supervisor — Received</div>
  </div>

  <div class="footer">
    <span>Image Creator UPVC ERP · Order #${order.id} · Material Requisition</span>
    <span>Printed: ${new Date().toLocaleString('en-IN')}</span>
  </div>

<script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=750');
  if (win) { win.document.write(html); win.document.close(); }
  else alert('Popup blocked. Please allow popups to print the BOM.');
};
