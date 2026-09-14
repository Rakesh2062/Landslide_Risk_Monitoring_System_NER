// Citizen Field Reports — submit hazard observations + view submission history
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { submitFieldReport, getFieldReports } from '../../api/client';
import { SYNC_CHANNEL, useOfflineSync } from '../../hooks/useOfflineSync';
import { savePendingReport } from '../../db/indexedDb';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, MapPin, Send, AlertCircle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Camera, X
} from 'lucide-react';

export default function CitizenReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnline, refreshPendingCount } = useOfflineSync();

  // Form state
  const [lat,  setLat]  = useState('');
  const [lng,  setLng]  = useState('');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  // Auto-refresh feed when offline reports are synced back from the queue
  useEffect(() => {
    let syncChannel;
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL);
      syncChannel.onmessage = (e) => {
        if (e.data?.type === 'SYNC_COMPLETE') {
          queryClient.invalidateQueries({ queryKey: ['citizen-reports'] });
        }
      };
    } catch (_) { /* not supported */ }
    return () => {
      try { syncChannel?.close(); } catch (_) { }
    };
  }, [queryClient]);

  const locateMe = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); },
      ()  => setError('Could not obtain location. Enter manually.'),
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Photo must be less than 10MB');
        return;
      }
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!lat || !lng) { setError('Location coordinates are required.'); return; }
    setSubmitting(true);

    const clientReportId = `CR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();

    // ── OFFLINE: save to IndexedDB, do not hit the API ──────────────────
    if (!isOnline) {
      try {
        await savePendingReport({
          client_report_id: clientReportId,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          description: desc,
          reporter_type: 'citizen',
          severity: 'medium',
          language: 'en',
          timestamp,
          photo_file: photo,
          photo_name: photo?.name || 'offline-evidence.jpg',
          photo_data: photoPreview,
        });
        await refreshPendingCount();
        setSuccess('offline');
        setLat(''); setLng(''); setDesc(''); clearPhoto();
        setTimeout(() => setSuccess(false), 7000);
      } catch (saveErr) {
        setError('Could not save report offline. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── ONLINE: submit directly to server ────────────────────────────────
    try {
      const formData = new FormData();
      formData.append('lat', parseFloat(lat));
      formData.append('lng', parseFloat(lng));
      if (desc) formData.append('description', desc);
      formData.append('reporter_type', 'citizen');
      formData.append('client_report_id', clientReportId);
      formData.append('timestamp', timestamp);
      if (photo) formData.append('photo', photo);

      await submitFieldReport(formData);
      setSuccess('online');
      setLat(''); setLng(''); setDesc(''); clearPhoto();
      queryClient.invalidateQueries({ queryKey: ['citizen-reports'] });
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      // Server error — queue offline as safety net
      try {
        await savePendingReport({
          client_report_id: clientReportId,
          lat: parseFloat(lat), lng: parseFloat(lng),
          description: desc, reporter_type: 'citizen',
          severity: 'medium', language: 'en', timestamp,
          photo_file: photo, photo_name: photo?.name, photo_data: photoPreview,
        });
        await refreshPendingCount();
        setSuccess('offline');
        setLat(''); setLng(''); setDesc(''); clearPhoto();
      } catch {
        setError(err.message || 'Submission failed. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Load recent reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['citizen-reports'],
    queryFn:  () => getFieldReports(),
    staleTime: 1000 * 30,
  });

  const STATUS_STYLE = {
    received:  'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    verified:  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    dismissed: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <FileText className="w-5 h-5 text-[#006B4F]" />
          <h1 className="text-base font-black text-slate-900 dark:text-white">Field Reports</h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Report a landslide hazard or ground movement. Your reports help the district operations centre respond faster.
        </p>
      </div>

      {/* Submit Form Card */}
      <div className="bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl overflow-hidden shadow-xs">
        <button
          onClick={() => setFormOpen(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#F8FAF9] dark:bg-[#121215] text-left cursor-pointer hover:bg-[#EAF5F0]/60 dark:hover:bg-emerald-950/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#006B4F]" />
            <span className="text-xs font-black text-slate-800 dark:text-zinc-100">Submit New Observation</span>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {formOpen && (
          <div className="p-5">
            {/* Offline saved banner */}
            {success === 'offline' && (
              <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Saved Offline</strong> — No connection detected. Your report is saved on this device and will be automatically sent when you are back online.</span>
              </div>
            )}
            {/* Success banner */}
            {success === 'online' && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">Report submitted! The operations centre will review it shortly.</span>
              </div>
            )}
            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-[#E63946]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Coordinates */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                  Location Coordinates <span className="text-[#E63946]">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number" step="any" value={lat} onChange={e => setLat(e.target.value)}
                    placeholder="Latitude"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F] transition-all"
                  />
                  <input
                    type="number" step="any" value={lng} onChange={e => setLng(e.target.value)}
                    placeholder="Longitude"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F] transition-all"
                  />
                </div>
                <button type="button" onClick={locateMe}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-[#006B4F] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <MapPin className="w-3 h-3" /> Use my current location
                </button>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">Observation Details</label>
                <textarea
                  rows={4} value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Describe what you observed: slope cracks, soil movement, blocked roads, fallen trees, unusual water flow..."
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#006B4F] focus:ring-1 focus:ring-[#006B4F] resize-none transition-all"
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">Attach Photo (Optional)</label>
                
                {!photoPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-[#D9E2DE] dark:border-[#27272A] rounded-lg bg-[#F5F7F6] dark:bg-[#141418] hover:bg-slate-50 dark:hover:bg-[#1A1A1E] transition-colors cursor-pointer"
                  >
                    <Camera className="w-6 h-6 text-slate-400" />
                    <span className="text-slate-500 font-medium">Click to upload an image</span>
                  </button>
                ) : (
                  <div className="relative inline-block">
                    <img src={photoPreview} alt="Preview" className="h-32 rounded-lg border border-[#D9E2DE] dark:border-[#27272A] object-cover" />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute -top-2 -right-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white rounded-full p-1 shadow-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Submitting...' : 'Submit Observation Report'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Reports History */}
      <div className="bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3.5 border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#F8FAF9] dark:bg-[#121215]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#006B4F]" />
            <h2 className="text-xs font-black text-slate-800 dark:text-zinc-100">Your Recent Reports</h2>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Track the status of your submitted observations</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#006B4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
            <p className="text-xs text-slate-500">No reports yet. Be the first to report a hazard!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D9E2DE]/60 dark:divide-[#27272A]/60">
            {reports.slice(0, 15).map(report => (
              <div 
                key={report.report_id} 
                className="p-4 hover:bg-[#F8FAF9] dark:hover:bg-[#121215] transition-colors cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-slate-400">{report.report_id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_STYLE[report.status] || STATUS_STYLE.received}`}>
                        {report.status === 'received' ? 'Pending Verification' : report.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed line-clamp-2">
                      {report.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {report.lat?.toFixed(4)}, {report.lng?.toFixed(4)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(report.timestamp || report.submitted_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {report.photo_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#D9E2DE] dark:border-[#27272A] shrink-0">
                      <img src={`${import.meta.env.VITE_API_URL || ''}${report.photo_url}`} alt="Report photo" className="w-full h-full object-cover" onError={(e) => { e.target.src = report.photo_url; }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121215] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#D9E2DE] dark:border-[#27272A] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#F8FAF9] dark:bg-[#0D0E10]">
              <h3 className="font-bold text-slate-900 dark:text-white">Report Details</h3>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-xs text-slate-400">{selectedReport.report_id}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[selectedReport.status] || STATUS_STYLE.received}`}>
                  {selectedReport.status === 'received' ? 'Pending Verification' : selectedReport.status}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-1">Description</h4>
                  <p className="text-sm text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {selectedReport.description || 'No description provided.'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 mb-1">Location</h4>
                    <div className="flex items-center gap-1.5 text-sm text-slate-800 dark:text-zinc-200">
                      <MapPin className="w-4 h-4 text-[#006B4F]" />
                      <span>{selectedReport.lat?.toFixed(6)}, {selectedReport.lng?.toFixed(6)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 mb-1">Date Submitted</h4>
                    <div className="flex items-center gap-1.5 text-sm text-slate-800 dark:text-zinc-200">
                      <Clock className="w-4 h-4 text-[#006B4F]" />
                      <span>{new Date(selectedReport.timestamp || selectedReport.submitted_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {selectedReport.photo_url && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 mb-2">Attached Photo</h4>
                    <div className="rounded-lg overflow-hidden border border-[#D9E2DE] dark:border-[#27272A]">
                      <img 
                        src={`${import.meta.env.VITE_API_URL || ''}${selectedReport.photo_url}`} 
                        alt="Report photo" 
                        className="w-full h-auto"
                        onError={(e) => { e.target.src = selectedReport.photo_url; }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-[#D9E2DE] dark:border-[#27272A] bg-[#F8FAF9] dark:bg-[#0D0E10] flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

