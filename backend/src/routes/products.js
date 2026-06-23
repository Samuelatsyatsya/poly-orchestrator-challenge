const router = require('express').Router();
const { getAll, getOne, getCategories } = require('../controllers/productController');

router.get('/', getAll);
router.get('/categories', getCategories);
router.get('/:id', getOne);

module.exports = router;
