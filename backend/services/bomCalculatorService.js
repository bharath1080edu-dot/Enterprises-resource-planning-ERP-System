/**
 * BOM Calculator Service — Image Creator uPVC Factory ERP
 * ─────────────────────────────────────────────────────────
 * Calculates the exact Bill of Materials required to manufacture
 * a uPVC window / door based on type, dimensions, and quantity.
 *
 * All measurements in MILLIMETRES (mm) unless stated otherwise.
 * Weld allowance = 5 mm per corner (standard uPVC industry value).
 */

// ── Constants ───────────────────────────────────────────────────────
const WELD_ALLOWANCE   = 5;    // mm per joint (each 90° corner)
const MIN_SCREW_COUNT  = 8;    // base screws per unit
const CORNER_ANGLE_CUT = 45;   // degrees

// ── Unit price approximations (₹ per unit) — editable ──────────────
const UNIT_COSTS = {
  outerFrameProfile:    85,    // ₹/meter (60mm series)
  sashProfile:          78,    // ₹/meter
  mullionProfile:       72,    // ₹/meter
  interlockProfile:     68,    // ₹/meter
  giReinforcement:      42,    // ₹/meter (1.2mm GI box section)
  glass5mm:             55,    // ₹/sq.ft
  glass6mm:             70,    // ₹/sq.ft
  glassDoubleUnit:      220,   // ₹/sq.ft (24mm DGU)
  woolpileGasket:       8,     // ₹/meter
  epdmGasket:           6,     // ₹/meter
  roller:               45,    // ₹/piece
  touchLock:            80,    // ₹/piece
  casementHandle:       120,   // ₹/piece
  casementHinge:        55,    // ₹/piece
  frictionStay:         90,    // ₹/piece
  tiltTurnHandle:       350,   // ₹/piece
  multiPointLock:       650,   // ₹/piece
  screws:               0.5,   // ₹/piece (self-drilling)
};

// ── Helpers ─────────────────────────────────────────────────────────
const mToFt = (mm) => (mm / 304.8);               // mm → feet
const mmSqToSqFt = (w, h) => (w / 304.8) * (h / 304.8); // mm × mm → sq.ft
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Calculate profile length in meters for a frame member.
 * @param {number} size_mm - outer dimension in mm
 * @param {number} joints  - number of weld joints on this piece
 */
const profileLen = (size_mm, joints = 2) =>
  round2((size_mm - (WELD_ALLOWANCE * joints)) / 1000);

// ── Window Calculators ───────────────────────────────────────────────

/**
 * 2-Track Sliding Window
 * Components: Outer Frame, 2 × Sash, Interlock, GI, Glass, Rollers, Touch Locks
 */
const calcSlidingTwoTrack = (W, H) => {
  // Outer Frame: 2W + 2H (each cut at 45°, 4 weld joints)
  const frameTop    = profileLen(W, 2);
  const frameBottom = profileLen(W, 2);
  const frameLeft   = profileLen(H, 2);
  const frameRight  = profileLen(H, 2);
  const outerFrameTotal = round2((frameTop + frameBottom + frameLeft + frameRight));

  // 2 Sashes (each sash = W/2 wide, H tall, 4 joints each)
  const sashWidth  = W / 2;
  const sashTop    = profileLen(sashWidth, 2);
  const sashBottom = profileLen(sashWidth, 2);
  const sashSide   = profileLen(H, 2);
  const sashTotal  = round2(2 * (sashTop + sashBottom + (2 * sashSide)));

  // Interlock: 2 vertical interlocks (one per sash meeting edge) = H each
  const interlockTotal = round2(2 * (H / 1000));

  // GI Reinforcement: 1 piece per profile member (frame + sash)
  const giTotal = round2(outerFrameTotal + sashTotal);

  // Glass: 2 panes, each (W/2) × H with 15mm overlap deducted per side
  const glassWidth  = sashWidth - 30;
  const glassHeight = H - 30;
  const glassArea   = round2(2 * mmSqToSqFt(glassWidth, glassHeight));

  // Woolpile / Gasket: full sash perimeter × 2
  const woolpile = round2(2 * (2 * (sashWidth + H) / 1000));

  // Hardware
  const hardware = {
    rollers:    4,   // 2 per sash
    touchLocks: 2,   // 1 per sash
    screws:     40,  // self-drilling
    cornerKeys: 8,   // 2 per sash corner × 2 sashes
  };

  return {
    profiles: [
      { name: 'Outer Frame Profile (60mm)',  qty: outerFrameTotal, unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `Top: ${frameTop}m | Bottom: ${frameBottom}m | Left: ${frameLeft}m | Right: ${frameRight}m` },
      { name: 'Sash Profile',                qty: sashTotal,       unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `2 sashes × (Top: ${sashTop}m + Bottom: ${sashBottom}m + Side×2: ${(sashSide*2).toFixed(2)}m)` },
      { name: 'Interlock Profile',           qty: interlockTotal,  unit: 'meters', cutAngle: '90° / 90°',
        cutDetails: `2 vertical interlocks × ${(H/1000).toFixed(2)}m` },
    ],
    reinforcement: [
      { name: 'GI Box Reinforcement (1.2mm)', qty: giTotal, unit: 'meters',
        cutDetails: 'Inserted inside all hollow frame & sash profiles' },
    ],
    glass: [
      { name: 'Glass Pane', qty: glassArea, unit: 'sq.ft',
        cutDetails: `2 panes × ${(glassWidth).toFixed(0)}mm × ${(glassHeight).toFixed(0)}mm` },
    ],
    gaskets: [
      { name: 'Woolpile / Weatherstrip', qty: woolpile, unit: 'meters', cutDetails: 'Around sash perimeter' },
    ],
    hardware: [
      { name: 'Rollers / Wheels',          qty: hardware.rollers,    unit: 'pcs' },
      { name: 'Touch Lock (Sash Lock)',     qty: hardware.touchLocks, unit: 'pcs' },
      { name: 'Corner Keys',               qty: hardware.cornerKeys, unit: 'pcs' },
      { name: 'Self-Drilling Screws',      qty: hardware.screws,     unit: 'pcs' },
    ],
  };
};

/**
 * 3-Track Sliding Window
 */
const calcSlidingThreeTrack = (W, H) => {
  const outerFrameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
  const sashWidth       = W / 3;
  const sashTotal       = round2(3 * (2 * (sashWidth / 1000) + 2 * (H / 1000)));
  const mullionTotal    = round2(2 * (H / 1000));   // 2 internal vertical dividers
  const giTotal         = round2(outerFrameTotal + sashTotal + mullionTotal);
  const glassWidth      = sashWidth - 30;
  const glassHeight     = H - 30;
  const glassArea       = round2(3 * mmSqToSqFt(glassWidth, glassHeight));
  const woolpile        = round2(3 * (2 * (sashWidth + H) / 1000));

  return {
    profiles: [
      { name: 'Outer Frame Profile (60mm)', qty: outerFrameTotal, unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `2 × ${(W/1000).toFixed(2)}m horizontal + 2 × ${(H/1000).toFixed(2)}m vertical` },
      { name: 'Sash Profile',              qty: sashTotal,       unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `3 sashes × ${(2*(sashWidth/1000) + 2*(H/1000)).toFixed(2)}m each` },
      { name: 'Mullion / Divider Profile', qty: mullionTotal,    unit: 'meters', cutAngle: '90° / 90°',
        cutDetails: `2 internal vertical mullions × ${(H/1000).toFixed(2)}m` },
    ],
    reinforcement: [
      { name: 'GI Box Reinforcement (1.2mm)', qty: giTotal, unit: 'meters', cutDetails: 'All hollow profiles' },
    ],
    glass: [
      { name: 'Glass Pane', qty: glassArea, unit: 'sq.ft',
        cutDetails: `3 panes × ${glassWidth.toFixed(0)}mm × ${glassHeight.toFixed(0)}mm` },
    ],
    gaskets: [
      { name: 'Woolpile / Weatherstrip', qty: woolpile, unit: 'meters', cutDetails: 'Around all sash perimeters' },
    ],
    hardware: [
      { name: 'Rollers / Wheels',          qty: 6,  unit: 'pcs' },
      { name: 'Touch Lock (Sash Lock)',     qty: 2,  unit: 'pcs' },
      { name: 'Corner Keys',               qty: 12, unit: 'pcs' },
      { name: 'Self-Drilling Screws',      qty: 56, unit: 'pcs' },
    ],
  };
};

/**
 * Casement Window (opens outward, hinged on side)
 */
const calcCasement = (W, H) => {
  const outerFrameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
  const sashTotal       = round2(2 * (W / 1000) + 2 * (H / 1000)); // single sash same size
  const giTotal         = round2(outerFrameTotal + sashTotal);
  const glassArea       = round2(mmSqToSqFt(W - 50, H - 50));
  const epdmPerimeter   = round2(2 * ((W + H) / 1000));

  return {
    profiles: [
      { name: 'Outer Frame Profile (60mm)', qty: outerFrameTotal, unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `2 × ${(W/1000).toFixed(2)}m + 2 × ${(H/1000).toFixed(2)}m` },
      { name: 'Casement Sash Profile',      qty: sashTotal,       unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `Same perimeter as frame` },
    ],
    reinforcement: [
      { name: 'GI Box Reinforcement (1.2mm)', qty: giTotal, unit: 'meters', cutDetails: 'Frame + Sash profiles' },
    ],
    glass: [
      { name: 'Glass Pane', qty: glassArea, unit: 'sq.ft',
        cutDetails: `1 pane × ${(W-50)}mm × ${(H-50)}mm` },
    ],
    gaskets: [
      { name: 'EPDM Rubber Seal', qty: epdmPerimeter, unit: 'meters', cutDetails: 'Around sash perimeter (compression seal)' },
    ],
    hardware: [
      { name: 'Espagnolette Handle (Cockspur)', qty: 1, unit: 'pcs' },
      { name: 'Friction Stay (Arm)',             qty: 2, unit: 'pcs' },
      { name: 'Corner Keys',                     qty: 4, unit: 'pcs' },
      { name: 'Self-Drilling Screws',            qty: 28, unit: 'pcs' },
    ],
  };
};

/**
 * Fixed / Picture Window (no opening sash)
 */
const calcFixed = (W, H) => {
  const frameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
  const giTotal    = round2(frameTotal);
  const glassArea  = round2(mmSqToSqFt(W - 30, H - 30));
  const epdmLen    = round2(2 * ((W + H) / 1000));

  return {
    profiles: [
      { name: 'Outer Frame Profile (60mm)', qty: frameTotal, unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `2 × ${(W/1000).toFixed(2)}m + 2 × ${(H/1000).toFixed(2)}m` },
    ],
    reinforcement: [
      { name: 'GI Box Reinforcement (1.2mm)', qty: giTotal, unit: 'meters', cutDetails: 'Inside all frame profiles' },
    ],
    glass: [
      { name: 'Glass Pane', qty: glassArea, unit: 'sq.ft',
        cutDetails: `1 pane × ${(W-30)}mm × ${(H-30)}mm (direct glazed)` },
    ],
    gaskets: [
      { name: 'EPDM Rubber Seal (Glazing)', qty: epdmLen, unit: 'meters', cutDetails: 'Bead seal around glass' },
    ],
    hardware: [
      { name: 'Glazing Bead / Beading',   qty: round2(epdmLen), unit: 'meters' },
      { name: 'Corner Keys',              qty: 4,               unit: 'pcs' },
      { name: 'Self-Drilling Screws',     qty: 16,              unit: 'pcs' },
    ],
  };
};

/**
 * Tilt & Turn Window
 */
const calcTiltTurn = (W, H) => {
  const frameTotal = round2(2 * (W / 1000) + 2 * (H / 1000));
  const sashTotal  = round2(2 * (W / 1000) + 2 * (H / 1000));
  const giTotal    = round2(frameTotal + sashTotal);
  const glassArea  = round2(mmSqToSqFt(W - 60, H - 60));
  const epdmLen    = round2(2 * ((W + H) / 1000));

  return {
    profiles: [
      { name: 'Outer Frame Profile (70mm Series)', qty: frameTotal, unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `2 × ${(W/1000).toFixed(2)}m + 2 × ${(H/1000).toFixed(2)}m` },
      { name: 'Tilt & Turn Sash Profile',          qty: sashTotal,  unit: 'meters', cutAngle: '45° / 45°',
        cutDetails: `Full sash frame perimeter` },
    ],
    reinforcement: [
      { name: 'GI Box Reinforcement (1.5mm Heavy)', qty: giTotal, unit: 'meters', cutDetails: 'All frame + sash (heavier gauge for T&T)' },
    ],
    glass: [
      { name: 'Double Glazed Unit (24mm DGU)', qty: glassArea, unit: 'sq.ft',
        cutDetails: `${(W-60)}mm × ${(H-60)}mm — 4mm glass + 16mm argon + 4mm glass` },
    ],
    gaskets: [
      { name: 'EPDM Compression Gasket', qty: epdmLen,           unit: 'meters', cutDetails: 'Inner + outer seal' },
    ],
    hardware: [
      { name: 'Tilt & Turn Handle',       qty: 1,  unit: 'pcs' },
      { name: 'Multi-Point Locking',      qty: 1,  unit: 'pcs' },
      { name: 'Corner Scissors / Pivots', qty: 4,  unit: 'pcs' },
      { name: 'Corner Keys',              qty: 8,  unit: 'pcs' },
      { name: 'Self-Drilling Screws',     qty: 36, unit: 'pcs' },
    ],
  };
};

// ── Material Cost Calculation ────────────────────────────────────────

const calcMaterialCost = (bom, glassType) => {
  let cost = 0;
  const profile_rate = UNIT_COSTS.outerFrameProfile;

  bom.profiles.forEach(p => { cost += p.qty * profile_rate; });
  bom.reinforcement.forEach(r => { cost += r.qty * UNIT_COSTS.giReinforcement; });

  const glassRate =
    glassType === 'Double Glazed (24mm DGU)' ? UNIT_COSTS.glassDoubleUnit :
    glassType === '6mm Toughened'             ? UNIT_COSTS.glass6mm : UNIT_COSTS.glass5mm;
  bom.glass.forEach(g => { cost += g.qty * glassRate; });

  bom.gaskets.forEach(g => { cost += g.qty * UNIT_COSTS.woolpileGasket; });

  bom.hardware.forEach(h => {
    const name = h.name.toLowerCase();
    if (name.includes('roller'))         cost += h.qty * UNIT_COSTS.roller;
    else if (name.includes('touch'))     cost += h.qty * UNIT_COSTS.touchLock;
    else if (name.includes('handle'))    cost += h.qty * UNIT_COSTS.casementHandle;
    else if (name.includes('friction'))  cost += h.qty * UNIT_COSTS.frictionStay;
    else if (name.includes('tilt'))      cost += h.qty * UNIT_COSTS.tiltTurnHandle;
    else if (name.includes('multi'))     cost += h.qty * UNIT_COSTS.multiPointLock;
    else if (name.includes('screw'))     cost += h.qty * UNIT_COSTS.screws;
    else if (name.includes('hinge'))     cost += h.qty * UNIT_COSTS.casementHinge;
  });

  return Math.round(cost);
};

// ── Main Export ──────────────────────────────────────────────────────

/**
 * Calculate BOM for a single uPVC window unit.
 * @param {string} window_type  - one of the supported types
 * @param {number} width_mm     - width in millimetres
 * @param {number} height_mm    - height in millimetres
 * @param {number} qty          - number of units
 * @param {string} glass_type   - glass type descriptor
 * @returns {Object} full BOM with per-unit and total-quantity values + cost
 */
const calculateBOM = (window_type, width_mm, height_mm, qty = 1, glass_type = '5mm Clear') => {
  const W = Number(width_mm);
  const H = Number(height_mm);
  const Q = Number(qty);

  if (!W || !H || W < 300 || H < 300 || W > 5000 || H > 5000) {
    throw new Error('Invalid dimensions. Width and Height must be between 300mm and 5000mm.');
  }
  if (Q < 1 || Q > 1000) {
    throw new Error('Quantity must be between 1 and 1000.');
  }

  let perUnit;
  switch (window_type) {
    case '2-Track Sliding Window':   perUnit = calcSlidingTwoTrack(W, H);   break;
    case '3-Track Sliding Window':   perUnit = calcSlidingThreeTrack(W, H); break;
    case 'Casement Window':          perUnit = calcCasement(W, H);          break;
    case 'Fixed / Picture Window':   perUnit = calcFixed(W, H);             break;
    case 'Tilt & Turn Window':       perUnit = calcTiltTurn(W, H);          break;
    default:
      throw new Error(`Unsupported window type: "${window_type}". Valid types are: 2-Track Sliding Window, 3-Track Sliding Window, Casement Window, Fixed / Picture Window, Tilt & Turn Window`);
  }

  // Multiply all quantities by qty to get totals
  const scaleSection = (section) =>
    section.map(item => ({
      ...item,
      qtyPerUnit: item.qty,
      qtyTotal:   round2(item.qty * Q),
      qty:        round2(item.qty * Q),       // keep qty as total for display
    }));

  const totalBom = {
    profiles:      scaleSection(perUnit.profiles),
    reinforcement: scaleSection(perUnit.reinforcement),
    glass:         scaleSection(perUnit.glass),
    gaskets:       scaleSection(perUnit.gaskets),
    hardware:      scaleSection(perUnit.hardware),
  };

  const costPerUnit = calcMaterialCost(perUnit, glass_type);
  const costTotal   = costPerUnit * Q;

  return {
    input: {
      window_type,
      width_mm: W,
      height_mm: H,
      width_ft:  round2(mToFt(W)),
      height_ft: round2(mToFt(H)),
      qty: Q,
      glass_type,
    },
    perUnit,
    total: totalBom,
    costPerUnit,
    costTotal,
    summary: {
      totalProfileMeters:  round2(
        totalBom.profiles.reduce((s, p) => s + p.qty, 0) +
        totalBom.reinforcement.reduce((s, r) => s + r.qty, 0)
      ),
      totalGlassSqFt: round2(totalBom.glass.reduce((s, g) => s + g.qty, 0)),
      totalHardwarePcs: totalBom.hardware.reduce((s, h) => s + h.qty, 0),
    },
    generatedAt: new Date().toISOString(),
  };
};

module.exports = { calculateBOM, WINDOW_TYPES: [
  '2-Track Sliding Window',
  '3-Track Sliding Window',
  'Casement Window',
  'Fixed / Picture Window',
  'Tilt & Turn Window',
], GLASS_TYPES: [
  '5mm Clear',
  '5mm Toughened',
  '6mm Toughened',
  '6mm Tinted',
  'Double Glazed (24mm DGU)',
] };
