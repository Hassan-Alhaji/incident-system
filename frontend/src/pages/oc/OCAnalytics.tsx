import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import {
    BarChart3, TrendingUp, AlertTriangle, Clock, CheckCircle,
    Loader2, Activity, Users, ShieldAlert, Flame, Download, FileSpreadsheet
} from 'lucide-react';

const OCAnalytics = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/oc/analytics');
                setData(res.data);
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to load analytics');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
    );

    if (error) return (
        <div className="text-center py-20">
            <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
            <p className="text-red-400 text-sm">{error}</p>
        </div>
    );

    if (!data) return null;

    const statusColors: Record<string, string> = {
        OPEN: 'bg-blue-500', SUPERVISOR_REVIEW: 'bg-yellow-500', RETURNED_FOR_EDIT: 'bg-orange-500',
        UNDER_INVESTIGATION: 'bg-purple-500', FINAL_REVIEW: 'bg-cyan-500',
        CLOSED: 'bg-emerald-500', CLOSED_REJECTED: 'bg-red-500'
    };

    const priorityColors: Record<string, string> = {
        LOW: 'bg-slate-500', MEDIUM: 'bg-yellow-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500'
    };

    const typeIcons: Record<string, React.ReactNode> = {
        VIOLATION: <ShieldAlert size={14} />, FIRE: <Flame size={14} />,
        INJURY: <AlertTriangle size={14} />, NEAR_MISS: <Activity size={14} />,
    };

    // Build monthly trend bars
    const monthKeys = Object.keys(data.monthlyTrend).sort();
    const maxMonthly = Math.max(...monthKeys.map(k => data.monthlyTrend[k].total), 1);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await api.get('/oc/tickets/export', { 
                params: { startDate, endDate },
                responseType: 'blob' 
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const a = document.createElement('a'); a.href = url;
            a.download = `oc_tickets_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click(); 
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch { 
            alert('Export failed. Please check your connection or permissions.'); 
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-4 pb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-white">{t('oc.analytics.title')}</h1>
                    <p className="text-slate-400 text-xs mt-0.5">{t('oc.analytics.subtitle')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 border border-slate-700/50 p-2 rounded-xl">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-slate-800 border-none text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500" 
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-slate-800 border-none text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500" 
                    />
                    <button 
                        onClick={handleExport}
                        disabled={exporting}
                        className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-emerald-500/25 transition-all outline-none"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        {t('oc.analytics.exportExcel')}
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KPICard icon={<BarChart3 size={18} />} color="amber" label={t('oc.analytics.totalIncidents')} value={data.totalTickets} />
                <KPICard icon={<AlertTriangle size={18} />} color="red" label={t('oc.analytics.totalInjuries')} value={data.totalInjuries} />
                <KPICard icon={<Clock size={18} />} color="purple" label={t('oc.analytics.avgClosure')} value={data.avgClosureText || '0h'} />
                <KPICard icon={<CheckCircle size={18} />} color="emerald" label={t('oc.analytics.closedTickets')} value={data.closedCount} />
            </div>

            {/* Status Distribution */}
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Activity size={14} className="text-amber-400" /> {t('oc.analytics.statusDistribution')}
                </h3>
                <div className="space-y-2">
                    {Object.entries(data.statusDistribution).map(([status, count]: [string, any]) => {
                        const pct = data.totalTickets > 0 ? Math.round((count / data.totalTickets) * 100) : 0;
                        return (
                            <div key={status} className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-400 w-24 truncate">{t(`oc.status.${status}`)}</span>
                                <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                    <div className={`h-full rounded-full ${statusColors[status] || 'bg-slate-500'} transition-all duration-700`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-white font-bold w-8 text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Priority + Type side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority Distribution */}
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <ShieldAlert size={14} className="text-orange-400" /> {t('oc.analytics.byPriority')}
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(data.priorityDistribution).map(([priority, count]: [string, any]) => (
                            <div key={priority} className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[priority] || 'bg-slate-500'}`} />
                                <span className="text-xs text-slate-300 flex-1">{t(`priority.${priority}`)}</span>
                                <span className="text-sm text-white font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Type Distribution */}
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <BarChart3 size={14} className="text-blue-400" /> {t('oc.analytics.byType')}
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(data.typeDistribution).map(([type, count]: [string, any]) => (
                            <div key={type} className="flex items-center gap-3">
                                <span className="text-slate-500">{typeIcons[type] || <Activity size={14} />}</span>
                                <span className="text-xs text-slate-300 flex-1">{t(`oc.incidentTypes.${type}`)}</span>
                                <span className="text-sm text-white font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Monthly Trend — Fix #17: Improved chart */}
            {monthKeys.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> {t('oc.analytics.monthlyTrend')}
                    </h3>
                    <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: '160px' }}>
                        {monthKeys.map(k => {
                            const { total, injuries } = data.monthlyTrend[k];
                            const totalPct = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;
                            const injuryPct = maxMonthly > 0 ? (injuries / maxMonthly) * 100 : 0;
                            const monthLabel = k.split('-')[1] + '/' + k.split('-')[0].slice(2);
                            return (
                                <div key={k} className="flex-1 flex flex-col items-center gap-1 group" title={`${monthLabel}: ${total} total, ${injuries} injuries`}>
                                    <span className="text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">{total}</span>
                                    <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                                        {/* Total bar */}
                                        <div className="flex-1 rounded-t-md bg-gradient-to-t from-amber-600/80 to-amber-400/60 transition-all duration-700 hover:from-amber-500 hover:to-amber-300/80 relative"
                                            style={{ height: `${Math.max(totalPct, total > 0 ? 8 : 0)}%` }}>
                                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-amber-300 font-bold">{total > 0 ? total : ''}</span>
                                        </div>
                                        {/* Injury bar */}
                                        <div className="flex-1 rounded-t-md bg-gradient-to-t from-red-600/80 to-red-400/60 transition-all duration-700 hover:from-red-500 hover:to-red-300/80 relative"
                                            style={{ height: `${Math.max(injuryPct, injuries > 0 ? 8 : 0)}%` }}>
                                            {injuries > 0 && (
                                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-red-300 font-bold">{injuries}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-medium">{monthLabel}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-6 mt-4 justify-center border-t border-slate-800 pt-3">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400" /> <span className="text-[10px] text-slate-400">{t('oc.analytics.total')}</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-gradient-to-t from-red-600 to-red-400" /> <span className="text-[10px] text-slate-400">{t('oc.analytics.withInjuries')}</span></div>
                    </div>
                </div>
            )}

            {/* Top Reporters */}
            {data.topReporters.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Users size={14} className="text-cyan-400" /> {t('oc.analytics.topReporters')}
                    </h3>
                    <div className="space-y-2">
                        {data.topReporters.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{r.name}</p>
                                    <p className="text-[10px] text-slate-500">{r.role?.replace(/_/g, ' ')}</p>
                                </div>
                                <span className="text-sm font-bold text-amber-400">{r.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Helper ---
const KPICard = ({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string | number }) => {
    const bgMap: Record<string, string> = {
        amber: 'border-amber-500/30 from-amber-500/10', red: 'border-red-500/30 from-red-500/10',
        purple: 'border-purple-500/30 from-purple-500/10', emerald: 'border-emerald-500/30 from-emerald-500/10',
    };
    const textMap: Record<string, string> = { amber: 'text-amber-400', red: 'text-red-400', purple: 'text-purple-400', emerald: 'text-emerald-400' };

    return (
        <div className={`bg-gradient-to-br ${bgMap[color]} to-transparent border rounded-xl p-3 text-center`}>
            <div className={`mx-auto w-8 h-8 rounded-lg ${textMap[color]} bg-slate-800 flex items-center justify-center mb-1.5`}>{icon}</div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
        </div>
    );
};

export default OCAnalytics;
