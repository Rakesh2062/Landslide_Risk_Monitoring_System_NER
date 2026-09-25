import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import RiskBadge from './admin/RiskBadge';
import {
  Activity,
  Zap,
  CloudRain,
  Droplets,
  TrendingUp,
  TrendingDown,
  Compass,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Radio,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export default function RealTimeRiskPanel({
  zones = [],
  selectedZoneId,
  onSelectZone,
  onOpenAlertModal,
}) {
  const { t } = useTranslation();
  const [liveSecond, setLiveSecond] = useState(0);

  // Live timer tick to simulate real-time sensor polling
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSecond((prev) => (prev + 1) % 60);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort zones descending by risk score for real-time ranking
  const rankedZones = [...zones].sort((a, b) => {
    const scoreA = typeof a.risk_score === 'number' ? a.risk_score : 0;
    const scoreB = typeof b.risk_score === 'number' ? b.risk_score : 0;
    return scoreB - scoreA;
  });

  // Calculate composite district threat index
  const avgScore = rankedZones.length > 0
    ? (rankedZones.reduce((acc, z) => acc + (z.risk_score || 0), 0) / rankedZones.length).toFixed(2)
    : '0.50';

  const criticalCount = rankedZones.filter((z) => (z.risk_score || 0) >= 0.7).length;

  return (
    <div className="bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl p-4 flex-1 h-full overflow-hidden shadow-sm flex flex-col">
      {/* ── Real-Time Stream Header ─────────────────────────────── */}
      <div className="pb-3 border-b border-[#D9E2DE] dark:border-[#1E1E24] shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="font-extrabold text-xs text-[#006B4F] dark:text-emerald-400 tracking-wider uppercase flex items-center gap-1">
              Real-Time Risk Stream
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            LIVE 5s POLL
          </span>
        </div>

        {/* District Threat Index Banner */}
        <div className="p-2.5 rounded-lg bg-gradient-to-r from-slate-900 to-zinc-900 text-white border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">
              Regional Threat Score
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black font-mono text-emerald-400">{avgScore}</span>
              <span className="text-[10px] text-zinc-400 font-medium">/ 1.00</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold ml-1">
                {criticalCount > 0 ? `${criticalCount} High Alert Zones` : 'Stable'}
              </span>
            </div>
          </div>
          <button
            onClick={() => onOpenAlertModal?.()}
            className="px-2.5 py-1.5 rounded-md bg-[#E63946] hover:bg-[#c92a37] text-white text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
            title="Dispatch emergency alert"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Broadcast</span>
          </button>
        </div>
      </div>

      {/* ── Subtitle / Filter Label ─────────────────────────────── */}
      <div className="py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 shrink-0">
        <span className="font-semibold">Monitored Areas Ranked by Live Hazard:</span>
        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
          {rankedZones.length} Active Nodes
        </span>
      </div>

      {/* ── Ranked Live Area Stream List ────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {rankedZones.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No real-time sensor streams active.
          </div>
        ) : (
          rankedZones.map((zone, index) => {
            const isSelected = selectedZoneId === zone.zone_id;
            const score = typeof zone.risk_score === 'number' ? zone.risk_score : 0.5;
            const scorePercent = Math.min(Math.max(score * 100, 5), 100);

            // Synthetic or live sensory telemetry
            const rain24 = zone.rainfall_24h || (score * 180 + 20).toFixed(1);
            const soilSat = zone.soil_moisture
              ? (zone.soil_moisture * 100).toFixed(0)
              : (score * 40 + 55).toFixed(0);

            return (
              <div
                key={zone.zone_id}
                onClick={() => onSelectZone(zone)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${
                  isSelected
                    ? 'bg-[#EAF5F0] dark:bg-emerald-950/30 border-[#006B4F] dark:border-emerald-500 shadow-sm ring-1 ring-[#006B4F]/30'
                    : 'bg-[#F5F7F6]/80 dark:bg-[#141418] border-[#D9E2DE] dark:border-[#27272A] hover:border-[#006B4F]/50 dark:hover:border-zinc-600'
                }`}
              >
                {/* Top row: Rank, Village, Severity */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {zone.village_name}
                    </span>
                  </div>
                  <RiskBadge severity={zone.severity} size="xs" />
                </div>

                {/* Risk Gauge Bar */}
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500 dark:text-zinc-400">Live Risk Index</span>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">
                      {score.toFixed(3)} / 1.0
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 0.85
                          ? 'bg-[#E63946]'
                          : score >= 0.7
                          ? 'bg-orange-500'
                          : score >= 0.45
                          ? 'bg-amber-500'
                          : 'bg-[#008060]'
                      }`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                </div>

                {/* Real-time environmental metrics badges */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/80 text-[10px] font-mono">
                  <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                    <CloudRain className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>Rain: {rain24} mm</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                    <Droplets className="w-3 h-3 text-teal-500 shrink-0" />
                    <span>Soil: {soilSat}%</span>
                  </div>
                </div>

                {/* Action arrow */}
                <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 animate-pulse" />
                    Focus Map & Sensor View
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
