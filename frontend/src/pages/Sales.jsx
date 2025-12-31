import React, { useEffect, useState } from 'react';
import { ShoppingCart, TrendingUp } from 'lucide-react';

function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('confirmed');

  useEffect(() => {
    fetchSales();
  }, [filterStatus]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sales');
      }

      const data = await response.json();
      const orders = data.data || data;
      
      // Filter orders by status (only show confirmed, shipped, delivered as sales)
      const salesData = orders.filter(order => 
        filterStatus === 'all' ? true : order.status === filterStatus
      );

      setSales(salesData);
      setError('');
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      setError('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const getTotalRevenue = () => {
    return sales.reduce((total, sale) => total + (sale.total_amount || 0), 0);
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Sales</h1>
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-2">
            <TrendingUp size={24} className="text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">₹{getTotalRevenue().toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Filter by Status</h2>
          <div className="flex gap-2 flex-wrap">
            {['all', 'confirmed', 'shipped', 'delivered'].map((status) => (
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600">Loading sales data...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <ShoppingCart size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No sales found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Sale ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Customer ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Payment Method
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.order_id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">#{sale.order_id}</td>
                      <td className="px-6 py-4 text-gray-600">{sale.customer_id}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">₹{sale.total_amount?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{sale.payment_method?.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {sale.items && sale.items.length > 0 
                          ? sale.items.length + ' item(s)'
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(sale.status)}`}>
                          {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 border-t">
              <div className="bg-white rounded-lg p-4 shadow">
                <p className="text-sm text-gray-600 mb-2">Total Sales</p>
                <p className="text-2xl font-bold text-gray-800">{sales.length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow">
                <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">₹{getTotalRevenue().toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow">
                <p className="text-sm text-gray-600 mb-2">Average Sale</p>
                <p className="text-2xl font-bold text-blue-600">₹{(getTotalRevenue() / sales.length).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Sales;
