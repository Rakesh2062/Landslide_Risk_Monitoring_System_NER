import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useUnreadBadge } from '../../context/UnreadBadgeContext';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import RiskBadge from './RiskBadge';
import {
  Menu,
  Bell,
  Search,
  Globe,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Database,
  Radio,
  MapPin,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function TopHeader({
  onToggleSidebar,
  isSidebarCollapsed,
  alerts = [],
  zones = [],
  onOpenProfile,
  onOpenSettings,
  onOpenVerification,
}) {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, isOfficial } = useAuth();
  const { isOnline } = useOfflineSync();
  const { unreadAlertsCount, markAlertsAsSeen } = useUnreadBadge();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);
  const langRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute clean breadcrumbs from pathname
  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/':
        return { section: 'Command Center', current: 'Dashboard' };
      case '/map':
        return { section: 'Command Center', current: 'Risk Map' };
      case '/predict':
        return { section: 'Decision Support', current: 'Risk Predictor' };
      case '/report':
        return { section: 'Field Operations', current: 'Field Reports' };
      case '/alerts':
        return { section: 'Public Directives', current: 'Emergency Alerts' };
      default:
        return { section: 'Command Center', current: 'Overview' };
    }
  };

  const breadcrumb = getBreadcrumb();
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  // Client-side quick filter on loaded zones for the search input
  const searchResults = searchQuery.trim()
    ? zones.filter(
        (z) =>
          z.village_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          z.zone_id?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSearchResultClick = (zone) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/map?zone_id=${encodeURIComponent(zone.zone_id)}&lat=${zone.lat}&lng=${zone.lng}`);
  };

  const handleToggleNotif = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      markAlertsAsSeen();
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#0D0E10]/95 backdrop-blur-md border-b border-[#D9E2DE] dark:border-[#1E1E24] transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'left-0 lg:left-[72px]' : 'left-0 lg:left-64'
      }`}
    >
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* ── Left: Sidebar Toggle & Breadcrumbs ───────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs" aria-label="Breadcrumb">
            <span className="text-slate-400 dark:text-zinc-400">{breadcrumb.section}</span>
            <span className="text-slate-300 dark:text-zinc-600">/</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
              {breadcrumb.current}
            </span>
          </nav>
        </div>

        {/* ── Center: Quick Search Bar ───────────────────────────────── */}
        <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder={t('navbar.search_placeholder', { defaultValue: 'Search zones, villages, IDs...' })}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F] transition-all"
            />
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-2 border-b border-[#D9E2DE] dark:border-[#1E1E24] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Risk Zones & Villages
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#D9E2DE]/50 dark:divide-[#1E1E24]">
                {searchResults.map((zone) => (
                  <button
                    key={zone.zone_id}
                    onClick={() => handleSearchResultClick(zone)}
                    className="w-full p-2.5 text-left hover:bg-[#F5F7F6] dark:hover:bg-[#141418] flex items-center justify-between gap-3 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[#006B4F] dark:text-emerald-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {zone.village_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 ml-1.5">
                          {zone.zone_id}
                        </span>
                      </div>
                    </div>
                    <RiskBadge severity={zone.severity} size="xs" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Status, Language, Theme, Notifications, Profile ──── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* GIS Live Node Status */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF5F0] dark:bg-emerald-950/40 border border-[#006B4F]/20 text-[11px] font-medium text-[#006B4F] dark:text-emerald-400">
            <Database className="w-3 h-3" />
            <span>Connected to GIS Database</span>
          </div>

          {/* Verification Portal Action */}
          {isOfficial && (
            <button
              onClick={onOpenVerification}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EAF5F0] dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 hover:bg-[#006B4F] hover:text-white transition-all text-xs font-semibold border border-[#006B4F]/30"
              title="Verify Citizen Residency Registrations"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Verify Residents</span>
            </button>
          )}

          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-[#008060] dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                : 'bg-red-50 text-[#E63946] dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/40 animate-pulse'
            }`}
            title={isOnline ? 'Network connection active' : 'Running in offline cached mode'}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Language Selector Dropdown */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#141418] text-xs font-medium transition-colors"
              title="Select Language"
              aria-label="Select Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">{currentLang.name}</span>
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

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Color Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Notifications Dropdown (WhatsApp-style: Only unread unseen alerts show a number) */}
          <div ref={notifRef} className="relative">
            <button
              onClick={handleToggleNotif}
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors cursor-pointer"
              title="Notifications & Active Alerts"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E63946] text-white text-[9px] font-extrabold animate-pulse shadow-xs">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl shadow-xl overflow-hidden z-50">
                <div className="flex items-center justify-between p-3.5 border-b border-[#D9E2DE] dark:border-[#1E1E24] bg-[#F5F7F6]/50 dark:bg-[#121215]">
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 dark:text-white">Active Directives</h3>
                    <p className="text-[10px] text-slate-500">{alerts.length} warning notices issued</p>
                  </div>
                  <Link
                    to="/alerts"
                    onClick={() => {
                      setIsNotifOpen(false);
                      markAlertsAsSeen();
                    }}
                    className="text-[11px] font-bold text-[#006B4F] dark:text-emerald-400 hover:underline"
                  >
                    View all
                  </Link>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[#D9E2DE]/60 dark:divide-[#27272A]/60">
                  {alerts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                      No active emergency alerts at this time.
                    </div>
                  ) : (
                    alerts.slice(0, 4).map((alert) => (
                      <div key={alert.alert_id} className="p-3 hover:bg-[#F5F7F6] dark:hover:bg-[#141418] transition-colors space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                            {alert.alert_id}
                          </span>
                          <RiskBadge severity={alert.severity} size="xs" />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
                          <span>Target: {alert.target_zone}</span>
                          <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-[#D9E2DE] dark:border-[#1E1E24] bg-[#F5F7F6]/50 dark:bg-[#121215]">
                  <Link
                    to="/alerts"
                    onClick={() => {
                      setIsNotifOpen(false);
                      markAlertsAsSeen();
                    }}
                    className="w-full py-1.5 rounded-lg bg-[#006B4F] hover:bg-[#00523c] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>Open Public Bulletins & Directives</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#141418] transition-colors"
              aria-label="User Menu"
            >
              <div className="w-7 h-7 rounded-full bg-[#006B4F] text-white flex items-center justify-center text-xs font-bold font-mono">
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:flex flex-col items-start text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-tight">
                  {user?.district || 'East Khasi Hills'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                  {user?.role === 'field_official' ? 'Field Responder' : 'District Admin'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden lg:block" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl shadow-xl overflow-hidden z-50">
                <div className="p-3 border-b border-[#D9E2DE] dark:border-[#1E1E24] bg-[#F5F7F6]/50 dark:bg-[#121215]">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{user?.name || 'District Official'}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">{user?.email || 'admin@meghalaya.gov.in'}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenProfile?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-[#F5F7F6] dark:hover:bg-[#141418] transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Officer Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenSettings?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-[#F5F7F6] dark:hover:bg-[#141418] transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>System Preferences</span>
                  </button>
                </div>

                <div className="p-1.5 border-t border-[#D9E2DE] dark:border-[#1E1E24]">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#E63946] hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>End Session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
