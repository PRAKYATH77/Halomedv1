import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../services/api';
import { BarChart3, TrendingUp } from 'lucide-react';

function Analytics() {
  const [topMedicines, setTopMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesMetrics, setSalesMetrics] = useState({
    totalRevenue: 0,
    avgSale: 0,
    totalTransactions: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [topResponse, salesResponse] = await Promise.all([
        analyticsAPI.getTopMedicines(),
        analyticsAPI.getSalesAnalytics(),
      ]);

      setTopMedicines(topResponse.data || []);

      const salesData = salesResponse.data || [];
      let totalRevenue = 0;
      let totalTransactions = 0;

      salesData.forEach((row) => {
        totalRevenue += Number(row.total_revenue || 0);
        totalTransactions += Number(row.total_sales || 0);
      });

      const avgSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      setSalesMetrics({
        totalRevenue,
        avgSale,
        totalTransactions,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics & Insights</h1>

      {loading ? (
        <div className="text-center py-12">Loading analytics...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold">Top Selling Medicines</h2>
            </div>

            <div className="space-y-4">
              {topMedicines.map((medicine, index) => (
                <div key={medicine.medicine_id} className="flex items-center justify-between pb-4 border-b last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{index + 1}. {medicine.name}</p>
                    <p className="text-sm text-gray-600">{medicine.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-green-600">{medicine.total_sold} sold</p>
                    <p className="text-sm text-gray-600">₹{parseFloat(medicine.total_revenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-blue-600" size={24} />
              <h2 className="text-xl font-semibold">Sales Metrics</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{salesMetrics.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Average Sale Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{salesMetrics.avgSale.toFixed(2)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-purple-600">
                  {salesMetrics.totalTransactions}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
