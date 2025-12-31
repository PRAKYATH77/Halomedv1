import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, Home, Package, Pill, ShoppingCart, FileText, Users, Truck, BarChart3, Brain, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

function Sidebar({ onClose }) {
  const { logout, user } = useAuth();
  const { getCartCount } = useCart();

  // Role-based menu items
  const allMenuItems = [
    { name: 'Dashboard', path: '/', icon: Home, roles: ['admin', 'staff', 'customer'] },
    { name: 'Medicines', path: '/medicines', icon: Pill, roles: ['admin', 'staff'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['admin', 'staff'] },
    { name: 'Sales', path: '/sales', icon: ShoppingCart, roles: ['admin', 'staff'] },
    { name: 'Cart', path: '/cart', icon: ShoppingCart, roles: ['customer'], badge: getCartCount() },
    { name: 'Prescriptions', path: '/prescriptions', icon: FileText, roles: ['admin', 'staff', 'customer'] },
    { name: 'Orders', path: '/orders', icon: Truck, roles: ['admin', 'staff', 'customer'] },
    { name: 'Payments', path: '/payments', icon: CreditCard, roles: ['admin', 'staff'] },
    { name: 'Suppliers', path: '/suppliers', icon: Users, roles: ['admin', 'staff'] },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['admin'] },
    { name: 'Predictions', path: '/predictions', icon: Brain, roles: ['admin', 'staff'] },
  ];

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => 
    item.roles && item.roles.includes(user?.role)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">HALOmed</h1>
          <button
            onClick={onClose}
            className="md:hidden p-2 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">Pharmacy System</p>
      </div>

      {/* User Info */}
      <div className="p-4 bg-blue-50 border-b border-gray-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{user?.username}</span>
        </p>
        <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  onClick={onClose}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors w-full"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
