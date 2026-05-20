import poolFactory from './src/config/database.js';

// One-shot runner using same logic as tracker.js but standalone for testing
const DELIVERY_SIMULATION_STEP_SECONDS = 10;
const DELIVERY_SIMULATION_STEPS = 300 / DELIVERY_SIMULATION_STEP_SECONDS;

const roundCoordinate = (v) => Number(Number(v).toFixed(6));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const DELIVERY_HUB = { lat: 12.9716, lng: 77.5946 };
const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

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

const interpolate = (start, end, progress) => ({
  lat: start.lat + (end.lat - start.lat) * progress,
  lng: start.lng + (end.lng - start.lng) * progress,
});

async function runOnce() {
  console.log('run_tracker_once: starting');
  const pool = await poolFactory();
  try {
    const [rows] = await pool.query(
      `SELECT ot.order_id, ot.courier_lat, ot.courier_lng, ot.progress, co.delivery_address, co.city, co.zip_code
       FROM order_tracking ot
       JOIN customer_orders co ON co.order_id = ot.order_id
       WHERE co.status = 'out_for_delivery' AND (ot.progress IS NULL OR ot.progress < 100)`
    );

    if (!rows || rows.length === 0) console.log('run_tracker_once: no matching rows');
    for (const r of rows) {
      const order = { order_id: r.order_id, delivery_address: r.delivery_address, city: r.city, zip_code: r.zip_code };
      console.log('run_tracker_once: processing order', r.order_id, 'currentProgress=', r.progress);
      const { origin, destination } = buildTrackingRoute(order);
      const currentProgress = Number(r.progress || 0);
      const stepPercent = Math.round(100 / DELIVERY_SIMULATION_STEPS);
      const newProgress = Math.min(100, currentProgress + stepPercent);
      const progressRatio = newProgress / 100;
      const pos = interpolate(origin, destination, progressRatio);

      await pool.query(
        `UPDATE order_tracking SET courier_lat = ?, courier_lng = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [pos.lat, pos.lng, newProgress, r.order_id]
      );

      if (newProgress >= 100) {
        await pool.query(
          `UPDATE customer_orders SET status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
          [r.order_id]
        );
        console.log('Marked order', r.order_id, 'as received');
      } else {
        console.log('Advanced order', r.order_id, 'to', newProgress);
      }
    }
  } catch (e) {
    console.error('run_once error', e.message);
  } finally {
    try { await pool.end(); } catch (e) {/* ignore */}
  }
}

runOnce();
