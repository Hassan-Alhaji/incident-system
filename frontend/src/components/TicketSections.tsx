import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { resolveAttachmentUrl } from '../utils/resolveAttachmentUrl';
import { Plus, Upload, Trash2, FileImage, Loader2, Check, AlertTriangle, Sparkles, X } from 'lucide-react';

/** Fetches a protected image with Bearer token and renders via blob URL */
const AuthImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => { if (!r.ok) throw new Error('load failed'); return r.blob(); })
      .then(b => { if (alive) setBlobUrl(URL.createObjectURL(b)); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [src]);
  if (failed) return <FileImage size={22} className="text-teal-400 m-auto" />;
  if (!blobUrl) return <div className="w-full h-full bg-teal-100 animate-pulse" />;
  return <img src={blobUrl} alt={alt} className={className} />;
};


export const MagicWandButton = ({ text, context, type, onEnhanced }: { text: string; context: string; type: string; onEnhanced: (newText: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const handleEnhance = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/enhance-text', { text, context, type });
      onEnhanced(res.data.enhancedText);
    } catch (err: any) {
      const data = err.response?.data;
      const status = err.response?.status;
      if (status === 503 || data?.unavailable) {
        // Quota exceeded — hide button gracefully
        setUnavailable(true);
        setError(data?.message?.split('/')[1]?.trim() || 'AI unavailable (quota exceeded)');
        setTimeout(() => { setError(null); }, 5000);
      } else {
        setError(data?.message || 'AI enhancement failed');
        setTimeout(() => setError(null), 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Hide entirely if quota is confirmed exceeded
  if (unavailable) return null;

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleEnhance}
        disabled={loading || !text.trim()}
        title="Enhance text using AI ✨"
        className="p-1 text-purple-500 hover:bg-purple-100 rounded disabled:opacity-50 transition-all"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
      </button>
      {error && (
        <div className="absolute bottom-full right-0 mb-1 z-50 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-lg px-2 py-1 whitespace-nowrap shadow-md max-w-[220px] leading-relaxed">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};


interface ActionPlan {
  id: string;
  type: string;
  description: string;
  status: string;
  targetDate?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  attachments: any[];
  department?: { name: string; nameAr?: string };
}

const PLAN_DEFS = [
  { type: 'IMMEDIATE', labelAr: 'فوري', labelEn: 'Immediate', required: true, headerCls: 'bg-red-50 border-red-200', badgeCls: 'bg-red-100 text-red-700', saveCls: 'bg-red-600 hover:bg-red-700' },
  { type: 'SHORT_TERM', labelAr: 'قصير المدى', labelEn: 'Short-Term', required: true, headerCls: 'bg-amber-50 border-amber-200', badgeCls: 'bg-amber-100 text-amber-700', saveCls: 'bg-amber-600 hover:bg-amber-700' },
  { type: 'LONG_TERM', labelAr: 'بعيد المدى', labelEn: 'Long-Term', required: false, headerCls: 'bg-blue-50 border-blue-200', badgeCls: 'bg-blue-100 text-blue-700', saveCls: 'bg-blue-600 hover:bg-blue-700' },
];

export const ActionPlanSection = ({ ticket, onRefresh }: { ticket: any; onRefresh: () => void }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const plans: ActionPlan[] = ticket.actionPlans || [];

  const role = user?.role || '';
  const isDepRep = ['DEP_REP', 'DEP_MANAGER'].includes(role);
  const isReviewer = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role);
  const canEdit = isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status);

  const [forms, setForms] = useState<Record<string, { desc: string; date: string }>>(() => {
    const init: Record<string, { desc: string; date: string }> = {};
    for (const pd of PLAN_DEFS) {
      const ex = plans.find(p => p.type === pd.type);
      init[pd.type] = { desc: ex?.description || '', date: ex?.targetDate?.slice(0, 10) || '' };
    }
    return init;
  });

  const [saving,      setSaving]      = useState<string | null>(null);
  const [uploading,   setUploading]   = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote,  setReviewNote]  = useState('');
  const [toast,       setToast]       = useState<string | null>(null);
  const [editingDecision, setEditingDecision] = useState<string | null>(null); // planId being re-reviewed
  // pending local files per plan type — shown as preview before save
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getPlan = (type: string) => plans.find(p => p.type === type);

  // Upload helper (used internally after save)
  const doUpload = async (planId: string, files: File[]) => {
    if (!files.length) return;
    setUploading(planId);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      await api.post(`/action-plans/${planId}/attachments`, fd);
    } catch (err: any) {
      showToast(err.response?.data?.message || (isRtl ? '❌ فشل رفع الملف' : '❌ File upload failed'));
    } finally {
      setUploading(null);
    }
  };

  // Save (or update) plan, then upload any pending files
  const handleSave = async (type: string) => {
    const { desc, date } = forms[type];
    if (!desc.trim()) { showToast(isRtl ? '⚠️ الرجاء كتابة وصف الخطة' : '⚠️ Please write the plan description'); return; }
    if (!date) { showToast(isRtl ? '⚠️ الرجاء تحديد التاريخ المستهدف' : '⚠️ Please set the target date'); return; }
    setSaving(type);
    try {
      const ex = getPlan(type);
      let planId: string;
      if (ex) {
        await api.put(`/action-plans/${ex.id}`, { description: desc.trim(), targetDate: date, status: 'SUBMITTED' });
        planId = ex.id;
      } else {
        const res = await api.post(`/tickets/${ticket.id}/action-plans`, { type, description: desc.trim(), targetDate: date });
        planId = res.data?.id;
      }
      // Upload pending files after plan is saved
      const pending = pendingFiles[type] || [];
      if (pending.length) {
        await doUpload(planId, pending);
        setPendingFiles(pf => ({ ...pf, [type]: [] }));
      }
      showToast(ex ? (isRtl ? '✅ تم تحديث الخطة بنجاح' : '✅ Plan updated') : (isRtl ? '✅ تم حفظ الخطة بنجاح' : '✅ Plan saved'));
      onRefresh();
    } catch (err: any) { showToast(err.response?.data?.message || 'Error'); }
    finally { setSaving(null); }
  };

  // Add files from existing saved plan immediately
  const handleUploadExisting = async (planId: string, files: FileList) => {
    await doUpload(planId, Array.from(files));
    onRefresh();
  };

  // Add to local pending preview
  const addPendingFiles = (type: string, files: FileList) => {
    setPendingFiles(pf => ({ ...pf, [type]: [...(pf[type] || []), ...Array.from(files)] }));
  };

  const removePendingFile = (type: string, idx: number) => {
    setPendingFiles(pf => ({ ...pf, [type]: (pf[type] || []).filter((_, i) => i !== idx) }));
  };

  const handleReview = async (planId: string, status: string) => {
    try {
      await api.put(`/action-plans/${planId}`, { status, reviewNotes: reviewNote });
      showToast(status === 'APPROVED'
        ? (isRtl ? '✅ تم اعتماد الخطة' : '✅ Plan approved')
        : (isRtl ? '❌ تم رفض الخطة' : '❌ Plan rejected'));
      setReviewingId(null); setReviewNote(''); setEditingDecision(null);
      onRefresh();
    } catch (err: any) { showToast(err.response?.data?.message || 'Error'); }
  };

  const deleteAttachment = async (attId: string) => {
    try {
      await api.delete(`/action-plan-attachments/${attId}`);
      showToast(isRtl ? '🗑️ تم حذف المرفق' : '🗑️ Attachment deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || (isRtl ? '❌ فشل الحذف' : '❌ Delete failed'));
    }
  };


  const savedCount = PLAN_DEFS.filter(pd => getPlan(pd.type)).length;
  const requiredOk = PLAN_DEFS.filter(pd => pd.required).every(pd => getPlan(pd.type));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Toast notification */}
      {toast && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          📋 {isRtl ? 'خطط العمل' : 'Action Plans'}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${requiredOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {savedCount} / {PLAN_DEFS.length}
          </span>
          {!requiredOk && canEdit && (
            <span className="text-[10px] text-amber-600 font-medium">{isRtl ? 'الفوري والقصير مطلوبان' : 'Immediate & Short-Term Required'}</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {PLAN_DEFS.map(pd => {
          const ex = getPlan(pd.type);
          const isSaved = !!ex;
          const approved = ex?.status === 'APPROVED';
          const rejected = ex?.status === 'REJECTED';
          const form = forms[pd.type];

          const borderCls = approved ? 'border-emerald-300' : rejected ? 'border-red-300' : isSaved ? 'border-blue-200' : 'border-gray-200';

          return (
            <div key={pd.type} className={`border rounded-xl overflow-hidden ${borderCls}`}>
              {/* Card header */}
              <div className={`px-3 py-2 flex items-center justify-between ${pd.headerCls}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black px-3 py-1 rounded-full ${pd.badgeCls}`}>
                    {isRtl ? pd.labelAr : pd.labelEn}
                  </span>
                  {pd.required && <span className="text-xs text-red-500 font-bold">{isRtl ? '* مطلوب' : '* Required'}</span>}
                </div>
                {isSaved && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${approved ? 'bg-emerald-100 text-emerald-700' :
                      rejected ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {approved ? (isRtl ? '✓ مُعتمدة' : '✓ Approved') : rejected ? (isRtl ? '✗ مرفوضة' : '✗ Rejected') : (isRtl ? '⏳ محفوظة' : '⏳ Saved')}
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-3 space-y-3 bg-white">
                {canEdit && !approved ? (
                  /* ── Editable form (DEP_REP) ── */
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700">{isRtl ? 'الوصف' : 'Description'} {pd.required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">{isRtl ? '(اختياري)' : '(Optional)'}</span>}</label>
                        <MagicWandButton
                          text={form.desc}
                          context={ticket.offCircuitReport?.whatHappened || ''}
                          type="ACTION_PLAN"
                          onEnhanced={v => setForms(f => ({ ...f, [pd.type]: { ...f[pd.type], desc: v } }))}
                        />
                      </div>
                      <textarea
                        value={form.desc}
                        onChange={e => setForms(f => ({ ...f, [pd.type]: { ...f[pd.type], desc: e.target.value } }))}
                        placeholder={isRtl ? `اكتب تفاصيل خطة العمل ${pd.labelAr}...` : `Write details for ${pd.labelEn} plan...`}
                        rows={7}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 min-h-[160px]"
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <label className="text-sm font-bold text-gray-700 whitespace-nowrap">{isRtl ? 'التاريخ المستهدف' : 'Target Date'} {pd.required ? <span className="text-red-500">*</span> : ''}:</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={form.date}
                        onChange={e => setForms(f => ({ ...f, [pd.type]: { ...f[pd.type], date: e.target.value } }))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>

                    {/* ── Attachment area: local preview + saved attachments ── */}
                    <div className="mt-4 mb-2 space-y-2">
                      {/* Label row */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700">
                          {isRtl ? '📎 المرفقات (اختياري)' : '📎 Attachments (Optional)'}
                        </span>
                        <label className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 hover:border-teal-400 text-teal-700 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-all shadow-sm">
                          {(uploading === ex?.id || saving === pd.type) ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          {isRtl ? 'اختر ملف' : 'Choose File'}
                          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.eml" className="hidden"
                            onChange={e => {
                              if (!e.target.files?.length) return;
                              if (isSaved) {
                                // already saved → add to pending so they upload on next save
                                addPendingFiles(pd.type, e.target.files);
                              } else {
                                addPendingFiles(pd.type, e.target.files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      {/* Saved attachments from server */}
                      {isSaved && ex!.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {ex!.attachments.map((att: any) => {
                            const resolvedUrl = resolveAttachmentUrl(att.url);
                            const isImg = att.mimeType?.startsWith('image/');
                            return (
                              <div key={att.id} className="group relative w-20 h-20 bg-teal-50 border border-teal-200 rounded-xl overflow-hidden hover:border-teal-400 transition-all shadow-sm flex items-center justify-center">
                                {/* Click to open */}
                                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0" />
                                {isImg
                                  ? <AuthImage src={resolvedUrl} alt={att.name} className="w-full h-full object-cover" />
                                  : <div className="flex flex-col items-center gap-1 p-2 pointer-events-none">
                                      <FileImage size={22} className="text-teal-500" />
                                      <span className="text-[9px] text-teal-700 font-bold text-center leading-tight line-clamp-2">{att.name}</span>
                                    </div>
                                }
                                {/* Delete button — DEP_REP only */}
                                {canEdit && (
                                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); if(confirm(isRtl ? 'حذف هذا المرفق؟' : 'Delete this attachment?')) deleteAttachment(att.id); }}
                                    className="absolute top-0.5 right-0.5 z-10 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                    <X size={10} strokeWidth={3} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Pending local previews (not yet uploaded) */}
                      {(pendingFiles[pd.type] || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(pendingFiles[pd.type] || []).map((file, idx) => {
                            const isImg = file.type.startsWith('image/');
                            const previewUrl = isImg ? URL.createObjectURL(file) : null;
                            return (
                              <div key={idx} className="relative w-20 h-20 bg-teal-50 border-2 border-dashed border-teal-300 rounded-xl overflow-hidden group">
                                {isImg && previewUrl
                                  ? <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                                  : <div className="flex flex-col items-center justify-center h-full gap-1 p-2">
                                      <FileImage size={22} className="text-teal-400" />
                                      <span className="text-[9px] text-teal-600 font-bold text-center leading-tight line-clamp-2">{file.name}</span>
                                    </div>
                                }
                                {/* pending badge */}
                                <div className="absolute top-0.5 left-0.5 bg-teal-500 text-white text-[8px] font-black px-1 rounded">
                                  {isRtl ? 'قيد الحفظ' : 'Pending'}
                                </div>
                                {/* remove button */}
                                <button onClick={() => removePendingFile(pd.type, idx)}
                                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black">
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Helper hint */}
                      {!(pendingFiles[pd.type]?.length) && !(isSaved && ex!.attachments?.length) && (
                        <p className="text-[10px] text-slate-400 italic">
                          {isRtl ? 'اختر ملفاً أو صورة — ستُرفع عند الحفظ' : 'Choose a file or image — it will upload when you save'}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSave(pd.type)}
                      disabled={saving === pd.type || !form.desc.trim() || !form.date}
                      className={`w-full text-white text-xs font-bold py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 ${pd.saveCls}`}
                    >
                      {saving === pd.type
                        ? <><Loader2 size={13} className="animate-spin" /> {isRtl ? 'جارٍ الحفظ...' : 'Saving...'}</>
                        : isSaved
                          ? <><Check size={13} /> {isRtl ? 'تحديث الخطة' : 'Update Plan'}{(pendingFiles[pd.type]?.length) ? ` (+${pendingFiles[pd.type].length} ${isRtl ? 'ملف' : 'file(s)'})` : ''}</>
                          : <><Plus size={13} /> {isRtl ? 'حفظ الخطة' : 'Save Plan'}{(pendingFiles[pd.type]?.length) ? ` (+${pendingFiles[pd.type].length} ${isRtl ? 'ملف' : 'file(s)'})` : ''}</>
                      }
                    </button>
                  </>
                ) : (
                  /* ── Read-only view (Controller / after approval) ── */
                  isSaved ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800 leading-relaxed">{ex!.description}</p>
                      {ex!.targetDate && (
                        <p className="text-xs font-semibold text-blue-600">
                          📅 {new Date(ex!.targetDate).toLocaleDateString('en-US')}
                        </p>
                      )}
                      {ex!.submittedBy && (
                        <p className="text-[10px] text-gray-400">{isRtl ? 'بواسطة:' : 'By:'} {ex!.submittedBy}</p>
                      )}

                      {/* Attachments — teal thumbnail grid */}
                      {ex!.attachments?.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[10px] font-bold text-teal-700 mb-2">
                            📎 {isRtl ? `مرفقات (${ex!.attachments.length})` : `Attachments (${ex!.attachments.length})`}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ex!.attachments.map((att: any) => {
                              const resolvedUrl = resolveAttachmentUrl(att.url);
                              const isImg = att.mimeType?.startsWith('image/');
                              return (
                                <div key={att.id} className="group relative w-20 h-20 bg-teal-50 border border-teal-200 rounded-xl overflow-hidden hover:border-teal-500 hover:shadow-md transition-all flex items-center justify-center">
                                  <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0" />
                                  {isImg
                                    ? <AuthImage src={resolvedUrl} alt={att.name} className="w-full h-full object-cover" />
                                    : <div className="flex flex-col items-center gap-1 p-2 pointer-events-none">
                                        <FileImage size={22} className="text-teal-500" />
                                        <span className="text-[9px] text-teal-700 font-bold text-center leading-tight line-clamp-2">{att.name}</span>
                                      </div>
                                  }
                                  {/* Delete — DEP_REP only */}
                                  {canEdit && (
                                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); if(confirm(isRtl ? 'حذف هذا المرفق؟' : 'Delete this attachment?')) deleteAttachment(att.id); }}
                                      className="absolute top-0.5 right-0.5 z-10 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                      <X size={10} strokeWidth={3} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* DEP_REP can add more attachments even in read-only */}
                      {canEdit && (
                        <label className="inline-flex items-center gap-1.5 text-xs text-teal-600 font-bold cursor-pointer hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition-all">
                          {uploading === ex!.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          {isRtl ? 'إضافة مرفق' : 'Add Attachment'}
                          <input type="file" multiple className="hidden"
                            onChange={e => e.target.files && handleUploadExisting(ex!.id, e.target.files)} />
                        </label>
                      )}

                      {/* Reviewer approve / reject — ONLY when department has submitted/resubmitted */}
                      {isReviewer && ex!.status === 'SUBMITTED' && (
                        <div className="pt-3 border-t border-gray-100 space-y-3">
                          {/* Reject reason */}
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">
                              {isRtl ? 'ملاحظات المراجعة' : 'Review Notes'} 
                              <span className="text-red-500 ml-1">*{isRtl ? ' مطلوبة عند الرفض' : ' Required for rejection'}</span>
                            </label>
                            <textarea
                              placeholder={isRtl ? "اكتب ملاحظاتك أو سبب الرفض هنا..." : "Write your notes or rejection reason here..."}
                              value={reviewingId === ex!.id ? reviewNote : ''}
                              onFocus={() => setReviewingId(ex!.id)}
                              onChange={e => { setReviewingId(ex!.id); setReviewNote(e.target.value); }}
                              rows={3}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleReview(ex!.id, 'APPROVED')}
                              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <Check size={15} /> {isRtl ? '✓ اعتماد الخطة' : '✓ Approve Plan'}
                            </button>
                            <button
                              onClick={() => {
                                if (!reviewNote.trim()) {
                                  showToast(isRtl ? '⚠️ يجب كتابة سبب الرفض أولاً' : '⚠️ Please write a rejection reason first');
                                  return;
                                }
                                handleReview(ex!.id, 'REJECTED');
                              }}
                              className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <Trash2 size={15} /> {isRtl ? '✗ رفض الخطة' : '✗ Reject Plan'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Rejection note display + Edit Decision for reviewer */}
                      {ex!.reviewNotes && (
                        <div className={`rounded-lg p-2.5 text-xs mt-1 ${approved ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <strong>{isRtl ? 'ملاحظة المراجع: ' : 'Reviewer Note: '}</strong>{ex!.reviewNotes}
                            </div>
                            {/* Edit Decision — only for reviewer on REJECTED plans */}
                            {isReviewer && rejected && editingDecision !== ex!.id && (
                              <button
                                onClick={() => { setEditingDecision(ex!.id); setReviewingId(ex!.id); setReviewNote(ex!.reviewNotes || ''); }}
                                className="shrink-0 text-[10px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                              >
                                ✏️ {isRtl ? 'تعديل القرار' : 'Edit Decision'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Edit Decision form — appears when reviewer clicks Edit */}
                      {isReviewer && rejected && editingDecision === ex!.id && (
                        <div className="pt-3 border border-orange-200 bg-orange-50 rounded-xl p-3 space-y-3">
                          <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5">
                            ✏️ {isRtl ? 'تعديل قرار المراجعة' : 'Editing Review Decision'}
                          </p>
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">
                              {isRtl ? 'ملاحظات المراجعة' : 'Review Notes'}
                              <span className="text-red-500 ml-1">*{isRtl ? ' مطلوبة عند الرفض' : ' Required for rejection'}</span>
                            </label>
                            <textarea
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              rows={3}
                              className="w-full text-sm border border-orange-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleReview(ex!.id, 'APPROVED')}
                              className="col-span-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg transition-all"
                            >
                              <Check size={13} /> {isRtl ? 'اعتماد' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                if (!reviewNote.trim()) { showToast(isRtl ? '⚠️ أدخل ملاحظة أولاً' : '⚠️ Enter a note first'); return; }
                                handleReview(ex!.id, 'REJECTED');
                              }}
                              className="col-span-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-all"
                            >
                              <Trash2 size={13} /> {isRtl ? 'رفض' : 'Reject'}
                            </button>
                            <button
                              onClick={() => { setEditingDecision(null); setReviewingId(null); setReviewNote(''); }}
                              className="col-span-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg transition-all"
                            >
                              {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-3">{isRtl ? 'لم تُضف بعد' : 'Not added yet'}</p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const RCASection = ({ ticket, onRefresh }: { ticket: any; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const oc = ticket.offCircuitReport;
  const [loading, setLoading] = useState(false);
  const [cause, setCause] = useState(oc?.rcaCause || '');
  const [why, setWhy] = useState(oc?.rcaWhy || '');
  const [preventable, setPreventable] = useState(oc?.rcaPreventable || false);
  const [rootCause, setRootCause] = useState(oc?.rcaRootCause || '');
  const [category, setCategory] = useState(oc?.rcaCategory || '');

  const { user } = useAuth();
  const isControllerRole = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(user?.role || '');
  const canEdit = isControllerRole && ticket.status === 'UNDER_INVESTIGATION';
  const isCompleted = oc?.rcaCompleted;

  const countWords = (str: string) => str.trim().split(/\s+/).filter(w => w.length > 0).length;

  const handleSubmit = async () => {
    if (!cause || !why || !rootCause || !category) return alert(t('rca.allRequired', 'All RCA fields required'));

    if (countWords(cause) < 20 || countWords(why) < 20 || countWords(rootCause) < 20) {
      return alert(t('rca.minWords', 'Each text field must contain at least 20 words to describe the issue accurately.'));
    }

    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}/rca`, { rcaCause: cause, rcaWhy: why, rcaPreventable: preventable, rcaRootCause: rootCause, rcaCategory: category });
      onRefresh();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  if (!oc?.rcaRequired) return null;
  // Hide RCA section from non-controllers if it is not completed yet
  if (!isControllerRole && !isCompleted) return null;



  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className={`px-4 py-3 border-b ${isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
        <h3 className="text-sm font-bold flex items-center gap-2">
          {isCompleted ? <><Check size={14} className="text-emerald-500" /> {t('rca.title', 'Root Cause Analysis')} ✓</> : <><AlertTriangle size={14} className="text-amber-500" /> {t('rca.title', 'Root Cause Analysis')} ({t('rca.required', 'Required')})</>}
        </h3>
      </div>

      {/* Pending — waiting for controller to click Proceed to RCA */}
      {!isCompleted && isControllerRole && ticket.status === 'UNDER_REVIEW' && (
        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">📋</div>
          <p className="text-sm font-bold text-slate-700">
            {t('rca.pendingTitle', 'RCA Not Started Yet')}
          </p>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            {t('rca.pendingHint', 'Review the department\'s action plans first, then click "Proceed to RCA" in the Actions section below to begin the Root Cause Analysis.')}
          </p>
        </div>
      )}

      {/* Full form — only in UNDER_INVESTIGATION or when completed */}
      {(canEdit || isCompleted) && (
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold text-gray-700">{t('rca.cause', 'What caused it?')} <span className="text-red-500">*</span></label>
            {canEdit && <MagicWandButton text={cause} context={oc?.whatHappened || ''} type="RCA_DRAFT" onEnhanced={setCause} />}
          </div>
          <textarea value={cause} onChange={e => setCause(e.target.value)} disabled={!canEdit} rows={10} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-3 resize-y disabled:bg-gray-50 min-h-[240px]" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold text-gray-700">{t('rca.why', 'Why did it happen? (5 Whys)')} <span className="text-red-500">*</span></label>
            {canEdit && <MagicWandButton text={why} context={oc?.whatHappened || ''} type="RCA_DRAFT" onEnhanced={setWhy} />}
          </div>
          <textarea value={why} onChange={e => setWhy(e.target.value)} disabled={!canEdit} rows={10} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-3 resize-y disabled:bg-gray-50 min-h-[240px]" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold text-gray-700">{t('rca.rootCause', 'Root Cause')} <span className="text-red-500">*</span></label>
            {canEdit && <MagicWandButton text={rootCause} context={oc?.whatHappened || ''} type="RCA_DRAFT" onEnhanced={setRootCause} />}
          </div>
          <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} disabled={!canEdit} rows={10} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-3 resize-y disabled:bg-gray-50 min-h-[240px]" />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700 mb-3 block">{t('rca.category', 'Root Cause Category')} <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'Biological Hazards', labelAr: 'مخاطر بيولوجية', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <circle cx="32" cy="32" r="8" fill="#1a1a1a"/>
                  <path d="M32 24 C32 16 20 10 14 18 C8 26 16 34 24 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                  <path d="M32 24 C38 16 50 18 48 28 C46 38 36 36 32 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                  <path d="M26 34 C18 38 16 50 26 50 C36 50 36 40 32 38" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                </svg>
              )},
              { value: 'Chemical Hazards', labelAr: 'مخاطر كيميائية', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <circle cx="32" cy="32" r="6" fill="#1a1a1a"/>
                  <circle cx="20" cy="20" r="4" fill="#1a1a1a"/>
                  <circle cx="44" cy="20" r="4" fill="#1a1a1a"/>
                  <line x1="15" y1="50" x2="27" y2="30" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <line x1="37" y1="30" x2="49" y2="50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <line x1="10" y1="54" x2="54" y2="54" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <line x1="10" y1="46" x2="22" y2="46" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <line x1="42" y1="46" x2="54" y2="46" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              )},
              { value: 'Physical Hazards', labelAr: 'مخاطر فيزيائية', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <circle cx="32" cy="32" r="6" fill="#1a1a1a"/>
                  <path d="M32 8 L32 18 M32 46 L32 56 M8 32 L18 32 M46 32 L56 32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
                  <path d="M32 26 A6 6 0 1 1 32 38 A6 6 0 1 1 32 26" fill="#1a1a1a"/>
                  <path d="M32 14 A18 18 0 0 1 50 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/>
                  <path d="M32 50 A18 18 0 0 1 14 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/>
                </svg>
              )},
              { value: 'Safety Hazards', labelAr: 'مخاطر السلامة', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <circle cx="40" cy="14" r="5" fill="#1a1a1a"/>
                  <path d="M40 20 L38 30 L30 26 L20 40" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M30 26 L26 42 L36 48" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M14 44 L22 44" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              )},
              { value: 'Ergonomic Hazards', labelAr: 'مخاطر هندسة بشرية', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <circle cx="36" cy="13" r="5" fill="#1a1a1a"/>
                  <path d="M36 18 L34 28 L44 32 L42 22" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="#1a1a1a" fillOpacity="0.3"/>
                  <path d="M34 28 L32 42 L26 52" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <path d="M32 42 L40 50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <path d="M20 36 L34 28" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                  <rect x="14" y="32" width="12" height="8" rx="2" fill="#1a1a1a"/>
                </svg>
              )},
              { value: 'Psychosocial Hazards', labelAr: 'مخاطر نفسية-اجتماعية', icon: (
                <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                  <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                  <ellipse cx="32" cy="30" rx="16" ry="18" fill="#1a1a1a"/>
                  <path d="M20 22 C20 14 44 14 44 22" fill="#1a1a1a"/>
                  <path d="M18 30 C16 26 16 34 18 34" stroke="#FFC107" strokeWidth="2"/>
                  <path d="M46 30 C48 26 48 34 46 34" stroke="#FFC107" strokeWidth="2"/>
                  <path d="M24 26 C24 22 28 20 32 22 C36 20 40 22 40 26" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                  <path d="M26 32 C26 30 28 28 30 30" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                  <path d="M34 30 C36 28 38 30 38 32" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                </svg>
              )},
            ].map(cat => {
              const isSelected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && setCategory(cat.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center
                    ${isSelected
                      ? 'border-amber-500 bg-amber-50 shadow-md scale-105'
                      : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'}
                    ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
                >
                  {cat.icon}
                  <span className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>
                    {cat.value}
                  </span>
                  {isSelected && <span className="text-[9px] text-amber-500">✓ Selected</span>}
                </button>
              );
            })}
          </div>
          {!category && <p className="text-[10px] text-red-400 mt-1">* Please select a hazard category</p>}
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="preventable" checked={preventable} onChange={e => setPreventable(e.target.checked)} disabled={!canEdit} className="rounded" />
          <label htmlFor="preventable" className="text-sm text-gray-700">{t('rca.preventable', 'Was this preventable?')}</label>
        </div>
        {oc?.rcaFilledBy && <p className="text-[10px] text-gray-400">Completed by: {oc.rcaFilledBy} ({new Date(oc.rcaFilledAt).toLocaleString()})</p>}
        {canEdit && (
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-amber-500 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('rca.submit', 'Submit RCA')}
          </button>
        )}
      </div>
      )}
    </div>
  );
};

export const ReminderSection = ({ ticket, onRefresh }: { ticket: any; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [completedNote, setCompletedNote] = useState('');
  const reminders = ticket.reminders || [];

  const handleComplete = async (reminderId: string) => {
    setLoading(true);
    try {
      await api.put(`/reminders/${reminderId}/complete`, { completedNote });
      setCompletedNote('');
      onRefresh();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  if (reminders.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">🔔 {t('rem.title', 'Reminders')} ({reminders.length})</h3>
      </div>
      <div className="p-4 space-y-2">
        {reminders.map((rem: any) => (
          <div key={rem.id} className={`border rounded-lg p-3 ${rem.isCompleted ? 'border-gray-100 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">{rem.message}</p>
              {rem.isCompleted && <Check size={14} className="text-emerald-500" />}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">📅 {new Date(rem.reminderDate).toLocaleDateString()}</p>
            {rem.completedNote && <p className="text-xs text-gray-500 mt-1">✅ {rem.completedNote}</p>}
            {!rem.isCompleted && (
              <div className="flex gap-2 mt-2">
                <input placeholder={t('rem.completedNote', 'Completion note...')} value={completedNote} onChange={e => setCompletedNote(e.target.value)} className="flex-1 text-xs border border-gray-200 rounded px-2 py-1" />
                <button onClick={() => handleComplete(rem.id)} disabled={loading} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded">{loading ? '...' : t('rem.complete', 'Complete')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
