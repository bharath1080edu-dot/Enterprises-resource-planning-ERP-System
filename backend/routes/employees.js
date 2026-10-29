const express = require('express');
const router  = express.Router();
const emp = require('../controllers/employeeController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',       emp.getAll);
router.post('/',      emp.create);
router.put('/:id',    emp.update);
router.delete('/:id', emp.remove);

module.exports = router;
