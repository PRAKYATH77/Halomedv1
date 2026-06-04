import React, { useState } from 'react';
import { customerOrdersAPI } from '../services/api';
import TrackingMap from '../components/TrackingMap';

export default function AdminTracking() {
  const [orderId, setOrderId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);

  const loadSimulated = async () => {
    setMessage(null);
    setSnapshot(null);
    if (!orderId) return setMessage({ type: 'error', text: 'Order ID is required' });

    setLoading(true);
    try {
      const res = await customerOrdersAPI.getTracking(orderId);
      const payload = res.data || res;
      if (payload?.available && payload?.snapshot) {
        setSnapshot(payload.snapshot);
        setLat(String(payload.snapshot.courierPosition?.lat ?? ''));
        setLng(String(payload.snapshot.courierPosition?.lng ?? ''));
        setProgress(String(payload.snapshot.progress ?? ''));
      } else {
        setMessage({ type: 'error', text: 'Tracking not available for this order yet' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || JSON.stringify(err) });
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!orderId) return setMessage({ type: 'error', text: 'Order ID is required' });
    const payload = {};
    if (lat) payload.courier_lat = Number(lat);
    if (lng) payload.courier_lng = Number(lng);
    if (progress !== '') payload.progress = Number(progress);

    setLoading(true);
    try {
      await customerOrdersAPI.updateTracking(orderId, payload);
      setMessage({ type: 'success', text: 'Tracking updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || JSON.stringify(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Admin Tracking</h2>
      <form onSubmit={submit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700">Order ID</label>
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} className="mt-1 block w-full border p-2 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Courier Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 block w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Courier Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1 block w-full border p-2 rounded" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Progress (0-100)</label>
          <input value={progress} onChange={(e) => setProgress(e.target.value)} className="mt-1 block w-32 border p-2 rounded" />
        </div>

        <div>
          <button disabled={loading} className="px-4 py-2 bg-primary text-white rounded">{loading ? 'Updating...' : 'Update Tracking'}</button>
          <button
            type="button"
            disabled={loading}
            onClick={loadSimulated}
            className="ml-3 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? 'Loading...' : 'Load simulated route'}
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.text}
          </div>
        )}
      </form>

      {snapshot && (
        <div className="mt-6 max-w-3xl">
          <TrackingMap snapshot={snapshot} height={380} />
        </div>
      )}
    </div>
  );
}
