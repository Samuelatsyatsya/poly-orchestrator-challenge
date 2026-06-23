import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { orders as ordersApi } from '../api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Orders() {
  const [orderList, setOrderList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getAll().then((res) => setOrderList(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  if (orderList.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">No orders yet</h2>
        <Link to="/" className="btn-primary inline-block mt-6">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
      <div className="space-y-4">
        {orderList.map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="card p-6 block hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-mono text-sm text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-gray-500 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                  {order.status}
                </span>
                <p className="text-lg font-bold text-gray-900 mt-1">${parseFloat(order.total).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2 overflow-hidden">
              {order.items?.slice(0, 4).map((item) => (
                <img key={item.id} src={item.product?.image_url} alt={item.product?.name}
                  className="w-12 h-12 object-cover rounded-lg bg-gray-100"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/48?text=?'; }} />
              ))}
              {order.items?.length > 4 && (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-500">
                  +{order.items.length - 4}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
