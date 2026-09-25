/**
 * useOfflineSync — Reliable offline/online detection + auto-sync
 *
 * FIX: On initial mount, if the server is reachable AND there are pending
 * reports in IndexedDB, trigger sync immediately. Previously this was missed
 * because the offline→online transition was only detected by a state change,
 * not checked on startup.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingReports, clearSyncedReports } from '../db/indexedDb';
import { submitFieldReport } from '../api/client';

export const SYNC_CHANNEL = 'ner_offline_sync';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
// Derive the health URL: strip trailing /api to get the root
const HEALTH_URL = BASE_URL.replace(/\/api\/?$/, '') + '/health';
const PING_INTERVAL_MS = 10000; // ping every 10 seconds

/** Active ping — returns true if the backend is actually reachable */
async function pingServer() {
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function dataUrlToBlob(dataUrl) {
  try {
    const [header, encoded] = dataUrl.split(',');
    const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function buildFormData(report) {
  const fd = new FormData();
  fd.append('lat', String(report.lat));
  fd.append('lng', String(report.lng));
  fd.append('description', report.description || '');
  fd.append('reporter_type', report.reporter_type || 'citizen');
  fd.append('severity', report.severity || 'medium');
  fd.append('language', report.language || 'en');
  fd.append('client_report_id', report.client_report_id);
  fd.append('timestamp', report.timestamp || new Date().toISOString());

  const photo =
    report.photo_file instanceof Blob
      ? report.photo_file
      : report.photo_data
      ? dataUrlToBlob(report.photo_data)
      : null;
  if (photo) fd.append('photo', photo, report.photo_name || 'evidence.jpg');
  return fd;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const isSyncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const reports = await getPendingReports();
      const count = reports ? reports.length : 0;
      setPendingCount(count);
      return count;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  // ── Core sync function ───────────────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const reachable = await pingServer();
      if (!reachable) {
        setIsOnline(false);
        return;
      }

      setIsOnline(true);
      const pending = await getPendingReports();
      if (!pending?.length) {
        setPendingCount(0);
        return;
      }

      setPendingCount(pending.length);
      const syncedIds = [];
      for (const report of pending) {
        try {
          const res = await submitFieldReport(buildFormData(report));
          syncedIds.push(report.client_report_id);

          // Update local submission history so it transitions from pending_sync to received
          try {
            const savedHistory = JSON.parse(localStorage.getItem('my_local_reports') || '[]');
            const updatedHistory = savedHistory.map((item) => {
              if (item.client_report_id === report.client_report_id) {
                return {
                  ...item,
                  report_id: res?.report_id || item.report_id || `FR-${Date.now().toString().slice(-4)}`,
                  status: 'received',
                  is_pending: false,
                };
              }
              return item;
            });
            if (!savedHistory.some((item) => item.client_report_id === report.client_report_id)) {
              updatedHistory.unshift({
                report_id: res?.report_id || `FR-${Date.now().toString().slice(-4)}`,
                client_report_id: report.client_report_id,
                lat: report.lat,
                lng: report.lng,
                description: report.description,
                photo_url: res?.photo_url || report.photo_data,
                status: 'received',
                severity: report.severity || 'medium',
                reporter_type: report.reporter_type || 'citizen',
                timestamp: report.timestamp || new Date().toISOString(),
                is_pending: false,
              });
            }
            localStorage.setItem('my_local_reports', JSON.stringify(updatedHistory));
          } catch (storageErr) {
            console.warn('Failed to update local storage history:', storageErr);
          }
        } catch (error) {
          // Keep failed reports in the queue for retry on next sync cycle
          console.warn(`Offline report ${report.client_report_id} will be retried:`, error);
        }
      }

      if (syncedIds.length > 0) {
        await clearSyncedReports(syncedIds);
        await refreshPendingCount();
        setLastSyncResult({
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          syncedCount: syncedIds.length,
          status: 'success',
        });

        // Broadcast to all pages to auto-refresh feeds and tables
        window.dispatchEvent(
          new CustomEvent('reports-synced', {
            detail: { syncedCount: syncedIds.length, syncedIds },
          })
        );
        try {
          const channel = new BroadcastChannel(SYNC_CHANNEL);
          channel.postMessage({ type: 'SYNC_COMPLETE', syncedCount: syncedIds.length });
          channel.close();
        } catch {
        }
      }
    } catch (err) {
      console.error('Offline automatic sync failed:', err);
      setLastSyncResult({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'error',
        error: err.message,
      });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // ── Heartbeat + startup sync ─────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      const reachable = await pingServer();
      if (!active) return;

      setIsOnline(reachable);
      if (reachable) {
        const count = await refreshPendingCount();
        if (active && count > 0) triggerSync();
      }
    };

    checkConnection();
    const intervalId = setInterval(checkConnection, PING_INTERVAL_MS);

    const handleOnline = () => checkConnection();
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.sync.register('sync-field-reports');
        })
        .catch((err) => {
          console.debug('Background Sync registration skipped:', err);
        });
    }

    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount, isSyncing]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    refreshPendingCount,
  };
}
