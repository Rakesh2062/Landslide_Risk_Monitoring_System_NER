import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { WifiOff, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function OfflineNotice() {
  const { isOnline, pendingCount, isSyncing, triggerSync, lastSyncResult } = useOfflineSync();

  // Nothing to show when fully online with empty queue and no recent sync
  if (isOnline && pendingCount === 0 && !isSyncing && !lastSyncResult) return null;

  return (
    <div className="w-full">

      {/* ── Offline: no server connection ────────────────────────────── */}
      {!isOnline && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-4 py-2 text-xs text-[#E63946]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline</strong> — Cannot reach server. Reports submitted now are saved
                on this device and will be sent automatically when you reconnect.
              </span>
            </div>
            {pendingCount > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded bg-[#E63946] text-white font-mono text-[11px] font-bold">
                {pendingCount} queued
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Online but syncing in progress ───────────────────────────── */}
      {isOnline && isSyncing && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            <span>
              <strong>Uploading {pendingCount} queued report{pendingCount !== 1 ? 's' : ''}…</strong>
              {' '}Sending to server automatically.
            </span>
          </div>
        </div>
      )}

      {/* ── Online + pending but not yet syncing ─────────────────────── */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{pendingCount} offline report{pendingCount !== 1 ? 's' : ''}</strong> pending upload.
              </span>
            </div>
            {/* Manual fallback in case auto-sync hasn't fired yet */}
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#006B4F] hover:bg-[#00523c] text-white font-medium text-xs shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Send Now
            </button>
          </div>
        </div>
      )}

      {/* ── Sync completed ────────────────────────────────────────────── */}
      {lastSyncResult?.status === 'success' && pendingCount === 0 && !isSyncing && (
        <div className="bg-[#EAF5F0] dark:bg-emerald-950/40 border-b border-[#006B4F]/20 px-4 py-2 text-xs text-[#006B4F] dark:text-emerald-300">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#008060] shrink-0" />
            <span>
              {lastSyncResult.syncedCount} report{lastSyncResult.syncedCount !== 1 ? 's' : ''} synced
              successfully at {lastSyncResult.time}.
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
