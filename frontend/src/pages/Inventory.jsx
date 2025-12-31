import React, { useEffect, useState } from 'react';
import { inventoryAPI, medicinesAPI } from '../services/api';
import { AlertCircle, TrendingDown } from 'lucide-react';

function Inventory() {
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      const [summaryRes, lowStockRes] = await Promise.all([
        inventoryAPI.getSummary(),
        medicinesAPI.getLowStock(),
      ]);
      setSummary(summaryRes.data);
      setLowStock(lowStockRes.data);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading inventory...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Inventory Management</h1>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <p className="text-gray-600 text-sm mb-2">Total Medicines</p>
            <p className="text-3xl font-bold text-primary">{summary.total_medicines}</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm mb-2">Total Stock Units</p>
            <p className="text-3xl font-bold text-green-600">{summary.total_stock}</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm mb-2">Stock Value</p>
            <p className="text-3xl font-bold text-purple-600">₹{(summary.total_value || 0).toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm mb-2">Low Stock Items</p>
            <p className="text-3xl font-bold text-red-600">{summary.low_stock_count}</p>
          </div>
        </div>
      )}

      {/* Low Stock Medicines */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="text-red-500" size={24} />
          <h2 className="text-xl font-semibold">Low Stock Medicines</h2>
        </div>

        {lowStock.length === 0 ? (
          <p className="text-gray-600 text-center py-8">All medicines have adequate stock</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Medicine Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((medicine) => (
                  <tr key={medicine.medicine_id} className="hover:bg-gray-50">
                    <td className="font-medium">{medicine.name}</td>
                    <td>{medicine.category}</td>
                    <td>
                      <span className="badge badge-error">{medicine.stock_quantity}</span>
                    </td>
                    <td>{medicine.reorder_level}</td>
                    <td>₹{medicine.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;
