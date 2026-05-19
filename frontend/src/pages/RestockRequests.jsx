import React, { useEffect, useMemo, useState } from 'react';
import { medicinesAPI, restockRequestsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, CheckCircle2, PackageOpen, Send, XCircle } from 'lucide-react';

function RestockRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canRequest = ['admin', 'staff'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ medicine_id: '', quantity_requested: '', notes: '' });

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'pending').length,
    [requests]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const requestsPromise = isAdmin ? restockRequestsAPI.getAll() : restockRequestsAPI.getMine();
      const [requestsRes, lowStockRes] = await Promise.all([
        requestsPromise,
        medicinesAPI.getLowStock(),
      ]);

      setRequests(requestsRes.data || []);
      setLowStock(lowStockRes.data || []);
      if (isAdmin) {
        const sres = await usersAPI.getSuppliers();
        setSuppliers(sres.data || []);
      }
    } catch (error) {
      console.error('Failed to load restock requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await restockRequestsAPI.create({
        medicine_id: Number(form.medicine_id),
        quantity_requested: Number(form.quantity_requested),
        notes: form.notes,
      });
      setForm({ medicine_id: '', quantity_requested: '', notes: '' });
      await fetchData();
      alert('Restock request submitted');
    } catch (error) {
      console.error('Failed to create restock request:', error);
      alert(error?.message || 'Failed to submit restock request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    setActionId(id);
    try {
      if (action === 'approve') {
        await restockRequestsAPI.approve(id);
      } else {
        await restockRequestsAPI.reject(id);
      }
      await fetchData();
      alert(`Request ${action}d`);
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      alert(error?.message || `Failed to ${action} request`);
    } finally {
      setActionId(null);
    }
  };

  const handleAssignSupplier = async (requestId, supplierId) => {
    try {
      await restockRequestsAPI.assignSupplier(requestId, supplierId);
      await fetchData();
      alert('Supplier assigned');
    } catch (err) {
      console.error(err);
      alert('Failed to assign supplier');
    }
  };

  const handleSupplierAction = async (requestId, type) => {
    try {
      if (type === 'out') await restockRequestsAPI.supplierOutForDelivery(requestId);
      if (type === 'delivered') await restockRequestsAPI.supplierMarkDelivered(requestId);
      await fetchData();
      alert('Status updated');
    } catch (err) {
      console.error(err);
      alert('Failed to update supplier status');
    }
  };

  const handleDeliveryStoreConfirm = async (requestId) => {
    try {
      await restockRequestsAPI.deliveryStoreConfirm(requestId);
      await fetchData();
      alert('Receipt confirmed');
    } catch (err) {
      console.error(err);
      alert('Failed to confirm receipt');
    }
  };

  const statusClass = {
    pending: 'badge badge-warning',
    approved: 'badge badge-success',
    rejected: 'badge badge-error',
  };

  if (loading) {
    return <div className="text-center py-12">Loading restock requests...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restock Requests</h1>
          <p className="text-gray-600 mt-2">
            {isAdmin
              ? 'Review staff requests and approve or reject them.'
              : 'Submit stock requests when medicines run low and track their status.'}
          </p>
        </div>
        <div className="card min-w-[220px]">
          <p className="text-sm text-gray-600">Pending requests</p>
          <p className="text-3xl font-bold text-primary mt-1">{pendingCount}</p>
        </div>
      </div>

      {canRequest && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Send className="text-primary" size={20} />
            <h2 className="text-xl font-semibold">Create Restock Request</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                className="input-field"
                placeholder="Medicine ID"
                value={form.medicine_id}
                onChange={(event) => setForm((current) => ({ ...current, medicine_id: event.target.value }))}
                required
              />
              <input
                className="input-field"
                type="number"
                min="1"
                placeholder="Quantity requested"
                value={form.quantity_requested}
                onChange={(event) => setForm((current) => ({ ...current, quantity_requested: event.target.value }))}
                required
              />
              <input
                className="input-field"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            {lowStock.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3 text-yellow-800">
                  <AlertTriangle size={18} />
                  <p className="font-semibold">Low stock medicines</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lowStock.slice(0, 8).map((medicine) => (
                    <button
                      key={medicine.medicine_id}
                      type="button"
                      className="px-3 py-2 rounded-full bg-white border border-yellow-200 text-sm hover:bg-yellow-100"
                      onClick={() => setForm((current) => ({ ...current, medicine_id: String(medicine.medicine_id) }))}
                    >
                      #{medicine.medicine_id} {medicine.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <PackageOpen className="text-primary" size={20} />
          <h2 className="text-xl font-semibold">{isAdmin ? 'All Requests' : 'My Requests'}</h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No restock requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>ID</th>
                  <th>Medicine</th>
                  <th>Requested By</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.request_id} className="hover:bg-gray-50">
                    <td className="font-medium">#{request.request_id}</td>
                    <td>
                      <div>
                        <div className="font-medium">{request.medicine_name || `Medicine #${request.medicine_id}`}</div>
                        {request.notes && <div className="text-xs text-gray-500 mt-1">{request.notes}</div>}
                      </div>
                    </td>
                    <td>{request.requested_by_username || 'Me'}</td>
                    <td>{request.quantity_requested}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={statusClass[request.status] || 'badge'}>{request.status}</span>
                        {request.supplier_status && (
                          <span className="text-xs text-gray-600">Supplier: {request.supplier_status}</span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(request.created_at).toLocaleString()}</td>
                    <td>
                      {isAdmin && request.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary inline-flex items-center gap-2"
                            onClick={() => handleAction(request.request_id, 'approve')}
                            disabled={actionId === request.request_id}
                          >
                            <CheckCircle2 size={16} />
                            Approve
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-2"
                            onClick={() => handleAction(request.request_id, 'reject')}
                            disabled={actionId === request.request_id}
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      ) : isAdmin && request.status === 'approved' ? (
                        <div className="flex flex-col gap-2">
                          {request.supplier_id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Assigned to: {request.supplier_username || request.supplier_id}</span>
                              <button className="btn-sm" onClick={() => handleSupplierAction(request.request_id, 'out')}>Mark Out For Delivery</button>
                              <button className="btn-sm" onClick={() => handleSupplierAction(request.request_id, 'delivered')}>Mark Delivered</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select defaultValue="" className="input-field" onChange={(e) => handleAssignSupplier(request.request_id, Number(e.target.value))}>
                                <option value="">Assign Supplier</option>
                                {suppliers.map((s) => (
                                  <option key={s.user_id} value={s.user_id}>{s.username}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : user?.role === 'delivery_store' && request.supplier_status === 'delivered' && !request.delivery_store_received_at ? (
                        <div>
                          <button className="btn-primary" onClick={() => handleDeliveryStoreConfirm(request.request_id)}>Confirm Received</button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">{request.admin_username || '—'}</span>
                      )}
                    </td>
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

export default RestockRequests;