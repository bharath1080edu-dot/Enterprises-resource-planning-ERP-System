const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { calculateBOM, WINDOW_TYPES, GLASS_TYPES } = require('../services/bomCalculatorService');

router.use(protect);

// GET /api/bom/types — return supported window & glass types
router.get('/types', (req, res) => {
  res.json({ success: true, data: { windowTypes: WINDOW_TYPES, glassTypes: GLASS_TYPES } });
});

// POST /api/bom/calculate — calculate BOM for given inputs
router.post('/calculate', (req, res) => {
  try {
    const { window_type, width_mm, height_mm, qty, glass_type } = req.body;

    if (!window_type || !width_mm || !height_mm) {
      return res.status(400).json({
        success: false,
        message: 'window_type, width_mm, and height_mm are required.',
      });
    }

    const result = calculateBOM(window_type, width_mm, height_mm, qty || 1, glass_type || '5mm Clear');

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
