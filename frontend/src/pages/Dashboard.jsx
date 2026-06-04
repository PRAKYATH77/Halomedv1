import React, { useEffect, useState } from 'react';
import { TrendingUp, Package, ShoppingCart, Users, AlertCircle, Activity, Filter, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { analyticsAPI, medicinesAPI, customerOrdersAPI } from '../services/api';

// ---- Customer Dashboard sub-component (hooks always at top level, no conditional) ----
function CustomerDashboard() {
  const { addToCart } = useCart();
  const [customerMedicines, setCustomerMedicines] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [addedItems, setAddedItems] = useState({});
  const [selectedCondition, setSelectedCondition] = useState('all');

  const healthConditions = [
    { id: 'all', name: 'All Medicines' },
    { id: 'fever', name: 'Fever & Pain' },
    { id: 'cold', name: 'Cold & Cough' },
    { id: 'digestion', name: 'Digestion' },
    { id: 'antibiotics', name: 'Antibiotics' },
    { id: 'vitamins', name: 'Vitamins' },
    { id: 'skin', name: 'Skin Care' },
  ];

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setCustomerLoading(true);
        const response = await medicinesAPI.getAll();
        setCustomerMedicines(response.data || []);
      } catch (error) {
        console.error('Failed to fetch medicines:', error);
      } finally {
        setCustomerLoading(false);
      }
    };
    fetchMedicines();
  }, []);

  const handleAddToCart = (medicine) => {
    addToCart(medicine);
    setAddedItems((prev) => ({ ...prev, [medicine.medicine_id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [medicine.medicine_id]: false }));
    }, 2000);
  };

  if (customerLoading) {
    return <div className="text-center py-12">Loading medicines...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Browse Medicines</h1>

      {/* Health Condition Filter */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter size={20} />
          Filter by Health Condition
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {healthConditions.map((condition) => (
            <button
              key={condition.id}
              onClick={() => setSelectedCondition(condition.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCondition === condition.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {condition.name}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customerMedicines.map((medicine) => (
          <div key={medicine.medicine_id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{medicine.name}</h3>
                <p className="text-sm text-gray-600 capitalize">{medicine.category}</p>
              </div>
            </div>

            {/* Stock Status */}
            <div className="mb-4">
              {medicine.stock_quantity > 0 ? (
                <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  In Stock
                </span>
              ) : (
                <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Price */}
            <div className="mb-6">
              <p className="text-3xl font-bold text-blue-600">₹{medicine.price}</p>
              <p className="text-sm text-gray-600">Price per unit</p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleAddToCart(medicine)}
              disabled={medicine.stock_quantity === 0}
              className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                addedItems[medicine.medicine_id]
                  ? 'bg-green-500 text-white'
                  : medicine.stock_quantity > 0
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ShoppingCart size={20} className="inline mr-2" />
              {addedItems[medicine.medicine_id] ? 'Added ✓' : 'Add to Cart'}
            </button>
          </div>
        ))}
      </div>

      {customerMedicines.length === 0 && (
        <div className="text-center py-12 text-gray-600">No medicines available</div>
      )}
    </div>
  );
}

// ---- Delivery Store Dashboard sub-component ----
function DeliveryStoreDashboard() {
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);

  useEffect(() => {
    const fetchDeliveryOrders = async () => {
      try {
        setDeliveryLoading(true);
        const response = await customerOrdersAPI.getAll();
        setDeliveryOrders(response.data || []);
      } catch (error) {
        console.error('Failed to fetch delivery orders:', error);
      } finally {
        setDeliveryLoading(false);
      }
    };
    fetchDeliveryOrders();
  }, []);

  const assignedCount = deliveryOrders.filter((o) => o.status === 'assigned').length;
  const outForDeliveryCount = deliveryOrders.filter((o) => o.status === 'out_for_delivery').length;
  const receivedCount = deliveryOrders.filter((o) => o.status === 'received').length;
  const recentOrders = [...deliveryOrders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const statusBadge = (status) => {
    if (status === 'assigned') return 'bg-indigo-100 text-indigo-800';
    if (status === 'out_for_delivery') return 'bg-blue-100 text-blue-800';
    if (status === 'received') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (deliveryLoading) {
    return <div className="text-center py-12">Loading delivery dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Delivery Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Assigned Orders</p>
          <p className="text-3xl font-bold text-indigo-600">{assignedCount}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Out For Delivery</p>
          <p className="text-3xl font-bold text-blue-600">{outForDeliveryCount}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Delivered To Customer</p>
          <p className="text-3xl font-bold text-green-600">{receivedCount}</p>
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/orders" className="p-4 bg-gradient-to-br from-indigo-50 to-blue-100 rounded-lg hover:shadow-md transition-shadow">
            <p className="font-semibold text-gray-800">Open Delivery Tasks</p>
            <p className="text-sm text-gray-600">Approve assigned orders and track active deliveries.</p>
          </a>
          <a href="/profile" className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg hover:shadow-md transition-shadow">
            <p className="font-semibold text-gray-800">My Profile</p>
            <p className="text-sm text-gray-600">Review your role and account details.</p>
          </a>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Delivery Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-600">No assigned orders yet.</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.order_id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-gray-800">Order #{order.order_id}</p>
                  <p className="text-sm text-gray-600">
                    {order.delivery_address}, {order.city}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                    {order.status}
                  </span>
                  <span className="text-sm text-gray-600">₹{Number(order.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Admin/Staff Dashboard sub-component ----
function AdminStaffDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await analyticsAPI.getDashboardStats();
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg text-white ${color}`}>
          <Icon size={24} />
        </div>
        <div className="ml-4">
          <p className="text-gray-600 text-sm">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value ?? '-'}</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard icon={Package} title="Total Medicines" value={stats?.total_medicines} color="bg-blue-500" />
        <StatCard icon={ShoppingCart} title="Total Sales" value={stats?.total_sales} color="bg-green-500" />
        <StatCard
          icon={TrendingUp}
          title="Total Revenue"
          value={`₹${parseFloat(stats?.total_revenue || 0).toLocaleString()}`}
          color="bg-purple-500"
        />
        <StatCard icon={Users} title="Total Customers" value={stats?.total_customers} color="bg-orange-500" />
        <StatCard icon={Activity} title="Total Suppliers" value={stats?.total_suppliers} color="bg-red-500" />
        <StatCard
          icon={AlertCircle}
          title="Stock Value"
          value={`₹${parseFloat(stats?.total_stock_value || 0).toLocaleString()}`}
          color="bg-yellow-500"
        />
        <StatCard icon={ShoppingCart} title="Total Orders" value={stats?.total_orders} color="bg-indigo-500" />
        <StatCard icon={Activity} title="Assigned Orders" value={stats?.assigned_orders} color="bg-teal-500" />
        <StatCard icon={TrendingUp} title="Out For Delivery" value={stats?.out_for_delivery_orders} color="bg-orange-400" />
        <StatCard icon={CheckCircle} title="Received Orders" value={stats?.received_orders} color="bg-emerald-500" />
        <StatCard icon={Users} title="Delivery Stores" value={stats?.delivery_stores} color="bg-slate-500" />
        <StatCard icon={AlertCircle} title="Low Stock Alerts" value={stats?.low_stock_medicines} color="bg-rose-500" />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/medicines"
            className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-shadow text-center"
          >
            <Package className="mx-auto mb-2 text-blue-600" size={24} />
            <p className="text-sm font-medium text-gray-800">Medicines</p>
          </a>
          <a
            href="/sales"
            className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:shadow-md transition-shadow text-center"
          >
            <ShoppingCart className="mx-auto mb-2 text-green-600" size={24} />
            <p className="text-sm font-medium text-gray-800">Sales</p>
          </a>
          <a
            href="/inventory"
            className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:shadow-md transition-shadow text-center"
          >
            <Activity className="mx-auto mb-2 text-purple-600" size={24} />
            <p className="text-sm font-medium text-gray-800">Inventory</p>
          </a>
          <a
            href="/analytics"
            className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:shadow-md transition-shadow text-center"
          >
            <TrendingUp className="mx-auto mb-2 text-orange-600" size={24} />
            <p className="text-sm font-medium text-gray-800">Analytics</p>
          </a>
        </div>
      </div>
    </div>
  );
}

// ---- Main Dashboard router component ----
function Dashboard() {
  const { user } = useAuth();

  // Route to role-specific dashboard sub-components
  // Sub-components handle their own hooks, complying with Rules of Hooks
  if (user?.role === 'customer') return <CustomerDashboard />;
  if (user?.role === 'delivery_store') return <DeliveryStoreDashboard />;

  // Admin / Staff default
  return <AdminStaffDashboard />;
}

export default Dashboard;
