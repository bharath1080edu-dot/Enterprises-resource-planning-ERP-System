const express = require('express');
const router  = express.Router();
const pay = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',                pay.getAll);
router.post('/',               pay.create);
router.get('/pending',         pay.getPending);
router.get('/summary',         pay.getSummary);
router.get('/expenses',        pay.getExpenses);
router.post('/expenses',       pay.createExpense);
router.delete('/expenses/:id', pay.deleteExpense);

module.exports = router;
