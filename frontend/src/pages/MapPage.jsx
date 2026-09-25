import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRiskZones, getRoads, getVillages, getAlerts, updateRoadStatus } from '../api/client';
import MapView from '../components/MapView';
import ZoneDetailDrawer from '../components/ZoneDetailDrawer';
import RealTimeRiskPanel from '../components/RealTimeRiskPanel';
import PopulationImpactSection from '../components/PopulationImpactSection';
import CreateAlertModal from '../components/CreateAlertModal';
import PageHeader from '../components/admin/PageHeader';
import RiskBadge from '../components/admin/RiskBadge';
import { Map, Search, ChevronRight, Filter, Radio, RefreshCw, Activity, Layers, Users } from 'lucide-react';

export default function MapPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [zones, setZones] = useState([]);
  const [roads, setRoads] = useState([]);
  const [villages, setVillages] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState(null);

  // Active right sidebar mode: 'realtime' | 'grid'
  const [sidebarMode, setSidebarMode] = useState('realtime');
  const [isRealTimeMapActive, setIsRealTimeMapActive] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [zonesData, roadsData, villData, alertsData] = await Promise.all([
        getRiskZones(),
        getRoads(),
        getVillages(),
        getAlerts().catch(() => []),
      ]);
      const loadedZones = zonesData || [];
      setZones(loadedZones);
      setRoads(roadsData || []);
      setVillages(villData || []);
      setAlerts(alertsData || []);

      // Check URL parameters for focus coordinates / zone selection
      const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
      const paramLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')) : null;
      const paramZoneId = searchParams.get('zone_id');

      if (paramLat && paramLng) {
        setMapCenter([paramLat, paramLng]);
      }

      if (paramZoneId) {
        const found = loadedZones.find((z) => z.zone_id === paramZoneId);
        if (found) {
          setSelectedZone(found);
          if (!paramLat || !paramLng) {
            setMapCenter([found.lat, found.lng]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateRoadStatus = async (roadId, status) => {
    await updateRoadStatus(roadId, status);
    const updated = await getRoads();
    setRoads(updated || []);
  };

  const handleSelectZoneAndCenter = (zone) => {
    setSelectedZone(zone);
    if (zone && zone.lat && zone.lng) {
      setMapCenter([zone.lat, zone.lng]);
    }
  };

  const filteredZones = zones.filter((z) => {
    const matchesSeverity =
      filterSeverity === 'all' || (z.severity || '').toLowerCase() === filterSeverity;
    const matchesSearch =
      (z.village_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (z.zone_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader
        kicker="Geospatial Intelligence Portal"
        title="East Khasi Hills GIS Hazard Map"
        description="Spatial surveillance of geocells, real-time risk telemetry, continuous hazard heatmaps, arterial road corridors, and demographic vulnerability across the Meghalaya plateau."
        badge={`${filteredZones.length} Monitored Cells`}
        actions={
          <>
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#E63946] hover:bg-[#C92A37] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Issue Directive</span>
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-700 dark:text-zinc-300 hover:text-[#006B4F] text-xs transition-all shadow-xs"
              title="Refresh Map Layers"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {/* ── Filter Controls Bar ─────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by village name or zone ID..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F]"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Right Panel View Mode Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs font-semibold">
            <button
              onClick={() => {
                setSidebarMode('realtime');
                setIsRealTimeMapActive(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                sidebarMode === 'realtime'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Real-Time Stream</span>
            </button>
            <button
              onClick={() => setSidebarMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                sidebarMode === 'grid'
                  ? 'bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Grid Cells ({filteredZones.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs text-slate-800 dark:text-zinc-200 font-medium focus:outline-none focus:border-[#006B4F]"
            >
              <option value="all">All Severities ({zones.length})</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Map + Inspection Column Grid ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Full-height Map Container */}
        <div className="lg:col-span-3">
          <MapView
            zones={filteredZones}
            roads={roads}
            villages={villages}
            alerts={alerts}
            selectedZoneId={selectedZone?.zone_id}
            onSelectZone={handleSelectZoneAndCenter}
            onUpdateRoadStatus={handleUpdateRoadStatus}
            height="680px"
            center={mapCenter}
            showRealTime={isRealTimeMapActive}
            onToggleRealTime={(active) => {
              setIsRealTimeMapActive(active);
              if (active) setSidebarMode('realtime');
            }}
          />
        </div>

        {/* Side Inspection Panel (Real-Time Risk Intelligence / Grid Cells / Detail Drawer) */}
        <div className="lg:col-span-1 h-[680px] flex flex-col">
          {selectedZone ? (
            <ZoneDetailDrawer
              zone={selectedZone}
              onClose={() => setSelectedZone(null)}
              onOpenAlertModal={() => setIsAlertModalOpen(true)}
            />
          ) : sidebarMode === 'realtime' ? (
            <RealTimeRiskPanel
              zones={filteredZones}
              selectedZoneId={selectedZone?.zone_id}
              onSelectZone={handleSelectZoneAndCenter}
              onOpenAlertModal={() => setIsAlertModalOpen(true)}
            />
          ) : (
            <div className="bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl p-4 flex-1 overflow-y-auto space-y-3 shadow-sm flex flex-col">
              <div className="pb-3 border-b border-[#D9E2DE] dark:border-[#1E1E24] shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#006B4F] dark:text-emerald-400 uppercase tracking-wider">
                    Monitored Cells ({filteredZones.length})
                  </h3>
                  <span className="text-[10px] text-slate-400">Click to focus</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Select any grid cell to view geomorphological slope, curvature, rainfall index, and historical risk.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredZones.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No matching zones found.
                  </div>
                ) : (
                  filteredZones.map((z) => (
                    <div
                      key={z.zone_id}
                      onClick={() => handleSelectZoneAndCenter(z)}
                      className="p-3 rounded-lg bg-[#F5F7F6]/70 dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] hover:border-[#006B4F] dark:hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {z.village_name}
                          </span>
                          <RiskBadge severity={z.severity} size="xs" />
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                          {z.zone_id} • Score: {(z.risk_score || 0).toFixed(2)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#006B4F] dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section Under the Map: Demographic Exposure & Affected Population Analytics ── */}
      <PopulationImpactSection
        zones={filteredZones}
        villages={villages}
        onSelectZone={handleSelectZoneAndCenter}
        onOpenAlertModal={() => setIsAlertModalOpen(true)}
      />

      {/* Alert creation modal */}
      <CreateAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        zones={zones}
        defaultZone={selectedZone}
        onAlertCreated={loadData}
      />
    </div>
  );
}
