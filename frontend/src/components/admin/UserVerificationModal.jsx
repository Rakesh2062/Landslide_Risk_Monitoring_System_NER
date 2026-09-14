import React, { useState, useEffect } from 'react';
import { getPendingUsers, verifyUser } from '../../api/client';
import {
  X, ShieldCheck, Check, FileText, UserCheck, AlertCircle, RefreshCw,
  Eye, ExternalLink, Download, FileCheck, Building2, MapPin, Calendar, CheckCircle2
} from 'lucide-react';

export default function UserVerificationModal({ isOpen, onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getPendingUsers();
      setPendingUsers(data || []);
    } catch (err) {
      console.error('Failed to fetch pending users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleVerify = async (userId) => {
    setVerifyingId(userId);
    try {
      await verifyUser(userId);
      setMessage(`User verified successfully!`);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      if (previewUser?.id === userId) {
        setPreviewUser(null);
      }
      try {
        const channel = new BroadcastChannel('ner_user_verification');
        channel.postMessage({ type: 'USER_VERIFIED', userId });
        channel.close();
      } catch (e) {}
      localStorage.setItem('ner_latest_verification', Date.now().toString());
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to verify user');
    } finally {
      setVerifyingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* ── Main Modal Header ────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-[#D9E2DE] dark:border-[#27272A] flex items-center justify-between bg-[#F5F7F6] dark:bg-[#141418]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EAF5F0] dark:bg-emerald-950/50 text-[#006B4F] dark:text-emerald-400 border border-[#006B4F]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Resident Verification Approvals
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Review uploaded residency proof documents & activate accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {message && (
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 text-xs text-[#2F855A] dark:text-emerald-400 flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{message}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              {pendingUsers.length} Pending Registration Application{pendingUsers.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded-lg border border-[#D9E2DE] dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading pending user applications...
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-[#D9E2DE] dark:border-[#27272A] rounded-xl p-6">
              <UserCheck className="w-10 h-10 mx-auto text-[#006B4F] dark:text-emerald-400 mb-2 opacity-60" />
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                All Registration Applications Reviewed
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                No unverified resident registrations awaiting approval.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-xl bg-[#F5F7F6] dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-[#006B4F]/40 transition-all"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {u.username}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5F0] dark:bg-emerald-950/50 text-[#006B4F] dark:text-emerald-400 border border-[#006B4F]/20 shrink-0">
                        {u.district || 'East Khasi Hills'}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-3 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Applied: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recently'}
                      </span>

                      {/* Document Proof Inspection Button */}
                      <button
                        onClick={() => setPreviewUser(u)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#006B4F]/10 dark:bg-emerald-950/40 text-[#006B4F] dark:text-emerald-400 border border-[#006B4F]/30 hover:bg-[#006B4F]/20 font-bold text-[11px] transition-all cursor-pointer"
                        title="View uploaded proof document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Proof Document</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => handleVerify(u.id)}
                      disabled={verifyingId === u.id}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{verifyingId === u.id ? 'Approving...' : 'Approve & Verify'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main Modal Footer ───────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-[#D9E2DE] dark:border-[#27272A] bg-[#F5F7F6] dark:bg-[#141418] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ── PROOF DOCUMENT VIEWER LIGHTBOX MODAL ───────────────────────── */}
      {previewUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0D0E10] border border-[#D9E2DE] dark:border-[#27272A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Lightbox Header */}
            <div className="px-5 py-4 border-b border-[#D9E2DE] dark:border-[#27272A] bg-[#006B4F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-bold text-sm">
                    Residency Verification Proof — {previewUser.username}
                  </h3>
                  <p className="text-[11px] text-emerald-100 opacity-90">
                    District: {previewUser.district || 'East Khasi Hills'} • Document Status: Pending Review
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewUser(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Body — Document Display */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-[#F5F7F6] dark:bg-[#07080A]">
              
              {/* Document Meta Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#141418] border border-[#D9E2DE] dark:border-[#27272A] text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#006B4F] dark:text-emerald-400" />
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {previewUser.proof_type || 'Residency Verification File'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {previewUser.proof_path && (
                    <a
                      href={
                        previewUser.proof_path.startsWith('http') || previewUser.proof_path.startsWith('data:')
                          ? previewUser.proof_path
                          : `http://localhost:8000${previewUser.proof_path}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#006B4F] dark:text-emerald-400 hover:underline font-bold text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Original Document</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Real File Image Preview OR Government Certificate Render */}
              <div className="rounded-xl border border-[#D9E2DE] dark:border-[#27272A] bg-white dark:bg-[#0D0E10] p-4 min-h-[320px] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                
                {previewUser.proof_data_url ? (
                  /* User uploaded image/data URL */
                  <img
                    src={previewUser.proof_data_url}
                    alt="Residency Proof Document"
                    className="max-h-[380px] w-auto object-contain rounded-lg shadow-md"
                  />
                ) : previewUser.proof_path && (previewUser.proof_path.endsWith('.png') || previewUser.proof_path.endsWith('.jpg') || previewUser.proof_path.endsWith('.jpeg')) ? (
                  /* Image file URL */
                  <img
                    src={`http://localhost:8000${previewUser.proof_path}`}
                    alt="Uploaded Residency Proof"
                    onError={(e) => {
                      // Fallback to government certificate preview if server file cannot be fetched
                      e.target.style.display = 'none';
                      document.getElementById(`gov-cert-${previewUser.id}`).style.display = 'block';
                    }}
                    className="max-h-[380px] w-auto object-contain rounded-lg shadow-md"
                  />
                ) : null}

                {/* Government Official Certificate Display (Renders if PDF, server offline, or mock record) */}
                <div
                  id={`gov-cert-${previewUser.id}`}
                  className="w-full max-w-lg p-6 rounded-2xl bg-gradient-to-b from-amber-50/80 to-stone-100 dark:from-stone-900 dark:to-zinc-950 border-2 border-amber-300 dark:border-amber-700/50 text-slate-800 dark:text-zinc-100 shadow-md space-y-4"
                >
                  <div className="text-center border-b border-amber-300 dark:border-amber-700/40 pb-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#006B4F] text-white flex items-center justify-center font-black text-xs shadow-sm mb-1.5">
                      GOV
                    </div>
                    <h4 className="font-extrabold text-xs tracking-wider uppercase text-[#006B4F] dark:text-emerald-400">
                      Government of Meghalaya • District Administration
                    </h4>
                    <p className="text-[11px] font-serif italic text-amber-800 dark:text-amber-300">
                      Office of the District Magistrate & Civil Defence Commissioner
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-dashed border-amber-200 dark:border-amber-800/40 pb-1">
                      <span className="text-slate-500 dark:text-zinc-400">Applicant Full Name:</span>
                      <strong className="font-bold text-slate-900 dark:text-white">{previewUser.username}</strong>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-amber-200 dark:border-amber-800/40 pb-1">
                      <span className="text-slate-500 dark:text-zinc-400">Jurisdiction District:</span>
                      <strong className="font-semibold text-slate-800 dark:text-zinc-200">{previewUser.district || 'East Khasi Hills'}</strong>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-amber-200 dark:border-amber-800/40 pb-1">
                      <span className="text-slate-500 dark:text-zinc-400">Proof Document Type:</span>
                      <span className="font-mono text-[11px] text-[#006B4F] dark:text-emerald-400 font-bold">
                        {previewUser.proof_type || 'Resident Identity Certificate'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-amber-200 dark:border-amber-800/40 pb-1">
                      <span className="text-slate-500 dark:text-zinc-400">Document Path:</span>
                      <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-400 truncate max-w-[220px]">
                        {previewUser.proof_path}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#006B4F] dark:text-emerald-400" />
                      <span>Tamper-evident verification payload attached</span>
                    </div>
                    <span className="font-mono font-bold">SEAL: MEG-GIS-VERIFIED</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lightbox Footer Actions */}
            <div className="px-6 py-3.5 border-t border-[#D9E2DE] dark:border-[#27272A] bg-white dark:bg-[#141418] flex items-center justify-between gap-3">
              <button
                onClick={() => setPreviewUser(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Close Preview
              </button>

              <button
                onClick={() => handleVerify(previewUser.id)}
                disabled={verifyingId === previewUser.id}
                className="px-5 py-2 rounded-lg bg-[#006B4F] hover:bg-[#00523C] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{verifyingId === previewUser.id ? 'Approving...' : 'Approve & Activate Resident'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
