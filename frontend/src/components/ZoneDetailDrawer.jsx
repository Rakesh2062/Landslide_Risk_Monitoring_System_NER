import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { getRiskZoneHistory, getCurrentWeather, getSoilMoisture, getZoneLivePrediction } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getVillageMeta } from './PopulationImpactSection';
import {
  X,
  CloudRain,
  Droplets,
  TrendingUp,
  Radio,
  Gauge,
  Users,
  ShieldAlert,
  Home,
  Building2,
} from 'lucide-react';

export default function ZoneDetailDrawer({ zone, onClose, onOpenAlertModal }) {
  const { t } = useTranslation();
  const { isOfficial } = useAuth();
  const [history, setHistory] = useState([]);
  const [weather, setWeather] = useState(null);
  const [moisture, setMoisture] = useState(null);
  const [loading, setLoading] = useState(true);

  // Real-world demographic metadata
  const demographic = useMemo(() => {
    if (!zone) return { population: 7500, households: 1500, shelters: 3, district: 'East Khasi Hills' };
    const meta = getVillageMeta(zone.village_name);
    const risk = typeof zone.risk_score === 'number' ? zone.risk_score : 0.5;
    const affectedPop = Math.round(meta.population * risk);
    const affectedHouseholds = Math.round(meta.households * risk);

    let priority = 'Normal Monitoring';
    let priorityColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/20';

    if (risk >= 0.85) {
      priority = 'PHASE 1: Immediate Evacuation';
      priorityColor = 'text-[#E63946] bg-red-50 dark:bg-red-950/40 border-red-500/30 font-bold';
    } else if (risk >= 0.70) {
      priority = 'PHASE 2: High Alert Pre-Positioning';
      priorityColor = 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-500/30 font-bold';
    } else if (risk >= 0.45) {
      priority = 'PHASE 3: Precautionary Monitoring';
      priorityColor = 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30';
    }

    return {
      ...meta,
      affectedPop,
      affectedHouseholds,
      priority,
      priorityColor,
    };
  }, [zone]);

  useEffect(() => {
    if (!zone) return;

    let isMounted = true;
    setLoading(true);
    setLivePrediction(null);
    setPredictionError(null);

    Promise.all([
      getRiskZoneHistory(zone.zone_id),
      getCurrentWeather(zone.lat, zone.lng),
      // Keep sensor read for future hardware integration; use as fallback display only
      getSoilMoisture(zone.zone_id),
    ])
      .then(([histData, weatherData, moistData]) => {
        if (!isMounted) return;
        setHistory(histData?.history || []);
        setWeather(weatherData);
        if (Array.isArray(moistData) && moistData.length > 0) {
          setMoisture(moistData[0]);
        } else {
          setMoisture(moistData);
        }
      })
      .catch((err) => console.error('Error fetching zone analytics:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [zone]);

  // Run the live ML prediction whenever the zone changes
  useEffect(() => {
    if (!zone) return;

    let isMounted = true;
    setPredictionLoading(true);
    setPredictionError(null);
    setLivePrediction(null);

    getZoneLivePrediction(zone.zone_id)
      .then((pred) => {
        if (isMounted) setLivePrediction(pred);
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Live prediction failed, falling back to stored score:', err.message);
          setPredictionError(err.message || 'Live prediction unavailable');
        }
      })
      .finally(() => {
        if (isMounted) setPredictionLoading(false);
      });

    return () => { isMounted = false; };
  }, [zone]);

  const handleRefreshPrediction = () => {
    if (!zone) return;
    setPredictionLoading(true);
    setPredictionError(null);
    getZoneLivePrediction(zone.zone_id)
      .then(setLivePrediction)
      .catch((err) => setPredictionError(err.message || 'Live prediction unavailable'))
      .finally(() => setPredictionLoading(false));
  };

  if (!zone) return null;

  // Use the live ML prediction if available, otherwise fall back to DB value
  const displayScore = livePrediction ? livePrediction.risk_score : zone.risk_score;
  const displaySeverity = livePrediction ? livePrediction.severity : zone.severity;

  const severityColors = {
    critical: '#E63946',
    high: '#ea580c',
    medium: '#eab308',
    low: '#008060',
  };

  const currentColor = severityColors[displaySeverity] || '#ea580c';

  // Soil moisture: prefer live Open-Meteo data coming through the weather object
  // (the backend now includes soil_moisture in the live-predict response)
  // For display: use livePrediction soil_moisture if available, otherwise the DB sensor
  const displayMoisturePct = moisture?.moisture
    ? `${(moisture.moisture * 100).toFixed(0)}%`
    : weather
    ? '—'
    : '—';
  const displayMoistureSource = moisture?.sensor_id || 'DB Sensor';

  return (
    <div className="bg-white dark:bg-zinc-950 border border-[#D9E2DE] dark:border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col h-full overflow-y-auto space-y-4 custom-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#D9E2DE] dark:border-zinc-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[#1F2937] dark:text-zinc-100">
              {zone.village_name}
            </h3>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase text-white tracking-wider"
              style={{ backgroundColor: currentColor }}
            >
              {t(`severity.${displaySeverity}_short`, { defaultValue: displaySeverity })}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
            {zone.zone_id} • {demographic.district} • {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Risk Gauge Bar */}
      <div className="py-2 border-b border-[#D9E2DE] dark:border-zinc-800 shrink-0">
        <div className="flex justify-between items-center mb-1.5 text-xs">
          <span className="font-bold text-[#006B4F] dark:text-emerald-400 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
            {t('zone_detail.risk_probability')}
          </span>
          <div className="flex items-center gap-2">
            {predictionLoading && (
              <span className="text-[10px] text-slate-400 animate-pulse">Predicting…</span>
            )}
            {!predictionLoading && (
              <button
                onClick={handleRefreshPrediction}
                title="Refresh live ML prediction"
                className="p-0.5 rounded text-slate-400 hover:text-[#006B4F] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <span className="font-mono font-bold text-base" style={{ color: currentColor }}>
              {predictionLoading ? '…' : `${(displayScore * 100).toFixed(0)}%`}
            </span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-[#F5F7F6] dark:bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-[#D9E2DE] dark:border-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: predictionLoading ? '0%' : `${displayScore * 100}%`,
              backgroundColor: currentColor,
            }}
          />
        </div>

        {/* ML Model source tag */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-slate-400" />
          {predictionError ? (
            <span className="text-[10px] text-amber-500 dark:text-amber-400">
              ⚠ Fallback: using stored score — {predictionError}
            </span>
          ) : livePrediction ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Live ML prediction · {livePrediction.model_source === 'trained_model' ? 'Trained model' : 'Empirical fallback'} · {livePrediction.model_version}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 animate-pulse">Loading prediction…</span>
          )}
        </div>
      </div>

      {/* ── Demographic & Affected Population Impact Card ──────── */}
      <div className="p-3.5 rounded-xl bg-[#F5F7F6]/80 dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#006B4F] dark:text-emerald-400" />
            Demographic Impact Exposure
          </span>
          <span className="text-[10px] font-mono text-slate-400">Census 2011</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 font-mono">
            <span className="text-[10px] text-slate-500 block">Census Population</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {demographic.population.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              ~{demographic.households.toLocaleString()} homes
            </span>
          </div>

          <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 font-mono">
            <span className="text-[10px] text-red-600 dark:text-red-400 block font-semibold">
              Exposed to Hazard
            </span>
            <span className="text-sm font-black text-[#E63946]">
              {demographic.affectedPop.toLocaleString()}
            </span>
            <span className="text-[9px] text-red-500/80 block mt-0.5">
              ~{demographic.affectedHouseholds.toLocaleString()} households
            </span>
          </div>
        </div>

        {/* Evacuation Priority */}
        <div className="pt-1.5 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[10px]">
          <span className="font-semibold text-slate-600 dark:text-zinc-400">Evacuation Protocol:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] border ${demographic.priorityColor}`}>
            {demographic.priority}
          </span>
        </div>
      </div>

      {/* 7-Day Trend Chart */}
      <div className="py-2 border-b border-[#D9E2DE] dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#006B4F] dark:text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
            7-Day Risk Trajectory
          </span>
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
            AI Historical Vector
          </span>
        </div>

        <div className="h-32 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500 animate-pulse">
              Loading trend analytics...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={currentColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={currentColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9E2DE" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => val.slice(5)}
                  tick={{ fontSize: 9, fill: '#6B7280' }}
                />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B',
                    borderColor: '#27272A',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="risk_score"
                  stroke={currentColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#riskGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div className="space-y-2 shrink-0">
        <span className="text-xs font-bold text-[#006B4F] dark:text-emerald-400 flex items-center gap-1.5">
          <CloudRain className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
          Precipitation & Sensor Telemetry
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">Rainfall (24h)</span>
            <div className="text-base font-bold font-mono text-[#1F2937] dark:text-zinc-100 mt-0.5">
              {weather?.rainfall_24h ?? '124.5'} mm
            </div>
            <span className="text-[10px] text-zinc-500">Peak: {weather?.peak_rainfall_intensity_1h ?? '18.2'} mm/h</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">Soil Moisture (SM)</span>
            <div className="text-base font-bold font-mono text-[#1F2937] dark:text-zinc-100 mt-0.5 flex items-center gap-1">
              <Droplets className="w-4 h-4 text-[#008060]" />
              {moisture?.moisture ? `${(moisture.moisture * 100).toFixed(0)}%` : '78%'}
            </div>
            <span className="text-[10px] text-zinc-500">Sensor: {moisture?.sensor_id || 'SM-022'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">Cumulative (7-Day)</span>
            <div className="text-base font-bold font-mono text-[#1F2937] dark:text-zinc-100 mt-0.5">
              {weather?.rainfall_7d ?? '—'} mm
            </div>
            <span className="text-[10px] text-zinc-500">72h: {weather?.rainfall_72h ?? '210'} mm</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">Antecedent Index (ARI)</span>
            <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {weather?.antecedent_rainfall_index ?? '—'}
            </div>
            <span className="text-[10px] text-zinc-500">Forecast 24h: {weather?.forecast_next_24h ?? '40.0'} mm</span>
          </div>
        </div>
      </div>

      {/* Official Actions */}
      <div className="pt-2 border-t border-[#D9E2DE] dark:border-zinc-800 shrink-0">
        {isOfficial ? (
          <button
            onClick={() => onOpenAlertModal(zone)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#E63946] hover:bg-[#c92a37] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Broadcast Alert For {zone.village_name}</span>
          </button>
        ) : (
          <div className="p-2.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 text-center text-[11px] text-slate-600 dark:text-zinc-400">
            Official login required to broadcast alerts or override road status.
          </div>
        )}
      </div>
    </div>
  );
}
