import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Mail, Lock, AlertCircle, ShieldCheck, Users, UserCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    username: 'admin',
    password: 'admin123',
    icon: ShieldCheck,
    color: 'text-purple-600',
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    desc: 'Full system access',
  },
  {
    label: 'Staff',
    username: 'staff',
    password: 'staff123',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    desc: 'Sales, inventory, orders',
  },
  {
    label: 'Delivery Store',
    username: 'delivery_store',
    password: 'delivery123',
    icon: Truck,
    color: 'text-orange-600',
    bg: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    desc: 'Approve and deliver orders',
  },
  {
    label: 'Customer',
    username: 'customer',
    password: 'customer123',
    icon: UserCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 hover:bg-green-100 border-green-200',
    desc: 'Shop, cart & orders',
  },
];
import { Truck } from 'lucide-react';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({
    username: 'admin',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const fillDemo = (account) => {
    setCredentials({ username: account.username, password: account.password });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(credentials);

      if (response.success) {
        login(response.data.user, response.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-primary">HALOmed</h1>
        <p className="text-center text-gray-600 mb-8">Pharmacy Management System</p>
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Login</h2>

        {error && (
          <div className="alert-error mb-4 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail size={18} className="inline mr-2" />
              Username
            </label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              className="input-field"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock size={18} className="inline mr-2" />
              Password
            </label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              className="input-field"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Don&apos;t have an account?{' '}
          <a href="/register" className="text-primary font-semibold hover:underline">
            Sign Up
          </a>
        </p>

        {/* Demo Credentials Panel */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 text-center mb-3 uppercase tracking-wide">
            Quick Login — Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border cursor-pointer transition text-center ${account.bg}`}
                  title={`Fill ${account.label} credentials`}
                >
                  <Icon size={20} className={account.color} />
                  <span className={`text-xs font-semibold ${account.color}`}>{account.label}</span>
                  <span className="text-xs text-gray-500">{account.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Click a role card to auto-fill credentials</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
