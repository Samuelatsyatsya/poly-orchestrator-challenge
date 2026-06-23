import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cart as cartApi } from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartData, setCartData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) { setCartData({ items: [], total: 0 }); return; }
    try {
      setLoading(true);
      const res = await cartApi.get();
      setCartData(res.data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId, quantity = 1) => {
    await cartApi.add(productId, quantity);
    await fetchCart();
  };

  const updateItem = async (productId, quantity) => {
    await cartApi.update(productId, quantity);
    await fetchCart();
  };

  const removeItem = async (productId) => {
    await cartApi.remove(productId);
    await fetchCart();
  };

  const clearCart = async () => {
    await cartApi.clear();
    await fetchCart();
  };

  const itemCount = cartData.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ ...cartData, loading, itemCount, addToCart, updateItem, removeItem, clearCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
