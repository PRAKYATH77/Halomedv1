import React, { useEffect, useState } from 'react';
import { medicinesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, AlertCircle } from 'lucide-react';

function Medicines() {
  const { user } = useAuth();
  const canEdit = ['admin', 'staff'].includes(user?.role);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock_quantity: '',
    reorder_level: '',
  });

  useEffect(() => {
    fetchMedicines();
  }, [searchTerm]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await medicinesAPI.getAll({ searchTerm });
      setMedicines(response.data);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await medicinesAPI.create(formData);
      setFormData({
        name: '',
        category: '',
        price: '',
        stock_quantity: '',
        reorder_level: '',
      });
      setShowForm(false);
      fetchMedicines();
    } catch (error) {
      console.error('Failed to create medicine:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Medicines</h1>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Medicine
          </button>
        )}
      </div>

      {/* Add Medicine Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Medicine</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Medicine Name"
                className="input-field"
                required
              />
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Category"
                className="input-field"
                required
              />
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Price"
                className="input-field"
                step="0.01"
                required
              />
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleChange}
                placeholder="Stock Quantity"
                className="input-field"
              />
              <input
                type="number"
                name="reorder_level"
                value={formData.reorder_level}
                onChange={handleChange}
                placeholder="Reorder Level"
                className="input-field"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Save Medicine
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search medicines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Medicines List */}
      {loading ? (
        <div className="text-center py-12">Loading medicines...</div>
      ) : medicines.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600">No medicines found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medicines.map((medicine) => (
            <div key={medicine.medicine_id} className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {medicine.name}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Category: <span className="font-medium">{medicine.category}</span>
              </p>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-medium">₹{medicine.price}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-600">Stock:</span>
                  <span className={medicine.stock_quantity <= medicine.reorder_level ? 'text-red-600 font-medium' : 'font-medium'}>
                    {medicine.stock_quantity} units
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-600">Reorder Level:</span>
                  <span className="font-medium">{medicine.reorder_level}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Medicines;
