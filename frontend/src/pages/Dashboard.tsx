import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { getRandomSafetyTip } from '../utils/safetyTips';
import {
  AlertTriangle, Clock, CheckCircle, Search, Filter,
  FileWarning, ShieldAlert, Flame, Zap, Activity, ChevronRight,
  Loader2, RefreshCw, Paperclip, Plus, ClipboardList,
  Timer, TrendingUp, Activity as ActivityIcon, MapPin, Sparkles, X,
  Lightbulb,
} from 'lucide-react';
import { STATUS_CONFIG } from '../utils/statusConfig';

const getRelativeTime = (date: Date, t: any): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return t('oc.time.justNow');
  if (mins < 60) return t('oc.time.minsAgo',  { count: mins });
  if (hrs  < 24) return t('oc.time.hoursAgo', { count: hrs  });
  if (days < 7)  return t('oc.time.daysAgo',  { count: days });
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
  zone?: { name: string };
  location?: string;
  _count?: { attachments: number };
}



const PRIORITY_CONFIG: Record<string, { label: string; chipCls: string }> = {
  MINOR:       { label: 'Minor',       chipCls: 'bg-blue-100 text-blue-700' },
  SIGNIFICANT: { label: 'Significant', chipCls: 'bg-amber-100 text-amber-700' },
  MAJOR:       { label: 'Major',       chipCls: 'bg-orange-100 text-orange-700' },
  SEVERE:      { label: 'Severe',      chipCls: 'bg-red-100 text-red-700' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  VIOLATION:       <ShieldAlert size={11} />,
  INJURY:          <AlertTriangle size={11} />,
  FIRE:            <Flame size={11} />,
  NEAR_MISS:       <Zap size={11} />,
  HEALTH:          <Activity size={11} />,
  PROPERTY_DAMAGE: <FileWarning size={11} />,
  SECURITY_BREACH: <ShieldAlert size={11} />,
};

const getTicketDuration = (ticket: Ticket): string => {
  const start = new Date(ticket.createdAt).getTime();
  const end =
    (ticket.status === 'CLOSED' || ticket.status === 'CLOSED_REJECTED') && ticket.closedAt
      ? new Date(ticket.closedAt).getTime()
      : Date.now();
  const totalMins = Math.floor(Math.max(0, end - start) / 60000);
  const hours = Math.floor(totalMins / 60);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0)  return `${hours}h ${totalMins % 60}m`;
  return `${totalMins}m`;
};

// Stage colors shown below each ticket card (labels moved to i18n: oc.stageDesc.*)
const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  OPEN:                   { color: '#3b82f6', bg: '#eff6ff' },
  SUBMITTED:              { color: '#3b82f6', bg: '#eff6ff' },
    ASSIGNED:               { color: '#f59e0b', bg: '#fffbeb' },
  RETURNED_TO_REPORTER:   { color: '#f97316', bg: '#fff7ed' },
  RETURNED_TO_DEPARTMENT: { color: '#f97316', bg: '#fff7ed' },
  UNDER_REVIEW:           { color: '#6366f1', bg: '#f0f9ff' },
  PENDING_REMINDER:       { color: '#eab308', bg: '#fefce8' },
  ESCALATED:              { color: '#ef4444', bg: '#fef2f2' },
  CLOSED:                 { color: '#10b981', bg: '#ecfdf5' },
  CLOSED_REJECTED:        { color: '#f43f5e', bg: '#fff1f2' },
};



const Dashboard = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showFilters,  setShowFilters]  = useState(false);

  // Safety tip state
  const isRtl = i18n.dir() === 'rtl';
  const currentLang: 'ar' | 'en' = isRtl ? 'ar' : 'en';
  const [safetyTip, setSafetyTip] = useState(() => getRandomSafetyTip(currentLang));
  const [tipFade, setTipFade] = useState(true);

  const rotateTip = useCallback(() => {
    setTipFade(false);
    setTimeout(() => { setSafetyTip(getRandomSafetyTip(currentLang)); setTipFade(true); }, 400);
  }, [currentLang]);

  useEffect(() => {
    const interval = setInterval(rotateTip, 12000);
    return () => clearInterval(interval);
  }, [rotateTip]);

  useEffect(() => { setSafetyTip(getRandomSafetyTip(currentLang)); }, [currentLang]);

  const isDepRepOrManager = user?.role === 'DEP_REP' || user?.role === 'DEP_MANAGER';

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tickets');
      const data = res.data;
      setTickets(Array.isArray(data) ? data : data.tickets || []);
    } catch (err) { console.error('Failed to fetch tickets:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling,    setIsPulling]    = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY  = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) { touchStartY.current = e.touches[0].clientY; setIsPulling(true); }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const y = e.touches[0].clientY - touchStartY.current;
    if (y > 0 && y < 150) setPullDistance(y);
  };
  const handleTouchEnd = async () => {
    if (pullDistance > 60) { setIsRefreshing(true); setPullDistance(0); await fetchTickets(); setIsRefreshing(false); }
    else setPullDistance(0);
    setIsPulling(false);
  };

  const filtered = tickets.filter(ticket => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        ticket.ticketNo.toLowerCase().includes(q) ||
        ticket.description?.toLowerCase().includes(q) ||
        ticket.createdBy?.name?.toLowerCase().includes(q) ||
        ticket.offCircuitReport?.incidentType?.toLowerCase().includes(q) ||
        ticket.type?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
    return true;
  });

  // Sort: open/active first, closed last
  const sortedFiltered = [...filtered].sort((a, b) => {
    const aClosed = ['CLOSED', 'CLOSED_REJECTED'].includes(a.status);
    const bClosed = ['CLOSED', 'CLOSED_REJECTED'].includes(b.status);
    if (aClosed && !bClosed) return 1;
    if (!aClosed && bClosed) return -1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Stats
  const total         = tickets.length;
  const activeCount   = tickets.filter(t => !['CLOSED', 'CLOSED_REJECTED'].includes(t.status)).length;
  const closedCount   = tickets.filter(t =>  ['CLOSED', 'CLOSED_REJECTED'].includes(t.status)).length;
  const injuryCount   = tickets.filter(t => t.hasInjury).length;
  const statCards = [
    { label: 'Total',    value: total,       gradient: 'from-indigo-500 to-blue-600',  softBg: 'from-indigo-50 to-blue-50',  icon: <ClipboardList size={18} /> },
    { label: 'Active',   value: activeCount, gradient: 'from-amber-500 to-orange-500', softBg: 'from-amber-50 to-orange-50', icon: <ActivityIcon size={18} /> },
    { label: 'Closed',   value: closedCount, gradient: 'from-emerald-500 to-teal-600', softBg: 'from-emerald-50 to-teal-50', icon: <CheckCircle size={18} /> },
    { label: 'Injuries', value: injuryCount, gradient: 'from-rose-500 to-red-600',     softBg: 'from-rose-50 to-red-50',     icon: <AlertTriangle size={18} /> },
  ];

  const statuses = [
    'ALL', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW',
    'RETURNED_TO_DEPARTMENT', 'RETURNED_TO_REPORTER',
    'ESCALATED', 'CLOSED',
  ];

  const getStatusLabel = (s: string) => s === 'ALL' ? t('dashboard.allStatus', 'All Statuses') : t(`status.${s}`, STATUS_CONFIG[s]?.label || s.replace(/_/g, ' '));

  return (
    <div
      ref={containerRef}
      className="space-y-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex justify-center items-center transition-all duration-200" style={{ height: isRefreshing ? 40 : pullDistance * 0.5 }}>
          <div className={`flex items-center gap-2 text-xs font-medium ${pullDistance > 60 ? 'text-blue-600' : 'text-slate-400'}`}>
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
            {isRefreshing ? t('common.refreshing', 'Refreshing...') : pullDistance > 60 ? t('common.releaseToRefresh', 'Release to refresh') : t('common.pullToRefresh', 'Pull to refresh')}
          </div>
        </div>
      )}

      {/* ── Hero header with gradient ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-5 shadow-lg shadow-blue-900/20">
        <div className="absolute top-0 ltr:right-0 rtl:left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 ltr:left-12 rtl:right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center ring-1 ring-white/20">
              <Sparkles size={20} className="text-blue-200" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white leading-tight">{t('oc.dashboard.title')}</h1>
              <p className="text-blue-100 text-xs mt-0.5">{t('oc.dashboard.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={fetchTickets}
            className="h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur rounded-xl ring-1 ring-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-all flex-shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Safety Tip ── */}
      <div
        onClick={rotateTip}
        className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border border-amber-200/60 rounded-2xl p-4 cursor-pointer group hover:shadow-md hover:border-amber-300/60 transition-all duration-200"
      >
        <div className="absolute -top-8 ltr:-right-8 rtl:-left-8 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-400/30 group-hover:scale-110 transition-transform">
            <Lightbulb size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                {isRtl ? 'نصيحة توعوية' : 'Safety Tip'}
              </p>
              <span className="ltr:ml-auto rtl:mr-auto text-[9px] text-amber-400 group-hover:text-amber-500 transition-colors">
                {isRtl ? 'انقر للتغيير' : 'click to rotate'}
              </span>
            </div>
            <p
              className={`text-sm text-amber-900 leading-relaxed transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {safetyTip}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.softBg} border border-white p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">{card.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">{card.label}</p>

            <div className={`absolute -bottom-6 ltr:-right-6 rtl:-left-6 w-20 h-20 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
          </div>
        ))}
      </div>

      {/* Injury alert */}
      {injuryCount > 0 && !isDepRepOrManager && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-rose-600" />
          </div>
          <p className="text-sm text-rose-800 font-semibold">
            <strong className="text-base font-black">{injuryCount}</strong> {t('dashboard.injuryAlert', 'ticket(s) with recorded injuries')}
          </p>
        </div>
      )}

      {/* ── Search + Filter ── */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('oc.dashboard.searchPlaceholder')}
            className="w-full bg-white border border-slate-200 rounded-xl ltr:pl-9 ltr:pr-9 rtl:pr-9 rtl:pl-9 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm focus:outline-none"
            dir="ltr"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 px-4 rounded-xl border transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold
            ${showFilters
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-transparent text-white shadow-blue-500/30'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <Filter size={14} />
          {showFilters ? t('dashboard.hideFilter', 'Hide') : t('dashboard.showFilter', 'Filter')}
          {statusFilter !== 'ALL' && !showFilters && (
            <span className="ltr:ml-1 rtl:mr-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center">1</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
          {statuses.map(s => {
            const active = statusFilter === s;
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${active
                    ? 'border-transparent text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'}`}
                style={active && cfg ? { background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}dd)` } : undefined}
              >
                {getStatusLabel(s)}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Ticket list ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={26} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-slate-100">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ClipboardList size={32} className="text-blue-400" />
          </div>
          <div>
            <p className="text-slate-700 font-bold text-base">{t('oc.dashboard.noTickets')}</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">{t('oc.dashboard.noTicketsHint')}</p>
          </div>
          <button
            onClick={() => navigate('/tickets/new')}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-600/30 transition-all hover:-translate-y-0.5"
          >
            <Plus size={15} />
            {t('oc.dashboard.createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedFiltered.map(ticket => {
            const statusCfg   = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
            const priorityCfg = PRIORITY_CONFIG[ticket.priority];
            const isClosed    = ticket.status === 'CLOSED' || ticket.status === 'CLOSED_REJECTED';
            const locationLabel = ticket.zone?.name || ticket.location;

            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden flex"
              >
                <div
                  className="w-1 flex-shrink-0"
                  style={{ background: `linear-gradient(180deg, ${statusCfg.accent}, ${statusCfg.accent}66)` }}
                />

                <div className="flex-1 p-3 sm:p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">

                      {/* Chips row — wraps on mobile */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0"
                          style={{ color: statusCfg.accent, background: `${statusCfg.accent}10` }}
                          dir="ltr"
                        >
                          {ticket.ticketNo}
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${statusCfg.chip}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.accent }} />
                          {t(`status.${ticket.status}`, statusCfg.label)}
                        </span>

                        {ticket.hasInjury && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 bg-gradient-to-br from-rose-50 to-red-50 text-rose-700 ring-1 ring-rose-200">
                            <AlertTriangle size={9} />
                            {t('oc.injury', 'Injury')}
                          </span>
                        )}

                        {priorityCfg && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${priorityCfg.chipCls}`}>
                            {t(`priority.${ticket.priority}`, priorityCfg.label)}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-700 line-clamp-2 leading-snug font-medium">
                        {ticket.description || t('oc.noDescription')}
                      </p>

                      {/* Metadata row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium shrink-0">
                          {TYPE_ICONS[ticket.type] || <FileWarning size={11} />}
                          <span className="hidden sm:inline">{ticket.offCircuitReport?.incidentType || ticket.type}</span>
                        </span>

                        {locationLabel && (
                          <span className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold truncate max-w-[120px] sm:max-w-[180px]">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{locationLabel}</span>
                          </span>
                        )}

                        {(ticket._count?.attachments ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                            <Paperclip size={10} />
                            {ticket._count?.attachments}
                          </span>
                        )}

                        <span
                          className={`flex items-center gap-1 text-[11px] shrink-0 ${isClosed ? 'text-slate-300' : 'text-slate-400'}`}
                          title={formatDateTime(ticket.createdAt)}
                        >
                          <Timer size={10} />
                          {getTicketDuration(ticket)}
                        </span>

                        <span className="flex items-center gap-1 text-[11px] text-slate-400 ltr:ml-auto rtl:mr-auto shrink-0">
                          <Clock size={10} />
                          {getRelativeTime(new Date(ticket.createdAt), t)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      size={16}
                      className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all flex-shrink-0 mt-1"
                    />
                  </div>

                  {/* Stage label */}
                  {STAGE_COLORS[ticket.status] && (
                    <div className="px-1 pb-1">
                      <span
                        className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ color: STAGE_COLORS[ticket.status].color, background: STAGE_COLORS[ticket.status].bg }}
                      >
                        {t(`oc.stageDesc.${ticket.status}`, '')}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
