import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FitBounds({ bounds }) {
  const map = useMap();
  React.useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bounds]);
  return null;
}

function MapResizeHandler({ bounds }) {
  const map = useMap();

  React.useEffect(() => {
    const resizeAndFit = (delay = 50) => {
      setTimeout(() => {
        try {
          map.invalidateSize();
          if (bounds) map.fitBounds(bounds, { padding: [30, 30] });
        } catch (e) {
          // ignore if map not ready
        }
      }, delay);
    };

    const onToggle = () => resizeAndFit(300); // when toggle occurs, wait for transition
    const onTransitionEnd = () => resizeAndFit(50); // when transition finishes, quickly resize
    const onResize = () => resizeAndFit(50);

    window.addEventListener('sidebar:toggle', onToggle);
    window.addEventListener('sidebar:transitionend', onTransitionEnd);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('sidebar:toggle', onToggle);
      window.removeEventListener('sidebar:transitionend', onTransitionEnd);
      window.removeEventListener('resize', onResize);
    };
  }, [map, bounds]);

  return null;
}

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistance = (start, end) => {
  const deltaLat = toRadians(end[0] - start[0]);
  const deltaLng = toRadians(end[1] - start[1]);
  const lat1 = toRadians(start[0]);
  const lat2 = toRadians(end[0]);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

const interpolatePoint = (start, end, progress) => ({
  lat: start[0] + (end[0] - start[0]) * progress,
  lng: start[1] + (end[1] - start[1]) * progress,
});

const getRouteLength = (routePoints) => routePoints.reduce((total, point, index) => {
  if (index === 0) return 0;
  return total + haversineDistance(routePoints[index - 1], point);
}, 0);

const splitRouteAtProgress = (routePoints, progress) => {
  if (!routePoints || routePoints.length < 2) {
    return { travelledPath: routePoints || [], remainingPath: [], courierPoint: null };
  }

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const totalDistance = getRouteLength(routePoints);

  if (totalDistance === 0) {
    const fallback = { lat: routePoints[0][0], lng: routePoints[0][1] };
    return { travelledPath: [routePoints[0]], remainingPath: routePoints.slice(1), courierPoint: fallback };
  }

  const targetDistance = totalDistance * clampedProgress;
  const travelledPath = [routePoints[0]];
  let travelledDistance = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    const start = routePoints[index - 1];
    const end = routePoints[index];
    const segmentLength = haversineDistance(start, end);

    if (travelledDistance + segmentLength < targetDistance) {
      travelledPath.push(end);
      travelledDistance += segmentLength;
      continue;
    }

    const segmentProgress = segmentLength === 0 ? 0 : (targetDistance - travelledDistance) / segmentLength;
    const courierPoint = interpolatePoint(start, end, segmentProgress);
    const courierTuple = [courierPoint.lat, courierPoint.lng];

    return {
      travelledPath: [...travelledPath, courierTuple],
      remainingPath: [courierTuple, ...routePoints.slice(index)],
      courierPoint,
    };
  }

  const lastPoint = routePoints[routePoints.length - 1];
  return {
    travelledPath: routePoints,
    remainingPath: [],
    courierPoint: { lat: lastPoint[0], lng: lastPoint[1] },
  };
};

export default function TrackingMap({ snapshot, className = '', height = 420 }) {
  const [routePoints, setRoutePoints] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');

  useEffect(() => {
    if (!snapshot?.origin || !snapshot?.destination) {
      setRoutePoints(null);
      setRouteStatus('idle');
      return undefined;
    }

    const controller = new AbortController();

    const loadRoute = async () => {
      try {
        setRouteStatus('loading');
        const { origin, destination } = snapshot;
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=false`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Routing request failed with status ${response.status}`);
        }

        const data = await response.json();
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          throw new Error('Route geometry was empty');
        }

        setRoutePoints(coordinates.map(([lng, lat]) => [lat, lng]));
        setRouteStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) return;

        setRoutePoints([
          [snapshot.origin.lat, snapshot.origin.lng],
          [snapshot.destination.lat, snapshot.destination.lng],
        ]);
        setRouteStatus('fallback');
      }
    };

    loadRoute();

    return () => controller.abort();
  }, [snapshot?.origin?.lat, snapshot?.origin?.lng, snapshot?.destination?.lat, snapshot?.destination?.lng]);

  const bounds = useMemo(() => {
    if (!snapshot?.origin || !snapshot?.destination) return null;

    const mapPoints = routePoints && routePoints.length > 0
      ? routePoints
      : [
        [snapshot.origin.lat, snapshot.origin.lng],
        [snapshot.destination.lat, snapshot.destination.lng],
      ];

    const points = [...mapPoints];

    if (snapshot.courierPosition) {
      points.push([snapshot.courierPosition.lat, snapshot.courierPosition.lng]);
    }

    return L.latLngBounds(points);
  }, [routePoints, snapshot]);

  if (!snapshot?.origin || !snapshot?.destination || !snapshot?.courierPosition) {
    return (
      <div className={`rounded-3xl border border-gray-200 bg-white shadow-lg p-6 ${className}`}>
        <p className="text-gray-600">Live location isn’t available for this order yet.</p>
      </div>
    );
  }

  const hub = [snapshot.origin.lat, snapshot.origin.lng];
  const destination = [snapshot.destination.lat, snapshot.destination.lng];
  const progress = Math.min(1, Math.max(0, (snapshot.progress ?? 0) / 100));
  const routePath = routePoints && routePoints.length > 1 ? routePoints : [hub, destination];
  const routeProgress = splitRouteAtProgress(routePath, progress);
  const courier = routeProgress.courierPoint
    ? [routeProgress.courierPoint.lat, routeProgress.courierPoint.lng]
    : [snapshot.courierPosition.lat, snapshot.courierPosition.lng];

  return (
    <div className={`rounded-3xl overflow-hidden border border-sky-200 bg-white shadow-lg ${className}`}>
      <div style={{ height }} className="w-full">
        <MapContainer center={courier} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds bounds={bounds} />
          <MapResizeHandler bounds={bounds} />

          <Polyline positions={routePath} pathOptions={{ color: '#cbd5e1', weight: 6, opacity: 0.7 }} />
          <Polyline positions={routeProgress.travelledPath} pathOptions={{ color: '#0f766e', weight: 5, opacity: 0.95 }} />
          {routeProgress.remainingPath.length > 1 && (
            <Polyline positions={routeProgress.remainingPath} pathOptions={{ color: '#0284c7', weight: 4, opacity: 0.75, dashArray: '8 10' }} />
          )}

          <Marker position={hub} />
          <Marker position={destination} />
          <Marker position={courier} />
        </MapContainer>
      </div>

      <div className="p-4 flex items-center justify-between gap-3 bg-gradient-to-r from-sky-50 to-blue-50">
        <div>
          <p className="text-sm font-semibold text-gray-800">Courier is moving (simulated)</p>
          <p className="text-xs text-gray-600">Updates every 10 seconds</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">ETA</p>
          <p className="text-lg font-black text-blue-700">{snapshot.etaMinutes ?? '—'} min</p>
        </div>
      </div>
      <div className="px-4 pb-4 text-xs text-gray-500">
        Route source: {routeStatus === 'ready' ? 'road network' : 'fallback route'}
      </div>
    </div>
  );
}

