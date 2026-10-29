const express = require('express');
const router  = express.Router();
const { trackOrder } = require('../controllers/trackingController');

// ── POST /api/track ───────────────────────────────────────
// Public — no auth middleware applied.
router.post('/', trackOrder);

module.exports = router;
