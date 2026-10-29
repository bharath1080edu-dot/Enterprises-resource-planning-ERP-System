const express = require('express');
const router  = express.Router();
const att = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',         att.getAll);
router.post('/',        att.markAttendance);
router.put('/:id',      att.update);
router.get('/report',   att.getReport);
router.get('/summary',  att.getSummary);
router.get('/calendar', att.getCalendarData);

module.exports = router;

