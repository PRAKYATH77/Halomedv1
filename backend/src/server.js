import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import createPool, { testConnection } from './config/database.js';
import { requestLogger, errorHandler } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import medicineRoutes from './routes/medicines.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';
import prescriptionRoutes from './routes/prescriptions.js';
import supplierRoutes from './routes/suppliers.js';
import orderRoutes from './routes/orders.js';
import customerOrderRoutes from './routes/customerOrders.js';
import analyticsRoutes from './routes/analytics.js';
import predictionRoutes from './routes/predictions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database pool
const pool = createPool();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Store pool in app for use in routes
app.locals.pool = pool;

// Routes
app.use('/auth', authRoutes);
app.use('/medicines', medicineRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/sales', salesRoutes);
app.use('/prescriptions', prescriptionRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/orders', orderRoutes);
app.use('/api/orders', customerOrderRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/predictions', predictionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const isConnected = await testConnection(pool);
    
    if (!isConnected) {
      console.error('Cannot start server without database connection');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🏥 HALOmed Pharmacy Management System                  ║
║         Backend Server Running Successfully                     ║
╚════════════════════════════════════════════════════════════════╝
📍 Server URL: http://localhost:${PORT}
📊 API Base: http://localhost:${PORT}/api
🗄️  Database: ${process.env.DB_NAME}
🔐 Environment: ${process.env.NODE_ENV || 'development'}
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
