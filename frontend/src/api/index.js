import client from './client';

export const auth = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
};

export const products = {
  getAll: (params) => client.get('/products', { params }),
  getOne: (id) => client.get(`/products/${id}`),
  getCategories: () => client.get('/products/categories'),
};

export const cart = {
  get: () => client.get('/cart'),
  add: (productId, quantity = 1) => client.post('/cart/add', { productId, quantity }),
  update: (productId, quantity) => client.put('/cart/update', { productId, quantity }),
  remove: (productId) => client.delete(`/cart/item/${productId}`),
  clear: () => client.delete('/cart/clear'),
};

export const orders = {
  checkout: (shipping_address) => client.post('/orders/checkout', { shipping_address }),
  getAll: () => client.get('/orders'),
  getOne: (id) => client.get(`/orders/${id}`),
};
