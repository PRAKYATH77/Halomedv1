import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { API_BASE_URL, paymentsAPI } from '../services/api';

const loadRazorpayCheckout = () => {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

export default function Checkout() {
  const { cart, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    deliveryAddress: '',
    city: '',
    zipCode: '',
    phoneNumber: '',
    paymentMethod: 'cod', // cod = Cash on Delivery, card = Credit Card
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto">
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
  const tax = totalPrice * 0.05;
  const finalTotal = totalPrice + tax;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.deliveryAddress || !formData.city || !formData.zipCode || !formData.phoneNumber) {
      alert('Please fill in all delivery details');
      return;
    }

    setIsProcessing(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Create order with all details
      const orderData = {
        items: cart.map((item) => ({
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: finalTotal,
        deliveryAddress: formData.deliveryAddress,
        city: formData.city,
        zipCode: formData.zipCode,
        phoneNumber: formData.phoneNumber,
        paymentMethod: formData.paymentMethod,
        transactionId: `TXN_${Date.now()}`,
      };

      console.log('Creating order with data:', orderData);
      console.log('Token:', token);

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();
      console.log('Order response:', data);

      if (!response.ok) {
        throw new Error(data.message || `Failed to create order: ${response.status}`);
      }

      const orderId = data.data?.orderId || data.data?.order_id;
      // If online payment selected, initiate Razorpay sandbox flow
      if (formData.paymentMethod !== 'cod') {
        try {
          // create razorpay order on backend
          const createRes = await paymentsAPI.createRazorpayOrder({ amount: finalTotal, receipt: String(orderId) });
          const payload = createRes.data || createRes;
          const rOrder = payload.order || payload.data?.order || payload;
          const key_id = payload.key_id || payload.data?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;

          if (!key_id || !rOrder?.id || !rOrder?.amount || !rOrder?.currency) {
            throw new Error('Razorpay order details are incomplete. Check backend Razorpay key configuration.');
          }

          // load Razorpay checkout script
          await loadRazorpayCheckout();

          if (!window.Razorpay) {
            throw new Error('Razorpay checkout script did not load.');
          }

          const options = {
            key: key_id,
            amount: rOrder.amount,
            currency: rOrder.currency,
            name: 'HALOmed',
            description: `Order ${orderId}`,
            order_id: rOrder.id,
            handler: async (response) => {
              try {
                await paymentsAPI.verifyRazorpayPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: orderId,
                });
                setOrderNumber('ORDER_' + orderId);
                setOrderPlaced(true);
                clearCart();
                setTimeout(() => navigate('/orders'), 3000);
              } catch (err) {
                console.error('Payment verification failed', err);
                alert('Payment verification failed. Please contact support.');
              }
            },
            prefill: { contact: formData.phoneNumber },
            theme: { color: '#0ea5a4' },
            modal: {
              ondismiss: () => {
                setIsProcessing(false);
              },
            },
          };

          // @ts-ignore
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch (err) {
          console.error('Razorpay flow error', err);
          if (import.meta.env.DEV) {
            try {
              await paymentsAPI.simulateRazorpayPayment({ order_id: orderId });
              setOrderNumber('ORDER_' + orderId);
              setOrderPlaced(true);
              clearCart();
              setTimeout(() => navigate('/orders'), 3000);
              return;
            } catch (simulateErr) {
              console.error('Local payment simulation failed', simulateErr);
            }
          }
          alert(err.message || 'Failed to initiate payment. Please try again.');
        }
      } else {
        setOrderNumber('ORDER_' + orderId);
        setOrderPlaced(true);
        clearCart();
        // Redirect after 3 seconds
        setTimeout(() => {
          navigate('/orders');
        }, 3000);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Order Placed!</h1>
          <p className="text-gray-600 mb-4">Your order has been successfully placed</p>
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Order Number</p>
            <p className="text-2xl font-bold text-green-600">{orderNumber}</p>
          </div>
          <p className="text-gray-600 mb-6">
            We&apos;ll send you a confirmation email shortly. You can track your order in the Orders page.
          </p>
          <button
            onClick={() => navigate('/orders')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Delivery Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Delivery Address</h2>

              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Full Address</label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleInputChange}
                    placeholder="Enter your delivery address"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Enter city"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Zip Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="Enter zip code"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Payment Method</label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cod">Cash on Delivery</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
                >
                  {isProcessing ? 'Processing...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-20">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Summary</h2>

            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.medicine_id}
                  className="flex justify-between text-sm text-gray-700 pb-2 border-b"
                >
                  <span>
                    {item.medicine_name} x{item.quantity}
                  </span>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>₹{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Shipping</span>
                <span className="text-green-600 font-semibold">Free</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Tax (5%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-xl font-bold text-gray-800">
                <span>Total</span>
                <span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
