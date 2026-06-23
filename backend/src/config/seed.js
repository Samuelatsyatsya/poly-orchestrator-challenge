require('dotenv').config();
const pool = require('./db');

const products = [
  { name: 'Wireless Noise-Cancelling Headphones', description: 'Premium over-ear headphones with 30-hour battery life and active noise cancellation.', price: 299.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', category: 'Electronics', stock: 45 },
  { name: 'Running Sneakers Pro', description: 'Lightweight performance running shoes with responsive cushioning and breathable mesh upper.', price: 129.99, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', category: 'Footwear', stock: 120 },
  { name: 'Leather Crossbody Bag', description: 'Handcrafted genuine leather bag with adjustable strap and multiple compartments.', price: 89.99, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500', category: 'Accessories', stock: 30 },
  { name: 'Smart Watch Series X', description: 'Advanced fitness tracking, GPS, heart rate monitor and 7-day battery life.', price: 399.99, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', category: 'Electronics', stock: 60 },
  { name: 'Organic Cotton T-Shirt', description: '100% GOTS-certified organic cotton. Soft, sustainable, available in 12 colors.', price: 34.99, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500', category: 'Clothing', stock: 200 },
  { name: 'Stainless Steel Water Bottle', description: 'Vacuum insulated 32oz bottle keeps drinks cold 24hrs, hot 12hrs. BPA-free.', price: 44.99, image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500', category: 'Home & Kitchen', stock: 85 },
  { name: 'Mechanical Keyboard TKL', description: 'Tenkeyless mechanical keyboard with Cherry MX switches and RGB backlighting.', price: 159.99, image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', category: 'Electronics', stock: 40 },
  { name: 'Yoga Mat Premium', description: 'Extra thick 6mm non-slip yoga mat with alignment lines and carrying strap.', price: 69.99, image_url: 'https://images.unsplash.com/photo-1601925228008-aaaccdf8f1fb?w=500', category: 'Sports', stock: 75 },
  { name: 'Ceramic Pour-Over Coffee Set', description: 'Handmade ceramic dripper with matching carafe. Brews 4 cups. Gift-ready packaging.', price: 54.99, image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500', category: 'Home & Kitchen', stock: 50 },
  { name: 'Portable Bluetooth Speaker', description: '360° sound, IPX7 waterproof, 20-hour playtime. Perfect for outdoors.', price: 79.99, image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500', category: 'Electronics', stock: 90 },
];

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Products already seeded, skipping.');
      return;
    }
    for (const p of products) {
      await client.query(
        'INSERT INTO products (name, description, price, image_url, category, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [p.name, p.description, p.price, p.image_url, p.category, p.stock]
      );
    }
    console.log(`Seeded ${products.length} products`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
