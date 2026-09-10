import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCurrentWeather, getSoilMoisture, getRiskZones, getRiskZoneHistory } from '../api/client';
import PageHeader from '../components/admin/PageHeader';
import SectionCard from '../components/admin/SectionCard';
import RiskBadge from '../components/admin/RiskBadge';
import {
  CloudRain,
  Droplets,
  Wind,
  Gauge,
  Activity,
  Radio,
  RefreshCw,
  Zap,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Signal,
  BatteryCharging,
  Thermometer,
  Layers,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';

export default function WeatherSensorsPage() {
  const { t } = useTranslation();
  const [selectedZoneId, setSelectedZoneId] = useState('');

  // 1. Fetch all real risk zones from API
  const {
    data: zones = [],
    isLoading: isZonesLoading,
    refetch: refetchZones,
  } = useQuery({
    queryKey: ['risk_zones_weather'],
    queryFn: getRiskZones,
    staleTime: 1000 * 60,
  });

  // Current active zone (defaults to first zone if none selected)
  const activeZone = useMemo(() => {
    if (!zones.length) return null;
    if (!selectedZoneId) return zones[0];
    return zones.find((z) => z.zone_id === selectedZoneId) || zones[0];
  }, [zones, selectedZoneId]);

  const activeLat = activeZone?.lat ?? 25.2840;
  const activeLng = activeZone?.lng ?? 91.7325;

  // 2. Fetch real-time weather data for the active zone's coordinates
  const {
    data: weatherData,
    isLoading: isWeatherLoading,
    isFetching: isWeatherFetching,
    refetch: refetchWeather,
  } = useQuery({
    queryKey: ['weather_current', activeLat, activeLng],
    queryFn: () => getCurrentWeather(activeLat, activeLng),
    enabled: Boolean(activeZone),
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30, // 30s auto-refresh
  });

  // 3. Fetch real soil sensor data for all zones
  const {
    data: allSoilSensors = [],
    isLoading: isSoilLoading,
    refetch: refetchSoil,
  } = useQuery({
    queryKey: ['soil_sensors_all'],
    queryFn: () => getSoilMoisture(),
    staleTime: 1000 * 20,
  });

  // 4. Fetch 7-day risk history for active zone
  const { data: zoneHistory } = useQuery({
    queryKey: ['zone_history', activeZone?.zone_id],
    queryFn: () => getRiskZoneHistory(activeZone?.zone_id),
    enabled: Boolean(activeZone?.zone_id),
    staleTime: 1000 * 60,
  });

  // Filter soil sensors for the active zone or all
  const activeZoneSensors = useMemo(() => {
    if (!activeZone) return allSoilSensors;
    const matched = allSoilSensors.filter((s) => s.zone_id === activeZone.zone_id);
    return matched.length > 0 ? matched : allSoilSensors;
  }, [allSoilSensors, activeZone]);

  const handleRefreshAll = () => {
    refetchZones();
    refetchWeather();
    refetchSoil();
  };

  // Real-time telemetry values
  const hasWeatherData = Boolean(weatherData);
  const rain24h = weatherData?.rainfall_24h ?? 0;
  const rain72h = weatherData?.rainfall_72h ?? 0;
  const rain7d = weatherData?.rainfall_7d ?? 0;
  const peakIntensity = weatherData?.rainfall_intensity_peak ?? 0;
  const ari = weatherData?.antecedent_rainfall_index ?? 0;
  const forecast24h = weatherData?.forecast_next_24h ?? 0;
  const displayWeatherValue = (value) => (hasWeatherData ? value : '—');
  const weatherSource = weatherData?.source || 'Live weather temporarily unavailable';

  const isAriCritical = ari > 120;
  const isAriElevated = ari > 80;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader
        kicker={t('weather_page.kicker', 'Meteorological & Subsurface IoT Array')}
        title={t('weather_page.title', 'Live Atmospheric Weather & Soil Telemetry')}
        description={t('weather_page.description', 'High-frequency hydrometeorological sensors, Doppler precipitation telemetry, and slope pore-water saturation monitoring across East Khasi Hills.')}
        badge={
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t('weather_page.doppler_live', 'Live Telemetry (Real-time DB)')}</span>
          </div>
        }
        actions={
          <button
            onClick={handleRefreshAll}
            disabled={isWeatherFetching}
            className="px-3.5 py-2 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isWeatherFetching ? 'animate-spin' : ''}`} />
            <span>{t('common.refresh', 'Refresh Sensors')}</span>
          </button>
        }
      />

      {/* ── Real-Time Zone Selector Bar ─────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#EAF5F0] dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              {t('weather_page.monitoring_station', 'Select Monitoring Sector / Station')}
            </p>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {activeZone ? `${activeZone.village_name} (${activeZone.zone_id})` : 'Loading stations...'}
            </p>
          </div>
        </div>

        {/* Dropdown for selecting any real zone in the database */}
        <div className="flex items-center gap-2">
          <select
            value={activeZone?.zone_id || ''}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-[#006B4F] cursor-pointer"
          >
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.village_name} — {z.zone_id} ({z.severity || z.current_severity || 'monitored'})
              </option>
            ))}
          </select>

          {activeZone && (
            <RiskBadge severity={activeZone.severity || activeZone.current_severity || 'medium'} />
          )}
        </div>
      </div>

      {!isWeatherLoading && !hasWeatherData && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs">
          Live weather for this location is temporarily unavailable. Refresh to retry; zeroes are not displayed as live conditions.
        </div>
      )}

      {/* ── Top Key Meteorological Telemetry Grid ───────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 24h Rainfall */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('sensors.rainfall_24h', '24h Rainfall')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <CloudRain className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400">{displayWeatherValue(rain24h)}</span>
            <span className="text-xs font-bold text-slate-400">mm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (rain24h / 120) * 100)}%` }}
            />
          </div>
        </div>

        {/* 72h Cumulative */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('sensors.rainfall_72h', '72h Cumulative')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Droplets className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{displayWeatherValue(rain72h)}</span>
            <span className="text-xs font-bold text-slate-400">mm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (rain72h / 250) * 100)}%` }}
            />
          </div>
        </div>

        {/* 7-Day Cumulative */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('zone_detail.rainfall_7d', '7-Day Total')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{displayWeatherValue(rain7d)}</span>
            <span className="text-xs font-bold text-slate-400">mm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (rain7d / 500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Peak Intensity */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('sensors.peak_intensity', 'Peak Intensity')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{displayWeatherValue(peakIntensity)}</span>
            <span className="text-xs font-bold text-slate-400">mm/h</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Recorded at peak</p>
        </div>

        {/* Antecedent Rainfall Index (ARI) */}
        <div className={`p-4 rounded-2xl border shadow-xs space-y-2 ${
          isAriCritical
            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
            : isAriElevated
            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
            : 'bg-white dark:bg-[#0D0E10] border-[#D9E2DE] dark:border-[#27272A]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('sensors.ari', 'ARI Index')}
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isAriCritical ? 'bg-red-100 text-red-600 dark:bg-red-900/40' : 'bg-emerald-50 text-[#006B4F] dark:bg-emerald-950/40'
            }`}>
              <Gauge className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${isAriCritical ? 'text-red-600 dark:text-red-400' : 'text-[#006B4F] dark:text-emerald-400'}`}>
              {displayWeatherValue(ari)}
            </span>
            <span className="text-xs font-bold text-slate-400">/ 200</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isAriCritical ? 'bg-red-600' : isAriElevated ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (ari / 200) * 100)}%` }}
            />
          </div>
        </div>

        {/* 24h Forecast */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
              {t('weather_page.forecast_24h', 'Forecast 24h')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#006B4F] dark:text-emerald-400">{displayWeatherValue(forecast24h)}</span>
            <span className="text-xs font-bold text-slate-400">mm</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">{weatherSource}</p>
        </div>
      </div>

      {/* ── Middle: Active Station Subsurface Soil IoT Array & Station Details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Real-time Subsurface Soil Moisture Probes (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <SectionCard
            kicker={t('weather_page.iot_sensor_matrix_kicker', 'Real-time Subsurface IoT Probes')}
            title={t('weather_page.iot_sensor_matrix_title', 'Soil Moisture & Pore Saturation Nodes')}
            subtitle={t('weather_page.iot_sensor_matrix_sub', 'Live telemetry from capacitive moisture sensors deployed across East Khasi Hills landslide slopes.')}
            badge={`${activeZoneSensors.length} ${t('weather_page.active_probes', 'Probes Connected')}`}
          >
            {isSoilLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-3 border-[#006B4F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeZoneSensors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active soil sensors reporting for this sector.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {activeZoneSensors.map((sensor) => {
                  const moisturePercent = Math.round((sensor.moisture || 0) * 100);
                  const isHigh = moisturePercent > 70;
                  const isMedium = moisturePercent >= 50 && moisturePercent <= 70;

                  return (
                    <div
                      key={sensor.sensor_id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isHigh
                          ? 'bg-red-50/40 dark:bg-red-950/15 border-red-200 dark:border-red-900/40'
                          : isMedium
                          ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40'
                          : 'bg-[#F5F7F6]/60 dark:bg-[#141418] border-[#D9E2DE] dark:border-[#27272A]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isHigh ? 'bg-red-500 animate-ping' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <span className="font-mono text-xs font-black text-slate-800 dark:text-white">
                            {sensor.sensor_id}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isHigh
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                            : isMedium
                            ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {isHigh ? 'High Saturation' : isMedium ? 'Moderate' : 'Normal'}
                        </span>
                      </div>

                      {/* Moisture Progress & Number */}
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Volumetric Moisture:
                          </span>
                          <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                            {moisturePercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isHigh ? 'bg-red-600' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${moisturePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="pt-2 border-t border-[#D9E2DE]/60 dark:border-[#27272A]/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Zone: {sensor.zone_id}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sensor.timestamp ? new Date(sensor.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: Station Geo & Telemetry Info (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <SectionCard
            kicker="Geomorphological Metadata"
            title={activeZone?.village_name || 'Station Info'}
            subtitle={`Coordinates: ${activeLat.toFixed(4)}°N, ${activeLng.toFixed(4)}°E`}
          >
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Zone ID:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{activeZone?.zone_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">District:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{activeZone?.district || 'East Khasi Hills'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slope Gradient:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{activeZone?.slope ?? 34.5}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Elevation:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{activeZone?.elevation ?? 1430} m MSL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Risk Score:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">
                    {activeZone?.risk_score ?? activeZone?.current_risk_score ?? '0.75'}
                  </span>
                </div>
              </div>

              {/* Antecedent Alert Notice */}
              <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                isAriCritical
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-900/40 text-red-900 dark:text-red-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {isAriCritical ? <ShieldAlert className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  <span>{isAriCritical ? 'Landslide Trigger Threshold Exceeded' : 'Precipitation Within Safety Limits'}</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  {isAriCritical
                    ? 'Antecedent moisture saturation has surpassed the critical geotechnical threshold (>120). Evacuation protocol recommended for vulnerable slope corridors.'
                    : 'Soil shear strength remains within normal stability parameters. Standard civil surveillance ongoing.'}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Bottom: All-Zones Telemetry & Sensors Master Comparison Table ── */}
      <SectionCard
        kicker="District-Wide Network"
        title="East Khasi Hills Monitored Sectors Telemetry Overview"
        subtitle="Live comparison across all monitored meteorological nodes and risk zones."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#F5F7F6] dark:bg-[#141418] text-slate-600 dark:text-zinc-400 font-bold">
                <th className="p-3">Sector / Zone ID</th>
                <th className="p-3">Village Name</th>
                <th className="p-3">Coordinates</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Risk Score</th>
                <th className="p-3">Slope</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2DE]/60 dark:divide-[#27272A]/60">
              {zones.map((z) => {
                const isSelected = activeZone?.zone_id === z.zone_id;
                return (
                  <tr
                    key={z.zone_id}
                    onClick={() => setSelectedZoneId(z.zone_id)}
                    className={`hover:bg-[#F5F7F6] dark:hover:bg-[#141418] transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/20 font-semibold' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {z.zone_id}
                    </td>
                    <td className="p-3 text-slate-900 dark:text-white font-bold">
                      {z.village_name}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {z.lat ? `${z.lat.toFixed(3)}°N, ${z.lng.toFixed(3)}°E` : '—'}
                    </td>
                    <td className="p-3">
                      <RiskBadge severity={z.severity || z.current_severity || 'low'} />
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {z.risk_score ?? z.current_risk_score ?? '—'}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {z.slope ? `${z.slope}°` : '32°'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedZoneId(z.zone_id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#006B4F]/10 dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 font-bold hover:bg-[#006B4F] hover:text-white transition-all"
                      >
                        Inspect Telemetry
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
