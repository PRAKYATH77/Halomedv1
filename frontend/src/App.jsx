import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Prescriptions from './pages/Prescriptions';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Analytics from './pages/Analytics';
import Predictions from './pages/Predictions';
import Profile from './pages/Profile';
import RestockRequests from './pages/RestockRequests';

// Components
import Layout from './components/Layout';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                  <Route path="/medicines" element={<Medicines />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/prescriptions" element={<Prescriptions />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/predictions" element={<Predictions />} />
                    <Route path="/restock-requests" element={<RestockRequests />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
