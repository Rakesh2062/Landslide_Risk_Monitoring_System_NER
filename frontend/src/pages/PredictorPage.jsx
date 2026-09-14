import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { predictRisk } from '../api/client';
import PageHeader from '../components/admin/PageHeader';
import SectionCard from '../components/admin/SectionCard';
import RiskBadge from '../components/admin/RiskBadge';
import {
  Cpu,
  RotateCcw,
  Play,
  Gauge,
  Layers,
  AlertTriangle,
  Droplets,
  Mountain,
  Info,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function PredictorPage() {
  const { t } = useTranslation();

  const defaultFeatures = {
    slope: 34.5,
    aspect: 182.3,
    curvature: -0.42,
    dist_to_drainage: 310.0,
    rainfall_24h: 65.2,
    rainfall_72h: 210.0,
    rainfall_7d: 380.5,
    rainfall_intensity_peak: 28.4,
    antecedent_rainfall_index: 145.7,
    soil_moisture: 0.61,
    dist_to_history: 0.8,
    landslide_density_5km: 2.0,
  };

  const [features, setFeatures] = useState(defaultFeatures);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleSlider = (key, val) => {
    setFeatures((prev) => ({ ...prev, [key]: parseFloat(val) }));
    setPrediction(null);
    setError(null);
  };

  const handleRunPredict = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await predictRisk(features);
      setPrediction(res);
    } catch (err) {
      console.error('Prediction failed:', err);
      setPrediction(null);
      setError(err.message || 'Unable to generate a prediction.');
    } finally {
      setIsRunning(false);
    }
  };

  const resetFeatures = () => {
    setFeatures(defaultFeatures);
    setPrediction(null);
    setError(null);
  };

  const sliders = [
    {
      group: 'Hydrological & Soil Saturation',
      items: [
        { key: 'rainfall_24h', label: 'Cumulative Rainfall (24h)', min: 0, max: 250, step: 1, unit: ' mm', desc: 'Short-term event precipitation' },
        { key: 'rainfall_72h', label: 'Cumulative Rainfall (72h)', min: 0, max: 500, step: 5, unit: ' mm', desc: 'Sustained antecedent downpour' },
        { key: 'rainfall_7d', label: 'Weekly Rainfall (7d)', min: 0, max: 900, step: 5, unit: ' mm', desc: 'Deep soil moisture recharge' },
        { key: 'antecedent_rainfall_index', label: 'Antecedent Rainfall Index (ARI)', min: 10, max: 300, step: 1, unit: '', desc: 'Cumulative soil saturation index' },
        { key: 'soil_moisture', label: 'Volumetric Soil Moisture', min: 0.1, max: 0.95, step: 0.01, unit: ' m³/m³', desc: 'Pore-water pressure proxy' },
        { key: 'rainfall_intensity_peak', label: 'Peak Rainfall Intensity', min: 0, max: 80, step: 0.5, unit: ' mm/h', desc: 'Maximum instantaneous cloudburst rate' },
      ],
    },
    {
      group: 'Geomorphology & Terrain',
      items: [
        { key: 'slope', label: 'Slope Gradient Angle', min: 5, max: 75, step: 0.5, unit: '°', desc: 'Gravitational shear driving force' },
        { key: 'curvature', label: 'Terrain Curvature', min: -2, max: 2, step: 0.05, unit: '', desc: 'Negative = concave water convergence' },
        { key: 'dist_to_drainage', label: 'Distance to Natural Drainage', min: 10, max: 1000, step: 10, unit: ' m', desc: 'Gully toe erosion proximity' },
        { key: 'dist_to_history', label: 'Distance to Historical Landslide', min: 0, max: 10, step: 0.1, unit: ' km', desc: 'Proximity to past failure zones' },
        { key: 'landslide_density_5km', label: 'Landslide Density (5 km radius)', min: 0, max: 20, step: 0.5, unit: '', desc: 'Count of past landslides within 5 km' },
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader
        kicker="Decision Support Workbench"
        title="Landslide Risk Prediction & Simulation"
        description="Simulate slope destabilization thresholds under varying hydrological and precipitation regimes using the empirical hazard evaluation model."
        badge="POST /predict-risk"
        actions={
          <>
            <button
              onClick={resetFeatures}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-700 dark:text-zinc-300 hover:text-[#006B4F] text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Values</span>
            </button>

            <button
              onClick={handleRunPredict}
              disabled={isRunning}
              className="px-4 py-2 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Calculating Score...' : 'Run Simulation'}</span>
            </button>
          </>
        }
      />

      {/* ── Workbench Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Parameter Input Sliders */}
        <div className="lg:col-span-7 space-y-5">
          {sliders.map((group, gIdx) => (
            <SectionCard
              key={gIdx}
              kicker={`Factor Group 0${gIdx + 1}`}
              title={group.group}
            >
              <div className="space-y-4">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-lg bg-[#F5F7F6]/60 dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-white block">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-500">{item.desc}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-[#006B4F] dark:text-emerald-400 bg-white dark:bg-black px-2 py-0.5 rounded border border-[#D9E2DE] dark:border-[#27272A]">
                        {features[item.key]}{item.unit}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={features[item.key]}
                      onChange={(e) => handleSlider(item.key, e.target.value)}
                      className="w-full accent-[#006B4F] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>

        {/* Right Column: Decision Support Evaluation Card */}
        <div className="lg:col-span-5 space-y-5 sticky top-20">
          <SectionCard
            kicker="Evaluation Output"
            title="Hazard Score & Advisory"
            subtitle="Server-side trained-model evaluation"
          >
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}
            {prediction ? (
              <div className="space-y-5">
                {/* Visual Gauge Header */}
                <div className="p-6 rounded-xl bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-center space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Predicted Instability Score
                  </span>
                  <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                    {prediction.risk_score}
                  </div>
                  <div>
                    <RiskBadge severity={prediction.severity} size="md" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    {prediction.model_source === 'trained_model' ? 'Trained ML model' : 'Empirical fallback'} · {prediction.model_version}
                  </p>
                </div>

                {/* Advisory Recommendations */}
                <div className="p-4 rounded-xl border border-[#D9E2DE] dark:border-[#27272A] space-y-2.5 text-xs">
                  <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
                    <span>Operational Advisory</span>
                  </h4>
                  <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {prediction.severity === 'critical'
                      ? 'Immediate ground evacuation protocol indicated. Arterial road cut inspection required immediately; pore-water pressure exceeds safety factor threshold.'
                      : prediction.severity === 'high'
                      ? 'High probability of localized debris run and rock boulder release. Dispatch SDRF reconnaissance team and monitor culvert discharge.'
                      : prediction.severity === 'medium'
                      ? 'Moderate slope sensitivity. Soil moisture saturation nearing threshold; activate precautionary surveillance.'
                      : 'Baseline conditions within tolerable threshold. Normal civil monitoring protocol.'}
                  </p>
                </div>

                {/* Sensitivity Table */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-[#D9E2DE] dark:border-[#27272A] space-y-2 text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300 block">
                    Driving Parameters in Simulation
                  </span>
                  <div className="space-y-1 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>Slope:</span>
                      <strong className="text-slate-800 dark:text-zinc-200">{features.slope}°</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>24h Rain:</span>
                      <strong className="text-slate-800 dark:text-zinc-200">{features.rainfall_24h} mm</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Soil Saturation:</span>
                      <strong className="text-slate-800 dark:text-zinc-200">{(features.soil_moisture * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Gauge className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                  Simulation Ready
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  Adjust terrain gradient and precipitation parameters on the left and click <strong>Run Simulation</strong> to query the backend model.
                </p>
                <button
                  onClick={handleRunPredict}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Initial Prediction</span>
                </button>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
