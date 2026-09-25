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
      const count = reports ? reports.length : 0;
      setPendingCount(count);
      return count;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      setIsSyncing(true);
      const pending = await getPendingReports();
      if (!pending || pending.length === 0) {
        setPendingCount(0);
        setIsSyncing(false);
        return;
      }

      const syncedIds = [];
      for (const report of pending) {
        try {
          // Send multipart formData to match standard report submission
          const res = await submitFieldReport(buildQueuedReportFormData(report));
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
      }
    } catch (err) {
      console.error('Offline automatic sync failed:', err);
      setLastSyncResult({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'error',
        error: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    // Initial check and auto-sync if already online
    refreshPendingCount().then((count) => {
      if (count > 0 && navigator.onLine) {
        triggerSync();
      }
    });

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check to automatically flush pending offline reports as soon as network is live
    const intervalId = setInterval(async () => {
      if (navigator.onLine && !isSyncing) {
        const count = await refreshPendingCount();
        if (count > 0) {
          triggerSync();
        }
      }
    }, 3000);

    // Register ServiceWorker background sync if supported
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
