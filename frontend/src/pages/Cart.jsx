import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { orders as ordersApi } from '../api';
import { TrashIcon, MinusIcon, PlusIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Cart() {
  const { items, total, updateItem, removeItem, clearCart, loading } = useCart();
  const [address, setAddress] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!address.trim()) { toast.error('Please enter a shipping address'); return; }
    try {
      setCheckingOut(true);
      const res = await ordersApi.checkout(address);
      await clearCart();
      toast.success('Order placed successfully!');
      navigate(`/orders/${res.data.order.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <ShoppingBagIcon className="h-20 w-20 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
        <p className="text-gray-500 mt-2">Add some products to get started</p>
        <Link to="/" className="btn-primary inline-block mt-6">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="card p-4 flex gap-4">
              <img src={product.image_url} alt={product.name}
                className="w-20 h-20 object-cover rounded-lg bg-gray-100 shrink-0"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=?'; }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                <p className="text-red-600 font-bold mt-1">${parseFloat(product.price).toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => updateItem(product.id, quantity - 1)}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <button onClick={() => updateItem(product.id, quantity + 1)}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-50">
                    <PlusIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeItem(product.id)}
                    className="ml-auto p-1 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-6 h-fit space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Shipping</span>
            <span className="text-green-600">Free</span>
          </div>
          <div className="border-t pt-3 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shipping address..."
            rows={3}
            className="input resize-none"
          />
          <button onClick={handleCheckout} disabled={checkingOut} className="btn-primary w-full py-3 text-base">
            {checkingOut ? 'Placing order...' : 'Place Order'}
          </button>
          <Link to="/" className="btn-secondary w-full text-center block">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
