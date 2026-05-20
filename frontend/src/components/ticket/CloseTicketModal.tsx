import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle, AlertTriangle, History, ExternalLink, BookOpen } from 'lucide-react';
import api from '../../utils/api';

interface ViolationRecord {
    ticketId: string;
    ticketNo: string;
    type: string;
    severityLevel: string;
    violationType: 'WARNING' | 'FINANCIAL';
    violationDescription: string;
    violationAmount: string | null;
    closedAt: string;
    closedBy: string;
}

interface CloseTicketModalProps {
    open: boolean;
    hasEmployeeInjury?: boolean;
    serviceProviderId?: string | null;
    serviceProviderName?: string | null;
    serviceProviders?: any[];
    ticketSeverity?: string | null;
    onCancel: () => void;
    onConfirm: (payload: {
        violationType: 'NONE' | 'WARNING' | 'FINANCIAL';
        violationDescription: string;
        violationAmount: string;
        serviceProviderId?: string | null;
    }) => void;
    loading?: boolean;
}

const CloseTicketModal: React.FC<CloseTicketModalProps> = ({ open, hasEmployeeInjury, serviceProviderId, serviceProviderName, serviceProviders, ticketSeverity, onCancel, onConfirm, loading }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';

    const [localServiceProviderId, setLocalServiceProviderId] = useState<string | null>(null);
    const [violationType, setViolationType] = useState<'NONE' | 'WARNING' | 'FINANCIAL' | null>(null);
    const [violationDescription, setViolationDescription] = useState('');
    const [violationAmount, setViolationAmount] = useState('');
    const [violationHistory, setViolationHistory] = useState<ViolationRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [policyExpanded, setPolicyExpanded] = useState(false);

    useEffect(() => {
        if (open) {
            setLocalServiceProviderId(serviceProviderId || null);
            // Violation choice is always presented to the controller, regardless of injury
            setViolationType(null);
            setViolationDescription('');
            setViolationAmount('');
            setViolationHistory([]);
            setHistoryExpanded(false);
            setPolicyExpanded(false);
        }
    }, [open, hasEmployeeInjury, serviceProviderId]);

    // Fetch violation history when user selects WARNING or FINANCIAL
    useEffect(() => {
        if (!open || !localServiceProviderId || !violationType || violationType === 'NONE') {
            setViolationHistory([]);
            return;
        }
        setHistoryLoading(true);
        api.get(`/service-providers/${localServiceProviderId}/violation-history`)
            .then(res => {
                setViolationHistory(res.data || []);
                if (res.data?.length > 0) setHistoryExpanded(true);
            })
            .catch(() => setViolationHistory([]))
            .finally(() => setHistoryLoading(false));
    }, [open, localServiceProviderId, violationType]);

    if (!open) return null;

    const canSubmit =
        violationType !== null &&
        (violationType === 'NONE' || violationDescription.trim().length > 0) &&
        (violationType !== 'FINANCIAL' || violationAmount.trim().length > 0) &&
        !loading;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onConfirm({
            violationType: violationType as 'NONE' | 'WARNING' | 'FINANCIAL',
            violationDescription: violationDescription.trim(),
            violationAmount: violationType === 'FINANCIAL' ? violationAmount.trim() : '',
            serviceProviderId: localServiceProviderId || null
        });
    };

    const severityBadge = (sev: string) => {
        const colors: Record<string, string> = {
            'MINOR': 'bg-green-100 text-green-700 border-green-200',
            'SIGNIFICANT': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'MAJOR': 'bg-red-100 text-red-700 border-red-200',
        };
        return colors[sev] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const violationBadge = (vt: string) => {
        return vt === 'FINANCIAL'
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-orange-100 text-orange-700 border-orange-200';
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="h-1.5 w-full bg-emerald-500 flex-shrink-0" />
                <div className="p-5 overflow-y-auto">
                    <div className="flex items-start gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 flex-shrink-0">
                            <CheckCircle className="text-emerald-600" size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-base leading-tight">
                                {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                {isRtl
                                    ? 'أكمل الحقول التالية لإغلاق التذكرة نهائياً.'
                                    : 'Complete the following fields to permanently close the ticket.'}
                            </p>
                        </div>
                    </div>

                    {/* Target Service Provider Banner & Selection */}
                    <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isRtl ? 'المقاول / مزود الخدمة المستهدف:' : 'Target Service Provider / Contractor:'}
                        </label>
                        <select 
                            value={localServiceProviderId || ''} 
                            onChange={e => setLocalServiceProviderId(e.target.value)} 
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white"
                        >
                            <option value="">{isRtl ? 'بدون مزود خدمة (N/A) - لا يمكن إصدار مخالفة' : 'No Service Provider (N/A) - Violations disabled'}</option>
                            {serviceProviders?.map((sp: any) => (
                                <option key={sp.id} value={sp.id}>{isRtl ? (sp.nameAr || sp.name) : sp.name}</option>
                            ))}
                        </select>
                        {!localServiceProviderId && (
                            <div className="flex items-start gap-1.5 mt-0.5">
                                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <span className="text-xs font-semibold text-amber-700 leading-snug">
                                    {isRtl 
                                        ? 'يجب اختيار مزود خدمة لتتمكن من إصدار مخالفة مالية أو تحذيرية.'
                                        : 'A service provider must be selected to issue a financial or warning violation.'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Violation question — always shown regardless of injury type */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            {isRtl ? 'هل توجد مخالفة؟' : 'Is there a violation?'}
                            <span className="text-red-500 ms-1">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setViolationType('NONE')}
                                className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${violationType === 'NONE'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                {isRtl ? 'لا توجد' : 'None'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViolationType('WARNING')}
                                disabled={!localServiceProviderId}
                                className={`py-2 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${violationType === 'WARNING'
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                {isRtl ? 'تحذيرية' : 'Warning'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViolationType('FINANCIAL')}
                                disabled={!localServiceProviderId}
                                className={`py-2 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${violationType === 'FINANCIAL'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                {isRtl ? 'مالية' : 'Financial'}
                            </button>
                        </div>
                    </div>

                    {/* ── Violation History Panel ── */}
                    {violationType && violationType !== 'NONE' && localServiceProviderId && (
                        <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => setHistoryExpanded(!historyExpanded)}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    <History size={15} className="text-slate-500" />
                                    <span className="text-xs font-bold text-slate-700">
                                        {isRtl
                                            ? `📋 سجل مخالفات مزود الخدمة (${violationHistory.length})`
                                            : `📋 Vendor Violation History (${violationHistory.length})`}
                                    </span>
                                    {violationHistory.length > 0 && (
                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                                            {violationHistory.length}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-slate-400 text-xs transition-transform ${historyExpanded ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {historyExpanded && (
                                <div className="px-3 pb-3">
                                    {serviceProviderName && (
                                        <p className="text-[11px] text-slate-500 mt-2 mb-2 font-semibold">
                                            🏢 {serviceProviderName}
                                        </p>
                                    )}

                                    {historyLoading ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 size={16} className="animate-spin text-slate-400" />
                                            <span className="text-xs text-slate-400 ms-2">
                                                {isRtl ? 'جاري التحميل...' : 'Loading...'}
                                            </span>
                                        </div>
                                    ) : violationHistory.length === 0 ? (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-emerald-600 font-bold">
                                                ✅ {isRtl ? 'لا توجد مخالفات سابقة لهذا المقاول' : 'No previous violations for this vendor'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 mt-1 max-h-[200px] overflow-y-auto">
                                            {violationHistory.map((v, idx) => (
                                                <div
                                                    key={v.ticketId}
                                                    className="bg-white rounded-lg border border-slate-200 p-2.5 hover:border-slate-300 transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                                                                #{idx + 1}
                                                            </span>
                                                            <a
                                                                href={`/tickets/${v.ticketId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                                                            >
                                                                {v.ticketNo}
                                                                <ExternalLink size={10} />
                                                            </a>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${severityBadge(v.severityLevel)}`}>
                                                                {v.severityLevel}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${violationBadge(v.violationType)}`}>
                                                                {v.violationType === 'FINANCIAL'
                                                                    ? (isRtl ? 'مالية' : 'Financial')
                                                                    : (isRtl ? 'تحذيرية' : 'Warning')}
                                                            </span>
                                                        </div>
                                                        {v.violationAmount && (
                                                            <span className="text-[11px] font-bold text-red-600" dir="ltr">
                                                                {Number(v.violationAmount).toLocaleString()} SAR
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                                        {v.violationDescription || '—'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        📅 {new Date(v.closedAt).toLocaleDateString('en-GB')} • {v.closedBy}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Summary bar */}
                                    {violationHistory.length > 0 && (
                                        <div className="mt-2 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                                            <div className="text-[11px] text-amber-800 font-semibold leading-snug">
                                                {isRtl ? (
                                                    <>
                                                        إجمالي المخالفات: <strong>{violationHistory.length}</strong>
                                                        {' • '}
                                                        تحذيرية: <strong>{violationHistory.filter(v => v.violationType === 'WARNING').length}</strong>
                                                        {' • '}
                                                        مالية: <strong>{violationHistory.filter(v => v.violationType === 'FINANCIAL').length}</strong>
                                                        {violationHistory.some(v => v.violationAmount) && (
                                                            <>
                                                                {' • '}
                                                                إجمالي الغرامات: <strong className="text-red-600" dir="ltr">
                                                                    {violationHistory
                                                                        .reduce((sum, v) => sum + (Number(v.violationAmount) || 0), 0)
                                                                        .toLocaleString()} SAR
                                                                </strong>
                                                            </>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        Total: <strong>{violationHistory.length}</strong>
                                                        {' • '}
                                                        Warnings: <strong>{violationHistory.filter(v => v.violationType === 'WARNING').length}</strong>
                                                        {' • '}
                                                        Financial: <strong>{violationHistory.filter(v => v.violationType === 'FINANCIAL').length}</strong>
                                                        {violationHistory.some(v => v.violationAmount) && (
                                                            <>
                                                                {' • '}
                                                                Total Fines: <strong className="text-red-600" dir="ltr">
                                                                    {violationHistory
                                                                        .reduce((sum, v) => sum + (Number(v.violationAmount) || 0), 0)
                                                                        .toLocaleString()} SAR
                                                                </strong>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── HSE Violation Policy Reference ── */}
                    {violationType && violationType !== 'NONE' && (
                        <div className="mb-4 border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30">
                            <button
                                type="button"
                                onClick={() => setPolicyExpanded(!policyExpanded)}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-indigo-100 to-indigo-50 hover:from-indigo-150 hover:to-indigo-100 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    <BookOpen size={15} className="text-indigo-500" />
                                    <span className="text-xs font-bold text-indigo-700">
                                        {isRtl ? '📖 مرجع سياسة المخالفات' : '📖 HSE Violation Policy Reference'}
                                    </span>
                                </div>
                                <span className={`text-indigo-400 text-xs transition-transform ${policyExpanded ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {policyExpanded && (
                                <div className="px-3 pb-3 pt-2 space-y-3">
                                    {/* Classification descriptions */}
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] font-bold text-indigo-800 mb-1">
                                            {isRtl ? 'تصنيفات المخالفات:' : 'Violation Classifications:'}
                                        </p>
                                        <div className="flex items-start gap-2 bg-white rounded-lg border border-green-200 p-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-bold text-green-700">Minor</p>
                                                <p className="text-[10px] text-slate-500 leading-snug">
                                                    {isRtl
                                                        ? 'تأثير بسيط: مخالفات مرورية، عدم لبس معدات السلامة PPE، سوء التخزين، عدم تقديم وثائق السلامة'
                                                        : 'Minor impact: speeding, PPE violations, unsafe acts, poor housekeeping, missing safety docs'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 bg-white rounded-lg border border-yellow-200 p-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-bold text-yellow-700">Significant</p>
                                                <p className="text-[10px] text-slate-500 leading-snug">
                                                    {isRtl
                                                        ? 'تأثير كبير: عمال بدون وثائق، معدات غير آمنة، إساءة استخدام الاعتمادات، عدم اتباع قواعد الموقع'
                                                        : 'Significant impact: staff without documents, unsafe equipment/machinery, misuse of accreditation, failure to follow site rules'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 bg-white rounded-lg border border-red-200 p-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-bold text-red-700">Major</p>
                                                <p className="text-[10px] text-slate-500 leading-snug">
                                                    {isRtl
                                                        ? 'تأثير جسيم: حادث خطير، حالة قريبة من كارثة، تضرر الأصول، إصابات متعددة محتملة'
                                                        : 'Major impact: severe accident, near miss with potential for multiple injury, damaging assets'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Graded sanctions table */}
                                    <div>
                                        <p className="text-[11px] font-bold text-indigo-800 mb-1.5">
                                            {isRtl ? 'جدول العقوبات التصاعدي (8.2.1):' : 'Graded Scale of Sanctions (8.2.1):'}
                                        </p>
                                        <div className="overflow-x-auto rounded-lg border border-indigo-200">
                                            <table className="w-full text-[10px]" dir="ltr">
                                                <thead>
                                                    <tr className="bg-indigo-100">
                                                        <th className="px-2 py-1.5 text-start font-bold text-indigo-800 border-b border-indigo-200">
                                                            Classification
                                                        </th>
                                                        <th className="px-2 py-1.5 text-center font-bold text-indigo-800 border-b border-l border-indigo-200">
                                                            1st Instance
                                                        </th>
                                                        <th className="px-2 py-1.5 text-center font-bold text-indigo-800 border-b border-l border-indigo-200">
                                                            2nd Instance
                                                        </th>
                                                        <th className="px-2 py-1.5 text-center font-bold text-indigo-800 border-b border-l border-indigo-200">
                                                            3rd Instance
                                                        </th>
                                                        <th className="px-2 py-1.5 text-center font-bold text-indigo-800 border-b border-l border-indigo-200">
                                                            Continued
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className={`bg-white ${ticketSeverity === 'MINOR' ? 'ring-2 ring-green-400 ring-inset' : ''}`}>
                                                        <td className="px-2 py-1.5 border-b border-indigo-100">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                                <strong className="text-green-700">Minor</strong>
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 text-slate-600">
                                                            Verbal Warning
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 text-slate-600">
                                                            Written Notice
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 font-bold text-red-600">
                                                            5,000 SAR
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 font-bold text-red-600">
                                                            10,000 SAR
                                                        </td>
                                                    </tr>
                                                    <tr className={`bg-white ${ticketSeverity === 'SIGNIFICANT' ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}>
                                                        <td className="px-2 py-1.5 border-b border-indigo-100">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                                                <strong className="text-yellow-700">Significant</strong>
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 font-bold text-red-600">
                                                            12,000 SAR
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 font-bold text-red-600">
                                                            15,000 SAR
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100">
                                                            <span className="font-bold text-red-600">15,000 SAR</span>
                                                            <br />
                                                            <span className="text-orange-600">+ Stop Works</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-b border-l border-indigo-100 font-bold text-red-600">
                                                            20,000 SAR
                                                        </td>
                                                    </tr>
                                                    <tr className={`bg-white ${ticketSeverity === 'MAJOR' ? 'ring-2 ring-red-400 ring-inset' : ''}`}>
                                                        <td className="px-2 py-1.5">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                                                <strong className="text-red-700">Major</strong>
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-indigo-100">
                                                            <span className="font-bold text-red-600">25,000 SAR</span>
                                                            <br />
                                                            <span className="text-orange-600">+ Stop Works</span>
                                                            <br />
                                                            <span className="text-indigo-500">+ Meeting</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-indigo-100">
                                                            <span className="font-bold text-red-600">100,000 SAR</span>
                                                            <br />
                                                            <span className="text-orange-600">+ Stop Works</span>
                                                            <br />
                                                            <span className="text-indigo-500">+ Meeting</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-indigo-100">
                                                            <span className="font-bold text-red-600">150,000 SAR</span>
                                                            <br />
                                                            <span className="text-orange-600">+ Stop Works</span>
                                                            <br />
                                                            <span className="text-indigo-500">+ Meeting</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-indigo-100">
                                                            <span className="font-bold text-red-600">300,000 SAR</span>
                                                            <br />
                                                            <span className="text-indigo-500">+ Review</span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Important notes */}
                                    <div className="bg-white border border-indigo-100 rounded-lg p-2.5 space-y-1">
                                        <p className="text-[10px] font-bold text-indigo-700">
                                            {isRtl ? '📌 ملاحظات مهمة:' : '📌 Important Notes:'}
                                        </p>
                                        <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc ps-4 leading-relaxed">
                                            <li>{isRtl ? 'كل مخالفة Major يجب أن يُصاحبها اجتماع HSE Violation Meeting' : 'Each Major Violation must be accompanied by an HSE Violation Meeting'}</li>
                                            <li>{isRtl ? 'الحالة الواحدة قد تحمل مخالفات متعددة' : 'Some scenarios may carry multiple offences'}</li>
                                            <li>{isRtl ? 'يُحتفظ بسجل لجميع المخالفات لكل مقاول' : 'A log of all offences is maintained per contractor'}</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No service provider notice */}
                    {violationType && violationType !== 'NONE' && !serviceProviderId && (
                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <p className="text-xs text-slate-500 font-medium text-center">
                                ℹ️ {isRtl ? 'لا يوجد مزود خدمة مرتبط بالتذكرة — سجل المخالفات غير متوفر' : 'No service provider linked — violation history unavailable'}
                            </p>
                        </div>
                    )}

                    {/* Description */}
                    {violationType !== null && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    {violationType === 'FINANCIAL' || violationType === 'WARNING'
                                        ? (isRtl ? 'وصف المخالفة والقرار' : 'Violation Details & Decision')
                                        : (isRtl ? 'سبب الإغلاق / ملاحظات نهائية' : 'Closure Reason / Final Notes')}
                                    {violationType !== 'NONE' && <span className="text-red-500 ms-1">*</span>}
                                </label>
                                <textarea
                                    value={violationDescription}
                                    onChange={(e) => setViolationDescription(e.target.value)}
                                    rows={4}
                                    placeholder={violationType === 'FINANCIAL' || violationType === 'WARNING'
                                        ? (isRtl ? 'اكتب تفاصيل المخالفة والقرار المتخذ...' : 'Enter details of the violation and decision...')
                                        : (isRtl ? 'اكتب سبب الإغلاق أو أي ملاحظات نهائية...' : 'Enter reason for closure or any final notes...')}
                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white resize-y min-h-[100px]"
                                />
                            </div>

                            {violationType === 'FINANCIAL' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                        {isRtl ? 'مبلغ المخالفة (ريال)' : 'Violation Amount (SAR)'}
                                        <span className="text-red-500 ms-1">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={violationAmount}
                                        onChange={(e) => setViolationAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                                        placeholder={isRtl ? 'مثال: 5000' : 'e.g. 5000'}
                                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white"
                                        dir="ltr"
                                    />
                                    <p className="text-[11px] text-amber-700 mt-1.5 flex items-start gap-1.5">
                                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                        {isRtl
                                            ? 'سيتم إرسال إشعار تلقائي لقسم المالية بهذه المخالفة.'
                                            : 'Finance department will be auto-notified of this violation.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50"
                        >
                            {isRtl ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {isRtl ? 'تأكيد الإغلاق' : 'Confirm & Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloseTicketModal;
