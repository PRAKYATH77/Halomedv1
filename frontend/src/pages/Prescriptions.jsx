import React, { useEffect, useState } from 'react';
import { prescriptionsAPI } from '../services/api';

function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

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
      )}
    </div>
  );
}

export default Prescriptions;
