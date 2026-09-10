import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import AiRiskAssistant from '../admin/AiRiskAssistant';
import EmergencyAlertBanner from '../EmergencyAlertBanner';
import { listenForForegroundNotifications } from '../../services/firebaseMessaging';
import { emergencyAudio } from '../../utils/emergencyAudio';
import { SUPPORTED_LANGUAGES } from '../../i18n/index';
import {
  LayoutDashboard, Map, CloudRain, FileText, Bell, X, ChevronLeft, ChevronRight,
  ShieldCheck, LogOut, Sun, Moon, Wifi, WifiOff, Menu, Globe, ChevronDown,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/citizen',         label: 'Dashboard',     icon: LayoutDashboard, end: true },
  { path: '/citizen/map',     label: 'Risk Map',      icon: Map },
  { path: '/citizen/weather', label: 'Weather & Sensors', icon: CloudRain },
  { path: '/citizen/reports', label: 'Field Reports', icon: FileText },
  { path: '/citizen/alerts',  label: 'Alerts',        icon: Bell },
];

export default function CitizenLayout() {
  const { user, logout, isOfficial } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isOnline } = useOfflineSync();
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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-[#0D0E10] border-r border-[#D9E2DE] dark:border-[#27272A] shadow-lg lg:shadow-none transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#D9E2DE] dark:border-[#1E1E24] shrink-0">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-black border border-[#D9E2DE] dark:border-[#27272A] shrink-0 overflow-hidden shadow-sm">
              <img src="/logo.svg" alt="NER LEWS" className="w-full h-full object-cover" />
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
          {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
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
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-zinc-400 group-hover:text-[#006B4F] dark:group-hover:text-emerald-400'}`} />
                  {!isCollapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
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
                onClick={setIsCollapsed.bind(null, true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-[#1E1E24] transition-colors shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={setIsCollapsed.bind(null, false)}
              className="w-full py-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-[#1E1E24] transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        {/* Top header bar */}
        <header className="sticky top-0 z-40 w-full h-16 bg-white dark:bg-[#0D0E10] border-b border-[#D9E2DE] dark:border-[#27272A] shadow-xs flex items-center justify-between px-4 sm:px-6 transition-colors">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-[#141418] lg:hidden transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                <span>Citizen Portal</span>
                <span>/</span>
                <strong className="text-slate-800 dark:text-zinc-200 font-semibold capitalize">
                  {location.pathname === '/citizen' ? 'Dashboard'
                    : location.pathname === '/citizen/map' ? 'Risk Map'
                    : location.pathname === '/citizen/weather' ? 'Weather & Sensors'
                    : location.pathname === '/citizen/reports' ? 'Field Reports'
                    : location.pathname === '/citizen/alerts' ? 'Alerts'
                    : 'Overview'}
                </strong>
              </div>
              <span className="text-[10px] text-[#006B4F] dark:text-emerald-400 font-semibold">Verified Resident View</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online indicator */}
            <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
              isOnline
                ? 'bg-slate-50 text-slate-600 dark:bg-[#141418] dark:text-zinc-300 border-[#D9E2DE] dark:border-[#27272A]'
                : 'bg-red-50 text-[#E63946] dark:bg-red-950/40 dark:text-red-400 border-red-200'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3 text-[#006B4F]" /> : <WifiOff className="w-3 h-3 text-[#E63946]" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Language Selector */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-1.5 p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
                title="Select Language"
                aria-label="Select Language"
              >
                <Globe className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <span className="hidden sm:inline text-xs font-medium max-w-[64px] truncate">
                  {currentLang.nativeName}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isLangOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-2.5 bg-[#F5F7F6] dark:bg-[#121215] border-b border-[#D9E2DE] dark:border-[#1E1E24]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#006B4F] dark:text-emerald-400">
                      Regional Languages
                    </p>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isSelected = i18n.language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            i18n.changeLanguage(lang.code);
                            setIsLangOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#EAF5F0] text-[#006B4F] dark:bg-emerald-950/40 dark:text-emerald-400 font-bold'
                              : 'text-slate-700 dark:text-zinc-300 hover:bg-[#F5F7F6] dark:hover:bg-[#141418]'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span>{lang.nativeName}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">{lang.regionLabel}</span>
                          </div>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                            {lang.code.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A]">
              <div className="w-5 h-5 rounded-full bg-[#006B4F] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {user?.username ? user.username[0].toUpperCase() : 'C'}
              </div>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[100px]">
                {user?.username || 'Citizen'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EAF5F0] dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 font-bold border border-[#006B4F]/20">
                Verified
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#E63946] hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <EmergencyAlertBanner />

        {/* Page content via Outlet */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#D9E2DE] dark:border-[#27272A] bg-white dark:bg-[#0D0E10] py-3 transition-colors">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006B4F]" />
              <span className="font-semibold text-[#006B4F] dark:text-emerald-400">NER Landslide Early Warning</span>
              <span>• Citizen Portal</span>
            </div>
            <span>Emergency: SDRF 1077</span>
          </div>
        </footer>
      </div>

      {/* Shared assistant: same live-data/Gemini endpoint as the admin portal. */}
      <AiRiskAssistant showAdminActions={false} />
    </div>
  );
}
