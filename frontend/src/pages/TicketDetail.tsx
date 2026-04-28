import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, Send, Loader2, User, Search, Paperclip, Check, X, Bell, Sparkles, Download } from 'lucide-react';
import { ActionPlanSection, RCASection, ReminderSection, MagicWandButton } from '../components/TicketSections';
import TicketPrintReport from '../components/TicketPrintReport';

import { resolveAttachmentUrl } from '../utils/resolveAttachmentUrl';

const TicketDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
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
    const [reminderDate, setReminderDate] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');

    // Department Action — per-injured-person GOSI
    interface GosiEntry {
        gosiEmployeeId: string;
        gosiSubmitted: boolean | undefined;
        gosiReportDate: string;
        gosiReportNumber: string;
        gosiNoReason: string;
    }
    const [injuredPersonsGosi, setInjuredPersonsGosi] = useState<GosiEntry[]>([]);
    const [contractorNotified, setContractorNotified] = useState<boolean | undefined>(undefined);
    const [contractorNotifyDate, setContractorNotifyDate] = useState('');
    const [contractorNoReason, setContractorNoReason] = useState('');

    // Reporter Reply
    const [replyText, setReplyText] = useState('');

    // Escalation
    const [targetDepManagerId, setTargetDepManagerId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);

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
    const [depManagers, setDepManagers] = useState<any[]>([]);

    const canFetchAdminData = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN', 'OC_SUPERVISOR'].includes(user?.role || '');

    useEffect(() => {
        fetchTicket();
        if (canFetchAdminData) {
            api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);
            api.get('/users?role=DEP_MANAGER').then(res => setDepManagers(res.data)).catch(console.error);
        }
    }, [id]);

    const fetchTicket = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
            setSeverityLevel(prev => prev || res.data.severityLevel || '');
        } catch (error) { console.error('Error fetching ticket', error); navigate('/dashboard'); }
        finally { if (!isBackground) setLoading(false); }
    };

    const handleControllerAction = async (action: string) => {
        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/controller-action`, { action, notes: controllerNotes, severity: severityLevel, targetDepartmentId, newType: newType || undefined, typeChangeReason });
            await fetchTicket(true);
            setControllerNotes(''); setTypeChangeReason(''); setNewType('');
        } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
        finally { setActionLoading(false); }
    };

    const handleDepartmentAction = async () => {
        const plans = ticket.actionPlans || [];
        const hasImmediate = plans.some((p: any) => p.type === 'IMMEDIATE');
        const hasShortTerm = plans.some((p: any) => p.type === 'SHORT_TERM');
        if (!hasImmediate || !hasShortTerm) {
            alert(t('ticketActions.missingActionPlans', 'يجب إدراج خطة عمل فورية (Immediate) وخطة عمل قصيرة المدى (Short-Term) على الأقل قبل إرسال الرد.'));
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
                alert(t('ticketActions.gosiDateError', 'عذراً، يجب أن يكون تاريخ بلاغ التأمينات مساوياً أو بعد تاريخ وقوع الحادث.'));
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
        } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
        finally { setActionLoading(false); }
    };

    const handleFinalReview = async (action: string) => {
        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/controller-review`, { action, notes: controllerNotes, reminderDate, reminderMessage });
            await fetchTicket(true);
            setControllerNotes(''); setReminderDate(''); setReminderMessage('');
        } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
        finally { setActionLoading(false); }
    };

    const handleSafetyManagerAction = async (action: string) => {
        setActionLoading(true);
        try {
            await api.put(`/tickets/${id}/safety-manager`, { action, notes: controllerNotes, targetDepManagerId });
            await fetchTicket(true);
            setControllerNotes('');
        } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
        finally { setActionLoading(false); }
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
        } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
        finally { setActionLoading(false); }
    };

    useEffect(() => {
        if (!ticket) return;
        const ocSafe = ticket.offCircuitReport || {};
        const injuredPersonsSafe = ocSafe.injuredPersons ? JSON.parse(ocSafe.injuredPersons) : [];
        const employeeInjuredList = injuredPersonsSafe.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
        const hasEmployeeInjurySafe = employeeInjuredList.length > 0;

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

    useEffect(() => {
        if (!ticket || departments.length === 0) return;
        const ocSafe = ticket.offCircuitReport || {};
        const injuredPersonsSafe = ocSafe.injuredPersons ? JSON.parse(ocSafe.injuredPersons) : [];
        const hasEmployeeInjurySafe = injuredPersonsSafe.some((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
        const hrDeptSafe = departments.find(d => d.name.toLowerCase().includes('hr') || d.nameAr?.includes('موارد'));
        
        if (hasEmployeeInjurySafe && hrDeptSafe && !targetDepartmentId) {
            setTargetDepartmentId(hrDeptSafe.id);
        }
    }, [ticket, departments, targetDepartmentId]);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    if (!ticket) return null;

    const oc = ticket.offCircuitReport || {};
    const role = user?.role || '';
    const isController = ['HSE_CONTROLLER', 'ADMIN'].includes(role);
    const isSafetyManager = ['SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
    const isDepRep = role === 'DEP_REP';
    const isHrRep = role === 'HR_REP';
    const isReporter = role === 'OC_REPORTER' && ticket.createdById === user?.id;

    const injuredPersons = oc.injuredPersons ? JSON.parse(oc.injuredPersons) : [];
    const hasEmployeeInjury = injuredPersons.some((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
    const hasContractorInjury = injuredPersons.some((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
    const hrDept = departments.find(d => d.name.toLowerCase().includes('hr') || d.nameAr?.includes('موارد'));
    const isForcedHR = hasEmployeeInjury && !!hrDept;

    const statusColors: Record<string, string> = { SUBMITTED: 'bg-blue-100 text-blue-700', ASSIGNED_TO_HR: 'bg-teal-100 text-teal-700', HR_COMPLETED: 'bg-cyan-100 text-cyan-700', ASSIGNED: 'bg-amber-100 text-amber-700', UNDER_REVIEW: 'bg-purple-100 text-purple-700', PENDING_REMINDER: 'bg-orange-100 text-orange-700', UNDER_INVESTIGATION: 'bg-indigo-100 text-indigo-700', ESCALATED: 'bg-red-100 text-red-700', CLOSED: 'bg-emerald-100 text-emerald-700', RETURNED_TO_REPORTER: 'bg-rose-100 text-rose-700', RETURNED_TO_DEPARTMENT: 'bg-pink-100 text-pink-700' };

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
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${statusColors[ticket.status] || 'bg-gray-100'}`}>{t(`status.${ticket.status}`, ticket.status) as string}</span>
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
                                    🎯 {isRtl ? 'ملاحظات الكنترولر' : 'Controller Notes'}
                                    <span className="text-[10px] text-blue-400 font-normal ltr:ml-auto rtl:mr-auto">{oc.controllerFilledBy} • {formatDate(oc.controllerFilledAt)}</span>
                                </h3>
                                <p className="text-sm text-blue-900 whitespace-pre-wrap bg-white rounded-lg p-3 border border-blue-100">{oc.controllerNotes}</p>
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
                                <h3 className="font-bold text-teal-800 flex items-center gap-2 border-b border-teal-200 pb-2">🏥 {isRtl ? 'استجابة الموارد البشرية (GOSI)' : 'HR Response (GOSI)'}</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                    <div><span className="text-teal-600 block text-xs">{isRtl ? 'مُعبَّأ بواسطة' : 'Submitted By'}</span><span className="font-bold text-teal-900">{oc.hrFilledBy}</span></div>
                                    <div><span className="text-teal-600 block text-xs">{isRtl ? 'تاريخ التعبئة' : 'Date'}</span><span className="font-bold text-teal-900">{formatDate(oc.hrFilledAt)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* HR Pending notice for all roles when ASSIGNED_TO_HR */}
                        {!oc.hrFilledBy && ticket.status === 'ASSIGNED_TO_HR' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                                <p className="text-xs text-amber-700 font-semibold text-center">⏳ {isRtl ? 'بانتظار إكمال الموارد البشرية لبيانات التأمينات (GOSI)...' : 'Waiting for HR to complete GOSI data...'}</p>
                            </div>
                        )}

                        {/* Always show injuries section if there are any, visible across all stages */}
                        {(hasEmployeeInjury || hasContractorInjury) && (
                            <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-4 mb-4">
                                <h3 className="font-bold text-blue-800 flex items-center gap-2 border-b border-blue-200 pb-2">
                                    {/* Dynamic title based on injury types */}
                                    {hasEmployeeInjury && hasContractorInjury
                                        ? <>{isRtl ? '🏥 إصابات الموظفين والمقاولين' : '🏥 Injuries & Contractor Notification'}</>
                                        : hasEmployeeInjury
                                            ? <>{isRtl ? '🏥 HR / التأمينات (GOSI)' : '🏥 HR / GOSI'}</>
                                            : <>{isRtl ? '🏗️ إشعار الشركة المتعاقدة' : '🏗️ Contractor Notification'}</>
                                    }
                                    {!oc.depRepFilledBy && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ltr:ml-auto rtl:mr-auto">{isRtl ? 'بانتظار إدخال القسم' : 'Pending Dept Input'}</span>}
                                </h3>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Per-person GOSI display or form */}
                                    {hasEmployeeInjury && (() => {
                                        const employees = injuredPersons.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');
                                        const isEditable = isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status);
                                        
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
                                                                        <label className="block text-[10px] font-bold text-slate-600 mb-1">{isRtl ? 'الرقم الوظيفي' : 'Employee ID'} <span className="text-red-500">*</span></label>
                                                                        <input placeholder={isRtl ? 'أدخل الرقم الوظيفي هنا...' : 'Enter Employee ID...'} value={pg.gosiEmployeeId} onChange={e => updateGosi('gosiEmployeeId', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2 rounded-lg text-xs transition-all" dir="ltr" />
                                                                    </div>
                                                                    <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-3">
                                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                                            <input type="checkbox" checked={pg.gosiSubmitted === true} onChange={e => updateGosi('gosiSubmitted', e.target.checked)} className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500" />
                                                                            <span className="text-xs font-bold text-slate-700">{t('ticketActions.gosiSubmitted', 'Was GOSI informed?')}</span>
                                                                        </label>
                                                                        {pg.gosiSubmitted === true && (
                                                                            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-200">
                                                                                <div>
                                                                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reportDate', 'Report Date')} <span className="text-red-500">*</span></label>
                                                                                    <input type="date" min={(() => { try { return new Date(ticket.offCircuitReport?.incidentDate || ticket.createdAt || Date.now()).toISOString().slice(0, 10); } catch(e) { return ''; } })()} value={pg.gosiReportDate} onChange={e => updateGosi('gosiReportDate', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.gosiNo', 'GOSI Number')} <span className="text-red-500">*</span></label>
                                                                                    <input placeholder={t('ticketActions.gosiNo', 'GOSI No.')} value={pg.gosiReportNumber} onChange={e => updateGosi('gosiReportNumber', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" dir="ltr" />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {pg.gosiSubmitted === false && (
                                                                            <div className="pt-2 border-t border-slate-200">
                                                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">{t('ticketActions.reason', 'Reason for not reporting')} <span className="text-red-500">*</span></label>
                                                                                <input placeholder={t('ticketActions.reasonPlaceholder', 'Reason...')} value={pg.gosiNoReason} onChange={e => updateGosi('gosiNoReason', e.target.value)} className="w-full border-gray-300 border focus:border-blue-500 p-1.5 rounded text-xs" />
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
                                                                    <p className="text-xs text-amber-600 font-medium italic py-2">{isRtl ? 'لم يتم إدخال بيانات التأمينات بعد' : 'GOSI data not entered yet'}</p>
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
                                                            <p className="text-amber-600 font-medium italic py-1">{isRtl ? '⏳ بانتظار إدخال ممثل القسم لبيانات إشعار الشركة' : '⏳ Pending dept rep: company notification status'}</p>
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

                        {/* ActionPlanSection: only for the department filling it, or controllers reviewing after submission */}
                        {(isDepRep || (ticket.actionPlans?.length > 0)) && (
                            <ActionPlanSection ticket={ticket} onRefresh={() => fetchTicket(true)} />
                        )}
                        <RCASection ticket={ticket} onRefresh={() => fetchTicket(true)} />
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
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{t('ticketActions.notes', 'Notes')}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_ASSIGN_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea placeholder={t('ticketActions.notesPlaceholder', 'Notes...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[120px]" rows={5} />
                                    </div>
                                    {/* Show HR auto-routing notice if employee injured */}
                                    {hasEmployeeInjury && (
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5">
                                            <p className="text-xs text-teal-800 font-semibold flex items-center gap-1.5">
                                                <span className="text-lg">🏥</span>
                                                {isRtl ? 'يوجد موظف مصاب — سيتم توجيه التذكرة تلقائياً إلى الموارد البشرية لإكمال بيانات التأمينات (GOSI) قبل التوجيه للقسم المختص.' : 'Employee injury detected — The ticket will be routed to HR for GOSI data first, then you can route it to the responsible department.'}
                                            </p>
                                        </div>
                                    )}
                                    {/* Dept selector only shown when NO employee injury */}
                                    {!hasEmployeeInjury && (
                                        <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                                            <p className="text-xs font-bold text-gray-500">{t('ticketActions.routeToDept', 'Route to Department')}</p>
                                            <select value={targetDepartmentId} onChange={e => setTargetDepartmentId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"><option value="">{t('ticketActions.selectDept', 'Select Department')}</option>{departments.map(d => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
                                        </div>
                                    )}
                                    {(!severityLevel || !controllerNotes.trim()) && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1.5">
                                            {!severityLevel && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {isRtl ? 'التصنيف (Classification) مطلوب' : 'Classification is required'}
                                                </p>
                                            )}
                                            {severityLevel && !controllerNotes.trim() && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {isRtl ? 'الملاحظات مطلوبة قبل التوجيه' : 'Notes are required before routing'}
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
                                        {hasEmployeeInjury ? (
                                            <button
                                                onClick={() => { if (!severityLevel || !controllerNotes.trim()) return; confirmThen(() => handleControllerAction('ASSIGN_TO_HR'), isRtl ? 'توجيه للموارد البشرية' : 'Route to HR', isRtl ? `ستُوجَّه التذكرة للموارد البشرية لإكمال بيانات GOSI. التصنيف: ${severityLevel}` : `Ticket will be routed to HR for GOSI data. Severity: ${severityLevel}`, 'primary'); }}
                                                disabled={actionLoading || !severityLevel || !controllerNotes.trim()}
                                                className="bg-teal-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-teal-700 flex items-center justify-center gap-1.5"
                                            >🏥 {isRtl ? 'توجيه لـ HR' : 'Route to HR'}</button>
                                        ) : (
                                            <button
                                                onClick={() => { if (!severityLevel || !targetDepartmentId || !controllerNotes.trim()) return; const deptName = departments.find(d => d.id === targetDepartmentId)?.name || targetDepartmentId; confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'توجيه التذكرة' : 'Route Ticket', isRtl ? `سيتم التوجيه إلى "${deptName}" بتصنيف "${severityLevel}".` : `Routing to "${deptName}" with severity "${severityLevel}".`, 'primary'); }}
                                                disabled={actionLoading || !targetDepartmentId || !severityLevel || !controllerNotes.trim()}
                                                className="bg-blue-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700 flex items-center justify-center gap-1.5"
                                            >✓ {t('ticketActions.assign', 'توجيه')}</button>
                                        )}
                                    </div>
                                </div>
                            )}


                            {/* CONTROLLER: WAITING for HR - status info banner */}
                            {isController && ticket.status === 'ASSIGNED_TO_HR' && (
                                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                                    <p className="text-2xl mb-2">🏥</p>
                                    <h4 className="font-bold text-teal-800 text-sm">{isRtl ? 'التذكرة بانتظار رد الموارد البشرية' : 'Waiting for HR Response'}</h4>
                                    <p className="text-xs text-teal-600 mt-1">{isRtl ? 'تم إرسال التذكرة لقسم الموارد البشرية لإكمال بيانات التأمينات (GOSI). ستتلقى إشعاراً عند اكتمال البيانات.' : 'The ticket has been sent to HR for GOSI data. You will be notified when they complete it.'}</p>
                                </div>
                            )}

                            {/* HR REP: GOSI form */}
                            {isHrRep && ticket.status === 'ASSIGNED_TO_HR' && (
                                <div className="space-y-3 bg-teal-50 border border-teal-200 rounded-xl p-4">
                                    <p className="text-sm font-bold text-teal-800 text-center">🏥 {isRtl ? 'يرجى إكمال بيانات التأمينات (GOSI) لكل مصاب وإرسال الرد' : 'Please complete GOSI data for all injured employees and submit'}</p>
                                    <button
                                        onClick={async () => {
                                            setActionLoading(true);
                                            try {
                                                await api.put(`/tickets/${id}/hr-action`, { injuredPersonsGosi: injuredPersonsGosi.length > 0 ? injuredPersonsGosi : undefined });
                                                await fetchTicket(true);
                                            } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
                                            finally { setActionLoading(false); }
                                        }}
                                        disabled={actionLoading}
                                        className="w-full bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >{actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {isRtl ? 'إرسال بيانات GOSI' : 'Submit GOSI Data'}</button>
                                </div>
                            )}

                            {/* CONTROLLER: HR_COMPLETED — route to responsible dept */}
                            {isController && ticket.status === 'HR_COMPLETED' && (
                                <div className="space-y-3">
                                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                                        <p className="text-xs font-bold text-cyan-800">✅ {isRtl ? 'أكملت الموارد البشرية بيانات GOSI. يرجى توجيه التذكرة الآن إلى القسم المسؤول عن الحادث لكتابة خطط العمل.' : 'HR has completed GOSI data. Please route the ticket to the responsible department for action plans.'}</p>
                                    </div>
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.routeToDept', 'Route to Responsible Department')}</p>
                                        <select value={targetDepartmentId} onChange={e => setTargetDepartmentId(e.target.value)} className="w-full p-2 border rounded text-sm"><option value="">{t('ticketActions.selectDept', 'Select Department')}</option>{departments.filter(d => !d.name.toLowerCase().includes('hr') && !d.nameAr?.includes('موارد')).map(d => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
                                    </div>
                                    <div className="border border-gray-300 rounded-lg bg-white">
                                        <div className="px-2 pt-2 text-xs font-bold text-gray-500">{t('ticketActions.notes', 'Notes')}</div>
                                        <textarea placeholder={t('ticketActions.notesPlaceholder', 'Notes for the department...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[100px]" rows={4} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => confirmThen(() => handleControllerAction('RETURN_HR'), isRtl ? 'إرجاع للموارد البشرية' : 'Return to HR', isRtl ? 'ستُرجع التذكرة للموارد البشرية لتصحيح البيانات.' : 'Ticket will be returned to HR for corrections.', 'danger')}
                                            disabled={actionLoading || !controllerNotes.trim()}
                                            className="bg-rose-50 border border-rose-200 text-rose-700 py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-rose-100"
                                        >↩ {isRtl ? 'إرجاع لـ HR' : 'Return to HR'}</button>
                                        <button
                                            onClick={() => { if (!targetDepartmentId || !controllerNotes.trim()) return; const deptName = departments.find(d => d.id === targetDepartmentId)?.name || targetDepartmentId; confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'توجيه للقسم المختص' : 'Route to Department', isRtl ? `سيتم توجيه التذكرة إلى "${deptName}" لكتابة خطط العمل.` : `Ticket will be routed to "${deptName}" for action plans.`, 'primary'); }}
                                            disabled={actionLoading || !targetDepartmentId || !controllerNotes.trim()}
                                            className="bg-blue-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700"
                                        >✓ {isRtl ? 'توجيه للقسم' : 'Route to Dept'}</button>
                                    </div>
                                </div>
                            )}

                            {/* DEPARTMENT REP ACTION */}
                            {isDepRep && ['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status) && (
                                <div className="space-y-3 bg-white p-4 border border-slate-200 shadow-sm rounded-xl">
                                    <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                                        {isRtl ? 'يرجى إكمال جميع البيانات المطلوبة أعلاه وإضافة خطط العمل قبل إرسال الرد.' : 'Please complete all required fields above and add Action Plans before submitting.'}
                                    </p>
                                    <button onClick={handleDepartmentAction} disabled={actionLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                                        {isRtl ? 'اعتماد وإرسال الرد' : 'Submit Response'}
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
                                                {isRtl
                                                    ? 'اكتب ملاحظة هنا لتفعيل زر "إرجاع للقسم" — لا يمكن الإرجاع بدون توضيح السبب للقسم.'
                                                    : 'Write a note here to enable "Return to Dept" — the department must know why it\'s being returned.'}
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
                                                {isRtl
                                                    ? 'يوجد خطة عمل مرفوضة — لا يمكن إغلاق التقرير. يجب إرجاع التقرير للقسم لإعادة تقديم الخطة أو تصعيده.'
                                                    : 'A rejected action plan exists — the ticket cannot be closed. Return it to the department for correction or escalate.'}
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
                                            oc.rcaRequired && !oc.rcaCompleted ? (
                                                <button
                                                    onClick={() => confirmThen(() => handleFinalReview('PROCEED_RCA'), isRtl ? 'الانتقال إلى تحليل السبب الجذري' : 'Proceed to RCA', isRtl ? 'ستنتقل التذكرة إلى مرحلة تحليل السبب الجذري. يجب إكمال التحليل قبل الإغلاق.' : 'The ticket will move to Root Cause Analysis phase. Analysis must be completed before closure.', 'primary')}
                                                    className="col-span-2 bg-indigo-600 text-white p-3 rounded-xl text-sm font-bold transition-all hover:bg-indigo-700 flex items-center justify-center gap-2"
                                                >
                                                    📋 {isRtl ? 'الانتقال إلى RCA' : 'Proceed to RCA'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => confirmThen(() => handleFinalReview('CLOSE'), isRtl ? 'إغلاق التذكرة' : 'Close Ticket', isRtl ? 'سيتم إغلاق التذكرة نهائياً. تأكد من اكتمال جميع الإجراءات قبل المتابعة.' : 'The ticket will be permanently closed. Make sure all actions are completed before proceeding.', 'success')}
                                                    className="col-span-2 bg-emerald-600 text-white p-3 rounded-xl text-sm font-bold transition-all hover:bg-emerald-700 flex items-center justify-center gap-2"
                                                >
                                                    ✓ {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                                                </button>
                                            )
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
                                    <select value={targetDepManagerId} onChange={e => setTargetDepManagerId(e.target.value)} className="w-full p-2 border rounded text-sm"><option value="">{t('ticketActions.selectDeptManager', 'Select Dept Manager')}</option>{depManagers.map(d => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            onClick={() => confirmThen(() => handleSafetyManagerAction('RETURN'), isRtl ? 'إرجاع التذكرة' : 'Return Ticket', isRtl ? 'ستُرجع التذكرة إلى المرحلة السابقة للمراجعة.' : 'The ticket will be returned to the previous review stage.', 'danger')}
                                            className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-xl text-xs font-bold transition-all hover:bg-rose-100"
                                        >
                                            ↩ إرجاع
                                        </button>
                                        <button
                                            onClick={() => {
                                                const mgr = depManagers.find(d => d.id === targetDepManagerId);
                                                confirmThen(() => handleSafetyManagerAction('SEND_TO_DEP_MANAGER'), isRtl ? 'إرسال لمدير القسم' : 'Send to Dept Manager', isRtl ? `سيتم إرسال التذكرة إلى "${mgr?.name || 'المدير المختار'}".` : `The ticket will be sent to "${mgr?.name || 'Selected Manager'}".`, 'primary');
                                            }}
                                            disabled={!targetDepManagerId}
                                            className="bg-blue-600 text-white p-2 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700"
                                        >
                                            ✈ إرسال للمدير
                                        </button>
                                        <button
                                            onClick={() => confirmThen(() => handleSafetyManagerAction('CLOSE'), isRtl ? 'إغلاق التذكرة' : 'Close Ticket', isRtl ? 'سيتم إغلاق التذكرة نهائياً بصلاحية مدير السلامة.' : 'The ticket will be permanently closed by the Safety Manager.', 'success')}
                                            className="col-span-2 bg-emerald-600 text-white p-2 rounded-xl text-sm font-bold transition-all hover:bg-emerald-700"
                                        >
                                            ✓ إغلاق التذكرة
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
                                        {isRtl ? 'لا توجد إجراءات مطلوبة منك في هذه المرحلة، البلاغ بانتظار طرف آخر.' : 'No pending actions required from you at this stage.'}
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
                <div className="bg-white border rounded-xl p-6">
                    <div className="space-y-6">
                        {ticket.activityLogs?.map((log: any, i: number) => (
                            <div key={log.id} className="relative pl-6 border-l-2 border-gray-100 last:border-0 pb-6 last:pb-0">
                                <span className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full" /></span>
                                <p className="text-sm font-bold text-gray-800">{log.action}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(log.createdAt)} • {log.actor?.name} ({log.actor?.role})</p>
                                {log.details && <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded border border-gray-100">{log.details}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Confirmation overlay ── */}
            {confirmPending && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                        {/* Colored top bar */}
                        <div className={`h-1.5 w-full ${
                            confirmPending.variant === 'danger'  ? 'bg-red-500' :
                            confirmPending.variant === 'warning' ? 'bg-amber-500' :
                            confirmPending.variant === 'success' ? 'bg-emerald-500' :
                            'bg-blue-600'
                        }`} />

                        <div className="p-5">
                            {/* Icon + title */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                                    confirmPending.variant === 'danger'  ? 'bg-red-100' :
                                    confirmPending.variant === 'warning' ? 'bg-amber-100' :
                                    confirmPending.variant === 'success' ? 'bg-emerald-100' :
                                    'bg-blue-100'
                                }`}>
                                    {confirmPending.variant === 'danger'  ? '⚠️' :
                                     confirmPending.variant === 'warning' ? '⬆️' :
                                     confirmPending.variant === 'success' ? '✅' : '📋'}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base leading-tight">{confirmPending.label}</h3>
                                    <p className="text-slate-500 text-sm mt-1 leading-relaxed whitespace-pre-line">{confirmPending.description}</p>
                                </div>
                            </div>

                            {/* Confirm/Cancel buttons */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    onClick={() => setConfirmPending(null)}
                                    className="py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                                >
                                    {isRtl ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={executeConfirmed}
                                    disabled={actionLoading}
                                    className={`py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                                        confirmPending.variant === 'danger'  ? 'bg-red-600 hover:bg-red-700' :
                                        confirmPending.variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                                        confirmPending.variant === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                        'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {actionLoading && <Loader2 size={14} className="animate-spin" />}
                                    {isRtl ? 'تأكيد التنفيذ' : 'Confirm'}
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

        {showPrint && <TicketPrintReport ticket={ticket} onClose={() => setShowPrint(false)} autoPrint />}
        </>
    );
};

export default TicketDetail;
