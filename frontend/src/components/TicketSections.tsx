import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from './Toast';
import { resolveAttachmentUrl } from '../utils/resolveAttachmentUrl';
import { Plus, Upload, Trash2, FileImage, Loader2, Check, AlertTriangle, Sparkles, X, CornerUpRight, RotateCcw } from 'lucide-react';

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const handleEnhance = async () => {
    if (!text.trim() || unavailable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/enhance-text', { text, context, type });
      onEnhanced(res.data.enhancedText);
    } catch (err: any) {
      const data = err.response?.data;
      const status = err.response?.status;
      if (status === 503 || data?.unavailable) {
        setUnavailable(true);
        setError(t('errors.aiUnavailable'));
        setTimeout(() => { setError(null); }, 6000);
      } else {
        setError(data?.message || t('errors.generic'));
        setTimeout(() => setError(null), 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleEnhance}
        disabled={loading || !text.trim() || unavailable}
        title={unavailable ? 'AI غير متاح مؤقتاً (تجاوز الحصة المجانية)' : 'Enhance text using AI ✨'}
        className={`p-1.5 rounded-lg transition-all ${
          unavailable 
            ? 'text-gray-300 cursor-not-allowed bg-gray-50' 
            : 'text-purple-500 hover:bg-purple-100 disabled:opacity-50'
        }`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
      </button>
      {error && (
        <div className="absolute bottom-full right-0 mb-1 z-50 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-lg px-2 py-1 whitespace-nowrap shadow-md max-w-[250px] leading-relaxed">
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
  { type: 'IMMEDIATE', labelAr: 'إجراء فوري', labelEn: 'Immediate Action', required: true, descAr: 'إجراءات سريعة لإيقاف الخطر فوراً (مثل: الإسعافات الأولية، عزل المنطقة).', descEn: 'Quick actions to stop the hazard immediately (e.g., first aid, barricading area).', headerCls: 'bg-red-50 border-red-200', badgeCls: 'bg-red-100 text-red-700', saveCls: 'bg-red-600 hover:bg-red-700' },
  { type: 'SHORT_TERM', labelAr: 'خطة قصيرة المدى', labelEn: 'Short-Term Plan', required: false, descAr: 'إجراءات مؤقتة لمعالجة المشكلة خلال الأيام القادمة حتى يتم تطبيق حل جذري.', descEn: 'Temporary measures to address the issue in the coming days until a permanent fix is applied.', headerCls: 'bg-amber-50 border-amber-200', badgeCls: 'bg-amber-100 text-amber-700', saveCls: 'bg-amber-600 hover:bg-amber-700' },
  { type: 'LONG_TERM', labelAr: 'خطة بعيدة المدى', labelEn: 'Long-Term Plan', required: false, descAr: 'حلول جذرية لضمان عدم تكرار الحادث مستقبلاً (مثل: تغيير سياسات، تركيب معدات جديدة).', descEn: 'Permanent solutions to ensure the incident never recurs (e.g., policy changes, installing new equipment).', headerCls: 'bg-blue-50 border-blue-200', badgeCls: 'bg-blue-100 text-blue-700', saveCls: 'bg-blue-600 hover:bg-blue-700' },
];

export const ActionPlanSection = ({ ticket, onRefresh }: { ticket: any; onRefresh: () => void }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const { showToast } = useToast();
  const plans: ActionPlan[] = ticket.actionPlans || [];

  const role = user?.role || '';
  const isDepRep = ['DEP_REP', 'DEP_MANAGER'].includes(role);
  const isHrRep  = role === 'HR_REP';
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
  const [savingAll,   setSavingAll]   = useState(false);
  const [uploading,   setUploading]   = useState<string | null>(null);
  const [reviewNote,  setReviewNote]  = useState('');
  const [showRejectNotes, setShowRejectNotes] = useState(false); // show rejection notes textarea
  const [bulkReviewing, setBulkReviewing] = useState(false); // loading state for bulk review
  // pending local files per plan type — shown as preview before save
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  // Unique instance ID for file inputs — ensures htmlFor/id pairing is unique per mount
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  // pending attachment-delete confirmation (replaces native confirm() dialog)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // pending action plan delete confirmation
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<string | null>(null);

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
      showToast(err.response?.data?.message || t('errors.fileUploadFailed'));
    } finally {
      setUploading(null);
    }
  };

  // Save (or update) a single plan, then upload any pending files
  const handleSave = async (type: string) => {
    const { desc, date } = forms[type];
    if (!desc.trim()) { showToast(t('errors.planDescRequired')); return; }
    if (!date) { showToast(t('errors.planDateRequired')); return; }
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
      return true;
    } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); return false; }
    finally { setSaving(null); }
  };

  // Save ALL plans that have content — single unified action
  const handleSaveAll = async () => {
    // Validate required plans
    for (const pd of PLAN_DEFS) {
      const form = forms[pd.type];
      if (pd.required && !form.desc.trim()) {
        showToast(`${isRtl ? pd.labelAr : pd.labelEn}: ${t('errors.planDescRequired')}`, 'warning');
        return;
      }
      if (form.desc.trim() && !form.date) {
        showToast(`${isRtl ? pd.labelAr : pd.labelEn}: ${t('errors.planDateRequired', isRtl ? 'التاريخ مطلوب إذا قمت بكتابة وصف' : 'Date is required if you provide a description')}`, 'warning');
        return;
      }
    }
    setSavingAll(true);
    let savedCount = 0;
    try {
      for (const pd of PLAN_DEFS) {
        const form = forms[pd.type];
        // Skip optional plans with no content
        if (!form.desc.trim() && !pd.required) continue;
        if (!form.desc.trim()) continue;
        const success = await handleSave(pd.type);
        if (success) savedCount++;
      }
      if (savedCount > 0) {
        showToast(isRtl ? `✅ تم حفظ ${savedCount} خطة بنجاح` : `✅ ${savedCount} plan(s) saved successfully`, 'success');
        onRefresh();
      }
    } finally { setSavingAll(false); }
  };

  // Add files from existing saved plan immediately
  const handleUploadExisting = async (planId: string, files: File[]) => {
    await doUpload(planId, files);
    onRefresh();
  };

  // Add to local pending preview
  const addPendingFiles = (type: string, files: File[]) => {
    setPendingFiles(pf => ({ ...pf, [type]: [...(pf[type] || []), ...files] }));
  };

  const removePendingFile = (type: string, idx: number) => {
    setPendingFiles(pf => ({ ...pf, [type]: (pf[type] || []).filter((_, i) => i !== idx) }));
  };


  // Bulk approve/reject all submitted plans at once
  const handleBulkReview = async (status: string) => {
    const submittedPlans = plans.filter(p => p.status === 'SUBMITTED');
    if (submittedPlans.length === 0) return;
    if (status === 'REJECTED' && !reviewNote.trim()) {
      showToast(t('errors.rejectionReasonRequired'), 'warning');
      return;
    }
    setBulkReviewing(true);
    try {
      for (const plan of submittedPlans) {
        await api.put(`/action-plans/${plan.id}`, { status, reviewNotes: reviewNote || null });
      }
      if (status === 'REJECTED') {
        await api.put(`/tickets/${ticket.id}/controller-review`, { action: 'RETURN_DEPARTMENT', notes: reviewNote || 'Action plans rejected' });
      }
      showToast(status === 'APPROVED' ? t('errors.planApproved') : t('errors.planRejected'),
        status === 'APPROVED' ? 'success' : 'warning');
      setReviewNote(''); setShowRejectNotes(false);
      onRefresh();
    } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
    finally { setBulkReviewing(false); }
  };

  const deleteAttachment = async (attId: string) => {
    try {
      await api.delete(`/action-plan-attachments/${attId}`);
      showToast(t('errors.attachmentDeleted'), 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || t('errors.attachmentDeleteFailed'), 'error');
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      await api.delete(`/action-plans/${planId}`);
      showToast(isRtl ? 'تم حذف الخطة بنجاح' : 'Action plan deleted successfully', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || t('errors.generic'), 'error');
    }
  };


  const savedCount = PLAN_DEFS.filter(pd => getPlan(pd.type)).length;
  const requiredOk = PLAN_DEFS.filter(pd => pd.required).every(pd => getPlan(pd.type));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
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
            <span className="text-[10px] text-amber-600 font-medium">{isRtl ? 'الإجراء الفوري مطلوب' : 'Immediate Plan Required'}</span>
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
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black px-3 py-1 rounded-full ${pd.badgeCls}`}>
                      {isRtl ? pd.labelAr : pd.labelEn}
                    </span>
                    {pd.required && <span className="text-xs text-red-500 font-bold">{isRtl ? '* مطلوب' : '* Required'}</span>}
                  </div>
                  <p className="text-xs text-slate-600 font-medium max-w-lg mt-0.5 leading-relaxed">{isRtl ? pd.descAr : pd.descEn}</p>
                </div>
                {isSaved && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${approved ? 'bg-emerald-100 text-emerald-700' :
                        rejected ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                      }`}>
                      {approved ? (isRtl ? '✓ مُعتمدة' : '✓ Approved') : rejected ? (isRtl ? '✗ مرفوضة' : '✗ Rejected') : (isRtl ? '⏳ محفوظة' : '⏳ Saved')}
                    </span>
                    {canEdit && !approved && (
                      <button
                        onClick={() => setConfirmDeletePlan(ex.id)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300 w-7 h-7 rounded-full transition-all shadow-sm flex items-center justify-center tooltip"
                        title={isRtl ? 'حذف هذه الخطة' : 'Delete this plan'}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-3 space-y-3 bg-white">
                {canEdit && !approved ? (
                  /* ── Editable form (DEP_REP) ── */
                  <>
                    {rejected && ex?.reviewNotes && (
                      <div className="rounded-lg p-2.5 text-xs mb-3 bg-red-50 border border-red-200 text-red-700">
                        <div>
                          <strong>{isRtl ? 'ملاحظة المراجع: ' : 'Reviewer Note: '}</strong>{ex.reviewNotes}
                        </div>
                      </div>
                    )}
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
                        id={`action-plan-desc-${pd.type}`} name={`action-plan-desc-${pd.type}`}
                        value={form.desc}
                        onChange={e => setForms(f => ({ ...f, [pd.type]: { ...f[pd.type], desc: e.target.value } }))}
                        placeholder={isRtl ? `اكتب تفاصيل خطة العمل ${pd.labelAr}...` : `Write details for ${pd.labelEn} plan...`}
                        rows={7}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 min-h-[160px]"
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <label className="text-sm font-bold text-gray-700 whitespace-nowrap">{isRtl ? 'التاريخ المستهدف' : 'Target Date'} {(pd.required || form.desc.trim()) ? <span className="text-red-500">*</span> : ''}:</label>
                      <input
                        id={`action-plan-date-${pd.type}`} name={`action-plan-date-${pd.type}`}
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
                        <label
                          htmlFor={`ap-file-${instanceId.current}-${pd.type}`}
                          className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 hover:border-teal-400 text-teal-700 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-all shadow-sm"
                        >
                          {(uploading === ex?.id || saving === pd.type) ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          {isRtl ? 'اختر ملف' : 'Choose File'}
                          <input
                            key={`ap-file-${pd.type}`}
                            id={`ap-file-${instanceId.current}-${pd.type}`}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xlsx,.eml"
                            className="sr-only"
                            onChange={e => {
                              const fileList = e.target.files;
                              if (!fileList || fileList.length === 0) return;
                              const filesArray = Array.from(fileList);
                              addPendingFiles(pd.type, filesArray);
                              showToast(`✅ Added ${filesArray.length} file(s) to ${pd.type}`, 'success');
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
                                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(att.id); }}
                                    className="absolute top-0.5 right-0.5 z-10 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                    <X size={14} strokeWidth={3} />
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

                    {/* Status indicator for unsaved changes */}
                    {(form.desc.trim() && !isSaved) || (isSaved && (form.desc.trim() !== (ex?.description || '') || form.date !== (ex?.targetDate?.slice(0,10) || ''))) ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] text-amber-600 font-bold">{isRtl ? 'تغييرات غير محفوظة' : 'Unsaved changes'}</span>
                      </div>
                    ) : null}
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
                                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(att.id); }}
                                      className="absolute top-0.5 right-0.5 z-10 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                      <X size={14} strokeWidth={3} />
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
                          <input type="file" multiple className="sr-only"
                            onChange={e => {
                              const fl = e.target.files;
                              if (fl && fl.length > 0) {
                                const filesArray = Array.from(fl);
                                handleUploadExisting(ex!.id, filesArray);
                              }
                              e.target.value = '';
                            }} />
                        </label>
                      )}

                      {/* Reviewer status badge — when plan is submitted */}
                      {isReviewer && ex!.status === 'SUBMITTED' && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                            ⏳ {isRtl ? 'بانتظار المراجعة الموحدة أدناه' : 'Awaiting unified review below'}
                          </span>
                        </div>
                      )}

                      {/* Rejection/approval note display */}
                      {ex!.reviewNotes && (
                        <div className={`rounded-lg p-2.5 text-xs mt-1 ${approved ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                          <div>
                            <strong>{isRtl ? 'ملاحظة المراجع: ' : 'Reviewer Note: '}</strong>{ex!.reviewNotes}
                          </div>
                          {ex!.reviewedBy && (
                            <p className="text-[9px] mt-1 opacity-70">{isRtl ? 'بواسطة:' : 'By:'} {ex!.reviewedBy}</p>
                          )}
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

        {/* ═══════ UNIFIED SAVE BUTTON — Save all plans at once ═══════ */}
        {canEdit && (
          <button
            onClick={handleSaveAll}
            disabled={savingAll || saving !== null}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30"
          >
            {savingAll || saving !== null
              ? <><Loader2 size={16} className="animate-spin" /> {isRtl ? 'جارٍ حفظ الخطط...' : 'Saving Plans...'}</>
              : <><Check size={16} /> {isRtl ? '💾 حفظ جميع الخطط' : '💾 Save All Plans'}</>
            }
          </button>
        )}

        {/* ═══════ UNIFIED REVIEW SECTION — Single Approve / Reject for ALL plans ═══════ */}
        {(() => {
          const submittedPlans = plans.filter(p => p.status === 'SUBMITTED');
          const hasSubmitted = submittedPlans.length > 0;

          if (!isReviewer || !hasSubmitted) return null;

          return (
            <div className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg">⚖️</div>
                <div>
                  <h4 className="text-sm font-black text-blue-900">
                    {isRtl ? 'مراجعة خطط العمل' : 'Review Action Plans'}
                  </h4>
                  <p className="text-[10px] text-blue-600">
                    {isRtl ? `${submittedPlans.length} خطة بانتظار المراجعة` : `${submittedPlans.length} plan(s) awaiting review`}
                  </p>
                </div>
              </div>

              {/* Rejection flow — shows notes + Return to Dept / Escalate */}
              {showRejectNotes && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-red-700 block">
                    {isRtl ? 'ملاحظات الرفض' : 'Rejection Notes'} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reviewNote" name="reviewNote"
                    placeholder={isRtl ? 'اكتب سبب الرفض أو الملاحظات هنا...' : 'Write the rejection reason or notes here...'}
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full text-sm border-2 border-red-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none bg-white"
                  />

                  <p className="text-[10px] text-slate-500 font-medium">
                    {isRtl ? 'اختر الإجراء بعد الرفض:' : 'Choose the action after rejection:'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleBulkReview('REJECTED')}
                      disabled={bulkReviewing || !reviewNote.trim()}
                      className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-black py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-40"
                    >
                      {bulkReviewing ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                      {isRtl ? 'إرجاع للقسم' : 'Return to Dept'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!reviewNote.trim()) {
                          showToast(t('errors.rejectionNotesRequired'), 'warning');
                          return;
                        }
                        // Reject all plans then signal escalation via the onRefresh callback
                        setBulkReviewing(true);
                        try {
                          for (const plan of submittedPlans) {
                            await api.put(`/action-plans/${plan.id}`, { status: 'REJECTED', reviewNotes: reviewNote });
                          }
                          // Escalate the ticket
                          await api.put(`/tickets/${ticket.id}/controller-review`, { action: 'ESCALATE', notes: reviewNote });
                          showToast(t('errors.plansRejectedEscalated'), 'success');
                          setReviewNote(''); setShowRejectNotes(false);
                          onRefresh();
                        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
                        finally { setBulkReviewing(false); }
                      }}
                      disabled={bulkReviewing || !reviewNote.trim()}
                      className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-black py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-40"
                    >
                      {bulkReviewing ? <Loader2 size={15} className="animate-spin" /> : <CornerUpRight size={15} />}
                      {isRtl ? 'تصعيد' : 'Escalate'}
                    </button>
                  </div>

                  <button
                    onClick={() => { setShowRejectNotes(false); setReviewNote(''); }}
                    className="w-full text-xs font-bold text-gray-500 hover:text-gray-700 py-1.5 transition-all"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              )}

              {/* Main buttons — Approve / Reject (before rejection flow is triggered) */}
              {!showRejectNotes && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleBulkReview('APPROVED')}
                    disabled={bulkReviewing}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-black py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {bulkReviewing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {isRtl ? '✓ اعتماد' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectNotes(true)}
                    className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-black py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                  >
                    <X size={16} />
                    {isRtl ? '✗ رفض' : '✗ Reject'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Attachment delete confirmation modal ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1 bg-red-500" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {isRtl ? 'حذف المرفق' : 'Delete Attachment'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isRtl
                      ? 'هل أنت متأكد من حذف هذا المرفق؟ لا يمكن التراجع عن هذا الإجراء.'
                      : 'Are you sure you want to delete this attachment? This action cannot be undone.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => { const id = confirmDelete; setConfirmDelete(null); if (id) deleteAttachment(id); }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/30"
                >
                  {isRtl ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Action plan delete confirmation modal ── */}
      {confirmDeletePlan && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmDeletePlan(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1 bg-red-500" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {isRtl ? 'حذف الخطة' : 'Delete Action Plan'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isRtl
                      ? 'هل أنت متأكد من حذف خطة العمل هذه؟ سيتم حذف جميع المرفقات المرتبطة بها ولن تتمكن من التراجع.'
                      : 'Are you sure you want to delete this action plan? All its attachments will be deleted and this cannot be undone.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeletePlan(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => { const id = confirmDeletePlan; setConfirmDeletePlan(null); if (id) deletePlan(id); }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/30"
                >
                  {isRtl ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export const ReminderSection = ({ ticket, onRefresh }: { ticket: any; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [completedNote, setCompletedNote] = useState('');
  const reminders = ticket.reminders || [];

  const handleComplete = async (reminderId: string) => {
    setLoading(true);
    try {
      await api.put(`/reminders/${reminderId}/complete`, { completedNote });
      setCompletedNote('');
      onRefresh();
    } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
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
