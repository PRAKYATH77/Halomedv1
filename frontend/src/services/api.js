import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5003';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Medicines API
export const medicinesAPI = {
  getAll: (params) => api.get('/medicines', { params }),
  getById: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  getLowStock: () => api.get('/medicines/stock/low'),
};

// Inventory API
export const inventoryAPI = {
  getLogs: (params) => api.get('/inventory', { params }),
  addLog: (data) => api.post('/inventory', data),
  getSummary: () => api.get('/inventory/summary'),
  getExpired: () => api.get('/inventory/expired'),
};

// Sales API
export const salesAPI = {
  create: (data) => api.post('/sales', data),
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  getSummary: (params) => api.get('/sales/summary/stats', { params }),
};

// Prescriptions API
export const prescriptionsAPI = {
  create: (data) => api.post('/prescriptions', data),
  getAll: (params) => api.get('/prescriptions', { params }),
  fulfill: (id) => api.put(`/prescriptions/${id}/fulfill`),
  getUnfulfilled: () => api.get('/prescriptions/unfulfilled'),
};

// Suppliers API
export const suppliersAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
};

// Users with roles (admin endpoints)
export const usersAPI = {
  getAll: () => api.get('/auth/users'),
  getSuppliers: () => api.get('/auth/suppliers'),
  updateRole: (id, role) => api.patch(`/auth/users/${id}/role`, { role }),
};

// Delivery stores
export const deliveryStoresAPI = {
  getAll: () => api.get('/auth/delivery-stores'),
};

// Orders API
export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};

// Customer orders (mounted at /api/orders on backend)
export const customerOrdersAPI = {
  create: (data) => api.post('/api/orders', data),
  getAll: (params) => api.get('/api/orders', { params }),
  getById: (id) => api.get(`/api/orders/${id}`),
  pay: (id, data) => api.post(`/api/orders/${id}/pay`, data),
  assignDeliveryStore: (id, deliveryStoreId) => api.patch(`/api/orders/${id}/assign-delivery-store`, { deliveryStoreId }),
  approveForDelivery: (id) => api.patch(`/api/orders/${id}/delivery/approve`),
  paymentsList: (params) => api.get('/api/orders/payments/list', { params }),
};

// Analytics API
export const analyticsAPI = {
  getDemand: () => api.get('/analytics/demand'),
  getSalesAnalytics: (params) => api.get('/analytics/sales', { params }),
  getTopMedicines: () => api.get('/analytics/top-medicines'),
  getDashboardStats: () => api.get('/analytics/dashboard/stats'),
};

// Predictions API
export const predictionsAPI = {
  getAll: (params) => api.get('/predictions', { params }),
  getRecommendations: (predictionId) => api.get(`/predictions/recommendations/${predictionId}`),
  trigger: () => api.post('/predictions/trigger'),
  create: (data) => api.post('/predictions', data),
};

// Restock Requests API
export const restockRequestsAPI = {
  create: (data) => api.post('/restock', data),
  getAll: () => api.get('/restock'),
  getMine: () => api.get('/restock/my'),
  approve: (id) => api.patch(`/restock/${id}/approve`),
  reject: (id) => api.patch(`/restock/${id}/reject`),
  assignSupplier: (id, supplier_id) => api.patch(`/restock/${id}/assign-supplier`, { supplier_id }),
  supplierOutForDelivery: (id) => api.patch(`/restock/${id}/supplier/out-for-delivery`),
  supplierMarkDelivered: (id) => api.patch(`/restock/${id}/supplier/mark-delivered`),
  deliveryStoreConfirm: (id) => api.patch(`/restock/${id}/delivery-store/confirm`),
};

// Users API (admin)
export const usersAPI = {
  getAll: () => api.get('/auth/users'),
  updateRole: (id, role) => api.patch(`/auth/users/${id}/role`, { role }),
};

export default api;
