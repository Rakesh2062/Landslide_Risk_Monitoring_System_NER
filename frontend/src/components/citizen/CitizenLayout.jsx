import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useUnreadBadge } from '../../context/UnreadBadgeContext';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';

import { emergencyAudio } from '../../utils/emergencyAudio';
import { listenForForegroundNotifications } from '../../services/firebaseMessaging';
import {
  LayoutDashboard,
  Map,
  FileText,
  Bell,
  Sun,
  Moon,
  Globe,
  Wifi,
  WifiOff,
  LogOut,
  ChevronDown,
  ShieldCheck,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  CloudRain,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/citizen',         label: 'Dashboard',         icon: LayoutDashboard, end: true },
  { path: '/citizen/map',     label: 'Risk Map',          icon: Map },
  { path: '/citizen/weather', label: 'Weather & Sensors', icon: CloudRain },
  { path: '/citizen/reports', label: 'Field Reports',     icon: FileText, key: 'reports' },
  { path: '/citizen/alerts',  label: 'Alerts',            icon: Bell,     key: 'alerts' },
];

export default function CitizenLayout() {
  const { user, logout, isOfficial } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isOnline } = useOfflineSync();
  const { unreadReportsCount, unreadAlertsCount } = useUnreadBadge();
  const { i18n } = useTranslation();
  const location = useLocation();

  const [isMobileOpen,   setIsMobileOpen]   = useState(false);
  const [isCollapsed,    setIsCollapsed]    = useState(false);
  const [isLangOpen,     setIsLangOpen]     = useState(false);

  const langRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => listenForForegroundNotifications(async (payload) => {
    const notification = payload.notification || {};
    const channels = (payload.data?.channels || 'app').split(',');
    if (channels.includes('siren')) {
      emergencyAudio.playEmergencySignal();
      navigator.vibrate?.([300, 100, 300, 100, 600]);
    }

    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title || 'Landslide alert', {
        body: notification.body || 'New safety information is available.',
        icon: '/logo.png',
        data: payload.data || { url: '/citizen/alerts' },
      });
    }
  }), []);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="min-h-screen bg-[#F5F7F6] dark:bg-black text-[#1F2937] dark:text-zinc-100 transition-colors flex">
      {/* ── Mobile backdrop ─────────────────────────────────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-[#0D0E10] border-r border-[#D9E2DE] dark:border-[#27272A] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#D9E2DE] dark:border-[#1E1E24] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[#D9E2DE] dark:border-[#27272A] shrink-0 overflow-hidden shadow-sm p-0.5">
              <img src="/logo.png" alt="NER LEWS" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-xs tracking-tight text-[#006B4F] dark:text-emerald-400 truncate">
                  NER Landslide Portal
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#006B4F]" /> Citizen Portal
                </span>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-lg text-slate-500 lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">
              Citizen Navigation
            </p>
          )}
          {NAV_ITEMS.map(({ path, label, icon: Icon, end, key }) => {
            const badgeCount = key === 'reports' ? unreadReportsCount : key === 'alerts' ? unreadAlertsCount : 0;

            return (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                    isCollapsed ? 'justify-center px-2' : ''
                  } ${
                    isActive
                      ? 'bg-[#006B4F] text-white font-bold shadow-sm'
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-[#F5F7F6] dark:hover:bg-[#141418] hover:text-[#006B4F] dark:hover:text-emerald-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-zinc-400 group-hover:text-[#006B4F] dark:group-hover:text-emerald-400'}`} />
                      {!isCollapsed && <span className="truncate">{label}</span>}
                    </div>

                    {!isCollapsed && badgeCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white text-[#006B4F]' : 'bg-[#E63946] text-white'
                      }`}>
                        {badgeCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User card + collapse button */}
        <div className="p-3 border-t border-[#D9E2DE] dark:border-[#1E1E24] shrink-0 bg-[#F8FAF9] dark:bg-[#121215]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#006B4F] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {user?.username ? user.username[0].toUpperCase() : 'C'}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 truncate">
                    {user?.username || 'Citizen'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                    {user?.district || 'East Khasi Hills'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-[#1E1E24] transition-colors shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-[#1E1E24] transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#0D0E10]/95 backdrop-blur-md border-b border-[#D9E2DE] dark:border-[#1E1E24] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-[#006B4F] dark:text-emerald-400 hidden sm:inline">
              Citizen Early Warning Desk
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online/Offline Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                isOnline
                  ? 'bg-emerald-50 text-[#008060] dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-red-50 text-[#E63946] dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/40 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Language Selector */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#141418] text-xs font-medium transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{currentLang.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isLangOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-2 border-b border-[#D9E2DE] dark:border-[#1E1E24] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Regional Languages
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          i18n.changeLanguage(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                          i18n.language === lang.code
                            ? 'bg-[#EAF5F0] text-[#006B4F] dark:bg-emerald-950/40 dark:text-emerald-400 font-bold'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-[#F5F7F6] dark:hover:bg-[#141418]'
                        }`}
                      >
                        <span>{lang.nativeName}</span>
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                          {lang.code.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-600 hover:text-[#E63946] dark:text-zinc-300 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>


        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
