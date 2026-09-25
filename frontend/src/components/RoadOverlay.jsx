import React from 'react';
import { Polyline, Popup, Marker } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Route, AlertOctagon, AlertTriangle, ShieldAlert } from 'lucide-react';
import L from 'leaflet';

const ROAD_STATUS_STYLES = {
  clear: { color: '#008060', weight: 5, dashArray: null },
  partial: { color: '#f59e0b', weight: 5, dashArray: '6, 6' },
  blocked: { color: '#E63946', weight: 6, dashArray: '8, 8' },
};

// Helper function to create custom pulsing Leaflet divIcon for road blockage markers
const createBlockageIcon = (status) => {
  const isBlocked = status === 'blocked';
  const label = isBlocked ? 'ROAD BLOCKED' : 'PASS OBSTRUCTED';
  const bgClass = isBlocked
    ? 'bg-[#E63946] border-red-200'
    : 'bg-[#f59e0b] border-amber-200';
  const pulseClass = isBlocked ? 'bg-red-500' : 'bg-amber-400';

  return L.divIcon({
    className: 'custom-road-blockage-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group">
        <span class="absolute inline-flex h-8 w-8 rounded-full ${pulseClass} opacity-75 animate-ping"></span>
        <div class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgClass} text-white font-extrabold text-[10px] tracking-wider shadow-lg border border-white/90 transform group-hover:scale-110 transition-transform">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            ${
              isBlocked
                ? '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
                : '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
            }
          </svg>
          <span class="whitespace-nowrap font-sans uppercase font-black">${label}</span>
        </div>
      </div>
    `,
    iconSize: [120, 32],
    iconAnchor: [60, 16],
    popupAnchor: [0, -16],
  });
};

// Returns the coordinate closest to the geographic centroid of the road.
// This ensures the blockage marker appears at the most central/interior
// point of the affected segment — guaranteed to land inside the hazard circle
// when road coordinates are placed within the zone.
const getBlockagePoint = (coords) => {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1) return coords[0];

  // Compute centroid (average lat/lng)
  const sumLat = coords.reduce((s, c) => s + c[0], 0);
  const sumLng = coords.reduce((s, c) => s + c[1], 0);
  const cLat = sumLat / coords.length;
  const cLng = sumLng / coords.length;

  // Pick the coordinate with minimum distance to centroid
  let closest = coords[0];
  let minDist = Infinity;
  for (const c of coords) {
    const d = Math.pow(c[0] - cLat, 2) + Math.pow(c[1] - cLng, 2);
    if (d < minDist) { minDist = d; closest = c; }
  }
  return closest;
};

export default function RoadOverlay({ roads = [], onStatusUpdate }) {
  const { t } = useTranslation();
  const { isOfficial } = useAuth();

  return (
    <>
      {roads.map((road) => {
        const style = ROAD_STATUS_STYLES[road.status] || ROAD_STATUS_STYLES.clear;
        const blockagePoint = getBlockagePoint(road.coordinates);
        const isBlockedOrPartial = road.status === 'blocked' || road.status === 'partial';

        const popupContent = (
          <div className="p-1 min-w-[230px] text-xs">
            {/* Header with status banner */}
            <div
              className={`flex items-center gap-1.5 p-2 rounded-lg mb-2 text-white font-bold text-[11px] ${
                road.status === 'blocked'
                  ? 'bg-[#E63946]'
                  : road.status === 'partial'
                  ? 'bg-amber-500'
                  : 'bg-[#008060]'
              }`}
            >
              <Route className="w-4 h-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="uppercase tracking-wider text-[9px] opacity-90 font-mono">
                  {road.status === 'blocked'
                    ? '🚧 ROAD BLOCKAGE ALERT'
                    : road.status === 'partial'
                    ? '⚠️ PARTIAL PASS OBSTRUCTION'
                    : 'CLEAR PASS CORRIDOR'}
                </div>
                <div className="font-extrabold truncate text-xs">{road.name}</div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-[11px] px-0.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">{t('map_popup.current_status')}:</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-white"
                  style={{ backgroundColor: style.color }}
                >
                  {t(`road_status.${road.status}_label`, { defaultValue: road.status })}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-zinc-500">
                <span>Corridor ID: <strong className="font-mono text-slate-700 dark:text-zinc-300">{road.road_id}</strong></span>
                <span>{new Date(road.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {isBlockedOrPartial && (
                <div className="p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 text-[10px] text-red-700 dark:text-red-300 font-medium">
                  <strong>Notice:</strong> Landslide debris or slope instability reported along this corridor. Proceed with extreme caution or use alternative bypass routes.
                </div>
              )}
            </div>

            {/* Official action to update status */}
            {isOfficial && onStatusUpdate && (
              <div className="mt-3 pt-2 border-t border-[#D9E2DE] dark:border-zinc-800">
                <span className="block text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  {t('map_popup.authority_override')}:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {['clear', 'partial', 'blocked'].map((st) => (
                    <button
                      key={st}
                      disabled={road.status === st}
                      onClick={() => onStatusUpdate(road.road_id, st)}
                      className={`py-1 px-1 rounded text-[10px] font-semibold capitalize border transition-all ${
                        road.status === st
                          ? 'bg-[#EAF5F0] text-[#006B4F] font-bold border-[#006B4F]/30 cursor-default'
                          : st === 'blocked'
                          ? 'bg-white dark:bg-zinc-900 hover:bg-[#E63946] hover:text-white border-[#D9E2DE] dark:border-zinc-700'
                          : 'bg-white dark:bg-zinc-900 hover:bg-[#006B4F] hover:text-white border-[#D9E2DE] dark:border-zinc-700'
                      }`}
                    >
                      {t(`road_status.${st}_label`, { defaultValue: st })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

        return (
          <React.Fragment key={road.road_id}>
            {/* Outer Glowing Stroke for Blocked or Partial roads */}
            {isBlockedOrPartial && (
              <Polyline
                positions={road.coordinates}
                pathOptions={{
                  color: style.color,
                  weight: 14,
                  opacity: 0.3,
                  lineCap: 'round',
                }}
              />
            )}

            {/* Main Road Line */}
            <Polyline
              positions={road.coordinates}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                dashArray: style.dashArray,
                opacity: 0.95,
              }}
            >
              <Popup>{popupContent}</Popup>
            </Polyline>

            {/* Pulsing Road Blockage Marker positioned at the centroid-closest point of blocked/partial roads */}
            {isBlockedOrPartial && blockagePoint && (
              <Marker
                position={blockagePoint}
                icon={createBlockageIcon(road.status)}
              >
                <Popup>{popupContent}</Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

