const router = require('express').Router();
const auth = require('../middleware/auth');
const { getCart, addToCart, updateCart, removeFromCart, clearCart } = require('../controllers/cartController');

router.use(auth);
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCart);
router.delete('/item/:productId', removeFromCart);
router.delete('/clear', clearCart);

module.exports = router;
