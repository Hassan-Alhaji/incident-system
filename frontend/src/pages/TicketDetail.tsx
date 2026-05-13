import { HAZARD_CATEGORIES, HazardIcon } from '../components/HazardIcons';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { STATUS_CONFIG } from '../utils/statusConfig';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { resolveAttachmentUrl } from '../utils/resolveAttachmentUrl';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, Send, Loader2, User, Search, Paperclip, Check, X, Bell, Sparkles, Download } from 'lucide-react';
import { ActionPlanSection, ReminderSection, MagicWandButton } from '../components/TicketSections';
import { TimelineTab, ConfirmModal, CloseTicketModal } from '../components/ticket';
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
    const [reminderDate, setReminderDate] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');

    // RCA fields (filled by Controller at ASSIGN step for non-OBSERVATION tickets)
    const [rcaCause, setRcaCause] = useState('');
    const [rcaWhy, setRcaWhy] = useState('');
    const [rcaRootCause, setRcaRootCause] = useState('');
    const [rcaCategory, setRcaCategory] = useState('');
    const [rcaPreventiveActions, setRcaPreventiveActions] = useState('');

    const safeParseJSON = (data: any, fallback: any = []) => {
        if (!data) return fallback;
        if (typeof data !== 'string') return data;
        try {
            return JSON.parse(data);
        } catch {
            return fallback;
        }
    };

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
    const [contractorNotified, setContractorNotified] = useState<boolean | undefined>(undefined);
    const [contractorNotifyDate, setContractorNotifyDate] = useState('');
    const [contractorNoReason, setContractorNoReason] = useState('');

    // Reporter Reply
    const [replyText, setReplyText] = useState('');

    // Escalation
    const [departments, setDepartments] = useState<any[]>([]);

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
        }
    }, [id]);

    const fetchTicket = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
            setSeverityLevel(prev => prev || res.data.severityLevel || '');
            const oc = res.data.offCircuitReport;
            if (oc) {
                setRcaCause(prev => prev || oc.rcaCause || '');
                setRcaWhy(prev => prev || oc.rcaWhy || '');
                setRcaRootCause(prev => prev || oc.rcaRootCause || '');
                setRcaCategory(prev => prev || oc.rcaCategory || '');
                setRcaPreventiveActions(prev => prev || oc.rcaPreventiveActions || '');
            }
        } catch (error) { console.error('Error fetching ticket', error); navigate('/dashboard'); }
        finally { if (!isBackground) setLoading(false); }
    };

    const handleControllerAction = async (action: string) => {
        // For ASSIGN: validate RCA fields client-side if non-OBSERVATION
        if (action === 'ASSIGN') {
            const effectiveType = newType || ticket?.type;
            const rcaRequired = effectiveType !== 'OBSERVATION';
            if (rcaRequired) {
                const countWords = (s: string) => s.trim().split(/\s+/).filter(w => w.length > 0).length;
                const missing = !rcaCause || !rcaWhy || !rcaRootCause || !rcaCategory || !rcaPreventiveActions;
                if (missing) {
                    showToast(isRtl ? 'يجب تعبئة جميع حقول تحليل السبب الجذري (RCA) الخمسة قبل التوجيه' : 'All 5 RCA fields are required before routing', 'warning');
                    return;
                }
                const tooShort = [rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions].some(v => countWords(v) < 10);
                if (tooShort) {
                    showToast(isRtl ? 'يجب أن يحتوي كل حقل من حقول RCA على 10 كلمات على الأقل' : 'Each RCA field must contain at least 10 words', 'warning');
                    return;
                }
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
                hazardCategory: hazardCategory.length > 0 ? JSON.stringify(hazardCategory) : undefined,
            };
            if (action === 'ASSIGN') {
                body.rcaCause = rcaCause;
                body.rcaWhy = rcaWhy;
                body.rcaRootCause = rcaRootCause;
                body.rcaCategory = rcaCategory;
                body.rcaPreventiveActions = rcaPreventiveActions;
            }
            await api.put(`/tickets/${id}/controller-action`, body);
            await fetchTicket(true);
            setControllerNotes(''); setTypeChangeReason(''); setNewType('');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleDepartmentAction = async () => {
        // Re-fetch ticket to get the latest action plans from server
        // (avoids stale state after saving plans)
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

        // Validate per-person GOSI dates
        const ocSafe = ticket.offCircuitReport || {};
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
            await api.put(`/tickets/${id}/department-action`, {
                injuredPersonsGosi: injuredPersonsGosi.length > 0 ? injuredPersonsGosi : undefined,
                contractorNotified, contractorNotifyDate, contractorNoReason
            });
            await fetchTicket(true);
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleFinalReview = async (action: string, closePayload?: { hasFinancialViolation: boolean; violationDescription: string; violationAmount: string }) => {
        setActionLoading(true);
        try {
            const body: any = { action, notes: controllerNotes, reminderDate, reminderMessage };
            if (action === 'CLOSE' && closePayload) {
                body.hasFinancialViolation = closePayload.hasFinancialViolation;
                body.violationDescription = closePayload.violationDescription;
                body.violationAmount = closePayload.violationAmount;
            }
            await api.put(`/tickets/${id}/controller-review`, body);
            await fetchTicket(true);
            setControllerNotes(''); setReminderDate(''); setReminderMessage('');
            setCloseModalOpen(false); setCloseTargetType(null);
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleSafetyManagerAction = async (action: string, closePayload?: { hasFinancialViolation: boolean; violationDescription: string; violationAmount: string }) => {
        setActionLoading(true);
        try {
            const body: any = { action, notes: controllerNotes };
            if (action === 'CLOSE' && closePayload) {
                body.hasFinancialViolation = closePayload.hasFinancialViolation;
                body.violationDescription = closePayload.violationDescription;
                body.violationAmount = closePayload.violationAmount;
            }
            await api.put(`/tickets/${id}/safety-manager`, body);
            await fetchTicket(true);
            setControllerNotes('');
            setCloseModalOpen(false); setCloseTargetType(null);
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleConfirmClose = (payload: { hasFinancialViolation: boolean; violationDescription: string; violationAmount: string }) => {
        if (closeTargetType === 'SAFETY_MANAGER') {
            handleSafetyManagerAction('CLOSE', payload);
        } else {
            handleFinalReview('CLOSE', payload);
        }
    };

    const handleRemindHr = async () => {
        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/controller-review`, { action: 'REMIND_HR', notes: controllerNotes });
            await fetchTicket(true);
            setHrReminderModalOpen(false);
            setCloseTargetType(null);
            showToast(isRtl ? 'تم إرسال تذكير للموارد البشرية بنجاح' : 'HR has been reminded successfully', 'success');
        } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
        finally { setActionLoading(false); }
    };

    const handleCloseRequest = (targetType: 'FINAL_REVIEW' | 'SAFETY_MANAGER') => {
        const ocSafe = ticket.offCircuitReport || {};
        const injuredPersonsSafe = safeParseJSON(ocSafe.injuredPersons);
        const hasEmployeeInjury = injuredPersonsSafe.some((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

        if (hasEmployeeInjury && !ocSafe.hrFilledBy) {
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
    }, [ticket]);



    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    if (!ticket) return null;

    const oc = ticket.offCircuitReport || {};
    const role = user?.role || '';
    const isController = ['HSE_CONTROLLER', 'ADMIN'].includes(role);
    const isSafetyManager = ['SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
    const isDepRep = role === 'DEP_REP';
    const isHrRep = role === 'HR_REP';
    const isReporter = role === 'OC_REPORTER' && ticket.createdById === user?.id;

    const injuredPersons = safeParseJSON(oc.injuredPersons);
    const hasEmployeeInjury = injuredPersons.some((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
    const hasContractorInjury = injuredPersons.some((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
    const hrDept = departments.find(d => d.name.toLowerCase().includes('hr') || d.nameAr?.includes('موارد'));




    return (
        <>
        <div className="max-w-5xl mx-auto space-y-4 pb-8">
            {/* Header */}
            <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 border rounded-lg hover:bg-gray-50 transition"><ArrowLeft size={18} /></button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">{ticket.ticketNo}</h1>
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${STATUS_CONFIG[ticket.status]?.chip || 'bg-gray-100'}`}>{t(`status.${ticket.status}`, ticket.status) as string}</span>
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

            {/* Main Content Tabs */}
            <div className="flex gap-2 border-b">
                <button onClick={() => setActiveTab('details')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t('nav.details', 'Details')}</button>
                <button onClick={() => setActiveTab('timeline')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'timeline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t('nav.timeline', 'Timeline')}</button>
                <button onClick={() => setActiveTab('attachments')} className={`pb-2 px-4 text-sm font-bold ${activeTab === 'attachments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>📎 {t('nav.attachments', 'Attachments')} ({ticket.attachments?.length || 0})</button>
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
                <div className="flex flex-col gap-4">
                    {/* Top Section: Details */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 shadow-sm shadow-slate-100 rounded-xl p-4 space-y-4">
                            <h3 className="font-bold text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-2">
                                📋 {t('nav.details', 'Incident Details')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500 block text-xs">{t('oc.wizard.incidentDate', 'Date/Time')}</span><span className="font-medium">{formatDate(oc.incidentDate)} {oc.incidentTime}</span></div>
                                <div>
                                    <span className="text-gray-500 block text-xs">{t('oc.wizard.location', 'Location')}</span>
                                    <span className="font-medium">
                                        {ticket.zone?.name
                                            ? <span className="inline-flex items-center gap-1"><span className="text-blue-600 font-bold">📍 {ticket.zone.name}</span>{ticket.location && ticket.location !== ticket.zone.name ? <span className="text-gray-400 text-xs font-normal">— {ticket.location}</span> : null}</span>
                                            : ticket.location || '-'}
                                    </span>
                                </div>
                                {ticket.severityLevel && (
                                    <div className="col-span-1 bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded-lg">
                                        <strong className="block text-xs">{t('ticketActions.classification', 'Classification')}:</strong> 
                                        <span className="font-bold">{t(`classification.${ticket.severityLevel}`, ticket.severityLevel) as string}</span>
                                    </div>
                                )}
                                {(() => {
                                    const raw = oc?.hazardCategory;
                                    if (!raw) return null;
                                    let cats: string[] = [];
                                    try { cats = JSON.parse(raw); } catch { cats = [raw]; }
                                    if (!cats.length) return null;
                                    const HAZARD_ICONS: Record<string, {svg: React.ReactNode, labelAr: string}> = {
                                        'Biological Hazards': { labelAr: 'بيولوجية', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="8" fill="#1a1a1a"/><path d="M32 24 C32 16 20 10 14 18 C8 26 16 34 24 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/><path d="M32 24 C38 16 50 18 48 28 C46 38 36 36 32 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/><path d="M26 34 C18 38 16 50 26 50 C36 50 36 40 32 38" stroke="#1a1a1a" strokeWidth="5" fill="none"/></svg> },
                                        'Chemical Hazards': { labelAr: 'كيميائية', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="6" fill="#1a1a1a"/><circle cx="20" cy="20" r="4" fill="#1a1a1a"/><circle cx="44" cy="20" r="4" fill="#1a1a1a"/><line x1="15" y1="50" x2="27" y2="30" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><line x1="37" y1="30" x2="49" y2="50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><line x1="10" y1="54" x2="54" y2="54" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/></svg> },
                                        'Physical Hazards': { labelAr: 'فيزيائية', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="6" fill="#1a1a1a"/><path d="M32 8 L32 18 M32 46 L32 56 M8 32 L18 32 M46 32 L56 32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/><path d="M32 14 A18 18 0 0 1 50 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/><path d="M32 50 A18 18 0 0 1 14 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/></svg> },
                                        'Safety Hazards': { labelAr: 'السلامة', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="40" cy="14" r="5" fill="#1a1a1a"/><path d="M40 20 L38 30 L30 26 L20 40" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M30 26 L26 42 L36 48" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M14 44 L22 44" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/></svg> },
                                        'Ergonomic Hazards': { labelAr: 'هندسة بشرية', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="36" cy="13" r="5" fill="#1a1a1a"/><path d="M36 18 L34 28 L44 32 L42 22" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="#1a1a1a" fillOpacity="0.3"/><path d="M34 28 L32 42 L26 52" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><path d="M32 42 L40 50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><path d="M20 36 L34 28" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><rect x="14" y="32" width="12" height="8" rx="2" fill="#1a1a1a"/></svg> },
                                        'Psychosocial Hazards': { labelAr: 'نفسية-اجتماعية', svg: <svg viewBox="0 0 64 64" className="w-7 h-7" fill="none"><circle cx="32" cy="32" r="30" fill="#FFC107"/><ellipse cx="32" cy="30" rx="16" ry="18" fill="#1a1a1a"/><path d="M20 22 C20 14 44 14 44 22" fill="#1a1a1a"/><path d="M24 26 C24 22 28 20 32 22 C36 20 40 22 40 26" stroke="#FFC107" strokeWidth="1.5" fill="none"/><path d="M26 32 C26 30 28 28 30 30" stroke="#FFC107" strokeWidth="1.5" fill="none"/><path d="M34 30 C36 28 38 30 38 32" stroke="#FFC107" strokeWidth="1.5" fill="none"/></svg> },
                                    };
                                    return (
                                        <div className="col-span-2 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                                            <strong className="block text-xs text-amber-800 mb-1.5">{t('ticketDetail.hazardCategory', 'Hazard Category')}</strong>
                                            <div className="flex flex-wrap gap-2">
                                                {cats.map((c: string) => {
                                                    const h = HAZARD_ICONS[c];
                                                    return (
                                                        <div key={c} className="flex flex-col items-center gap-0.5 bg-white border border-amber-200 rounded-lg p-1.5 shadow-sm min-w-[60px]">
                                                            {h?.svg || <span className="text-lg">⚠️</span>}
                                                            <span className="text-[8px] font-bold text-amber-700 text-center leading-tight">{isRtl ? (h?.labelAr || c) : c.replace(' Hazards', '')}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {ticket.department && (
                                    <div className="col-span-1 bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg">
                                        <strong className="block text-xs">{t('ticketActions.routedToDept', 'Routed to Department')}:</strong> 
                                        <span className="font-bold">{isRtl && ticket.department.nameAr ? ticket.department.nameAr : ticket.department.name}</span>
                                    </div>
                                )}
                                <div className="col-span-2"><span className="text-gray-500 block text-xs">{t('oc.wizard.whatHappened', 'Description')}</span><p className="font-medium mt-1 p-2 bg-gray-50 rounded-lg whitespace-pre-wrap">{ticket.description}</p></div>
                                {oc.isLateReport && <div className="col-span-2 bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg"><strong className="block text-xs">{t('oc.wizard.lateReport', 'Late Report')}:</strong> {oc.lateReportReason}</div>}
                            </div>
                        </div>

                        {/* Controller Notes - always visible when set */}
                        {oc.controllerNotes && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200 shadow-sm shadow-blue-100 rounded-xl p-4">
                                <h3 className="font-bold text-blue-800 flex items-center gap-2 border-b border-blue-200/70 pb-2 mb-3">
                                    🎯 {t('ticketDetail.controllerNotes')}
                                    <span className="text-[10px] text-blue-400 font-normal ltr:ml-auto rtl:mr-auto">{oc.controllerFilledBy} • {formatDate(oc.controllerFilledAt)}</span>
                                </h3>
                                <p className="text-sm text-blue-900 whitespace-pre-wrap bg-white rounded-lg p-3 border border-blue-100">{oc.controllerNotes}</p>
                            </div>
                        )}

                        {/* Completed RCA - visible when set */}
                        {oc.rcaCompleted && (
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

                        {oc.depRepFilledBy && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4 mb-4">
                                <h3 className="font-bold text-purple-800 flex items-center gap-2 border-b border-purple-200 pb-2">🏢 {t('ticketActions.deptResponse', 'Department Response')}</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-purple-600 block text-xs">{t('ticketActions.submittedBy', 'Submitted By')}</span><span className="font-bold text-purple-900">{oc.depRepFilledBy}</span></div>
                                    <div><span className="text-purple-600 block text-xs">{t('oc.wizard.incidentDate', 'Date/Time')}</span><span className="font-bold text-purple-900">{formatDate(oc.depRepFilledAt)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* HR Stage Info - visible to all when HR has completed */}
                        {oc.hrFilledBy && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
                                <h3 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-200 pb-2">🏥 {t('ticketDetail.hrResponse')}</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                    <div><span className="text-teal-600 block text-xs">{t('ticketDetail.filledBy')}</span><span className="font-bold text-teal-900">{oc.hrFilledBy}</span></div>
                                    <div><span className="text-teal-600 block text-xs">{t('ticketDetail.filledDate')}</span><span className="font-bold text-teal-900">{formatDate(oc.hrFilledAt)}</span></div>
                                </div>
                                {oc.hrNotes && (
                                    <div className="mt-3 bg-white p-3 rounded-lg border border-teal-100">
                                        <p className="text-xs text-teal-600 font-bold mb-1">{isRtl ? 'ملاحظات الموارد البشرية' : 'HR Notes'}</p>
                                        <p className="text-sm text-teal-900 whitespace-pre-wrap">{oc.hrNotes}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* HR Pending notice — shown to OTHERS waiting; HR sees a call-to-action instead */}
                        {!oc.hrFilledBy && ticket.hasInjury && !isHrRep && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                                <p className="text-xs text-amber-700 font-semibold text-center">⏳ {t('ticketDetail.waitingHrGosi')}</p>
                            </div>
                        )}
                        {!oc.hrFilledBy && ticket.hasInjury && isHrRep && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4">
                                <p className="text-xs text-teal-700 font-semibold text-center">📋 {t('ticketDetail.completeGosiBelow')}</p>
                            </div>
                        )}

                        {/* Always show injuries section if there are any, visible across all stages */}
                        {(hasEmployeeInjury || hasContractorInjury) && (
                            <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-4 mb-4">
                                <h3 className="font-bold text-blue-800 flex items-center gap-2 border-b border-blue-200 pb-2">
                                    {/* Dynamic title based on injury types */}
                                    {hasEmployeeInjury && hasContractorInjury
                                        ? <>{'🏥 ' + t('ticketDetail.injuriesAndContractor')}</>
                                        : hasEmployeeInjury
                                            ? <>{'🏥 ' + t('ticketDetail.hrGosi')}</>
                                            : <>{'🏗️ ' + t('ticketDetail.contractorNotification')}</>
                                    }
                                    {!oc.depRepFilledBy && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ltr:ml-auto rtl:mr-auto">{t('ticketDetail.pendingDeptInput')}</span>}
                                </h3>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Per-person GOSI display or form */}
                                    {hasEmployeeInjury && (() => {
                                        const employees = injuredPersons.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
                                        const isEditable =
                                            (isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) ||
                                            (isHrRep);
                                        
                                        return (
                                            <div className="col-span-1 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-xs text-blue-700">{isRtl ? `بيانات المصابين (${employees.length})` : `Injured Persons (${employees.length})`}</p>
                                                    {isEditable && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">إلزامي (Required)</span>}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {employees.map((p: any, i: number) => {
                                                        if (isEditable && injuredPersonsGosi[i]) {
                                                            const pg = injuredPersonsGosi[i];
                                                            const updateGosi = (field: keyof GosiEntry, value: any) => {
                                                                const updated = [...injuredPersonsGosi];
                                                                updated[i] = { ...updated[i], [field]: value };
                                                                setInjuredPersonsGosi(updated);
                                                            };
                                                            return (
                                                                <div key={i} className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4 space-y-3">
                                                                    <div className="flex items-center gap-2 pb-2 border-b border-blue-200/40">
                                                                        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-black">{i + 1}</div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-800">{p.name || (isRtl ? `مصاب #${i + 1}` : `Injured #${i + 1}`)}</p>
                                                                            {p.mobile && <p className="text-[10px] text-slate-400" dir="ltr">{p.mobile}</p>}
                                                                        </div>
                                                                        {p.dept && <span className="ltr:ml-auto rtl:mr-auto text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{p.dept}</span>}
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-slate-600 mb-1">{t('ticketDetail.employeeId')} <span className="text-red-500">*</span></label>
                                                                        <input id={`gosiEmployeeId-${i}`} name={`gosiEmployeeId-${i}`} placeholder={t('ticketDetail.enterEmployeeId')} value={pg.gosiEmployeeId} onChange={e => updateGosi('gosiEmployeeId', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2 rounded-lg text-xs transition-all" dir="ltr" />
                                                                    </div>
                                                                    <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-3">
                                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                                            <input id={`gosiSubmitted-${i}`} name={`gosiSubmitted-${i}`} type="checkbox" checked={pg.gosiSubmitted === true} onChange={e => updateGosi('gosiSubmitted', e.target.checked)} className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500" />
                                                                            <span className="text-xs font-bold text-slate-700">{t('ticketActions.gosiSubmitted', 'Was GOSI informed?')}</span>
                                                                        </label>
                                                                        {pg.gosiSubmitted === true && (
                                                                            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-200">
                                                                                <div>
                                                                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reportDate', 'Report Date')} <span className="text-red-500">*</span></label>
                                                                                    <input id={`gosiReportDate-${i}`} name={`gosiReportDate-${i}`} type="date" min={(() => { try { return new Date(ticket.offCircuitReport?.incidentDate || ticket.createdAt || Date.now()).toISOString().slice(0, 10); } catch(e) { return ''; } })()} value={pg.gosiReportDate} onChange={e => updateGosi('gosiReportDate', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.gosiNo', 'GOSI Number')} <span className="text-red-500">*</span></label>
                                                                                    <input id={`gosiReportNumber-${i}`} name={`gosiReportNumber-${i}`} placeholder={t('ticketActions.gosiNo', 'GOSI No.')} value={pg.gosiReportNumber} onChange={e => updateGosi('gosiReportNumber', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" dir="ltr" />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {pg.gosiSubmitted === false && (
                                                                            <div className="pt-2 border-t border-slate-200">
                                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reason', 'Reason for not reporting')} <span className="text-red-500">*</span></label>
                                                                                <input id={`gosiNoReason-${i}`} name={`gosiNoReason-${i}`} placeholder={t('ticketActions.reasonPlaceholder', 'Reason...')} value={pg.gosiNoReason} onChange={e => updateGosi('gosiNoReason', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        // Read-only display
                                                        return (
                                                            <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 mb-2">
                                                                    <div className="w-5 h-5 bg-blue-600 rounded text-white text-[10px] flex items-center justify-center font-black">{i + 1}</div>
                                                                    <div>
                                                                        <p className="font-bold text-sm text-slate-800">{p.name || (isRtl ? `مصاب #${i+1}` : `Injured #${i+1}`)}</p>
                                                                        {p.mobile && <p className="text-[10px] text-slate-500" dir="ltr">{p.mobile}</p>}
                                                                    </div>
                                                                    {p.dept && <span className="ltr:ml-auto rtl:mr-auto text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">{p.dept}</span>}
                                                                </div>
                                                                {p.gosiEmployeeId ? (
                                                                    <div className="text-xs space-y-1.5">
                                                                        <div><span className="text-slate-500">{t('oc.wizard.employeeId', 'Employee ID')}:</span> <span className="font-bold" dir="ltr">{p.gosiEmployeeId}</span></div>
                                                                        <div><span className="text-slate-500">{t('ticketActions.gosiSubmitted', 'GOSI Submitted?')}:</span> {p.gosiSubmitted ? <span className="text-emerald-600 font-bold">✓ {t('common.yes', 'Yes')}</span> : <span className="text-red-600 font-bold">✕ {t('common.no', 'No')}</span>}</div>
                                                                        {p.gosiSubmitted ? (
                                                                            <>
                                                                                <div><span className="text-slate-500">{t('oc.wizard.incidentDate', 'Date')}:</span> <strong>{formatDate(p.gosiReportDate)}</strong></div>
                                                                                <div><span className="text-slate-500">{t('ticketActions.gosiNo', 'GOSI No.')}:</span> <strong dir="ltr">{p.gosiReportNumber}</strong></div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="text-red-600"><span className="text-slate-500">{t('ticketActions.reason', 'Reason')}:</span> <strong>{p.gosiNoReason}</strong></div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-amber-600 font-medium italic py-2">{t('ticketDetail.gosiDataNotEntered')}</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Contractor Data */}
                                    {hasContractorInjury && (() => {
                                        const contractors = injuredPersons.filter((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
                                        const isEditable = isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status);
                                        return (
                                            <div className="col-span-1">
                                                <div className="flex items-center gap-2 mb-2 mt-2">
                                                    <p className="font-bold text-xs text-purple-700">{t('ticketActions.contractor', 'Contractor')} ({contractors.length})</p>
                                                    {isEditable && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{isRtl ? 'إلزامي' : 'Required'}</span>}
                                                </div>

                                                {/* ── Injured contractor persons (always visible) ── */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                    {contractors.map((p: any, i: number) => (
                                                        <div key={i} className="bg-purple-50/60 border border-purple-200/60 rounded-xl p-3 space-y-1.5">
                                                            <div className="flex items-center gap-2 pb-1.5 border-b border-purple-200/40">
                                                                <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center text-white text-[10px] font-black">{i + 1}</div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-800">{p.name || (isRtl ? `مصاب #${i + 1}` : `Injured #${i + 1}`)}</p>
                                                                    {p.mobile && <p className="text-[10px] text-slate-400" dir="ltr">{p.mobile}</p>}
                                                                </div>
                                                                {p.company && <span className="ltr:ml-auto rtl:mr-auto text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold truncate max-w-[120px]">{p.company}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* ── Company notification status (DEP_REP editable / read-only) ── */}
                                                {isEditable ? (
                                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/60 text-xs">
                                                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                                                            <input type="checkbox" checked={contractorNotified === true} onChange={e => setContractorNotified(e.target.checked)} className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500" />
                                                            <span className="text-xs font-bold text-slate-700">{t('ticketActions.companyNotified', 'Was the contractor company notified?')}</span>
                                                        </label>
                                                        {contractorNotified === true && (
                                                            <div className="pt-2 border-t border-blue-200/40">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reportDate', 'Date of notification')} <span className="text-red-500">*</span></label>
                                                                <input type="date" value={contractorNotifyDate} onChange={e => setContractorNotifyDate(e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
                                                            </div>
                                                        )}
                                                        {contractorNotified === false && (
                                                            <div className="pt-2 border-t border-blue-200/40">
                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reason', 'Reason')} <span className="text-red-500">*</span></label>
                                                                <input placeholder={t('ticketActions.reasonPlaceholder', 'Reason...')} value={contractorNoReason} onChange={e => setContractorNoReason(e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                                                        {oc.contractorNotified !== null && oc.contractorNotified !== undefined ? (
                                                            <div className="space-y-1.5">
                                                                <div><span className="text-slate-500">{t('ticketActions.companyNotified', 'Company Notified?')}:</span> {oc.contractorNotified ? <span className="text-emerald-600 font-bold">✓ {t('common.yes', 'Yes')}</span> : <span className="text-red-600 font-bold">✕ {t('common.no', 'No')}</span>}</div>
                                                                {oc.contractorNotified ? (
                                                                    <div><span className="text-slate-500">{t('oc.wizard.incidentDate', 'Date')}:</span> <strong>{formatDate(oc.contractorNotifyDate)}</strong></div>
                                                                ) : (
                                                                    <div className="text-red-600"><span className="text-slate-500">{t('ticketActions.reason', 'Reason')}:</span> <strong>{oc.contractorNoReason}</strong></div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-amber-600 font-medium italic py-1">{'⏳ ' + t('ticketDetail.pendingContractor')}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* OTHER type injured persons — always show */}
                                    {injuredPersons.filter((p: any) => p.type === 'OTHER').length > 0 && (
                                        <div className="col-span-1">
                                            <p className="font-bold text-xs text-gray-600 mb-2 mt-2">{isRtl ? `أخرى (${injuredPersons.filter((p: any) => p.type === 'OTHER').length})` : `Other (${injuredPersons.filter((p: any) => p.type === 'OTHER').length})`}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {injuredPersons.filter((p: any) => p.type === 'OTHER').map((p: any, i: number) => (
                                                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                                        <p className="text-sm font-bold text-slate-800">{p.name || `#${i + 1}`}</p>
                                                        {p.mobile && <p className="text-[10px] text-slate-400" dir="ltr">{p.mobile}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {/* ActionPlanSection: dept filling, HR filling (for employee injury cases), or anyone reviewing */}
                        {(isDepRep || isHrRep || (ticket.actionPlans?.length > 0)) && (
                            <ActionPlanSection ticket={ticket} onRefresh={() => fetchTicket(true)} />
                        )}
                        <ReminderSection ticket={ticket} onRefresh={() => fetchTicket(true)} />
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

                            {/* REPORTER PENDING REMINDER */}
                            {isReporter && ticket.status === 'PENDING_REMINDER' && (
                                <div className="space-y-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                                    <Bell className="mx-auto text-orange-500 mb-1" size={24} />
                                    <h4 className="font-bold text-orange-800">{t('rem.pendingActionTitle', 'تنبيه يتطلب إجراؤك')}</h4>
                                    <p className="text-xs text-orange-700 leading-relaxed">{t('rem.pendingActionDesc', 'يوجد تنبيه معلق بانتظار ردك، يرجى التوجه لقسم (التنبيهات) أدناه، وكتابة ملاحظة الإنجاز ثم الضغط على "إنجاز".')}</p>
                                </div>
                            )}

                            {/* CONTROLLER: SUBMITTED (Initial Review) */}
                            {isController && ticket.status === 'SUBMITTED' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.changeTypeOptional', 'Change Type (Optional)')}</p>
                                        <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full p-2 border rounded text-sm"><option value="">{t('ticketActions.keepCurrent', 'Keep current') as string} ({t(`oc.incidentTypes.${ticket.type}`, ticket.type) as string})</option><option value="OBSERVATION">{t('oc.incidentTypes.OBSERVATION', 'Observation')}</option><option value="ACCIDENT">{t('oc.incidentTypes.ACCIDENT', 'Accident / Injury')}</option><option value="SECURITY">{t('oc.incidentTypes.SECURITY', 'Security')}</option></select>
                                        {newType && <input placeholder={t('ticketActions.reasonForChange', 'Reason for change...')} value={typeChangeReason} onChange={e => setTypeChangeReason(e.target.value)} className="w-full p-2 border rounded text-sm" />}
                                    </div>
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.classification', 'Classification')}</p>
                                        <select value={severityLevel} onChange={e => setSeverityLevel(e.target.value)} className="w-full p-2 border rounded text-sm"><option value="">-- {t('ticketActions.classification', 'Classification')} --</option><option value="MINOR">{t('classification.MINOR', 'Minor')}</option><option value="SIGNIFICANT">{t('classification.SIGNIFICANT', 'Significant')}</option><option value="MAJOR">{t('classification.MAJOR', 'Major')}</option></select>
                                    </div>
                                    {/* Hazard Category Grid */}
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketDetail.hazardCategory', 'Hazard Category')}</p>
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
                                                    </svg>
                                                )},
                                                { value: 'Physical Hazards', labelAr: 'مخاطر فيزيائية', icon: (
                                                    <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
                                                        <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                                                        <circle cx="32" cy="32" r="6" fill="#1a1a1a"/>
                                                        <path d="M32 8 L32 18 M32 46 L32 56 M8 32 L18 32 M46 32 L56 32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
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
                                                        <path d="M24 26 C24 22 28 20 32 22 C36 20 40 22 40 26" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                                                        <path d="M26 32 C26 30 28 28 30 30" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                                                        <path d="M34 30 C36 28 38 30 38 32" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                                                    </svg>
                                                )},
                                            ].map(cat => {
                                                const isSelected = hazardCategory.includes(cat.value);
                                                return (
                                                    <button
                                                        key={cat.value}
                                                        type="button"
                                                        onClick={() => setHazardCategory(prev => prev.includes(cat.value) ? prev.filter(v => v !== cat.value) : [...prev, cat.value])}
                                                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center
                                                            ${isSelected
                                                                ? 'border-amber-500 bg-amber-50 shadow-md scale-105'
                                                                : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'}
                                                            cursor-pointer hover:shadow-sm`}
                                                    >
                                                        {<HazardIcon category={cat.value} className="w-9 h-9" />}
                                                        <span className={`text-[9px] font-bold leading-tight ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>
                                                            {isRtl ? cat.labelAr : cat.value}
                                                        </span>
                                                        {isSelected && <span className="text-[8px] text-amber-500">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{t('ticketActions.notes', 'Notes')}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_ASSIGN_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea id="controllerNotes" name="controllerNotes" placeholder={t('ticketActions.notesPlaceholder', 'Notes...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[120px]" rows={5} />
                                    </div>
                                    {/* Show HR auto-routing notice if employee injured */}
                                    {hasEmployeeInjury && (
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5">
                                            <p className="text-xs text-teal-800 font-semibold flex items-center gap-1.5">
                                                <span className="text-lg">🏥</span>
                                                {t('ticketDetail.hrAutoNotice')}
                                            </p>
                                        </div>
                                    )}

                                    {/* ── RCA (Root Cause Analysis) — required for non-OBSERVATION ── */}
                                    {(newType || ticket.type) !== 'OBSERVATION' && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 rounded-xl p-4 space-y-3">
                                            <div className="flex items-start gap-2 pb-2 border-b border-amber-200/70">
                                                <span className="text-lg">📋</span>
                                                <div>
                                                    <h4 className="text-sm font-black text-amber-900">{isRtl ? 'تحليل السبب الجذري (RCA)' : 'Root Cause Analysis (RCA)'}</h4>
                                                    <p className="text-[11px] text-amber-700 mt-0.5">{isRtl ? 'مطلوب قبل التوجيه — 10 كلمات على الأقل لكل حقل' : 'Required before routing — minimum 10 words per field'}</p>
                                                </div>
                                            </div>
                                            {[
                                                { num: 1, label: isRtl ? '١. الأسباب المباشرة' : '1. Immediate Causes', value: rcaCause, setter: setRcaCause, type: 'RCA_CAUSE' },
                                                { num: 2, label: isRtl ? '٢. الأسباب الكامنة (لماذا حدث؟)' : '2. Underlying Causes (Why?)', value: rcaWhy, setter: setRcaWhy, type: 'RCA_WHY' },
                                                { num: 3, label: isRtl ? '٣. السبب الجذري' : '3. Root Cause', value: rcaRootCause, setter: setRcaRootCause, type: 'RCA_ROOT_CAUSE' },
                                                { num: 4, label: isRtl ? '٤. الإجراءات التصحيحية' : '4. Corrective Actions', value: rcaCategory, setter: setRcaCategory, type: 'RCA_CORRECTIVE' },
                                                { num: 5, label: isRtl ? '٥. الإجراءات الوقائية' : '5. Preventive Actions', value: rcaPreventiveActions, setter: setRcaPreventiveActions, type: 'RCA_PREVENTIVE' },
                                            ].map(f => (
                                                <div key={f.num} className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-700">{f.label}<span className="text-red-500 ms-1">*</span></label>
                                                        <MagicWandButton text={f.value} context={oc?.whatHappened || ''} type={f.type} onEnhanced={f.setter} />
                                                    </div>
                                                    <textarea
                                                        value={f.value}
                                                        onChange={e => f.setter(e.target.value)}
                                                        rows={3}
                                                        placeholder={isRtl ? 'اكتب إجابتك (10 كلمات على الأقل)...' : 'Write your answer (min 10 words)...'}
                                                        className="w-full text-sm border border-amber-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
    <p className="text-xs font-bold text-gray-500">{t('ticketActions.routeToDept', 'Route to Department')}</p>
    <select id="targetDepartmentId" name="targetDepartmentId" value={targetDepartmentId} onChange={e => setTargetDepartmentId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"><option value="">{t('ticketActions.selectDept', 'Select Department')}</option>{departments.map(d => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
</div>
                                    {(!severityLevel || !controllerNotes.trim()) && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1.5">
                                            {!severityLevel && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {t('ticketDetail.classificationRequired')}
                                                </p>
                                            )}
                                            {severityLevel && !controllerNotes.trim() && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {t('ticketDetail.notesRequired')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            onClick={() => confirmThen(() => handleControllerAction('RETURN_REPORTER'), isRtl ? 'إرجاع إلى المبلّغ' : 'Return to Reporter', isRtl ? `ستُرجع التذكرة للمبلّغ.\nالملاحظات: "${controllerNotes}"` : `Ticket returned to reporter.\nNotes: "${controllerNotes}"`, 'danger')}
                                            disabled={actionLoading || !controllerNotes.trim()}
                                            className="bg-red-50 border border-red-200 text-red-700 py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-red-100"
                                        >↩ {t('ticketActions.return', 'إرجاع')}</button>
                                        <button
    onClick={() => { if (!severityLevel || !targetDepartmentId || !controllerNotes.trim()) return; const deptName = departments.find(d => d.id === targetDepartmentId)?.name || targetDepartmentId; confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'توجيه التذكرة' : 'Route Ticket', isRtl ? `سيتم التوجيه إلى "${deptName}" بتصنيف "${severityLevel}".` : `Routing to "${deptName}" with severity "${severityLevel}".`, 'primary'); }}
    disabled={actionLoading || !targetDepartmentId || !severityLevel || !controllerNotes.trim()}
    className="bg-blue-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700 flex items-center justify-center gap-1.5"
>✓ {t('ticketActions.assign', 'توجيه')}</button>
                                    </div>
                                </div>
                            )}


                            

                            {/* HR REP: GOSI form */}
                            {isHrRep && ticket.hasInjury && (
                                <div className="space-y-3 bg-teal-50 border border-teal-200 rounded-xl p-4">
                                    <p className="text-sm font-bold text-teal-800 text-center">🏥 {t('ticketDetail.gosiPrompt')}</p>
                                    
                                    <div className="bg-white rounded-xl border border-teal-100 p-1 mb-3">
                                        <textarea
                                            placeholder={isRtl ? 'ملاحظات إضافية (اختياري)...' : 'Additional HR Notes (Optional)...'}
                                            value={hrNotes}
                                            onChange={(e) => setHrNotes(e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 text-sm p-3 resize-y min-h-[80px] outline-none"
                                        />
                                    </div>

                                    <button
                                        onClick={async () => {
                                            setActionLoading(true);
                                            try {
                                                await api.put(`/tickets/${id}/hr-action`, { 
                                                    injuredPersonsGosi: injuredPersonsGosi.length > 0 ? injuredPersonsGosi : undefined,
                                                    hrNotes 
                                                });
                                                await fetchTicket(true);
                                                showToast(isRtl ? 'تم تحديث بيانات التأمينات بنجاح' : 'GOSI data updated successfully', 'success');
                                            } catch (err: any) { showToast(err.response?.data?.message || t('errors.generic'), 'error'); }
                                            finally { setActionLoading(false); }
                                        }}
                                        disabled={actionLoading}
                                        className="w-full bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >{actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {ticket.offCircuitReport?.hrFilledBy ? t('ticketDetail.updateGosi') : t('ticketDetail.submitGosi')}</button>
                                </div>
                            )}

                            {/* DEPARTMENT REP ACTION */}
                            {isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status) && (
                                <div className="space-y-3 bg-white p-4 border border-slate-200 shadow-sm rounded-xl">
                                    <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                                        {t('ticketDetail.completeFields')}
                                    </p>
                                    <button onClick={handleDepartmentAction} disabled={actionLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                                        {t('ticketDetail.submitResponse')}
                                    </button>
                                </div>
                            )}

                            {/* CONTROLLER FINAL REVIEW */}
                            {isController && ticket.status === 'UNDER_REVIEW' && (() => {
                                const hasRejectedPlan = ticket.actionPlans?.some((p: any) => p.status === 'REJECTED');
                                return (
                                <div className="space-y-3">
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{t('ticketActions.reviewNotes', 'Review Notes')}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_REVIEW_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea placeholder={t('ticketActions.reviewNotesPlaceholder', 'Review Notes...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[150px]" rows={6} />
                                        {!controllerNotes && (
                                            <p className="text-[10px] text-amber-600 bg-amber-50 border-t border-amber-100 px-3 py-1.5 flex items-center gap-1.5">
                                                <span className="font-black">!</span>
                                                {t('ticketDetail.reviewWriteNote')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-orange-800"><Bell size={12} className="inline mr-1" /> {t('ticketActions.setReminder', 'Set Reminder')}</p>
                                        <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className="w-full p-1.5 border rounded text-xs" />
                                        <input placeholder={t('ticketActions.reminderMessage', 'Reminder message...')} value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} className="w-full p-1.5 border rounded text-xs" />
                                        <button onClick={() => handleFinalReview('SET_REMINDER')} disabled={!reminderDate || !reminderMessage} className="w-full bg-orange-500 text-white p-1.5 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">{t('ticketActions.setReminder', 'Set Reminder')}</button>
                                    </div>

                                    {/* Warning banner when a plan is rejected */}
                                    {hasRejectedPlan && (
                                        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                                            <span className="text-red-500 text-lg">⚠️</span>
                                            <p className="text-sm font-bold text-red-700">
                                                {t('ticketDetail.rejectedPlanWarning')}
                                            </p>
                                        </div>
                                    )}

                                    <div className={`grid gap-2 pt-1 ${hasRejectedPlan ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                        <button
                                            onClick={() => confirmThen(() => handleFinalReview('RETURN_DEPARTMENT'), isRtl ? 'إرجاع إلى القسم' : 'Return to Department', isRtl ? 'ستُرجع التذكرة إلى القسم المختص للمراجعة وإعادة الرد.' : 'The ticket will be returned to the department for revision and re-submission.', 'danger')}
                                            disabled={!controllerNotes}
                                            className="bg-rose-50 border-2 border-rose-300 text-rose-700 p-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-rose-100 flex items-center justify-center gap-2"
                                        >
                                            ↩ {isRtl ? 'إرجاع للقسم' : 'Return to Dept'}
                                        </button>
                                        <button
                                            onClick={() => confirmThen(() => handleFinalReview('ESCALATE'), isRtl ? 'تصعيد التذكرة' : 'Escalate Ticket', isRtl ? 'ستُرفع التذكرة للمستوى الأعلى (Safety Manager). لا يمكن التراجع عن هذا الإجراء.' : 'The ticket will be escalated to the Safety Manager. This action cannot be undone.', 'warning')}
                                            className="bg-amber-500 text-white p-3 rounded-xl text-sm font-bold transition-all hover:bg-amber-600 flex items-center justify-center gap-2"
                                        >
                                            ⬆ {isRtl ? 'تصعيد' : 'Escalate'}
                                        </button>
                                        {!hasRejectedPlan && (
                                            <button
                                                onClick={() => handleCloseRequest('FINAL_REVIEW')}
                                                className="col-span-2 bg-emerald-600 text-white p-3 rounded-xl text-sm font-bold transition-all hover:bg-emerald-700 flex items-center justify-center gap-2"
                                            >
                                                ✓ {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                );
                            })()}

                            {/* SAFETY MANAGER */}
                            {isSafetyManager && ticket.status === 'ESCALATED' && (
                                <div className="space-y-3">
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{t('ticketActions.closureNotes', 'Closure / Escalation Notes')}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_CLOSURE_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea placeholder={t('ticketActions.notesPlaceholder', 'Notes...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[150px]" rows={6} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            onClick={() => confirmThen(() => handleSafetyManagerAction('RETURN'), isRtl ? 'إرجاع التذكرة' : 'Return Ticket', isRtl ? 'ستُرجع التذكرة إلى المرحلة السابقة للمراجعة.' : 'The ticket will be returned to the previous review stage.', 'danger')}
                                            className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-xl text-xs font-bold transition-all hover:bg-rose-100"
                                        >
                                            ↩ {isRtl ? 'إرجاع' : 'Return'}
                                        </button>
                                        <button
                                            onClick={() => handleCloseRequest('SAFETY_MANAGER')}
                                            className="bg-emerald-600 text-white p-2 rounded-xl text-xs font-bold transition-all hover:bg-emerald-700"
                                        >
                                            ✓ {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* No actions message */}
                            {!(
                                    (isReporter && ['RETURNED_TO_REPORTER', 'PENDING_REMINDER'].includes(ticket.status)) ||
                                    (isController && ['SUBMITTED', 'UNDER_REVIEW'].includes(ticket.status)) ||
                                    (isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) ||
                                    (isSafetyManager && ticket.status === 'ESCALATED')
                                ) && ticket.status !== 'CLOSED' && (
                                    <div className="text-center py-6 px-4">
                                        <p className="text-sm text-slate-500 font-medium bg-slate-100 rounded-lg py-3 inline-block px-6">
                                            {t('ticketDetail.noPendingActions')}
                                        </p>
                                    </div>
                                )}
                            {ticket.status === 'CLOSED' && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm font-bold text-center border border-emerald-200"><CheckCircle className="mx-auto mb-1" size={24} /> {t('ticketActions.ticketClosed', 'Ticket Closed')}</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
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
