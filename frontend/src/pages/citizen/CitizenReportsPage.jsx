// Citizen Field Reports — submit hazard observations + view submission history
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { submitFieldReport, getFieldReports } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, MapPin, Send, AlertCircle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Camera,
} from 'lucide-react';
import EmergencyAlertBanner from '../../components/EmergencyAlertBanner';

export default function CitizenReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [lat,  setLat]  = useState('');
  const [lng,  setLng]  = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);
  const [formOpen, setFormOpen] = useState(true);

  const locateMe = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); },
      ()  => setError('Could not obtain location. Enter manually.'),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!lat || !lng) { setError('Location coordinates are required.'); return; }
    setSubmitting(true);
    try {
      await submitFieldReport({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        description: desc,
        reporter_type: 'citizen',
      });
      setSuccess(true);
      setLat(''); setLng(''); setDesc('');
      queryClient.invalidateQueries({ queryKey: ['citizen_reports'] });
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message || 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Load recent reports (citizen can see their own in mock mode)
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['citizen_reports'],
    queryFn:  () => getFieldReports({ reporter_type: 'citizen' }),
    staleTime: 1000 * 60,
  });

  const STATUS_STYLE = {
    received:  'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    verified:  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    dismissed: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
  };

  return (
    <div className="space-y-5">
      <EmergencyAlertBanner />
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
            {/* Success banner */}
            {success && (
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
            <h2 className="text-xs font-black text-slate-800 dark:text-zinc-100">Recent Community Reports</h2>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Citizen-submitted observations from your district</p>
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
              <div key={report.report_id} className="p-4 hover:bg-[#F8FAF9] dark:hover:bg-[#121215] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-slate-400">{report.report_id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_STYLE[report.status] || STATUS_STYLE.received}`}>
                        {report.status}
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
                      <img src={report.photo_url} alt="Report photo" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
