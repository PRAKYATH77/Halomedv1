import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const ORDER_STATUSES = ['pending', 'confirmed', 'assigned', 'out_for_delivery', 'received', 'cancelled'];

const normalizeStatus = (status) => (typeof status === 'string' ? status.trim().toLowerCase() : '');

const orderSelectQuery = `
  SELECT co.*, u.username AS delivery_store_name
  FROM customer_orders co
  LEFT JOIN users u ON co.assigned_delivery_store_id = u.user_id
`;

// --- Tracking simulation helpers (server-side) ---
const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const roundCoordinate = (v) => Number(Number(v).toFixed(6));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const DELIVERY_HUB = { lat: 12.9716, lng: 77.5946 };
const DELIVERY_SIMULATION_DURATION_SECONDS = 300;
const DELIVERY_SIMULATION_STEP_SECONDS = 10;
const DELIVERY_SIMULATION_STEPS = DELIVERY_SIMULATION_DURATION_SECONDS / DELIVERY_SIMULATION_STEP_SECONDS;

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

const computeTrackingSnapshot = (order) => {
  if (!['out_for_delivery', 'received'].includes(order.status)) return null;

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

// Create customer order
router.post('/', authenticateToken, async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  
  try {
    const { items, totalAmount, deliveryAddress, city, zipCode, phoneNumber, paymentMethod, transactionId } = req.body;
    const customerId = req.user.userId;

    console.log('🛒 Creating order for customer:', customerId);
    console.log('User data:', req.user);

    if (!items || items.length === 0) {
      return sendResponse(res, 400, false, 'Items are required');
    }

    if (!deliveryAddress || !city || !zipCode || !phoneNumber) {
      return sendResponse(res, 400, false, 'All delivery details are required');
    }

    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('📝 Transaction started');

    // For Cash on Delivery, we can treat the order as confirmed immediately.
    // For online methods (card/upi), start as pending and confirm after payment.
    const initialStatus = paymentMethod === 'cod' ? 'confirmed' : 'pending';

    // Create order with appropriate initial status
    const [result] = await connection.query(
      `INSERT INTO customer_orders (
         customer_id, total_amount, delivery_address, city, zip_code, phone_number, payment_method, status,
         assigned_delivery_store_id, assigned_by, assigned_at, approved_for_delivery_at, received_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
      [customerId, totalAmount, deliveryAddress, city, zipCode, phoneNumber, paymentMethod, initialStatus]
    );

    const orderId = result.insertId;
    console.log('✅ Order created:', orderId);

    // Add order items
    for (const item of items) {
      await connection.query(
        `INSERT INTO customer_order_items (order_id, medicine_id, quantity, price) VALUES (?, ?, ?, ?)`,
        [orderId, item.medicine_id, item.quantity, item.price]
      );
      
      // Update medicine stock
      await connection.query(
        `UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE medicine_id = ?`,
        [item.quantity, item.medicine_id]
      );
      
      // Log inventory change
      await connection.query(
        `INSERT INTO inventory_logs (medicine_id, change_type, quantity_changed, changed_by) 
         VALUES (?, 'sale', ?, ?)`,
        [item.medicine_id, -item.quantity, customerId]
      );
    }

    // If payment method is COD, also create a corresponding sale record
    if (paymentMethod === 'cod') {
      const numericTotal = Number(totalAmount || 0);

      const [saleResult] = await connection.query(
        `INSERT INTO sales (customer_id, total_amount, discount_applied, final_amount, status)
         VALUES (?, ?, 0, ?, 'completed')`,
        [null, numericTotal, numericTotal]
      );

      const saleId = saleResult.insertId;

      for (const item of items) {
        const subtotal = Number(item.price || 0) * Number(item.quantity || 0);
        await connection.query(
          `INSERT INTO sale_details (sale_id, medicine_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [saleId, item.medicine_id, item.quantity, item.price, subtotal]
        );
      }
    }

    // COMMIT TRANSACTION
    await connection.commit();
    console.log('✅ Transaction committed successfully');

    sendResponse(res, 201, true, 'Order placed successfully', {
      orderId: orderId,
      status: initialStatus,
      transactionId: transactionId,
    });
  } catch (error) {
    // ROLLBACK on any error
    await connection.rollback();
    console.error('❌ Transaction rolled back. Error:', error.message);
    handleError(error, res);
  } finally {
    connection.release();
  }
});

// Get customer orders (customers see their own, admin/staff see all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    let query = `${orderSelectQuery} WHERE 1=1`;
    const params = [];

    // If customer, only show their orders
    if (req.user.role === 'customer') {
      query += ` AND customer_id = ?`;
      params.push(req.user.userId);
    } else if (req.user.role === 'delivery_store') {
      query += ` AND assigned_delivery_store_id = ?`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY created_at DESC`;

    const [orders] = await pool.query(query, params);

    // Get items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await pool.query(
          `SELECT coi.*, m.name as medicine_name 
           FROM customer_order_items coi
           JOIN medicines m ON coi.medicine_id = m.medicine_id
           WHERE coi.order_id = ?`,
          [order.order_id]
        );
        return { ...order, items };
      })
    );

    sendResponse(res, 200, true, 'Orders retrieved successfully', ordersWithItems);
  } catch (error) {
    handleError(error, res);
  }
});

// Get order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [orders] = await pool.query(
      `${orderSelectQuery} WHERE co.order_id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    // Check permission
    if (req.user.role === 'customer' && orders[0].customer_id !== req.user.userId) {
      return sendResponse(res, 403, false, 'Unauthorized');
    }

    if (req.user.role === 'delivery_store' && orders[0].assigned_delivery_store_id !== req.user.userId) {
      return sendResponse(res, 403, false, 'Unauthorized');
    }

    const [items] = await pool.query(
      `SELECT coi.*, m.name as medicine_name 
       FROM customer_order_items coi
       JOIN medicines m ON coi.medicine_id = m.medicine_id
       WHERE coi.order_id = ?`,
      [id]
    );

    sendResponse(res, 200, true, 'Order retrieved successfully', {
      ...orders[0],
      items: items,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Server-side tracking snapshot for an order (simulated)
router.get('/:id/tracking', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [orders] = await pool.query(
      `${orderSelectQuery} WHERE co.order_id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    // Permission checks mirror GET /:id
    if (req.user.role === 'customer' && orders[0].customer_id !== req.user.userId) {
      return sendResponse(res, 403, false, 'Unauthorized');
    }

    if (req.user.role === 'delivery_store' && orders[0].assigned_delivery_store_id !== req.user.userId) {
      return sendResponse(res, 403, false, 'Unauthorized');
    }

    // Look for persisted tracking row
    const [trackingRows] = await pool.query(
      `SELECT courier_lat, courier_lng, progress, updated_at FROM order_tracking WHERE order_id = ?`,
      [id]
    );

    const simulatedSnapshot = computeTrackingSnapshot(orders[0]);

    if (trackingRows.length === 0) {
      if (!simulatedSnapshot) {
        return sendResponse(res, 200, true, 'No active tracking for this order', { available: false });
      }
      return sendResponse(res, 200, true, 'Tracking snapshot (simulated)', { available: true, snapshot: simulatedSnapshot });
    }

    const row = trackingRows[0];
    const snapshot = simulatedSnapshot || {};
    // Override courier position/progress with persisted values when present
    snapshot.courierPosition = snapshot.courierPosition || {};
    if (row.courier_lat != null && row.courier_lng != null) {
      snapshot.courierPosition.lat = Number(row.courier_lat);
      snapshot.courierPosition.lng = Number(row.courier_lng);
    }
    if (row.progress != null) snapshot.progress = Number(row.progress);
    snapshot.updated_at = row.updated_at;

    return sendResponse(res, 200, true, 'Tracking snapshot (persisted)', { available: true, snapshot });
  } catch (error) {
    handleError(error, res);
  }
});

// Update tracking coordinates for an order (delivery store or staff)
router.patch('/:id/tracking', authenticateToken, authorizeRole(['delivery_store','admin','staff']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { courier_lat, courier_lng, progress } = req.body;

    const [orders] = await pool.query('SELECT order_id, assigned_delivery_store_id FROM customer_orders WHERE order_id = ?', [id]);
    if (orders.length === 0) return sendResponse(res, 404, false, 'Order not found');

    // If delivery_store, ensure it's assigned to them
    if (req.user.role === 'delivery_store' && Number(orders[0].assigned_delivery_store_id) !== Number(req.user.userId)) {
      return sendResponse(res, 403, false, 'This order is not assigned to you');
    }

    await pool.query(
      `INSERT INTO order_tracking (order_id, courier_lat, courier_lng, progress, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE courier_lat = VALUES(courier_lat), courier_lng = VALUES(courier_lng), progress = VALUES(progress), updated_at = CURRENT_TIMESTAMP`,
      [id, courier_lat || null, courier_lng || null, progress != null ? progress : 0]
    );

    return sendResponse(res, 200, true, 'Tracking updated');
  } catch (error) {
    handleError(error, res);
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);

    if (!ORDER_STATUSES.includes(status)) {
      return sendResponse(res, 400, false, 'Invalid status');
    }

    const [orders] = await pool.query(
      'SELECT order_id, customer_id, assigned_delivery_store_id, status FROM customer_orders WHERE order_id = ?',
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    const order = orders[0];

    if (req.user.role === 'customer') {
      if (order.customer_id !== req.user.userId) {
        return sendResponse(res, 403, false, 'Unauthorized');
      }

      if (status !== 'received') {
        return sendResponse(res, 403, false, 'Customers can only confirm receipt');
      }

      if (!['out_for_delivery', 'received'].includes(order.status)) {
        return sendResponse(res, 400, false, 'Order is not ready for receipt');
      }

      await pool.query(
        `UPDATE customer_orders SET status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [id]
      );

      return sendResponse(res, 200, true, 'Order marked as received');
    }

    if (req.user.role === 'delivery_store') {
      if (Number(order.assigned_delivery_store_id) !== Number(req.user.userId)) {
        return sendResponse(res, 403, false, 'This order is not assigned to you');
      }

      if (status !== 'out_for_delivery') {
        return sendResponse(res, 403, false, 'Delivery stores can only approve orders for delivery');
      }

      if (order.status !== 'assigned') {
        return sendResponse(res, 400, false, 'Order must be assigned before approval');
      }

      await pool.query(
        `UPDATE customer_orders SET status = 'out_for_delivery', approved_for_delivery_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [id]
      );

      return sendResponse(res, 200, true, 'Order approved for delivery');
    }

    if (!['admin', 'staff'].includes(req.user.role)) {
      return sendResponse(res, 403, false, 'Unauthorized');
    }

    if (status === 'received') {
      return sendResponse(res, 403, false, 'Only customers can confirm receipt');
    }

    const [result] = await pool.query(
      `UPDATE customer_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    sendResponse(res, 200, true, 'Order status updated successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Assign order to a delivery store
router.patch('/:id/assign-delivery-store', authenticateToken, authorizeRole(['admin', 'staff']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { deliveryStoreId } = req.body;

    if (!deliveryStoreId) {
      return sendResponse(res, 400, false, 'Delivery store is required');
    }

    const [stores] = await pool.query(
      "SELECT user_id FROM users WHERE user_id = ? AND role = 'delivery_store' AND is_active = TRUE",
      [deliveryStoreId]
    );

    if (stores.length === 0) {
      return sendResponse(res, 400, false, 'Invalid delivery store');
    }

    const [orders] = await pool.query(
      'SELECT order_id, status FROM customer_orders WHERE order_id = ?',
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    if (!['confirmed', 'assigned'].includes(orders[0].status)) {
      return sendResponse(res, 400, false, 'Order must be confirmed before assignment');
    }

    await pool.query(
      `UPDATE customer_orders
       SET assigned_delivery_store_id = ?,
           assigned_by = ?,
           assigned_at = CURRENT_TIMESTAMP,
           status = 'assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [deliveryStoreId, req.user.userId, id]
    );

    sendResponse(res, 200, true, 'Order assigned to delivery store successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Delivery store approves the order for delivery
router.patch('/:id/delivery/approve', authenticateToken, authorizeRole(['delivery_store']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [orders] = await pool.query(
      'SELECT order_id, status, assigned_delivery_store_id FROM customer_orders WHERE order_id = ?',
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    const order = orders[0];
    if (Number(order.assigned_delivery_store_id) !== Number(req.user.userId)) {
      return sendResponse(res, 403, false, 'This order is not assigned to you');
    }

    if (order.status !== 'assigned') {
      return sendResponse(res, 400, false, 'Order must be assigned before approval');
    }

    await pool.query(
      `UPDATE customer_orders
       SET status = 'out_for_delivery',
           approved_for_delivery_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [id]
    );

    // Insert initial tracking row (origin position at hub) for persistent tracking
    try {
      const { origin, destination } = buildTrackingRoute({ order_id: id, delivery_address: orders[0].delivery_address, city: orders[0].city, zip_code: orders[0].zip_code });
      await pool.query(
        `INSERT INTO order_tracking (order_id, courier_lat, courier_lng, progress, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE courier_lat = VALUES(courier_lat), courier_lng = VALUES(courier_lng), progress = VALUES(progress), updated_at = CURRENT_TIMESTAMP`,
        [id, origin.lat, origin.lng, 0]
      );
    } catch (tErr) {
      // non-fatal: log and continue
      console.warn('Failed to initialize order_tracking for', id, tErr.message);
    }

    sendResponse(res, 200, true, 'Order approved for delivery');
  } catch (error) {
    handleError(error, res);
  }
});

// Process payment (customers and admin/staff)
router.post('/:id/pay', authenticateToken, async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  
  try {
    const { id } = req.params;
    const { transactionId } = req.body;

    console.log('💳 Processing payment for order:', id);
    console.log('User data:', req.user);

    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('📝 Transaction started for payment processing');

    const [orders] = await connection.query(
      `SELECT * FROM customer_orders WHERE order_id = ?`,
      [id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      console.log('❌ Order not found:', id);
      return sendResponse(res, 404, false, 'Order not found');
    }

    const order = orders[0];
    console.log('Order data:', order);

    // Check permission - only customer who placed order or admin/staff can process payment
    if (req.user.role === 'customer') {
      console.log('Checking customer permission. Order customer_id:', order.customer_id, 'User id:', req.user.userId);
      if (parseInt(order.customer_id) !== parseInt(req.user.userId)) {
        await connection.rollback();
        console.log('❌ Permission denied for customer');
        return sendResponse(res, 403, false, 'Access denied. Insufficient permissions');
      }
    }

    // Only process payment for pending orders
    if (order.status !== 'pending') {
      await connection.rollback();
      console.log('❌ Order is not pending payment');
      return sendResponse(res, 400, false, 'Order is not pending payment');
    }

    // Create corresponding sale record for analytics
    const numericTotal = Number(order.total_amount || 0);

    const [saleResult] = await connection.query(
      `INSERT INTO sales (customer_id, total_amount, discount_applied, final_amount, status)
       VALUES (?, ?, 0, ?, 'completed')`,
      [null, numericTotal, numericTotal]
    );

    const saleId = saleResult.insertId;

    const [orderItems] = await connection.query(
      `SELECT * FROM customer_order_items WHERE order_id = ?`,
      [id]
    );

    for (const item of orderItems) {
      const subtotal = Number(item.price || 0) * Number(item.quantity || 0);
      await connection.query(
        `INSERT INTO sale_details (sale_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.medicine_id, item.quantity, item.price, subtotal]
      );
    }

    // Update order status to confirmed (payment successful)
    await connection.query(
      `UPDATE customer_orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [id]
    );

    // COMMIT TRANSACTION
    await connection.commit();
    console.log('✅ Payment transaction committed successfully');

    sendResponse(res, 200, true, 'Payment processed successfully', {
      orderId: id,
      transactionId,
      status: 'confirmed',
    });
  } catch (error) {
    // ROLLBACK on any error
    await connection.rollback();
    console.error('❌ Payment transaction rolled back. Error:', error.message);
    handleError(error, res);
  } finally {
    connection.release();
  }
});

// Get all payments (admin/staff only)
router.get('/payments/list', authenticateToken, authorizeRole(['admin', 'staff']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { status } = req.query;

    let query = `SELECT pt.*, co.delivery_address, co.city, co.phone_number, u.username 
                 FROM payment_transactions pt 
                 LEFT JOIN customer_orders co ON pt.order_id = co.order_id 
                 LEFT JOIN users u ON pt.customer_id = u.user_id
                 WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND pt.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY pt.created_at DESC`;

    const [payments] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Payments retrieved successfully', payments);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
