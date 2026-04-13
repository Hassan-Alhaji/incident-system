import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import {
    AlertTriangle, Clock, CheckCircle, Search, Filter, Eye,
    FileWarning, ShieldAlert, Flame, Zap, Activity, ChevronRight,
    XCircle, Loader2, RefreshCw, Paperclip, Plus, ClipboardList, Timer
} from 'lucide-react';

// Fix #24: Relative time helper
const getRelativeTime = (date: Date, t: any): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return t('oc.time.justNow');
    if (mins < 60) return t('oc.time.minsAgo', { count: mins });
    if (hrs < 24) return t('oc.time.hoursAgo', { count: hrs });
    if (days < 7) return t('oc.time.daysAgo', { count: days });
    return formatDate(date);
};

interface Ticket {
    id: string;
    ticketNo: string;
    type: string;
    status: string;
    priority: string;
    description: string;
    hasInjury: boolean;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
    incidentDate: string;
    createdBy?: { name: string; role: string };
    assignedTo?: { name: string; role: string };
    offCircuitReport?: any;
    _count?: { attachments: number };
}

const statusColors: Record<string, string> = {
    OPEN: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    SUPERVISOR_REVIEW: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    RETURNED_FOR_EDIT: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    UNDER_INVESTIGATION: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    FINAL_REVIEW: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    CLOSED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    CLOSED_REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const priorityColors: Record<string, string> = {
    LOW: 'bg-slate-600/30 text-slate-300',
    MEDIUM: 'bg-amber-500/15 text-amber-400',
    HIGH: 'bg-orange-500/15 text-orange-400',
    CRITICAL: 'bg-red-500/15 text-red-400',
};

const typeIcons: Record<string, React.ReactNode> = {
    VIOLATION: <ShieldAlert size={14} />,
    INJURY: <AlertTriangle size={14} />,
    FIRE: <Flame size={14} />,
    NEAR_MISS: <Zap size={14} />,
    HEALTH: <Activity size={14} />,
    PROPERTY_DAMAGE: <FileWarning size={14} />,
    SECURITY_BREACH: <ShieldAlert size={14} />,
};

const OCDashboard = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [showFilters, setShowFilters] = useState(false);

    const getTicketDuration = (ticket: any) => {
        const start = new Date(ticket.createdAt).getTime();
        const end = (ticket.status === 'CLOSED' || ticket.status === 'CLOSED_REJECTED') && ticket.closedAt 
            ? new Date(ticket.closedAt).getTime() 
            : new Date().getTime();
        
        const diffMs = end - start;
        if (diffMs <= 0) return '0m';

        const totalMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    // Fix #10: Pull-to-Refresh
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = React.useRef(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling) return;
        const y = e.touches[0].clientY - touchStartY.current;
        if (y > 0 && y < 150) {
            setPullDistance(y);
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance > 60) {
            setIsRefreshing(true);
            setPullDistance(0);
            await fetchTickets();
            setIsRefreshing(false);
        } else {
            setPullDistance(0);
        }
        setIsPulling(false);
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await api.get('/oc/tickets');
            setTickets(res.data);
        } catch (err) {
            console.error('Failed to fetch tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    // Fix #8: expanded search — includes reporter name, incident type, date
    const filtered = tickets.filter(t => {
        if (search) {
            const q = search.toLowerCase();
            const matchTicketNo = t.ticketNo.toLowerCase().includes(q);
            const matchDesc = t.description?.toLowerCase().includes(q);
            const matchReporter = t.createdBy?.name?.toLowerCase().includes(q);
            const matchType = t.offCircuitReport?.incidentType?.toLowerCase().includes(q) || t.type?.toLowerCase().includes(q);
            const matchDate = t.offCircuitReport?.incidentDate?.includes(q);
            if (!matchTicketNo && !matchDesc && !matchReporter && !matchType && !matchDate) return false;
        }
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        return true;
    });

    // Stats
    const stats = {
        open: tickets.filter(t => ['OPEN', 'SUPERVISOR_REVIEW'].includes(t.status)).length,
        investigation: tickets.filter(t => t.status === 'UNDER_INVESTIGATION').length,
        review: tickets.filter(t => t.status === 'FINAL_REVIEW').length,
        closed: tickets.filter(t => ['CLOSED', 'CLOSED_REJECTED'].includes(t.status)).length,
        injuries: tickets.filter(t => t.hasInjury).length,
    };

    const statuses = ['ALL', 'OPEN', 'SUPERVISOR_REVIEW', 'RETURNED_FOR_EDIT', 'UNDER_INVESTIGATION', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'];

    return (
        <div
            ref={containerRef}
            className="space-y-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Fix #10: Pull-to-refresh indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div className="flex justify-center items-center transition-all duration-200" style={{ height: isRefreshing ? 40 : pullDistance * 0.5 }}>
                    <div className={`flex items-center gap-2 text-xs font-medium ${pullDistance > 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-amber-400' : ''}
                            style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
                        {isRefreshing ? t('oc.dashboard.refreshing') || 'Refreshing...' : pullDistance > 60 ? (t('oc.dashboard.releaseToRefresh') || 'Release to refresh') : (t('oc.dashboard.pullToRefresh') || 'Pull to refresh')}
                    </div>
                </div>
            )}

            {/* Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">{t('oc.dashboard.title')}</h1>
                    <p className="text-slate-400 text-xs mt-0.5">{t('oc.dashboard.subtitle')}</p>
                </div>
                <button onClick={fetchTickets} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 transition-all">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-blue-400" />
                        <span className="text-xs text-slate-400">{t('oc.dashboard.open')}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.open}</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Search size={14} className="text-purple-400" />
                        <span className="text-xs text-slate-400">{t('oc.dashboard.investigating')}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.investigation}</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={14} className="text-emerald-400" />
                        <span className="text-xs text-slate-400">{t('oc.dashboard.closed')}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.closed}</p>
                </div>
                <div className="bg-slate-900/80 border border-red-500/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-red-400" />
                        <span className="text-xs text-red-400">{t('oc.dashboard.injuries')}</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats.injuries}</p>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('oc.dashboard.searchPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                        dir="ltr"
                    />
                </div>
                <button onClick={() => setShowFilters(!showFilters)}
                    className={`p-2.5 rounded-xl border transition-all ${showFilters ? 'bg-amber-500/15 border-amber-500/50 text-amber-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                    <Filter size={16} />
                </button>
            </div>

            {showFilters && (
                <div className="flex flex-wrap gap-1.5">
                    {statuses.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                                ${statusFilter === s ? 'bg-amber-500/15 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`}>
                            {s === 'ALL' ? t('oc.dashboard.all') : t(`oc.status.${s}`)}
                        </button>
                    ))}
                </div>
            )}

            {/* Ticket List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-amber-500" size={28} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                    {/* Fix #18: Enhanced empty state */}
                    <div className="relative mx-auto w-24 h-24 mb-2">
                        <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                        <div className="relative w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-dashed border-slate-600 rounded-full flex items-center justify-center">
                            <ClipboardList size={36} className="text-slate-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-white text-base font-bold">{t('oc.dashboard.noTickets')}</p>
                        <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                            {t('oc.dashboard.noTicketsHint')}
                        </p>
                    </div>
                    <button onClick={() => navigate('/oc/tickets/new')}
                        className="mt-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700 hover:shadow-amber-500/40 transition-all flex items-center gap-2 mx-auto">
                        <Plus size={16} />
                        {t('oc.dashboard.createFirst')}
                    </button>
                    <p className="text-slate-600 text-[10px] mt-2">{t('oc.dashboard.pullHint') || 'Pull down to refresh'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(ticket => (
                        <button
                            key={ticket.id}
                            onClick={() => navigate(`/oc/tickets/${ticket.id}`)}
                            className={`w-full text-left bg-slate-900/80 border rounded-xl p-4 hover:bg-slate-800/80 transition-all group
                                ${ticket.hasInjury 
                                    ? 'border-l-4 border-l-red-500 border-t-slate-700/50 border-r-slate-700/50 border-b-slate-700/50' 
                                    : 'border-slate-700/50 hover:border-slate-600'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-xs font-mono text-amber-400/80" dir="ltr">{ticket.ticketNo}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[ticket.status] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                            {t(`oc.status.${ticket.status}`)}
                                        </span>
                                        {ticket.hasInjury && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                                <AlertTriangle size={10} />
                                                {t('oc.injury')}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 
                                            ${(ticket.status === 'CLOSED' || ticket.status === 'CLOSED_REJECTED') ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                            <Timer size={10} />
                                            {getTicketDuration(ticket)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 truncate">{ticket.description || t('oc.noDescription')}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            {typeIcons[ticket.type] || <FileWarning size={12} />}
                                            {t(`oc.incidentTypes.${ticket.offCircuitReport?.incidentType || ticket.type}`)}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityColors[ticket.priority] || ''}`}>
                                            {t(`priority.${ticket.priority}`)}
                                        </span>
                                        {(ticket._count?.attachments ?? 0) > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Paperclip size={10} />
                                                {ticket._count?.attachments}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1" title={formatDateTime(ticket.createdAt)}>
                                            <Clock size={10} />
                                            {getRelativeTime(new Date(ticket.createdAt), t)}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-600 group-hover:text-amber-400 transition-colors flex-shrink-0 mt-1" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OCDashboard;
