import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import RiskHeatmap from './RiskHeatmap';
import RealTimeRiskOverlay from './RealTimeRiskOverlay';
import RoadOverlay from './RoadOverlay';
import VillageMarkers from './VillageMarkers';
import AlertOverlay from './AlertOverlay';
import { Layers, Eye, EyeOff, Map, Satellite, Activity, Radio, AlertTriangle } from 'lucide-react';

/*
 * BASE TILE PROVIDERS — 100% Free, NO API Key or Watermark, High Reliability.
 *
 * Satellite (DEFAULT): ESRI World Imagery + ESRI English Place Names & Road Labels
 * Standard Light:     OSM standard tiles (worldwide, no key) / ESRI World Topo
 * Standard Dark:      ESRI Dark Gray Canvas (dark mode, crisp, no key)
 */
const TILE_PROVIDERS = {
  standard_light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: 'abc',
    className: 'map-tiles-contrast',
  },
  standard_dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
    subdomains: '',
    className: 'map-tiles-contrast',
  },
  standard_dark_labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '',
    maxZoom: 16,
    subdomains: '',
    className: 'map-tiles-overlay',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 18,
    subdomains: '',
    className: 'map-tiles-satellite',
  },
  satellite_overlay: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '',
    maxZoom: 18,
    subdomains: '',
    className: 'map-tiles-overlay',
  },
};

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && center[0] && center[1]) {
      map.flyTo(center, zoom || 13, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MapView({
  zones = [],
  roads = [],
  villages = [],
  alerts = [],
  selectedZoneId = null,
  onSelectZone,
  onUpdateRoadStatus,
  height = '500px',
  center = null,
  zoom = 11,
  showRealTime = true,
  onToggleRealTime,
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  // Layer visibility state
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRealTimeLayer, setShowRealTimeLayer] = useState(showRealTime);
  const [showRoads, setShowRoads] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  // Base map mode: DEFAULT IS SATELLITE
  const [baseMap, setBaseMap] = useState('satellite');

  // Sync external showRealTime changes
  useEffect(() => {
    setShowRealTimeLayer(showRealTime);
  }, [showRealTime]);

  const defaultCenter = [25.32, 91.75]; // East Khasi Hills, Sohra-Shillong corridor
  const activeCenter = center && center[0] && center[1] ? center : defaultCenter;

  const activeTile =
    baseMap === 'satellite'
      ? TILE_PROVIDERS.satellite
      : isDark
      ? TILE_PROVIDERS.standard_dark
      : TILE_PROVIDERS.standard_light;

  const activeBtn =
    'bg-[#EAF5F0] text-[#006B4F] dark:bg-emerald-950/40 dark:text-emerald-400 border border-[#006B4F]/30';
  const inactiveBtn =
    'text-slate-600 dark:text-zinc-400 hover:text-[#006B4F] dark:hover:text-emerald-400';

  const handleToggleRealTime = () => {
    const nextState = !showRealTimeLayer;
    setShowRealTimeLayer(nextState);
    onToggleRealTime?.(nextState);
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#D9E2DE] dark:border-zinc-800 bg-white dark:bg-black shadow-md group">
      {/* ── Top Floating GIS Toolbar ────────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-[#D9E2DE] dark:border-zinc-800 shadow-md text-xs">
        {/* Section label */}
        <span className="flex items-center gap-1.5 px-2 py-1 font-bold text-[#006B4F] dark:text-emerald-400 border-r border-[#D9E2DE] dark:border-zinc-800">
          <Layers className="w-3.5 h-3.5 text-[#006B4F] dark:text-emerald-400" />
          <span>GIS Layers</span>
        </span>

        {/* Base Map Switcher: Default Satellite */}
        <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setBaseMap('satellite')}
            title="Satellite Aerial View (Default)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              baseMap === 'satellite'
                ? 'bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-[#006B4F]'
            }`}
          >
            <Satellite className="w-3 h-3" />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => setBaseMap('standard')}
            title="Standard Vector Map"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              baseMap === 'standard'
                ? 'bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-[#006B4F]'
            }`}
          >
            <Map className="w-3 h-3" />
            <span>Standard</span>
          </button>
        </span>

        {/* Divider */}
        <span className="h-5 w-px bg-[#D9E2DE] dark:bg-zinc-700" />

        {/* Continuous Geographical Risk Heatmap Toggle */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showHeatmap ? activeBtn : inactiveBtn
          }`}
          title="Toggle Continuous Geographical Risk Heatmap Surface"
        >
          {showHeatmap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Risk Heatmap</span>
        </button>

        {/* Real-Time Live Telemetry Toggle */}
        <button
          onClick={handleToggleRealTime}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showRealTimeLayer
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xs'
              : inactiveBtn
          }`}
          title="Toggle Real-Time Risk & Live Telemetry Stream"
        >
          <Activity className={`w-3.5 h-3.5 ${showRealTimeLayer ? 'text-emerald-500 animate-pulse' : ''}`} />
          <span>Real-Time</span>
          {showRealTimeLayer && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-0.5" />
          )}
        </button>

        {/* Directives Toggle */}
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showAlerts ? activeBtn : inactiveBtn
          }`}
        >
          {showAlerts ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Directives</span>
          {alerts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-extrabold animate-pulse shadow-xs">
              {alerts.length} Active
            </span>
          )}
        </button>

        {/* Road Corridors Toggle */}
        <button
          onClick={() => setShowRoads(!showRoads)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showRoads ? activeBtn : inactiveBtn
          }`}
        >
          {showRoads ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Road Corridors</span>
          {roads.filter((r) => r.status === 'blocked' || r.status === 'partial').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#E63946] text-white text-[9px] font-extrabold animate-pulse shadow-xs">
              {roads.filter((r) => r.status === 'blocked' || r.status === 'partial').length} Blocked
            </span>
          )}
        </button>

        {/* Villages Toggle */}
        <button
          onClick={() => setShowVillages(!showVillages)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showVillages ? activeBtn : inactiveBtn
          }`}
        >
          {showVillages ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Villages</span>
        </button>
      </div>

      {/* Satellite badge */}
      {baseMap === 'satellite' && (
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm border border-white/20 shadow">
          <Satellite className="w-3 h-3" />
          <span>SATELLITE · ESRI</span>
        </div>
      )}

      {/* ── Continuous Geographical Heatmap & Hazard Legend ──────── */}
      <div className="absolute bottom-3 right-3 z-[1000] p-3 rounded-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-[#D9E2DE] dark:border-zinc-800 shadow-xl text-[11px] space-y-2 min-w-[210px]">
        <div className="font-extrabold text-[#006B4F] dark:text-emerald-400 flex items-center justify-between gap-4">
          <span>Hazard Risk Legend</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 font-mono">
            NER GRID
          </span>
        </div>

        {/* Continuous Gradient Bar Matching Geographical Heatmap */}
        <div className="space-y-1">
          <div className="h-3 w-full rounded-md bg-gradient-to-r from-[#1a9850] via-[#fee08b] via-[#fdae61] to-[#d73027] border border-black/20 shadow-inner"></div>
          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-600 dark:text-zinc-400">
            <span>Low (0.0)</span>
            <span>Med (0.5)</span>
            <span>High (0.7)</span>
            <span>Crit (1.0)</span>
          </div>
        </div>

        {/* Indicators and overlay states */}
        <div className="pt-1.5 border-t border-[#D9E2DE] dark:border-zinc-800 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1 font-bold text-purple-700 dark:text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse inline-block" /> Directive
          </span>
          <span className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-[#E63946] animate-pulse inline-block" /> Blocked Road
          </span>
          <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" /> Real-Time Node
          </span>
          <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Pass Caution
          </span>
        </div>
      </div>

      {/* ── Leaflet Map Container ───────────────────────────────── */}
      <MapContainer
        center={activeCenter}
        zoom={zoom}
        zoomControl={false}
        style={{ height, width: '100%' }}
        className="z-10"
      >
        <ChangeView center={activeCenter} zoom={zoom} />
        
        <TileLayer
          key={`${baseMap}_${activeTile.url}`}
          attribution={activeTile.attribution}
          url={activeTile.url}
          maxZoom={activeTile.maxZoom}
          subdomains={activeTile.subdomains || 'abc'}
          className={activeTile.className || ''}
        />

        {baseMap === 'satellite' && (
          <TileLayer
            key="esri_satellite_labels"
            url={TILE_PROVIDERS.satellite_overlay.url}
            maxZoom={TILE_PROVIDERS.satellite_overlay.maxZoom}
            className={TILE_PROVIDERS.satellite_overlay.className}
          />
        )}

        {baseMap === 'standard' && isDark && (
          <TileLayer
            key="esri_dark_labels"
            url={TILE_PROVIDERS.standard_dark_labels.url}
            maxZoom={TILE_PROVIDERS.standard_dark_labels.maxZoom}
            className={TILE_PROVIDERS.standard_dark_labels.className}
          />
        )}

        <ZoomControl position="bottomleft" />

        {/* 1. Continuous Geographical Surface Heatmap */}
        {showHeatmap && (
          <RiskHeatmap
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        )}

        {/* 2. Real-Time Radar Telemetry Overlay */}
        {showRealTimeLayer && (
          <RealTimeRiskOverlay
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        )}

        {/* 3. Directives & Warnings */}
        {showAlerts && (
          <AlertOverlay
            alerts={alerts}
            zones={zones}
            onSelectZone={onSelectZone}
          />
        )}

        {/* 4. Road Infrastructure Pass Overlay */}
        {showRoads && (
          <RoadOverlay
            roads={roads}
            onStatusUpdate={onUpdateRoadStatus}
          />
        )}

        {/* 5. Settlement / Village Markers */}
        {showVillages && (
          <VillageMarkers villages={villages} />
        )}
      </MapContainer>
    </div>
  );
}
