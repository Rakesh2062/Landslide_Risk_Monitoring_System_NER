import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getAlerts } from '../api/client';
import { emergencyAudio } from '../utils/emergencyAudio';
import { emergencyNotifier } from '../utils/emergencyNotifier';
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  CheckCircle2,
  BellRing,
  History,
  ShieldCheck,
  Radio,
  MapPin,
  Clock,
  ChevronRight,
  Activity,
  AlertCircle
} from 'lucide-react';
import AlertHistoryModal from './AlertHistoryModal';

export default function EmergencyAlertBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Acknowledged alert IDs
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('ner_acknowledged_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isMuted, setIsMuted] = useState(() => {
    try {
      return sessionStorage.getItem('ner_buzzer_muted') === 'true';
    } catch {
      return false;
    }
  });

  const [notifPermission, setNotifPermission] = useState(() =>
    emergencyNotifier.getNotificationPermission()
  );

  const [audioUnlocked, setAudioUnlocked] = useState(() =>
    emergencyAudio.isUnlocked()
  );

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    refetchInterval: 10000,
  });

  const deliveryChannels = (alert) => {
    const channels = alert.channels || alert.sent_via || ['app'];
    return Array.isArray(channels) ? channels : ['app'];
  };

  const activeHazardAlerts = alerts.filter((a) => {
    const isEmergency = a.severity === 'critical' || a.severity === 'high';
    const isAppDelivery = deliveryChannels(a).some((channel) =>
      channel === 'app' || channel === 'siren'
    );
    return isEmergency && isAppDelivery && !acknowledgedIds.includes(a.alert_id);
  });

  const currentHazard = activeHazardAlerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  })[0];

  useEffect(() => {
    if (!currentHazard) return;
    emergencyNotifier.recordAlertGenerated(currentHazard);
    const channels = deliveryChannels(currentHazard);
    if (channels.includes('app')) {
      emergencyNotifier.dispatchEmergencyNotification(currentHazard);
    }
    if (!isMuted && !emergencyNotifier.hasPlayedSound(currentHazard.alert_id)) {
      emergencyAudio.playEmergencySignal();
      emergencyNotifier.markSoundPlayed(currentHazard.alert_id);
    }
  }, [currentHazard?.alert_id, isMuted]);

  const handleEnableAlerts = async () => {
    await emergencyAudio.unlockAudio();
    setAudioUnlocked(true);
    const perm = await emergencyNotifier.requestNotificationPermission();
    setNotifPermission(perm);
    if (currentHazard) {
      const channels = deliveryChannels(currentHazard);
      if (channels.includes('app')) {
        emergencyNotifier.dispatchEmergencyNotification(currentHazard);
      }
      if (!isMuted) {
        emergencyAudio.playEmergencySignal();
      }
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('ner_buzzer_muted', String(next));
      } catch (e) {}
      if (next) {
        emergencyAudio.stop();
      }
      return next;
    });
  };

  const handleAcknowledge = (alertId) => {
    emergencyAudio.stop();
    emergencyNotifier.recordAlertAcknowledged(alertId);
    setAcknowledgedIds((prev) => {
      const next = [...prev, alertId];
      try {
        localStorage.setItem('ner_acknowledged_alerts', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleReplaySignal = () => {
    emergencyAudio.unlockAudio();
    emergencyAudio.playEmergencySignal();
  };

  const handleViewOnMap = () => {
    if (window.location.pathname.startsWith('/citizen')) {
      navigate('/citizen/map');
    } else {
      navigate('/map');
    }
  };

  if (!currentHazard) {
    return (
      <>
        {isHistoryOpen && (
          <AlertHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
          />
        )}
      </>
    );
  }

  const isCritical = currentHazard.severity === 'critical';
  const recommendedAction =
    currentHazard.recommended_action ||
    (isCritical
      ? 'IMMEDIATE EVACUATION: Move away from vulnerable hillside dwellings and steep slopes. Avoid travel on NH-206 / NH-40 passes until clearance is issued.'
      : 'HIGH ALERT: Exercise extreme vigilance near steep road cuttings. Monitor culvert runoff and avoid non-essential travel.');

  const formattedTime = currentHazard.timestamp
    ? new Date(currentHazard.timestamp).toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString();

  return (
    <>
      <div
        role="alert"
        aria-live="assertive"
        className="relative w-full z-20 mb-6 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col"
      >
        {/* Top Accent Bar */}
        <div className={`h-1 w-full ${isCritical ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`} />

        <div className="flex flex-col">
          {/* Section 1: Header (Severity + What Happened + Status) */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-slate-50/50">
            <div className="flex items-start gap-4">
              <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border shadow-sm ${isCritical ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                <AlertTriangle className="w-7 h-7 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {isCritical ? 'CRITICAL SEVERITY' : 'HIGH SEVERITY'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3 h-3" /> ACTIVE DIRECTIVE
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {t('emergency_alerts.emergency_warning', { defaultValue: 'Landslide Emergency Warning' })}
                </h2>
              </div>
            </div>
            <div className="flex flex-col sm:items-end text-sm">
              <div className="flex items-center gap-2 font-bold text-red-600 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                LIVE STATUS
              </div>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formattedTime}
              </div>
            </div>
          </div>

          {/* Section 2: Dense Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
            
            {/* Left Column: Context (Where & Why) */}
            <div className="lg:col-span-4 p-5 flex flex-col gap-5">
              {/* Where */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Incident Location
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="font-black text-slate-800 mb-1 text-base">{currentHazard.village || 'Sohra Sector'}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ZONE: {currentHazard.zone_id}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ID: {currentHazard.alert_id}
                    </span>
                  </div>
                  {currentHazard.lat && currentHazard.lng && (
                    <div className="text-[10px] font-mono text-slate-400 mt-2">
                      COORD: {currentHazard.lat.toFixed(4)}, {currentHazard.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>

              {/* Why */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Source & Observation
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="text-[10px] font-bold text-[#006B4F] bg-[#EAF5F0] border border-[#006B4F]/20 px-2 py-0.5 rounded inline-block mb-2 uppercase">
                    {currentHazard.channels?.includes('siren') ? 'Automated Sensor Trigger' : 'Verified Field Report'}
                  </div>
                  <p className="text-sm font-medium text-slate-700 leading-snug">
                    {currentHazard.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Column: Action (What to do & Current Status) */}
            <div className="lg:col-span-5 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Mandated Action
                </h3>
                <div className="bg-red-50/50 border border-red-200 rounded-lg p-4 h-full relative overflow-hidden shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Directive</span>
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black tracking-wider shadow-sm">URGENT</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 leading-relaxed">
                    {recommendedAction}
                  </p>
                </div>
              </div>
              
              <div className="mt-5">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Response Required</h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">Awaiting Acknowledgement</span>
                    <span className="text-xs text-slate-500 font-medium">Confirm receipt of this directive</span>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(currentHazard.alert_id)}
                    className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-md text-sm font-black transition-all shadow-sm active:scale-95 border border-red-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    ACKNOWLEDGE
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Map Preview */}
            <div className="lg:col-span-3 p-5 flex flex-col bg-slate-50/30">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Spatial Context
              </h3>
              <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col h-full shadow-sm">
                
                {/* Simulated Map Area */}
                <div className="w-full h-32 bg-slate-100 rounded-md mb-4 flex flex-col items-center justify-center border border-slate-200 relative overflow-hidden group">
                   {/* Grid Pattern overlay */}
                   <div 
                     className="absolute inset-0 opacity-10 mix-blend-multiply" 
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '16px 16px' }}
                   ></div>
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-200/50"></div>
                   
                   <div className="relative z-10 flex flex-col items-center">
                     <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center animate-pulse mb-1">
                       <MapPin className="text-red-600 w-5 h-5" />
                     </div>
                     <span className="text-[10px] font-bold text-slate-500 tracking-widest bg-white/80 px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
                       {currentHazard.zone_id}
                     </span>
                   </div>
                </div>

                <button
                  onClick={handleViewOnMap}
                  className="w-full mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-bold transition-all shadow-sm active:scale-95"
                >
                  View on Risk Map <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

          </div>

          {/* Section 3: Utility Footer */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {notifPermission !== 'granted' && (
                <button
                  onClick={handleEnableAlerts}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[11px] font-bold transition-colors"
                >
                  <BellRing className="w-3.5 h-3.5" /> Enable Alerts
                </button>
              )}
              <button
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-[11px] font-bold transition-colors shadow-sm"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={handleReplaySignal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-[11px] font-bold transition-colors shadow-sm hidden sm:inline-flex"
              >
                <Radio className="w-3.5 h-3.5" /> Test Audio
              </button>
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-[11px] font-bold transition-colors shadow-sm"
              >
                <History className="w-3.5 h-3.5" /> Alert History
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-black tracking-widest uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> NDMA Incident Format
            </div>
          </div>

        </div>
      </div>

      {isHistoryOpen && (
        <AlertHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  );
}
