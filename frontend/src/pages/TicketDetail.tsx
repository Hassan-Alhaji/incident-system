import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatDate';
import {
    ArrowLeft, MapPin, Clock, AlertTriangle, CheckCircle, Send, Loader2,
    User, ShieldCheck, FileText, XCircle, ChevronDown, ExternalLink,
    Search, Paperclip, MessageSquare, CornerDownRight, Save, Download
, ShieldAlert, Check } from 'lucide-react';

const resolveAttachmentUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanUrl = url.replace(/\\/g, '/');
    const apiBase = api.defaults.baseURL || '';
    const rootUrl = apiBase.replace(/\/api\/?$/, '');
    return `${rootUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
};

const statusSteps = [
    { key: 'HSE_REVIEW', icon: <Clock size={14} /> },
    { key: 'PENDING_DEP_REP', icon: <Search size={14} /> },
    { key: 'UNDER_INVESTIGATION', icon: <FileText size={14} /> },
    { key: 'ESCALATED_TO_DEP_MANAGER', icon: <User size={14} /> },
    { key: 'FINAL_REVIEW', icon: <ShieldCheck size={14} /> },
    { key: 'CLOSED', icon: <CheckCircle size={14} /> },
];

const statusOrder = ['OPEN', 'HSE_REVIEW', 'PENDING_DEP_REP', 'DEP_REP_RESPONDED', 'UNDER_INVESTIGATION', 'ESCALATED_TO_DEP_MANAGER', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'];

const TicketDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [controllerAction, setControllerAction] = useState('ROUTE_DEP_REP');
    const [controllerNotes, setControllerNotes] = useState('');
    const [riskLikelihood, setRiskLikelihood] = useState(3);
    const [riskConsequence, setRiskConsequence] = useState(3);
    const [severityLevel, setSeverityLevel] = useState('MEDIUM');
    const [isLTI, setIsLTI] = useState(false);
    const [isMaterialDamage, setIsMaterialDamage] = useState(false);
    const [isRegulatoryReportable, setIsRegulatoryReportable] = useState(false);
    const [isNearMiss, setIsNearMiss] = useState(false);
    const [isNoneOfTheAbove, setIsNoneOfTheAbove] = useState(false);
    
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'attachments'>('details');
    const [confirmAction, setConfirmAction] = useState<{action: string, handler: () => void} | null>(null); // Fix #6

    // Target fields
    const [targetDepManagerId, setTargetDepManagerId] = useState('');
    const [targetDepartmentId, setTargetDepartmentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [routeUsers, setRouteUsers] = useState<any[]>([]);

    // Investigator fields
    const [immediateCauses, setImmediateCauses] = useState('');
    const [underlyingCauses, setUnderlyingCauses] = useState('');
    const [rootCauses, setRootCauses] = useState('');
    const [analysisMethod, setAnalysisMethod] = useState('');
    const [preventiveActions, setPreventiveActions] = useState('');
    const [investigatorReturnReason, setInvestigatorReturnReason] = useState('');
    const [isRepResponseClear, setIsRepResponseClear] = useState<boolean | null>(null);

    // HSE Manager fields
    const [finalNotes, setFinalNotes] = useState('');

    const fetchTicket = async () => {
        try {
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
            // Pre-fill supervisor fields if already filled
            const oc = res.data.offCircuitReport;
            if (oc) {
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

    useEffect(() => { 
        fetchTicket(); 
        api.get('/users').then(res => setRouteUsers(res.data.users || res.data)).catch(console.error);
        api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);
    }, [id]);

    const handleSubmitInvestigation = async (actionParam: string) => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/tickets/${id}/investigation`, {
                action: actionParam,
                immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, targetDepManagerId,
                returnReason: investigatorReturnReason
            });
            if (actionParam === 'CLOSE_TICKET') {
                alert(t('oc.messages.ticketClosed', 'Ticket has been closed successfully! (تم إغلاق التذكرة بنجاح)'));
            }
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Submission failed');
        } finally {
            setActionLoading(false);
            setConfirmAction(null);
        }
    };

    
    const handleInitializeRouteAction = (actionParam: string) => {
        if (!controllerNotes) {
            setError(t('oc.errors.reqNotes', 'Please enter your notes before proceeding. (يجب إدخال الملاحظات)'));
            return;
        }
        const isClassificationSelected = isLTI || isMaterialDamage || isNearMiss || isRegulatoryReportable || isNoneOfTheAbove;
        if (!isClassificationSelected) {
            setError(t('oc.errors.reqClassification', 'Please select at least one Classification or None of the above. (يجب اختيار تصنيف للحالة)'));
            return;
        }
        if (actionParam === 'ROUTE_DEP_REP' && !targetDepartmentId) {
            setError(t('oc.errors.reqDestination', 'Please select a Target Destination from the dropdown. (يجب تحديد الجهة الموجه إليها)'));
            return;
        }
        setError('');
        setConfirmAction({ action: actionParam, handler: () => handleControllerAction(actionParam) });
    };

    const handleControllerAction = async (actionParam: string) => {
        setActionLoading(true);
        try {
            const computedScore = Number(riskLikelihood) * Number(riskConsequence);
            let computedSeverity = 'MINOR';
            let computedLevel = 'LOW';
            if (computedScore >= 5) { computedSeverity = 'MEDIUM'; computedLevel = 'MEDIUM'; }
            if (computedScore >= 10) { computedSeverity = 'HIGH'; computedLevel = 'HIGH'; }
            if (computedScore >= 20) { computedSeverity = 'CRITICAL'; computedLevel = 'CRITICAL'; }

            await api.put(`/tickets/${ticket.id}/hse-action`, {
                action: actionParam,
                targetDepartmentId: actionParam === 'ROUTE_DEP_REP' ? targetDepartmentId : undefined,
                notes: controllerNotes,
                severityLevel: computedSeverity,
                priority: computedSeverity,
                riskLikelihood: Number(riskLikelihood),
                riskConsequence: Number(riskConsequence),
                riskScore: computedScore,
                riskLevel: computedLevel,
                isLTI,
                isMaterialDamage,
                isRegulatoryReportable,
                isNearMiss
            });
            fetchTicket();
            setControllerNotes('');
        } catch (e: any) {
            setError(e.response?.data?.message || 'Error executing action');
        } finally {
            setActionLoading(false);
            setConfirmAction(null);
        }
    };

    const handleDepRepAction = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/tickets/${id}/dep-rep`, {
                immediateCauses, preventiveActions
            });
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Department response failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDepManagerApprove = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/tickets/${id}/dep-manager-approve`, {});
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Department approval failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalDecision = async (decision: 'CLOSE' | 'REJECT') => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(`/tickets/${id}/final-review`, { decision, finalNotes });
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
            <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
    );

    if (!ticket) return (
        <div className="text-center py-20">
            <XCircle className="mx-auto text-red-600 mb-3" size={40} />
            <p className="text-red-600">{error || 'Ticket not found'}</p>
        </div>
    );

    const oc = ticket.offCircuitReport;
    const role = user?.role;
    const currentStepIdx = statusOrder.indexOf(ticket.status);
    const injuredPersons = oc?.injuredPersons ? JSON.parse(oc.injuredPersons) : [];
    const witnessesData = oc?.witnesses ? JSON.parse(oc.witnesses) : [];

    // Role checks
    const isInvestigator = role === 'OC_SAFETY_INVESTIGATOR' || role === 'HSE_CONTROLLER' || role === 'ADMIN';
    const isHSEManager = role === 'OC_HSE_MANAGER' || role === 'ADMIN';
    const isReporter = role === 'OC_REPORTER' || role === 'ADMIN';
    const isHSEController = role === 'HSE_CONTROLLER' || role === 'OC_SUPERVISOR' || role === 'OC_HSE_MANAGER' || role === 'ADMIN';
    const isDepRep = role === 'DEP_REP' || role === 'ADMIN';
    const isDepManager = role === 'DEP_MANAGER' || role === 'ADMIN';

    // Can edit checks
    const canInvestigatorEdit = isInvestigator && (ticket.status === 'UNDER_INVESTIGATION' || ticket.status === 'DEP_REP_RESPONDED');
    const canHSEEdit = isHSEManager && ticket.status === 'FINAL_REVIEW';
    const canHSEControllerEdit = isHSEController && (ticket.status === 'OPEN' || ticket.status === 'HSE_REVIEW');
    const canDepRepEdit = isDepRep && ticket.status === 'PENDING_DEP_REP';
    const canDepManagerEdit = isDepManager && ticket.status === 'ESCALATED_TO_DEP_MANAGER';

    
    const computedScore = Number(riskLikelihood) * Number(riskConsequence) || 0;
    let computedSeverity = 'LOW';
    if (computedScore >= 5) computedSeverity = 'MEDIUM';
    if (computedScore >= 10) computedSeverity = 'HIGH';
    if (computedScore >= 20) computedSeverity = 'CRITICAL';


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

${ticket.serviceProvider ? `
  <div style="margin-top:16px">
    <div style="background:#f97316;color:white;padding:8px 14px;border-radius:8px;font-weight:700;font-size:13px;margin-bottom:8px">${isAr ? 'شركة المتعاقد' : 'Contractor Company'}</div>
    <div style="border:1px solid #fed7aa;border-radius:8px;padding:12px;background:#fff7ed">
      <table style="width:100%;border-collapse:collapse">
        ${row(isAr ? 'اسم الشركة' : 'Company Name', ticket.serviceProvider.name)}
        ${row(isAr ? 'رقم السجل التجاري' : 'CR Number', ticket.serviceProvider.commercialRegistrationNumber)}
        ${row(isAr ? 'القسم المسؤول' : 'Responsible Dept', ticket.serviceProvider.department?.name || '-')}
      </table>
      ${ticket.serviceProvider.representatives?.length > 0 ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #fed7aa">
          <strong style="color:#ea580c;font-size:11px">${isAr ? 'ممثل الشركة - بيانات التواصل' : 'Company Rep - Contact Info'}</strong>
          ${ticket.serviceProvider.representatives.map((rep: any) => `
            <div style="font-size:12px;padding:6px 0;border-bottom:1px solid #fef3c7">
              <strong>${rep.name}</strong>
              ${rep.email ? ` — <span style="color:#666">${rep.email}</span>` : ''}
              ${rep.mobile ? ` — <span style="color:#666" dir="ltr">${rep.mobile}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  </div>
` : ''}

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
                <button onClick={() => navigate('/dashboard')}
                    className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-gray-900 font-mono" dir="ltr">{ticket.ticketNo}</h1>
                        {ticket.hasInjury && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                                <AlertTriangle size={10} /> {t('oc.injury')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{t(`oc.status.${ticket.status}`)}</p>
                </div>
                {/* PDF Download Button */}
                <button onClick={generatePDFReport}
                    className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
                    title={t('oc.report.download')}>
                    <Download size={18} />
                </button>
            </div>

            {/* Progress Steps */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between">
                    {statusSteps.map((s, i) => {
                        const isCurrent = ticket.status === s.key;
                        const isPast = statusOrder.indexOf(s.key) < currentStepIdx;
                        const isRejected = ticket.status === 'CLOSED_REJECTED' && s.key === 'CLOSED';
                        return (
                            <React.Fragment key={s.key}>
                                <div className={`flex flex-col items-center gap-1 ${isCurrent ? 'text-blue-600' : isPast ? 'text-emerald-600' : 'text-gray-300'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                                        ${isCurrent ? 'border-blue-500 bg-blue-50' : isPast ? 'border-emerald-500 bg-emerald-50' : isRejected ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                                        {isRejected ? <XCircle size={14} className="text-red-400" /> : isPast ? <CheckCircle size={14} /> : s.icon}
                                    </div>
                                    <span className="text-[9px] font-medium text-center leading-tight max-w-[65px]">
                                        {t(`oc.statusShort.${s.key}`)}
                                    </span>
                                </div>
                                {i < statusSteps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 rounded ${isPast ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="text-red-600 flex-shrink-0" size={16} />
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Fix #13: Returned ticket banner */}
            {ticket.status === 'RETURNED_FOR_EDIT' && oc?.supervisorNotes && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex gap-3">
                    <CornerDownRight size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-orange-400 mb-1">{t('oc.returned.title')}</p>
                        <p className="text-xs text-orange-300/80">{oc.supervisorNotes}</p>
                    </div>
                </div>
            )}

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                {(['details', 'timeline', 'attachments'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
                            ${activeTab === tab ? 'bg-white text-blue-600 border border-blue-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
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
                    <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
                        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36} />
                        <h3 className="text-center text-gray-900 font-bold mb-1">{t('oc.confirm.title')}</h3>
                        <p className="text-center text-gray-600 font-medium text-sm mb-4">
                            {confirmAction.action === 'ROUTE_DEP_REP' 
                                ? 'Are you sure you want to route this ticket to the selected destination? (هل أنت متأكد من توجيه التذكرة للجهة المحددة؟)'
                                : ['RETURN_REPORTER', 'RETURN_TO_DEPARTMENT'].includes(confirmAction.action)
                                    ? 'Are you sure you want to return this ticket? (هل أنت متأكد من الإرجاع؟)'
                                    : confirmAction.action === 'CLOSE_TICKET'
                                        ? 'Are you sure you want to strictly CLOSE this ticket? (هل أنت متأكد من إغلاق التذكرة نهائياً؟)'
                                        : 'Are you sure you want to proceed? (هل أنت متأكد؟)'}
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmAction(null)}
                                className="flex-1 bg-gray-100 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all">
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
                                    <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs space-y-1">
                                        <p className="text-gray-900 font-semibold">{p.name} ({p.affiliate})</p>
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
                                    <div key={i} className="text-xs text-gray-700">{w.name} - <span dir="ltr">{w.mobile}</span></div>
                                ))}
                            </div>
                        )}
                        <InfoRow label={t('oc.ownership.preparedBy')} value={ticket.createdBy?.name} />
                    </Section>

                    {/* ===== CONTRACTOR / SERVICE PROVIDER INFO ===== */}
                    {ticket.serviceProvider && (
                        <div className="bg-white border border-orange-300 border-l-[4px] border-l-orange-500 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-orange-600 bg-orange-100">
                                        <AlertTriangle size={14} />
                                    </span>
                                    <h3 className="text-sm font-bold text-gray-900">Contractor Company (شركة المتعاقد)</h3>
                                </div>
                                <div className="space-y-2">
                                    <InfoRow label="Company Name" value={ticket.serviceProvider.name} />
                                    <InfoRow label="CR Number" value={ticket.serviceProvider.commercialRegistrationNumber} />
                                    <InfoRow label="Status" value={
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ticket.serviceProvider.status === 'BLACKLISTED' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {ticket.serviceProvider.status}
                                        </span>
                                    } />
                                    {ticket.serviceProvider.department && (
                                        <InfoRow label="Responsible Dept (القسم المسؤول)" value={`${ticket.serviceProvider.department.name}${ticket.serviceProvider.department.nameAr ? ' / ' + ticket.serviceProvider.department.nameAr : ''}`} />
                                    )}
                                    {ticket.serviceProvider.representatives?.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs font-bold text-orange-400 mb-1">بيانات ممثل الشركة (Contractor Representative Information)</p>
                                            {ticket.serviceProvider.representatives.map((rep: any) => (
                                                <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs mb-1">
                                                    <span className="text-gray-900 font-medium">{rep.name}</span>
                                                    <span className="text-gray-500 ml-2" dir="ltr">{rep.email}</span>
                                                    {rep.mobile && <span className="text-gray-500 ml-2" dir="ltr">{rep.mobile}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    
                    
                    {/* ===== SECTION 2A: HSE Controller Action ===== */}
                    {(isHSEController || oc?.controllerFilledBy || isHSEManager || isInvestigator) && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('OPEN') && (
                        <Section title={t('oc.sections.supervisorReview') || 'HSE Controller Review'} icon={<ShieldAlert size={14} />} color="amber"
                            filledBy={oc?.controllerFilledBy} filledAt={oc?.controllerFilledAt}>
                            {canHSEControllerEdit ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.sections.notes') || 'Notes'} *</label>
                                        <textarea value={controllerNotes} onChange={(e) => setControllerNotes(e.target.value)} rows={3}
                                            placeholder={t('oc.sections.notesPlaceholder') || 'Enter instructions or reasons...'}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[80px] resize-y focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
                                    </div>
                                    
                                    <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-200/60 mt-4 mb-4">
                                        <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                                            <ShieldAlert size={14} />
                                            {t('oc.sections.riskAssessment') || 'Risk Assessment & Classification'}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        {t('oc.wizard.likelihood', 'Likelihood (1-5)')}
                                                    </label>
                                                    <select value={riskLikelihood} onChange={(e) => setRiskLikelihood(Number(e.target.value))}
                                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                                                        <option value={1}>1 - Rare / نادر</option>
                                                        <option value={2}>2 - Unlikely / مستبعد</option>
                                                        <option value={3}>3 - Possible / محتمل</option>
                                                        <option value={4}>4 - Likely / مرجح</option>
                                                        <option value={5}>5 - Almost Certain / شبه مؤكد</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        {t('oc.wizard.consequence', 'Consequence / Severity (1-5)')}
                                                    </label>
                                                    <select value={riskConsequence} onChange={(e) => setRiskConsequence(Number(e.target.value))}
                                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                                                        <option value={1}>1 - Insignificant / لا يذكر</option>
                                                        <option value={2}>2 - Minor / طفيف</option>
                                                        <option value={3}>3 - Moderate / متوسط</option>
                                                        <option value={4}>4 - Major / جسيم</option>
                                                        <option value={5}>5 - Catastrophic / كارثي</option>
                                                    </select>
                                                </div>
                                                
                                                {/* Calculated Fields */}
                                                <div className="bg-amber-100/50 p-3 rounded-lg border border-amber-200">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-semibold text-amber-800">Risk Score:</span>
                                                        <span className="text-sm font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded shadow-sm">{computedScore}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-semibold text-amber-800">Computed Level:</span>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm ${
                                                            computedSeverity === 'CRITICAL' ? 'bg-red-500 text-white' :
                                                            computedSeverity === 'HIGH' ? 'bg-orange-500 text-white' :
                                                            computedSeverity === 'MEDIUM' ? 'bg-amber-400 text-white' :
                                                            'bg-emerald-500 text-white'
                                                        }`}>
                                                            {t('priority.' + computedSeverity, computedSeverity)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            
                                            <div className="flex flex-col gap-2 mt-1">
                                                <div className="text-xs font-bold text-gray-500 mb-1">Select Classification (يجب اختيار تصنيف) *</div>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isLTI ? 'bg-amber-500 border-amber-600' : 'bg-white border-gray-300 group-hover:border-amber-400'}`} onClick={() => { setIsLTI(!isLTI); setIsNoneOfTheAbove(false); }}>
                                                        {isLTI && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">Lost Time Injury (LTI)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isMaterialDamage ? 'bg-amber-500 border-amber-600' : 'bg-white border-gray-300 group-hover:border-amber-400'}`} onClick={() => { setIsMaterialDamage(!isMaterialDamage); setIsNoneOfTheAbove(false); }}>
                                                        {isMaterialDamage && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">Material / Property Damage</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isNearMiss ? 'bg-amber-500 border-amber-600' : 'bg-white border-gray-300 group-hover:border-amber-400'}`} onClick={() => { setIsNearMiss(!isNearMiss); setIsNoneOfTheAbove(false); }}>
                                                        {isNearMiss && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">Near Miss Incident</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isRegulatoryReportable ? 'bg-amber-500 border-amber-600' : 'bg-white border-gray-300 group-hover:border-amber-400'}`} onClick={() => { setIsRegulatoryReportable(!isRegulatoryReportable); setIsNoneOfTheAbove(false); }}>
                                                        {isRegulatoryReportable && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">Regulatory Reportable</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group border-t border-gray-100 pt-2 mt-1">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isNoneOfTheAbove ? 'bg-gray-500 border-gray-600' : 'bg-white border-gray-300 group-hover:border-gray-400'}`} onClick={() => { setIsNoneOfTheAbove(!isNoneOfTheAbove); setIsLTI(false); setIsMaterialDamage(false); setIsNearMiss(false); setIsRegulatoryReportable(false); }}>
                                                        {isNoneOfTheAbove && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">None of the above (لا ينطبق)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 mb-2">
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Route Destination (الجهة الموجه إليها) <span className="text-gray-400 font-normal ml-1">(if routing)</span></label>
                                                <select value={targetDepartmentId} onChange={(e) => setTargetDepartmentId(e.target.value)}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                                                    <option value="">-- Not Routing (لن يتم التوجيه) --</option>
                                                    <option value="HSE_MANAGER">⭐ HSE Manager (مدير السلامة)</option>
                                                    {departments.map((dep: any) => (
                                                        <option key={dep.id} value={dep.id}>
                                                            🏢 {dep.name} {dep.nameAr ? `/ ${dep.nameAr}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-3">
                                        <button onClick={() => handleInitializeRouteAction('RETURN_REPORTER')} disabled={actionLoading || !controllerNotes}
                                            className="w-full md:w-1/3 bg-white border-2 border-red-200 text-red-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-red-50 disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <ArrowLeft size={14} />}
                                            {t('oc.actions.returnToReporter', 'Return to Sender')}
                                        </button>
                                        <button onClick={() => handleInitializeRouteAction('ROUTE_DEP_REP')} disabled={actionLoading || !targetDepartmentId}
                                            className="w-full md:w-2/3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:bg-amber-600 disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                                            {t('oc.actions.routeDepRep', 'Route to Destination')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                oc?.controllerFilledBy && (
                                    <>
                                        <InfoRow label={t('oc.ownership.reviewedBy')} value={oc.controllerFilledBy} />
                                    </>
                                )
                            )}
                        </Section>
                    )}

                    {/* ===== SECTION 3A: Department Representative ===== */}
                    {(isDepRep || isInvestigator || isHSEManager || isHSEController || oc?.depRepFilledBy) && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('PENDING_DEP_REP') && (
                        <Section title={t('oc.sections.departmentResponse') || 'Department Response'} icon={<Search size={14} />} color="blue"
                            filledBy={oc?.depRepFilledBy} filledAt={oc?.depRepFilledAt}>
                            {canDepRepEdit ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.immediateCauses')} *</label>
                                        <textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)} rows={4}
                                            placeholder={t('oc.investigation.immediateCausesPlaceholder')}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.preventiveActions')} *</label>
                                        <textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value)} rows={4}
                                            placeholder={t('oc.investigation.preventiveActionsPlaceholder')}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                    </div>
                                    <button onClick={handleDepRepAction} disabled={actionLoading || !immediateCauses || !preventiveActions}
                                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 text-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                                        {t('oc.sections.sendToSafetyContext') || 'Submit Department Response'}
                                    </button>
                                </div>
                            ) : (
                                oc?.depRepFilledBy ? (
                                    <>
                                        <InfoRow label={t('oc.investigation.immediateCauses')} value={oc.immediateCauses} multiline />
                                        <InfoRow label={t('oc.investigation.preventiveActions')} value={oc.preventiveActions} multiline />
                                        <InfoRow label={t('oc.ownership.reviewedBy')} value={oc.depRepFilledBy} />
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">{t('oc.sections.pendingDepRep') || 'Awaiting Department Representative'}</p>
                                )
                            )}
                        </Section>
                    )}

                    {/* ===== SECTION 3B: Root Cause Analysis (Investigator) ===== */}
                    {(isInvestigator || isHSEManager || isHSEController || oc?.investigatorFilledBy) && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('DEP_REP_RESPONDED') && (
                        <Section title={t('oc.sections.investigation')} icon={<FileText size={14} />} color="purple"
                            filledBy={oc?.investigatorFilledBy} filledAt={oc?.investigatorFilledAt}>
                            {canInvestigatorEdit ? (
                                <div className="space-y-4">
                                    {ticket.status === 'DEP_REP_RESPONDED' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                            <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                                <ShieldAlert size={16} /> 
                                                Is the department's response clear and complete? (هل الرد/البيانات الواردة من القسم واضحة ومكتملة للبدء بالتحليل؟)
                                            </h4>
                                            <div className="flex gap-4 mt-3">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1">
                                                    <input type="radio" name="repClear" checked={isRepResponseClear === true} onChange={() => setIsRepResponseClear(true)} className="text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-sm font-bold text-gray-700">Yes, it is clear (نعم واضحة)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1">
                                                    <input type="radio" name="repClear" checked={isRepResponseClear === false} onChange={() => setIsRepResponseClear(false)} className="text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-sm font-bold text-gray-700">No, return it (لا، غير واضحة)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {isRepResponseClear !== false && (
                                    <>
                                        <div className="grid grid-cols-1 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.wizard.analysisMethod', 'Analysis Method (طريقة التحليل)')} <span className="text-red-500">*</span></label>
                                                <select value={analysisMethod} onChange={(e) => setAnalysisMethod(e.target.value)} disabled={!canInvestigatorEdit}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-50 disabled:text-gray-500">
                                                    <option value="">{t('oc.investigation.selectMethod')}</option>
                                                    <option value="Fish Bone">Fish Bone</option>
                                                    <option value="Tree Analysis">Tree Analysis</option>
                                                    <option value="5 Whys">5 Whys</option>
                                                    <option value="Root Cause Analysis">Root Cause Analysis</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Immediate Causes (الأسباب المباشرة) <span className="text-red-500">*</span></label>
                                                <textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)} rows={3} disabled={!canInvestigatorEdit}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 disabled:bg-gray-50 disabled:text-gray-500" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.underlyingCauses', 'Underlying Causes (الأسباب الكامنة)')} <span className="text-red-500">*</span></label>
                                                <textarea value={underlyingCauses} onChange={(e) => setUnderlyingCauses(e.target.value)} rows={4} disabled={!canInvestigatorEdit}
                                                    placeholder={t('oc.investigation.underlyingCausesPlaceholder')}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 disabled:bg-gray-50 disabled:text-gray-500" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.rootCauses', 'Root Causes (الأسباب الجذرية)')} <span className="text-red-500">*</span></label>
                                                <textarea value={rootCauses} onChange={(e) => setRootCauses(e.target.value)} rows={4} disabled={!canInvestigatorEdit}
                                                    placeholder={t('oc.investigation.rootCausesPlaceholder')}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 disabled:bg-gray-50 disabled:text-gray-500" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Preventive Actions (الإجراءات الوقائية) <span className="text-red-500">*</span></label>
                                                <textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value)} rows={3} disabled={!canInvestigatorEdit}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 disabled:bg-gray-50 disabled:text-gray-500" />
                                            </div>
                                        </div>                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.targetDepManager', 'Select Department Manager for CAPA Approval (تحديد مدير القسم)')} <span className="text-red-500">*</span></label>
                                            <select value={targetDepManagerId} onChange={(e) => setTargetDepManagerId(e.target.value)} disabled={!canInvestigatorEdit}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-50 disabled:text-gray-500">
                                                <option value="">{t('oc.investigation.targetDepManagerPlaceholder', 'Select Manager...')} </option>
                                                {routeUsers.filter(u => ['DEP_MANAGER', 'ADMIN'].includes(u.role)).map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {canInvestigatorEdit && (
                                        <div className="mt-6 pt-4 border-t border-gray-100">
                                            {error && (
                                                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg text-sm font-bold shadow-sm">
                                                    {error}
                                                </div>
                                            )}
                                            <h4 className="text-sm font-bold text-gray-800 mb-3">Investigation Actions (الإجراءات)</h4>
                                            
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                                <p className="text-xs text-amber-700 mb-3"><span className="font-bold">Note:</span> The 5 Incident Analysis fields above MUST be thoroughly completed before attempting to route or close the ticket below.</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_DEP_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_DEP_MANAGER') })} 
                                                        disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod || !targetDepManagerId}
                                                        className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />} Route to Dept Mgr
                                                    </button>
                                                    
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_HSE_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_HSE_MANAGER') })} 
                                                        disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod}
                                                        className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Route to HSE Mgr
                                                    </button>
                                                    
                                                    {user?.canCloseTickets && (
                                                        <button onClick={() => setConfirmAction({ action: 'CLOSE_TICKET', handler: () => handleSubmitInvestigation('CLOSE_TICKET') })} 
                                                            disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod}
                                                            className="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />} Submit & Close
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        )}
                                    </>
                                    )}

                                    {/* The Return Reason Block */}
                                    {isRepResponseClear === false && (
                                        <div className="bg-red-50 p-4 border border-red-200 rounded-xl mt-4 animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-sm font-bold text-red-800 mb-2">🔙 Return to Department (إعادة للقسم) - Reason Required</label>
                                            <p className="text-xs text-red-600 mb-3">Please clarify what is missing or unclear so the department can update their response.</p>
                                            <textarea value={investigatorReturnReason} onChange={(e) => setInvestigatorReturnReason(e.target.value)} rows={3}
                                                placeholder="Enter reason for returning to the department rep..."
                                                className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-3 shadow-inner focus:ring-2 focus:ring-red-500/20 focus:border-red-400" />
                                            <button onClick={() => setConfirmAction({ action: 'RETURN_TO_DEPARTMENT', handler: () => handleSubmitInvestigation('RETURN_TO_DEPARTMENT') })} 
                                                disabled={actionLoading || !investigatorReturnReason}
                                                className="w-full bg-white border-2 border-red-200 text-red-700 font-bold py-3 rounded-xl shadow-sm hover:shadow-md transition-all hover:bg-red-50 disabled:opacity-50 flex justify-center items-center gap-2">
                                                {actionLoading ? <Loader2 className="animate-spin inline mr-2" size={16} /> : <CornerDownRight size={16} />}
                                                Return Ticket to Department Rep
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                oc?.investigatorFilledBy ? (
                                    <>
                                        {oc.analysisMethod && <InfoRow label={t('oc.investigation.analysisMethod')} value={oc.analysisMethod} />}
                                        <InfoRow label={t('oc.investigation.underlyingCauses')} value={oc.underlyingCauses} multiline />
                                        <InfoRow label={t('oc.investigation.rootCauses')} value={oc.rootCauses} multiline />
                                        <InfoRow label={t('oc.ownership.preparedBy') || 'Formal RCA mapped by'} value={oc.investigatorFilledBy} />
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">{t('oc.sections.pendingInvestigation')}</p>
                                )
                            )}
                        </Section>
                    )}

                    {/* ===== SECTION 4A: Department Manager Endorsement ===== */}
                    {(isDepManager || isHSEManager || ticket.status === 'FINAL_REVIEW' || ticket.status === 'CLOSED') && statusOrder.indexOf(ticket.status) >= statusOrder.indexOf('ESCALATED_TO_DEP_MANAGER') && (
                        <Section title={t('oc.sections.depManagerApprove') || 'Department Manager Endorsement'} icon={<User size={14} />} color="emerald"
                            filledBy={ticket.status === 'FINAL_REVIEW' || ticket.status === 'CLOSED' ? 'Department Manager' : undefined}>
                            {canDepManagerEdit ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600">You have been selected to approve the Root Cause Analysis and commit to the Preventive Actions described above.</p>
                                    <button onClick={handleDepManagerApprove} disabled={actionLoading}
                                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 text-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                                        Approve Preventive Actions (CAPA)
                                    </button>
                                </div>
                            ) : (
                                (ticket.status === 'FINAL_REVIEW' || ticket.status === 'CLOSED') ? (
                                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                                        <CheckCircle size={16} /> CAPA Approved & Signed
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Awaiting Department Manager Approval</p>
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
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.hse.finalNotes')}</label>
                                        <textarea value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} rows={4}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[100px] resize-y focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
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
                                    <p className="text-xs text-gray-400 italic">{t('oc.sections.pendingFinalReview')}</p>
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
                        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 flex gap-3 shadow-sm">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-700">
                                {log.actor?.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-gray-900">{log.actor?.name || 'System'}</span>
                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{log.actor?.role?.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-xs text-gray-700">{log.action?.replace(/_/g, ' ')}</p>
                                {log.details && <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>}
                                <p className="text-[10px] text-gray-400 mt-1" dir="ltr">{formatDateTime(log.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                    {(!ticket.activityLogs || ticket.activityLogs.length === 0) && (
                        <p className="text-center text-gray-400 py-8 text-sm">{t('oc.timeline.empty')}</p>
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
                                className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all group relative shadow-sm">
                                {att.type === 'IMAGE' || fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                    <div className="aspect-square bg-gray-50 relative">
                                        <img src={fileUrl} alt={att.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <p className="text-[10px] text-white truncate">{att.name}</p>
                                            <p className="text-[9px] text-blue-300">{(att.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center p-4">
                                        <FileText size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                        <p className="text-xs text-center text-gray-600 break-all line-clamp-2 leading-tight">{att.name}</p>
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
        <div className={`bg-white border border-gray-200 border-l-[4px] ${colorMap[color]} rounded-xl shadow-sm overflow-hidden`}>
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColorMap[color]}`}>{icon}</span>
                        <h3 className="text-sm font-bold text-white">{title}</h3>
                    </div>
                    {filledBy && (
                        <span className="text-[10px] text-gray-400">
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
            <span className="text-xs font-semibold text-gray-500 flex-shrink-0">{label}</span>
            <span className={`text-sm ${valueClass || 'text-gray-900 font-medium'} ${multiline ? 'block mt-1 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap text-gray-800 text-[13px] leading-relaxed' : 'text-right'}`} dir={dir}>
                {value}
            </span>
        </div>
    );
};

export default TicketDetail;
