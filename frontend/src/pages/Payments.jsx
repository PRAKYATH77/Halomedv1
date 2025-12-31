import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (user?.role !== 'customer') {
      fetchPayments();
    }
  }, [filterStatus, user]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      // Fetch customer orders instead of separate payment transactions
      const response = await fetch('http://localhost:5000/api/orders', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      const orders = data.data || data;
      
      // Filter by status if needed
      let filteredOrders = orders;
      if (filterStatus !== 'all') {
        filteredOrders = orders.filter(order => order.status === filterStatus);
      }
      
      setPayments(filteredOrders);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Failed to load payments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'pending':
        return <Clock size={24} className="text-yellow-600" />;
      case 'failed':
        return <AlertCircle size={24} className="text-red-600" />;
      default:
        return <CreditCard size={24} className="text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (user?.role === 'customer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <p className="text-red-600 text-lg">Access Denied</p>
            <p className="text-gray-600">Only admin and staff can view payments.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Payment Transactions</h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500">Loading payments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Payment Transactions</h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Payment Transactions</h1>

        {/* Filter */}
        <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Filter by Status</h2>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Payments Table */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CreditCard size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No payments found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Customer ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((order, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">
                      #{order.order_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {order.customer_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                      ₹{order.total_amount?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {order.phone_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 capitalize">
                      {order.payment_method?.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                          order.status
                        )}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {payments.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Total Orders</p>
              <p className="text-3xl font-bold text-gray-800">{payments.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ₹
                {payments
                  .reduce((sum, p) => sum + (p.total_amount || 0), 0)
                  .toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Confirmed Orders</p>
              <p className="text-3xl font-bold text-blue-600">
                {payments.filter((p) => p.status === 'confirmed').length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
