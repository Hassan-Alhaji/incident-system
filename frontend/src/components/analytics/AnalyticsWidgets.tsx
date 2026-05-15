import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, AlertOctagon, Users } from 'lucide-react';

// Type color map — matches active TicketType enum values
export const TYPE_COLORS: Record<string, { bg: string; text: string; label: string; labelAr: string }> = {
    OBSERVATION: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Observation', labelAr: 'ملاحظة' },
    SECURITY:    { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Security', labelAr: 'أمن' },
    ACCIDENT:    { bg: 'bg-rose-200', text: 'text-rose-900', label: 'Accident', labelAr: 'حادث' },
    OTHER:       { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Other', labelAr: 'أخرى' },
};

export const ServiceProviderCard: React.FC<{ sp: any; rank: number; t: any; isRtl: boolean }> = ({ sp, rank, t, isRtl }) => {
    const [expanded, setExpanded] = useState(false);
    const types = Object.entries(sp.byType || {}).sort((a: any, b: any) => b[1] - a[1]);
    const maxTypeCount = types.length > 0 ? (types[0][1] as number) : 1;

    const rankColors = ['from-red-600 to-rose-700', 'from-orange-500 to-amber-600', 'from-amber-400 to-yellow-500'];
    const rankColor = rank <= 3 ? rankColors[rank - 1] : 'from-slate-400 to-slate-500';

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-md">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors text-left"
            >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${rankColor} text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm`}>
                    {rank}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{sp.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                        {isRtl ? sp.departmentAr || sp.department : sp.department}
                        {sp.crNumber && <span className="text-slate-400 mx-1">•</span>}
                        {sp.crNumber && <span className="font-mono text-slate-400">{t('analytics.spv.cr', 'CR')}: {sp.crNumber}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {sp.hasInjury > 0 && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            🩹 {sp.hasInjury}
                        </span>
                    )}
                    <span className="text-2xl font-black text-red-600">{sp.totalViolations}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-wrap gap-2">
                        <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                            📋 {t('analytics.spv.dept', 'Dept')}: {isRtl ? sp.departmentAr || sp.department : sp.department}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${sp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {sp.status === 'ACTIVE' ? '🟢' : '🔴'} {sp.status}
                        </span>
                        <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                            {t('analytics.spv.total', 'Total')}: {sp.totalViolations} {t('analytics.spv.violations', 'violations')}
                        </span>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-700 mb-2">{t('analytics.spv.byType', 'Violations by Type')}:</p>
                        <div className="space-y-1.5">
                            {types.map(([typeKey, count]: any) => {
                                const tc = TYPE_COLORS[typeKey] || TYPE_COLORS.OTHER;
                                const pct = (count / maxTypeCount) * 100;
                                return (
                                    <div key={typeKey} className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tc.bg} ${tc.text} min-w-[100px] text-center flex-shrink-0`}>
                                            {isRtl ? tc.labelAr : tc.label}
                                        </span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className={`h-full rounded-full ${tc.bg}`} style={{ width: `${pct}%`, minWidth: count > 0 ? '8px' : '0' }} />
                                        </div>
                                        <span className="text-xs font-black text-slate-700 w-6 text-right flex-shrink-0">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Reusable section wrapper
export const Section: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
                {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
            </div>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// Progress bar
export const ProgressBar: React.FC<{ value: number; color?: string; height?: number }> = ({ value, color, height = 8 }) => {
    const pctColor = (pct: number) => pct >= 80 ? '#10b981' : pct >= 60 ? '#84cc16' : pct >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color || pctColor(value) }} />
        </div>
    );
};
