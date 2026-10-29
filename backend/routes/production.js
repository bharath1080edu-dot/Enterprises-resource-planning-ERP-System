const express = require('express');
const router  = express.Router();
const prod = require('../controllers/productionController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',                prod.getAll);
router.get('/:orderId',        prod.getByOrder);
router.patch('/:id',           prod.updateStage);

module.exports = router;
