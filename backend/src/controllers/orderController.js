const pool = require('../config/db');
const redis = require('../config/redis');

const cartKey = (userId) => `cart:${userId}`;

exports.checkout = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { shipping_address } = req.body;
    const cartData = await redis.hgetall(cartKey(req.user.id));
    if (!cartData || Object.keys(cartData).length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const productIds = Object.keys(cartData);
    const productsResult = await client.query('SELECT * FROM products WHERE id = ANY($1)', [productIds]);
    const products = productsResult.rows;

    await client.query('BEGIN');

    let total = 0;
    const orderItems = [];

    for (const product of products) {
      const qty = parseInt(cartData[product.id]);
      if (product.stock < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      total += product.price * qty;
      orderItems.push({ product, qty });
    }

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total, status, shipping_address) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, total.toFixed(2), 'confirmed', shipping_address]
    );
    const order = orderResult.rows[0];

    for (const { product, qty } of orderItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, product.id, qty, product.price]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
    }

    await client.query('COMMIT');
    await redis.del(cartKey(req.user.id));
    res.status(201).json({ order });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id, 'quantity', oi.quantity, 'price', oi.price,
        'product', json_build_object('id', p.id, 'name', p.name, 'image_url', p.image_url)
      )) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = $1
      GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id, 'quantity', oi.quantity, 'price', oi.price,
        'product', json_build_object('id', p.id, 'name', p.name, 'image_url', p.image_url)
      )) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.id = $1 AND o.user_id = $2
      GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
