import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

type ConfirmVariant = 'danger' | 'primary' | 'success' | 'warning';

interface ConfirmModalProps {
    confirmPending: {
        fn: () => void;
        label: string;
        description: string;
        variant: ConfirmVariant;
    } | null;
    actionLoading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const variantColors: Record<ConfirmVariant, { bar: string; iconBg: string; btn: string; icon: string }> = {
    danger:  { bar: 'bg-red-500',     iconBg: 'bg-red-100',     btn: 'bg-red-600 hover:bg-red-700',         icon: '⚠️' },
    warning: { bar: 'bg-amber-500',   iconBg: 'bg-amber-100',   btn: 'bg-amber-500 hover:bg-amber-600',     icon: '⬆️' },
    success: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-100', btn: 'bg-emerald-600 hover:bg-emerald-700', icon: '✅' },
    primary: { bar: 'bg-blue-600',    iconBg: 'bg-blue-100',    btn: 'bg-blue-600 hover:bg-blue-700',       icon: '📋' },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({ confirmPending, actionLoading, onConfirm, onCancel }) => {
    const { t } = useTranslation();

    if (!confirmPending) return null;

    const v = variantColors[confirmPending.variant];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                <div className={`h-1.5 w-full ${v.bar}`} />
                <div className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${v.iconBg}`}>
                            {v.icon}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-base leading-tight">{confirmPending.label}</h3>
                            <p className="text-slate-500 text-sm mt-1 leading-relaxed whitespace-pre-line">{confirmPending.description}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={onCancel}
                            className="py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                        >
                            {t('ticketDetail.cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={actionLoading}
                            className={`py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${v.btn}`}
                        >
                            {actionLoading && <Loader2 size={14} className="animate-spin" />}
                            {t('ticketDetail.confirmAction')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
