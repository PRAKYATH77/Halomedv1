import React, { useEffect, useState } from 'react';
import { prescriptionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list'); // 'list', 'upload', 'create'
  const { user } = useAuth();

  // Upload form for customers
  const [uploadForm, setUploadForm] = useState({
    prescription_document: null,
    notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const isCustomer = user?.role === 'customer';

  // Admin should not see prescriptions
  if (user?.role === 'admin') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
        <div className="p-6 bg-white rounded shadow">Prescriptions are not visible to admin users.</div>
      </div>
      );
    }

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadForm.prescription_document) {
          alert('Please select a file to upload');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('file', uploadForm.prescription_document);
          formData.append('notes', uploadForm.notes);

          setIsUploading(true);
          setUploadProgress(0);

          await prescriptionsAPI.upload(formData, (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            setUploadProgress(percent);
          });

          alert('Prescription document uploaded successfully. Our pharmacy team will review it shortly.');
          setTab('list');
          setUploadForm({ prescription_document: null, notes: '' });
          fetchPrescriptions();
        } catch (err) {
          console.error('Failed to upload prescription:', err);
          alert('Failed to upload prescription');
        } finally {
          setUploadProgress(null);
          setIsUploading(false);
        }
      };

  // Staff/admin fulfillment removed — staff can only view prescriptions

  const handleRefill = async (prescriptionId) => {
    if (!window.confirm('Request a refill for this prescription?')) return;
    
    try {
      // For now, this is a placeholder - you would need to add a refill endpoint
      alert('Refill request submitted. Our pharmacy team will contact you soon.');
      // In a real app, you'd call an API endpoint to request a refill
    } catch (err) {
      console.error('Failed to request refill:', err);
      alert('Failed to request refill');
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

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setTab('list')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Prescriptions
          </button>
          
          {isCustomer && (
            <button
              onClick={() => setTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload Prescription
            </button>
          )}

          {/* Create tab removed — only customers can upload prescriptions */}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading prescriptions...</div>
      ) : (
        <>
          {/* Upload Prescription Tab */}
          {tab === 'upload' && isCustomer && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Prescription</h2>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prescription Document *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => setUploadForm(f => ({ ...f, prescription_document: e.target.files[0] }))}
                    className="input-field"
                  />
                  <p className="text-xs text-gray-500 mt-2">Accepted formats: PDF, JPG, PNG, GIF (Max 5MB)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    placeholder="Any additional notes or requirements..."
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field"
                    rows="4"
                  />
                </div>
                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary" disabled={isUploading}>Upload</button>
                  <button 
                    type="button" 
                    onClick={() => setTab('list')}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
                {isUploading && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600 mb-1">Uploading: {uploadProgress}%</div>
                    <div className="w-full bg-gray-200 rounded h-3">
                      <div className="bg-blue-600 h-3 rounded" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Create Prescription Tab (Staff/Admin) */}
          {/* Create tab removed: staff/admin cannot create/upload prescriptions via UI */}

          {/* Prescriptions List Tab */}
          {tab === 'list' && (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="bg-gray-100">
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Medicine</th>
                      <th>Prescribed By</th>
                      <th>Dosage</th>
                      <th>Quantity</th>
                      <th>Date Issued</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-gray-500">
                          No prescriptions found
                        </td>
                      </tr>
                    ) : (
                      prescriptions.map((prescription) => (
                        <tr key={prescription.prescription_id} className="hover:bg-gray-50">
                          <td className="font-medium">#{prescription.prescription_id}</td>
                          <td>{prescription.customer_name || 'N/A'}</td>
                          <td>{prescription.medicine_name}</td>
                          <td>{prescription.prescribed_by}</td>
                          <td>{prescription.dosage || '-'}</td>
                          <td>{prescription.quantity}</td>
                          <td>{new Date(prescription.date_issued).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${prescription.is_fulfilled ? 'badge-success' : 'badge-warning'}`}>
                              {prescription.is_fulfilled ? 'Fulfilled' : 'Pending'}
                            </span>
                          </td>
                          <td className="space-x-2">
                            {isCustomer && !prescription.is_fulfilled && (
                              <button
                                onClick={() => handleRefill(prescription.prescription_id)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                Refill
                              </button>
                            )}
                            {prescription.is_fulfilled && (
                              <span className="text-gray-500 text-sm">—</span>
                            )}
                            {!isCustomer && (
                              <span className="text-sm text-gray-500">View only</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Prescriptions;

