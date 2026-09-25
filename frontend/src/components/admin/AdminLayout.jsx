import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlerts, getRiskZones, getFieldReports } from '../../api/client';
import { useUnreadBadge } from '../../context/UnreadBadgeContext';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import OfflineNotice from '../OfflineNotice';
import EmergencyAlertBanner from '../EmergencyAlertBanner';
import UserVerificationModal from './UserVerificationModal';

function AdminFooter() {
  return (
    <footer className="border-t border-[#D9E2DE] dark:border-[#27272A] bg-white dark:bg-[#0D0E10] py-4 mt-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#006B4F]" />
          <span className="font-semibold text-[#006B4F] dark:text-emerald-400">NER Landslide Early Warning Platform</span>
          <span>• East Khasi Hills</span>
        </div>
        <div className="flex items-center gap-3">
          <span>DB Connected</span>
          <span>•</span>
          <span className="font-mono">v1.2.4</span>
        </div>
      </div>
    </footer>
  );
}

export default function AdminLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed,  setIsSidebarCollapsed]  = useState(false);
  const [isProfileOpen,  setIsProfileOpen]  = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);

  const { unreadReportsCount, unreadAlertsCount } = useUnreadBadge();

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts_nav'],
    queryFn: () => getAlerts(),
    staleTime: 1000 * 30,
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones_nav'],
    queryFn: () => getRiskZones(),
    staleTime: 1000 * 60,
  });

  return (
    <div className="min-h-screen bg-[#F5F7F6] dark:bg-black text-[#1F2937] dark:text-zinc-100 transition-colors flex">
      {/* ── Fixed Sidebar ─────────────────────────────────── */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        activeAlertCount={unreadAlertsCount}
        pendingReportCount={unreadReportsCount}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* ── Main column offset by sidebar ─────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        {/* Fixed Top Header */}
        <TopHeader
          onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          alerts={alerts}
          zones={zones}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVerification={() => setIsVerificationOpen(true)}
        />

        {/* Push content below fixed header (h-16 = 64px) */}
        <div className="flex-1 flex flex-col pt-16">
          <OfflineNotice />

          <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-6">
            <Outlet />
          </main>

          <AdminFooter />
        </div>
      </div>

      {/* Modals */}
      <ProfileModal  isOpen={isProfileOpen}  onClose={() => setIsProfileOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <UserVerificationModal isOpen={isVerificationOpen} onClose={() => setIsVerificationOpen(false)} />
    </div>
  );
}
