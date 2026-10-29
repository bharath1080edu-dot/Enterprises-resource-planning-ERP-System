const express = require('express');
const router  = express.Router();
const inv = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',                    inv.getAll);
router.post('/',                   inv.create);
router.put('/:id',                 inv.update);
router.delete('/:id',              inv.remove);
router.get('/low-stock',           inv.getLowStock);
router.get('/suppliers',           inv.getSuppliers);
router.post('/suppliers',          inv.createSupplier);
router.get('/:id/history',         inv.getHistory);

module.exports = router;