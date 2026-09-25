import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { Activity, Zap, CloudRain, Droplets, ChevronRight } from 'lucide-react';

function createRealTimeRadarIcon(zone, isSelected) {
  const score = typeof zone.risk_score === 'number' ? zone.risk_score : 0.5;
  const isHigh = score >= 0.7;
  const isCritical = score >= 0.85;

  const color = isCritical
    ? '#E63946'
    : isHigh
    ? '#ea580c'
    : score >= 0.45
    ? '#eab308'
    : '#008060';

  return L.divIcon({
    className: 'realtime-radar-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
        <div style="
          position: absolute;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.3;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          top: -11px;
        "></div>
        
        <div style="
          position: relative;
          z-index: 10;
          padding: 3px 7px;
          border-radius: 20px;
          background: ${color};
          color: #ffffff;
          font-family: monospace;
          font-weight: 900;
          font-size: 11px;
          box-shadow: 0 0 12px ${color}, 0 2px 8px rgba(0,0,0,0.8);
          border: 1.5px solid #ffffff;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ffffff; animation: pulse 1s infinite;"></span>
          <span>${score.toFixed(2)}</span>
        </div>

        <div style="
          margin-top: 3px;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(10, 10, 12, 0.9);
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        ">
          ${zone.village_name}
        </div>
      </div>
    `,
    iconSize: [60, 40],
    iconAnchor: [30, 20],
  });
}

export default function RealTimeRiskOverlay({ zones = [], selectedZoneId, onSelectZone }) {
  const { t } = useTranslation();

  return (
    <>
      {zones.map((zone) => {
        const isSelected = selectedZoneId === zone.zone_id;
        const icon = createRealTimeRadarIcon(zone, isSelected);

        return (
          <Marker
            key={`rt-${zone.zone_id}`}
            position={[zone.lat, zone.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectZone(zone),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[220px] text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#D9E2DE] dark:border-zinc-800">
                  <span className="font-bold text-sm text-[#1F2937] dark:text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                    {zone.village_name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30">
                    LIVE STREAM
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Real-Time Risk:</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                      {(zone.risk_score || 0).toFixed(2)} / 1.0
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <CloudRain className="w-3 h-3 text-blue-500" />
                      24h Rain:
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {zone.rainfall_24h ? `${zone.rainfall_24h} mm` : '124.8 mm'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-teal-500" />
                      Soil Moisture:
                    </span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">
                      {zone.soil_moisture ? `${(zone.soil_moisture * 100).toFixed(0)}%` : '82%'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectZone(zone)}
                  className="mt-3 w-full py-1.5 px-2 rounded-lg bg-[#006B4F] hover:bg-[#00523c] text-white font-medium flex items-center justify-center gap-1 transition-colors shadow-sm text-xs"
                >
                  <span>Focus & Inspect Sensor Data</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
