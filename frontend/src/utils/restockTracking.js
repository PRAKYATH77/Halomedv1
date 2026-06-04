const SUPPLIER_HUB = { lat: 12.9675, lng: 77.6048 };
const DELIVERY_STORE_HUB = { lat: 12.9581, lng: 77.6114 };
const SIMULATION_DURATION_SECONDS = 240;
const SIMULATION_STEP_SECONDS = 10;
const SIMULATION_STEPS = SIMULATION_DURATION_SECONDS / SIMULATION_STEP_SECONDS;

const hashString = (value = '') => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const roundCoordinate = (value) => Number(value.toFixed(6));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const interpolatePoint = (start, end, progress) => ({
  lat: start.lat + (end.lat - start.lat) * progress,
  lng: start.lng + (end.lng - start.lng) * progress,
});

const buildRoute = (request) => {
  const seed = `${request.request_id}-${request.medicine_name || ''}-${request.quantity_requested || ''}`;
  const hash = hashString(seed);
  const latOffset = 0.006 + (hash % 400) / 100000;
  const lngOffset = 0.006 + (Math.floor(hash / 400) % 400) / 100000;
  const latDirection = hash % 2 === 0 ? 1 : -1;
  const lngDirection = Math.floor(hash / 2) % 2 === 0 ? 1 : -1;

  return {
    origin: {
      lat: roundCoordinate(SUPPLIER_HUB.lat + latDirection * latOffset),
      lng: roundCoordinate(SUPPLIER_HUB.lng + lngDirection * lngOffset),
    },
    destination: DELIVERY_STORE_HUB,
  };
};

const getElapsedSeconds = (timestamp) => {
  if (!timestamp) return 0;
  return Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 1000);
};

export const buildRestockTrackingSnapshot = (request) => {
  if (!request || !['assigned', 'out_for_delivery', 'delivered'].includes(request.supplier_status)) {
    return null;
  }

  const { origin, destination } = buildRoute(request);
  const elapsedSeconds = getElapsedSeconds(request.supplier_assigned_at || request.approved_at || request.created_at);
  const stepsCompleted = request.supplier_status === 'delivered'
    ? SIMULATION_STEPS
    : clamp(Math.floor(elapsedSeconds / SIMULATION_STEP_SECONDS), 0, SIMULATION_STEPS);
  const progress = SIMULATION_STEPS === 0 ? 0 : stepsCompleted / SIMULATION_STEPS;
  const courierPosition = request.supplier_status === 'delivered'
    ? destination
    : interpolatePoint(origin, destination, progress);
  const etaMinutes = request.supplier_status === 'delivered'
    ? 0
    : Math.max(0, Math.ceil((SIMULATION_DURATION_SECONDS - elapsedSeconds) / 60));

  return {
    origin,
    destination,
    courierPosition,
    progress: Math.round(progress * 100),
    etaMinutes,
    liveLabel: request.supplier_status === 'delivered'
      ? 'Arrived at delivery store'
      : request.supplier_status === 'out_for_delivery'
        ? 'On the way to delivery store'
        : 'Waiting for pickup',
  };
};
