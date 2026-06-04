import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

function Header({ onMenuClick }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user?.role === 'customer') {
      const fetchOrders = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          const orders = data.data || data;
          
          const newNotifications = [];
          orders.forEach(order => {
             if (order.status === 'assigned' || order.status === 'out_for_delivery' || order.status === 'received') {
                const storeName = order.delivery_store_name || `Store #${order.assigned_delivery_store_id}`;
                newNotifications.push({
                   id: order.order_id,
                   text: `Delivery has been confirmed and is assigned to ${storeName}`,
                   time: new Date(order.updated_at || order.created_at).toLocaleDateString()
                });
             }
          });
          setNotifications(newNotifications);
        } catch (err) {
          console.error('Failed to fetch notifications', err);
        }
      };
      
      fetchOrders();
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [user]);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm relative z-50">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 hover:bg-gray-100 rounded"
      >
        <Menu size={24} />
      </button>

      <div className="flex-1"></div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-gray-100 rounded-lg relative"
          >
            <Bell size={20} className="text-gray-600" />
            {notifications.length > 0 && (
               <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Notifications</h3>
                <span className="text-xs text-gray-500">{notifications.length} new</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition">
                      <p className="text-sm text-gray-800">{notif.text}</p>
                      <p className="text-xs text-blue-500 mt-1 font-medium">{notif.time}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <Link to="/profile" className="p-2 hover:bg-gray-100 rounded-lg">
          <User size={20} className="text-gray-600" />
        </Link>
      </div>
    </header>
  );
}

export default Header;
