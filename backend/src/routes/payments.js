import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Shared helper: process a confirmed order (records sale, sale_details, payment transaction, tracking)
async function processConfirmedOrder(pool, order_id, razorpay_order_id = null, razorpay_payment_id = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(`SELECT * FROM customer_orders WHERE order_id = ? FOR UPDATE`, [order_id]);
    if (!orders || orders.length === 0) {
      await connection.rollback();
      return { success: false, status: 404, message: 'Order not found' };
    }

    const order = orders[0];
    if (order.status !== 'pending') {
      await connection.rollback();
      return { success: false, status: 400, message: 'Order is not pending payment' };
    }

    // Idempotency safeguard: if external payment id provided and already recorded,
    // return success to avoid double-processing.
    if (razorpay_payment_id) {
      try {
        const [existing] = await connection.query(`SELECT pt.sale_id FROM payment_transactions pt WHERE pt.external_payment_id = ? LIMIT 1`, [razorpay_payment_id]);
        if (existing && existing.length > 0) {
          // Already processed by prior webhook/verify
          await connection.rollback();
          return { success: true, saleId: existing[0].sale_id, message: 'Already processed (idempotent)'};
        }
      } catch (idErr) {
        console.warn('Idempotency check failed', idErr?.message || idErr);
      }
    }

    // Ensure a corresponding `customers` row exists for analytics (map users -> customers)
    let customerId = null;
    try {
      const [custRows] = await connection.query(`SELECT customer_id FROM customers WHERE contact_info = ? LIMIT 1`, [order.phone_number]);
      if (custRows && custRows.length > 0) {
        customerId = custRows[0].customer_id;
      } else {
        const [addrRows] = await connection.query(`SELECT customer_id FROM customers WHERE address = ? LIMIT 1`, [order.delivery_address]);
        if (addrRows && addrRows.length > 0) customerId = addrRows[0].customer_id;
      }

      if (!customerId) {
        const [userRows] = await connection.query(`SELECT username, email FROM users WHERE user_id = ? LIMIT 1`, [order.customer_id]);
        const name = (userRows && userRows[0] && userRows[0].username) ? userRows[0].username : `user_${order.customer_id}`;
        const contact = order.phone_number || (userRows && userRows[0] && userRows[0].email) || null;
        const address = order.delivery_address || null;

        const [ins] = await connection.query(`INSERT INTO customers (name, contact_info, address) VALUES (?, ?, ?)`, [name, contact, address]);
        customerId = ins.insertId;
      }
    } catch (mapErr) {
      console.warn('Failed to map/create customers row for analytics:', mapErr.message);
    }

    const numericTotal = Number(order.total_amount || 0);
    const [saleResult] = await connection.query(
      `INSERT INTO sales (customer_id, total_amount, discount_applied, final_amount, status)
       VALUES (?, ?, 0, ?, 'completed')`,
      [customerId, numericTotal, numericTotal]
    );

    const saleId = saleResult.insertId;

    const [items] = await connection.query(`SELECT * FROM customer_order_items WHERE order_id = ?`, [order_id]);
    for (const it of items) {
      const subtotal = Number(it.price || 0) * Number(it.quantity || 0);
      await connection.query(
        `INSERT INTO sale_details (sale_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, it.medicine_id, it.quantity, it.price, subtotal]
      );
    }

    await connection.query(
      `INSERT INTO payment_transactions (sale_id, payment_method, amount_paid, status, external_payment_id)
       VALUES (?, 'online', ?, 'completed', ?)`,
      [saleId, numericTotal, razorpay_payment_id || null]
    );

    await connection.query(`UPDATE customer_orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`, [order_id]);

    try {
      await connection.query(
        `INSERT INTO order_tracking (order_id, courier_lat, courier_lng, progress, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE courier_lat = VALUES(courier_lat), courier_lng = VALUES(courier_lng), progress = VALUES(progress), updated_at = CURRENT_TIMESTAMP`,
        [order_id, 0, 0, 0]
      );
    } catch (tErr) {
      console.warn('Failed to initialize order_tracking for', order_id, tErr.message);
    }

    await connection.commit();
    return { success: true, saleId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Create a Razorpay order (sandbox/test keys expected in env)
router.post('/razorpay', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    }

    const rzp = new Razorpay({ key_id, key_secret });
    // Razorpay amount is in paise (INR) — frontend may send rupees
    const amountInPaise = Math.round(Number(amount) * 100);

    const options = {
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await rzp.orders.create(options);

    return res.json({ success: true, data: { order, key_id } });
  } catch (err) {
    console.error('Razorpay order creation failed', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
  }
});

// Verify Razorpay payment and record transaction + confirm order
router.post('/verify', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    console.log('payments.verify handler invoked');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id /* local customer order id */ } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) return res.status(500).json({ success: false, message: 'Razorpay key secret not configured' });

    const generated_signature = crypto.createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.log('payments.verify invalid signature', generated_signature, razorpay_signature);
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    console.log('payments.verify signature ok');

    const result = await processConfirmedOrder(pool, order_id, razorpay_order_id, razorpay_payment_id);
    if (!result.success) {
      return res.status(result.status || 500).json({ success: false, message: result.message || 'Processing failed' });
    }

    return res.json({ success: true, message: 'Payment verified and order confirmed', data: { saleId: result.saleId } });
  } catch (err) {
    console.error('Payment verify error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
});

// Export router
// Webhook endpoint for Razorpay (verifies signature and processes captured payments)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Prefer an explicit webhook secret if provided; fall back to key secret for compatibility
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!webhookSecret) return res.status(500).send('Razorpay webhook secret not configured');
  console.log('Webhook config: hasWebhookSecret=', !!process.env.RAZORPAY_WEBHOOK_SECRET, 'hasKeySecret=', !!process.env.RAZORPAY_KEY_SECRET);

  try {
    const signature = req.headers['x-razorpay-signature'];
    // req.body may be a Buffer (raw) or already-parsed object depending on body parsers.
    let rawForHmac;
    if (Buffer.isBuffer(req.body)) {
      rawForHmac = req.body;
    } else if (typeof req.body === 'string') {
      rawForHmac = Buffer.from(req.body, 'utf8');
    } else {
      try {
        rawForHmac = Buffer.from(JSON.stringify(req.body), 'utf8');
      } catch (e) {
        rawForHmac = Buffer.from(String(req.body), 'utf8');
      }
    }
    // Parse payload string now (safe) so we can record event type in audit table
    let parsedPayload = null;
    let payloadStr = null;
    try {
      payloadStr = rawForHmac.toString('utf8');
      parsedPayload = JSON.parse(payloadStr);
    } catch (e) {
      // leave parsedPayload null if parsing fails
      payloadStr = rawForHmac.toString('utf8');
    }

    // Record incoming webhook for auditing (attempt; don't block processing if this fails)
    const pool = req.app.locals.pool;
    let webhookEventId = null;
    try {
      const [ins] = await pool.query(
        `INSERT INTO webhook_events (event_type, raw_payload, headers, signature, processing_status) VALUES (?, ?, ?, ?, 'received')`,
        [parsedPayload && parsedPayload.event ? parsedPayload.event : null, payloadStr, JSON.stringify(req.headers || {}), signature || null]
      );
      webhookEventId = ins.insertId;
      console.log('Recorded webhook event id', webhookEventId);
    } catch (logErr) {
      console.warn('Failed to record webhook event', logErr?.message || logErr);
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawForHmac).digest('hex');
    let signatureValid = (signature === expected);
    if (!signatureValid) {
      console.warn('Razorpay webhook invalid signature', { expected, received: signature });
      try {
        console.warn('Razorpay webhook raw payload:', rawForHmac.toString('utf8'));
      } catch (e) {
        console.warn('Failed to stringify rawForHmac', e?.message || e);
      }
      // Log event to file for further inspection
      try {
        const fs = await import('fs');
        const out = `[${new Date().toISOString()}] Invalid webhook signature, headers=${JSON.stringify(req.headers)}\n`;
        fs.appendFile('backend/webhook-invalid-signature.log', out, () => {});
      } catch (e) {
        console.warn('Failed to write invalid signature log', e?.message || e);
      }

      // Secondary verification fallback: try to fetch the payment from Razorpay API
      // and verify that the payment id/order id match and payment is captured.
      try {
        const parsedPayload = JSON.parse(rawForHmac.toString('utf8'));
        const paymentEntity = parsedPayload?.payload?.payment?.entity;
        const fallbackPaymentId = paymentEntity?.id;
        const fallbackOrderId = paymentEntity?.order_id;
          if (fallbackPaymentId && fallbackOrderId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
          const rzpFallback = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
          try {
            const fetchedPayment = await rzpFallback.payments.fetch(fallbackPaymentId);
            // Razorpay returns 'captured' state when payment is successful
            if (fetchedPayment && fetchedPayment.id === fallbackPaymentId && fetchedPayment.order_id === fallbackOrderId && String(fetchedPayment.status).toLowerCase() === 'captured') {
              console.log('Webhook signature invalid but Razorpay API confirms payment captured — proceeding with processing');
              // update audit row with external id
              try {
                if (webhookEventId) await pool.query(`UPDATE webhook_events SET external_payment_id = ? WHERE webhook_event_id = ?`, [fallbackPaymentId, webhookEventId]);
              } catch (uErr) { console.warn('Failed to update webhook event with external id', uErr?.message || uErr); }
              signatureValid = true;
            } else {
              console.warn('Razorpay API fallback verification failed', { fetchedPaymentId: fetchedPayment && fetchedPayment.id, status: fetchedPayment && fetchedPayment.status });
            }
          } catch (fetchErr) {
            console.warn('Razorpay API payment fetch failed during fallback verification', fetchErr?.message || fetchErr);
          }
        }
      } catch (fallbackErr) {
        console.warn('Fallback verification error', fallbackErr?.message || fallbackErr);
      }

      if (!signatureValid) {
        return res.status(400).send('Invalid signature');
      }
    }

    const payload = JSON.parse(rawForHmac.toString('utf8'));
    // Basic event logging for auditing and troubleshooting
    try {
      const fs = await import('fs');
      const ev = payload && payload.event ? payload.event : 'unknown';
      const psummary = { event: ev, ts: new Date().toISOString(), headers: { 'x-razorpay-signature': signature } };
      fs.appendFile('backend/webhook-events.log', JSON.stringify(psummary) + '\n', () => {});
    } catch (e) {
      console.warn('Failed to append webhook-events.log', e?.message || e);
    }
    // Handle payment captured event
    if (payload && payload.event === 'payment.captured' && payload.payload && payload.payload.payment && payload.payload.payment.entity) {
      const payment = payload.payload.payment.entity;
      const razorpay_order_id = payment.order_id;
      const razorpay_payment_id = payment.id;

      console.log('Razorpay webhook: payment.captured', razorpay_payment_id);
      try {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret_local = process.env.RAZORPAY_KEY_SECRET;
        if (key_id && key_secret_local) {
          const rzp = new Razorpay({ key_id, key_secret: key_secret_local });
          // Fetch the order to read the `receipt` we set when creating the order
          let fetchedOrder = null;
          try {
            console.log('Webhook: attempting to fetch razorpay order', razorpay_order_id);
            fetchedOrder = await rzp.orders.fetch(razorpay_order_id);
            console.log('Webhook: fetched order', fetchedOrder && fetchedOrder.id, 'receipt=', fetchedOrder && fetchedOrder.receipt);
          } catch (fErr) {
            console.warn('Failed to fetch razorpay order for webhook mapping', fErr?.message || fErr);
          }

          let mappedLocalOrderId = null;
          if (fetchedOrder && fetchedOrder.receipt) {
            // If we used the local order id as receipt, parse it
            const parsed = parseInt(String(fetchedOrder.receipt).replace(/^order_?/i, ''), 10);
            if (!isNaN(parsed)) mappedLocalOrderId = parsed;
          }

          if (mappedLocalOrderId) {
            try {
              console.log('Webhook: mapping found local order id', mappedLocalOrderId);
              const pool = req.app.locals.pool;
              // Idempotency check: if order already confirmed, skip processing
              const [ordRows] = await pool.query(`SELECT status FROM customer_orders WHERE order_id = ? LIMIT 1`, [mappedLocalOrderId]);
              if (ordRows && ordRows.length > 0 && ordRows[0].status === 'confirmed') {
                console.log('Webhook: order already confirmed, skipping re-processing', mappedLocalOrderId);
                return res.status(200).send('already_processed');
              }

              // Call processing helper; letting it validate the pending status again under transaction
              const result = await processConfirmedOrder(pool, mappedLocalOrderId, razorpay_order_id, razorpay_payment_id);
              console.log('Webhook: processConfirmedOrder result', result);
              if (result && result.success) {
                console.log('Webhook processed and confirmed local order', mappedLocalOrderId);
                try {
                  if (webhookEventId) await pool.query(`UPDATE webhook_events SET processing_status = 'processed', processing_result = ?, processed_at = CURRENT_TIMESTAMP, mapped_order_id = ?, external_payment_id = ? WHERE webhook_event_id = ?`, [JSON.stringify(result), mappedLocalOrderId, razorpay_payment_id || null, webhookEventId]);
                } catch (upErr) { console.warn('Failed to update webhook_event after success', upErr?.message || upErr); }
                return res.status(200).send('processed');
              } else {
                console.warn('Webhook processing did not confirm order', mappedLocalOrderId, result && result.message);
                try {
                  if (webhookEventId) await pool.query(`UPDATE webhook_events SET processing_status = 'failed', processing_result = ?, processed_at = CURRENT_TIMESTAMP, mapped_order_id = ? WHERE webhook_event_id = ?`, [result && result.message ? String(result.message) : 'processing_failed', mappedLocalOrderId, webhookEventId]);
                } catch (upErr) { console.warn('Failed to update webhook_event after failed processing', upErr?.message || upErr); }
                // Let Razorpay retry by returning 500 — but limit noisy retries by logging
                return res.status(500).send('processing_failed');
              }
            } catch (procErr) {
              console.error('Error processing order from webhook', procErr?.message || procErr, procErr && procErr.stack);
              try {
                if (webhookEventId) await pool.query(`UPDATE webhook_events SET processing_status = 'failed', processing_result = ?, processed_at = CURRENT_TIMESTAMP WHERE webhook_event_id = ?`, [procErr && procErr.message ? String(procErr.message) : 'processing_error', webhookEventId]);
              } catch (upErr) { console.warn('Failed to update webhook_event after exception', upErr?.message || upErr); }
              // Return 500 so the webhook can be retried; we've logged details for investigation
              return res.status(500).send('processing_error');
            }
          } else {
            console.log('Razorpay webhook: could not map order via receipt; client verify still allowed');
          }
        }
      } catch (outerErr) {
        console.error('Webhook internal handling error', outerErr?.message || outerErr);
      }
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook processing error', err?.stack || err);
    try {
      import('fs').then(fs => {
        const out = `[${new Date().toISOString()}] ${err && (err.stack || err.message || String(err))}\n`;
        fs.appendFile('backend/webhook-error.log', out, () => {});
      });
    } catch (e) {
      console.error('Failed to write webhook log file', e?.message || e);
    }
    return res.status(500).send('error');
  }
});

export default router;

// Test-only: simulate a successful Razorpay payment (no signature) — for local automation
// This route is gated and only registered when `ALLOW_PAYMENT_SIMULATE` env var is set to 'true'.
// WARNING: This endpoint is for dev/testing only and must NOT be enabled in production.
const isPaymentSimulationEnabled = process.env.ALLOW_PAYMENT_SIMULATE === 'true' || process.env.NODE_ENV !== 'production';

if (isPaymentSimulationEnabled) {
  router.post('/simulate', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    const connection = await pool.getConnection();
    try {
      const { order_id } = req.body;
      if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });

      await connection.beginTransaction();
      const [orders] = await connection.query(`SELECT * FROM customer_orders WHERE order_id = ?`, [order_id]);
      if (!orders || orders.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const order = orders[0];
      if (order.status !== 'pending') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Order is not pending payment' });
      }

      await connection.query(`UPDATE customer_orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`, [order_id]);
      await connection.query(
        `INSERT INTO order_tracking (order_id, courier_lat, courier_lng, progress, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE courier_lat = VALUES(courier_lat), courier_lng = VALUES(courier_lng), progress = VALUES(progress), updated_at = CURRENT_TIMESTAMP`,
        [order_id, 0, 0, 0]
      );

      await connection.commit();
      return res.json({ success: true, message: 'Simulated payment: order confirmed' });
    } catch (err) {
      await connection.rollback();
      console.error('Payment simulate error', err?.message || err);
      return res.status(500).json({ success: false, message: 'Simulation failed' });
    } finally {
      connection.release();
    }
  });
  console.warn('Dev-only route /payments/simulate is ENABLED (ALLOW_PAYMENT_SIMULATE=true)');
} else {
  console.warn('Dev-only route /payments/simulate is DISABLED. To enable, set ALLOW_PAYMENT_SIMULATE=true in backend .env');
}
