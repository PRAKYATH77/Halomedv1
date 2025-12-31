import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Edit2, Plus } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_info: '',
    address: '',
    email: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get('http://localhost:5000/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuppliers(response.data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch suppliers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (editingId) {
        // Update
        await axios.put(`http://localhost:5000/suppliers/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Create
        await axios.post('http://localhost:5000/suppliers', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      setFormData({ name: '', contact_info: '', address: '', email: '' });
      setEditingId(null);
      setShowForm(false);
      setError('');
      fetchSuppliers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setFormData({
      name: supplier.name,
      contact_info: supplier.contact_info || '',
      address: supplier.address || '',
      email: supplier.email || '',
    });
    setEditingId(supplier.supplier_id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        await axios.delete(`http://localhost:5000/suppliers/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setError('');
        fetchSuppliers();
      } catch (err) {
        setError('Failed to delete supplier');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', contact_info: '', address: '', email: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Supplier Management</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={20} />
            Add Supplier
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">
              {editingId ? 'Edit Supplier' : 'Add New Supplier'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter supplier name"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    name="contact_info"
                    value={formData.contact_info}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="supplier@example.com"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter address"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg transition disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : 'Save Supplier'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Suppliers Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {loading && !showForm ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Loading suppliers...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No suppliers found. Add one to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">ID</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Contact</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Address</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.supplier_id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-600">{supplier.supplier_id}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{supplier.name}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.contact_info || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.email || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.address || '-'}</td>
                      <td className="px-6 py-4 flex justify-center gap-3">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition"
                          title="Edit supplier"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.supplier_id)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition"
                          title="Delete supplier"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
