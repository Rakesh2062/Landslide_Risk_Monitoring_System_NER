import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlerts, getFieldReports } from '../api/client';

const UnreadBadgeContext = createContext({
  unreadReportsCount: 0,
  unreadAlertsCount: 0,
  markReportsAsSeen: () => {},
  markAlertsAsSeen: () => {},
});

const SEEN_REPORTS_KEY = 'ner_seen_report_ids_v1';
const SEEN_ALERTS_KEY = 'ner_seen_alert_ids_v1';
const HAS_INITIALIZED_KEY = 'ner_badge_initialized_v1';

export function UnreadBadgeProvider({ children }) {
  const location = useLocation();

  // Load seen IDs from localStorage
  const [seenReportIds, setSeenReportIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_REPORTS_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });

  const [seenAlertIds, setSeenAlertIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_ALERTS_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });

  // Query live reports & alerts
  const { data: reports = [] } = useQuery({
    queryKey: ['reports_nav'],
    queryFn: () => getFieldReports(),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts_nav'],
    queryFn: () => getAlerts(),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
  });

  // Initial baseline: If first time loading app, mark existing historical data as seen so initial screen is clean like WhatsApp
  useEffect(() => {
    const isInitialized = localStorage.getItem(HAS_INITIALIZED_KEY);
    if (!isInitialized) {
      if (reports.length > 0 || alerts.length > 0) {
        const initialReportIds = new Set(reports.map((r) => r.report_id || r.client_report_id).filter(Boolean));
        const initialAlertIds = new Set(alerts.map((a) => a.alert_id || a.id).filter(Boolean));

        setSeenReportIds(initialReportIds);
        setSeenAlertIds(initialAlertIds);

        localStorage.setItem(SEEN_REPORTS_KEY, JSON.stringify([...initialReportIds]));
        localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify([...initialAlertIds]));
        localStorage.setItem(HAS_INITIALIZED_KEY, 'true');
      }
    }
  }, [reports, alerts]);

  // Compute unread/unseen counts
  const unreadReportsCount = useMemo(() => {
    if (!reports || reports.length === 0) return 0;
    const unseen = reports.filter((r) => {
      const id = r.report_id || r.client_report_id;
      return id && !seenReportIds.has(id);
    });
    return unseen.length;
  }, [reports, seenReportIds]);

  const unreadAlertsCount = useMemo(() => {
    if (!alerts || alerts.length === 0) return 0;
    const unseen = alerts.filter((a) => {
      const id = a.alert_id || a.id;
      return id && !seenAlertIds.has(id);
    });
    return unseen.length;
  }, [alerts, seenAlertIds]);

  // Mark reports as seen
  const markReportsAsSeen = useCallback(() => {
    if (!reports || reports.length === 0) return;
    setSeenReportIds((prev) => {
      const next = new Set(prev);
      reports.forEach((r) => {
        const id = r.report_id || r.client_report_id;
        if (id) next.add(id);
      });
      localStorage.setItem(SEEN_REPORTS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [reports]);

  // Mark alerts as seen
  const markAlertsAsSeen = useCallback(() => {
    if (!alerts || alerts.length === 0) return;
    setSeenAlertIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => {
        const id = a.alert_id || a.id;
        if (id) next.add(id);
      });
      localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [alerts]);

  // Auto-mark when user navigates to the respective page (like WhatsApp chat open)
  useEffect(() => {
    if (
      location.pathname === '/report' ||
      location.pathname.startsWith('/field-reports') ||
      location.pathname === '/citizen/reports' ||
      location.pathname.startsWith('/citizen/reports')
    ) {
      markReportsAsSeen();
    }
    if (
      location.pathname === '/alerts' ||
      location.pathname.startsWith('/public-alerts') ||
      location.pathname === '/citizen/alerts' ||
      location.pathname.startsWith('/citizen/alerts')
    ) {
      markAlertsAsSeen();
    }
  }, [location.pathname, markReportsAsSeen, markAlertsAsSeen]);

  // Listen to new sync events
  useEffect(() => {
    const handleSync = () => {
      // reports-synced event fired
    };
    window.addEventListener('reports-synced', handleSync);
    return () => window.removeEventListener('reports-synced', handleSync);
  }, []);

  return (
    <UnreadBadgeContext.Provider
      value={{
        unreadReportsCount,
        unreadAlertsCount,
        markReportsAsSeen,
        markAlertsAsSeen,
        totalAlertsCount: alerts.length,
        totalReportsCount: reports.length,
      }}
    >
      {children}
    </UnreadBadgeContext.Provider>
  );
}

export function useUnreadBadge() {
  return useContext(UnreadBadgeContext);
}
