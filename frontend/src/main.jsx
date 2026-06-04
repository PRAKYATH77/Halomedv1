import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'leaflet/dist/leaflet.css';
import './styles/index.css';
import { AuthProvider } from './context/AuthContext';
import L from 'leaflet';

// Fix Leaflet's default icon paths when bundlers change asset locations
try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  });
} catch (err) {
  // If Leaflet isn't available yet (e.g. missing node_modules), warn and continue.
  // The development server will still need `npm install` to resolve the package.
  // This prevents runtime crashes related to icon paths.
  console.warn('Leaflet icon fix could not be applied:', err && err.message ? err.message : err);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
