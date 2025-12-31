import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, Truck, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingStatus, setEditingStatus] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setIsLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch orders (${response.status})`);
      }

      const data = await response.json();
      setOrders(data.data || data);
      setError('');
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.message || 'Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.order_id === orderId ? { ...order, status: newStatus } : order
        )
      );

      setEditingOrderId(null);
      setEditingStatus('');
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };
  const handleSimulatedPayment = async (order) => {
    try {
      // Simple demo OTP flow for online payments
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const userOtp = window.prompt(
        `Demo OTP verification\n\nYour OTP is: ${generatedOtp}\nPlease enter this 4-digit OTP to confirm payment.`
      );

      if (!userOtp) {
        return; // User cancelled
      }

      if (userOtp.trim() !== generatedOtp) {
        alert('Incorrect OTP. Payment not processed.');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/orders/${order.order_id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId: `SIMULATED_${Date.now()}` }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to process payment');
      }

      await fetchOrders();
    } catch (error) {
      console.error('Error processing simulated payment:', error);
      alert(error.message || 'Failed to process payment');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock size={24} className="text-yellow-600" />;
      case 'confirmed':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'shipped':
        return <Truck size={24} className="text-blue-600" />;
      case 'delivered':
        return <CheckCircle size={24} className="text-green-600" />;
      default:
        return <Package size={24} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'confirmed':
        return 'bg-green-50 border-green-200';
      case 'shipped':
        return 'bg-blue-50 border-blue-200';
      case 'delivered':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {user?.role === 'customer' ? 'My Orders' : 'Customer Orders'}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-500 mt-4">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {user?.role === 'customer' ? 'My Orders' : 'Customer Orders'}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-red-600 font-semibold">{error}</p>
            <button 
              onClick={fetchOrders}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {user?.role === 'customer' ? 'My Orders' : 'Customer Orders'}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Package size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No orders yet</p>
            {user?.role === 'customer' && (
              <a
                href="/dashboard"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                Start Shopping
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          {user?.role === 'customer' ? 'My Orders' : 'Customer Orders'}
        </h1>

        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.order_id}
              className={`border-2 rounded-lg shadow-lg overflow-hidden ${getStatusColor(order.status)}`}
            >
              {/* Order Header */}
              <div className="p-6 bg-white border-b flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <h3 className="text-xl font-bold text-gray-800">#{order.order_id}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    {user?.role !== 'customer' && editingOrderId === order.order_id ? (
                      <select
                        value={editingStatus}
                        onChange={(e) => setEditingStatus(e.target.value)}
                        className="text-lg font-semibold bg-white border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <p className="text-lg font-semibold text-gray-800 capitalize">{order.status}</p>
                    )}
                  </div>
                  {user?.role !== 'customer' && editingOrderId === order.order_id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusUpdate(order.order_id, editingStatus)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingOrderId(null)}
                        className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : user?.role !== 'customer' ? (
                    <button
                      onClick={() => {
                        setEditingOrderId(order.order_id);
                        setEditingStatus(order.status);
                      }}
                      className="p-2 hover:bg-blue-100 rounded transition"
                    >
                      <Edit2 size={18} className="text-blue-600" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Order Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Order Date</p>
                    <p className="text-gray-800">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Total Amount</p>
                    <p className="text-xl font-bold text-blue-600">₹{Number(order.total_amount || 0).toFixed(2)}</p>
                  </div>
                  {user?.role !== 'customer' && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Customer Phone</p>
                        <p className="text-gray-800">{order.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Payment Method</p>
                        <p className="text-gray-800 capitalize">{order.payment_method?.replace('_', ' ')}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Delivery Address</p>
                    <p className="text-gray-800">{order.delivery_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">City</p>
                    <p className="text-gray-800">{order.city}</p>
                  </div>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm text-gray-600 font-semibold mb-3">Items Ordered</p>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-gray-700 text-sm"
                        >
                          <span>{item.medicine_name || item.name} x {item.quantity}</span>
                          <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin/staff actions */}
                {user?.role !== 'customer' && order.status === 'pending' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <button
                      onClick={() => handleStatusUpdate(order.order_id, 'confirmed')}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Proceed to Payment
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(order.order_id, 'cancelled')}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}

                {/* Customer simulated payment: allow paying only when pending and not COD */}
                {user?.role === 'customer' && order.status === 'pending' && order.payment_method !== 'cod' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <button
                      onClick={() => handleSimulatedPayment(order)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Pay Now (Demo)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

