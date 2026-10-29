const express = require('express');
const router  = express.Router();
const ord = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',             ord.getAll);
router.post('/',            ord.create);
router.get('/:id',          ord.getOne);
router.put('/:id',          ord.update);
router.patch('/:id/status', ord.updateStatus);
router.delete('/:id',       ord.remove);

module.exports = router;
