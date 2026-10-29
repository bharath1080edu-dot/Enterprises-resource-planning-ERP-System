const express = require('express');
const router  = express.Router();
const {
    getSalesReport,
    getInventoryReport,
    getAttendanceReport,
    getProductionReport,
    getProfitReport,
} = require('../controllers/reportsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/sales',      getSalesReport);
router.get('/inventory',  getInventoryReport);
router.get('/attendance', getAttendanceReport);
router.get('/production', getProductionReport);
router.get('/profit',     getProfitReport);

module.exports = router;
