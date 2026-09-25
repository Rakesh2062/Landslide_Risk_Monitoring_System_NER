import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function OfflineNotice() {
  const { t } = useTranslation();
  const { isOnline, pendingCount, isSyncing, lastSyncResult } = useOfflineSync();
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-dismiss success notification after 5 seconds
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.status === 'success' && pendingCount === 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult, pendingCount]);

  if (isOnline && pendingCount === 0 && !showSuccess) {
    return null;
  }

  return (
    <div className="w-full transition-all duration-300">
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
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#E63946] text-white font-mono text-[11px] font-bold shadow-xs">
                {pendingCount} {t('offline_notice.queued_label')}
              </span>
            )}
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/40 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#008060] animate-spin shrink-0" />
              <span>
                <strong>Auto-Sync Active:</strong> Network connection detected. Automatically uploading{' '}
                <strong>{pendingCount}</strong> queued offline report{pendingCount > 1 ? 's' : ''} to the central database...
              </span>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Auto-Saving
            </span>
          </div>
        </div>
      )}

      {showSuccess && isOnline && pendingCount === 0 && (
        <div className="bg-[#EAF5F0] dark:bg-emerald-950/40 border-b border-[#006B4F]/20 px-4 py-2 text-xs text-[#006B4F] dark:text-emerald-300 animate-fadeIn">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#008060] shrink-0" />
              <span>
                {lastSyncResult?.syncedCount
                  ? `Successfully uploaded and saved ${lastSyncResult.syncedCount} offline report(s) into database (${lastSyncResult.time}).`
                  : t('offline_notice.synced_msg', { time: lastSyncResult?.time || '' })}
              </span>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs font-semibold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
