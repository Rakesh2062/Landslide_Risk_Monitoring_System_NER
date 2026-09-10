import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import AlertHistoryModal from './AlertHistoryModal';

export default function EmergencyAlertBanner() {
  const { t } = useTranslation();

  // Acknowledged alert IDs
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('ner_acknowledged_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Muted audio state (persisted per session)
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return sessionStorage.getItem('ner_buzzer_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState(() =>
    emergencyNotifier.getNotificationPermission()
  );

  // Audio unlocked state
  const [audioUnlocked, setAudioUnlocked] = useState(() =>
    emergencyAudio.isUnlocked()
  );

  // History modal visibility
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Poll alerts every 10 seconds
  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    refetchInterval: 10000,
  });

  // Filter for unacknowledged HIGH or CRITICAL landslide alerts
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

  // Pick highest severity active alert (critical first, then latest high)
  const currentHazard = activeHazardAlerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  })[0];

  // Whenever a new high/critical hazard arrives:
  useEffect(() => {
    if (!currentHazard) return;

    // 1. Record generated alert into persistent Alert History
    emergencyNotifier.recordAlertGenerated(currentHazard);

    const channels = deliveryChannels(currentHazard);

    // 2. Dispatch a browser / PWA notification only when the App channel was selected.
    if (channels.includes('app')) {
      emergencyNotifier.dispatchEmergencyNotification(currentHazard);
    }

    // 3. A siren sounds only when the authority selected the Siren channel.
    if (channels.includes('siren') && !isMuted && !emergencyNotifier.hasPlayedSound(currentHazard.alert_id)) {
      emergencyAudio.playEmergencySignal();
      emergencyNotifier.markSoundPlayed(currentHazard.alert_id);
    }
  }, [currentHazard?.alert_id, isMuted]);

  // Request browser notification permission and unlock audio context
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
      if (channels.includes('siren') && !isMuted) {
        emergencyAudio.playEmergencySignal();
      }
    }
  };

  // Toggle Mute
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

  // Acknowledge alert
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

  // Manually re-test / re-play the emergency sound
  const handleReplaySignal = () => {
    emergencyAudio.unlockAudio();
    emergencyAudio.playEmergencySignal();
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
      : 'HIGH ALERT: Exercise extreme vigilance near steep road cuttings. Monitor culvert runoff and avoid non-essential hillside travel.');

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
        className={`relative w-full z-20 border-b shadow-2xl transition-all ${
          isCritical
            ? 'bg-[#180407] border-red-600 text-white'
            : 'bg-[#1a0c02] border-amber-500 text-white'
        }`}
      >
        {/* Top government strobe accent line */}
        <div
          className={`h-1.5 w-full ${
            isCritical
              ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 animate-pulse'
          }`}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          
          {/* Main header row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            
            {/* Warning title & badges */}
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl shadow-lg border ${
                  isCritical
                    ? 'bg-red-600 border-red-400 text-white shadow-red-900/50'
                    : 'bg-amber-600 border-amber-400 text-white shadow-amber-900/50'
                }`}
              >
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>

              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 uppercase">
                    <span>🚨</span>
                    <span>{t('emergency_alerts.emergency_warning', { defaultValue: 'Emergency Warning' })}</span>
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider shadow-sm ${
                      isCritical
                        ? 'bg-red-600 text-white border border-red-400'
                        : 'bg-amber-600 text-white border border-amber-400'
                    }`}
                  >
                    {isCritical
                      ? t('emergency_alerts.critical_risk', { defaultValue: 'CRITICAL RISK' })
                      : t('emergency_alerts.high_risk', { defaultValue: 'HIGH RISK' })}
                  </span>

                  <span className="flex items-center gap-1 text-xs font-bold text-slate-200 bg-white/10 px-2.5 py-0.5 rounded border border-white/10">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{currentHazard.village || 'Sohra Sector'}</span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      ({currentHazard.zone_id})
                    </span>
                  </span>

                  <span className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formattedTime}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons (Mute, Acknowledge, Enable Alerts, History) */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Permission helper button if notifications aren't granted yet */}
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnableAlerts}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all animate-pulse"
                  title="Grant notification & audio permissions for emergency warning broadcasts"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>{t('emergency_alerts.enable_alerts', { defaultValue: 'Enable Emergency Alerts' })}</span>
                </button>
              )}

              {/* Mute Audio Button */}
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all shadow-sm"
                title={isMuted ? 'Unmute Emergency Sound' : 'Mute Emergency Sound'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                )}
                <span>{isMuted ? t('emergency_alerts.unmute', { defaultValue: 'Unmute' }) : t('emergency_alerts.mute', { defaultValue: 'Mute' })}</span>
              </button>

              {/* Re-play audio signal */}
              <button
                type="button"
                onClick={handleReplaySignal}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/10"
                title="Test / Replay emergency attention signal"
              >
                <Radio className="w-3 h-3 text-amber-400" />
                <span>Test Audio</span>
              </button>

              {/* Acknowledge Button */}
              <button
                type="button"
                onClick={() => handleAcknowledge(currentHazard.alert_id)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all shadow-md active:scale-95 border border-red-400"
                title="Acknowledge this emergency warning"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('emergency_alerts.acknowledge_warning', { defaultValue: 'Acknowledge Warning' })}</span>
              </button>

              {/* View History Button */}
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all"
                title="View emergency alert history"
              >
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">{t('emergency_alerts.alert_history', { defaultValue: 'Alert History' })}</span>
              </button>
            </div>
          </div>

          {/* Warning Message & Recommended Action Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            
            {/* Warning Message */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                {t('emergency_alerts.warning_observation', { defaultValue: 'Warning Observation' })}
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                {currentHazard.message}
              </p>
            </div>

            {/* Recommended Action */}
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-600/40 space-y-1">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block flex items-center gap-1">
                <span>{t('emergency_alerts.recommended_action', { defaultValue: 'Recommended Action' })}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-800/80 text-white font-black">
                  URGENT
                </span>
              </span>
              <p className="text-xs sm:text-sm font-semibold text-rose-100 leading-snug">
                {recommendedAction}
              </p>
            </div>
          </div>

          {/* Architecture disclaimer footer */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>
                Standard Emergency Warning Signal (Civil Protection Simulation) • Formatted for CAP / NDMA / IPAWS integration.
              </span>
            </div>
            <span className="hidden md:inline font-mono text-slate-500">
              ID: {currentHazard.alert_id}
            </span>
          </div>

        </div>
      </div>

      {/* Alert History Modal */}
      {isHistoryOpen && (
        <AlertHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  );
}
