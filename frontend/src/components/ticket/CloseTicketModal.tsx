import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface CloseTicketModalProps {
    open: boolean;
    hasEmployeeInjury?: boolean;
    onCancel: () => void;
    onConfirm: (payload: {
        violationType: 'NONE' | 'WARNING' | 'FINANCIAL';
        violationDescription: string;
        violationAmount: string;
    }) => void;
    loading?: boolean;
}

const CloseTicketModal: React.FC<CloseTicketModalProps> = ({ open, hasEmployeeInjury, onCancel, onConfirm, loading }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.dir() === 'rtl';

    const [violationType, setViolationType] = useState<'NONE' | 'WARNING' | 'FINANCIAL' | null>(null);
    const [violationDescription, setViolationDescription] = useState('');
    const [violationAmount, setViolationAmount] = useState('');

    useEffect(() => {
        if (open) {
            setViolationType(hasEmployeeInjury ? 'NONE' : null);
            setViolationDescription('');
            setViolationAmount('');
        }
    }, [open, hasEmployeeInjury]);

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
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-emerald-500" />
                <div className="p-5">
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

                    {/* Financial violation question */}
                    {!hasEmployeeInjury && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {isRtl ? 'هل توجد مخالفة؟' : 'Is there a violation?'}
                                <span className="text-red-500 ms-1">*</span>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setViolationType('NONE')}
                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        violationType === 'NONE'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                    {isRtl ? 'لا توجد' : 'None'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViolationType('WARNING')}
                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        violationType === 'WARNING'
                                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                    {isRtl ? 'تحذيرية' : 'Warning'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViolationType('FINANCIAL')}
                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        violationType === 'FINANCIAL'
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                    {isRtl ? 'مالية' : 'Financial'}
                                </button>
                            </div>
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
