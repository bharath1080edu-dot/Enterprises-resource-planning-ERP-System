/**
 * UPVC Profile Cut Optimizer Utility — 1D Bin Packing & Waste Minimizer
 * Image Creator uPVC Factory ERP
 * ─────────────────────────────────────────────────────────────
 * Generates exact per-piece cut dimensions from BOM data,
 * bins them using Best-Fit Decreasing into 6-meter stock bars,
 * and returns a structured plan grouped by profile type in the
 * standard factory sequence:
 *   2-Track  →  2.5-Track  →  3-Track  →  Ventilator  →  Casement  →  Fixed
 *   Within each type:  Outer Frame  →  Sash  →  Glazing Bead  →  Interlock  →  Mullion
 */

// ── Canonical profile-type ordering ─────────────────────────────────
const TRACK_ORDER = [
  '2-Track Sliding Window',
  '2.5-Track Sliding Window',
  '3-Track Sliding Window',
  'Ventilator Window',
  'Casement Window',
  'Tilt & Turn Window',
  'Fixed / Picture Window',
];

// Within each track, profile categories are sorted in this order
const PROFILE_CATEGORY_ORDER = [
  'outer frame',
  'sash',
  'glazing bead',
  'bead',
  'interlock',
  'mullion',
];

/**
 * Classify a profile name into a category key for sorting
 */
const getProfileCategory = (profileName) => {
  const n = profileName.toLowerCase();
  if (n.includes('outer frame') || n.includes('fixed outer')) return 'outer frame';
  if (n.includes('sash')) return 'sash';
  if (n.includes('bead') || n.includes('glazing bead')) return 'glazing bead';
  if (n.includes('interlock')) return 'interlock';
  if (n.includes('mullion')) return 'mullion';
  return 'other';
};

const getCategoryOrder = (profileName) => {
  const cat = getProfileCategory(profileName);
  const idx = PROFILE_CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? 99 : idx;
};

const getTrackOrder = (trackName) => {
  const idx = TRACK_ORDER.indexOf(trackName);
  return idx === -1 ? 99 : idx;
};

const round2 = (n) => Math.round(n * 100) / 100;
const mToMm = (m) => Math.round(parseFloat(m) * 1000);

/**
 * Extract exact individual cut pieces (in mm) from BOM profiles.
 * Returns an array of { label, profileType, trackType, finish, lengthMm, pieceDesc, pieceIndex, orderNo, windowNo }
 *
 * For a 2-Track window W×H:
 *   Outer Frame Top    = W - (2 × 5mm weld allowance)  [2 horizontal]
 *   Outer Frame Side   = H - (2 × 5mm weld allowance)  [2 vertical]
 *   Sash Top/Bottom    = (W/2) - (2 × 5mm)             [4 per window, 2 sashes]
 *   Sash Side          = H - (2 × 5mm)                 [4 per window, 2 sashes]
 *   Interlock          = H (full height, no weld)       [2 pieces]
 *   Glazing Bead H     = (W/2) - 30mm                  [4 per window]
 *   Glazing Bead V     = H - 30mm                      [4 per window]
 */
const WELD = 5; // mm per weld corner
const ftToMm = (ft) => parseFloat(ft) * 304.8;

export const extractCutPieces = (orderItems) => {
  const allPieces = [];

  orderItems.forEach((item, itemIdx) => {
    const wFt = parseFloat(item['Width (ft)'] || item.width || 0);
    const hFt = parseFloat(item['Height (ft)'] || item.height || 0);
    const qty = parseInt(item['Qty'] || item.qty || 1, 10);
    const rawType = item['Product Type'] || item.productType || '';
    const finish = item['Color / Finish'] || item.finish || 'White';
    const notes = (item['Notes'] || item.notes || '').toLowerCase();

    if (wFt <= 0 || hFt <= 0) return;

    const W = Math.round(ftToMm(wFt));  // mm
    const H = Math.round(ftToMm(hFt));  // mm

    // Map to standard track type
    const typeStr = rawType.toLowerCase();
    let trackType = '2-Track Sliding Window';
    if (typeStr.includes('2.5') || typeStr.includes('2.5-track') || typeStr.includes('2.5 track')) {
      trackType = '2.5-Track Sliding Window';
    } else if (typeStr.includes('3-track') || typeStr.includes('3 track')) {
      trackType = '3-Track Sliding Window';
    } else if (typeStr.includes('ventilator') || typeStr.includes('vent')) {
      trackType = 'Ventilator Window';
    } else if (typeStr.includes('casement')) {
      trackType = 'Casement Window';
    } else if (typeStr.includes('fixed') || typeStr.includes('picture')) {
      trackType = 'Fixed / Picture Window';
    } else if (typeStr.includes('tilt') || typeStr.includes('turn')) {
      trackType = 'Tilt & Turn Window';
    } else if (typeStr.includes('sliding') || typeStr.includes('window')) {
      trackType = '2-Track Sliding Window';
    } else if (typeStr.includes('door')) {
      trackType = 'Casement Window'; // UPVC doors use casement profiles
    }

    const hasMullion = notes.includes('mullion') || rawType.toLowerCase().includes('mullion');
    const orderLabel = `Order #${item.orderId || '?'} • Item ${itemIdx + 1}`;

    // Generate cut pieces per window unit, then scale by qty
    for (let unitNum = 1; unitNum <= qty; unitNum++) {
      const windowLabel = qty > 1 ? `Win ${unitNum}/${qty}` : '';
      const baseLabel = `${orderLabel}${windowLabel ? ' • ' + windowLabel : ''}`;

      if (trackType === '2-Track Sliding Window') {
        const sashW = Math.round(W / 2);

        // Outer Frame: 2 horizontal (top & bottom) + 2 vertical (left & right)
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: '2-Track Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Horizontal (Top)', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: '2-Track Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Horizontal (Bottom)', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: '2-Track Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Vertical (Left)', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: '2-Track Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Vertical (Right)', category: 'outer frame' });

        // Sash (2 sashes): each sash = Top + Bottom (horizontal) + 2 Sides (vertical)
        for (let s = 1; s <= 2; s++) {
          allPieces.push({ label: `${baseLabel} — Sash ${s} Top`, profileType: '2-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Top`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Bottom`, profileType: '2-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Bottom`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Left`, profileType: '2-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Side L`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Right`, profileType: '2-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Side R`, category: 'sash' });
        }

        // Glazing Bead: 4H + 4V per window (matches sash perimeter)
        const beadH = sashW - 30;
        const beadV = H - 30;
        for (let s = 1; s <= 2; s++) {
          allPieces.push({ label: `${baseLabel} — Bead ${s} Top`, profileType: '2-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Top`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Bottom`, profileType: '2-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Bottom`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Left`, profileType: '2-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Side L`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Right`, profileType: '2-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Side R`, category: 'glazing bead' });
        }

        // Interlock: 2 full-height pieces (no weld)
        allPieces.push({ label: `${baseLabel} — Interlock 1`, profileType: '2-Track Interlock Profile', trackType, finish, lengthMm: H, pieceDesc: 'Interlock 1', category: 'interlock' });
        allPieces.push({ label: `${baseLabel} — Interlock 2`, profileType: '2-Track Interlock Profile', trackType, finish, lengthMm: H, pieceDesc: 'Interlock 2', category: 'interlock' });

        if (hasMullion) {
          allPieces.push({ label: `${baseLabel} — Mullion`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Center Mullion', category: 'mullion' });
        }

      } else if (trackType === '2.5-Track Sliding Window') {
        const sashW = Math.round(W / 2);

        // Outer Frame
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: '2.5-Track Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Top', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: '2.5-Track Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Bottom', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: '2.5-Track Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Left', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: '2.5-Track Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Right', category: 'outer frame' });

        // 3 sashes: 2 main + 1 fixed/mesh sash
        for (let s = 1; s <= 3; s++) {
          allPieces.push({ label: `${baseLabel} — Sash ${s} Top`, profileType: '2.5-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Top`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Bottom`, profileType: '2.5-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Bottom`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Left`, profileType: '2.5-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Left`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Right`, profileType: '2.5-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Right`, category: 'sash' });
        }

        // Bead for 2 glass sashes only
        const beadH = sashW - 30;
        const beadV = H - 30;
        for (let s = 1; s <= 2; s++) {
          allPieces.push({ label: `${baseLabel} — Bead ${s} Top`, profileType: '2.5-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Top`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Bottom`, profileType: '2.5-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Bottom`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Left`, profileType: '2.5-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Left`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Right`, profileType: '2.5-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Right`, category: 'glazing bead' });
        }

        // 2 interlocks
        allPieces.push({ label: `${baseLabel} — Interlock 1`, profileType: '2.5-Track Interlock', trackType, finish, lengthMm: H, pieceDesc: 'Interlock 1', category: 'interlock' });
        allPieces.push({ label: `${baseLabel} — Interlock 2`, profileType: '2.5-Track Interlock', trackType, finish, lengthMm: H, pieceDesc: 'Interlock 2', category: 'interlock' });

        // Center Mullion
        allPieces.push({ label: `${baseLabel} — Mullion`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Center Mullion', category: 'mullion' });

      } else if (trackType === '3-Track Sliding Window') {
        const sashW = Math.round(W / 3);

        // Outer Frame
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: '3-Track Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Top', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: '3-Track Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Bottom', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: '3-Track Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Left', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: '3-Track Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Right', category: 'outer frame' });

        // 3 sashes
        for (let s = 1; s <= 3; s++) {
          allPieces.push({ label: `${baseLabel} — Sash ${s} Top`, profileType: '3-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Top`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Bottom`, profileType: '3-Track Sash Profile', trackType, finish, lengthMm: sashW - 2 * WELD, pieceDesc: `Sash ${s} Bottom`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Left`, profileType: '3-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Left`, category: 'sash' });
          allPieces.push({ label: `${baseLabel} — Sash ${s} Right`, profileType: '3-Track Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: `Sash ${s} Right`, category: 'sash' });
        }

        // Glazing bead for all 3 sashes
        const beadH = sashW - 30;
        const beadV = H - 30;
        for (let s = 1; s <= 3; s++) {
          allPieces.push({ label: `${baseLabel} — Bead ${s} Top`, profileType: '3-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Top`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Bottom`, profileType: '3-Track Glazing Bead', trackType, finish, lengthMm: beadH, pieceDesc: `Bead ${s} Bottom`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Left`, profileType: '3-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Left`, category: 'glazing bead' });
          allPieces.push({ label: `${baseLabel} — Bead ${s} Right`, profileType: '3-Track Glazing Bead', trackType, finish, lengthMm: beadV, pieceDesc: `Bead ${s} Right`, category: 'glazing bead' });
        }

        // 3 interlocks, 2 mullions
        for (let il = 1; il <= 3; il++) {
          allPieces.push({ label: `${baseLabel} — Interlock ${il}`, profileType: '3-Track Interlock', trackType, finish, lengthMm: H, pieceDesc: `Interlock ${il}`, category: 'interlock' });
        }
        allPieces.push({ label: `${baseLabel} — Mullion 1`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Mullion 1', category: 'mullion' });
        allPieces.push({ label: `${baseLabel} — Mullion 2`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Mullion 2', category: 'mullion' });

      } else if (trackType === 'Ventilator Window') {
        // Ventilator: small fixed + top hung sash
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: 'Ventilator Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Top', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: 'Ventilator Outer Frame', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Bottom', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: 'Ventilator Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Left', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: 'Ventilator Outer Frame', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Right', category: 'outer frame' });

        allPieces.push({ label: `${baseLabel} — Sash Top`, profileType: 'Ventilator Sash Profile', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Sash Top', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Bottom`, profileType: 'Ventilator Sash Profile', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Sash Bottom', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Left`, profileType: 'Ventilator Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Sash Left', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Right`, profileType: 'Ventilator Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Sash Right', category: 'sash' });

        allPieces.push({ label: `${baseLabel} — Bead Top`, profileType: 'Ventilator Glazing Bead', trackType, finish, lengthMm: W - 30, pieceDesc: 'Bead Top', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Bottom`, profileType: 'Ventilator Glazing Bead', trackType, finish, lengthMm: W - 30, pieceDesc: 'Bead Bottom', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Left`, profileType: 'Ventilator Glazing Bead', trackType, finish, lengthMm: H - 30, pieceDesc: 'Bead Left', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Right`, profileType: 'Ventilator Glazing Bead', trackType, finish, lengthMm: H - 30, pieceDesc: 'Bead Right', category: 'glazing bead' });

      } else if (trackType === 'Casement Window') {
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: 'Casement Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Top', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: 'Casement Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Bottom', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: 'Casement Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Left', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: 'Casement Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Right', category: 'outer frame' });

        allPieces.push({ label: `${baseLabel} — Sash Top`, profileType: 'Casement Sash Profile', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Sash Top', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Bottom`, profileType: 'Casement Sash Profile', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Sash Bottom', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Left`, profileType: 'Casement Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Sash Left', category: 'sash' });
        allPieces.push({ label: `${baseLabel} — Sash Right`, profileType: 'Casement Sash Profile', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Sash Right', category: 'sash' });

        const bW = W - 50;
        const bH = H - 50;
        allPieces.push({ label: `${baseLabel} — Bead Top`, profileType: 'Casement Glazing Bead', trackType, finish, lengthMm: bW, pieceDesc: 'Bead Top', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Bottom`, profileType: 'Casement Glazing Bead', trackType, finish, lengthMm: bW, pieceDesc: 'Bead Bottom', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Left`, profileType: 'Casement Glazing Bead', trackType, finish, lengthMm: bH, pieceDesc: 'Bead Left', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Right`, profileType: 'Casement Glazing Bead', trackType, finish, lengthMm: bH, pieceDesc: 'Bead Right', category: 'glazing bead' });

        if (hasMullion || W > 1200) {
          allPieces.push({ label: `${baseLabel} — Mullion`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Mullion', category: 'mullion' });
        }

      } else {
        // Fixed / Picture Window
        allPieces.push({ label: `${baseLabel} — Outer Frame Top`, profileType: 'Fixed Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Top', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Bottom`, profileType: 'Fixed Outer Frame (60mm)', trackType, finish, lengthMm: W - 2 * WELD, pieceDesc: 'Bottom', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Left`, profileType: 'Fixed Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Left', category: 'outer frame' });
        allPieces.push({ label: `${baseLabel} — Outer Frame Right`, profileType: 'Fixed Outer Frame (60mm)', trackType, finish, lengthMm: H - 2 * WELD, pieceDesc: 'Right', category: 'outer frame' });

        const bW = W - 30;
        const bH = H - 30;
        allPieces.push({ label: `${baseLabel} — Bead Top`, profileType: 'Fixed Glazing Bead', trackType, finish, lengthMm: bW, pieceDesc: 'Bead Top', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Bottom`, profileType: 'Fixed Glazing Bead', trackType, finish, lengthMm: bW, pieceDesc: 'Bead Bottom', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Left`, profileType: 'Fixed Glazing Bead', trackType, finish, lengthMm: bH, pieceDesc: 'Bead Left', category: 'glazing bead' });
        allPieces.push({ label: `${baseLabel} — Bead Right`, profileType: 'Fixed Glazing Bead', trackType, finish, lengthMm: bH, pieceDesc: 'Bead Right', category: 'glazing bead' });

        if (hasMullion) {
          allPieces.push({ label: `${baseLabel} — Mullion`, profileType: 'Mullion Profile', trackType, finish, lengthMm: H, pieceDesc: 'Mullion', category: 'mullion' });
        }
      }
    }
  });

  return allPieces;
};

/**
 * Run 1D Bin-Packing (Best-Fit Decreasing) on a flat list of cut pieces.
 * Groups pieces by profileType + finish before binning so cuts of the same
 * profile stay on the same bars.
 *
 * @param {Array} pieces - output of extractCutPieces()
 * @param {number} stockLengthMm - typically 6000
 * @param {number} sawKerfMm - typically 4
 * @param {number} minUsableScrapMm - min off-cut to label as "reusable"
 * @returns {{ bars: Array, summary: Object }}
 */
export const optimizeCutList = (
  pieces = [],
  stockLengthMm = 6000,
  sawKerfMm = 4,
  minUsableScrapMm = 300
) => {
  if (!pieces.length) {
    return { bars: [], summary: { totalBarsNeeded: 0, totalPieces: 0, utilizationPct: 0, totalScrapMm: 0, totalSawWasteMm: 0, totalUsableOffcutMm: 0 } };
  }

  const stockLen = parseFloat(stockLengthMm) || 6000;
  const kerf = parseFloat(sawKerfMm) || 4;
  const minUsable = parseFloat(minUsableScrapMm) || 300;

  // Filter out invalid pieces
  const validPieces = pieces.filter(p => p.lengthMm > 0 && p.lengthMm <= stockLen);

  // Group by profile type + finish for optimal packing
  const groups = {};
  validPieces.forEach(p => {
    const key = `${p.profileType}|||${p.finish}`;
    if (!groups[key]) {
      groups[key] = { profileType: p.profileType, trackType: p.trackType, finish: p.finish, category: p.category || 'other', pieces: [] };
    }
    groups[key].pieces.push(p);
  });

  const allBars = [];
  let barCounter = 1;

  // Sort groups by track order → category order to get factory sequence
  const sortedGroups = Object.values(groups).sort((a, b) => {
    const trackDiff = getTrackOrder(a.trackType) - getTrackOrder(b.trackType);
    if (trackDiff !== 0) return trackDiff;
    return getCategoryOrder(a.profileType) - getCategoryOrder(b.profileType);
  });

  sortedGroups.forEach(group => {
    // Sort pieces within group by descending length (First-Fit Decreasing)
    const sorted = [...group.pieces].sort((a, b) => b.lengthMm - a.lengthMm);
    const groupBars = [];

    sorted.forEach(piece => {
      let placed = false;
      for (const bar of groupBars) {
        const spaceNeeded = piece.lengthMm + (bar.cuts.length > 0 ? kerf : 0);
        if (bar.remainingSpace >= spaceNeeded) {
          bar.sawWaste += bar.cuts.length > 0 ? kerf : 0;
          bar.cuts.push({ ...piece, kerfBefore: bar.cuts.length > 0 ? kerf : 0 });
          bar.usedLength += piece.lengthMm;
          bar.remainingSpace -= spaceNeeded;
          placed = true;
          break;
        }
      }

      if (!placed) {
        groupBars.push({
          barNumber: barCounter++,
          profileType: group.profileType,
          trackType: group.trackType,
          finish: group.finish,
          category: group.category,
          stockLength: stockLen,
          cuts: [{ ...piece, kerfBefore: 0 }],
          usedLength: piece.lengthMm,
          sawWaste: 0,
          remainingSpace: stockLen - piece.lengthMm,
        });
      }
    });

    allBars.push(...groupBars);
  });

  // Sort final bars by track → category
  allBars.sort((a, b) => {
    const trackDiff = getTrackOrder(a.trackType) - getTrackOrder(b.trackType);
    if (trackDiff !== 0) return trackDiff;
    return getCategoryOrder(a.profileType) - getCategoryOrder(b.profileType);
  });

  // Compute per-bar metrics
  let totalSawWasteMm = 0;
  let totalScrapMm = 0;
  let totalUsableOffcutMm = 0;
  let totalUsedLength = 0;

  allBars.forEach(bar => {
    bar.scrap = bar.remainingSpace;
    bar.isUsableOffcut = bar.scrap >= minUsable;
    bar.efficiencyPct = parseFloat(((bar.usedLength / stockLen) * 100).toFixed(1));
    totalSawWasteMm += bar.sawWaste;
    totalUsedLength += bar.usedLength;
    if (bar.isUsableOffcut) totalUsableOffcutMm += bar.scrap;
    else totalScrapMm += bar.scrap;
  });

  const totalStockMm = allBars.length * stockLen;
  const utilizationPct = totalStockMm > 0
    ? parseFloat(((totalUsedLength / totalStockMm) * 100).toFixed(1))
    : 0;

  return {
    bars: allBars,
    summary: {
      totalPieces: validPieces.length,
      totalBarsNeeded: allBars.length,
      stockLengthMm: stockLen,
      sawKerfMm: kerf,
      totalUsedLength: Math.round(totalUsedLength),
      totalSawWasteMm: Math.round(totalSawWasteMm),
      totalScrapMm: Math.round(totalScrapMm),
      totalUsableOffcutMm: Math.round(totalUsableOffcutMm),
      utilizationPct,
    },
  };
};

// ── Print Cutting Sheet ───────────────────────────────────────────────
/**
 * Generates and opens a detailed, properly formatted print-ready cutting
 * instruction sheet for the shop floor cutting station.
 * Sequence: 2-Track → 2.5-Track → 3-Track → Ventilator → Casement → Fixed
 * Within each type: Outer Frame → Sash → Glazing Bead → Interlock → Mullion
 */
export const printCuttingSheet = (optimizationResult, orderInfo = {}) => {
  if (!optimizationResult?.bars?.length) {
    alert('No cutting plan to print. Please load an order or add cut pieces first.');
    return;
  }

  const { bars, summary } = optimizationResult;
  const printDate = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Group bars by track type then profile type for sectioned printing
  const sections = {};
  bars.forEach(bar => {
    const tk = bar.trackType || 'General';
    const pt = bar.profileType;
    if (!sections[tk]) sections[tk] = {};
    if (!sections[tk][pt]) sections[tk][pt] = [];
    sections[tk][pt].push(bar);
  });

  // Build HTML sections in factory order
  let sectionsHtml = '';
  TRACK_ORDER.forEach(track => {
    if (!sections[track]) return;

    sectionsHtml += `
      <div class="track-section">
        <div class="track-header">${track.toUpperCase()}</div>`;

    // Within each track, sort profile types by factory order
    const profileTypes = Object.keys(sections[track]).sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b));

    profileTypes.forEach(profileType => {
      const profileBars = sections[track][profileType];
      const totalMm = profileBars.reduce((s, b) => s + b.usedLength, 0);
      const totalBars = profileBars.length;
      const totalPieces = profileBars.reduce((s, b) => s + b.cuts.length, 0);

      sectionsHtml += `
        <div class="profile-section">
          <div class="profile-header">
            <span>✂ ${profileType}</span>
            <span class="profile-stats">${totalPieces} pieces | ${totalBars} bars | ${totalMm} mm used</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:70px;text-align:center">BAR #</th>
                <th style="width:90px;text-align:center">Finish/Color</th>
                <th>Cutting Sequence (All sizes in mm)</th>
                <th style="width:95px;text-align:right">Used (mm)</th>
                <th style="width:95px;text-align:right">Off-cut (mm)</th>
                <th style="width:80px;text-align:center">Efficiency</th>
                <th style="width:55px;text-align:center">✓ Done</th>
              </tr>
            </thead>
            <tbody>`;

      profileBars.forEach(bar => {
        const cutSeq = bar.cuts.map((c, i) =>
          `<span class="cut-chip">${i + 1}. <strong>${c.lengthMm}</strong> <em>(${c.pieceDesc || c.label?.split('—').pop()?.trim() || 'Cut'})</em></span>`
        ).join(' <span class="kerf-arrow">▶</span> ');

        const offcutClass = bar.isUsableOffcut ? 'offcut-reusable' : 'offcut-scrap';
        const offcutLabel = bar.isUsableOffcut ? `${bar.scrap} ↩ Reusable` : `${bar.scrap} ✗ Scrap`;

        sectionsHtml += `
              <tr>
                <td class="bar-num">BAR #${bar.barNumber}</td>
                <td style="text-align:center;font-weight:bold;color:#1B2A4A">${bar.finish}</td>
                <td class="cut-seq">${cutSeq}</td>
                <td style="text-align:right;font-family:monospace;font-weight:bold">${bar.usedLength}</td>
                <td class="${offcutClass}">${offcutLabel}</td>
                <td style="text-align:center;font-weight:bold;color:${bar.efficiencyPct >= 80 ? '#15803d' : bar.efficiencyPct >= 60 ? '#b45309' : '#b91c1c'}">${bar.efficiencyPct}%</td>
                <td class="check-col"><div class="check-box"></div></td>
              </tr>`;
      });

      // Profile subtotal row
      const profileScrap = profileBars.reduce((s, b) => s + b.scrap, 0);
      const profileEff = parseFloat(((profileBars.reduce((s, b) => s + b.usedLength, 0) / (totalBars * summary.stockLengthMm)) * 100).toFixed(1));
      sectionsHtml += `
              <tr class="subtotal-row">
                <td colspan="3" style="font-weight:800;padding-left:14px">SUBTOTAL — ${profileType}</td>
                <td style="text-align:right;font-family:monospace;font-weight:800">${totalMm} mm</td>
                <td style="text-align:right;font-family:monospace;font-weight:800">${profileScrap} mm</td>
                <td style="text-align:center;font-weight:800">${profileEff}%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>`;
    });

    sectionsHtml += `</div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>UPVC Profile Cutting Instruction Sheet — ${orderInfo.title || 'Cut Plan'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10.5px; color: #1e293b; padding: 18px; background: #fff; }

    /* ── Header ── */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1B2A4A; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 17px; font-weight: 800; color: #1B2A4A; }
    .brand-sub { font-size: 9px; color: #ea580c; font-weight: 700; margin-top: 2px; letter-spacing: 0.5px; }
    .brand-addr { font-size: 9px; color: #64748b; margin-top: 3px; line-height: 1.4; }
    .doc-title { font-size: 15px; font-weight: 800; color: #1B2A4A; text-align: right; }
    .doc-meta { font-size: 9.5px; color: #64748b; text-align: right; margin-top: 3px; }

    /* ── KPI Cards ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; text-align: center; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #1B2A4A; }
    .kpi-lbl { font-size: 8.5px; color: #64748b; font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.3px; }

    /* ── Track Sections ── */
    .track-section { margin-bottom: 20px; border: 1.5px solid #1B2A4A; border-radius: 6px; overflow: hidden; }
    .track-header { background: #1B2A4A; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; padding: 7px 12px; }

    .profile-section { border-top: 1px solid #cbd5e1; }
    .profile-header { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 5px 10px; font-weight: 800; font-size: 10px; color: #1B2A4A; border-bottom: 1px solid #e2e8f0; }
    .profile-stats { font-size: 9px; font-weight: 600; color: #64748b; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    th { background: #f8fafc; padding: 5px 7px; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 700; }
    td { padding: 5px 7px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:hover td { background: #fafbfc; }

    .bar-num { text-align: center; font-weight: 800; color: #1B2A4A; background: #f0f4ff; }
    .cut-seq { line-height: 1.8; }
    .cut-chip { display: inline-block; background: #1B2A4A; color: #fff; padding: 2px 6px; border-radius: 3px; margin: 1px 1px; font-family: monospace; font-size: 9px; }
    .cut-chip em { color: #94a3b8; font-style: normal; font-size: 8px; }
    .kerf-arrow { color: #e2502a; font-size: 9px; margin: 0 2px; }

    .offcut-reusable { text-align: right; font-family: monospace; font-weight: bold; color: #15803d; }
    .offcut-scrap { text-align: right; font-family: monospace; font-weight: bold; color: #b91c1c; }
    .subtotal-row td { background: #f1f5f9; border-top: 2px solid #cbd5e1; font-weight: 800; font-size: 10px; color: #1B2A4A; }

    .check-col { text-align: center; }
    .check-box { width: 18px; height: 18px; border: 2px solid #94a3b8; border-radius: 3px; margin: 0 auto; }

    /* ── Signature ── */
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 28px; }
    .sig-box { text-align: center; padding-top: 28px; border-top: 1.5px solid #94a3b8; font-size: 9.5px; color: #64748b; font-weight: 600; }

    .footer { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }

    @media print {
      @page { margin: 10mm; size: A4 landscape; }
      .check-box { border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="brand">Image Creator</div>
      <div class="brand-sub">UPVC PRODUCTS &amp; INTERIORS</div>
      <div class="brand-addr">9th Cross, GBH Layout, Tatanagar Main Road, Bangalore – 560094</div>
    </div>
    <div>
      <div class="doc-title">SHOP FLOOR PROFILE CUTTING SHEET</div>
      <div class="doc-meta">${orderInfo.title || 'Custom Cut Plan'}</div>
      <div class="doc-meta">Printed: <strong>${printDate}</strong></div>
      <div class="doc-meta" style="color:#ea580c;font-weight:700">⚙ All dimensions in mm | Stock bar = ${summary.stockLengthMm}mm | Kerf = ${summary.sawKerfMm}mm/cut</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${summary.totalBarsNeeded}</div><div class="kpi-lbl">Stock Bars Needed (${summary.stockLengthMm}mm)</div></div>
    <div class="kpi"><div class="kpi-val">${summary.totalPieces}</div><div class="kpi-lbl">Total Cut Pieces</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#16a34a">${summary.utilizationPct}%</div><div class="kpi-lbl">Material Utilization</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#15803d">${summary.totalUsableOffcutMm} mm</div><div class="kpi-lbl">Reusable Off-cut Stock</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#b91c1c">${summary.totalScrapMm} mm</div><div class="kpi-lbl">Total Scrap Waste</div></div>
  </div>

  ${sectionsHtml}

  <div class="sig-grid">
    <div class="sig-box">Cutting Station Operator</div>
    <div class="sig-box">Production Supervisor</div>
    <div class="sig-box">Store Manager — Stock Issued</div>
  </div>

  <div class="footer">
    <span>Image Creator UPVC ERP · Profile Cutting Instruction Sheet · All dimensions in millimetres (mm)</span>
    <span>${printDate}</span>
  </div>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Popup blocked. Please allow popups to print the cutting sheet.');
  }
};
