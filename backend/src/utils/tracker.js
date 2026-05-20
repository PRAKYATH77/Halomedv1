const DELIVERY_SIMULATION_STEP_SECONDS = 10;
const DELIVERY_SIMULATION_STEPS = 300 / DELIVERY_SIMULATION_STEP_SECONDS; // 300s total

const interpolatePoint = (start, end, progress) => ({
  lat: start.lat + (end.lat - start.lat) * progress,
  lng: start.lng + (end.lng - start.lng) * progress,
});

// buildTrackingRoute copied from routes helper for parity
const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};
const roundCoordinate = (v) => Number(Number(v).toFixed(6));
const DELIVERY_HUB = { lat: 12.9716, lng: 77.5946 };
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

export function startTrackingSimulator(pool) {
  const interval = setInterval(async () => {
    try {
      const [rows] = await pool.query(
        `SELECT ot.order_id, ot.courier_lat, ot.courier_lng, ot.progress, co.delivery_address, co.city, co.zip_code
         FROM order_tracking ot
         JOIN customer_orders co ON co.order_id = ot.order_id
         WHERE co.status = 'out_for_delivery' AND (ot.progress IS NULL OR ot.progress < 100)`
      );

      for (const r of rows) {
        const order = { order_id: r.order_id, delivery_address: r.delivery_address, city: r.city, zip_code: r.zip_code };
        const { origin, destination } = buildTrackingRoute(order);
        const currentProgress = Number(r.progress || 0);
        const stepPercent = Math.round(100 / DELIVERY_SIMULATION_STEPS);
        const newProgress = Math.min(100, currentProgress + stepPercent);
        const progressRatio = newProgress / 100;
        const pos = interpolatePoint(origin, destination, progressRatio);

        await pool.query(
          `UPDATE order_tracking SET courier_lat = ?, courier_lng = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
          [pos.lat, pos.lng, newProgress, r.order_id]
        );

        // If delivery completed, also mark the order as received
        if (newProgress >= 100) {
          try {
            await pool.query(
              `UPDATE customer_orders SET status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
              [r.order_id]
            );
          } catch (e) {
            console.warn('Failed to mark order as received for', r.order_id, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('Tracker simulator error:', e.message);
    }
  }, DELIVERY_SIMULATION_STEP_SECONDS * 1000);

  return interval;
}

export function stopTrackingSimulator(interval) {
  if (interval) clearInterval(interval);
}
