import React, { useEffect, useState } from 'react';
import { inventoryAPI, medicinesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TrendingDown } from 'lucide-react';

function Inventory() {
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const { user } = useAuth();
  const canEdit = ['admin', 'staff'].includes(user?.role);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ medicine_id: '', change_type: 'addition', quantity_changed: 0, notes: '' });

  const handleInput = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const submitLog = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.addLog({
        medicine_id: parseInt(form.medicine_id, 10),
        change_type: form.change_type,
        quantity_changed: parseInt(form.quantity_changed, 10),
        notes: form.notes,
      });
      setShowAdd(false);
      setForm({ medicine_id: '', change_type: 'addition', quantity_changed: 0, notes: '' });
      fetchInventoryData();
      alert('Inventory log added');
    } catch (err) {
      console.error('Failed to add inventory log:', err);
      alert('Failed to add log');
    }
  };

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
      {canEdit && (
        <div className="mb-6 flex justify-end">
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
            {showAdd ? 'Close' : 'Add Inventory Log'}
          </button>
        </div>
      )}

      {showAdd && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Add Inventory Log</h2>
          <form onSubmit={submitLog} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input name="medicine_id" value={form.medicine_id} onChange={handleInput} placeholder="Medicine ID" className="input-field" required />
              <select name="change_type" value={form.change_type} onChange={handleInput} className="input-field">
                <option value="addition">Addition</option>
                <option value="sale">Sale</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input name="quantity_changed" value={form.quantity_changed} onChange={handleInput} type="number" className="input-field" required />
            </div>
            <div>
              <input name="notes" value={form.notes} onChange={handleInput} placeholder="Notes (optional)" className="input-field" />
            </div>
            <div>
              <button type="submit" className="btn-primary">Save Log</button>
            </div>
          </form>
        </div>
      )}
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
