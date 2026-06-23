const redis = require('../config/redis');
const pool = require('../config/db');

const cartKey = (userId) => `cart:${userId}`;

exports.getCart = async (req, res, next) => {
  try {
    const data = await redis.hgetall(cartKey(req.user.id));
    if (!data || Object.keys(data).length === 0) return res.json({ items: [], total: 0 });

    const productIds = Object.keys(data);
    const result = await pool.query('SELECT * FROM products WHERE id = ANY($1)', [productIds]);
    const products = result.rows;

    const items = products.map((p) => ({
      product: p,
      quantity: parseInt(data[p.id]),
    }));
    const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    res.json({ items, total: parseFloat(total.toFixed(2)) });
  } catch (err) {
    next(err);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product.rows[0]) return res.status(404).json({ error: 'Product not found' });
    if (product.rows[0].stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const key = cartKey(req.user.id);
    const current = parseInt((await redis.hget(key, productId)) || 0);
    await redis.hset(key, productId, current + quantity);
    await redis.expire(key, 60 * 60 * 24 * 7); // 7 days TTL
    res.json({ message: 'Added to cart' });
  } catch (err) {
    next(err);
  }
};

exports.updateCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const key = cartKey(req.user.id);
    if (quantity <= 0) {
      await redis.hdel(key, productId);
    } else {
      await redis.hset(key, productId, quantity);
    }
    res.json({ message: 'Cart updated' });
  } catch (err) {
    next(err);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    await redis.hdel(cartKey(req.user.id), req.params.productId);
    res.json({ message: 'Item removed' });
  } catch (err) {
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    await redis.del(cartKey(req.user.id));
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    next(err);
  }
};
