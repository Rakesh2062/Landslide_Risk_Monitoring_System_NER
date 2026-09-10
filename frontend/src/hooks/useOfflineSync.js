import { useState, useEffect, useCallback } from 'react';
import { getPendingReports, clearSyncedReports } from '../db/indexedDb';
import { submitFieldReport } from '../api/client';

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function buildQueuedReportFormData(report) {
  const formData = new FormData();
  formData.append('lat', String(report.lat));
  formData.append('lng', String(report.lng));
  formData.append('description', report.description || '');
  formData.append('reporter_type', report.reporter_type || 'citizen');
  formData.append('severity', report.severity || 'medium');
  formData.append('language', report.language || 'en');
  formData.append('client_report_id', report.client_report_id);
  formData.append('timestamp', report.timestamp || new Date().toISOString());

  // IndexedDB can retain a File directly; the data-URL fallback supports
  // reports created before this change and browsers that cannot retain Files.
  const photo = report.photo_file instanceof Blob
    ? report.photo_file
    : (report.photo_data ? dataUrlToBlob(report.photo_data) : null);
  if (photo) {
    formData.append('photo', photo, report.photo_name || 'offline-evidence.jpg');
  }
  return formData;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const reports = await getPendingReports();
      setPendingCount(reports.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      setIsSyncing(true);
      const pending = await getPendingReports();
      if (pending.length === 0) {
        setIsSyncing(false);
        return;
      }

      const syncedIds = [];
      for (const report of pending) {
        try {
          // Use the normal multipart endpoint so the evidence photo receives
          // exactly the same server-side storage treatment as an online report.
          await submitFieldReport(buildQueuedReportFormData(report));
          syncedIds.push(report.client_report_id);
        } catch (error) {
          // Keep failed reports (and their photos) in the queue for retry.
          console.warn(`Offline report ${report.client_report_id} will be retried:`, error);
        }
      }

      if (syncedIds.length > 0) {
        await clearSyncedReports(syncedIds);
        await refreshPendingCount();
        setLastSyncResult({
          time: new Date().toLocaleTimeString(),
          syncedCount: syncedIds.length,
          status: 'success',
        });
      }
    } catch (err) {
      console.error('Offline sync failed:', err);
      setLastSyncResult({
        time: new Date().toLocaleTimeString(),
        status: 'error',
        error: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register ServiceWorker background sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.sync.register('sync-field-reports');
        })
        .catch((err) => {
          // Background sync not allowed or rejected, browser event fallback remains active
          console.debug('Background Sync registration skipped:', err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    refreshPendingCount,
  };
}
