// Citizen Dashboard — overview for verified residents
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getAlerts, getRiskZones } from '../../api/client';
import { Link } from 'react-router-dom';
import {
  Bell, MapPin, AlertTriangle, ShieldCheck, ChevronRight,
  Info, Clock, CheckCircle2, Volume2, VolumeX, X, ArrowRight, AlertOctagon, Square,
} from 'lucide-react';
import { enableLiveNotifications } from '../../services/firebaseMessaging';
import { emergencyAudio } from '../../utils/emergencyAudio';
import { emergencyNotifier } from '../../utils/emergencyNotifier';
import AlertDetailModal from '../../components/AlertDetailModal';

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  high:     { dot: 'bg-orange-500', badge: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  medium:   { dot: 'bg-yellow-500', badge: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  low:      { dot: 'bg-green-500',  badge: 'bg-green-100  dark:bg-green-950/50  text-green-700  dark:text-green-400  border-green-200  dark:border-green-800'  },
};

const ALERT_BANNER_THEMES = {
  critical: {
    bg: 'bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#991B1B]',
    border: 'border-red-400/40',
    ring: 'ring-2 ring-red-500/20',
    badgeBg: 'bg-red-950/50 text-red-100 border border-red-300/30',
    badgeText: 'CRITICAL ALERT',
    iconEmoji: '🚨',
    defaultTitle: 'Landslide Warning',
    btnBg: 'bg-white text-red-700 hover:bg-red-50',
  },
  high: {
    bg: 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#9A3412]',
    border: 'border-orange-400/40',
    ring: 'ring-2 ring-orange-500/20',
    badgeBg: 'bg-orange-950/50 text-orange-100 border border-orange-300/30',
    badgeText: 'HIGH ALERT',
    iconEmoji: '⚠️',
    defaultTitle: 'Landslide Advisory',
    btnBg: 'bg-white text-orange-700 hover:bg-orange-50',
  },
  medium: {
    bg: 'bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#92400E]',
    border: 'border-amber-400/40',
    ring: 'ring-2 ring-amber-500/20',
    badgeBg: 'bg-amber-950/50 text-amber-100 border border-amber-300/30',
    badgeText: 'MODERATE ALERT',
    iconEmoji: '⚠️',
    defaultTitle: 'Landslide Caution Notice',
    btnBg: 'bg-white text-amber-800 hover:bg-amber-50',
  },
  low: {
    bg: 'bg-gradient-to-r from-[#047857] via-[#059669] to-[#065F46]',
    border: 'border-emerald-400/40',
    ring: 'ring-2 ring-emerald-500/20',
    badgeBg: 'bg-emerald-950/50 text-emerald-100 border border-emerald-300/30',
    badgeText: 'ADVISORY NOTICE',
    iconEmoji: 'ℹ️',
    defaultTitle: 'Weather & Slope Advisory',
    btnBg: 'bg-white text-emerald-800 hover:bg-emerald-50',
  },
};

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState('');
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // Dismissed alert IDs saved to localStorage
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try {
      const saved = localStorage.getItem('ner_dismissed_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Mute buzzer state saved to sessionStorage
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return sessionStorage.getItem('ner_buzzer_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Track whether browser autoplay restrictions blocked audio
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Sync audio synthesizer playing state
  useEffect(() => {
    emergencyAudio.onStateChange = (playing) => {
      setIsAudioPlaying(playing);
    };
    return () => {
      emergencyAudio.onStateChange = null;
      emergencyAudio.stop();
    };
  }, []);

  // Modal state for viewing alert details
  const [selectedAlertForModal, setSelectedAlertForModal] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleEnableNotifications = async () => {
    setEnablingNotifications(true);
    setNotificationStatus('');
    try {
      await emergencyAudio.unlockAudio();
      setAudioBlocked(false);
      await enableLiveNotifications((payload) => {
        setNotificationStatus(payload.notification?.title || 'New live alert received.');
      });
      setNotificationStatus('Live notifications are enabled on this device.');
    } catch (error) {
      setNotificationStatus(error.message || 'Could not enable live notifications.');
    } finally {
      setEnablingNotifications(false);
    }
  };

  // Poll alerts every 3 seconds for real-time delivery without page refresh
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['citizen_alerts'],
    queryFn: getAlerts,
    refetchInterval: 3000,
    staleTime: 1000,
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['citizen_zones'],
    queryFn: getRiskZones,
    staleTime: 1000 * 60,
  });

  // Real-time synchronization across tabs & windows via BroadcastChannel and storage events
  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('ner_emergency_alerts');
      channel.onmessage = (event) => {
        if (event.data?.type === 'NEW_ALERT') {
          refetchAlerts();
        }
      };
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'ner_latest_alert_broadcast') {
        refetchAlerts();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [refetchAlerts]);

  // Find the most critical / latest undismissed alert to display in the Welcome Card
  const activeEmergencyAlert = useMemo(() => {
    const undismissed = alerts.filter((a) => !dismissedAlertIds.includes(a.alert_id));
    if (undismissed.length === 0) return null;

    // Sort: critical first, then high, then medium, then low, then newest
    const priority = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...undismissed].sort((a, b) => {
      const pDiff = (priority[b.severity] || 0) - (priority[a.severity] || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.timestamp || b.sent_at || 0) - new Date(a.timestamp || a.sent_at || 0);
    })[0];
  }, [alerts, dismissedAlertIds]);

  // Trigger sound when an alert is received:
  // - Critical alerts: continuous alarm loop until stopped / muted / dismissed
  // - Other severities (high, medium, low): plays once
  useEffect(() => {
    if (!activeEmergencyAlert) return;
    const alertId = activeEmergencyAlert.alert_id;
    const severity = activeEmergencyAlert.severity || 'low';
    const isCritical = severity === 'critical';

    // Check if this alert has already had its sound played
    if (emergencyNotifier.hasPlayedSound(alertId)) {
      return;
    }

    if (isMuted) {
      emergencyNotifier.markSoundPlayed(alertId);
      return;
    }

    // Check AudioContext state and play sound
    const ctx = emergencyAudio.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      // Autoplay policy prevented immediate playback
      setAudioBlocked(true);
      // Try unlocking in case user has previously interacted
      emergencyAudio.unlockAudio().then((unlocked) => {
        if (unlocked) {
          setAudioBlocked(false);
          emergencyAudio.playAlertBeep(severity, isCritical);
          emergencyNotifier.markSoundPlayed(alertId);
        } else {
          setAudioBlocked(true);
        }
      }).catch(() => setAudioBlocked(true));
    } else {
      emergencyAudio.playAlertBeep(severity, isCritical);
      emergencyNotifier.markSoundPlayed(alertId);
      setAudioBlocked(false);
    }
  }, [activeEmergencyAlert?.alert_id, isMuted]);

  // Stop active continuous alarm sound
  const handleStopSound = () => {
    emergencyAudio.stop();
    setIsAudioPlaying(false);
  };

  // Autoplay restriction handler: user explicitly enables audio
  const handleEnableAudio = async () => {
    const unlocked = await emergencyAudio.unlockAudio();
    setAudioBlocked(false);
    if (activeEmergencyAlert && !isMuted) {
      const severity = activeEmergencyAlert.severity || 'low';
      const isCritical = severity === 'critical';
      emergencyAudio.playAlertBeep(severity, isCritical);
      emergencyNotifier.markSoundPlayed(activeEmergencyAlert.alert_id);
    }
  };

  // Toggle mute button
  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('ner_buzzer_muted', String(next));
      } catch (e) {}
      if (next) {
        emergencyAudio.stop();
        setIsAudioPlaying(false);
      }
      return next;
    });
  };

  // Dismiss current alert from the Welcome Card
  const handleDismissAlert = (alertId) => {
    emergencyAudio.stop();
    setIsAudioPlaying(false);
    setDismissedAlertIds((prev) => {
      const next = [...prev, alertId];
      try {
        localStorage.setItem('ner_dismissed_alerts', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Open Alert details modal
  const handleViewAlert = (alert) => {
    emergencyAudio.stop();
    setIsAudioPlaying(false);
    setSelectedAlertForModal(alert);
    setIsDetailModalOpen(true);
  };

  const criticalCount = zones.filter((z) => {
    const s = z.severity || z.current_severity;
    return s === 'critical' || s === 'high';
  }).length;

  const recentAlerts = alerts.slice(0, 3);

  // Formatted alert time for the emergency card
  const formattedAlertTime = activeEmergencyAlert
    ? new Date(activeEmergencyAlert.timestamp || activeEmergencyAlert.sent_at || Date.now()).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const themeConfig = activeEmergencyAlert
    ? ALERT_BANNER_THEMES[activeEmergencyAlert.severity] || ALERT_BANNER_THEMES.critical
    : null;

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner / Emergency Alert Card ────────────────────────── */}
      {!activeEmergencyAlert ? (
        /* Default State: Welcome Banner */
        <div className="rounded-2xl bg-gradient-to-r from-[#006B4F] to-[#004f3a] p-5 sm:p-6 text-white shadow-lg transition-all duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${user?.is_verified ? 'opacity-90 text-emerald-300' : 'opacity-70 text-amber-300'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {user?.is_verified ? 'Verified Resident' : 'Pending Verification'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black">
                Welcome back, {user?.username || 'Citizen'}
              </h1>
              <p className="text-[11px] opacity-70 max-w-sm">
                Real-time landslide monitoring for {user?.district || 'East Khasi Hills'}. Stay informed and help your community by reporting hazards.
              </p>
            </div>
            <div className="shrink-0 hidden sm:flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Bell className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold opacity-80">{alerts.length} Active</span>
            </div>
          </div>
        </div>
      ) : (
        /* Emergency Alert State: Replaces Welcome Banner When Admin Broadcasts Alert */
        <div
          role="alert"
          aria-live="assertive"
          className={`rounded-2xl ${themeConfig.bg} ${themeConfig.border} ${themeConfig.ring} p-5 sm:p-6 text-white shadow-xl transition-all duration-300 relative overflow-hidden`}
        >
          {/* Subtle background pulse animation */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="flex flex-col gap-4 relative z-10">
            {/* Top Row: Severity Badge, Live Indicator, Sound & Dismiss Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${themeConfig.badgeBg}`}>
                  <span>{themeConfig.iconEmoji}</span>
                  <span>{themeConfig.badgeText}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Live Broadcast
                </span>
              </div>

              {/* Utility controls: Enable audio / Mute / Dismiss */}
              <div className="flex items-center gap-2 ml-auto">
                {audioBlocked && (
                  <button
                    type="button"
                    onClick={handleEnableAudio}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300 text-[10px] font-black tracking-tight transition-transform active:scale-95 shadow-sm"
                    title="Browser blocked automatic sound. Click to enable."
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Enable Alert Sound</span>
                  </button>
                )}

                {/* Stop Sound Button (shown when continuous alarm or audio is active) */}
                {isAudioPlaying && (
                  <button
                    type="button"
                    onClick={handleStopSound}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/90 hover:bg-black text-white border border-red-300 text-[10px] font-black tracking-tight transition-transform active:scale-95 shadow-sm animate-pulse cursor-pointer"
                    title="Stop emergency beep sound"
                  >
                    <Square className="w-3 h-3 fill-red-400 text-red-400" />
                    <span>Stop Sound</span>
                  </button>
                )}

                {/* Mute Toggle */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs transition-colors flex items-center gap-1"
                  title={isMuted ? 'Unmute alert audio' : 'Mute alert audio'}
                  aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
                </button>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => handleDismissAlert(activeEmergencyAlert.alert_id)}
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs transition-colors flex items-center gap-1"
                  title="Dismiss alert notification"
                  aria-label="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Dismiss</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Alert Title & Message */}
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {activeEmergencyAlert.message_title || themeConfig.defaultTitle}
              </h2>
              <p className="text-xs sm:text-sm text-white/95 leading-relaxed max-w-2xl font-medium">
                {activeEmergencyAlert.message}
              </p>
            </div>

            {/* Key Information Badges */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-semibold pt-1 text-white/90">
              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                <MapPin className="w-3.5 h-3.5 text-white/80" />
                <span>Location: <strong className="font-bold text-white">{activeEmergencyAlert.village || activeEmergencyAlert.zone_id || 'Sohra (Cherrapunji)'}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/80" />
                <span>Time: <strong className="font-bold text-white">{formattedAlertTime}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                <AlertOctagon className="w-3.5 h-3.5 text-white/80" />
                <span>Severity: <strong className="font-bold uppercase text-white">{activeEmergencyAlert.severity || 'CRITICAL'}</strong></span>
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleViewAlert(activeEmergencyAlert)}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${themeConfig.btnBg}`}
              >
                <span>View Alert</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleDismissAlert(activeEmergencyAlert.alert_id)}
                className="text-[11px] font-bold text-white/80 hover:text-white underline underline-offset-4 transition-colors"
              >
                Dismiss to default view
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Verification Status Banner (shown when user is unverified) ── */}
      {!user?.is_verified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-900 dark:text-amber-300">
                Residency Verification In Progress
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-zinc-400">
                Your submitted residency proof is under review by District Administration. Your Verified badge will activate automatically upon approval.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/40 shrink-0">
            Pending Approval
          </span>
        </div>
      )}

      {/* ── Live Safety Alerts Browser Notification Row ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#006B4F]/20 bg-[#EAF5F0] p-3.5 dark:bg-emerald-950/20">
        <div>
          <p className="text-xs font-bold text-[#006B4F] dark:text-emerald-400">Get live safety alerts</p>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400">Enable browser notifications for new landslide warnings.</p>
          {notificationStatus && <p className="mt-1 text-[11px] font-medium text-slate-700 dark:text-zinc-300">{notificationStatus}</p>}
        </div>
        <button
          type="button"
          onClick={handleEnableNotifications}
          disabled={enablingNotifications}
          className="rounded-lg bg-[#006B4F] px-3 py-2 text-xs font-bold text-white hover:bg-[#00523C] disabled:opacity-60"
        >
          {enablingNotifications ? 'Enabling…' : 'Enable notifications'}
        </button>
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Alerts', value: alerts.length, icon: Bell, color: 'text-[#E63946]', bg: 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30', to: '/citizen/alerts' },
          { label: 'High Risk Zones', value: criticalCount, icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30', to: '/citizen/map' },
          { label: 'Monitored Zones', value: zones.length, icon: MapPin, color: 'text-[#006B4F] dark:text-emerald-400', bg: 'bg-[#EAF5F0] dark:bg-emerald-950/20 border-[#006B4F]/15 dark:border-emerald-900/30', to: '/citizen/map' },
        ].map(({ label, value, icon: Icon, color, bg, to }) => (
          <Link key={label} to={to}
            className={`rounded-xl border p-3.5 flex flex-col gap-1.5 ${bg} hover:shadow-md transition-shadow`}
          >
            <Icon className={`w-4 h-4 ${color}`} />
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Recent Alerts ───────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#F8FAF9] dark:bg-[#121215]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#006B4F]" />
            <h2 className="text-xs font-black text-slate-800 dark:text-zinc-100">Recent Alerts</h2>
          </div>
          <Link to="/citizen/alerts" className="text-[11px] font-bold text-[#006B4F] dark:text-emerald-400 hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {alertsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#006B4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <CheckCircle2 className="w-8 h-8 text-[#006B4F]" />
            <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">No active alerts</p>
            <p className="text-[11px] text-slate-400">Your district is currently safe.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D9E2DE]/60 dark:divide-[#27272A]/60">
            {recentAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
              return (
                <div
                  key={alert.alert_id}
                  onClick={() => handleViewAlert(alert)}
                  className="p-4 hover:bg-[#F8FAF9] dark:hover:bg-[#121215] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                      <span className="font-mono text-[10px] text-slate-400">{alert.alert_id}</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed line-clamp-2">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{alert.village || alert.zone_id}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(alert.timestamp || alert.sent_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Links ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/citizen/reports"
          className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] hover:border-[#006B4F]/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EAF5F0] dark:bg-emerald-950/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#006B4F]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">Report a Hazard</p>
              <p className="text-[10px] text-slate-500">Submit your field observation</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#006B4F] transition-colors" />
        </Link>

        <Link to="/citizen/map"
          className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] hover:border-[#006B4F]/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EAF5F0] dark:bg-emerald-950/30 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#006B4F]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">Risk Zone Map</p>
              <p className="text-[10px] text-slate-500">View active risk zones near you</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#006B4F] transition-colors" />
        </Link>
      </div>

      {/* ── Safety Tips ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#EAF5F0] dark:bg-emerald-950/20 border border-[#006B4F]/15 dark:border-emerald-900/30 p-4 space-y-3">
        <p className="text-[11px] font-black text-[#006B4F] dark:text-emerald-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Safety Guidance — Monsoon Season
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Avoid slopes and hillside areas during heavy rainfall.',
            'Watch for cracks, water seepage or unusual sounds — evacuate immediately.',
            'Keep emergency number handy: District SDRF — 1077.',
            'Report any hazards you observe. Every report matters.',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 text-[#006B4F] shrink-0 mt-0.5" />
              <span className="text-[11px] text-slate-600 dark:text-zinc-400">{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alert Detail Modal ──────────────────────────────────────────── */}
      {isDetailModalOpen && (
        <AlertDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          alert={selectedAlertForModal}
          zones={zones}
        />
      )}
    </div>
  );
}
