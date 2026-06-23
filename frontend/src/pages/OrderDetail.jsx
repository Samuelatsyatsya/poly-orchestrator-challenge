import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orders as ordersApi } from '../api';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getOne(id).then((res) => setOrder(res.data)).catch(() => navigate('/orders')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="flex justify-center items-center min-h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;
  if (!order) return null;

  const stepIdx = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-gray-600 hover:text-red-600 mb-6">
        <ArrowLeftIcon className="h-5 w-5" /> My Orders
      </button>

      <div className="card p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-gray-500 text-sm mt-1">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <span className="text-2xl font-bold text-gray-900">${parseFloat(order.total).toFixed(2)}</span>
        </div>

        {/* Status tracker */}
        <div className="flex items-center gap-0 mb-6">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= stepIdx ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span className="text-xs mt-1 capitalize text-gray-600">{step}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-1 ${i < stepIdx ? 'bg-red-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {order.shipping_address && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>Ship to:</strong> {order.shipping_address}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-gray-900 mb-4">Items</h2>
        <div className="space-y-3">
          {order.items?.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              <img src={item.product?.image_url} alt={item.product?.name}
                className="w-14 h-14 object-cover rounded-lg bg-gray-100 shrink-0"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/56?text=?'; }} />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.product?.name}</p>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
