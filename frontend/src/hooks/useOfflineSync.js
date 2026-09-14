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
      const count = reports.length;
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

    // Double-check server is reachable before pushing
    const reachable = await pingServer();
    if (!reachable) {
      setIsOnline(false);
      return;
    }

    const pending = await getPendingReports();
    if (pending.length === 0) return; // nothing to do

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const syncedIds = [];
      for (const report of pending) {
        try {
          await submitFieldReport(buildFormData(report));
          syncedIds.push(report.client_report_id);
          console.log(`[OfflineSync] ✓ Synced ${report.client_report_id}`);
        } catch (err) {
          console.warn(`[OfflineSync] ✗ Failed ${report.client_report_id}:`, err.message);
        }
      }

      if (syncedIds.length > 0) {
        await clearSyncedReports(syncedIds);
        await refreshPendingCount();
        const result = {
          time: new Date().toLocaleTimeString(),
          syncedCount: syncedIds.length,
          status: 'success',
        };
        setLastSyncResult(result);
        console.log(`[OfflineSync] ✅ Synced ${syncedIds.length} report(s)`);

        // Notify all tabs/feed components to reload
        try {
          const ch = new BroadcastChannel(SYNC_CHANNEL);
          ch.postMessage({ type: 'SYNC_COMPLETE', syncedCount: syncedIds.length });
          ch.close();
        } catch (_) {}
      }
    } catch (err) {
      console.error('[OfflineSync] Sync failed:', err);
      setLastSyncResult({
        time: new Date().toLocaleTimeString(),
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

    const check = async (isStartup = false) => {
      if (!active) return;
      const reachable = await pingServer();
      if (!active) return;

      setIsOnline(reachable);

      if (reachable) {
        // KEY FIX: on startup OR when coming back online, check for pending and sync
        const count = await refreshPendingCount();
        if (count > 0) {
          console.log(`[OfflineSync] Online with ${count} pending report(s) — syncing…`);
          triggerSync();
        }
      }
    };

    // Run immediately on mount — this catches the case where the user is already
    // online and has reports queued from a previous offline session
    check(true);

    const interval = setInterval(() => check(false), PING_INTERVAL_MS);

    // Fast-path: native browser events (may not fire in dev but help in prod)
    const handleOnline = () => check(false);
    const handleOffline = () => {
      if (active) setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      clearInterval(interval);
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
