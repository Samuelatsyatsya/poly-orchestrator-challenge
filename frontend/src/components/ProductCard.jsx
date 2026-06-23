import { Link } from 'react-router-dom';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    try {
      await addToCart(product.id);
      toast.success('Added to cart!');
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  return (
    <Link to={`/product/${product.id}`} className="card group hover:shadow-md transition-shadow duration-200 flex flex-col">
      <div className="aspect-square overflow-hidden rounded-t-xl bg-gray-100">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=No+Image'; }}
        />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-medium text-red-600 uppercase tracking-wide">{product.category}</span>
        <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2 flex-1">{product.name}</h3>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">${parseFloat(product.price).toFixed(2)}</span>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            {product.stock === 0 ? 'Out of stock' : 'Add'}
          </button>
        </div>
        {product.stock > 0 && product.stock <= 10 && (
          <p className="text-xs text-orange-500 mt-1">Only {product.stock} left!</p>
        )}
      </div>
    </Link>
  );
}
