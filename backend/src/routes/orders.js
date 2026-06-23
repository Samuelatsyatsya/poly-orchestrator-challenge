const router = require('express').Router();
const auth = require('../middleware/auth');
const { checkout, getOrders, getOrder } = require('../controllers/orderController');

router.use(auth);
router.post('/checkout', checkout);
router.get('/', getOrders);
router.get('/:id', getOrder);

module.exports = router;
