import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { STATUS_CONFIG } from '../utils/statusConfig';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { resolveAttachmentUrl } from '../utils/resolveAttachmentUrl';
import { safeParseJSON } from '../utils/safeParseJSON';
import { ArrowLeft, AlertTriangle, CheckCircle, Send, Loader2, User, Paperclip, Bell, Download, Lock, ShieldCheck } from 'lucide-react';
import { ActionPlanSection, ReminderSection } from '../components/TicketSections';
import { TimelineTab, ConfirmModal, CloseTicketModal } from '../components/ticket';
import { ControllerSubmittedPanel, HrPanel, DepartmentPanel, ControllerFinalReviewPanel, SafetyManagerPanel } from '../components/ticket/ActionPanels';
import { HazardIcon, HAZARD_CATEGORIES } from '../components/HazardIcons';

import { useToast } from '../components/Toast';
import TicketPrintReport from '../components/TicketPrintReport';


const TicketDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const isRtl = i18n.dir() === 'rtl';

    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'attachments'>('details');
    const [showPrint, setShowPrint] = useState(false);

    // Controller Review
    const [controllerNotes, setControllerNotes] = useState('');
    const [targetDepartmentId, setTargetDepartmentId] = useState('');
    const [severityLevel, setSeverityLevel] = useState('');
    const [newType, setNewType] = useState('');
    const [typeChangeReason, setTypeChangeReason] = useState('');
    const [hazardCategory, setHazardCategory] = useState<string[]>([]);
    const [classificationType, setClassificationType] = useState<'SAFETY' | 'SECURITY'>('SAFETY');
    const [delegateRcaToDept, setDelegateRcaToDept] = useState(false);
    const [reminderDate, setReminderDate] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');

    // RCA fields
    const [rcaCause, setRcaCause] = useState('');
    const [rcaWhy, setRcaWhy] = useState('');
    const [rcaRootCause, setRcaRootCause] = useState('');
    const [rcaCategory, setRcaCategory] = useState('');
    const [rcaPreventiveActions, setRcaPreventiveActions] = useState('');


    // Department Action — per-injured-person GOSI
    interface GosiEntry {
        gosiEmployeeId: string;
        gosiSubmitted: boolean | undefined;
        gosiReportDate: string;
        gosiReportNumber: string;
        gosiNoReason: string;
    }
    const [injuredPersonsGosi, setInjuredPersonsGosi] = useState<GosiEntry[]>([]);
    const [hrNotes, setHrNotes] = useState('');
    const [singleGosiSubmitted, setSingleGosiSubmitted] = useState<boolean | undefined>(undefined);
    const [singleGosiEmployeeId, setSingleGosiEmployeeId] = useState('');
    const [singleGosiReportDate, setSingleGosiReportDate] = useState('');
    const [singleGosiReportNumber, setSingleGosiReportNumber] = useState('');
    const [singleGosiNoReason, setSingleGosiNoReason] = useState('');
    const [notifyHr, setNotifyHr] = useState<boolean | null>(null);  // Controller decision on whether HR / GOSI is required
    const [contractorNotified, setContractorNotified] = useState<boolean | undefined>(undefined);
    const [contractorNotifyDate, setContractorNotifyDate] = useState('');
    const [contractorNoReason, setContractorNoReason] = useState('');

    // Controller Inline Notes Editing
    const [isEditingControllerNotes, setIsEditingControllerNotes] = useState(false);
    const [inlineControllerNotes, setInlineControllerNotes] = useState('');
    const [savingInlineNotes, setSavingInlineNotes] = useState(false);

    const saveInlineControllerNotes = async () => {
        try {
            setSavingInlineNotes(true);
            const res = await api.put(`/tickets/${id}/controller-notes`, { notes: inlineControllerNotes });
            if (res.data) {
                showToast(isRtl ? 'تم تحديث الملاحظات بنجاح' : 'Notes updated successfully', 'success');
                setIsEditingControllerNotes(false);
                setControllerNotes(inlineControllerNotes);
                fetchTicket(true); // refresh to get new notes
            }
        } catch (err: any) {
            showToast(err.response?.data?.message || err.message, 'error');
        } finally {
            setSavingInlineNotes(false);
        }
    };

    // Reporter Reply
    const [replyText, setReplyText] = useState('');

    // Escalation
    const [departments, setDepartments] = useState<any[]>([]);
    const [serviceProviders, setServiceProviders] = useState<any[]>([]);
    const [selectedServiceProviderId, setSelectedServiceProviderId] = useState<string>('');

    // Close modal
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [closeTargetType, setCloseTargetType] = useState<'FINAL_REVIEW' | 'SAFETY_MANAGER' | null>(null);
    const [hrReminderModalOpen, setHrReminderModalOpen] = useState(false);

    // Confirmation dialog
    type ConfirmVariant = 'danger' | 'primary' | 'success' | 'warning';
    const [confirmPending, setConfirmPending] = useState<null | {
        fn: () => void;
        label: string;
        description: string;
        variant: ConfirmVariant;
    }>(null);

    const confirmThen = (fn: () => void, label: string, description: string, variant: ConfirmVariant = 'primary') => {
        setConfirmPending({ fn, label, description, variant });
    };

    const executeConfirmed = async () => {
        if (!confirmPending) return;
        confirmPending.fn();
        setConfirmPending(null);
    };

    const canFetchAdminData = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN', 'OC_SUPERVISOR'].includes(user?.role || '');

    useEffect(() => {
        fetchTicket();
        if (canFetchAdminData) {
            api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);
            api.get('/service-providers').then(res => setServiceProviders(res.data)).catch(console.error);
        }
    }, [id]);

    const fetchTicket = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
            setSeverityLevel(prev => prev || res.data.severityLevel || res.data.offCircuitReport?.severity || '');
            setSelectedServiceProviderId(prev => prev || res.data.serviceProviderId || '');
            const oc = res.data.offCircuitReport;
            if (oc) {
                setControllerNotes(prev => prev || oc.controllerNotes || '');
                setRcaCause(prev => prev || oc.rcaCause || '');
                setRcaWhy(prev => prev || oc.rcaWhy || '');
                setRcaRootCause(prev => prev || oc.rcaRootCause || '');
                setRcaCategory(prev => prev || oc.rcaCategory || '');
                setRcaPreventiveActions(prev => prev || oc.rcaPreventiveActions || '');
                if (oc.classificationType) setClassificationType(oc.classificationType);
                if (oc.rcaDelegatedToDept !== undefined && oc.rcaDelegatedToDept !== null) setDelegateRcaToDept(Boolean(oc.rcaDelegatedToDept));
                if (oc.hazardCategory) {
                    try {
                        const parsed = JSON.parse(oc.hazardCategory);
                        setHazardCategory(prev => prev.length > 0 ? prev : (Array.isArray(parsed) ? parsed : [parsed]));
                    } catch {
                        setHazardCategory(prev => prev.length > 0 ? prev : [oc.hazardCategory]);
                    }
                }
            }
        } catch (error) { console.error('Error fetching ticket', error); navigate('/dashboard'); }
        finally { if (!isBackground) setLoading(false); }
    };

    useEffect(() => {
        if (ticket?.hasInjury && ticket.type !== 'INJURY' && newType !== 'INJURY') {
            setNewType('INJURY');
        }
    }, [ticket]);

    const handleControllerAction = async (action: string) => {
        // For ASSIGN: validate RCA fields client-side if non-OBSERVATION and NOT delegated
        if (action === 'ASSIGN') {
            const effectiveType = newType || ticket?.type;
            const rcaRequired = !['OBSERVATION', 'UNSAFE_CONDITION'].includes(effectiveType);
            if (rcaRequired && !delegateRcaToDept) {
                const countWords = (s: string) => s.trim().split(/\s+/).filter(w => w.length > 0).length;
                const missing = !rcaCause || !rcaWhy || !rcaRootCause || !rcaCategory || !rcaPreventiveActions;
                if (missing) {
                    showToast(isRtl ? 'جميع حقول تحليل السبب الجذري (RCA) الـ 5 مطلوبة، أو يمكنك تفويضها لممثل القسم' : 'All 5 RCA fields are required, or you can delegate RCA to the department', 'warning');
                    return;
                }
                const tooShort = [rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions].some(v => countWords(v) < 10);
                if (tooShort) {
                    showToast(t('ticketDetail.rcaMinWordsToast', 'Each RCA field must contain at least 10 words'), 'warning');
                    return;
                }
            }
            // If there's an injury, controller must confirm whether to notify HR
            if (ticket.hasInjury && notifyHr === null) {
                showToast(isRtl ? 'يحتوي هذا البلاغ على إصابة — يرجى تحديد هل يتطلب رفع تقرير GOSI إلى الموارد البشرية' : 'This report contains an injury — please specify if a GOSI report to HR is required', 'warning');
                return;
            }
        }

        setActionLoading(true);
        try {
            const body: any = {
                action,
                notes: controllerNotes,
                severity: severityLevel,
                targetDepartmentId,
                newType: newType || undefined,
                typeChangeReason,
                classificationType,
                hazardCategory: hazardCategory.length > 0 ? JSON.stringify(hazardCategory) : undefined,
                serviceProviderId: selectedServiceProviderId || undefined,
                delegateRcaToDept: delegateRcaToDept === true,
            };
            if (action === 'ASSIGN') {
                if (!delegateRcaToDept) {
                    body.rcaCause = rcaCause;
                    body.rcaWhy = rcaWhy;
                    body.rcaRootCause = rcaRootCause;
                    body.rcaCategory = rcaCategory;
                    body.rcaPreventiveActions = rcaPreventiveActions;
                }
                if (ticket?.hasInjury) {
                    body.notifyHr = notifyHr === true;
                }
            }
            await api.put(`/tickets/${id}/controller-action`, body);
            await fetchTicket(true);
            setControllerNotes(''); setTypeChangeReason(''); setNewType('');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleHrAction = async () => {
        const ocSafe = ticket?.offCircuitReport || {};
        const injuredPersonsSafe = safeParseJSON(ocSafe.injuredPersons);
        const employees = injuredPersonsSafe.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

        if (employees.length > 0) {
            for (let i = 0; i < employees.length; i++) {
                const g = injuredPersonsGosi[i];
                if (!g?.gosiEmployeeId?.trim()) {
                    showToast(isRtl ? `الرقم الوظيفي مطلوب للمصاب رقم ${i + 1}` : `Employee ID required for person #${i + 1}`, 'warning');
                    return;
                }
                if (g?.gosiSubmitted === undefined) {
                    showToast(isRtl ? `يرجى تحديد هل تم إبلاغ التأمينات (GOSI) للمصاب رقم ${i + 1}` : `Please select GOSI status for person #${i + 1}`, 'warning');
                    return;
                }
                if (g?.gosiSubmitted === true && (!g?.gosiReportDate || !g?.gosiReportNumber?.trim())) {
                    showToast(isRtl ? `تاريخ ورقم بلاغ التأمينات مطلوبان للمصاب رقم ${i + 1}` : `GOSI date and report number required for person #${i + 1}`, 'warning');
                    return;
                }
                if (g?.gosiSubmitted === false && !g?.gosiNoReason?.trim()) {
                    showToast(isRtl ? `سبب عدم التبليغ في التأمينات مطلوب للمصاب رقم ${i + 1}` : `Reason for not reporting required for person #${i + 1}`, 'warning');
                    return;
                }
            }
        } else {
            if (singleGosiSubmitted === undefined) {
                showToast(isRtl ? 'يرجى تحديد هل تم إبلاغ التأمينات الاجتماعية (GOSI) أم لا' : 'Please select whether GOSI was informed', 'warning');
                return;
            }
            if (singleGosiSubmitted === true && (!singleGosiReportDate || !singleGosiReportNumber?.trim())) {
                showToast(isRtl ? 'يرجى إدخال تاريخ ورقم بلاغ التأمينات (GOSI)' : 'Please enter GOSI report date and number', 'warning');
                return;
            }
            if (singleGosiSubmitted === false && !singleGosiNoReason?.trim()) {
                showToast(isRtl ? 'يرجى إدخال سبب عدم التبليغ في التأمينات' : 'Please enter reason for not reporting to GOSI', 'warning');
                return;
            }
        }

        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/hr-action`, { 
                injuredPersonsGosi: employees.length > 0 && injuredPersonsGosi.length > 0 ? injuredPersonsGosi : undefined,
                gosiSubmitted: singleGosiSubmitted,
                gosiEmployeeId: singleGosiEmployeeId || undefined,
                gosiReportDate: singleGosiReportDate || undefined,
                gosiReportNumber: singleGosiReportNumber || undefined,
                gosiNoReason: singleGosiNoReason || undefined,
                hrNotes 
            });
            await fetchTicket(true);
            showToast(t('ticketDetail.gosiUpdatedToast', 'تم حفظ بيانات التأمينات بنجاح'), 'success');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleDepartmentAction = async () => {
        let latestPlans = ticket.actionPlans || [];
        try {
            const freshRes = await api.get(`/tickets/${id}`);
            setTicket(freshRes.data);
            latestPlans = freshRes.data.actionPlans || [];
        } catch { /* use existing state if fetch fails */ }

        if (latestPlans.length === 0) {
            showToast(t('ticketActions.missingActionPlans', 'يجب إدراج خطة عمل واحدة على الأقل قبل إرسال الرد.'), 'warning');
            return;
        }

        const ocSafe = ticket.offCircuitReport || {};
        const rcaNeededFromDept = ocSafe.rcaDelegatedToDept || (ocSafe.rcaRequired && !ocSafe.rcaCompleted);
        if (rcaNeededFromDept) {
            if (!rcaCause?.trim() || !rcaWhy?.trim() || !rcaRootCause?.trim() || !rcaCategory?.trim() || !rcaPreventiveActions?.trim()) {
                showToast(isRtl ? 'جميع حقول تحليل السبب الجذري (RCA) الـ 5 مطلوبة قبل إرسال الرد للمراجعة.' : 'All 5 RCA fields are required before submitting.', 'warning');
                return;
            }
        }

        // Validate per-person GOSI dates
        let minDateStr = '';
        try {
            minDateStr = new Date(ocSafe.incidentDate || ticket.createdAt || Date.now()).toISOString().slice(0, 10);
        } catch (e) { /* ignore */ }

        for (const pg of injuredPersonsGosi) {
            if (pg.gosiSubmitted && pg.gosiReportDate && minDateStr && pg.gosiReportDate < minDateStr) {
                showToast(t('ticketActions.gosiDateError', 'عذراً، يجب أن يكون تاريخ بلاغ التأمينات مساوياً أو بعد تاريخ وقوع الحادث.'), 'warning');
                return;
            }
        }

        setActionLoading(true);
        try {
            const deptBody: any = {
                injuredPersonsGosi: injuredPersonsGosi.length > 0 ? injuredPersonsGosi : undefined,
                contractorNotified, contractorNotifyDate, contractorNoReason
            };
            if (rcaNeededFromDept) {
                deptBody.rcaCause = rcaCause;
                deptBody.rcaWhy = rcaWhy;
                deptBody.rcaRootCause = rcaRootCause;
                deptBody.rcaCategory = rcaCategory;
                deptBody.rcaPreventiveActions = rcaPreventiveActions;
            }
            await api.put(`/tickets/${id}/department-action`, deptBody);
            await fetchTicket(true);
            showToast(isRtl ? 'تم إرسال رد القسم وخطط العمل بنجاح' : 'Department response submitted successfully', 'success');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleFinalReview = async (action: string, closePayload?: { violationType: 'NONE'|'WARNING'|'FINANCIAL'; violationDescription: string; violationAmount: string; serviceProviderId?: string | null }) => {
        setActionLoading(true);
        try {
            const body: any = { action, notes: controllerNotes, reminderDate, reminderMessage };
            if (action === 'CLOSE' && closePayload) {
                body.violationType = closePayload.violationType;
                body.violationDescription = closePayload.violationDescription;
                body.violationAmount = closePayload.violationAmount;
                if (closePayload.serviceProviderId !== undefined) body.serviceProviderId = closePayload.serviceProviderId;
            }
            await api.put(`/tickets/${id}/controller-review`, body);
            await fetchTicket(true);
            setControllerNotes(''); setReminderDate(''); setReminderMessage('');
            setCloseModalOpen(false); setCloseTargetType(null);
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleSafetyManagerAction = async (action: string, closePayload?: { violationType: 'NONE'|'WARNING'|'FINANCIAL'; violationDescription: string; violationAmount: string; serviceProviderId?: string | null }) => {
        setActionLoading(true);
        try {
            const body: any = { action, notes: controllerNotes };
            if (action === 'ESCALATE_DEPT') {
                body.targetDepartmentId = targetDepartmentId;
            }
            if (action === 'CLOSE' && closePayload) {
                body.violationType = closePayload.violationType;
                body.violationDescription = closePayload.violationDescription;
                body.violationAmount = closePayload.violationAmount;
                if (closePayload.serviceProviderId !== undefined) body.serviceProviderId = closePayload.serviceProviderId;
            }
            await api.put(`/tickets/${id}/safety-manager`, body);
            await fetchTicket(true);
            setControllerNotes('');
            if (action === 'ESCALATE_DEPT') setTargetDepartmentId('');
            setCloseModalOpen(false); setCloseTargetType(null);
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleConfirmClose = (payload: { violationType: 'NONE'|'WARNING'|'FINANCIAL'; violationDescription: string; violationAmount: string; serviceProviderId?: string | null }) => {
        if (closeTargetType === 'SAFETY_MANAGER') {
            handleSafetyManagerAction('CLOSE', payload);
        } else {
            handleFinalReview('CLOSE', payload);
        }
    };

    const handleRemindHr = async () => {
        setActionLoading(true);
        try {
            const endpoint = closeTargetType === 'SAFETY_MANAGER' 
                ? `/tickets/${id}/safety-manager` 
                : `/tickets/${id}/controller-review`;
            await api.put(endpoint, { action: 'REMIND_HR', notes: controllerNotes });
            await fetchTicket(true);
            setHrReminderModalOpen(false);
            setCloseTargetType(null);
            showToast(t('ticketDetail.hrRemindedSuccess', 'HR has been reminded successfully'), 'success');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const ocSafe = ticket?.offCircuitReport || {};
    const injuredPersonsSafe = safeParseJSON(ocSafe?.injuredPersons);
    const employeeInjuries = injuredPersonsSafe.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
    const hasEmployeeInjury = employeeInjuries.length > 0;
    // HR is considered incomplete if it hasn't been filled at all OR if any employee injury is missing the gosiSubmitted status
    const hrIncomplete = hasEmployeeInjury && (!ocSafe.hrFilledBy || employeeInjuries.some((p: any) => p.gosiSubmitted === undefined));

    const handleStandaloneRemindHr = async (targetType: 'FINAL_REVIEW' | 'SAFETY_MANAGER') => {
        setActionLoading(true);
        try {
            const endpoint = targetType === 'SAFETY_MANAGER' 
                ? `/tickets/${id}/safety-manager` 
                : `/tickets/${id}/controller-review`;
            await api.put(endpoint, { action: 'REMIND_HR', notes: controllerNotes });
            await fetchTicket(true);
            showToast(t('ticketDetail.hrRemindedSuccess', 'HR has been reminded successfully'), 'success');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleCloseRequest = (targetType: 'FINAL_REVIEW' | 'SAFETY_MANAGER') => {
        if (hrIncomplete) {
            setCloseTargetType(targetType);
            setHrReminderModalOpen(true);
        } else {
            setCloseTargetType(targetType);
            setCloseModalOpen(true);
        }
    };

    const handleExport = () => {
        setShowPrint(true);
        // Print is auto-triggered by TicketPrintReport once QR + images
        // are preloaded as data URLs (works online & in printed PDFs).
    };

    const handleReporterReply = async () => {
        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/reporter-reply`, { replyText });
            await fetchTicket(true);
            setReplyText('');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    useEffect(() => {
        if (!ticket) return;
        const ocSafe = ticket.offCircuitReport || {};
        const injuredPersonsSafe = safeParseJSON(ocSafe.injuredPersons);
        const employeeInjuredList = injuredPersonsSafe.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
        const hasEmployeeInjurySafe = employeeInjuredList.length > 0;

        if (ocSafe.hrNotes && !hrNotes) setHrNotes(ocSafe.hrNotes);

        // Initialize per-person GOSI state from existing data
        if (hasEmployeeInjurySafe && injuredPersonsGosi.length === 0) {
            setInjuredPersonsGosi(employeeInjuredList.map((p: any) => ({
                gosiEmployeeId: p.gosiEmployeeId || '',
                gosiSubmitted: p.gosiSubmitted !== undefined ? p.gosiSubmitted : undefined,
                gosiReportDate: p.gosiReportDate ? new Date(p.gosiReportDate).toISOString().slice(0, 10) : '',
                gosiReportNumber: p.gosiReportNumber || '',
                gosiNoReason: p.gosiNoReason || '',
            })));
        }

        // Initialize single GOSI state for general injury
        if (ocSafe.gosiSubmitted !== null && ocSafe.gosiSubmitted !== undefined && singleGosiSubmitted === undefined) {
            setSingleGosiSubmitted(ocSafe.gosiSubmitted);
        }
        if (ocSafe.gosiEmployeeId && !singleGosiEmployeeId) setSingleGosiEmployeeId(ocSafe.gosiEmployeeId);
        if (ocSafe.gosiReportDate && !singleGosiReportDate) setSingleGosiReportDate(new Date(ocSafe.gosiReportDate).toISOString().slice(0, 10));
        if (ocSafe.gosiReportNumber && !singleGosiReportNumber) setSingleGosiReportNumber(ocSafe.gosiReportNumber);
        if (ocSafe.gosiNoReason && !singleGosiNoReason) setSingleGosiNoReason(ocSafe.gosiNoReason);
    }, [ticket]);



    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    if (!ticket) return null;

    const oc = ticket.offCircuitReport || {};
    const role = user?.role || '';
    const isController = ['HSE_CONTROLLER', 'ADMIN', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
    const isSafetyManager = ['SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
    const isDepRep = ['DEP_REP', 'DEP_MANAGER'].includes(role);
    const isHrRep = role === 'HR_REP';
    const isReporter = role === 'OC_REPORTER' && ticket.createdById === user?.id;
    const isTicketOwner = ticket.createdById === user?.id;

    const injuredPersons = safeParseJSON(oc.injuredPersons);
    const hasContractorInjury = injuredPersons.some((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
    const isFinanceRep = role === 'FINANCE_REP';

    // ── FINANCE REP: Dedicated read-only view ──
    if (isFinanceRep) {
        return (
            <div className="max-w-3xl mx-auto space-y-4 pb-8">
                {/* Header */}
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 border rounded-lg hover:bg-gray-50 transition"><ArrowLeft size={18} /></button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">{ticket.ticketNo}</h1>
                            <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700">
                                {isRtl ? 'مخالفة مالية' : 'Financial Violation'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{t(`oc.incidentTypes.${ticket.type}`, ticket.type) as string} • {formatDate(ticket.closedAt || ticket.createdAt)}</p>
                    </div>
                </div>

                {/* Violation Details */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50/40 border border-red-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="font-black text-red-800 flex items-center gap-2 text-base border-b border-red-200 pb-3">
                        ⚠️ {isRtl ? 'تفاصيل المخالفة' : 'Violation Details'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white border border-red-100 rounded-lg p-3">
                            <span className="text-red-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'نوع المخالفة' : 'Violation Type'}</span>
                            <span className="font-black text-red-900 text-lg">{isRtl ? 'مالية' : 'Financial'}</span>
                        </div>
                        {ticket.violationAmount && (
                            <div className="bg-white border border-red-100 rounded-lg p-3">
                                <span className="text-red-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'المبلغ' : 'Amount'}</span>
                                <span className="font-black text-red-900 text-lg" dir="ltr">{Number(ticket.violationAmount).toLocaleString()} SAR</span>
                            </div>
                        )}
                        <div className="col-span-1 sm:col-span-2 bg-white border border-red-100 rounded-lg p-3">
                            <span className="text-red-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'وصف المخالفة' : 'Violation Description'}</span>
                            <p className="text-sm text-red-900 whitespace-pre-wrap leading-relaxed">{ticket.violationDescription || '—'}</p>
                        </div>
                        {ticket.closedBy && (
                            <div className="bg-white border border-red-100 rounded-lg p-3">
                                <span className="text-red-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'أُغلقت بواسطة' : 'Closed By'}</span>
                                <span className="font-bold text-slate-800">{ticket.closedBy}</span>
                            </div>
                        )}
                        {ticket.closedAt && (
                            <div className="bg-white border border-red-100 rounded-lg p-3">
                                <span className="text-red-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'تاريخ الإغلاق' : 'Closed Date'}</span>
                                <span className="font-bold text-slate-800">{formatDateTime(ticket.closedAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Service Provider (Violator) */}
                {ticket.serviceProvider && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50/40 border border-purple-200 rounded-xl p-5 space-y-4 shadow-sm">
                        <h3 className="font-black text-purple-800 flex items-center gap-2 text-base border-b border-purple-200 pb-3">
                            🏗️ {isRtl ? 'بيانات المخالف (مزود الخدمة)' : 'Violator (Service Provider)'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white border border-purple-100 rounded-lg p-3">
                                <span className="text-purple-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'اسم الشركة' : 'Company Name'}</span>
                                <span className="font-bold text-slate-800">{isRtl ? (ticket.serviceProvider.nameAr || ticket.serviceProvider.name) : ticket.serviceProvider.name}</span>
                            </div>
                            {ticket.serviceProvider.commercialRegistrationNumber && (
                                <div className="bg-white border border-purple-100 rounded-lg p-3">
                                    <span className="text-purple-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'السجل التجاري' : 'CR Number'}</span>
                                    <span className="font-mono font-bold text-slate-800" dir="ltr">{ticket.serviceProvider.commercialRegistrationNumber}</span>
                                </div>
                            )}
                            {ticket.serviceProvider.representativeName && (
                                <div className="bg-white border border-purple-100 rounded-lg p-3">
                                    <span className="text-purple-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'اسم الممثل' : 'Representative'}</span>
                                    <span className="font-bold text-slate-800">{ticket.serviceProvider.representativeName}</span>
                                </div>
                            )}
                            {ticket.serviceProvider.representativeMobile && (
                                <div className="bg-white border border-purple-100 rounded-lg p-3">
                                    <span className="text-purple-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'جوال الممثل' : 'Rep Mobile'}</span>
                                    <a href={`tel:${ticket.serviceProvider.representativeMobile}`} className="font-mono font-bold text-blue-600 hover:underline" dir="ltr">{ticket.serviceProvider.representativeMobile}</a>
                                </div>
                            )}
                            {ticket.serviceProvider.representativeEmail && (
                                <div className="col-span-1 sm:col-span-2 bg-white border border-purple-100 rounded-lg p-3">
                                    <span className="text-purple-600 block text-[11px] font-bold uppercase tracking-wide mb-1">{isRtl ? 'بريد الممثل' : 'Rep Email'}</span>
                                    <a href={`mailto:${ticket.serviceProvider.representativeEmail}`} className="font-bold text-blue-600 hover:underline" dir="ltr">{ticket.serviceProvider.representativeEmail}</a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Responsible Department */}
                {(ticket.department || ticket.serviceProvider?.department) && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-black text-indigo-800 flex items-center gap-2 text-base border-b border-indigo-200 pb-3">
                            🏢 {isRtl ? 'القسم المسؤول عن مزود الخدمة' : 'Responsible Department'}
                        </h3>
                        <div className="mt-3 bg-white border border-indigo-100 rounded-lg p-4">
                            <span className="font-bold text-lg text-slate-800">
                                {(() => {
                                    const dept = ticket.serviceProvider?.department || ticket.department;
                                    return isRtl ? (dept?.nameAr || dept?.name || '—') : (dept?.name || '—');
                                })()}
                            </span>
                        </div>
                    </div>
                )}

                {/* No service provider warning */}
                {!ticket.serviceProvider && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
                        <p className="text-sm text-amber-800 font-medium">
                            {isRtl ? 'لم يتم ربط مزود خدمة بهذه التذكرة.' : 'No service provider is linked to this ticket.'}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    const renderEmployeeInjuries = () => {
        if (!hasEmployeeInjury) return null;
        const employees = injuredPersons.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
        if (employees.length === 0) return null;

        return (
            <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm sm:text-base">
                        <span>🏥</span>
                        <span>{isRtl ? `بيانات المصابين (الموظفين) - ${employees.length}` : `Injured Employees Data (${employees.length})`}</span>
                    </h3>
                    <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
                        {isRtl ? 'موظفي الشركة' : 'Company Employees'}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employees.map((p: any, i: number) => {
                        const hasGosiInfo = p.gosiEmployeeId || p.gosiSubmitted !== undefined;
                        return (
                            <div key={i} className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
                                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/70">
                                    <div className="w-6 h-6 bg-blue-600 rounded-md text-white text-xs flex items-center justify-center font-black flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-slate-800 truncate">
                                            {p.name || (isRtl ? `موظف مصاب #${i + 1}` : `Injured Employee #${i + 1}`)}
                                        </p>
                                        {p.mobile && <p className="text-[11px] text-slate-500 font-mono" dir="ltr">{p.mobile}</p>}
                                    </div>
                                    {p.dept && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold flex-shrink-0">
                                            {p.dept}
                                        </span>
                                    )}
                                </div>

                                {hasGosiInfo ? (
                                    <div className="text-xs space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200/80">
                                        {p.gosiEmployeeId && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">{t('oc.wizard.employeeId', 'Employee ID')}:</span>
                                                <span className="font-bold text-slate-800 font-mono" dir="ltr">{p.gosiEmployeeId}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">{t('ticketActions.gosiSubmitted', 'GOSI Status')}:</span>
                                            {p.gosiSubmitted ? (
                                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                                    ✓ {isRtl ? 'تم التبليغ لدى التأمينات' : 'GOSI Reported'}
                                                </span>
                                            ) : (
                                                <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                                                    ✕ {isRtl ? 'لم يتم التبليغ' : 'Not Reported to GOSI'}
                                                </span>
                                            )}
                                        </div>
                                        {p.gosiSubmitted ? (
                                            <>
                                                {p.gosiReportDate && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">{t('oc.wizard.incidentDate', 'Report Date')}:</span>
                                                        <strong className="text-slate-800">{formatDate(p.gosiReportDate)}</strong>
                                                    </div>
                                                )}
                                                {p.gosiReportNumber && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">{t('ticketActions.gosiNo', 'GOSI No.')}:</span>
                                                        <strong className="text-slate-800 font-mono" dir="ltr">{p.gosiReportNumber}</strong>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            p.gosiNoReason && (
                                                <div className="text-red-700 pt-1 border-t border-red-100">
                                                    <span className="text-slate-500 block mb-0.5">{t('ticketActions.reason', 'Reason')}:</span>
                                                    <p className="font-semibold text-[11px]">{p.gosiNoReason}</p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-1.5 px-2 bg-slate-100/70 rounded-lg text-[11px] text-slate-500">
                                        {ocSafe.hrAssignedAt 
                                            ? (isRtl ? '⏳ بانتظار استكمال بيانات التأمينات من قِبل HR' : '⏳ Pending GOSI details from HR')
                                            : (isRtl ? 'ℹ️ لا يتطلب تقرير تأمينات (GOSI)' : 'ℹ️ GOSI report not required')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContractorAndOtherInjuries = () => {
        return (
            <>
                {/* Combined Service Provider / Contractor Section */}
                {(ticket.serviceProvider || hasContractorInjury) && (
                    <div className="bg-purple-50/40 border border-purple-200 rounded-xl p-4 space-y-4 mb-4">
                        <h3 className="font-bold text-purple-800 flex items-center gap-2 border-b border-purple-200 pb-2">
                            🏗️ {isRtl ? 'بيانات مزود الخدمة والمقاولين' : 'Service Provider & Contractor Details'}
                        </h3>

                        {ticket.serviceProvider && (
                            <div className="bg-white border border-purple-100 rounded-xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-3">
                                    🏢 {isRtl ? 'الشركة / مزود الخدمة' : 'Company / Service Provider'}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'اسم المورد' : 'Provider Name'}</span>
                                        <span className="font-bold text-slate-800">{isRtl ? (ticket.serviceProvider.nameAr || ticket.serviceProvider.name) : ticket.serviceProvider.name}</span>
                                    </div>
                                    {ticket.serviceProvider.commercialRegistrationNumber && (
                                        <div>
                                            <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'السجل التجاري' : 'CR Number'}</span>
                                            <span className="font-mono font-bold text-slate-800">{ticket.serviceProvider.commercialRegistrationNumber}</span>
                                        </div>
                                    )}
                                    {ticket.serviceProvider.department && (
                                        <div>
                                            <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'القسم المسؤول' : 'Responsible Department'}</span>
                                            <span className="font-bold text-slate-800">{isRtl ? (ticket.serviceProvider.department.nameAr || ticket.serviceProvider.department.name) : ticket.serviceProvider.department.name}</span>
                                        </div>
                                    )}
                                    {ticket.serviceProvider.representativeName && (
                                        <div>
                                            <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'اسم الممثل' : 'Representative'}</span>
                                            <span className="font-bold text-slate-800">{ticket.serviceProvider.representativeName}</span>
                                        </div>
                                    )}
                                    {ticket.serviceProvider.representativeMobile && (
                                        <div>
                                            <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'جوال الممثل' : 'Rep Mobile'}</span>
                                            <span className="font-mono font-bold text-slate-800" dir="ltr">{ticket.serviceProvider.representativeMobile}</span>
                                        </div>
                                    )}
                                    {ticket.serviceProvider.representativeEmail && (
                                        <div className="col-span-1 md:col-span-2">
                                            <span className="text-purple-700 block mb-1 font-semibold">{isRtl ? 'بريد الممثل' : 'Rep Email'}</span>
                                            <span className="font-bold text-slate-800" dir="ltr">{ticket.serviceProvider.representativeEmail}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {hasContractorInjury && (() => {
                            const contractors = injuredPersons.filter((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
                            const isEditable = isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status);
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-purple-800">{t('ticketActions.contractor', 'Contractor Injuries')} ({contractors.length})</p>
                                        {isEditable && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{isRtl ? 'إلزامي' : 'Required'}</span>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {contractors.map((p: any, i: number) => (
                                            <div key={i} className="bg-white border border-purple-200 rounded-xl p-3 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center font-black">{i + 1}</div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{p.name || (isRtl ? `مصاب #${i + 1}` : `Injured #${i + 1}`)}</p>
                                                        {p.mobile && <p className="text-[11px] text-slate-500" dir="ltr">{p.mobile}</p>}
                                                    </div>
                                                    {p.company && <span className="ltr:ml-auto rtl:mr-auto text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-md font-bold truncate max-w-[120px]">{p.company}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Company Notification Form */}
                                    {isEditable ? (
                                        <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                                <input type="checkbox" checked={contractorNotified === true} onChange={e => setContractorNotified(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                                                <span className="text-sm font-bold text-slate-700">{t('ticketActions.companyNotified', 'Was the contractor company notified?')}</span>
                                            </label>
                                            {contractorNotified === true && (
                                                <div className="pt-3 border-t border-blue-100 mt-2">
                                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ticketActions.reportDate', 'Date of notification')} <span className="text-red-500">*</span></label>
                                                    <input type="date" value={contractorNotifyDate} onChange={e => setContractorNotifyDate(e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-2 rounded-lg text-sm" />
                                                </div>
                                            )}
                                            {contractorNotified === false && (
                                                <div className="pt-3 border-t border-blue-100 mt-2">
                                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ticketActions.reason', 'Reason')} <span className="text-red-500">*</span></label>
                                                    <input placeholder={t('ticketActions.reasonPlaceholder', 'Reason...')} value={contractorNoReason} onChange={e => setContractorNoReason(e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-2 rounded-lg text-sm" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {oc.contractorNotified !== null && oc.contractorNotified !== undefined && (
                                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-sm space-y-2 mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500 font-medium">{t('ticketActions.companyNotified', 'Company Notified?')}:</span> 
                                                        {oc.contractorNotified ? <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> {t('common.yes', 'Yes')}</span> : <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14}/> {t('common.no', 'No')}</span>}
                                                    </div>
                                                    {oc.contractorNotified ? (
                                                        <div className="flex items-center gap-2"><span className="text-slate-500 font-medium">{t('oc.wizard.incidentDate', 'Date')}:</span> <strong className="text-slate-800">{formatDate(oc.contractorNotifyDate)}</strong></div>
                                                    ) : (
                                                        <div className="flex items-start gap-2"><span className="text-slate-500 font-medium">{t('ticketActions.reason', 'Reason')}:</span> <strong className="text-red-600">{oc.contractorNoReason}</strong></div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* OTHER type injured persons — always show */}
                {injuredPersons.filter((p: any) => p.type === 'OTHER').length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-2">
                            👥 {isRtl ? `أخرى (${injuredPersons.filter((p: any) => p.type === 'OTHER').length})` : `Other (${injuredPersons.filter((p: any) => p.type === 'OTHER').length})`}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {injuredPersons.filter((p: any) => p.type === 'OTHER').map((p: any, i: number) => (
                                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                                    <p className="text-sm font-bold text-slate-800">{p.name || `#${i + 1}`}</p>
                                    {p.mobile && <p className="text-[11px] text-slate-500" dir="ltr">{p.mobile}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (

        <>
        <div className="max-w-5xl mx-auto space-y-4 pb-8">
            {/* Header */}
            <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 border rounded-lg hover:bg-gray-50 transition"><ArrowLeft size={18} /></button>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-bold">{ticket.ticketNo}</h1>
                            {(() => {
                                // Mask internal workflow stages from the reporter
                                const INTERNAL_STATUSES = ['ASSIGNED', 'UNDER_REVIEW', 'RETURNED_TO_DEPARTMENT', 'ESCALATED', 'PENDING_REMINDER'];
                                const maskedStatus = isReporter && INTERNAL_STATUSES.includes(ticket.status) ? 'IN_PROGRESS' : ticket.status;
                                const maskedLabel = maskedStatus === 'IN_PROGRESS'
                                    ? (isRtl ? 'قيد المعالجة' : 'In Progress')
                                    : t(`status.${ticket.status}`, ticket.status) as string;
                                const maskedChip = maskedStatus === 'IN_PROGRESS'
                                    ? 'bg-blue-100 text-blue-700'
                                    : (STATUS_CONFIG[ticket.status]?.chip || 'bg-gray-100');
                                return <span className={`px-2 py-1 rounded-md text-xs font-bold ${maskedChip}`}>{maskedLabel}</span>;
                            })()}
                            {(() => {
                                const r = ticket.reporter || ticket.createdBy;
                                if (!isController || !r || r.name === 'Confidential') return null;
                                return (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[11px] font-bold shadow-sm flex-wrap">
                                    <span>👤 {r.name}</span>
                                    {r.department && <span className="opacity-75 px-1 border-l border-amber-300">{r.department}</span>}
                                    {r.mobile && <span className="opacity-75 px-1 border-l border-amber-300" dir="ltr">{r.mobile}</span>}
                                    {r.email && <span className="opacity-75 px-1 border-l border-amber-300">{r.email}</span>}
                                </div>
                                );
                            })()}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{t(`oc.incidentTypes.${ticket.type}`, ticket.type) as string} • {formatDate(ticket.createdAt)}</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleExport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
                        <Download size={16} /> {t('ticketActions.export', 'Export')}
                    </button>
                </div>
            </div>

            {/* Prominent banner for returned tickets */}
            {isReporter && ticket.status === 'RETURNED_TO_REPORTER' && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">✏️</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-amber-900 text-sm">
                            {isRtl ? 'مطلوب تعديل بلاغك' : 'Your Report Needs Updates'}
                        </h4>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                            {isRtl
                                ? 'تمت إعادة التذكرة إليك من قِبل فريق السلامة. يُرجى مراجعة الملاحظات أدناه وإرسال ردك في قسم "الإجراءات" بالأسفل.'
                                : 'This ticket has been returned to you by the HSE team. Please review the notes below and submit your reply in the "Actions" section at the bottom.'}
                        </p>
                    </div>
                    <ArrowLeft size={18} className="text-amber-400 rtl:rotate-180 animate-bounce flex-shrink-0" />
                </div>
            )}

            {/* Point 11: Department Response KPI Banner */}
            {ticket.departmentAssignedAt && (() => {
                const assignedDate = new Date(ticket.departmentAssignedAt);
                const respondedDate = ticket.departmentRespondedAt ? new Date(ticket.departmentRespondedAt) : null;
                const elapsedMs = respondedDate 
                    ? respondedDate.getTime() - assignedDate.getTime()
                    : Date.now() - assignedDate.getTime();
                const hrs = Math.floor(elapsedMs / 3600000);
                const kpiText = hrs >= 24 ? `${Math.floor(hrs / 24)}d ${hrs % 24}h` : `${hrs}h`;
                const isCompleted = !!respondedDate;
                const kpiColor = isCompleted 
                    ? 'from-emerald-50 to-green-50 border-emerald-300' 
                    : hrs < 24 ? 'from-emerald-50 to-green-50 border-emerald-300' 
                    : hrs < 48 ? 'from-amber-50 to-yellow-50 border-amber-300' 
                    : 'from-red-50 to-rose-50 border-red-300';
                const textColor = isCompleted 
                    ? 'text-emerald-700'
                    : hrs < 24 ? 'text-emerald-700' : hrs < 48 ? 'text-amber-700' : 'text-red-700';
                return (
                    <div className={`bg-gradient-to-r ${kpiColor} border rounded-xl p-3 flex items-center gap-3`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-emerald-100' : hrs < 24 ? 'bg-emerald-100' : hrs < 48 ? 'bg-amber-100' : 'bg-red-100'}`}>
                            <span className="text-lg">{isCompleted ? '✅' : '⏱️'}</span>
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-bold text-xs ${textColor}`}>
                                {isRtl ? (isCompleted ? 'زمن استجابة القسم' : 'في انتظار رد القسم') : (isCompleted ? 'Department Response Time' : 'Awaiting Department Response')}
                            </h4>
                            <p className={`text-sm font-black ${textColor} mt-0.5`}>{kpiText}</p>
                        </div>
                        {isCompleted && <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">{isRtl ? 'تم الرد' : 'Responded'}</span>}
                    </div>
                );
            })()}

            {/* Main Content Tabs */}
            <div className="flex gap-2 border-b">
                <button onClick={() => setActiveTab('details')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t('nav.details', 'Details')}</button>
                {isController && (
                    <button onClick={() => setActiveTab('timeline')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'timeline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t('nav.timeline', 'Timeline')}</button>
                )}
                {!isHrRep && (
                    <button onClick={() => setActiveTab('attachments')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'attachments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>📎 {t('nav.attachments', 'Attachments')} ({ticket.attachments?.length || 0})</button>
                )}
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
                <div className="flex flex-col gap-4">
                    {/* Reporter Info — visible to controllers / HSE managers only */}
                    {isController && ticket.createdBy && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-200 shadow-sm rounded-xl p-4">
                            <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2 mb-3 pb-2 border-b border-indigo-100">
                                👤 {isRtl ? 'بيانات المُبلّغ' : 'Reporter Information'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                <div>
                                    <span className="text-indigo-500 block text-[11px] font-bold uppercase tracking-wide mb-0.5">
                                        {isRtl ? 'الاسم الكامل' : 'Full Name'}
                                    </span>
                                    <span className="font-bold text-slate-800">{ticket.createdBy.name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-indigo-500 block text-[11px] font-bold uppercase tracking-wide mb-0.5">
                                        {isRtl ? 'البريد الإلكتروني' : 'Email'}
                                    </span>
                                    {ticket.createdBy.email
                                        ? <a href={`mailto:${ticket.createdBy.email}`} className="font-semibold text-blue-600 hover:underline break-all" dir="ltr">{ticket.createdBy.email}</a>
                                        : <span className="text-slate-400">—</span>}
                                </div>
                                <div>
                                    <span className="text-indigo-500 block text-[11px] font-bold uppercase tracking-wide mb-0.5">
                                        {isRtl ? 'رقم الجوال' : 'Mobile'}
                                    </span>
                                    {ticket.createdBy.mobile
                                        ? <a href={`tel:${ticket.createdBy.mobile}`} className="font-semibold text-blue-600 hover:underline" dir="ltr">{ticket.createdBy.mobile}</a>
                                        : <span className="text-slate-400">—</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Section: Details */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 shadow-sm shadow-slate-100 rounded-xl p-4 space-y-4">
                            <h3 className="font-bold text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-2">
                                📋 {t('nav.details', 'Incident Details')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-blue-600 block text-xs font-bold">{t('oc.wizard.submissionDate', 'Report Submission Date/Time')}</span>
                                    <span className="font-medium">{formatDate(ticket.createdAt)} {new Date(ticket.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div>
                                    <span className="text-orange-600 block text-xs font-bold">{t('oc.wizard.incidentDate', 'Incident Date/Time')}</span>
                                    <span className="font-medium">{formatDate(oc.incidentDate)} {oc.incidentTime}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-xs">{t('oc.wizard.location', 'Location')}</span>
                                    <span className="font-medium">
                                        {ticket.zone?.name
                                            ? <span className="inline-flex items-center gap-1"><span className="text-blue-600 font-bold">📍 {ticket.zone.name}</span>{ticket.location && ticket.location !== ticket.zone.name ? <span className="text-gray-400 text-xs font-normal">— {ticket.location}</span> : null}</span>
                                            : ticket.location || '-'}
                                    </span>
                                </div>
                                {ticket.event && (
                                    <div>
                                        <span className="text-gray-500 block text-xs">{isRtl ? 'الفعالية' : 'Event'}</span>
                                        <span className="font-medium text-emerald-700">🏁 {isRtl ? (ticket.event.nameAr || ticket.event.nameEn) : ticket.event.nameEn}</span>
                                    </div>
                                )}

                                {oc.detectionSource && (
                                    <div>
                                        <span className="text-gray-500 block text-xs">{isRtl ? 'طريقة / مصدر الاكتشاف' : 'Detection Source'}</span>
                                        <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5 mt-0.5">
                                            {oc.detectionSource === 'INSPECTION' && <span>🔍 {isRtl ? 'تفتيش ميداني (Inspection)' : 'Inspection'}</span>}
                                            {oc.detectionSource === 'AUDIT' && <span>📋 {isRtl ? 'تدقيق (Audit)' : 'Audit'}</span>}
                                            {oc.detectionSource === 'INTERNAL_OBSERVATION' && <span>👁️ {isRtl ? 'ملاحظة داخلية (Internal Observation)' : 'Internal Observation'}</span>}
                                            {oc.detectionSource === 'EXTERNAL_SOURCE' && <span>🌐 {isRtl ? 'مصدر خارجي (External Source)' : 'External Source'}</span>}
                                        </span>
                                    </div>
                                )}
 
                                {!isReporter && ticket.severityLevel && (
                                    <div className="col-span-1 bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded-lg">
                                        <strong className="block text-xs">{t('ticketActions.classification', 'Classification')}:</strong>
                                        <span className="font-bold">{t(`classification.${ticket.severityLevel}`, ticket.severityLevel) as string}</span>
                                    </div>
                                )}
                                {(() => {
                                    const cats: string[] = safeParseJSON(oc?.hazardCategory, []);
                                    if (!cats.length) return null;
                                    return (
                                        <div className="col-span-2 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                                            <strong className="block text-xs text-amber-800 mb-1.5">{t('ticketDetail.hazardCategory', 'Hazard Category')}</strong>
                                            <div className="flex flex-wrap gap-2">
                                                {cats.map((c: string) => {
                                                    const meta = HAZARD_CATEGORIES.find(h => h.value === c);
                                                    const label = isRtl ? (meta?.labelAr || c) : c.replace(' Hazards', '');
                                                    return (
                                                        <div key={c} className="flex flex-col items-center gap-0.5 bg-white border border-amber-200 rounded-lg p-1.5 shadow-sm min-w-[60px]">
                                                            <HazardIcon category={c} className="w-7 h-7" />
                                                            <span className="text-[8px] font-bold text-amber-700 text-center leading-tight">{label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {!isReporter && ticket.department && (
                                    <div className="col-span-1 bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg">
                                        <strong className="block text-xs">{t('ticketActions.routedToDept', 'Routed to Department')}:</strong>
                                        <span className="font-bold">{isRtl && ticket.department.nameAr ? ticket.department.nameAr : ticket.department.name}</span>
                                    </div>
                                )}
                                {oc.reporterDepartmentId && (
                                    <div className="col-span-1 bg-teal-50 border border-teal-200 text-teal-800 p-2 rounded-lg">
                                        <strong className="block text-xs">{isRtl ? 'قسم المُبلِّغ' : 'Reporter Department'}:</strong>
                                        <span className="font-bold">{(() => {
                                            const dept = departments.find((d: any) => d.id === oc.reporterDepartmentId);
                                            if (dept) return isRtl ? (dept.nameAr || dept.name) : dept.name;
                                            return oc.reporterDepartmentId;
                                        })()}</span>
                                    </div>
                                )}
                                {/* Point 11: Time KPI for department response */}
                                {!isReporter && ticket.departmentAssignedAt && (
                                    <div className={`col-span-2 p-2 rounded-lg border ${(() => {
                                        if (ticket.departmentRespondedAt) return 'bg-emerald-50 border-emerald-200 text-emerald-800';
                                        const hoursElapsed = (Date.now() - new Date(ticket.departmentAssignedAt).getTime()) / (1000 * 60 * 60);
                                        if (hoursElapsed > 48) return 'bg-red-50 border-red-200 text-red-800';
                                        if (hoursElapsed > 24) return 'bg-amber-50 border-amber-200 text-amber-800';
                                        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
                                    })()}`}>
                                        <strong className="block text-xs">{isRtl ? '⏱️ وقت استجابة القسم (KPI)' : '⏱️ Department Response Time (KPI)'}:</strong>
                                        <span className="font-bold text-sm">{(() => {
                                            const assignedAt = new Date(ticket.departmentAssignedAt);
                                            const endTime = ticket.departmentRespondedAt ? new Date(ticket.departmentRespondedAt) : new Date();
                                            const diffMs = endTime.getTime() - assignedAt.getTime();
                                            const hours = Math.floor(diffMs / (1000 * 60 * 60));
                                            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                            if (ticket.departmentRespondedAt) {
                                                return `✅ ${isRtl ? 'تم الرد خلال' : 'Responded in'} ${timeStr}`;
                                            }
                                            const indicator = hours >= 48 ? '🔴' : hours >= 24 ? '🟡' : '🟢';
                                            return `${indicator} ${isRtl ? 'منذ الإحالة:' : 'Since assignment:'} ${timeStr}`;
                                        })()}</span>
                                    </div>
                                )}
                                <div className="col-span-2"><span className="text-gray-500 block text-xs">{t('oc.wizard.whatHappened', 'Description')}</span><p className="font-medium mt-1 p-2 bg-gray-50 rounded-lg whitespace-pre-wrap">{ticket.description}</p></div>
                                {oc.isLateReport && <div className="col-span-2 bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg"><strong className="block text-xs">{t('oc.wizard.lateReport', 'Late Report')}:</strong> {oc.lateReportReason}</div>}
                            </div>
                        </div>

                        {/* Injuries & Contractor Details */}
                        {renderEmployeeInjuries()}
                        {renderContractorAndOtherInjuries()}

                        {/* ── Staff-only sections (hidden from reporter to keep their view clean) ── */}
                        {!isReporter && <>


                        {/* Completed RCA - visible when set */}
                        {oc.rcaCompleted && !isHrRep && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 shadow-sm shadow-amber-100 rounded-xl p-4">
                                <h3 className="font-bold text-amber-800 flex items-center gap-2 border-b border-amber-200/70 pb-2 mb-3">
                                    📋 {isRtl ? 'تحليل السبب الجذري (RCA)' : 'Root Cause Analysis (RCA)'}
                                    <span className="text-[10px] text-amber-500 font-normal ltr:ml-auto rtl:mr-auto">{oc.rcaFilledBy} • {formatDate(oc.rcaFilledAt)}</span>
                                </h3>
                                <div className="space-y-3">
                                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-1">{isRtl ? '1. الأسباب المباشرة' : '1. Immediate Causes'}</p>
                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{oc.rcaCause}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-1">{isRtl ? '2. لماذا حدث ذلك؟' : '2. Why did it happen?'}</p>
                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{oc.rcaWhy}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-1">{isRtl ? '3. السبب الجذري' : '3. Root Cause'}</p>
                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{oc.rcaRootCause}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-1">{isRtl ? '4. تصنيف السبب' : '4. Root Cause Category'}</p>
                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{oc.rcaCategory}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-1">{isRtl ? '5. الإجراءات الوقائية المقترحة' : '5. Recommended Preventive Actions'}</p>
                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{oc.rcaPreventiveActions}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {oc.depRepFilledBy && !isHrRep && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4 mb-4">
                                <h3 className="font-bold text-purple-800 flex items-center gap-2 border-b border-purple-200 pb-2">🏢 {t('ticketActions.deptResponse', 'Department Response')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-purple-600 block text-xs">{t('ticketActions.submittedBy', 'Submitted By')}</span><span className="font-bold text-purple-900">{oc.depRepFilledBy}</span></div>
                                    <div><span className="text-purple-600 block text-xs">{t('oc.wizard.incidentDate', 'Date/Time')}</span><span className="font-bold text-purple-900">{formatDate(oc.depRepFilledAt)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* HR Stage Info - visible to all when HR has completed */}
                        {oc.hrFilledBy && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
                                <h3 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-200 pb-2">🏥 {t('ticketDetail.hrResponse')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-3">
                                    <div><span className="text-teal-600 block text-xs">{t('ticketDetail.filledBy')}</span><span className="font-bold text-teal-900">{oc.hrFilledBy}</span></div>
                                    <div><span className="text-teal-600 block text-xs">{t('ticketDetail.filledDate')}</span><span className="font-bold text-teal-900">{formatDate(oc.hrFilledAt)}</span></div>
                                </div>
                                <div className="mt-3 bg-white p-3 rounded-lg border border-teal-100">
                                    <p className="text-xs text-teal-600 font-bold mb-1">{isRtl ? 'ملاحظات الموارد البشرية' : 'HR Notes'}</p>
                                    {oc.hrNotes ? (
                                        <p className="text-sm text-teal-900 whitespace-pre-wrap">{oc.hrNotes}</p>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">{isRtl ? '— لم تُسجَّل ملاحظات إضافية —' : '— No additional notes recorded —'}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* HR Pending notice removed as per request */}
                        {!oc.hrFilledBy && ticket.hasInjury && isHrRep && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4">
                                <p className="text-xs text-teal-700 font-semibold text-center">📋 {t('ticketDetail.completeGosiBelow')}</p>
                            </div>
                        )}

                        {/* ActionPlanSection: dept filling or anyone reviewing */}
                        {!isHrRep && ((isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) || (ticket.actionPlans?.length > 0)) && (
                            <ActionPlanSection ticket={ticket} onRefresh={() => fetchTicket(true)} />
                        )}

                        {/* Controller Notes - always visible when set, placed after action plans as requested */}
                        {!isHrRep && oc.controllerNotes && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200 shadow-sm shadow-blue-100 rounded-xl p-4 mt-4">
                                <div className="flex items-center justify-between border-b border-blue-200/70 pb-2 mb-3">
                                    <h3 className="font-bold text-blue-800 flex items-center gap-2">
                                        🎯 {t('ticketDetail.controllerNotes')}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-blue-400 font-normal hidden sm:block">
                                            {oc.controllerFilledBy} • {formatDate(oc.controllerFilledAt)}
                                        </span>
                                        {isController && ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_REMINDER', 'RETURNED_TO_REPORTER'].includes(ticket.status) && !isEditingControllerNotes && (
                                            <button 
                                                onClick={() => { setInlineControllerNotes(controllerNotes || oc.controllerNotes); setIsEditingControllerNotes(true); }}
                                                className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded font-bold transition-colors"
                                            >
                                                {isRtl ? 'تعديل' : 'Edit'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {isEditingControllerNotes ? (
                                    <div className="space-y-2">
                                        <textarea 
                                            value={inlineControllerNotes} 
                                            onChange={e => setInlineControllerNotes(e.target.value)}
                                            className="w-full text-sm text-blue-900 bg-white rounded-lg p-3 border border-blue-300 focus:ring-2 focus:ring-blue-400 outline-none min-h-[100px]"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setIsEditingControllerNotes(false)}
                                                disabled={savingInlineNotes}
                                                className="text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded font-bold transition-colors"
                                            >
                                                {isRtl ? 'إلغاء' : 'Cancel'}
                                            </button>
                                            <button 
                                                onClick={saveInlineControllerNotes}
                                                disabled={savingInlineNotes || !inlineControllerNotes.trim() || inlineControllerNotes === oc.controllerNotes}
                                                className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {savingInlineNotes ? <Loader2 className="animate-spin" size={14} /> : null}
                                                {isRtl ? 'حفظ التعديلات' : 'Save Notes'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-blue-900 whitespace-pre-wrap bg-white rounded-lg p-3 border border-blue-100">{oc.controllerNotes}</p>
                                )}
                            </div>
                        )}
                        {!isHrRep && <ReminderSection ticket={ticket} onRefresh={() => fetchTicket(true)} />}

                        {/* FINAL CLOSURE DECISION */}
                        {ticket.status === 'CLOSED' && !isHrRep && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4 space-y-3">
                                <h3 className="font-bold text-emerald-800 flex items-center gap-2 border-b border-emerald-200 pb-2">
                                    <CheckCircle size={18} /> {isRtl ? 'قرار إدارة السلامة النهائي' : 'Final HSE Department Decision'}
                                </h3>
                                
                                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                    {ticket.hasFinancialViolation ? (
                                        <div className="mb-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm font-bold border border-red-200">
                                                🚨 {isRtl ? 'مخالفة مالية مقيدة على المقاول' : 'Financial Violation Applied to Vendor'}
                                            </span>
                                            <p className="mt-2 text-sm font-bold text-slate-700">
                                                {isRtl ? 'مبلغ المخالفة:' : 'Violation Amount:'} <span className="text-red-600" dir="ltr">{ticket.violationAmount} SAR</span>
                                            </p>
                                        </div>
                                    ) : ticket.activityLogs?.some((l: any) => l.action === 'STAGE_CLOSED' && l.details?.includes('(Warning Violation)')) ? (
                                        <div className="mb-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-bold border border-orange-200">
                                                ⚠️ {isRtl ? 'توجيه إنذار / تحذير للمقاول' : 'Warning Applied to Vendor'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="mb-2 text-sm font-bold text-emerald-700">
                                            {isRtl ? 'أغلقت بدون مخالفات' : 'Closed without violations'}
                                        </div>
                                    )}
                                    
                                    {(ticket.violationDescription || ticket.closureReason) && (
                                        <div className="mt-3">
                                            <p className="text-xs text-slate-500 font-bold mb-1">{isRtl ? 'التفاصيل / ملاحظات الإغلاق:' : 'Details / Closure Notes:'}</p>
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{ticket.violationDescription || ticket.closureReason}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-medium">
                                    {isRtl ? 'أغلقت بواسطة:' : 'Closed by:'} {ticket.closedBy || 'HSE Controller'} • {formatDate(ticket.closedAt)}
                                </div>
                            </div>
                        )}
                        </>}
                        {/* ── End staff-only sections ── */}
                    </div>

                    {/* Bottom Section: Actions */}
                    <div className="space-y-4">
                        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                            <h3 className="font-bold flex items-center gap-2"><User size={16} /> {t('nav.actions', 'Actions')}</h3>

                            {/* REPORTER REPLY */}
                            {isReporter && ticket.status === 'RETURNED_TO_REPORTER' && (
                                <div className="space-y-2">
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="px-2 pt-2 text-xs font-bold text-gray-500">{t('ticketActions.reply', 'Reply')}</div>
                                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('ticketActions.replyPlaceholder', 'Your reply...')} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[150px]" rows={6} />
                                    </div>
                                    <button onClick={handleReporterReply} disabled={actionLoading} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">{actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} {t('ticketActions.resubmit', 'Resubmit')}</button>
                                </div>
                            )}

                            {/* REPORTER PENDING REMINDER — informational only (DepRep/Controller completes the reminder) */}
                            {isReporter && ticket.status === 'PENDING_REMINDER' && (
                                <div className="space-y-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                    <Bell className="mx-auto text-blue-500 mb-1" size={24} />
                                    <h4 className="font-bold text-blue-800">{t('rem.reporterInfoTitle', 'التذكرة في انتظار تذكير مُجدوَل')}</h4>
                                    <p className="text-xs text-blue-700 leading-relaxed">{t('rem.reporterInfoDesc', 'تم تعليق التذكرة بناءً على تذكير من الكنترولر. سيتم استئناف المتابعة في الموعد المحدد من قبل القسم المختص — لا يلزم منك أي إجراء.')}</p>
                                </div>
                            )}

                            {/* HR_REP: non-injury ticket — informational */}
                            {isHrRep && !ticket.hasInjury && (
                                <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                                    <h4 className="font-bold text-gray-800">{t('hr.noInjuryTitle', 'هذه التذكرة لا تتعلق بإصابة')}</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{t('hr.noInjuryDesc', 'لا يلزم تعبئة بيانات GOSI — للعِلم فقط.')}</p>
                                </div>
                            )}

                            {/* SP_REP: closed ticket — informational */}
                            {role === 'SERVICE_PROVIDER_REP' && ticket.status === 'CLOSED' && (
                                <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                                    <h4 className="font-bold text-gray-800">{t('sp.closedTitle', isRtl ? 'تذكرة مُغلقة' : 'Closed Ticket')}</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{t('sp.closedDesc', isRtl ? 'للعِلم فقط — تم إغلاق هذه التذكرة ولا يمكن تعديلها.' : 'For information only — this ticket has been closed and cannot be modified.')}</p>
                                </div>
                            )}

                            {/* CONTROLLER: ticket returned to department — informational */}
                            {isController && ticket.status === 'RETURNED_TO_DEPARTMENT' && (
                                <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <h4 className="font-bold text-amber-800">{t('ctrl.returnedTitle', isRtl ? 'تم إرجاع التذكرة للقسم' : 'Ticket Returned to Department')}</h4>
                                    <p className="text-xs text-amber-700 leading-relaxed">{t('ctrl.returnedDesc', isRtl ? 'التذكرة بانتظار رد القسم المختص. لا يمكن إغلاقها حتى يكمل القسم المراجعة.' : 'The ticket is pending response from the department. It cannot be closed until the review is complete.')}</p>
                                </div>
                            )}

                            {/* CONTROLLER: SUBMITTED (Initial Review) */}
{isController && ticket.status === 'SUBMITTED' && (
    <ControllerSubmittedPanel 
        isController={isController} 
        ticket={ticket} 
        t={t} 
        isRtl={isRtl} 
        newType={newType} 
        setNewType={setNewType} 
        typeChangeReason={typeChangeReason} 
        setTypeChangeReason={setTypeChangeReason} 
        severityLevel={severityLevel} 
        setSeverityLevel={setSeverityLevel} 
        hazardCategory={hazardCategory} 
        setHazardCategory={setHazardCategory} 
        classificationType={classificationType}
        setClassificationType={setClassificationType}
        delegateRcaToDept={delegateRcaToDept}
        setDelegateRcaToDept={setDelegateRcaToDept}
        controllerNotes={controllerNotes} 
        setControllerNotes={setControllerNotes} 
        rcaCause={rcaCause} 
        setRcaCause={setRcaCause} 
        rcaWhy={rcaWhy} 
        setRcaWhy={setRcaWhy} 
        rcaRootCause={rcaRootCause} 
        setRcaRootCause={setRcaRootCause} 
        rcaCategory={rcaCategory} 
        setRcaCategory={setRcaCategory} 
        rcaPreventiveActions={rcaPreventiveActions} 
        setRcaPreventiveActions={setRcaPreventiveActions} 
        targetDepartmentId={targetDepartmentId} 
        setTargetDepartmentId={setTargetDepartmentId} 
        departments={departments} 
        serviceProviders={serviceProviders} 
        selectedServiceProviderId={selectedServiceProviderId} 
        setSelectedServiceProviderId={setSelectedServiceProviderId} 
        confirmThen={confirmThen} 
        handleControllerAction={handleControllerAction} 
        actionLoading={actionLoading} 
        hasEmployeeInjury={hasEmployeeInjury} 
        oc={oc} 
        notifyHr={notifyHr} 
        setNotifyHr={setNotifyHr} 
    />
)}

                            {/* HR REP: GOSI form */}
{isHrRep && ticket.hasInjury && (
    <HrPanel
        isHrRep={isHrRep}
        ticket={ticket}
        t={t}
        isRtl={isRtl}
        hrNotes={hrNotes}
        setHrNotes={setHrNotes}
        handleHrAction={handleHrAction}
        actionLoading={actionLoading}
        injuredPersonsGosi={injuredPersonsGosi}
        setInjuredPersonsGosi={setInjuredPersonsGosi}
        singleGosiSubmitted={singleGosiSubmitted}
        setSingleGosiSubmitted={setSingleGosiSubmitted}
        singleGosiEmployeeId={singleGosiEmployeeId}
        setSingleGosiEmployeeId={setSingleGosiEmployeeId}
        singleGosiReportDate={singleGosiReportDate}
        setSingleGosiReportDate={setSingleGosiReportDate}
        singleGosiReportNumber={singleGosiReportNumber}
        setSingleGosiReportNumber={setSingleGosiReportNumber}
        singleGosiNoReason={singleGosiNoReason}
        setSingleGosiNoReason={setSingleGosiNoReason}
    />
)}

                            {/* DEPARTMENT REP ACTION */}
{isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status) && (
    <DepartmentPanel 
        isDepRep={isDepRep} 
        ticket={ticket} 
        t={t} 
        isRtl={isRtl}
        handleDepartmentAction={handleDepartmentAction} 
        actionLoading={actionLoading} 
        rcaCause={rcaCause}
        setRcaCause={setRcaCause}
        rcaWhy={rcaWhy}
        setRcaWhy={setRcaWhy}
        rcaRootCause={rcaRootCause}
        setRcaRootCause={setRcaRootCause}
        rcaCategory={rcaCategory}
        setRcaCategory={setRcaCategory}
        rcaPreventiveActions={rcaPreventiveActions}
        setRcaPreventiveActions={setRcaPreventiveActions}
    />
)}

                            {/* CONTROLLER FINAL REVIEW */}
{isController && ticket.status === 'UNDER_REVIEW' && (
    <ControllerFinalReviewPanel isController={isController} ticket={ticket} t={t} hasRejectedPlan={ticket.actionPlans?.some((p: any) => p.status === 'REJECTED')} controllerNotes={controllerNotes} setControllerNotes={setControllerNotes} oc={oc} reminderDate={reminderDate} setReminderDate={setReminderDate} reminderMessage={reminderMessage} setReminderMessage={setReminderMessage} handleFinalReview={handleFinalReview} actionLoading={actionLoading} confirmThen={confirmThen} isRtl={isRtl} handleCloseRequest={handleCloseRequest} hrIncomplete={hrIncomplete} handleStandaloneRemindHr={handleStandaloneRemindHr} />
)}

                            {/* SAFETY MANAGER */}
{isSafetyManager && ticket.status === 'ESCALATED' && (
    <SafetyManagerPanel isSafetyManager={isSafetyManager} ticket={ticket} t={t} controllerNotes={controllerNotes} setControllerNotes={setControllerNotes} oc={oc} confirmThen={confirmThen} handleSafetyManagerAction={handleSafetyManagerAction} isRtl={isRtl} handleCloseRequest={handleCloseRequest} hrIncomplete={hrIncomplete} handleStandaloneRemindHr={handleStandaloneRemindHr} actionLoading={actionLoading} departments={departments} targetDepartmentId={targetDepartmentId} setTargetDepartmentId={setTargetDepartmentId} />
)}

                            {/* No actions message */}
                            {!(
                                    (isReporter && ['RETURNED_TO_REPORTER', 'PENDING_REMINDER'].includes(ticket.status)) ||
                                    (isController && ['SUBMITTED', 'UNDER_REVIEW'].includes(ticket.status)) ||
                                    (isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) ||
                                    (isSafetyManager && ticket.status === 'ESCALATED')
                                ) && ticket.status !== 'CLOSED' && (
                                    isReporter ? (
                                        <div className="text-center py-8 px-4">
                                            <div className="w-14 h-14 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                                <ShieldCheck className="text-blue-600" size={28} />
                                            </div>
                                            <h4 className="font-black text-slate-800 text-sm mb-1">
                                                {isRtl ? 'تذكرتك قيد المراجعة' : 'Your Ticket Is Being Reviewed'}
                                            </h4>
                                            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                                                {isRtl
                                                    ? 'يعمل فريق السلامة على معالجة بلاغك. سيتم إشعارك عند حل التذكرة.'
                                                    : 'The HSE team is working on your report. You will be notified when the ticket is resolved.'}
                                            </p>
                                            <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] font-bold text-blue-600">
                                                    {isRtl ? 'قيد المعالجة' : 'In Progress'}
                                                </span>
                                            </div>

                                            <div className="mt-8 text-left bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 shadow-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ShieldCheck className="text-emerald-600" size={18} />
                                                    <h5 className="font-bold text-emerald-800 text-sm">{isRtl ? 'تعليمات السلامة' : 'Safety Tips'}</h5>
                                                </div>
                                                <ul className="text-xs text-emerald-700 space-y-2 list-none m-0 p-0">
                                                    <li className="flex gap-2"><span className="text-emerald-400">•</span> {isRtl ? 'ابتعد عن منطقة الخطر وتأكد من سلامتك أولاً.' : 'Stay away from the hazard zone and ensure your safety first.'}</li>
                                                    <li className="flex gap-2"><span className="text-emerald-400">•</span> {isRtl ? 'لا تحاول العبث بمكان الحادث أو إزالة أي أدلة.' : 'Do not attempt to tamper with the incident scene or remove evidence.'}</li>
                                                    <li className="flex gap-2"><span className="text-emerald-400">•</span> {isRtl ? 'اتبع تعليمات فريق السلامة (HSE) بدقة تامة.' : 'Follow the HSE team instructions strictly.'}</li>
                                                </ul>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 px-4">
                                            <p className="text-sm text-slate-500 font-medium bg-slate-100 rounded-lg py-3 inline-block px-6">
                                                {t('ticketDetail.noPendingActions')}
                                            </p>
                                        </div>
                                    )
                                )}
                            {ticket.status === 'CLOSED' && isTicketOwner ? (
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 text-center shadow-sm">
                                    <div className="w-12 h-12 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                                        <CheckCircle className="text-emerald-600" size={26} />
                                    </div>
                                    <h4 className="font-black text-emerald-800 text-base mb-1.5">
                                        {isRtl ? 'شكراً لبلاغك' : 'Thank You for Your Report'}
                                    </h4>
                                    <p className="text-sm text-emerald-700 leading-relaxed max-w-md mx-auto">
                                        {isRtl
                                            ? 'تم حل المشكلة وإغلاق التذكرة. للاستفسار عن أي تفاصيل، يُرجى التواصل مع قسم الأمن والسلامة مع ذكر رقم التذكرة.'
                                            : 'The issue has been resolved and the ticket is closed. For any inquiries, please contact the HSE Department and reference the ticket number below.'}
                                    </p>
                                    <div className="mt-3 inline-flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-1.5">
                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                                            {isRtl ? 'رقم التذكرة' : 'Ticket No.'}
                                        </span>
                                        <span className="font-mono font-black text-emerald-900 text-sm" dir="ltr">{ticket.ticketNo}</span>
                                    </div>
                                </div>
                            ) : ticket.status === 'CLOSED' && (
                                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm font-bold text-center border border-emerald-200"><CheckCircle className="mx-auto mb-1" size={24} /> {t('ticketActions.ticketClosed', 'Ticket Closed')}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Tab — restricted to controllers and HSE/safety managers */}
            {activeTab === 'timeline' && isController && (
                <TimelineTab ticket={ticket} formatDateTime={formatDateTime} />
            )}

            {/* ── Confirmation overlay ── */}
            <ConfirmModal
                confirmPending={confirmPending}
                actionLoading={actionLoading}
                onConfirm={executeConfirmed}
                onCancel={() => setConfirmPending(null)}
            />

            {/* ── Close-ticket modal (collects financial violation) ── */}
            <CloseTicketModal
                open={closeModalOpen}
                loading={actionLoading}
                hasEmployeeInjury={hasEmployeeInjury}
                serviceProviderId={ticket?.serviceProviderId || null}
                serviceProviderName={ticket?.serviceProvider ? (isRtl ? (ticket.serviceProvider.nameAr || ticket.serviceProvider.name) : ticket.serviceProvider.name) : null}
                serviceProviders={serviceProviders}
                ticketSeverity={ticket?.severityLevel || null}
                onCancel={() => { setCloseModalOpen(false); setCloseTargetType(null); }}
                onConfirm={handleConfirmClose}
            />

            {/* ── HR Reminder modal ── */}
            {hrReminderModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="bg-amber-100 text-amber-600 p-2 rounded-full">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{isRtl ? 'بيانات التأمينات مفقودة' : 'Missing HR / GOSI Data'}</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-sm text-gray-600 leading-relaxed mb-6">
                                {isRtl 
                                    ? 'هذه التذكرة تحتوي على إصابات للموظفين ولم تقم الموارد البشرية بتعبئة بيانات بلاغ التأمينات (GOSI) حتى الآن. هل ترغب في إغلاق التذكرة وتجاوز الموارد البشرية أم ترغب في إرسال تذكير للموارد البشرية للقيام بذلك أولاً؟' 
                                    : 'This ticket has employee injuries but HR has not filled out the GOSI report yet. Do you want to close the ticket and bypass HR, or send a reminder to HR first?'}
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => {
                                        setHrReminderModalOpen(false);
                                        setCloseModalOpen(true);
                                    }}
                                    disabled={actionLoading}
                                    className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors"
                                >
                                    {isRtl ? 'إغلاق التذكرة على أي حال' : 'Close Ticket Anyway'}
                                </button>
                                <button
                                    onClick={handleRemindHr}
                                    disabled={actionLoading}
                                    className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                                    {isRtl ? 'تذكير الموارد البشرية' : 'Remind HR'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
                <div className="bg-white border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {ticket.attachments?.map((att: any) => (
                        <a key={att.id} href={resolveAttachmentUrl(att.url)} target="_blank" rel="noopener noreferrer" className="block group">
                            {att.mimeType?.startsWith('image/') ? <img src={resolveAttachmentUrl(att.url)} alt="" className="w-full h-32 object-cover rounded-xl border group-hover:border-blue-400 transition" /> : <div className="w-full h-32 bg-gray-50 border rounded-xl flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:border-blue-400 transition"><Paperclip size={24} className="mb-2" /><span className="text-xs font-medium">Document</span></div>}
                            <p className="text-xs text-gray-600 mt-2 truncate font-medium">{att.name}</p>
                        </a>
                    ))}
                    {ticket.attachments?.length === 0 && <p className="col-span-full text-center py-10 text-gray-500 text-sm">No attachments available.</p>}
                </div>
            )}

        </div>

        {showPrint && <TicketPrintReport ticket={ticket} onClose={() => setShowPrint(false)} />}
        </>
    );
};

export default TicketDetail;
