import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle, Truck, Edit2, MapPinned, Navigation } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, customerOrdersAPI, deliveryStoresAPI } from '../services/api';

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
const renderTrackingMap = (order) => {
  const snapshot = getTrackingSnapshot(order);

  if (!snapshot) {
    return null;
  }

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
  const routeGradientId = `route-gradient-${order.order_id}`;

  return (
    <div className="mt-6 pt-6 border-t">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPinned size={16} /> Live Delivery Map
          </p>
          <p className="text-xs text-gray-500">Simulated courier movement refreshes every 10 seconds.</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-sky-100 text-sky-700">
          {snapshot.liveLabel}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-100 min-h-[280px] shadow-inner">
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

        <div className="absolute left-4 top-4 rounded-2xl bg-white/90 backdrop-blur px-4 py-3 shadow-lg border border-sky-100 max-w-[220px]">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Live tracking</p>
          <p className="text-sm font-semibold text-gray-800 mt-1">{order.delivery_address}</p>
          <p className="text-xs text-gray-500 mt-1">{order.city} {order.zip_code ? `• ${order.zip_code}` : ''}</p>
        </div>

        <div className="absolute right-4 bottom-4 rounded-2xl bg-gray-900/90 text-white px-4 py-3 shadow-lg max-w-[200px]">
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
    </div>
  );
};

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [deliveryStores, setDeliveryStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingStatus, setEditingStatus] = useState('');
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentOtp, setPaymentOtp] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentChallengeCode, setPaymentChallengeCode] = useState('');
  const isCustomer = user?.role === 'customer';
  const isDeliveryStore = user?.role === 'delivery_store';
  const canManageOrders = ['admin', 'staff'].includes(user?.role);
  const canAssignOrders = ['admin', 'staff'].includes(user?.role);

  useEffect(() => {
    fetchOrders();
    if (canAssignOrders) {
      fetchDeliveryStores();
    }

    const refreshInterval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, []);

  const fetchDeliveryStores = async () => {
    try {
      const response = await deliveryStoresAPI.getAll();
      setDeliveryStores(response.data || []);
    } catch (error) {
      console.error('Error fetching delivery stores:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch orders (${response.status})`);
      }

      const data = await response.json();
      setOrders(data.data || data);
      setAssignmentDrafts((prev) => {
        const next = { ...prev };
        (data.data || data).forEach((order) => {
          if (order.assigned_delivery_store_id && !next[order.order_id]) {
            next[order.order_id] = String(order.assigned_delivery_store_id);
          }
        });
        return next;
      });
      setError('');
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.message || 'Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.order_id === orderId ? { ...order, status: newStatus } : order
        )
      );

      setEditingOrderId(null);
      setEditingStatus('');
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  const handleAssignDeliveryStore = async (orderId) => {
    const deliveryStoreId = assignmentDrafts[orderId];

    if (!deliveryStoreId) {
      alert('Choose a delivery store first');
      return;
    }

    try {
      await customerOrdersAPI.assignDeliveryStore(orderId, parseInt(deliveryStoreId, 10));
      await fetchOrders();
    } catch (error) {
      console.error('Error assigning delivery store:', error);
      alert('Failed to assign delivery store');
    }
  };

  const handleApproveDelivery = async (orderId) => {
    try {
      await customerOrdersAPI.approveForDelivery(orderId);
      await fetchOrders();
    } catch (error) {
      console.error('Error approving delivery:', error);
      alert('Failed to approve delivery');
    }
  };
  const handleSimulatedPayment = async (order) => {
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setPaymentOrder(order);
    setPaymentOtp('');
    setPaymentError('');
    setPaymentChallengeCode(generatedOtp);
  };

  const closePaymentModal = () => {
    if (paymentProcessing) {
      return;
    }

    setPaymentOrder(null);
    setPaymentOtp('');
    setPaymentError('');
    setPaymentChallengeCode('');
  };

  const submitPayment = async () => {
    if (!paymentOrder) {
      return;
    }

    if (paymentOtp.trim() !== paymentChallengeCode) {
      setPaymentError('Incorrect OTP. Payment not processed.');
      return;
    }

    try {
      setPaymentProcessing(true);
      setPaymentError('');
      await customerOrdersAPI.pay(paymentOrder.order_id, {
        transactionId: `SIMULATED_${Date.now()}`,
      });

      setPaymentOrder(null);
      setPaymentOtp('');
      setPaymentChallengeCode('');
      await fetchOrders();
    } catch (error) {
      console.error('Error processing simulated payment:', error);
      alert(error.message || 'Failed to process payment');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock size={24} className="text-yellow-600" />;
      case 'confirmed':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'assigned':
        return <Truck size={24} className="text-indigo-600" />;
      case 'out_for_delivery':
        return <Truck size={24} className="text-blue-600" />;
      case 'received':
        return <CheckCircle size={24} className="text-green-600" />;
      default:
        return <Package size={24} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'confirmed':
        return 'bg-green-50 border-green-200';
      case 'assigned':
        return 'bg-indigo-50 border-indigo-200';
      case 'out_for_delivery':
        return 'bg-blue-50 border-blue-200';
      case 'received':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getPageTitle = () => {
    if (isCustomer) return 'My Orders';
    if (isDeliveryStore) return 'Delivery Tasks';
    return 'Customer Orders';
  };

  const getStatusLabel = () => {
    if (isCustomer) return 'Status';
    return 'Delivery Status';
  };

  const timelineSteps = ['pending', 'confirmed', 'assigned', 'out_for_delivery', 'received'];

  const getStepLabel = (status) => {
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      assigned: 'Assigned',
      out_for_delivery: 'Out for Delivery',
      received: 'Received',
    };

    return labels[status] || status;
  };

  const getStepState = (orderStatus, stepStatus) => {
    if (orderStatus === 'cancelled') {
      return 'cancelled';
    }

    const orderIndex = timelineSteps.indexOf(orderStatus);
    const stepIndex = timelineSteps.indexOf(stepStatus);

    if (stepIndex < orderIndex) return 'done';
    if (stepIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  const getStepClass = (state) => {
    if (state === 'done') return 'bg-green-600 border-green-600 text-white';
    if (state === 'current') return 'bg-blue-600 border-blue-600 text-white';
    if (state === 'cancelled') return 'bg-red-100 border-red-200 text-red-500';
    return 'bg-white border-gray-300 text-gray-500';
  };

  const getConnectorClass = (state) => {
    if (state === 'done') return 'bg-green-500';
    if (state === 'cancelled') return 'bg-red-200';
    return 'bg-gray-300';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {getPageTitle()}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-500 mt-4">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {getPageTitle()}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-red-600 font-semibold">{error}</p>
            <button 
              onClick={fetchOrders}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {getPageTitle()}
          </h1>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Package size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No orders yet</p>
            {user?.role === 'customer' && (
              <a
                href="/dashboard"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                Start Shopping
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">{getPageTitle()}</h1>

        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.order_id}
              className={`border-2 rounded-lg shadow-lg overflow-hidden ${getStatusColor(order.status)}`}
            >
              {/* Order Header */}
              <div className="p-6 bg-white border-b flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <h3 className="text-xl font-bold text-gray-800">#{order.order_id}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="text-sm text-gray-600">{getStatusLabel()}</p>
                    {canManageOrders && editingOrderId === order.order_id ? (
                      <select
                        value={editingStatus}
                        onChange={(e) => setEditingStatus(e.target.value)}
                        className="text-lg font-semibold bg-white border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="assigned">Assigned</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <p className="text-lg font-semibold text-gray-800 capitalize">{order.status}</p>
                    )}
                  </div>
                  {canManageOrders && editingOrderId === order.order_id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusUpdate(order.order_id, editingStatus)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingOrderId(null)}
                        className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : canManageOrders ? (
                    <button
                      onClick={() => {
                        setEditingOrderId(order.order_id);
                        setEditingStatus(order.status);
                      }}
                      className="p-2 hover:bg-blue-100 rounded transition"
                    >
                      <Edit2 size={18} className="text-blue-600" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Order Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Order Date</p>
                    <p className="text-gray-800">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Total Amount</p>
                    <p className="text-xl font-bold text-blue-600">₹{Number(order.total_amount || 0).toFixed(2)}</p>
                  </div>
                  {user?.role !== 'customer' && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Customer Phone</p>
                        <p className="text-gray-800">{order.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Payment Method</p>
                        <p className="text-gray-800 capitalize">{order.payment_method?.replace('_', ' ')}</p>
                      </div>
                    </>
                  )}
                  {canManageOrders && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-2">Delivery Store</p>
                      <p className="text-gray-800">
                        {order.delivery_store_name || (order.assigned_delivery_store_id ? `#${order.assigned_delivery_store_id}` : 'Unassigned')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Delivery Address</p>
                    <p className="text-gray-800">{order.delivery_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">City</p>
                    <p className="text-gray-800">{order.city}</p>
                  </div>
                </div>

                <div className="mt-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Delivery Timeline</p>
                    {order.status === 'cancelled' && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px] flex items-center">
                      {timelineSteps.map((step, index) => {
                        const state = getStepState(order.status, step);
                        const isLast = index === timelineSteps.length - 1;
                        const connectorState =
                          order.status === 'cancelled'
                            ? 'cancelled'
                            : getStepState(order.status, timelineSteps[index + 1]);

                        return (
                          <div key={step} className="flex items-center flex-1 min-w-[120px]">
                            <div className="flex flex-col items-center text-center">
                              <div
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${getStepClass(state)}`}
                              >

                          {['out_for_delivery', 'received'].includes(order.status) && renderTrackingMap(order)}
                                {index + 1}
                              </div>
                              <p className="text-xs mt-2 text-gray-700">{getStepLabel(step)}</p>
                            </div>
                            {!isLast && (
                              <div className={`h-1 flex-1 mx-2 rounded ${getConnectorClass(connectorState)}`}></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {['out_for_delivery', 'received'].includes(order.status) && (
                  <div className="mt-6 pt-6 border-t flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Live tracking available</p>
                      <p className="text-xs text-gray-500">Open the dedicated delivery map to follow the courier.</p>
                    </div>
                    <Link
                      to={`/tracking/${order.order_id}`}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                      <MapPinned size={16} />
                      Track Delivery
                    </Link>
                  </div>
                )}

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm text-gray-600 font-semibold mb-3">Items Ordered</p>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-gray-700 text-sm"
                        >
                          <span>{item.medicine_name || item.name} x {item.quantity}</span>
                          <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin/staff actions */}
                {canManageOrders && order.status === 'confirmed' && (
                  <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 font-semibold mb-2">Assign Delivery Store</p>
                      <select
                        value={assignmentDrafts[order.order_id] || order.assigned_delivery_store_id || ''}
                        onChange={(e) =>
                          setAssignmentDrafts((prev) => ({
                            ...prev,
                            [order.order_id]: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="">Select a delivery store</option>
                        {deliveryStores.map((store) => (
                          <option key={store.user_id} value={store.user_id}>
                            {store.username} {store.email ? `(${store.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleAssignDeliveryStore(order.order_id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition"
                    >
                      Assign Store
                    </button>
                  </div>
                )}

                {isDeliveryStore && order.status === 'assigned' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <button
                      onClick={() => handleApproveDelivery(order.order_id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Start Delivery (Share live location)
                    </button>
                  </div>
                )}

                {isCustomer && order.status === 'out_for_delivery' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    {(() => {
                      const snapshot = getTrackingSnapshot(order);
                      const isArrived = snapshot && snapshot.progress >= 100;
                      return (
                        <button
                          onClick={() => handleStatusUpdate(order.order_id, 'received')}
                          disabled={!isArrived}
                          className={`${
                            isArrived 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-gray-400 cursor-not-allowed'
                          } text-white font-semibold py-2 px-6 rounded-lg transition flex-1`}
                        >
                          {isArrived ? 'Mark as Received' : 'Waiting for Courier to Arrive...'}
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Admin/staff quick actions */}
                {canManageOrders && order.status === 'pending' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <button
                      onClick={() => handleStatusUpdate(order.order_id, 'confirmed')}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Confirm Order
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(order.order_id, 'cancelled')}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}

                {/* Customer simulated payment: allow paying only when pending and not COD */}
                {isCustomer && order.status === 'pending' && order.payment_method !== 'cod' && (
                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <button
                      onClick={() => handleSimulatedPayment(order)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition flex-1"
                    >
                      Pay Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
              <p className="text-sm uppercase tracking-[0.22em] text-white/80">Demo payment</p>
              <h2 className="text-2xl font-bold mt-1">Confirm order #{paymentOrder.order_id}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">OTP for demo verification</p>
                <p className="text-3xl font-black text-slate-900 mt-2">{paymentChallengeCode}</p>
                <p className="text-sm text-slate-500 mt-2">Enter the code above to complete the simulated payment.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="payment-otp">
                  Enter OTP
                </label>
                <input
                  id="payment-otp"
                  value={paymentOtp}
                  onChange={(e) => setPaymentOtp(e.target.value)}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg tracking-[0.4em] text-center font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="0000"
                />
              </div>

              {paymentError && (
                <p className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                  {paymentError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closePaymentModal}
                  disabled={paymentProcessing}
                  className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPayment}
                  disabled={paymentProcessing}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {paymentProcessing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

