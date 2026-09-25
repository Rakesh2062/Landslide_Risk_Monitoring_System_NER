import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getFieldReports, updateFieldReportStatus, deleteFieldReport } from '../api/client';
import { useOfflineSync } from '../hooks/useOfflineSync';
import ReportForm from '../components/ReportForm';
import PageHeader from '../components/admin/PageHeader';
import SectionCard from '../components/admin/SectionCard';
import StatusBadge from '../components/admin/StatusBadge';
import RiskBadge from '../components/admin/RiskBadge';
import {
  FileText,
  ShieldCheck,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Camera,
  Layers,
  Search,
  Filter,
  AlertTriangle,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function FieldReportPage() {
  const { t } = useTranslation();
  const { isOfficial } = useAuth();
  const { pendingCount, isOnline } = useOfflineSync();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await getFieldReports();
      setReports(data || []);
    } catch (err) {
      console.error('Failed to load field reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    const handleSync = () => {
      loadReports();
    };
    window.addEventListener('reports-synced', handleSync);
    return () => window.removeEventListener('reports-synced', handleSync);
  }, []);

  const handleUpdateStatus = async (reportId, newStatus) => {
    // Optimistic UI update
    setReports((prev) =>
      prev.map((r) => (r.report_id === reportId ? { ...r, status: newStatus } : r))
    );
    try {
      await updateFieldReportStatus(reportId, newStatus);
    } catch (err) {
      console.error('Failed to update report status:', err);
      loadReports();
    }
  };

  const handleUpdateSeverity = async (reportId, newSeverity) => {
    // Optimistic UI update
    setReports((prev) =>
      prev.map((r) => (r.report_id === reportId ? { ...r, severity: newSeverity } : r))
    );
    try {
      await updateFieldReportStatus(reportId, null, newSeverity);
    } catch (err) {
      console.error('Failed to update report severity:', err);
      loadReports();
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm(`Archive report ${reportId}? It will be removed from the review queue but kept in the database.`)) return;
    // Optimistic UI: mark as archived so it disappears from the filtered view
    setReports((prev) => prev.map((r) => r.report_id === reportId ? { ...r, status: 'archived' } : r));
    try {
      await deleteFieldReport(reportId);
    } catch (err) {
      console.error('Failed to archive report:', err);
      loadReports();
    }
  };

  const filteredReports = reports.filter((r) => {
    // Always hide archived (soft-deleted) reports from the review queue
    if (r.status === 'archived') return false;
    const matchesStatus = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter;
    const matchesSeverity = severityFilter === 'all' || (r.severity || 'medium').toLowerCase() === severityFilter;
    return matchesStatus && matchesSeverity;
  });

  const verifiedCount = reports.filter((r) => r.status === 'verified').length;
  const receivedCount = reports.filter((r) => r.status === 'received').length;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader
        kicker="Field Operations & Citizen Science"
        title="Field Incident Reporting & Moderation"
        description="Ground-level hazard verification portal. Ground survey teams and local citizens can submit geolocated tensile cracks, mudslides, and boulder falls with photographic documentation."
        badge={isOnline ? 'Online Sync Active' : 'Offline Queueing Active'}
        actions={
          <button
            onClick={loadReports}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-700 dark:text-zinc-300 hover:text-[#006B4F] text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Reports</span>
          </button>
        }
      />

      {/* ── Status Metrics Quick Bar ────────────────────────────── */}
      {isOfficial && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Incident Reports
            </span>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {reports.length}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
              Verified by Officials
            </span>
            <span className="text-2xl font-black font-mono text-[#008060] dark:text-emerald-400">
              {verifiedCount}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
              Pending Review
            </span>
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {receivedCount}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
              Local Offline Queue
            </span>
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {pendingCount}
            </span>
          </div>
        </div>
      )}

      {/* ── Main Layout: Form + Reports View ──── */}
      {!isOfficial ? (
        <div className="max-w-3xl mx-auto">
          <SectionCard
            kicker="Citizen Incident Portal"
            title="Submit & View My Reports"
            subtitle="Submit new ground movement reports and check if they have been reviewed or accepted by officials."
          >
            <ReportForm onReportSubmitted={loadReports} />
          </SectionCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Submission Form */}
        <div className="lg:col-span-6 space-y-4">
          <SectionCard
            kicker="New Ground Observation"
            title="Submit Hazard Incident"
            subtitle="Record geolocated ground movement, rockfall, or retaining wall deformation."
          >
            <ReportForm onReportSubmitted={loadReports} />
          </SectionCard>
        </div>

        {/* Right Column: Ground Reports Review Queue */}
        <div className="lg:col-span-6 space-y-4">
          <SectionCard
            kicker="Ground Truth Verification"
            title="Field Reports Review Feed"
            subtitle="Review incident reports submitted by ground responders and citizen observers."
            badge={`${filteredReports.length} Shown`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1 rounded-md bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-[11px] font-semibold text-slate-700 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="all">All Statuses ({reports.length})</option>
                    <option value="received">Pending Review ({receivedCount})</option>
                    <option value="verified">Verified ({verifiedCount})</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-2 py-1 rounded-md bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-[11px] font-semibold text-slate-700 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            }
          >
            <div className="space-y-3.5 max-h-[760px] overflow-y-auto pr-1">
              {filteredReports.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 dark:text-zinc-500">
                  No reports matching filter criteria.
                </div>
              ) : (
                filteredReports.map((r) => (
                  <div
                    key={r.report_id}
                    className="p-4 rounded-xl border border-[#D9E2DE] dark:border-[#27272A] bg-[#F5F7F6]/60 dark:bg-[#141418] space-y-2.5 transition-all shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#006B4F] dark:text-emerald-400">
                          {r.report_id}
                        </span>
                        <StatusBadge status={r.status} size="xs" />
                        <RiskBadge severity={r.severity || 'medium'} size="xs" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {r.timestamp
                          ? new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                      {r.description || 'No description provided.'}
                    </p>

                    {/* Photo thumbnail if available */}
                    {r.photo_url && (
                      <div className="relative rounded-lg overflow-hidden border border-[#D9E2DE] dark:border-[#27272A] max-h-40 bg-black/10">
                        <img
                          src={r.photo_url}
                          alt="Incident proof"
                          className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setSelectedPhoto(r.photo_url)}
                        />
                      </div>
                    )}

                    {/* Official Severity Allocation + Verification Bar */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      {/* Severity Allocation Selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 dark:text-zinc-300 text-[10px] uppercase font-mono flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Allocate Severity:
                        </span>
                        <select
                          value={r.severity || 'medium'}
                          onChange={(e) => handleUpdateSeverity(r.report_id, e.target.value)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-[#006B4F]"
                        >
                          <option value="low">Low Severity</option>
                          <option value="medium">Medium Severity</option>
                          <option value="high">High Severity</option>
                          <option value="critical">Critical Hazard</option>
                        </select>
                      </div>

                      {/* Official Verification Controls */}
                      <div className="flex items-center gap-1.5">
                        {r.status !== 'verified' && (
                          <button
                            onClick={() => handleUpdateStatus(r.report_id, 'verified')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-[#008060] dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify</span>
                          </button>
                        )}
                        {r.status !== 'dismissed' && (
                          <button
                            onClick={() => handleUpdateStatus(r.report_id, 'dismissed')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200/60 transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Dismiss</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(r.report_id)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/60 transition-colors flex items-center gap-1"
                          title="Remove this report"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>GPS Coordinates: {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}</span>
                      </div>
                      <span>Submitted by {r.reporter_type || 'citizen'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
      )}

      {/* Photo Preview Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-xl overflow-hidden shadow-2xl bg-black">
            <img src={selectedPhoto} alt="Proof high resolution" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
