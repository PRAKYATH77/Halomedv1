import React, { useEffect, useState } from 'react';
import { prescriptionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const { user } = useAuth();
  const canCreate = ['admin', 'staff'].includes(user?.role);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customer_id: '', medicine_id: '', prescribed_by: '', date_issued: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await prescriptionsAPI.create(form);
      setShowCreate(false);
      setForm({ customer_id: '', medicine_id: '', prescribed_by: '', date_issued: '' });
      fetchPrescriptions();
      alert('Prescription created');
    } catch (err) {
      console.error('Failed to create prescription:', err);
      alert('Failed to create prescription');
    }
  };

  const fetchPrescriptions = async () => {
    try {
      const response = await prescriptionsAPI.getAll({});
      setPrescriptions(response.data);
    } catch (error) {
      console.error('Failed to fetch prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Prescriptions</h1>

      {loading ? (
        <div className="text-center py-12">Loading prescriptions...</div>
      ) : (
        <>
          {canCreate && (
            <div className="mb-6 flex justify-end">
              <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? 'Close' : 'Create Prescription'}</button>
            </div>
          )}

          {showCreate && (
            <div className="card mb-6 p-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input required placeholder="Customer ID" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="input-field" />
                  <input required placeholder="Medicine ID" value={form.medicine_id} onChange={e => setForm(f => ({ ...f, medicine_id: e.target.value }))} className="input-field" />
                  <input placeholder="Prescribed By" value={form.prescribed_by} onChange={e => setForm(f => ({ ...f, prescribed_by: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <input type="date" value={form.date_issued} onChange={e => setForm(f => ({ ...f, date_issued: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            </div>
          )}
          <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Medicine</th>
                  <th>Prescribed By</th>
                  <th>Date Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((prescription) => (
                  <tr key={prescription.prescription_id} className="hover:bg-gray-50">
                    <td className="font-medium">#{prescription.prescription_id}</td>
                    <td>{prescription.customer_name || 'N/A'}</td>
                    <td>{prescription.medicine_name}</td>
                    <td>{prescription.prescribed_by}</td>
                    <td>{new Date(prescription.date_issued).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${prescription.is_fulfilled ? 'badge-success' : 'badge-warning'}`}>
                        {prescription.is_fulfilled ? 'Fulfilled' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export default Prescriptions;
