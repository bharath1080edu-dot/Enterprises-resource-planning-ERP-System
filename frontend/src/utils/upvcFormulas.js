/**
 * uPVC Production Formula & Pivot Calculation Engine
 * Image Creator uPVC Factory ERP
 * ─────────────────────────────────────────────────────────────
 * Provides accurate factory deduction formulas, area conversions,
 * outer frame running meter calculations, pivot aggregations,
 * and smart multi-product Excel parsing & segregation.
 */

// Exact conversion constant: 1 sq.meter = 10.76391 sq.ft, or (304.8 * 304.8) = 92903.04 sq.mm per sq.ft
export const SQMM_PER_SQFT = 92903.04;

// Exact dimensional unit conversion constants
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;
export const INCHES_PER_FOOT = 12;

/**
 * Greatest common divisor for reducing fractions (e.g. 8/16 -> 1/2, 4/16 -> 1/4)
 */
export const gcd = (a, b) => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

/**
 * Parses tape fraction string into decimal number of inches.
 * Supports:
 * - "31 1/8"  -> 31.125
 * - "41 1/4"  -> 41.25
 * - "82 1/5"  -> 82.2
 * - "1.5/8"   -> 1.625 (site shorthand for 1 - 5/8")
 * - "31.1/8"  -> 31.125
 * - "31-1/8"  -> 31.125
 * - "5/8"     -> 0.625
 * - "31.5"    -> 31.5
 * - "1500"    -> 1500
 */
export const parseTapeFraction = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim().replace(/,/g, '').replace(/["'”’]/g, '');
  // Remove trailing unit words if present
  str = str.replace(/\s*(inches|inch|in|mm|ft)\b/gi, '').trim();

  if (!str) return 0;

  // Check if string contains a fraction slash "/"
  if (str.includes('/')) {
    // 1. Dot-separated mixed fraction: e.g. "1.5/8" or "31.1/8"
    const dotMixed = str.match(/^(\d+)\.(\d+)\s*\/\s*(\d+)$/);
    if (dotMixed) {
      const whole = parseFloat(dotMixed[1]);
      const num = parseFloat(dotMixed[2]);
      const den = parseFloat(dotMixed[3]);
      if (den !== 0) return whole + (num / den);
    }

    // 2. Space or hyphen separated mixed fraction: e.g. "31 1/8", "41-1/4", "1 5/8"
    const mixed = str.match(/^(\d+)[-\s]+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      const whole = parseFloat(mixed[1]);
      const num = parseFloat(mixed[2]);
      const den = parseFloat(mixed[3]);
      if (den !== 0) return whole + (num / den);
    }

    // 3. Pure fraction: e.g. "5/8" or "1/4"
    const pure = str.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (pure) {
      const num = parseFloat(pure[1]);
      const den = parseFloat(pure[2]);
      if (den !== 0) return num / den;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

/**
 * Formats a decimal inch number into standard tape measure fraction string.
 * Reduces fractions cleanly to standard 1/8" tape measure ticks:
 * (1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8).
 * Examples:
 *  31.125 -> "31 1/8"
 *  41.25  -> "41 1/4"
 *  82.5   -> "82 1/2"
 *  1.625  -> "1 5/8"
 *  0.25   -> "1/4"
 *  24     -> "24"
 */
export const formatTapeFraction = (valInches, maxDenominator = 8) => {
  if (valInches === null || valInches === undefined || valInches === '') return '';
  const num = typeof valInches === 'number' ? valInches : parseTapeFraction(valInches);
  if (isNaN(num) || num <= 0) return '0';

  let whole = Math.floor(num);
  const remainder = num - whole;

  // Round remainder to nearest 1/maxDenominator (e.g. 1/8")
  let fractionUnits = Math.round(remainder * maxDenominator);

  if (fractionUnits === maxDenominator) {
    whole += 1;
    fractionUnits = 0;
  }

  if (fractionUnits === 0) {
    return `${whole}`;
  }

  // Reduce fraction using GCD
  const divisor = gcd(fractionUnits, maxDenominator);
  const reducedNum = fractionUnits / divisor;
  const reducedDen = maxDenominator / divisor;

  if (whole === 0) {
    return `${reducedNum}/${reducedDen}`;
  }

  return `${whole} ${reducedNum}/${reducedDen}`;
};

/**
 * Safely parses numbers from formatted strings, handling commas & fractions
 */
export const parseFormattedNumber = (val) => {
  return parseTapeFraction(val);
};

/**
 * Converts mm dimension into target unit ('mm' | 'in' | 'ft')
 * When targetUnit is 'in', returns standard tape fraction (e.g. "31 1/8", "41 1/4")
 */
export const convertFromMm = (valMm, targetUnit = 'mm', decimals = null) => {
  const num = parseFormattedNumber(valMm);
  if (num <= 0) return '';
  if (targetUnit === 'in') {
    const inches = num / MM_PER_INCH;
    return formatTapeFraction(inches);
  }
  if (targetUnit === 'ft') {
    const d = decimals !== null ? decimals : 2;
    return Math.round((num / MM_PER_FOOT) * Math.pow(10, d)) / Math.pow(10, d);
  }
  const d = decimals !== null ? decimals : 1;
  return Math.round(num * Math.pow(10, d)) / Math.pow(10, d);
};

/**
 * Converts dimension from active unit ('mm' | 'in' | 'ft') back to base mm
 * Seamlessly parses tape fractions e.g. "31 1/8", "1.5/8", "41 1/4"
 */
export const convertToMm = (val, fromUnit = 'mm') => {
  if (val === null || val === undefined || val === '') return 0;
  if (fromUnit === 'in') {
    const inches = parseTapeFraction(val);
    if (inches <= 0) return 0;
    return Math.round(inches * MM_PER_INCH * 10) / 10;
  }
  if (fromUnit === 'ft') {
    const ft = parseTapeFraction(val);
    if (ft <= 0) return 0;
    return Math.round(ft * MM_PER_FOOT * 10) / 10;
  }
  const num = parseFormattedNumber(val);
  if (num <= 0) return 0;
  return Math.round(num * 10) / 10;
};

/**
 * Formats a mm dimension in the chosen unit with unit suffix
 */
export const formatDimensionWithUnit = (valMm, unit = 'mm') => {
  const num = parseFormattedNumber(valMm);
  if (num <= 0) return '—';
  if (unit === 'in') {
    return `${formatTapeFraction(num / MM_PER_INCH)} in`;
  }
  if (unit === 'ft') {
    return `${(num / MM_PER_FOOT).toFixed(2)} ft`;
  }
  return `${Math.round(num)} mm`;
};

/**
 * Calculates Area in Sq.Ft from mm dimensions
 * Formula: (Width_mm * Height_mm) / 92903.04
 */
export const calculateAreaSqFt = (widthMm, heightMm) => {
  const w = parseFormattedNumber(widthMm);
  const h = parseFormattedNumber(heightMm);
  if (w <= 0 || h <= 0) return 0;
  return Math.round((w * h / SQMM_PER_SQFT) * 100) / 100;
};

/**
 * Calculates raw high-precision Area in Sq.Ft (for excel display matching reference e.g. 24.05756582)
 */
export const calculateAreaSqFtPrecise = (widthMm, heightMm) => {
  const w = parseFormattedNumber(widthMm);
  const h = parseFormattedNumber(heightMm);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / SQMM_PER_SQFT;
};

/**
 * Calculates Outer Frame length (perimeter in running meters)
 * Formula: 2 * (Width + Height) / 1000
 */
export const calculateOuterFrameMeters = (widthMm, heightMm) => {
  const w = parseFormattedNumber(widthMm);
  const h = parseFormattedNumber(heightMm);
  if (w <= 0 || h <= 0) return 0;
  return Math.round(((2 * (w + h)) / 1000) * 100) / 100;
};

/**
 * Production Cut Deductions per Product / Category
 * Matches factory reference sheet rules:
 * - 2.5 track sliding / Heavy Panel (2.5): Cut W = (W - 176)/2, Cut H = H - 17 (Reference: W=1493 -> Cut W=658.5, H=1497 -> Cut H=1480; W=1511 -> Cut W=667.5, H=1459 -> Cut H=1442)
 * - Fixed Glass / ST Fixed Profiles / Floor/Fix Level: Cut W = W, Cut H = H
 * - 2-Track Sliding: Cut W = (W - 60)/2, Cut H = H - 10
 * - 3-Track Sliding: Cut W = (W - 80)/3, Cut H = H - 10
 * - Casement / Door / Vent: Cut W = W - 10, Cut H = H - 10
 */
export const calculateCutDimensions = (category = '', widthMm, heightMm) => {
  const w = parseFormattedNumber(widthMm);
  const h = parseFormattedNumber(heightMm);

  if (w <= 0 || h <= 0) {
    return { cutW: 0, cutH: 0, cutGlassW: 0, cutGlassH: 0 };
  }

  const cat = (category || '').toString().toLowerCase();

  let cutW = w;
  let cutH = h;
  let cutGlassW = 0;
  let cutGlassH = 0;

  if (cat.includes('2.5') || cat.includes('heavy panel') || cat.includes('2.5 track')) {
    // 2.5 Track Sliding deduction: (W - 176) / 2
    cutW = Math.round(((w - 176) / 2) * 10) / 10;
    cutH = Math.round((h - 17) * 10) / 10;
    cutGlassW = Math.max(0, Math.round((cutW - 35) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((cutH - 35) * 10) / 10);
  } else if (
    cat.includes('fixed glass') ||
    cat.includes('st fixed') ||
    cat.includes('fixed') ||
    cat.includes('floor/fix') ||
    cat.includes('(fl)')
  ) {
    // Fixed profiles: Outer cut is exact opening size (Cut W = W, Cut H = H)
    cutW = w;
    cutH = h;
    cutGlassW = Math.max(0, Math.round((w - 80) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((h - 80) * 10) / 10);
  } else if (cat.includes('3-track') || cat.includes('3 track')) {
    // 3-Track Sliding 3 sashes: (W - 80) / 3
    cutW = Math.round(((w - 80) / 3) * 10) / 10;
    cutH = Math.round((h - 15) * 10) / 10;
    cutGlassW = Math.max(0, Math.round((cutW - 30) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((cutH - 30) * 10) / 10);
  } else if (cat.includes('2-track') || cat.includes('sliding')) {
    // Standard 2-Track Sliding: (W - 60) / 2
    cutW = Math.round(((w - 60) / 2) * 10) / 10;
    cutH = Math.round((h - 15) * 10) / 10;
    cutGlassW = Math.max(0, Math.round((cutW - 30) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((cutH - 30) * 10) / 10);
  } else if (cat.includes('casement') || cat.includes('door') || cat.includes('vent')) {
    cutW = Math.round((w - 10) * 10) / 10;
    cutH = Math.round((h - 10) * 10) / 10;
    cutGlassW = Math.max(0, Math.round((w - 90) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((h - 90) * 10) / 10);
  } else {
    cutW = w;
    cutH = h;
    cutGlassW = Math.max(0, Math.round((w - 60) * 10) / 10);
    cutGlassH = Math.max(0, Math.round((h - 60) * 10) / 10);
  }

  return { cutW, cutH, cutGlassW, cutGlassH };
};

/**
 * Generates descriptive sizing classification for category summary in the chosen unit (mm, in, ft)
 * e.g. "1498 x 1485 mm (Large)", "59.0 x 58.5 in (Large)", "4.92 x 4.87 ft (Large)"
 */
export const classifyAvgSizing = (avgW, avgH, unit = 'mm') => {
  if (avgW <= 0 || avgH <= 0) return 'Missing Site Data';
  const areaSqFt = (avgW * avgH) / SQMM_PER_SQFT;
  const ratio = Math.max(avgW, avgH) / Math.min(avgW, avgH);

  let tag = 'Standard';
  if (areaSqFt >= 18) tag = 'Large';
  else if (areaSqFt <= 6) tag = 'Square/Small';
  else if (ratio >= 1.25) tag = 'Rectangular';

  let dispW, dispH;
  if (unit === 'in') {
    dispW = formatTapeFraction(avgW / MM_PER_INCH);
    dispH = formatTapeFraction(avgH / MM_PER_INCH);
  } else if (unit === 'ft') {
    dispW = (avgW / MM_PER_FOOT).toFixed(2);
    dispH = (avgH / MM_PER_FOOT).toFixed(2);
  } else {
    dispW = Math.round(avgW);
    dispH = Math.round(avgH);
  }

  return `${dispW} x ${dispH} ${unit} (${tag})`;
};

/**
 * Calculates live Category Pivot Summary matching Image 1
 */
export const calculateCategoryPivot = (items = [], unit = 'mm') => {
  const validItems = items.filter(item => {
    const w = parseFormattedNumber(item.width_mm || item['Width (mm)'] || 0);
    const h = parseFormattedNumber(item.height_mm || item['Height (mm)'] || 0);
    return w > 0 || h > 0 || (item.category && item.category.trim() !== '');
  });

  const categoryMap = {};

  validItems.forEach(item => {
    const cat = (item.category || item['Category'] || 'Pending Review').trim() || 'Pending Review';
    const w = parseFormattedNumber(item.width_mm || item['Width (mm)'] || 0);
    const h = parseFormattedNumber(item.height_mm || item['Height (mm)'] || 0);
    const area = calculateAreaSqFt(w, h);
    const outerFrames = calculateOuterFrameMeters(w, h);

    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        category: cat,
        lineItemCount: 0,
        totalAreaSqFt: 0,
        outerFramesMeters: 0,
        sumW: 0,
        sumH: 0,
        validDimCount: 0,
      };
    }

    categoryMap[cat].lineItemCount += 1;
    categoryMap[cat].totalAreaSqFt += area;
    categoryMap[cat].outerFramesMeters += outerFrames;

    if (w > 0 && h > 0) {
      categoryMap[cat].sumW += w;
      categoryMap[cat].sumH += h;
      categoryMap[cat].validDimCount += 1;
    }
  });

  // Calculate grand totals for percentage
  let grandCount = 0;
  let grandArea = 0;
  let grandOuter = 0;

  Object.values(categoryMap).forEach(c => {
    grandCount += c.lineItemCount;
    grandArea += c.totalAreaSqFt;
    grandOuter += c.outerFramesMeters;
  });

  const rows = Object.values(categoryMap).map(c => {
    const pct = grandArea > 0 ? (c.totalAreaSqFt / grandArea) * 100 : 0;
    const avgW = c.validDimCount > 0 ? c.sumW / c.validDimCount : 0;
    const avgH = c.validDimCount > 0 ? c.sumH / c.validDimCount : 0;

    return {
      category: c.category,
      lineItemCount: c.lineItemCount,
      totalAreaSqFt: Math.round(c.totalAreaSqFt * 100) / 100,
      outerFramesMeters: Math.round(c.outerFramesMeters * 100) / 100,
      percentFootprint: Math.round(pct * 10) / 10,
      avgSizingLabel: classifyAvgSizing(avgW, avgH, unit),
      avgW,
      avgH,
    };
  });

  // Sort rows descending by line count
  rows.sort((a, b) => b.lineItemCount - a.lineItemCount);

  return {
    rows,
    totalSummary: {
      category: 'Total Summary',
      lineItemCount: grandCount,
      totalAreaSqFt: Math.round(grandArea * 100) / 100,
      outerFramesMeters: Math.round(grandOuter * 100) / 100,
      percentFootprint: 100.0,
      avgSizingLabel: grandCount > 0 ? `${grandCount} Total Items` : '—',
    },
  };
};

/**
 * Standardizes any item object into clean workbook item
 */
export const normalizeWorkbookItem = (rawItem = {}, defaultCategory = 'Fixed Glass', sNo = 1) => {
  let wMm = parseFormattedNumber(rawItem.width_mm || rawItem['Width (mm)'] || rawItem.widthMm || 0);
  let hMm = parseFormattedNumber(rawItem.height_mm || rawItem['Height (mm)'] || rawItem.heightMm || 0);

  // If only feet was supplied
  if (!wMm && rawItem['Width (ft)']) {
    wMm = Math.round(parseFloat(rawItem['Width (ft)']) * 304.8);
  }
  if (!hMm && rawItem['Height (ft)']) {
    hMm = Math.round(parseFloat(rawItem['Height (ft)']) * 304.8);
  }
  // If inches was supplied
  if (!wMm && rawItem['Width (in)']) {
    wMm = Math.round(parseTapeFraction(rawItem['Width (in)']) * 25.4);
  }
  if (!hMm && rawItem['Height (in)']) {
    hMm = Math.round(parseTapeFraction(rawItem['Height (in)']) * 25.4);
  }

  const category = (rawItem.category || rawItem['Category'] || rawItem['Product Type'] || rawItem.productType || defaultCategory).trim();
  const color = rawItem.color || rawItem['Color'] || rawItem['Color / Finish'] || rawItem.colorFinish || 'White (Standard)';
  const glassType = rawItem.glassType || rawItem['Glass Type'] || rawItem.glass_type || '5mm';
  const notes = rawItem.notes || rawItem['Notes'] || '';

  const areaSqFt = calculateAreaSqFt(wMm, hMm);
  const preciseArea = calculateAreaSqFtPrecise(wMm, hMm);
  const cuts = calculateCutDimensions(category, wMm, hMm);

  const cutW = rawItem.cut_w !== undefined && rawItem.cut_w !== '' ? parseFormattedNumber(rawItem.cut_w) : cuts.cutW;
  const cutH = rawItem.cut_h !== undefined && rawItem.cut_h !== '' ? parseFormattedNumber(rawItem.cut_h) : cuts.cutH;
  const cutGlassW = rawItem.cut_glass_w !== undefined && rawItem.cut_glass_w !== '' ? parseFormattedNumber(rawItem.cut_glass_w) : cuts.cutGlassW;
  const cutGlassH = rawItem.cut_glass_h !== undefined && rawItem.cut_glass_h !== '' ? parseFormattedNumber(rawItem.cut_glass_h) : cuts.cutGlassH;

  return {
    id: rawItem.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sNo: rawItem.sNo || rawItem['S.No'] || sNo,
    width_mm: wMm || '',
    height_mm: hMm || '',
    category,
    area_sqft: areaSqFt || '',
    area_sqft_precise: preciseArea || '',
    color,
    glass_type: glassType,
    cut_w: cutW || '',
    cut_h: cutH || '',
    cut_glass_w: cutGlassW || '',
    cut_glass_h: cutGlassH || '',
    notes,
    // Backward compatibility props for cutOptimizer & PDF printer
    'Product Type': category,
    'Width (ft)': wMm > 0 ? (wMm / 304.8).toFixed(2) : '',
    'Height (ft)': hMm > 0 ? (hMm / 304.8).toFixed(2) : '',
    'Qty': '1',
    'Color / Finish': color,
    'Glass Type': glassType,
    'Sq.Ft': areaSqFt ? areaSqFt.toFixed(2) : '',
    'Notes': notes,
  };
};

export const isNumericValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return !isNaN(val);
  const cleaned = String(val).replace(/,/g, '').trim();
  if (!cleaned) return false;
  return !isNaN(Number(cleaned));
};

/**
 * Smart Parser & Auto-Segregator for Flat Excel Tables (Image Reference matching)
 * Analyzes an imported or pasted 2D matrix, discovers columns (even with dirty/repeated headers),
 * extracts all measurement lines, groups by Product Category, and creates clean items.
 */
export const smartParseAndSegregateExcel = (rawMatrix = [], defaultCategory = 'Fixed Glass', startIndex = 0) => {
  if (!Array.isArray(rawMatrix) || rawMatrix.length === 0) {
    return { items: [], detectedCategories: [], categoryCounts: {} };
  }

  // Helper to determine if a value looks like a numeric dimension
  const isDimensionLike = (val) => {
    if (!isNumericValue(val)) return false;
    const num = parseFormattedNumber(val);
    return num >= 150 && num <= 7000;
  };

  // Helper to test if a string represents an explicit header
  const isHeaderString = (val) => {
    if (!val || typeof val !== 'string') return false;
    const s = val.toLowerCase().trim();
    return s.includes('s.no') || s.includes('width') || s.includes('height') || s.includes('category') || s.includes('area');
  };

  // Scan first few rows to find where data starts
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawMatrix.length, 3); i++) {
    const row = rawMatrix[i] || [];
    const headerMatches = row.filter(c => isHeaderString(String(c))).length;
    if (headerMatches >= 2 || (row.length > 2 && row.every(c => String(c).toLowerCase().includes('s.no')))) {
      headerRowIdx = i;
      break;
    }
  }

  const dataStartIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const sampleDataRows = rawMatrix.slice(dataStartIdx, dataStartIdx + 15).filter(r => Array.isArray(r) && r.length >= 2);

  if (sampleDataRows.length === 0) {
    return { items: [], detectedCategories: [], categoryCounts: {} };
  }

  // Column inference: inspect columns across sample rows
  const maxCols = Math.max(...sampleDataRows.map(r => r.length));
  const colStats = Array.from({ length: maxCols }, () => ({
    numDimCount: 0,
    textCount: 0,
    distinctStrings: new Set(),
  }));

  sampleDataRows.forEach(row => {
    for (let c = 0; c < maxCols; c++) {
      const val = row[c];
      if (val === null || val === undefined || val === '') continue;
      if (isDimensionLike(val)) {
        colStats[c].numDimCount += 1;
      } else if (typeof val === 'string' && val.trim().length > 1 && !isNumericValue(val)) {
        colStats[c].textCount += 1;
        colStats[c].distinctStrings.add(val.trim());
      }
    }
  });

  // Identify column roles
  let wCol = -1;
  let hCol = -1;
  let catCol = -1;
  let cutWCol = -1;
  let cutHCol = -1;

  // Check if standard factory pattern: Col 0 is S.No, Col 1 is W, Col 2 is H, Col 3 is Category (like in the screenshot!)
  const col1IsDim = colStats[1]?.numDimCount >= sampleDataRows.length * 0.4;
  const col2IsDim = colStats[2]?.numDimCount >= sampleDataRows.length * 0.4;
  const col3IsText = colStats[3]?.textCount >= sampleDataRows.length * 0.4;

  if (col1IsDim && col2IsDim && col3IsText) {
    wCol = 1;
    hCol = 2;
    catCol = 3;
    if (maxCols >= 9) {
      cutWCol = 7;
      cutHCol = 8;
    }
  } else {
    // General heuristic: find first two columns with high dimension count
    for (let c = 0; c < maxCols; c++) {
      if (colStats[c].numDimCount >= sampleDataRows.length * 0.4) {
        if (wCol === -1) wCol = c;
        else if (hCol === -1) {
          hCol = c;
          break;
        }
      }
    }
    // Find category column: column with text strings that repeat
    for (let c = 0; c < maxCols; c++) {
      if (c !== wCol && c !== hCol && colStats[c].textCount > 0) {
        catCol = c;
        break;
      }
    }
  }

  // Fallback defaults
  if (wCol === -1) wCol = 0;
  if (hCol === -1) hCol = 1;

  const parsedItems = [];
  const detectedCategories = new Set();
  const categoryCounts = {};

  for (let r = dataStartIdx; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawW = row[wCol];
    const rawH = row[hCol];
    const w = parseFormattedNumber(rawW);
    const h = parseFormattedNumber(rawH);

    // Skip empty lines
    if (w <= 0 && h <= 0) continue;

    // Determine category
    let category = defaultCategory;
    if (catCol !== -1 && row[catCol] !== undefined && row[catCol] !== null) {
      const rawCat = String(row[catCol]).trim();
      if (rawCat && !isHeaderString(rawCat)) {
        category = rawCat;
      }
    }

    detectedCategories.add(category);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    // Optional manual cuts from sheet
    const cutW = cutWCol !== -1 && row[cutWCol] ? parseFormattedNumber(row[cutWCol]) : undefined;
    const cutH = cutHCol !== -1 && row[cutHCol] ? parseFormattedNumber(row[cutHCol]) : undefined;

    const item = normalizeWorkbookItem(
      {
        width_mm: w,
        height_mm: h,
        category,
        cut_w: cutW,
        cut_h: cutH,
      },
      category,
      startIndex + parsedItems.length + 1
    );

    parsedItems.push(item);
  }

  return {
    items: parsedItems,
    detectedCategories: Array.from(detectedCategories),
    categoryCounts,
  };
};

export const COMMON_CATEGORIES = [
  'Fixed Glass',
  '2.5 track sliding',
  'ST Fixed Profiles',
  'Heavy Panel (2.5)',
  'Floor/Fix Level (FL)',
  '2-Track Sliding Window',
  '3-Track Sliding Window',
  'Casement Window',
  'Ventilator Window',
  'Fixed / Picture Window',
  'Tilt & Turn Window',
  'UPVC Door',
];

export const COLOR_OPTIONS = [
  'White (Standard)',
  'Anthracite Grey',
  'Golden Oak (Woodgrain)',
  'Walnut (Woodgrain)',
  'Dark Oak (Woodgrain)',
  'Jet Black',
  'Custom Lamination',
];

export const GLASS_OPTIONS = [
  '5mm',
  '5mm Clear',
  '6mm Toughened',
  'Double Glazed (24mm DGU)',
  'Frosted / Privacy Glass',
  'Tinted Bronze / Green',
  'Reflective Glass',
  'Triple Glazed (32mm DGU)',
  'Without Glass (Profiles Only)',
];
