import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import {
    ArrowLeft, MapPin, Clock, AlertTriangle, CheckCircle, Send, Loader2,
    User, ShieldCheck, FileText, XCircle, ChevronDown, ExternalLink,
    Search, Paperclip, MessageSquare, CornerDownRight, Save, Download
} from 'lucide-react';

const resolveAttachmentUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanUrl = url.replace(/\\/g, '/');
    const apiBase = api.defaults.baseURL || '';
    const rootUrl = apiBase.replace(/\/api\/?$/, '');
    return `${rootUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
};

const statusSteps = [
    { key: 'OPEN', icon: <Clock size={14} /> },
    { key: 'SUPERVISOR_REVIEW', icon: <Search size={14} /> },
    { key: 'UNDER_INVESTIGATION', icon: <FileText size={14} /> },
    { key: 'FINAL_REVIEW', icon: <ShieldCheck size={14} /> },
    { key: 'CLOSED', icon: <CheckCircle size={14} /> },
];

const statusOrder = ['OPEN', 'SUPERVISOR_REVIEW', 'RETURNED_FOR_EDIT', 'UNDER_INVESTIGATION', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'];

const OCTicketDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'attachments'>('details');
    const [confirmAction, setConfirmAction] = useState<{action: string, handler: () => void} | null>(null); // Fix #6

    // Supervisor fields
    const [gosiReportDate, setGosiReportDate] = useState('');
    const [gosiReportNumber, setGosiReportNumber] = useState('');
    const [immediateActions, setImmediateActions] = useState('');
    const [supervisorNotes, setSupervisorNotes] = useState('');

    // Investigator fields
    const [immediateCauses, setImmediateCauses] = useState('');
    const [underlyingCauses, setUnderlyingCauses] = useState('');
    const [rootCauses, setRootCauses] = useState('');
    const [analysisMethod, setAnalysisMethod] = useState('');
    const [preventiveActions, setPreventiveActions] = useState('');

    // HSE Manager fields
    const [finalNotes, setFinalNotes] = useState('');

    const fetchTicket = async () => {
        try {
            const res = await api.get(`/oc/tickets/${id}`);
            setTicket(res.data);
            // Pre-fill supervisor fields if already filled
            const oc = res.data.offCircuitReport;
            if (oc) {
                if (oc.gosiReportDate) setGosiReportDate(oc.gosiReportDate.split('T')[0]);
                if (oc.gosiReportNumber) setGosiReportNumber(oc.gosiReportNumber);
                if (oc.immediateActions) setImmediateActions(oc.immediateActions);
                if (oc.supervisorNotes) setSupervisorNotes(oc.supervisorNotes);
                if (oc.immediateCauses) setImmediateCauses(oc.immediateCauses);
                if (oc.underlyingCauses) setUnderlyingCauses(oc.underlyingCauses);
                if (oc.rootCauses) setRootCauses(oc.rootCauses);
                if (oc.analysisMethod) setAnalysisMethod(oc.analysisMethod);
                if (oc.preventiveActions) setPreventiveActions(oc.preventiveActions);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load ticket');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTicket(); }, [id]);

    const handleSupervisorAction = async (action: 'APPROVE' | 'RETURN') => {
        // Fix #5: require notes for return
        if (action === 'RETURN' && !supervisorNotes.trim()) {
            setError(t('oc.supervisor.notesRequired'));
            return;
        }
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/oc/tickets/${id}/supervisor`, {
                action, gosiReportDate, gosiReportNumber, immediateActions, supervisorNotes
            });
            setConfirmAction(null);
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitInvestigation = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/oc/tickets/${id}/investigation`, {
                immediateCauses, underlyingCauses, rootCauses, analysisMethod, preventiveActions
            });
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Submission failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalDecision = async (decision: 'CLOSE' | 'REJECT') => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/oc/tickets/${id}/final-review`, { decision, finalNotes });
            setConfirmAction(null);
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Decision failed');
        } finally {
            setActionLoading(false);
        }
    };

    // Fix #19: Auto-save investigation fields to localStorage
    const autoSaveKey = `oc_investigation_${id}`;
    useEffect(() => {
        if (!canInvestigatorEditRef.current) return;
        const saved = localStorage.getItem(autoSaveKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.immediateCauses && !immediateCauses) setImmediateCauses(data.immediateCauses);
                if (data.rootCauses && !rootCauses) setRootCauses(data.rootCauses);
                if (data.underlyingCauses && !underlyingCauses) setUnderlyingCauses(data.underlyingCauses);
                if (data.preventiveActions && !preventiveActions) setPreventiveActions(data.preventiveActions);
                if (data.analysisMethod && !analysisMethod) setAnalysisMethod(data.analysisMethod);
            } catch {}
        }
    }, []);

    useEffect(() => {
        if (immediateCauses || rootCauses || underlyingCauses || preventiveActions) {
            const timer = setTimeout(() => {
                localStorage.setItem(autoSaveKey, JSON.stringify({ immediateCauses, rootCauses, underlyingCauses, preventiveActions, analysisMethod }));
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [immediateCauses, rootCauses, underlyingCauses, preventiveActions, analysisMethod]);

    const canInvestigatorEditRef = React.useRef(false);

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
    );

    if (!ticket) return (
        <div className="text-center py-20">
            <XCircle className="mx-auto text-red-500 mb-3" size={40} />
            <p className="text-red-400">{error || 'Ticket not found'}</p>
        </div>
    );

    const oc = ticket.offCircuitReport;
    const role = user?.role;
    const currentStepIdx = statusOrder.indexOf(ticket.status);
    const injuredPersons = oc?.injuredPersons ? JSON.parse(oc.injuredPersons) : [];
    const witnessesData = oc?.witnesses ? JSON.parse(oc.witnesses) : [];

    // Role checks
    const isSupervisor = role === 'OC_SUPERVISOR' || role === 'ADMIN';
    const isInvestigator = role === 'OC_SAFETY_INVESTIGATOR' || role === 'ADMIN';
    const isHSEManager = role === 'OC_HSE_MANAGER' || role === 'ADMIN';
    const isReporter = role === 'OC_REPORTER' || role === 'ADMIN';

    // Can edit checks
    const canSupervisorEdit = isSupervisor && ['OPEN', 'SUPERVISOR_REVIEW'].includes(ticket.status);
    const canInvestigatorEdit = isInvestigator && ticket.status === 'UNDER_INVESTIGATION';
    const canHSEEdit = isHSEManager && ticket.status === 'FINAL_REVIEW';

    // ---- PDF Report Generation ----
    const generatePDFReport = () => {
        if (!ticket || !oc) return;
        const isAr = document.documentElement.lang?.startsWith('ar');
        const dir = isAr ? 'rtl' : 'ltr';
        const align = isAr ? 'right' : 'left';
        const injuredList = oc.injuredPersons ? JSON.parse(oc.injuredPersons) : [];
        const witnessList = oc.witnesses ? JSON.parse(oc.witnesses) : [];

        // Determine base API URL for attachment images
        const apiBase = api.defaults.baseURL || '';
        const rootUrl = apiBase.replace(/\/api\/?$/, '');

        // Prepare Image Attachments HTML
        let attachmentsHtml = '';
        if (ticket.attachments && ticket.attachments.length > 0) {
            const images = ticket.attachments.filter((a: any) => a.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || a.type === 'IMAGE');
            if (images.length > 0) {
                attachmentsHtml = `
                    <div style="page-break-before: always;">
                        <div style="background:#64748b;color:white;padding:10px 16px;border-radius:8px;font-weight:700;font-size:14px;margin-top:24px;margin-bottom:12px;">${isAr ? '⑤ المرفقات والصور' : '⑤ Incident Images & Attachments'}</div>
                        <div style="display:flex; flex-wrap:wrap; gap:16px;">
                            ${images.map((att: any) => {
                                const fileUrl = resolveAttachmentUrl(att.url);
                                return `<img src="${fileUrl}" style="max-width:300px; height:auto; max-height:250px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0; padding:4px;" />`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Generate QR Code URL
        const qrData = encodeURIComponent(`Ticket No: ${ticket.ticketNo}\nDate: ${formatDateTime(new Date(ticket.createdAt))}\nAuthenticated by SMC HSE Department`);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&margin=0`;

        const row = (label: string, value: string) => value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#666;border-bottom:1px solid #eee;width:35%;vertical-align:top">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${value}</td></tr>` : '';

        const sectionTitle = (title: string, color: string) => `<div style="background:${color};color:white;padding:10px 16px;border-radius:8px 8px 0 0;font-weight:700;font-size:14px;margin-top:24px">${title}</div>`;

        const html = `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head><meta charset="UTF-8"><title>${ticket.ticketNo} - ${isAr ? 'تقرير الحادث' : 'Incident Report'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Tajawal','Segoe UI',sans-serif; font-size:13px; color:#333; background:#fff; direction:${dir}; padding:20px 40px; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #f59e0b; padding-bottom:16px; margin-bottom:8px; }
  .header h1 { font-size:22px; color:#f59e0b; font-family:monospace; }
  .header .meta { text-align:${isAr ? 'left' : 'right'}; font-size:11px; color:#888; }
  .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
  .badge-status { background:#f59e0b22; color:#f59e0b; border:1px solid #f59e0b55; }
  .badge-injury { background:#ef444422; color:#ef4444; border:1px solid #ef444455; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; }
  .section-table { border:1px solid #e5e7eb; border-radius:0 0 8px 8px; overflow:hidden; }
  .multiline { white-space:pre-wrap; background:#f8fafc; padding:8px; border-radius:6px; font-size:12px; margin-top:4px; }
  .injured-card { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px; margin:6px 0; font-size:12px; }
  .footer { text-align:center; margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:10px; color:#aaa; }
  @media print { body { padding:10px 20px; } .no-print { display:none; } }
</style></head><body>

<div class="no-print" style="text-align:center;margin-bottom:20px">
  <button onclick="window.print()" style="background:#f59e0b;color:white;border:none;padding:10px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:Tajawal">
    📥 ${isAr ? 'حفظ كـ PDF' : 'Save as PDF'}
  </button>
</div>

<div class="header">
  <div>
    <h1>${ticket.ticketNo}</h1>
    <div style="margin-top:4px">
      <span class="badge badge-status">${t(`oc.status.${ticket.status}`)}</span>
      ${ticket.hasInjury ? `<span class="badge badge-injury" style="margin-${isAr ? 'right' : 'left'}:6px">⚠ ${t('oc.injury')}</span>` : ''}
    </div>
  </div>
  <div class="meta">
    <div><strong>${isAr ? 'SMC - قسم السلامة' : 'SMC HSE Department'}</strong></div>
    <div>${isAr ? 'تقرير حوادث خارج المضمار' : 'Off-Circuit Incident Report'}</div>
    <div style="margin-top:4px">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>
  </div>
</div>

${sectionTitle(isAr ? '① تقرير الحادث (المُبلّغ)' : '① Incident Report (Reporter)', '#f59e0b')}
<div class="section-table"><table>
  ${row(t('oc.wizard.incidentType'), t(`oc.incidentTypes.${oc.incidentType}`))}
  ${row(t('oc.wizard.severity'), t(`priority.${oc.severity}`))}
  ${row(t('oc.wizard.dateTime'), `${oc.incidentDate ? formatDate(oc.incidentDate) : ''} ${oc.incidentTime || ''}`)}
  ${row(t('oc.wizard.location'), oc.locationLat ? `<a href="https://www.google.com/maps?q=${oc.locationLat},${oc.locationLng}" target="_blank">${oc.locationLat?.toFixed(4)}, ${oc.locationLng?.toFixed(4)}</a>` : '-')}
  ${row(t('oc.wizard.whatHappened'), `<div class="multiline">${oc.whatHappened || '-'}</div>`)}
  ${row(t('oc.wizard.hasInjury'), ticket.hasInjury ? `<span style="color:#ef4444;font-weight:700">${t('oc.yes')}</span>` : t('oc.no'))}
  ${row(t('oc.ownership.preparedBy'), ticket.createdBy?.name || '-')}
</table></div>

${injuredList.length > 0 ? `
  <div style="margin-top:12px">
    <strong style="color:#ef4444;font-size:12px">${t('oc.wizard.injuredPersons')} (${injuredList.length})</strong>
    ${injuredList.map((p: any) => `<div class="injured-card"><strong>${p.name}</strong> (${p.affiliate})${p.contact ? ` — ${p.contact}` : ''}${p.dept ? ` — ${p.dept}` : ''}</div>`).join('')}
  </div>` : ''}

${witnessList.length > 0 ? `
  <div style="margin-top:12px">
    <strong style="color:#3b82f6;font-size:12px">${t('oc.wizard.witnesses')} (${witnessList.length})</strong>
    ${witnessList.map((w: any) => `<div style="font-size:12px;padding:4px 0">${w.name} — ${w.mobile}</div>`).join('')}
  </div>` : ''}

${oc.supervisorFilledBy ? `
  ${sectionTitle(isAr ? '② مراجعة المشرف' : '② Supervisor Review', '#eab308')}
  <div class="section-table"><table>
    ${row(t('oc.supervisor.gosiDate'), oc.gosiReportDate ? formatDate(oc.gosiReportDate) : '-')}
    ${row(t('oc.supervisor.gosiNumber'), oc.gosiReportNumber || '-')}
    ${row(t('oc.supervisor.immediateActions'), `<div class="multiline">${oc.immediateActions || '-'}</div>`)}
    ${oc.supervisorNotes ? row(t('oc.supervisor.notes'), `<div class="multiline">${oc.supervisorNotes}</div>`) : ''}
    ${row(t('oc.ownership.reviewedBy'), oc.supervisorFilledBy)}
  </table></div>` : ''}

${oc.investigatorFilledBy ? `
  ${sectionTitle(isAr ? '③ تقرير التحقيق' : '③ Investigation Report', '#a855f7')}
  <div class="section-table"><table>
    ${oc.analysisMethod ? row(t('oc.investigation.analysisMethod'), oc.analysisMethod) : ''}
    ${row(t('oc.investigation.immediateCauses'), `<div class="multiline">${oc.immediateCauses || '-'}</div>`)}
    ${row(t('oc.investigation.underlyingCauses'), `<div class="multiline">${oc.underlyingCauses || '-'}</div>`)}
    ${row(t('oc.investigation.rootCauses'), `<div class="multiline">${oc.rootCauses || '-'}</div>`)}
    ${row(t('oc.investigation.preventiveActions'), `<div class="multiline">${oc.preventiveActions || '-'}</div>`)}
  </table></div>` : ''}

${oc.hseManagerFilledBy ? `
  ${sectionTitle(isAr ? '④ القرار النهائي (HSE)' : '④ Final Decision (HSE Manager)', '#06b6d4')}
  <div class="section-table"><table>
    ${row(t('oc.hse.decision'), oc.finalDecision === 'CLOSE' ? `<span style="color:#22c55e;font-weight:700">✅ ${t('oc.hse.closed')}</span>` : `<span style="color:#ef4444;font-weight:700">❌ ${t('oc.hse.rejected')}</span>`)}
    ${oc.finalNotes ? row(t('oc.hse.finalNotes'), `<div class="multiline">${oc.finalNotes}</div>`) : ''}
    ${row(t('oc.ownership.approvedBy'), oc.hseManagerFilledBy)}
  </table></div>` : ''}

${attachmentsHtml}

<div class="footer" style="display:flex;flex-direction:column;align-items:center;margin-top:40px;gap:8px">
  <img src="${qrCodeUrl}" alt="QR Code" style="width:80px;height:80px;border-radius:8px;border:1px solid #ccc;padding:4px" />
  <strong style="color:#f59e0b;font-size:11px;">Authenticated by SMC HSE Department</strong>
  
  <div style="margin-top:16px;color:#aaa">
      <p>${isAr ? 'تم إنشاء هذا التقرير آلياً من نظام إدارة حوادث SMC' : 'This report was auto-generated by SMC Incident Management System'}</p>
      <p style="margin-top:2px">${formatDateTime(new Date())}</p>
  </div>
</div>

<script>
  // Wait for all resources (images) to finish loading before opening print dialog
  window.onload = function() {
      setTimeout(function() { window.print(); }, 200);
  };
  // Failsafe just in case window.onload doesn't fire
  setTimeout(function() { window.print(); }, 4000);
</script>
</body></html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    return (
        <div className="space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/oc/dashboard')}
                    className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-amber-400 font-mono" dir="ltr">{ticket.ticketNo}</h1>
                        {ticket.hasInjury && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                <AlertTriangle size={10} /> {t('oc.injury')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400">{t(`oc.status.${ticket.status}`)}</p>
                </div>
                {/* PDF Download Button */}
                <button onClick={generatePDFReport}
                    className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 transition-all"
                    title={t('oc.report.download')}>
                    <Download size={18} />
                </button>
            </div>

            {/* Progress Steps */}
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                    {statusSteps.map((s, i) => {
                        const isCurrent = ticket.status === s.key;
                        const isPast = statusOrder.indexOf(s.key) < currentStepIdx;
                        const isRejected = ticket.status === 'CLOSED_REJECTED' && s.key === 'CLOSED';
                        return (
                            <React.Fragment key={s.key}>
                                <div className={`flex flex-col items-center gap-1 ${isCurrent ? 'text-amber-400' : isPast ? 'text-emerald-400' : 'text-slate-600'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                                        ${isCurrent ? 'border-amber-500 bg-amber-500/20' : isPast ? 'border-emerald-500 bg-emerald-500/20' : isRejected ? 'border-red-500 bg-red-500/20' : 'border-slate-700 bg-slate-800'}`}>
                                        {isRejected ? <XCircle size={14} className="text-red-400" /> : isPast ? <CheckCircle size={14} /> : s.icon}
                                    </div>
                                    <span className="text-[9px] font-medium text-center leading-tight max-w-[65px]">
                                        {t(`oc.statusShort.${s.key}`)}
                                    </span>
                                </div>
                                {i < statusSteps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 rounded ${isPast ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="text-red-400 flex-shrink-0" size={16} />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Fix #13: Returned ticket banner */}
            {ticket.status === 'RETURNED_FOR_EDIT' && oc?.supervisorNotes && (
                <div className="bg-orange-500/10 border-2 border-orange-500/40 rounded-xl p-4 flex gap-3">
                    <CornerDownRight size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-orange-400 mb-1">{t('oc.returned.title')}</p>
                        <p className="text-xs text-orange-300/80">{oc.supervisorNotes}</p>
                    </div>
                </div>
            )}

            <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-700/50">
                {(['details', 'timeline', 'attachments'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
                            ${activeTab === tab ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-300'}`}>
                        {tab === 'details' && <FileText size={12} className="inline mr-1" />}
                        {tab === 'timeline' && <Clock size={12} className="inline mr-1" />}
                        {tab === 'attachments' && <Paperclip size={12} className="inline mr-1" />}
                        {t(`oc.tabs.${tab}`)}
                    </button>
                ))}
            </div>

            {/* Fix #6: Confirmation Dialog */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
                        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36} />
                        <h3 className="text-center text-white font-bold mb-1">{t('oc.confirm.title')}</h3>
                        <p className="text-center text-slate-400 text-sm mb-4">{confirmAction.action}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmAction(null)}
                                className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm hover:bg-slate-700 transition-all">
                                {t('common.cancel')}
                            </button>
                            <button onClick={confirmAction.handler}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-lg transition-all">
                                {t('oc.confirm.proceed')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
                <div className="space-y-4">
                    {/* ===== SECTION 1: Reporter Data (Read-Only except for RETURNED_FOR_EDIT) ===== */}
                    <Section title={t('oc.sections.reporterInfo')} icon={<User size={14} />} color="amber"
                        filledBy={oc?.reporterFilledBy} filledAt={oc?.reporterFilledAt}>
                        <InfoRow label={t('oc.wizard.incidentType')} value={t(`oc.incidentTypes.${oc?.incidentType}`)} />
                        <InfoRow label={t('oc.wizard.severity')} value={t(`priority.${oc?.severity}`)}
                            valueClass={oc?.severity === 'CRITICAL' ? 'text-red-400 font-bold' : oc?.severity === 'HIGH' ? 'text-orange-400' : ''} />
                        <InfoRow label={t('oc.wizard.dateTime')} value={`${oc?.incidentDate ? formatDate(oc.incidentDate) : ''} ${oc?.incidentTime || ''}`} dir="ltr" />
                        <InfoRow label={t('oc.wizard.location')} value={
                            oc?.locationLat ? (
                                <a href={`https://www.google.com/maps?q=${oc.locationLat},${oc.locationLng}`} target="_blank" rel="noreferrer"
                                    className="text-blue-400 underline flex items-center gap-1" dir="ltr">
                                    <MapPin size={12} /> {oc.locationLat.toFixed(4)}, {oc.locationLng.toFixed(4)}
                                    <ExternalLink size={10} />
                                </a>
                            ) : '-'
                        } />
                        <InfoRow label={t('oc.wizard.whatHappened')} value={oc?.whatHappened} multiline />
                        <InfoRow label={t('oc.wizard.hasInjury')} value={
                            ticket.hasInjury ?
                                <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle size={12} /> {t('oc.yes')}</span> :
                                <span className="text-slate-400">{t('oc.no')}</span>
                        } />
                        {injuredPersons.length > 0 && (
                            <div className="mt-2 space-y-2">
                                <p className="text-xs font-bold text-red-400">{t('oc.wizard.injuredPersons')} ({injuredPersons.length})</p>
                                {injuredPersons.map((p: any, i: number) => (
                                    <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2 text-xs space-y-1">
                                        <p className="text-white font-medium">{p.name} ({p.affiliate})</p>
                                        {p.contact && <p className="text-slate-400" dir="ltr">{p.contact}</p>}
                                        {p.dept && <p className="text-slate-400">{p.dept} - {p.jobTitle}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {witnessesData.length > 0 && (
                            <div className="mt-2 space-y-1">
                                <p className="text-xs font-bold text-blue-400">{t('oc.wizard.witnesses')} ({witnessesData.length})</p>
                                {witnessesData.map((w: any, i: number) => (
                                    <div key={i} className="text-xs text-slate-300">{w.name} - <span dir="ltr">{w.mobile}</span></div>
                                ))}
                            </div>
                        )}
                        <InfoRow label={t('oc.ownership.preparedBy')} value={ticket.createdBy?.name} />
                    </Section>

                    {/* ===== SECTION 2: Supervisor Section ===== */}
                    {(isSupervisor || isInvestigator || isHSEManager || oc?.supervisorFilledBy) && (
                        <Section title={t('oc.sections.supervisorReview')} icon={<Search size={14} />} color="yellow"
                            filledBy={oc?.supervisorFilledBy} filledAt={oc?.supervisorFilledAt}>
                            {canSupervisorEdit ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.supervisor.gosiDate')}</label>
                                        <input type="date" value={gosiReportDate} onChange={(e) => setGosiReportDate(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" dir="ltr" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.supervisor.gosiNumber')}</label>
                                        <input type="text" value={gosiReportNumber} onChange={(e) => setGosiReportNumber(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" dir="ltr" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.supervisor.immediateActions')} *</label>
                                        <textarea value={immediateActions} onChange={(e) => setImmediateActions(e.target.value)} rows={4}
                                            placeholder={t('oc.supervisor.immediateActionsPlaceholder')}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[100px] resize-y" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.supervisor.notes')}</label>
                                        <textarea value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} rows={4}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[100px] resize-y" />
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        {/* Fix #5: disable return if no notes */}
                                        <button onClick={() => setConfirmAction({ action: t('oc.supervisor.confirmReturn'), handler: () => handleSupervisorAction('RETURN') })}
                                            disabled={actionLoading || !supervisorNotes.trim()}
                                            className="flex-1 bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-500/25 transition-all text-sm disabled:opacity-50">
                                            <CornerDownRight size={14} /> {t('oc.supervisor.return')}
                                        </button>
                                        <button onClick={() => setConfirmAction({ action: t('oc.supervisor.confirmApprove'), handler: () => handleSupervisorAction('APPROVE') })}
                                            disabled={actionLoading}
                                            className="flex-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500/25 transition-all text-sm disabled:opacity-50">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                                            {t('oc.supervisor.approve')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                oc?.supervisorFilledBy ? (
                                    <>
                                        {oc.gosiReportDate && <InfoRow label={t('oc.supervisor.gosiDate')} value={formatDate(oc.gosiReportDate)} />}
                                        {oc.gosiReportNumber && <InfoRow label={t('oc.supervisor.gosiNumber')} value={oc.gosiReportNumber} />}
                                        <InfoRow label={t('oc.supervisor.immediateActions')} value={oc.immediateActions} multiline />
                                        {oc.supervisorNotes && <InfoRow label={t('oc.supervisor.notes')} value={oc.supervisorNotes} multiline />}
                                        <InfoRow label={t('oc.ownership.reviewedBy')} value={oc.supervisorFilledBy} />
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">{t('oc.sections.pendingSupervisor')}</p>
                                )
                            )}
                        </Section>
                    )}

                    {/* ===== SECTION 3: Investigation ===== */}
                    {(isInvestigator || isHSEManager || oc?.investigatorFilledBy) && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('UNDER_INVESTIGATION') && (
                        <Section title={t('oc.sections.investigation')} icon={<FileText size={14} />} color="purple"
                            filledBy={oc?.investigatorFilledBy} filledAt={oc?.investigatorFilledAt}>
                            {canInvestigatorEdit ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.investigation.analysisMethod')}</label>
                                        <select value={analysisMethod} onChange={(e) => setAnalysisMethod(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                            <option value="">{t('oc.investigation.selectMethod')}</option>
                                            <option value="Fish Bone">Fish Bone</option>
                                            <option value="Tree Analysis">Tree Analysis</option>
                                            <option value="5 Whys">5 Whys</option>
                                            <option value="Root Cause Analysis">Root Cause Analysis</option>
                                        </select>
                                    </div>
                                    {/* Fix #20: char counter on textareas */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.investigation.immediateCauses')} *</label>
                                        <textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value.slice(0, 5000))} rows={4}
                                            placeholder={t('oc.investigation.immediateCausesPlaceholder')}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[120px] resize-y" />
                                        <p className={`text-[10px] text-right mt-0.5 ${immediateCauses.length > 4900 ? 'text-amber-400' : 'text-slate-600'}`}>{immediateCauses.length}/5000</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.investigation.underlyingCauses')} *</label>
                                        <textarea value={underlyingCauses} onChange={(e) => setUnderlyingCauses(e.target.value.slice(0, 5000))} rows={4}
                                            placeholder={t('oc.investigation.underlyingCausesPlaceholder')}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[120px] resize-y" />
                                        <p className={`text-[10px] text-right mt-0.5 ${underlyingCauses.length > 4900 ? 'text-amber-400' : 'text-slate-600'}`}>{underlyingCauses.length}/5000</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.investigation.rootCauses')} *</label>
                                        <textarea value={rootCauses} onChange={(e) => setRootCauses(e.target.value.slice(0, 5000))} rows={4}
                                            placeholder={t('oc.investigation.rootCausesPlaceholder')}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[120px] resize-y" />
                                        <p className={`text-[10px] text-right mt-0.5 ${rootCauses.length > 4900 ? 'text-amber-400' : 'text-slate-600'}`}>{rootCauses.length}/5000</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.investigation.preventiveActions')} *</label>
                                        <textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value.slice(0, 5000))} rows={4}
                                            placeholder={t('oc.investigation.preventiveActionsPlaceholder')}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[120px] resize-y" />
                                        <p className={`text-[10px] text-right mt-0.5 ${preventiveActions.length > 4900 ? 'text-amber-400' : 'text-slate-600'}`}>{preventiveActions.length}/5000</p>
                                    </div>
                                    <button onClick={handleSubmitInvestigation} disabled={actionLoading || !immediateCauses || !rootCauses}
                                        className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 text-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                                        {t('oc.investigation.submitInvestigation')}
                                    </button>
                                </div>
                            ) : (
                                oc?.investigatorFilledBy ? (
                                    <>
                                        {oc.analysisMethod && <InfoRow label={t('oc.investigation.analysisMethod')} value={oc.analysisMethod} />}
                                        <InfoRow label={t('oc.investigation.immediateCauses')} value={oc.immediateCauses} multiline />
                                        <InfoRow label={t('oc.investigation.underlyingCauses')} value={oc.underlyingCauses} multiline />
                                        <InfoRow label={t('oc.investigation.rootCauses')} value={oc.rootCauses} multiline />
                                        <InfoRow label={t('oc.investigation.preventiveActions')} value={oc.preventiveActions} multiline />
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">{t('oc.sections.pendingInvestigation')}</p>
                                )
                            )}
                        </Section>
                    )}

                    {/* ===== SECTION 4: HSE Manager Final Decision ===== */}
                    {(isHSEManager || oc?.hseManagerFilledBy) && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('FINAL_REVIEW') && (
                        <Section title={t('oc.sections.finalReview')} icon={<ShieldCheck size={14} />} color="cyan"
                            filledBy={oc?.hseManagerFilledBy} filledAt={oc?.hseManagerFilledAt}>
                            {canHSEEdit ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">{t('oc.hse.finalNotes')}</label>
                                        <textarea value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} rows={4}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[100px] resize-y" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setConfirmAction({ action: t('oc.hse.confirmReject'), handler: () => handleFinalDecision('REJECT') })}
                                            disabled={actionLoading}
                                            className="flex-1 bg-red-500/15 border border-red-500/30 text-red-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/25 transition-all text-sm disabled:opacity-50">
                                            <XCircle size={14} /> {t('oc.hse.reject')}
                                        </button>
                                        <button onClick={() => setConfirmAction({ action: t('oc.hse.confirmClose'), handler: () => handleFinalDecision('CLOSE') })}
                                            disabled={actionLoading}
                                            className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                                            {t('oc.hse.close')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                oc?.hseManagerFilledBy ? (
                                    <>
                                        <InfoRow label={t('oc.hse.decision')} value={
                                            oc.finalDecision === 'CLOSE' ?
                                                <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={12} /> {t('oc.hse.closed')}</span> :
                                                <span className="text-red-400 font-bold flex items-center gap-1"><XCircle size={12} /> {t('oc.hse.rejected')}</span>
                                        } />
                                        {oc.finalNotes && <InfoRow label={t('oc.hse.finalNotes')} value={oc.finalNotes} multiline />}
                                        <InfoRow label={t('oc.ownership.approvedBy')} value={oc.hseManagerFilledBy} />
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">{t('oc.sections.pendingFinalReview')}</p>
                                )
                            )}
                        </Section>
                    )}


                </div>
            )}

            {/* TIMELINE TAB */}
            {activeTab === 'timeline' && (
                <div className="space-y-2">
                    {ticket.activityLogs?.map((log: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 flex gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-400">
                                {log.actor?.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-white">{log.actor?.name || 'System'}</span>
                                    <span className="text-[10px] text-slate-500">{log.actor?.role?.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-xs text-slate-300">{log.action?.replace(/_/g, ' ')}</p>
                                {log.details && <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>}
                                <p className="text-[10px] text-slate-600 mt-1" dir="ltr">{formatDateTime(log.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                    {(!ticket.activityLogs || ticket.activityLogs.length === 0) && (
                        <p className="text-center text-slate-500 py-8 text-sm">{t('oc.timeline.empty')}</p>
                    )}
                </div>
            )}

            {/* ATTACHMENTS TAB */}
            {activeTab === 'attachments' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {ticket.attachments?.map((att: any, idx: number) => {
                        const fileUrl = resolveAttachmentUrl(att.url);
                        return (
                            <a key={idx} href={fileUrl} target="_blank" rel="noreferrer"
                                className="block bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all group relative shadow-lg">
                                {att.type === 'IMAGE' || fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                    <div className="aspect-square bg-slate-800 relative">
                                        <img src={fileUrl} alt={att.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <p className="text-[10px] text-white truncate">{att.name}</p>
                                            <p className="text-[9px] text-amber-400">{(att.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-square bg-slate-800 flex flex-col items-center justify-center p-4">
                                        <FileText size={32} className="text-slate-500 mb-2 group-hover:text-amber-400 transition-colors" />
                                        <p className="text-xs text-center text-slate-400 break-all line-clamp-2 leading-tight">{att.name}</p>
                                        <p className="text-[9px] text-slate-500 mt-1">{(att.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                )}
                            </a>
                        );
                    })}
                    {(!ticket.attachments || ticket.attachments.length === 0) && (
                        <div className="col-span-full">
                            <p className="text-center text-slate-500 py-8 text-sm">{t('oc.attachments.empty')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ---- Helper Components ----

const Section = ({ title, icon, color, filledBy, filledAt, children }: {
    title: string; icon: React.ReactNode; color: string; filledBy?: string; filledAt?: string; children: React.ReactNode;
}) => {
    const { t } = useTranslation();
    const colorMap: Record<string, string> = {
        amber: 'border-amber-500/30 from-amber-500/5',
        yellow: 'border-yellow-500/30 from-yellow-500/5',
        purple: 'border-purple-500/30 from-purple-500/5',
        cyan: 'border-cyan-500/30 from-cyan-500/5',
    };
    const iconColorMap: Record<string, string> = {
        amber: 'text-amber-400 bg-amber-500/15',
        yellow: 'text-yellow-400 bg-yellow-500/15',
        purple: 'text-purple-400 bg-purple-500/15',
        cyan: 'text-cyan-400 bg-cyan-500/15',
    };

    return (
        <div className={`bg-gradient-to-br ${colorMap[color]} to-transparent border rounded-xl overflow-hidden`}>
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColorMap[color]}`}>{icon}</span>
                        <h3 className="text-sm font-bold text-white">{title}</h3>
                    </div>
                    {filledBy && (
                        <span className="text-[10px] text-slate-500">
                            {filledBy} · {filledAt ? formatDate(filledAt) : ''}
                        </span>
                    )}
                </div>
                <div className="space-y-2">{children}</div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value, multiline, valueClass, dir }: {
    label: string; value: any; multiline?: boolean; valueClass?: string; dir?: string;
}) => {
    if (!value && value !== 0) return null;
    return (
        <div className={multiline ? 'space-y-0.5' : 'flex items-start justify-between gap-4'}>
            <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
            <span className={`text-xs ${valueClass || 'text-white'} ${multiline ? 'block mt-0.5 bg-slate-800/50 rounded-lg p-2 whitespace-pre-wrap' : 'text-right'}`} dir={dir}>
                {value}
            </span>
        </div>
    );
};

export default OCTicketDetail;
