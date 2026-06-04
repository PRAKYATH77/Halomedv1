import React, { useEffect, useMemo, useState } from 'react';
import { restockRequestsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Package, Truck, CheckCircle2, Clock3 } from 'lucide-react';
import TrackingMap from '../components/TrackingMap';
import { buildRestockTrackingSnapshot } from '../utils/restockTracking';

function SupplierTasks() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const counts = useMemo(() => {
    const assigned = requests.filter((request) => request.supplier_status === 'assigned' || !request.supplier_status).length;
    const outForDelivery = requests.filter((request) => request.supplier_status === 'out_for_delivery').length;
    const delivered = requests.filter((request) => request.supplier_status === 'delivered').length;

    return { assigned, outForDelivery, delivered };
  }, [requests]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await restockRequestsAPI.getSupplierMine();
      setRequests(response.data || []);
      setSelectedRequestId((current) => current || response.data?.[0]?.request_id || null);
    } catch (error) {
      console.error('Failed to load supplier requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRequest = requests.find((request) => request.request_id === selectedRequestId) || requests[0] || null;
  const trackingSnapshot = buildRestockTrackingSnapshot(selectedRequest);

  const updateStatus = async (requestId, type) => {
    setActionId(requestId);
    try {
      if (type === 'out') {
        await restockRequestsAPI.supplierOutForDelivery(requestId);
      } else {
        await restockRequestsAPI.supplierMarkDelivered(requestId);
      }

      await fetchRequests();
    } catch (error) {
      console.error('Failed to update supplier status:', error);
      alert(error?.message || 'Failed to update status');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading supplier tasks...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supplier Tasks</h1>
          <p className="text-gray-600 mt-2">
            Review the restock requests assigned to you and update delivery status.
          </p>
        </div>
        <div className="card min-w-[220px]">
          <p className="text-sm text-gray-600">Signed in as</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{user?.username}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-gray-600">
            <ClipboardList size={18} />
            <span className="text-sm font-medium">Assigned</span>
          </div>
          <p className="text-3xl font-bold text-primary mt-2">{counts.assigned}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-gray-600">
            <Truck size={18} />
            <span className="text-sm font-medium">Out for Delivery</span>
          </div>
          <p className="text-3xl font-bold text-primary mt-2">{counts.outForDelivery}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Delivered</span>
          </div>
          <p className="text-3xl font-bold text-primary mt-2">{counts.delivered}</p>
        </div>
      </div>

      {trackingSnapshot && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Supplier Route Monitor</h2>
              <p className="text-sm text-gray-600">Road route from supplier to delivery store.</p>
            </div>
            {requests.length > 1 && (
              <select
                className="input-field max-w-xs"
                value={selectedRequestId || ''}
                onChange={(event) => setSelectedRequestId(Number(event.target.value))}
              >
                {requests.map((request) => (
                  <option key={request.request_id} value={request.request_id}>
                    #{request.request_id} - {request.medicine_name || `Medicine #${request.medicine_id}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <TrackingMap snapshot={trackingSnapshot} height={380} />
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Package className="text-primary" size={20} />
          <h2 className="text-xl font-semibold">Assigned Requests</h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No requests assigned to you yet.</p>
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
                {requests.map((request) => {
                  const canMoveToOut = !request.supplier_status || request.supplier_status === 'assigned';
                  const canMarkDelivered = request.supplier_status === 'out_for_delivery';

                  return (
                    <tr key={request.request_id} className="hover:bg-gray-50">
                      <td className="font-medium">#{request.request_id}</td>
                      <td>
                        <div>
                          <div className="font-medium">{request.medicine_name || `Medicine #${request.medicine_id}`}</div>
                          {request.notes && <div className="text-xs text-gray-500 mt-1">{request.notes}</div>}
                        </div>
                      </td>
                      <td>{request.requested_by_username || '—'}</td>
                      <td>{request.quantity_requested}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="badge badge-success">{request.status}</span>
                          <span className="text-xs text-gray-600 capitalize">
                            Supplier: {request.supplier_status || 'assigned'}
                          </span>
                        </div>
                      </td>
                      <td>{new Date(request.created_at).toLocaleString()}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          {canMoveToOut && (
                            <button
                              type="button"
                              className="btn-primary inline-flex items-center gap-2"
                              onClick={() => updateStatus(request.request_id, 'out')}
                              disabled={actionId === request.request_id}
                            >
                              <Clock3 size={16} />
                              Out for Delivery
                            </button>
                          )}
                          {canMarkDelivered && (
                            <button
                              type="button"
                              className="px-4 py-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 inline-flex items-center gap-2"
                              onClick={() => updateStatus(request.request_id, 'delivered')}
                              disabled={actionId === request.request_id}
                            >
                              <CheckCircle2 size={16} />
                              Mark Delivered
                            </button>
                          )}
                          {!canMoveToOut && !canMarkDelivered && (
                            <span className="text-sm text-gray-500">No action available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierTasks;