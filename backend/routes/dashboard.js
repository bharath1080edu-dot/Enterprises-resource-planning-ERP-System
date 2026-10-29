const express = require('express');
const router  = express.Router();
const { getStats, getSalesTrend, getProductionTrend, getInventoryUsage, getAttendanceSummary, getRecentOrders } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stats',              getStats);
router.get('/sales-trend',        getSalesTrend);
router.get('/production-trend',   getProductionTrend);
router.get('/inventory-usage',    getInventoryUsage);
router.get('/attendance-summary', getAttendanceSummary);
router.get('/recent-orders',      getRecentOrders);

module.exports = router;
