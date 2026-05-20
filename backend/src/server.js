import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import createPool, { testConnection } from './config/database.js';
import { requestLogger, errorHandler } from './middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { startTrackingSimulator } from './utils/tracker.js';

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
import restockRoutes from './routes/restockRequests.js';
import customerAssistantRoutes from './routes/customerAssistant.js';

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

// Run SQL migrations located in backend/migrations (simple runner)
const runMigrations = async () => {
  try {
    // migrations are relative to backend working directory
    let migrationsDir = path.resolve(process.cwd(), 'migrations');
    // fallback if started from repo root
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
    }
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (!sql.trim()) continue;
      try {
        // Execute statements (may contain multiple statements)
        await pool.query(sql);
        console.log(`Applied migration: ${file}`);
      } catch (err) {
        console.warn(`Migration ${file} may have partially applied or already exists:`, err.message);
      }
    }
  } catch (err) {
    console.warn('Failed to run migrations:', err.message);
  }
};

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
app.use('/restock', restockRoutes);
app.use('/assistant', customerAssistantRoutes);

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
    // Test database connection with timeout
    const connectionPromise = testConnection(pool);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 3000));
    const isConnected = await Promise.race([connectionPromise, timeoutPromise]);
    
    if (!isConnected) {
      console.warn('⚠️  Database connection not available, but server will start anyway');
    }
    // Run migrations then start background simulator
    await runMigrations();
    try {
      const trackerInterval = startTrackingSimulator(pool);
      app.locals.trackerInterval = trackerInterval;
      console.log('Background tracking simulator started');
    } catch (err) {
      console.warn('Failed to start tracking simulator:', err.message);
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
