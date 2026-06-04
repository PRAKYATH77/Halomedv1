import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPinned, Navigation, ArrowLeft, Truck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customerOrdersAPI } from '../services/api';
import TrackingMap from '../components/TrackingMap';

const DELIVERY_HUB = {
  lat: 12.9716,
  lng: 77.5946,
};

const DELIVERY_SIMULATION_DURATION_SECONDS = 300;
const DELIVERY_SIMULATION_STEP_SECONDS = 10;
const DELIVERY_SIMULATION_STEPS = DELIVERY_SIMULATION_DURATION_SECONDS / DELIVERY_SIMULATION_STEP_SECONDS;

const hashString = (value = '') => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const roundCoordinate = (value) => Number(value.toFixed(6));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildTrackingRoute = (order) => {
  const seed = `${order.order_id}-${order.delivery_address || ''}-${order.city || ''}-${order.zip_code || ''}`;
  const hash = hashString(seed);
  const latOffset = 0.018 + (hash % 700) / 100000;
  const lngOffset = 0.018 + (Math.floor(hash / 700) % 700) / 100000;
  const latDirection = hash % 2 === 0 ? 1 : -1;
  const lngDirection = Math.floor(hash / 2) % 2 === 0 ? 1 : -1;

  return {
    origin: DELIVERY_HUB,
    destination: {
      lat: roundCoordinate(DELIVERY_HUB.lat + latDirection * latOffset),
      lng: roundCoordinate(DELIVERY_HUB.lng + lngDirection * lngOffset),
    },
  };
};

const interpolatePoint = (start, end, progress) => ({
  lat: start.lat + (end.lat - start.lat) * progress,
  lng: start.lng + (end.lng - start.lng) * progress,
});

const getTrackingSnapshot = (order) => {
  if (!['out_for_delivery', 'received'].includes(order.status)) {
    return null;
  }

  const { origin, destination } = buildTrackingRoute(order);
  const approvedAt = order.approved_for_delivery_at ? new Date(order.approved_for_delivery_at).getTime() : null;
  const elapsedSeconds = approvedAt ? Math.max(0, (Date.now() - approvedAt) / 1000) : 0;
  const stepsCompleted = order.status === 'received'
    ? DELIVERY_SIMULATION_STEPS
    : clamp(Math.floor(elapsedSeconds / DELIVERY_SIMULATION_STEP_SECONDS), 0, DELIVERY_SIMULATION_STEPS);
  const progress = DELIVERY_SIMULATION_STEPS === 0 ? 0 : stepsCompleted / DELIVERY_SIMULATION_STEPS;
  const courierPosition = order.status === 'received'
    ? destination
    : interpolatePoint(origin, destination, progress);
  const etaMinutes = order.status === 'received'
    ? 0
    : Math.max(0, Math.ceil((DELIVERY_SIMULATION_DURATION_SECONDS - elapsedSeconds) / 60));

  return {
    origin,
    destination,
    courierPosition,
    progress: Math.round(progress * 100),
    etaMinutes,
    liveLabel: order.status === 'received'
      ? 'Delivered'
      : progress >= 0.9
        ? 'Arriving now'
        : progress >= 0.6
          ? 'Near your area'
          : progress >= 0.25
            ? 'On the way'
            : 'Leaving the hub',
  };
};

// eslint-disable-next-line no-unused-vars
const renderTrackingMap = (order, overrideSnapshot = null) => {
  const snapshot = overrideSnapshot || getTrackingSnapshot(order);

  if (!snapshot) return null;

  const latPadding = 0.01;
  const lngPadding = 0.01;
  const minLat = Math.min(snapshot.origin.lat, snapshot.destination.lat) - latPadding;
  const maxLat = Math.max(snapshot.origin.lat, snapshot.destination.lat) + latPadding;
  const minLng = Math.min(snapshot.origin.lng, snapshot.destination.lng) - lngPadding;
  const maxLng = Math.max(snapshot.origin.lng, snapshot.destination.lng) + lngPadding;

  const projectPoint = (point) => ({
    x: ((point.lng - minLng) / (maxLng - minLng)) * 100,
    y: ((maxLat - point.lat) / (maxLat - minLat)) * 100,
  });

  const originPoint = projectPoint(snapshot.origin);
  const destinationPoint = projectPoint(snapshot.destination);
  const courierPoint = projectPoint(snapshot.courierPosition);
  const routeGradientId = `tracking-route-${order?.order_id || Math.random().toString(36).slice(2,8)}`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-100 min-h-[380px] shadow-lg">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.14) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_26%),radial-gradient(circle_at_80%_12%,rgba(96,165,250,0.2),transparent_22%),radial-gradient(circle_at_70%_82%,rgba(14,165,233,0.12),transparent_24%)]" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={routeGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <line
          x1={originPoint.x}
          y1={originPoint.y}
          x2={destinationPoint.x}
          y2={destinationPoint.y}
          stroke={`url(#${routeGradientId})`}
          strokeWidth="2.2"
          strokeDasharray="3 2"
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute left-4 top-4 rounded-2xl bg-white/90 backdrop-blur px-4 py-3 shadow-lg border border-sky-100 max-w-[260px]">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <MapPinned size={14} /> Live tracking
        </p>
          <p className="text-sm font-semibold text-gray-800 mt-1">{order?.delivery_address}</p>
        <p className="text-xs text-gray-500 mt-1">{order?.city} {order?.zip_code ? `• ${order.zip_code}` : ''}</p>
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${originPoint.x}%`, top: `${originPoint.y}%` }}
      >
        <div className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-semibold shadow-lg">
          Hub
        </div>
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${destinationPoint.x}%`, top: `${destinationPoint.y}%` }}
      >
        <div className="rounded-full bg-rose-600 text-white px-3 py-1 text-xs font-semibold shadow-lg">
          Your address
        </div>
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${courierPoint.x}%`, top: `${courierPoint.y}%` }}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full bg-blue-600 text-white p-2 shadow-xl ring-4 ring-white/60 animate-pulse">
            <Navigation size={16} className="rotate-45" />
          </div>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-blue-700 shadow-sm">
            Courier
          </span>
        </div>
      </div>

      <div className="absolute right-4 bottom-4 rounded-2xl bg-gray-900/90 text-white px-4 py-3 shadow-lg max-w-[220px]">
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Status</p>
          <p className="text-sm font-semibold mt-1">{snapshot.liveLabel}</p>
        <p className="text-xs text-white/70 mt-1">ETA: {snapshot.etaMinutes} min</p>
        <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            style={{ width: `${snapshot.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default function DeliveryTracking() {
  const { user } = useAuth();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [serverSnapshot, setServerSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isCustomer = user?.role === 'customer';

  const fetchOrder = async () => {
    try {
      const response = await customerOrdersAPI.getById(orderId);
      setOrder(response.data || response);
      setError('');
    } catch (fetchError) {
      setError(fetchError?.message || 'Failed to load tracking details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    const refreshInterval = setInterval(() => {
      fetchOrder();
    }, 10000);

    const trackingInterval = setInterval(() => {
      fetchServerTracking();
    }, 10000);

    // initial tracking fetch
    fetchServerTracking();

    return () => {
      clearInterval(refreshInterval);
      clearInterval(trackingInterval);
    };
  }, [orderId]);

  const fetchServerTracking = async () => {
    try {
      const res = await customerOrdersAPI.getTracking(orderId);
      // API returns { available: boolean, snapshot }
      const payload = res.data || res;
      if (payload && payload.available && payload.snapshot) {
        setServerSnapshot(payload.snapshot);
      } else {
        setServerSnapshot(null);
      }
    } catch (err) {
      // On failure, clear server snapshot so client simulation remains fallback
      setServerSnapshot(null);
    }
  };

  const handleReceived = async () => {
    try {
      await fetch(`${customerOrdersAPI.getById(orderId).config?.baseURL || ''}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: 'received' }),
      });

      await fetchOrder();
    } catch (receivedError) {
      setError(receivedError?.message || 'Failed to mark order as received');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Delivery Tracking</h1>
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">Loading tracking details...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-5xl mx-auto">
          <Link to="/orders" className="inline-flex items-center gap-2 text-blue-700 font-semibold mb-6">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center text-red-600 font-semibold">{error || 'Order not found'}</div>
        </div>
      </div>
    );
  }

  const allowReceive = isCustomer && order.status === 'out_for_delivery';
  const effectiveSnapshot = serverSnapshot || getTrackingSnapshot(order);
  const trackingUnlockedForCustomer = !isCustomer || ['out_for_delivery', 'received'].includes(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <Link to="/orders" className="inline-flex items-center gap-2 text-blue-700 font-semibold mb-3">
              <ArrowLeft size={16} /> Back to Orders
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">Delivery Tracking</h1>
            <p className="text-gray-600 mt-1">Follow the simulated courier route and confirm receipt when it arrives.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm border border-gray-200">
            <Truck size={18} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-700 capitalize">{order.status.replaceAll('_', ' ')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6">
          <div>
            {trackingUnlockedForCustomer ? (
              <TrackingMap snapshot={effectiveSnapshot} />
            ) : (
              <div className="rounded-3xl border border-gray-200 bg-white shadow-lg p-8">
                <h2 className="text-xl font-bold text-gray-900">Tracking not started yet</h2>
                <p className="text-gray-600 mt-2">
                  You’ll see the delivery partner’s live location here after the delivery store clicks
                  <span className="font-semibold"> Start Delivery</span>.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-[0.2em]">Order</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-2">#{order.order_id}</h2>
              <p className="text-gray-600 mt-2">{order.delivery_address}</p>
              <p className="text-gray-500 text-sm mt-1">{order.city} {order.zip_code ? `• ${order.zip_code}` : ''}</p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-[0.2em]">Live ETA</p>
              <p className="text-4xl font-black text-blue-700 mt-2">
                {order.status === 'received' ? 'Delivered' : `${effectiveSnapshot?.etaMinutes ?? '—'} min`}
              </p>
            </div>

            {allowReceive && (
              <button
                onClick={handleReceived}
                className="w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Mark as Received
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
