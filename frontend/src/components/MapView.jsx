import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import RiskHeatmap from './RiskHeatmap';
import RoadOverlay from './RoadOverlay';
import VillageMarkers from './VillageMarkers';
import AlertOverlay from './AlertOverlay';
import { Layers, Eye, EyeOff, Map, Satellite, Bell } from 'lucide-react';

/*
 * BASE TILE PROVIDERS — All free, clean, NO API KEY required.
 *
 * Standard (light): CARTO Voyager — crisp English labels, heightened road contrast, no API key
 * Standard (dark):  CARTO Dark — pitch/slate styling with English labels, no API key
 * Satellite:        ESRI World Imagery — high-res aerial, free public tile service, no API key
 * Satellite Overlay: ESRI Boundaries & Places — English labels, admin borders & roads over satellite
 */
const TILE_PROVIDERS = {
  standard_light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: 'abcd',
    className: 'map-tiles-contrast',
  },
  standard_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    className: 'map-tiles-contrast',
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

import { useMap } from 'react-leaflet';

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
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  // Layer visibility state
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  // Base map mode: 'standard' or 'satellite' (defaults to satellite view first)
  const [baseMap, setBaseMap] = useState('satellite');

  const defaultCenter = [25.32, 91.75]; // East Khasi Hills, Sohra-Shillong corridor
  const activeCenter = center && center[0] && center[1] ? center : defaultCenter;

  // Choose tile config based on base map selection + theme
  const activeTile =
    baseMap === 'satellite'
      ? TILE_PROVIDERS.satellite
      : isDark
      ? TILE_PROVIDERS.standard_dark
      : TILE_PROVIDERS.standard_light;

  // Active button style (reused for consistency)
  const activeBtn =
    'bg-[#EAF5F0] text-[#006B4F] dark:bg-emerald-950/40 dark:text-emerald-400 border border-[#006B4F]/30';
  const inactiveBtn =
    'text-slate-600 dark:text-zinc-400 hover:text-[#006B4F] dark:hover:text-emerald-400';

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#D9E2DE] dark:border-zinc-800 bg-white dark:bg-black shadow-md group">

      {/* ── Top Floating GIS Toolbar ────────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-[#D9E2DE] dark:border-zinc-800 shadow-md text-xs">

        {/* Section label */}
        <span className="flex items-center gap-1.5 px-2 py-1 font-bold text-[#006B4F] dark:text-emerald-400 border-r border-[#D9E2DE] dark:border-zinc-800">
          <Layers className="w-3.5 h-3.5 text-[#006B4F] dark:text-emerald-400" />
          <span>{t('map_view.gis_layers')}</span>
        </span>

        {/* ── Base Map Switcher: Standard / Satellite ── */}
        <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setBaseMap('standard')}
            title="Standard Map"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              baseMap === 'standard'
                ? 'bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-[#006B4F]'
            }`}
          >
            <Map className="w-3 h-3" />
            <span>{t('map_view.base_standard', { defaultValue: 'Standard' })}</span>
          </button>
          <button
            onClick={() => setBaseMap('satellite')}
            title="Satellite View"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
              baseMap === 'satellite'
                ? 'bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-[#006B4F]'
            }`}
          >
            <Satellite className="w-3 h-3" />
            <span>{t('map_view.base_satellite', { defaultValue: 'Satellite' })}</span>
          </button>
        </span>

        {/* Divider */}
        <span className="h-5 w-px bg-[#D9E2DE] dark:bg-zinc-700" />

        {/* ── Overlay toggles ── */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showHeatmap ? activeBtn : inactiveBtn
          }`}
        >
          {showHeatmap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{t('map_view.risk_heatmap')}</span>
        </button>

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

        <button
          onClick={() => setShowRoads(!showRoads)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showRoads ? activeBtn : inactiveBtn
          }`}
        >
          {showRoads ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{t('map_view.road_corridors')}</span>
          {roads.filter((r) => r.status === 'blocked' || r.status === 'partial').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#E63946] text-white text-[9px] font-extrabold animate-pulse shadow-xs">
              {roads.filter((r) => r.status === 'blocked' || r.status === 'partial').length} Blocked
            </span>
          )}
        </button>

        <button
          onClick={() => setShowVillages(!showVillages)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
            showVillages ? activeBtn : inactiveBtn
          }`}
        >
          {showVillages ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{t('map_view.villages')}</span>
        </button>
      </div>

      {/* ── Satellite badge (shown in satellite mode) ─────────── */}
      {baseMap === 'satellite' && (
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm border border-white/20 shadow">
          <Satellite className="w-3 h-3" />
          <span>SATELLITE · ESRI</span>
        </div>
      )}

      {/* ── Bottom Floating Legend ────────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-[1000] p-2.5 rounded-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-[#D9E2DE] dark:border-zinc-800 shadow-lg text-[11px] space-y-1.5">
        <div className="font-bold text-[#006B4F] dark:text-emerald-400 mb-1 flex items-center justify-between gap-4">
          <span>{t('map_view.legend_title')}</span>
          <span className="text-[10px] text-slate-500 font-mono">{t('map_view.legend_badge')}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E63946]" />
            <span className="text-slate-600 dark:text-zinc-400">{t('map_view.critical_range')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-slate-600 dark:text-zinc-400">{t('map_view.high_range')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-slate-600 dark:text-zinc-400">{t('map_view.medium_range')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#008060]" />
            <span className="text-slate-600 dark:text-zinc-400">{t('map_view.low_range')}</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-[#D9E2DE] dark:border-zinc-800 flex flex-wrap items-center gap-2.5 text-[10px]">
          <span className="flex items-center gap-1 font-bold text-purple-700 dark:text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse inline-block" /> 📡 Alert Directive
          </span>
          <span className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-[#E63946] animate-pulse inline-block" /> 🚧 Road Blockage
          </span>
        </div>
      </div>

      {/* ── Leaflet Map Canvas ────────────────────────────────── */}
      <MapContainer
        center={activeCenter}
        zoom={zoom}
        zoomControl={false}
        style={{ height, width: '100%' }}
        className="z-10"
      >
        <ChangeView center={activeCenter} zoom={zoom} />
        {/*
          key={activeTile.url} forces a full TileLayer remount when switching
          between Standard and Satellite — ensures tiles reload cleanly.
        */}
        <TileLayer
          key={activeTile.url}
          attribution={activeTile.attribution}
          url={activeTile.url}
          maxZoom={activeTile.maxZoom}
          subdomains={activeTile.subdomains || 'abc'}
          className={activeTile.className || ''}
        />

        {/* English geographic labels and administrative boundaries overlay for satellite mode */}
        {baseMap === 'satellite' && (
          <TileLayer
            key="esri_satellite_labels"
            url={TILE_PROVIDERS.satellite_overlay.url}
            maxZoom={TILE_PROVIDERS.satellite_overlay.maxZoom}
            className={TILE_PROVIDERS.satellite_overlay.className}
          />
        )}

        <ZoomControl position="bottomleft" />

        {/* Risk heatmap overlay — visible in both standard + satellite */}
        {showHeatmap && (
          <RiskHeatmap
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        )}

        {/* Admin alerts & public directives overlay */}
        {showAlerts && (
          <AlertOverlay
            alerts={alerts}
            zones={zones}
            onSelectZone={onSelectZone}
          />
        )}

        {/* Road corridors — visible in both standard + satellite */}
        {showRoads && (
          <RoadOverlay
            roads={roads}
            onStatusUpdate={onUpdateRoadStatus}
          />
        )}

        {/* Village markers — visible in both standard + satellite */}
        {showVillages && (
          <VillageMarkers villages={villages} />
        )}
      </MapContainer>
    </div>
  );
}

