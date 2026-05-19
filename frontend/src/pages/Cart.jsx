import React from 'react';
import { useCart } from '../context/CartContext';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, getTotalPrice } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPrice = getTotalPrice();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {cart.map((item) => (
                <div
                  key={item.medicine_id}
                  className="border-b p-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{item.medicine_name}</h3>
                    <p className="text-sm text-gray-600">{item.category}</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">₹{item.price}</p>
                  </div>

                  {/* Quantity Control */}
                  <div className="flex items-center gap-3 mx-4">
                    <button
                      onClick={() => updateQuantity(item.medicine_id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <Minus size={18} className="text-gray-600" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.medicine_id, parseInt(e.target.value) || 1)
                      }
                      className="w-12 text-center border border-gray-300 rounded py-1"
                    />
                    <button
                      onClick={() => updateQuantity(item.medicine_id, item.quantity + 1)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <Plus size={18} className="text-gray-600" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right mr-4">
                    <p className="text-sm text-gray-600">Subtotal</p>
                    <p className="text-lg font-bold text-gray-800">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.medicine_id)}
                    className="p-2 hover:bg-red-100 rounded transition"
                  >
                    <Trash2 size={20} className="text-red-600" />
                  </button>
                </div>
              ))}
            </div>

            {/* Continue Shopping */}
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Continue Shopping
            </button>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-20">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal ({cart.length} items)</span>
                <span>₹{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Shipping</span>
                <span className="text-green-600 font-semibold">Free</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Tax (5%)</span>
                <span>₹{(totalPrice * 0.05).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between text-xl font-bold text-gray-800">
                <span>Total</span>
                <span>₹{(totalPrice * 1.05).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
