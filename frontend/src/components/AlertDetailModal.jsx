import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import RiskBadge from './admin/RiskBadge';
import {
  X,
  MapPin,
  Clock,
  Radio,
  ExternalLink,
  ShieldAlert,
  Layers,
  CheckCircle2,
} from 'lucide-react';

// Custom beacon marker for modal map
const createBeaconIcon = (severity) => {
  const isCritical = severity === 'critical';
  return L.divIcon({
    className: 'alert-modal-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-8 w-8 rounded-full ${isCritical ? 'bg-red-500' : 'bg-purple-500'} opacity-75 animate-ping"></span>
        <div class="relative flex items-center justify-center w-7 h-7 rounded-full ${isCritical ? 'bg-red-600' : 'bg-purple-600'} text-white font-bold text-xs shadow-lg border-2 border-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.invalidateSize();
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function AlertDetailModal({ isOpen, onClose, alert, zones = [] }) {
  const navigate = useNavigate();

  if (!isOpen || !alert) return null;

  // Resolve lat & lng
  let lat = alert.lat;
  let lng = alert.lng;

  if ((!lat || !lng) && zones.length > 0) {
    const matchedZone = zones.find(
      (z) =>
        (z.zone_id && z.zone_id === alert.zone_id) ||
        (z.village_name && z.village_name.toLowerCase() === (alert.village || '').toLowerCase())
    );
    if (matchedZone) {
      lat = matchedZone.lat;
      lng = matchedZone.lng;
    }
  }

  // Fallback default coordinates if not set (East Khasi Hills / Sohra region)
  const mapLat = lat || 25.32;
  const mapLng = lng || 91.75;
  const center = [mapLat, mapLng];

  const handleOpenFullMap = () => {
    onClose();
    navigate(`/map?lat=${mapLat}&lng=${mapLng}&alert_id=${alert.alert_id || ''}&zone_id=${alert.zone_id || ''}`);
  };

  const imageUrl = alert.photo_url || alert.image_url || alert.image;
  const channels = alert.channels || alert.sent_via || ['app', 'sms'];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D9E2DE] dark:border-[#27272A] flex items-center justify-between bg-[#F5F7F6]/60 dark:bg-[#141418]/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-zinc-400">
                  {alert.alert_id || 'ALERT'}
                </span>
                <RiskBadge severity={alert.severity} size="xs" />
              </div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                {alert.village || 'Sohra'} Sector Directive Location
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Map Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E63946]" />
                <span>Geospatial Location & Impact Area</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                {mapLat.toFixed(4)}°N, {mapLng.toFixed(4)}°E
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-[#D9E2DE] dark:border-[#27272A] shadow-inner">
              <MapContainer
                center={center}
                zoom={13}
                zoomControl={true}
                style={{ height: '240px', width: '100%' }}
                className="z-10"
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics"
                  maxZoom={18}
                  className="map-tiles-satellite"
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={18}
                  className="map-tiles-overlay"
                />
                <Marker position={center} icon={createBeaconIcon(alert.severity)}>
                  <Popup>
                    <div className="text-xs font-bold p-1">
                      {alert.village || 'Hazard Location'} ({alert.zone_id || ''})
                    </div>
                  </Popup>
                </Marker>
                <MapRecenter center={center} />
              </MapContainer>

              <button
                onClick={handleOpenFullMap}
                className="absolute bottom-3 right-3 z-[1000] px-3 py-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-md flex items-center gap-1.5 transition-all"
              >
                <span>Full GIS Map</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Alert Main Message */}
          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
              Official Early Warning Advisory:
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-snug">
              {alert.message}
            </p>
          </div>

          {/* Detailed Hazard Description if provided */}
          {(alert.description || alert.details) && (
            <div className="p-3.5 rounded-xl bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1">
              <strong className="block text-[10px] uppercase font-bold text-[#006B4F] dark:text-emerald-400">
                Detailed Situation Description:
              </strong>
              <p>{alert.description || alert.details}</p>
            </div>
          )}

          {/* Photo attachment if available */}
          {imageUrl && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Field Evidence Photo:
              </span>
              <div className="rounded-xl overflow-hidden border border-[#D9E2DE] dark:border-[#27272A] max-h-48">
                <img
                  src={imageUrl}
                  alt="Hazard photo"
                  className="w-full h-48 object-cover"
                />
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A]">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono">
                TARGET ZONE ID
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {alert.zone_id || 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A]">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono">
                BROADCAST CHANNELS
              </span>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {channels.map((ch) => (
                  <span
                    key={ch}
                    className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-bold text-[9px] uppercase"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A]">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono">
                ISSUED TIMESTAMP
              </span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {new Date(alert.sent_at || alert.timestamp || Date.now()).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A]">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono">
                SECTOR / DISTRICT
              </span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {alert.village || 'Sohra'} ({alert.district || 'East Khasi Hills'})
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#D9E2DE] dark:border-[#27272A] bg-[#F5F7F6]/60 dark:bg-[#141418]/60 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold transition-all"
          >
            Close
          </button>

          <button
            onClick={handleOpenFullMap}
            className="px-4 py-2 rounded-xl bg-[#006B4F] hover:bg-[#00543E] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Open Location on Interactive Map</span>
          </button>
        </div>
      </div>
    </div>
  );
}
