import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { submitFieldReport } from '../api/client';
import { savePendingReport, getPendingReports } from '../db/indexedDb';
import { useOfflineSync } from '../hooks/useOfflineSync';
import ReportDetailModal from './ReportDetailModal';
import {
  Camera,
  MapPin,
  Send,
  CheckCircle2,
  Clock,
  Shield,
  User,
  RefreshCw,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export default function ReportForm() {
  const { t, i18n } = useTranslation();
  const { isOnline, refreshPendingCount } = useOfflineSync();

  const [description, setDescription] = useState('');
  const [reporterType, setReporterType] = useState('official');
  const [severity, setSeverity] = useState('medium');
  const [lat, setLat] = useState('25.2840');
  const [lng, setLng] = useState('91.7325');
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | detecting | acquired | failed
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [activeTab, setActiveTab] = useState('form'); // form | history
  const [selectedReport, setSelectedReport] = useState(null);

  // Quick hazard presets mapped to translation keys
  const hazardPresetKeys = [
    { key: 'hazard_crack', text: 'Tensile crack on hillside road cut' },
    { key: 'hazard_mud', text: 'Active mudslide and debris accumulation' },
    { key: 'hazard_boulder', text: 'Dislodged rock boulders blocking carriageway' },
    { key: 'hazard_wall', text: 'Retaining wall bowing with seepages' },
    { key: 'hazard_culvert', text: 'Culvert drainage choked by slope sediment' },
  ];

  const loadReportsHistory = async () => {
    try {
      const pending = await getPendingReports();
      const localHistory = JSON.parse(localStorage.getItem('my_local_reports') || '[]');

      // Merge pending and submitted
      const all = [
        ...pending.map((p) => ({ ...p, is_pending: true, status: 'pending_sync' })),
        ...localHistory,
      ];
      setMyReports(all);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadReportsHistory();
  }, []);

  // Geolocation auto-detection
  const detectLocation = () => {
    setLocationStatus('detecting');
    if (!navigator.geolocation) {
      setLocationStatus('failed');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
        setLocationStatus('acquired');
      },
      (err) => {
        console.warn('Geolocation detection error:', err);
        setLocationStatus('failed');
        // Fallback default coordinate for Sohra / Cherrapunji
        setLat('25.2840');
        setLng('91.7325');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoError(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    // Evidence photo is mandatory
    if (!photoFile && !photoPreview) {
      setPhotoError(true);
      // Scroll to photo section
      document.getElementById('photo-upload-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setPhotoError(false);

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const clientReportId = `CR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();

    const reportPayload = {
      client_report_id: clientReportId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      description: description.trim(),
      reporter_type: reporterType,
      severity,
      language: i18n.language || 'en',
      timestamp,
      // File is structured-cloneable in IndexedDB. The data URL is retained as
      // a backwards-compatible fallback and for the offline report preview.
      photo_file: photoFile,
      photo_name: photoFile?.name || 'offline-evidence.jpg',
      photo_data: photoPreview,
    };

    try {
      const formData = new FormData();
      formData.append('lat', lat);
      formData.append('lng', lng);
      formData.append('description', description.trim());
      formData.append('reporter_type', reporterType);
      formData.append('severity', severity);
      formData.append('language', i18n.language || 'en');
      formData.append('client_report_id', clientReportId);
      formData.append('timestamp', timestamp);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await submitFieldReport(formData);

      // Save to local submission history
      const savedHistory = JSON.parse(localStorage.getItem('my_local_reports') || '[]');
      savedHistory.unshift({
        report_id: res?.report_id || `FR-${Date.now().toString().slice(-4)}`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        description: description.trim(),
        photo_url: res?.photo_url || photoPreview,
        status: 'received',
        severity,
        reporter_type: reporterType,
        timestamp,
      });
      localStorage.setItem('my_local_reports', JSON.stringify(savedHistory));

      setSubmissionFeedback({
        type: 'success',
        report_id: res?.report_id || 'FR-SUBMITTED',
        message: t('report_form.success_msg'),
      });

      setDescription('');
      setPhotoPreview(null);
      setPhotoFile(null);
      await loadReportsHistory();
    } catch (err) {
      console.warn('Online submission failed, falling back to offline queue:', err);
      await savePendingReport(reportPayload);
      await refreshPendingCount();
      await loadReportsHistory();

      setSubmissionFeedback({
        type: 'offline_saved',
        message: t('report_form.offline_msg'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      
      {/* Mobile Tab Switcher: Form vs My Reports */}
      <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'form'
              ? 'bg-white dark:bg-zinc-900 text-[#006B4F] dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-zinc-400 hover:text-[#006B4F]'
          }`}
        >
          {t('report_form.title')}
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            loadReportsHistory();
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-zinc-900 text-[#006B4F] dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-zinc-400 hover:text-[#006B4F]'
          }`}
        >
          <span>{t('report_form.my_reports')}</span>
          {myReports.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#006B4F] text-white font-mono">
              {myReports.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'form' ? (
        <div className="bg-white dark:bg-zinc-950 border border-[#D9E2DE] dark:border-zinc-800 rounded-xl p-5 sm:p-7 shadow-sm space-y-5">
          
          <div>
            <h2 className="text-lg font-bold text-[#006B4F] dark:text-emerald-400">
              {t('report_form.title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t('report_form.subtitle')}
            </p>
          </div>

          {/* Submission Alert / Toast Feedback */}
          {submissionFeedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                submissionFeedback.type === 'success'
                  ? 'bg-[#EAF5F0] border-[#006B4F]/30 text-[#006B4F] dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-300 text-amber-800 dark:text-amber-300'
              }`}
            >
              {submissionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#006B4F] shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold">
                  {submissionFeedback.type === 'success'
                    ? t('report_form.success_label', { id: submissionFeedback.report_id })
                    : t('report_form.offline_saved_label')}
                </p>
                <p>{submissionFeedback.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Reporter Type Selection */}
            <div>
              <label className="block font-semibold text-[#1F2937] dark:text-zinc-300 mb-1.5">
                {t('report_form.reporter_type')} <span className="text-[#E63946]">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setReporterType('official')}
                  className={`py-2.5 px-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all ${
                    reporterType === 'official'
                      ? 'bg-[#008060] text-white border-[#008060] shadow-sm'
                      : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-[#D9E2DE] dark:border-zinc-800'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>{t('report_form.official')}</span>
                </button>
              </div>
            </div>

            {/* Severity Level Selection */}
            <div>
              <label className="block font-semibold text-[#1F2937] dark:text-zinc-300 mb-1.5">
                Reported Severity Level <span className="text-[#E63946]">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'critical', label: 'Critical', active: 'bg-red-600 text-white border-red-700' },
                  { key: 'high',     label: 'High',     active: 'bg-orange-600 text-white border-orange-700' },
                  { key: 'medium',   label: 'Medium',   active: 'bg-amber-600 text-white border-amber-700' },
                  { key: 'low',      label: 'Low',      active: 'bg-emerald-600 text-white border-emerald-700' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSeverity(s.key)}
                    className={`py-2 px-2 rounded-xl border text-xs font-black transition-all uppercase ${
                      severity === s.key
                        ? `${s.active} shadow-md ring-2 ring-offset-1 ring-slate-400 dark:ring-zinc-600`
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-[#D9E2DE] dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Telemetry */}
            <div className="p-3.5 rounded-xl bg-[#F5F7F6] dark:bg-zinc-900/80 border border-[#D9E2DE] dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#1F2937] dark:text-zinc-200 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
                  <span>{t('report_form.location')}</span> <span className="text-[#E63946]">*</span>
                </label>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationStatus === 'detecting'}
                  className="px-2.5 py-1 rounded-lg bg-[#EAF5F0] text-[#006B4F] dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-[#d8ece2] font-semibold text-[11px] flex items-center gap-1 transition-all border border-[#006B4F]/20"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{locationStatus === 'detecting' ? t('report_form.detecting') : t('report_form.detect_location')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500">{t('report_form.lat_label')}</span>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black border border-[#D9E2DE] dark:border-zinc-700 font-mono text-xs text-[#1F2937] dark:text-white focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F]"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">{t('report_form.lng_label')}</span>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-black border border-[#D9E2DE] dark:border-zinc-700 font-mono text-xs text-[#1F2937] dark:text-white focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F]"
                  />
                </div>
              </div>
              {locationStatus === 'acquired' && (
                <p className="text-[10px] text-[#008060] font-medium">
                  {t('report_form.location_detected')}
                </p>
              )}
            </div>

            {/* Incident Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-[#1F2937] dark:text-zinc-300">
                  {t('report_form.description')} <span className="text-[#E63946]">*</span>
                </label>
                <span className="text-[10px] text-slate-500">{t('report_form.quick_tag_label')}</span>
              </div>

              {/* Quick tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hazardPresetKeys.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setDescription(t(`report_form.${preset.key}`, { defaultValue: preset.text }))}
                    className="px-2 py-1 rounded-md bg-[#EAF5F0] dark:bg-zinc-800 hover:bg-[#006B4F] hover:text-white text-[10px] text-[#006B4F] dark:text-emerald-400 border border-[#D9E2DE] dark:border-zinc-700 transition-colors"
                  >
                    + {t(`report_form.${preset.key}`, { defaultValue: preset.text })}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('report_form.description_placeholder')}
                className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900 text-[#1F2937] dark:text-zinc-100 border border-[#D9E2DE] dark:border-zinc-800 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F] leading-relaxed"
              />
            </div>

            {/* Photo Capture / Upload */}
            <div id="photo-upload-section">
              <label className="block font-semibold text-[#1F2937] dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>{t('report_form.photo_label')} <span className="text-[#E63946]">*</span></span>
                <span className="text-[10px] font-semibold text-[#E63946] bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/40">
                  Mandatory
                </span>
              </label>

              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-[#D9E2DE] dark:border-zinc-700 max-h-52 bg-zinc-900">
                  <img
                    src={photoPreview}
                    alt="Uploaded incident preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoFile(null);
                    }}
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold hover:bg-[#E63946]"
                  >
                    {t('report_form.photo_remove')}
                  </button>
                </div>
              ) : (
                <label className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#F5F7F6]/50 dark:bg-zinc-900/40 ${photoError ? 'border-[#E63946] bg-red-50/40 dark:bg-red-950/10' : 'border-[#D9E2DE] dark:border-zinc-800 hover:border-[#006B4F] dark:hover:border-emerald-500'}`}>
                  <div className="p-3 rounded-full bg-white dark:bg-zinc-800 text-[#006B4F] dark:text-zinc-400 mb-2 shadow-sm border border-[#D9E2DE]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-[#1F2937] dark:text-zinc-200">
                    {t('report_form.photo_instruction')}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {t('report_form.photo_sub')}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      handlePhotoUpload(e);
                      setPhotoError(false);
                    }}
                    className="hidden"
                  />
                </label>
              )}

              {/* Validation error message */}
              {photoError && (
                <p className="mt-1.5 text-xs text-[#E63946] font-semibold flex items-center gap-1">
                  <span>⚠</span>
                  <span>{t('report_form.photo_required', { defaultValue: 'Evidence photo is mandatory before submitting a report.' })}</span>
                </p>
              )}
            </div>

            {/* Submit Button - disabled if photo or description missing */}
            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || (!photoFile && !photoPreview)}
              title={!photoFile && !photoPreview ? t('report_form.photo_required', { defaultValue: 'Evidence photo is mandatory' }) : ''}
              className="w-full py-3 px-4 rounded-xl bg-[#006B4F] hover:bg-[#00523c] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('report_form.submitting')}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {isOnline ? t('report_form.submit') : t('report_form.submit_offline')}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* My Reports Tab */
        <div className="bg-white dark:bg-zinc-950 border border-[#D9E2DE] dark:border-zinc-800 rounded-xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#D9E2DE] dark:border-zinc-800">
            <div>
              <h3 className="font-bold text-base text-[#006B4F] dark:text-emerald-400">
                {t('report_form.my_reports')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {t('report_form.my_reports_subtitle')}
              </p>
            </div>
            <button
              onClick={loadReportsHistory}
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#006B4F]"
              aria-label={t('common.refresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {myReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {t('report_form.no_reports')}
              </div>
            ) : (
              myReports.map((report, idx) => (
                <div
                  key={report.client_report_id || report.report_id || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedReport(report)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedReport(report); } }}
                  className="group p-3.5 rounded-xl bg-[#F5F7F6]/80 dark:bg-zinc-900 border border-[#D9E2DE] dark:border-zinc-800 space-y-2 text-xs cursor-pointer select-none hover:shadow-lg hover:scale-[1.01] hover:border-[#006B4F]/40 active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#006B4F]/40 focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#1F2937] dark:text-zinc-200">
                      {report.report_id || report.client_report_id?.slice(0, 16)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        report.is_pending
                          ? 'bg-amber-50 text-amber-700 border border-amber-300'
                          : report.status === 'verified'
                          ? 'bg-[#EAF5F0] text-[#006B4F] border border-[#006B4F]/30'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {report.is_pending ? t('report_form.pending_sync_label') : report.status}
                    </span>
                  </div>

                  <p className="text-[#1F2937] dark:text-zinc-300">
                    {report.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                    <span>{t('report_form.gps_label')}: {report.lat}, {report.lng}</span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(report.timestamp).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5 text-slate-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-semibold text-[10px]">
                        View Details
                        <ChevronRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ReportDetailModal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        report={selectedReport}
      />
    </div>
  );
}
