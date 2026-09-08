import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  AlertTriangle, ShieldCheck, Clock, FileWarning, Activity,
  TrendingUp, TrendingDown, Users, MapPin, BarChart3, Sparkles,
  CheckCircle, XCircle, Eye, AlertOctagon, Calendar, Trophy, Flame,
  Download, Filter, X, ChevronRight, ChevronLeft, Briefcase, ChevronDown, Search,
  GraduationCap, ListFilter, Lock, ExternalLink, Shield, HardHat, HeartPulse,
  RefreshCw, Radio, Layers, Maximize2, Minimize2, Tv, Monitor
} from 'lucide-react';
import { useToast } from '../components/Toast';
import AnalyticsMap from '../components/AnalyticsMap';
import { Section, ProgressBar, ServiceProviderCard, TYPE_COLORS } from '../components/analytics';
import { SkeletonAnalytics } from '../components/Skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtNum = (n: number) => (n || 0).toLocaleString('en-US');
const pctColor = (pct: number) => pct >= 80 ? '#10b981' : pct >= 60 ? '#84cc16' : pct >= 40 ? '#f59e0b' : '#ef4444';

const getRciStyle = (level: string, t: any) => {
  const styles: Record<string, any> = {
    EXCELLENT:  { label: t('analytics.rci.excellent', 'Excellent'), color: '#059669', bg: '#ecfdf5', emoji: '🟢' },
    GOOD:       { label: t('analytics.rci.good', 'Good'), color: '#65a30d', bg: '#f7fee7', emoji: '🟡' },
    CONCERNING: { label: t('analytics.rci.concerning', 'Concerning'), color: '#ea580c', bg: '#fff7ed', emoji: '🟠' },
    POOR:       { label: t('analytics.rci.poor', 'Poor'), color: '#dc2626', bg: '#fef2f2', emoji: '🔴' },
  };
  return styles[level] || styles.POOR;
};

// ── Visual Vial / Cylinder Metric Card (Matching Image Left Red Box) ─────────
interface VialCardProps {
  label: string;
  count: number;
  total: number;
  gradient: string;
  textColor: string;
  borderColor: string;
  fillColor: string;
  icon?: string;
  isActive?: boolean;
  onClick?: () => void;
  isDark?: boolean;
  isFlashing?: boolean;
}

const VialCard: React.FC<VialCardProps> = ({
  label,
  count,
  total,
  gradient,
  textColor,
  borderColor,
  fillColor,
  icon,
  isActive = false,
  onClick,
  isDark = false,
  isFlashing = false,
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`flex flex-col justify-between p-2 sm:p-2.5 rounded-2xl transition-all select-none relative w-full ${
        onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
      } ${
        isFlashing
          ? 'ring-4 ring-emerald-400 dark:ring-emerald-300 animate-pulse shadow-2xl shadow-emerald-500/80 scale-[1.03]'
          : isActive
          ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30'
          : ''
      } ${
        isDark
          ? 'bg-slate-900/95 border border-slate-800 text-slate-200 hover:border-slate-700 shadow-md'
          : 'bg-white border border-slate-200 text-slate-800 shadow-sm hover:shadow-md'
      }`}
    >
      {isFlashing && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 z-20">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      )}

      {/* Top Header: Label & Big Prominent Number */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-xs">{icon}</span>}
          <span className={`text-xs sm:text-[13px] font-black truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 font-mono">
          <span className={`text-xl sm:text-2xl font-black ${textColor}`}>
            {count}
          </span>
          <span className="text-[10px] text-slate-400 font-bold">({pct}%)</span>
        </div>
      </div>

      {/* Horizontal 3D Glass Cylinder (Wide & Clear) */}
      <div className={`relative w-full h-3.5 sm:h-4 rounded-full border-2 ${borderColor} ${isDark ? 'bg-slate-950' : 'bg-slate-100'} overflow-hidden p-0.5 shadow-inner`}>
        {/* Horizontal Liquid Level */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden ${gradient}`}
          style={{ width: `${Math.max(6, pct)}%` }}
        >
          {/* Subtle liquid shimmer */}
          <div className="absolute inset-0 bg-white/25 opacity-50 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

// ── Dark Wallboard Executive Vial Metric Card (Compact for 100vh TV/Wallboard) ─
const ExecutiveVialCard: React.FC<VialCardProps> = ({ label, count, total, gradient, textColor, borderColor, fillColor }) => {
  const pct = total > 0 ? Math.min(100, Math.max(12, Math.round((count / total) * 100))) : 15;

  return (
    <div className="flex flex-col items-center justify-between p-1 rounded-xl bg-slate-950/70 border border-slate-800 shadow-inner">
      <span className="text-[10px] font-bold text-slate-300 text-center mb-1 h-5 flex items-center justify-center leading-tight">
        {label}
      </span>
      
      {/* 3D Glass Cylinder */}
      <div className={`relative w-9 h-14 sm:w-11 sm:h-16 rounded-xl border-2 ${borderColor} bg-slate-900/90 overflow-hidden flex flex-col justify-end p-0.5 shadow-inner`}>
        {/* Liquid level */}
        <div 
          className={`w-full rounded-lg transition-all duration-700 ease-out flex items-center justify-center relative overflow-hidden ${gradient}`}
          style={{ height: `${pct}%`, minHeight: '18px' }}
        >
          <div className="absolute inset-0 bg-white/20 opacity-40 animate-pulse" />
          <span className="font-black text-[10px] sm:text-xs text-white drop-shadow-sm z-10 font-mono">
            {count}
          </span>
        </div>
      </div>

      <div className="mt-1 text-center">
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${fillColor} ${textColor} font-mono`}>
          {count}
        </span>
      </div>
    </div>
  );
};

// ── Main Analytics Component ──────────────────────────────────────────────────
const Analytics = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // ── Executive Wallboard (Single-Page Fullscreen) State ─────────────────────
  const [isExecutiveMode, setIsExecutiveMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [wallboardTheme, setWallboardTheme] = useState<'LIGHT' | 'DARK'>(() => {
    return (localStorage.getItem('hse_analytics_theme') as 'LIGHT' | 'DARK') || 'LIGHT';
  });
  const isDark = wallboardTheme === 'DARK';
  const [activeFilter, setActiveFilter] = useState<{
    type: 'VIAL' | 'SEVERITY' | 'DEPARTMENT';
    key: string;
    label: string;
  } | null>(null);

  const handleToggleFilter = (type: 'VIAL' | 'SEVERITY' | 'DEPARTMENT', key: string, label: string) => {
    if (activeFilter && activeFilter.type === type && activeFilter.key === key) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ type, key, label });
    }
  };

  // ── Indicator Pulse Animation on Live Update (5 Seconds) ─────────────────
  const [flashingKpis, setFlashingKpis] = useState<Record<string, boolean>>({});
  const prevKpisRef = useRef<any>(null);

  useEffect(() => {
    if (!data?.executiveKpis) return;
    const current = data.executiveKpis;
    if (prevKpisRef.current) {
      const prev = prevKpisRef.current;
      const changed: Record<string, boolean> = {};
      let hasChange = false;
      ['total', 'resolved', 'inProgress', 'onTrack', 'overdue', 'critical'].forEach(key => {
        if (current[key] !== prev[key]) {
          changed[key] = true;
          hasChange = true;
        }
      });
      if (hasChange) {
        setFlashingKpis(changed);
        const timer = setTimeout(() => {
          setFlashingKpis({});
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
    prevKpisRef.current = current;
  }, [data]);

  const triggerManualPulse = () => {
    setFlashingKpis({ total: true, resolved: true, inProgress: true, onTrack: true, overdue: true, critical: true });
    setTimeout(() => {
      setFlashingKpis({});
    }, 5000);
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExecutiveMode) {
        setIsExecutiveMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecutiveMode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // ── Filters State ─────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];
  const startOfCurrentYear = `${currentYear}-01-01`;

  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState(startOfCurrentYear);
  const [dateTo, setDateTo] = useState(today);
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Active view: Executive Authority Dashboard (image) or Safety Culture (Heinrich)
  const [dashboardMode, setDashboardMode] = useState<'EXECUTIVE' | 'CULTURE'>('EXECUTIVE');

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const params: any = {};
      
      if (selectedYear !== 'ALL') {
        params.year = selectedYear;
      }
      if (selectedQuarter) {
        params.quarter = selectedQuarter;
      }
      if (selectedMonth) {
        params.month = selectedMonth;
      }
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        params.departmentId = selectedDepartment;
      }
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (selectedSeverity && selectedSeverity !== 'ALL') {
        params.severity = selectedSeverity;
      }

      if (showCustomDates && dateFrom && dateTo) {
        params.from = dateFrom;
        params.to = dateTo;
        delete params.year;
        delete params.quarter;
        delete params.month;
      }

      const res = await api.get('/analytics', { params });
      setData(res.data);
      setLastUpdated(new Date());

      if (res.data.isDepRestricted && res.data.userDepartment) {
        setSelectedDepartment(res.data.userDepartment.id);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;
      let friendlyMsg = serverMsg || t('analytics.errors.loadFailed', 'Failed to load analytics');
      if (status === 401) friendlyMsg = isRtl ? 'انتهت جلستك. يرجى تسجيل الدخول مجدداً.' : 'Session expired. Please log in again.';
      else if (status === 403) friendlyMsg = isRtl ? 'ليس لديك صلاحية لعرض الإحصائيات.' : 'You do not have permission to view analytics.';
      else if (status === 500) friendlyMsg = isRtl ? 'خطأ في الخادم (500). يرجى التواصل مع الدعم التقني إذا استمرت المشكلة.' : 'Server error (500). Contact support if this persists.';
      if (!isSilent) setError(friendlyMsg);
      // Silent refresh failures: keep showing old data, just stop the spinner
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedQuarter, selectedMonth, selectedDepartment, selectedStatus, selectedSeverity, showCustomDates]);

  // ── Real-time Auto Refresh Every 15 Seconds ──────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedYear, selectedQuarter, selectedMonth, selectedDepartment, selectedStatus, selectedSeverity, showCustomDates]);

  const handleExport = async () => {
    try {
      const res = await api.get('/tickets/export', {
        params: { startDate: dateFrom, endDate: dateTo },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HSE_Executive_Analytics_${selectedYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('analytics.errors.exportFailed', 'Export failed. Please try again.'), 'error');
    }
  };

  // ── In-Memory Interactive Filtered Tickets (Zero Lag) ─────────────────────
  const detailsList = data?.detailsList || [];
  const filteredDetailsList = React.useMemo(() => {
    if (!activeFilter || activeFilter.type === 'NONE') return detailsList;
    return detailsList.filter((item: any) => {
      if (activeFilter.type === 'VIAL') {
        if (activeFilter.key === 'TOTAL') return true;
        if (activeFilter.key === 'RESOLVED') return item.status === 'CLOSED';
        if (activeFilter.key === 'IN_PROGRESS') return item.status === 'IN_PROGRESS' || item.status === 'ASSIGNED' || item.status === 'SUBMITTED';
        if (activeFilter.key === 'ON_TRACK') return item.status !== 'CLOSED' && (!item.isOverdue && !item.overdue);
        if (activeFilter.key === 'OVERDUE') return item.isOverdue || item.overdue;
        if (activeFilter.key === 'CRITICAL') return item.severityLevel === 'MAJOR' || item.severity === 'MAJOR' || item.severityLevel === 'CRITICAL';
      }
      if (activeFilter.type === 'SEVERITY') {
        const sev = item.severityLevel || item.severity;
        if (activeFilter.key === 'MAJOR') return sev === 'MAJOR';
        if (activeFilter.key === 'SIGNIFICANT' || activeFilter.key === 'MODERATE') return sev === 'SIGNIFICANT' || sev === 'MODERATE';
        if (activeFilter.key === 'MINOR') return !sev || sev === 'MINOR';
      }
      if (activeFilter.type === 'DEPARTMENT') {
        return item.departmentId === activeFilter.key || 
               item.departmentName === activeFilter.key || 
               item.departmentNameAr === activeFilter.key;
      }
      return true;
    });
  }, [detailsList, activeFilter]);

  if (loading && !data) return <SkeletonAnalytics />;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Error card */}
      <div className="bg-white border border-red-200 rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-500" size={32} strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          {isRtl ? 'تعذّر تحميل الإحصائيات' : 'Analytics Failed to Load'}
        </h2>
        <p className="text-slate-500 text-sm mb-4 leading-relaxed">{error}</p>

        {/* Helpful tips */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-start mb-5">
          <p className="text-xs font-bold text-slate-600 mb-1">
            {isRtl ? 'ماذا تفعل؟' : 'What to do?'}
          </p>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>{isRtl ? 'تحقق من اتصالك بالإنترنت' : 'Check your internet connection'}</li>
            <li>{isRtl ? 'حاول إعادة تحميل الصفحة' : 'Try refreshing the page'}</li>
            <li>{isRtl ? 'إذا استمرت المشكلة، تواصل مع الدعم التقني' : 'If the issue persists, contact your system admin'}</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/30"
          >
            <RefreshCw size={15} />
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-slate-200"
          >
            {isRtl ? 'تحديث الصفحة' : 'Reload Page'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const kpis = data.executiveKpis || {
    total: data.totalTickets || 0,
    resolved: 0,
    inProgress: 0,
    onTrack: 0,
    overdue: 0,
    critical: 0
  };

  const training = data.trainingHours || {
    safetyHours: 0,
    securityHours: 0,
    totalHours: 0,
    traineesCount: 0
  };

  const units = data.unitsBreakdown || [];
  const deptList = data.departmentsList || [];
  // Only display years that actually have tickets
  const availableYears: number[] = data.availableYears || [currentYear];

  const months = [
    { num: 1, ar: 'يناير', en: 'January' },
    { num: 2, ar: 'فبراير', en: 'February' },
    { num: 3, ar: 'مارس', en: 'March' },
    { num: 4, ar: 'أبريل', en: 'April' },
    { num: 5, ar: 'مايو', en: 'May' },
    { num: 6, ar: 'يونيو', en: 'June' },
    { num: 7, ar: 'يوليو', en: 'July' },
    { num: 8, ar: 'أغسطس', en: 'August' },
    { num: 9, ar: 'سبتمبر', en: 'September' },
    { num: 10, ar: 'أكتوبر', en: 'October' },
    { num: 11, ar: 'نوفمبر', en: 'November' },
    { num: 12, ar: 'ديسمبر', en: 'December' },
  ];

  const timeStr = currentTime.toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const dateStr = currentTime.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dashboardBody = (
    <>
      {/* ── TOP HEADER ROW: FIELD ENGAGEMENT | BRANDING & CONTROLS | STATUS BY UNIT (Compact) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 items-stretch">
        
        {/* 1. FIELD ENGAGEMENT & AWARENESS BOX (Top Left - Purple outlined) */}
        <div className="lg:col-span-3 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-2 border-indigo-500/40 rounded-2xl p-2.5 sm:p-3 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-indigo-400/20 pb-1.5 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-indigo-500/30 rounded-lg text-indigo-300">
                <Users size={15} />
              </span>
              <h3 className="text-xs sm:text-sm font-black tracking-wide text-indigo-100">
                {isRtl ? 'المشاركة والتوعية الميدانية' : 'Field Engagement & Awareness'}
              </h3>
            </div>
            <span className="text-[9px] bg-indigo-500/30 text-indigo-200 font-bold px-1.5 py-0.5 rounded-full">
              {isRtl ? 'ربط لحظي' : 'Live'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center my-0.5">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-1.5">
              <p className="text-[10px] font-semibold text-indigo-200 mb-0.5">{isRtl ? 'رصد السلامة' : 'Safety Reports'}</p>
              <p className="text-base font-black text-emerald-400 font-mono">{training.safetyHours || training.safetyIncidents || 0}</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-1.5">
              <p className="text-[10px] font-semibold text-indigo-200 mb-0.5">{isRtl ? 'رصد الأمن' : 'Security Reports'}</p>
              <p className="text-base font-black text-blue-400 font-mono">{training.securityHours || training.securityIncidents || 0}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-indigo-400/20 mt-0.5 text-xs">
            <div className="flex items-center gap-1 text-indigo-200 font-bold">
              <span className="text-[11px]">👥 {training.traineesCount || training.uniqueReporters || 0}</span>
              <span className="text-[9px] opacity-80">{isRtl ? 'المشاركون' : 'Reporters'}</span>
            </div>
            <div className="text-end">
              <span className="text-[9px] text-indigo-300 block leading-none">{isRtl ? 'إجمالي الرصد' : 'Total'}</span>
              <span className="text-xs font-black text-amber-300 font-mono">{training.totalHours || training.totalIncidents || 0}</span>
            </div>
          </div>
        </div>

        {/* 2. CENTER BRANDING & TITLE & COMPACT LIVE CLOCK & CONTROLS */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 text-white shadow-md flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center ring-1 ring-white/20 mb-1 shadow-inner">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <h1 className="text-xs sm:text-sm font-black tracking-tight text-white leading-tight mb-0.5">
            {isRtl ? 'لوحة مؤشرات وبلاغات الأمن والسلامة التنفيذية' : 'Executive HSE Incidents & Safety Dashboard'}
          </h1>
          
          {data.isDepRestricted && data.userDepartment ? (
            <div className="my-0.5 inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-full text-[10px] font-bold shadow-sm">
              <Lock size={11} />
              <span>{isRtl ? `إدارة: ${data.userDepartment.nameAr || data.userDepartment.name}` : `Dept: ${data.userDepartment.name}`}</span>
            </div>
          ) : (
            <p className="text-blue-200/80 text-[10px] font-medium mb-0.5">
              {isRtl ? 'الإدارة العامة للسلامة والأمن والمخاطر' : 'General Directorate of Safety & Security'}
            </p>
          )}

          {/* ── Compact Unified Live Clock & Live Monitoring Badge ── */}
          <div className="flex items-center justify-center gap-2 my-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-2.5 py-1 shadow-inner w-full max-w-sm">
            <div className="flex items-center gap-1">
              <Clock size={15} className="text-emerald-400 animate-pulse" />
              <span className="font-mono text-sm sm:text-base font-black text-white tracking-wider">
                {timeStr}
              </span>
            </div>
            <div className="h-3.5 w-px bg-slate-700" />
            <span className="text-[10px] font-bold text-slate-300">
              {dateStr}
            </span>
            <div className="h-3.5 w-px bg-slate-700" />
            <div className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-500/60 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isRtl ? 'مباشر' : 'LIVE'}</span>
            </div>
          </div>

          {/* Controls: Mode Switcher + Theme Switcher + Fullscreen */}
          <div className="flex flex-wrap items-center justify-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setDashboardMode('EXECUTIVE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${dashboardMode === 'EXECUTIVE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              {isRtl ? '📊 اللوحة التنفيذية' : 'Executive View'}
            </button>
            <button
              onClick={() => setDashboardMode('CULTURE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${dashboardMode === 'CULTURE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              {isRtl ? '🎯 ثقافة السلامة' : 'Safety Culture'}
            </button>
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                const next = wallboardTheme === 'DARK' ? 'LIGHT' : 'DARK';
                setWallboardTheme(next);
                localStorage.setItem('hse_analytics_theme', next);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1 ${
                isDark
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
              title={isDark ? (isRtl ? 'التبديل إلى المظهر الأبيض' : 'Switch to Light') : (isRtl ? 'التبديل إلى المظهر الداكن' : 'Switch to Dark')}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? (isRtl ? 'أبيض' : 'Light') : (isRtl ? 'داكن' : 'Dark')}</span>
            </button>

            {/* Wallboard Fullscreen Button */}
            <button
              onClick={() => {
                setIsExecutiveMode(true);
                toggleFullscreen();
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-bold transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1"
              title={isRtl ? 'عرض شاشة المتابعة التنفيذية على كامل الشاشة بدون إخفاء أي بيانات' : 'Full Wallboard Mode'}
            >
              <Tv size={12} />
              <span>{isRtl ? '🖥️ تكبير' : 'Wallboard'}</span>
            </button>
          </div>
        </div>

        {/* 3. UNITS STATUS & HIGH SEVERITY FOCUS (Top Right - Col-Span-5 - Compact) */}
        <div className={`lg:col-span-5 rounded-2xl p-2.5 sm:p-3 shadow-md flex flex-col justify-between space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-amber-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-amber-400/60 text-slate-900 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-900/50 pb-1.5 mb-1.5">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span>📊</span>
                <span>{isRtl ? 'حالة الملاحظات حسب الوحدة' : 'Status by Unit'}</span>
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] font-black">
                <span className="text-blue-600 dark:text-blue-400">{isRtl ? 'مفتوحة' : 'Open'}</span>
                <span className="text-amber-600 dark:text-amber-400">{isRtl ? 'جاري' : 'In Prog'}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{isRtl ? 'مغلقة' : 'Closed'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              {units.map((u: any) => (
                <div key={u.key} className={`rounded-xl p-1.5 sm:p-2 transition-all ${
                  isDark ? 'bg-slate-950/70 border border-slate-800/80' : 'bg-slate-50 border border-slate-100'
                }`}>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{u.icon}</span>
                      <span className={`font-black text-[11px] sm:text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{isRtl ? u.labelAr : u.labelEn}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-black font-mono">
                      <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-200/50 dark:border-blue-800/50">{u.open}</span>
                      <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/50">{u.inProgress}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">{u.closed}</span>
                      <span className="text-slate-500 font-bold ml-0.5">({u.total})</span>
                    </div>
                  </div>
                  {/* Modern Pill Stacked Progress Bar with smooth gradients (Compact h-2.5) */}
                  <div className={`w-full rounded-full h-2.5 flex overflow-hidden p-0.5 shadow-inner ${
                    isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-200/90 border border-slate-300/60'
                  }`}>
                    <div
                      style={{ width: `${u.total > 0 ? (u.open / u.total) * 100 : 0}%` }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-s-full transition-all duration-500"
                      title={`${isRtl ? 'مفتوحة' : 'Open'}: ${u.open}`}
                    />
                    <div
                      style={{ width: `${u.total > 0 ? (u.inProgress / u.total) * 100 : 0}%` }}
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-500"
                      title={`${isRtl ? 'جاري المعالجة' : 'In Progress'}: ${u.inProgress}`}
                    />
                    <div
                      style={{ width: `${u.total > 0 ? (u.closed / u.total) * 100 : 0}%` }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-e-full transition-all duration-500"
                      title={`${isRtl ? 'مغلقة' : 'Closed'}: ${u.closed}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Focus on High / Major Severity (عالية التصنيف - Compact) */}
          <div className="pt-1.5 border-t border-amber-200/60 dark:border-slate-800">
            <h4 className="text-[11px] font-black text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
              <span>⚠️</span>
              <span>{isRtl ? 'عالية التصنيف (Major Severity)' : 'Major Severity Focus'}</span>
            </h4>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {units.map((u: any) => (
                <div key={u.key} className={`rounded-xl p-1.5 transition-all ${
                  isDark
                    ? 'bg-rose-950/40 border border-rose-800/50 text-rose-200'
                    : 'bg-red-50/80 border border-red-200 text-red-900 shadow-sm'
                }`}>
                  <span className="text-xs">{u.icon}</span>
                  <p className="text-[10px] font-bold truncate mt-0.5">{isRtl ? u.labelAr : u.labelEn}</p>
                  <p className="text-base font-black text-red-600 dark:text-red-400 font-mono">{u.major}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER RIBBON BAR (Years | Quarters | Months | Dept | Status | Severity | Theme - Ultra Compact) ── */}
      <div className={`rounded-2xl p-2 sm:p-2.5 shadow-sm space-y-1.5 transition-all ${
        isDark ? 'bg-slate-900/90 border border-slate-800 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          
          {/* 1. Year Buttons */}
          <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
            {availableYears.map(y => (
              <button
                key={y}
                type="button"
                onClick={() => { setSelectedYear(y); setShowCustomDates(false); }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-all ${
                  selectedYear === y && !showCustomDates ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelectedYear('ALL'); setShowCustomDates(false); }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                selectedYear === 'ALL' && !showCustomDates ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRtl ? 'الكل' : 'All'}
            </button>
          </div>

          {/* 2. Quarters Buttons */}
          <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
            {[
              { q: 1, labelAr: 'الربع 1', labelEn: 'Qtr 1' },
              { q: 2, labelAr: 'الربع 2', labelEn: 'Qtr 2' },
              { q: 3, labelAr: 'الربع 3', labelEn: 'Qtr 3' },
              { q: 4, labelAr: 'الربع 4', labelEn: 'Qtr 4' },
            ].map(item => (
              <button
                key={item.q}
                type="button"
                onClick={() => {
                  setSelectedQuarter(selectedQuarter === item.q ? null : item.q);
                  setSelectedMonth(null);
                  setShowCustomDates(false);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  selectedQuarter === item.q ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRtl ? item.labelAr : item.labelEn}
              </button>
            ))}
          </div>

          {/* 3. Month Quick Select */}
          <div className="flex items-center gap-1">
            <select
              value={selectedMonth || ''}
              onChange={e => {
                setSelectedMonth(e.target.value ? parseInt(e.target.value, 10) : null);
                setSelectedQuarter(null);
                setShowCustomDates(false);
              }}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
                isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              <option value="">{isRtl ? '— كل الشهور —' : '— All Months —'}</option>
              {months.map(m => (
                <option key={m.num} value={m.num}>{isRtl ? m.ar : m.en}</option>
              ))}
            </select>
          </div>

          {/* 4. Department Dropdown */}
          <div className="flex items-center gap-1 min-w-[140px]">
            {data.isDepRestricted ? (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold w-full ${
                isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-100 border border-slate-200 text-slate-700'
              }`}>
                <Lock size={11} className="text-amber-600" />
                <span className="truncate">{data.userDepartment ? (isRtl ? data.userDepartment.nameAr : data.userDepartment.name) : 'قسمي'}</span>
              </div>
            ) : (
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
                  isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">{isRtl ? '🏢 جميع الإدارات' : '🏢 All Departments'}</option>
                {deptList.map((d: any) => (
                  <option key={d.id} value={d.id}>{isRtl ? d.nameAr : d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* 5. Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className={`rounded-lg px-2 py-1 text-[11px] font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
              isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{isRtl ? '📌 جميع الحالات' : '📌 All Statuses'}</option>
            <option value="OPEN">{isRtl ? 'مفتوحة (Open)' : 'Open'}</option>
            <option value="IN_PROGRESS">{isRtl ? 'جاري المعالجة' : 'In Progress'}</option>
            <option value="CLOSED">{isRtl ? 'مغلقة (Closed)' : 'Closed'}</option>
          </select>

          {/* 6. Severity Classification Filter (Updated to Moderate) */}
          <select
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            className={`rounded-lg px-2 py-1 text-[11px] font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
              isDark ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{isRtl ? '⚡ جميع التصنيفات' : '⚡ All Severities'}</option>
            <option value="MAJOR">{isRtl ? 'عالية (Major)' : 'Major'}</option>
            <option value="SIGNIFICANT">{isRtl ? 'متوسطة (Moderate)' : 'Moderate'}</option>
            <option value="MINOR">{isRtl ? 'منخفضة (Minor)' : 'Minor'}</option>
          </select>

          {/* 7. Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex-shrink-0"
          >
            <Download size={12} /> {isRtl ? 'تصدير' : 'Export'}
          </button>

          {/* 8. Theme Switcher */}
          <button
            onClick={() => {
              const next = wallboardTheme === 'DARK' ? 'LIGHT' : 'DARK';
              setWallboardTheme(next);
              localStorage.setItem('hse_analytics_theme', next);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shadow-sm flex-shrink-0 ${
              isDark
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? (isRtl ? 'أبيض' : 'Light') : (isRtl ? 'داكن' : 'Dark')}</span>
          </button>

          {/* 9. Fullscreen Wallboard Button */}
          <button
            onClick={() => {
              setIsExecutiveMode(true);
              toggleFullscreen();
            }}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex-shrink-0"
            title={isRtl ? 'عرض شاشة المتابعة التنفيذية على كامل الشاشة بدون تمرير' : 'Display on TV/Wallboard'}
          >
            <Tv size={12} /> {isRtl ? 'شاشة العرض' : 'Wallboard'}
          </button>
        </div>
      </div>

      {/* ── CENTERPIECE 3-COLUMN ROW: VIALS (3 cols) | INCIDENT DRILLDOWN (5 cols) | LIVE MAP (4 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 items-stretch">
        
        {/* ── 1. COLUMN LEFT (3 cols): 6 VIAL METRICS GAUGES ── */}
        <div className={`lg:col-span-3 rounded-2xl p-2.5 sm:p-3 shadow-md flex flex-col justify-between space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-red-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-red-400/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-red-200/80 dark:border-red-900/50 pb-1.5">
            <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-1 text-red-600 dark:text-red-400">
              <span>🧪</span>
              <span>{isRtl ? 'مؤشرات الملاحظات' : 'Incident Indicators'}</span>
            </h3>
            <span className="text-[10px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded-full font-mono">
              {kpis.total} {isRtl ? 'إجمالي' : 'Total'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. Total */}
            <VialCard
              icon="📊"
              label={isRtl ? 'المجموع' : 'Total'}
              count={kpis.total}
              total={kpis.total}
              gradient="bg-gradient-to-r from-slate-800 to-slate-600"
              textColor="text-slate-800 dark:text-slate-200"
              borderColor="border-slate-500"
              fillColor="bg-slate-100 dark:bg-slate-800"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'TOTAL'}
              onClick={() => handleToggleFilter('VIAL', 'TOTAL', isRtl ? 'المجموع' : 'Total')}
              isDark={isDark}
              isFlashing={!!flashingKpis['total']}
            />
            {/* 2. Resolved */}
            <VialCard
              icon="✅"
              label={isRtl ? 'تمت معالجتها' : 'Resolved'}
              count={kpis.resolved}
              total={kpis.total}
              gradient="bg-gradient-to-r from-emerald-700 to-emerald-500"
              textColor="text-emerald-700 dark:text-emerald-300"
              borderColor="border-emerald-500"
              fillColor="bg-emerald-100 dark:bg-emerald-950/80"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'RESOLVED'}
              onClick={() => handleToggleFilter('VIAL', 'RESOLVED', isRtl ? 'تمت معالجتها' : 'Resolved')}
              isDark={isDark}
              isFlashing={!!flashingKpis['resolved']}
            />
            {/* 3. In Progress */}
            <VialCard
              icon="⏳"
              label={isRtl ? 'جاري المعالجة' : 'In Progress'}
              count={kpis.inProgress}
              total={kpis.total}
              gradient="bg-gradient-to-r from-amber-600 to-yellow-500"
              textColor="text-amber-700 dark:text-amber-300"
              borderColor="border-amber-500"
              fillColor="bg-amber-100 dark:bg-amber-950/80"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'IN_PROGRESS'}
              onClick={() => handleToggleFilter('VIAL', 'IN_PROGRESS', isRtl ? 'جاري المعالجة' : 'In Progress')}
              isDark={isDark}
              isFlashing={!!flashingKpis['inProgress']}
            />
            {/* 4. On Track */}
            <VialCard
              icon="🎯"
              label={isRtl ? 'وفق الخطة' : 'On Track'}
              count={kpis.onTrack}
              total={kpis.total}
              gradient="bg-gradient-to-r from-teal-700 to-cyan-500"
              textColor="text-teal-700 dark:text-teal-300"
              borderColor="border-teal-500"
              fillColor="bg-teal-100 dark:bg-teal-950/80"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'ON_TRACK'}
              onClick={() => handleToggleFilter('VIAL', 'ON_TRACK', isRtl ? 'وفق الخطة' : 'On Track')}
              isDark={isDark}
              isFlashing={!!flashingKpis['onTrack']}
            />
            {/* 5. Overdue */}
            <VialCard
              icon="⚠️"
              label={isRtl ? 'متأخرة' : 'Overdue'}
              count={kpis.overdue}
              total={kpis.total}
              gradient="bg-gradient-to-r from-rose-700 to-rose-500"
              textColor="text-rose-700 dark:text-rose-300"
              borderColor="border-rose-500"
              fillColor="bg-rose-100 dark:bg-rose-950/80"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'OVERDUE'}
              onClick={() => handleToggleFilter('VIAL', 'OVERDUE', isRtl ? 'متأخرة' : 'Overdue')}
              isDark={isDark}
              isFlashing={!!flashingKpis['overdue']}
            />
            {/* 6. Critical / Major */}
            <VialCard
              icon="🚨"
              label={isRtl ? 'عالية الخطورة' : 'Critical'}
              count={kpis.critical}
              total={kpis.total}
              gradient="bg-gradient-to-r from-red-700 to-red-500"
              textColor="text-red-700 dark:text-red-300"
              borderColor="border-red-600"
              fillColor="bg-red-100 dark:bg-red-950/80"
              isActive={activeFilter?.type === 'VIAL' && activeFilter?.key === 'CRITICAL'}
              onClick={() => handleToggleFilter('VIAL', 'CRITICAL', isRtl ? 'عالية الخطورة' : 'Critical')}
              isDark={isDark}
              isFlashing={!!flashingKpis['critical']}
            />
          </div>
        </div>

        {/* ── 2. COLUMN CENTER (5 cols): INCIDENT DETAILS & DRILLDOWN (Compact max-h 280px) ── */}
        <div className={`lg:col-span-5 rounded-2xl p-2.5 sm:p-3 shadow-md flex flex-col justify-between space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-amber-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-amber-400/60 text-slate-900 shadow-sm'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-900/50 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 rounded-lg">
                <ListFilter size={16} />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300">
                  {isRtl ? 'تفاصيل ومعاينة البلاغات' : 'Incident Details & Drilldown'}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold">
                  {activeFilter
                    ? (isRtl ? `تصفية: ${activeFilter.label}` : `Filter: ${activeFilter.label}`)
                    : (isRtl ? 'قائمة تفاعلية بالبلاغات حسب التصفية' : 'Live filtered incident stream')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {activeFilter && (
                <button
                  type="button"
                  onClick={() => setActiveFilter(null)}
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 hover:bg-rose-200 flex items-center gap-0.5 border border-rose-200 dark:border-rose-900"
                  title={isRtl ? 'إلغاء التصفية' : 'Clear filter'}
                >
                  <X size={9} />
                  <span>{isRtl ? 'إلغاء' : 'Clear'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={triggerManualPulse}
                title={isRtl ? 'اختبار وميض التحديث اللحظي' : 'Test pulse animation'}
                className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-all"
              >
                <Sparkles size={13} />
              </button>
              <span className="text-[11px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono font-black px-2 py-0.5 rounded-full">
                {filteredDetailsList.length}
              </span>
            </div>
          </div>

          {/* Scrollable Incidents List (Compact max-h 280px) */}
          <div className="space-y-1.5 max-h-[260px] sm:max-h-[280px] overflow-y-auto pr-1">
            {filteredDetailsList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <FileWarning size={24} className="mx-auto mb-1.5 opacity-50 text-amber-500" />
                <p className="font-bold">{isRtl ? 'لا توجد بلاغات تطابق التصفية الحالية' : 'No incidents match current filter'}</p>
                {activeFilter && (
                  <button
                    onClick={() => setActiveFilter(null)}
                    className="mt-1.5 text-blue-500 hover:underline text-[10px] font-bold"
                  >
                    {isRtl ? 'إعادة ضبط التصفية' : 'Reset filter'}
                  </button>
                )}
              </div>
            ) : (
              filteredDetailsList.map((item: any) => {
                const isSec = item.unitEn === 'Security' || item.unitAr === 'الأمن';
                const isHealth = item.unitEn === 'Health & Env' || item.unitAr === 'الصحة والبيئة';
                const unitBadge = isSec
                  ? { bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200', label: isRtl ? 'الأمن' : 'Security' }
                  : isHealth
                  ? { bg: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200', label: isRtl ? 'الصحة' : 'Health' }
                  : { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200', label: isRtl ? 'السلامة' : 'Safety' };

                const isClosed = item.status === 'CLOSED';
                const isProg = item.status === 'IN_PROGRESS' || item.status === 'ASSIGNED';
                const statusBadge = isClosed
                  ? { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', text: isRtl ? 'مغلق' : 'Closed' }
                  : isProg
                  ? { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', text: isRtl ? 'جاري' : 'In Progress' }
                  : { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', text: isRtl ? 'مفتوح' : 'Open' };

                const isMajor = item.severityLevel === 'MAJOR' || item.severity === 'MAJOR';
                const isMod = item.severityLevel === 'SIGNIFICANT' || item.severityLevel === 'MODERATE' || item.severity === 'MODERATE';
                const sevBadge = isMajor
                  ? { bg: 'bg-red-500 text-white', text: isRtl ? 'عالية' : 'Major' }
                  : isMod
                  ? { bg: 'bg-amber-500 text-white', text: isRtl ? 'متوسطة' : 'Mod' }
                  : { bg: 'bg-emerald-500 text-white', text: isRtl ? 'منخفضة' : 'Minor' };

                return (
                  <div
                    key={item.id || item.ticketNo}
                    onClick={() => item.id && navigate(`/incidents/${item.id}`)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isDark
                        ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/60 hover:bg-slate-900'
                        : 'bg-slate-50 border-slate-200/90 hover:border-amber-400 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-mono text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                          {item.ticketNo || `#${item.id?.substring(0, 6)}`}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${unitBadge.bg}`}>
                          {unitBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${sevBadge.bg}`}>
                          {sevBadge.text}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${statusBadge.bg}`}>
                          {statusBadge.text}
                        </span>
                      </div>
                    </div>

                    <p className={`text-[11px] font-bold line-clamp-1 mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {item.title}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                      <span className="truncate max-w-[170px]">
                        🏢 {isRtl ? (item.departmentNameAr || item.departmentName) : item.departmentName}
                      </span>
                      {item.createdAt && (
                        <span className="font-mono">
                          {new Date(item.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 3. COLUMN RIGHT (4 cols): LIVE INTERACTIVE INCIDENT MAP (Compact 280px) ── */}
        <div className={`lg:col-span-4 rounded-2xl p-2.5 sm:p-3 shadow-md flex flex-col justify-between space-y-1.5 transition-all overflow-hidden ${
          isDark
            ? 'bg-slate-900/90 border-2 border-emerald-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-emerald-500/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/50 pb-1.5 px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 rounded-lg">
                <MapPin size={16} />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {isRtl ? 'الخريطة التفاعلية المباشرة' : 'Live Incident Map'}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold">
                  {isRtl ? 'انقر على أي نقطة لعرض التفاصيل' : 'Click marker for details'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40 font-black px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{data.mapCases?.length || 0} {isRtl ? 'موقع نشط' : 'Pins'}</span>
              </span>
            </div>
          </div>

          {/* Compact Map Container (260-280px to fit on single screen) */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-800' : 'border-slate-200/90'} h-[260px] sm:h-[280px] shadow-inner relative`}>
            <AnalyticsMap cases={data.mapCases || []} isRtl={isRtl} />
          </div>

          {/* Quick Location Landmarks Footer */}
          <div className={`flex flex-wrap items-center justify-between text-[10px] px-2 py-1 font-black rounded-lg border ${
            isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50/80 border-slate-100 text-slate-600'
          }`}>
            <span className="flex items-center gap-0.5">🏁 {isRtl ? 'جدة' : 'Jeddah'}</span>
            <span className="flex items-center gap-0.5">🏢 {isRtl ? 'المقر' : 'HQ'}</span>
            <span className="flex items-center gap-0.5">📍 {isRtl ? 'الرياض' : 'Riyadh'}</span>
            <span className="flex items-center gap-0.5 text-red-500">🔴 {isRtl ? 'حرجة' : 'Major'}</span>
            <span className="flex items-center gap-0.5 text-amber-500">🟠 {isRtl ? 'متوسطة' : 'Mod'}</span>
            <span className="flex items-center gap-0.5 text-emerald-500">🟢 {isRtl ? 'منخفضة' : 'Minor'}</span>
          </div>
        </div>

      </div>

      {/* ── BOTTOM 4-CARD ROW: DEPT STATUS (Blue) | DETECTION SOURCE (Yellow) | SEVERITY (Cyan) | LOCATION (Green) (Compact) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        
        {/* CARD 1 (Bottom Left - Blue): حالة الملاحظات حسب الإدارة */}
        <div className={`rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-blue-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-blue-400/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/50 pb-1.5">
            <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Users size={14} />
              <span>{isRtl ? 'حالة الملاحظات حسب الإدارة' : 'Status by Department'}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {(data.deptStatusBreakdown || []).length} {isRtl ? 'إدارات' : 'depts'}
            </span>
          </div>
          <div className="space-y-1.5 max-h-[125px] sm:max-h-[135px] overflow-y-auto pr-1">
            {(data.deptStatusBreakdown || []).slice(0, 6).map((d: any) => {
              const isDeptActive = activeFilter?.type === 'DEPARTMENT' && (activeFilter?.key === d.id || activeFilter?.key === d.name || activeFilter?.key === d.nameAr);
              const deptName = isRtl ? (d.nameAr || d.name) : d.name;
              return (
                <div
                  key={d.id}
                  onClick={() => handleToggleFilter('DEPARTMENT', d.id || deptName, deptName)}
                  className={`p-1.5 rounded-xl cursor-pointer transition-all ${
                    isDeptActive
                      ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm'
                      : isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                    <span className={`truncate max-w-[140px] text-[11px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{deptName}</span>
                    <span className="font-mono text-[11px] font-black">{d.total}</span>
                  </div>
                  {/* Modern Pill Progress Bar */}
                  <div className={`w-full rounded-full h-2 flex overflow-hidden p-0.5 shadow-inner ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'
                  }`}>
                    <div
                      style={{ width: `${d.total > 0 ? (d.open / d.total) * 100 : 0}%` }}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-s-full transition-all"
                      title={`${isRtl ? 'مفتوح' : 'Open'}: ${d.open}`}
                    />
                    <div
                      style={{ width: `${d.total > 0 ? (d.closed / d.total) * 100 : 0}%` }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-e-full transition-all"
                      title={`${isRtl ? 'مغلق' : 'Closed'}: ${d.closed}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 2 (Yellow): كيف تم اكتشاف الملاحظة / الحادث؟ */}
        <div className={`rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-amber-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-amber-400/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-900/50 pb-1.5">
            <div>
              <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Search size={14} />
                <span>{isRtl ? 'مصدر اكتشاف الحادث' : 'How Was It Detected?'}</span>
              </h3>
            </div>
            <span className="text-[10px] font-black bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
              {(data.detectionSourceStats || []).reduce((s: number, x: any) => s + x.count, 0)}
            </span>
          </div>
          <div className="space-y-1.5 max-h-[125px] sm:max-h-[135px] overflow-y-auto pr-1">
            {(data.detectionSourceStats || []).map((ds: any) => {
              const max = Math.max(...(data.detectionSourceStats || []).map((x: any) => x.count), 1);
              const pct = max > 0 ? Math.round((ds.count / max) * 100) : 0;
              const bgMap: Record<string, string> = {
                INSPECTION:           isDark ? 'bg-blue-950/40 border-blue-800/60' : 'bg-blue-50 border-blue-200',
                AUDIT:                isDark ? 'bg-violet-950/40 border-violet-800/60' : 'bg-violet-50 border-violet-200',
                INTERNAL_OBSERVATION: isDark ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200',
                EXTERNAL_SOURCE:      isDark ? 'bg-amber-950/40 border-amber-800/60' : 'bg-amber-50 border-amber-200',
              };
              const badgeBg: Record<string, string> = {
                INSPECTION:           'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200',
                AUDIT:                'bg-violet-100 text-violet-800 dark:bg-violet-900/80 dark:text-violet-200',
                INTERNAL_OBSERVATION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200',
                EXTERNAL_SOURCE:      'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
              };
              const gradientMap: Record<string, string> = {
                INSPECTION: 'bg-gradient-to-r from-blue-600 to-indigo-500',
                AUDIT: 'bg-gradient-to-r from-violet-600 to-purple-500',
                INTERNAL_OBSERVATION: 'bg-gradient-to-r from-emerald-600 to-teal-400',
                EXTERNAL_SOURCE: 'bg-gradient-to-r from-amber-500 to-yellow-400',
              };

              return (
                <div key={ds.key} className={`rounded-xl border p-1.5 transition-all ${bgMap[ds.key] || (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <span className="text-xs">{ds.icon}</span>
                      <span>{isRtl ? ds.labelAr : ds.labelEn}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${badgeBg[ds.key] || 'bg-slate-100 text-slate-700'}`}>
                        {ds.count}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">{ds.percentage}%</span>
                    </div>
                  </div>
                  {/* Modern Pill Progress Bar */}
                  <div className={`w-full rounded-full h-1.5 overflow-hidden p-0.5 shadow-inner ${isDark ? 'bg-slate-900/80' : 'bg-white/80'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 shadow-sm ${gradientMap[ds.key] || 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 3 (Cyan): تصنيف الملاحظات (Severity Levels - Clickable Drilldown) */}
        <div className={`rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-cyan-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-cyan-400/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-cyan-200/60 dark:border-cyan-900/50 pb-1.5">
            <h3 className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
              <Flame size={14} />
              <span>{isRtl ? 'تصنيف الملاحظات' : 'Severity Classification'}</span>
            </h3>
            <span className="text-[9px] text-slate-400 font-semibold">
              {isRtl ? 'انقر للتصفية' : 'Filter'}
            </span>
          </div>
          <div className="space-y-1.5 max-h-[125px] sm:max-h-[135px] overflow-y-auto pr-1">
            {(data.severityDistribution || []).map((sev: any) => {
              const max = Math.max(...(data.severityDistribution || []).map((x: any) => x.count), 1);
              const isSevActive = activeFilter?.type === 'SEVERITY' && activeFilter?.key === sev.key;
              const isModerate = sev.key === 'SIGNIFICANT' || sev.key === 'MODERATE';
              const label = isRtl
                ? (isModerate ? 'متوسطة (Moderate)' : sev.labelAr)
                : (isModerate ? 'Moderate' : sev.labelEn);
              const gradient = sev.key === 'MAJOR'
                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                : isModerate
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-emerald-600 to-teal-400';
              const pct = Math.round((sev.count / max) * 100);

              return (
                <div
                  key={sev.key}
                  onClick={() => handleToggleFilter('SEVERITY', sev.key, label)}
                  className={`p-1.5 rounded-xl cursor-pointer transition-all ${
                    isSevActive
                      ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm'
                      : isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                    <span className={`text-[11px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</span>
                    <div className="flex items-center gap-1 font-mono">
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                        sev.key === 'MAJOR' ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300' :
                        isModerate ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' :
                        'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {sev.count}
                      </span>
                    </div>
                  </div>
                  {/* Modern Pill Progress Bar */}
                  <div className={`w-full rounded-full h-2 overflow-hidden p-0.5 shadow-inner ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'
                  }`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 shadow-sm ${gradient}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 4 (Bottom Right - Green): حالة الملاحظة حسب الموقع */}
        <div className={`rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2 transition-all ${
          isDark
            ? 'bg-slate-900/90 border-2 border-emerald-500/40 text-slate-100 shadow-lg'
            : 'bg-white border-2 border-emerald-400/60 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/50 pb-1.5">
            <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <MapPin size={14} />
              <span>{isRtl ? 'حالة الملاحظة حسب الموقع' : 'Incidents by Location'}</span>
            </h3>
          </div>
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {(data.locationDistribution || []).map((loc: any, i: number) => {
              const max = Math.max(...(data.locationDistribution || []).map((x: any) => x.count), 1);
              const pct = Math.round((loc.count / max) * 100);
              const gradients = [
                'bg-gradient-to-r from-emerald-600 to-teal-400',
                'bg-gradient-to-r from-teal-600 to-cyan-400',
                'bg-gradient-to-r from-cyan-600 to-blue-400',
                'bg-gradient-to-r from-blue-600 to-indigo-400',
                'bg-gradient-to-r from-indigo-600 to-purple-400',
              ];
              return (
                <div key={i} className="space-y-1 p-1 rounded-xl">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={`truncate max-w-[150px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{loc.name}</span>
                    <span className="font-mono text-xs font-black">{loc.count}</span>
                  </div>
                  {/* Modern Pill Progress Bar */}
                  <div className={`w-full rounded-full h-2 overflow-hidden p-0.5 shadow-inner ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'
                  }`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 shadow-sm ${gradients[i % gradients.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── CONDITIONAL VIEW: SAFETY CULTURE INDEX & HEINRICH PYRAMID ── */}
      {dashboardMode === 'CULTURE' && (
        <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-3 duration-300">
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-black">{isRtl ? 'مؤشر ثقافة التبليغ والسلامة المهنية (RCI)' : 'Reporting Culture & Industrial Safety Analytics'}</h2>
              <p className="text-xs text-slate-300 mt-0.5">{isRtl ? 'تحليلات هرم هاينريش ومؤشرات الأداء التنبؤية والتنظيمية' : 'Heinrich pyramid and proactive safety culture metrics'}</p>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
              {data.reportingCulture?.rci || 0} / 100
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={t('analytics.compliance.title', 'Compliance & Regulatory Actions')} icon={<ShieldCheck size={16} />}>
              <div className="space-y-4">
                {[
                  { label: t('analytics.compliance.gosi', 'GOSI Reporting'), value: data.compliance?.gosiRate || 100, sub: `${data.compliance?.gosiSubmitted || 0} / ${data.compliance?.gosiNeeded || 0}` },
                  { label: t('analytics.compliance.rca', 'RCA Completion'), value: data.compliance?.rcaRate || 100, sub: `${data.compliance?.rcaCompleted || 0} / ${data.compliance?.rcaNeeded || 0}` },
                  { label: t('analytics.compliance.ontime', 'On-Time Reports (<24h)'), value: 100 - (data.compliance?.lateReportRate || 0), sub: `${data.compliance?.lateReports || 0} ${t('analytics.compliance.lateReports', 'late reports')}` },
                ].map((it, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{it.label}</span>
                      <span className="text-base font-black" style={{ color: pctColor(it.value) }}>{it.value}%</span>
                    </div>
                    <ProgressBar value={it.value} height={10} />
                    <p className="text-[11px] font-medium text-slate-500 mt-1">{it.sub}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={t('analytics.scorecard.title', 'Department Reporting Culture Scorecard')} icon={<Users size={16} />}>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {(data.reportingCulture?.byDepartment || []).map((d: any) => (
                  <div key={d.id} className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{isRtl ? d.nameAr : d.nameEn}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{d.total} {isRtl ? 'بلاغ' : 'reports'}</span>
                      <span className="font-black px-2 py-0.5 rounded text-white text-[11px]" style={{ background: pctColor(d.rci) }}>
                        {d.rci}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </>
  );

  // ── EXECUTIVE WALLBOARD MODE (Single-Page Fullscreen with Command Bar) ─────
  if (isExecutiveMode) {
    return (
      <div className={`fixed inset-0 z-50 overflow-y-auto p-2 sm:p-2.5 flex flex-col space-y-2 select-none ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      } ${isRtl ? 'font-arabic dir-rtl' : 'font-sans dir-ltr'}`}>
        
        {/* Top Wallboard Command Bar (Compact h-10) */}
        <div className={`h-10 flex-shrink-0 flex items-center justify-between px-3 sm:px-3.5 rounded-xl backdrop-blur shadow-md ${
          isDark ? 'bg-slate-900/95 border border-slate-800' : 'bg-white border border-slate-200'
        }`}>
          {/* Left: Brand + Scope */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-500 shadow-inner">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className={`text-[11px] sm:text-xs font-black tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isRtl ? 'لوحة المتابعة التنفيذية المباشرة — HSE Command Center' : 'HSE Executive Command Center — Live Wallboard'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] text-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-500/30 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>{isRtl ? 'مباشر' : 'Live'}</span>
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-none">
                {data.isDepRestricted && data.userDepartment
                  ? (isRtl ? `إدارة: ${data.userDepartment.nameAr || data.userDepartment.name}` : `Dept: ${data.userDepartment.name}`)
                  : (isRtl ? 'الإدارة العامة للسلامة والأمن والمخاطر' : 'General Directorate of Safety & Security')}
              </p>
            </div>
          </div>

          {/* Center: Live Digital Clock & Date */}
          <div className="hidden md:flex items-center gap-2 font-mono font-black text-xs tracking-wider">
            <div className={`flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={13} className="text-emerald-500" />
              <span>{timeStr}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">({dateStr})</span>
          </div>

          {/* Right: Theme Switcher + Fullscreen + Exit */}
          <div className="flex items-center gap-1.5">
            {/* Theme Switcher */}
            <button
              type="button"
              onClick={() => {
                const next = wallboardTheme === 'DARK' ? 'LIGHT' : 'DARK';
                setWallboardTheme(next);
                localStorage.setItem('hse_analytics_theme', next);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shadow-sm ${
                isDark
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
              }`}
              title={isDark ? (isRtl ? 'التبديل إلى الوضع الأبيض' : 'Switch to Light') : (isRtl ? 'التبديل إلى الوضع الداكن' : 'Switch to Dark')}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? (isRtl ? 'أبيض' : 'Light') : (isRtl ? 'داكن' : 'Dark')}</span>
            </button>

            {/* Live Refresh */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              title={isRtl ? 'تحديث لحظي الآن' : 'Live Refresh'}
              className={`p-1 rounded-lg transition-all border ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-500' : ''} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? (isRtl ? 'إنهاء ملء الشاشة' : 'Exit Fullscreen') : (isRtl ? 'ملء الشاشة' : 'Fullscreen')}
              className={`p-1 rounded-lg transition-all border ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Exit Wallboard */}
            <button
              type="button"
              onClick={() => {
                setIsExecutiveMode(false);
                if (document.fullscreenElement && document.exitFullscreen) {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm"
            >
              <X size={12} />
              <span className="hidden sm:inline">{isRtl ? 'خروج' : 'Exit'}</span>
            </button>
          </div>
        </div>

        {/* Complete Dashboard Body */}
        {dashboardBody}
      </div>
    );
  }

  // ── STANDARD VIEW ─────────────────────────────────────────────────────────
  return (
    <div className={`space-y-2.5 pb-8 relative ${
      isDark ? 'bg-slate-950 -mx-4 -mt-4 p-3 rounded-3xl text-slate-100' : 'text-slate-900'
    } ${isRtl ? 'font-arabic dir-rtl' : 'font-sans dir-ltr'}`}>
      {dashboardBody}
    </div>
  );
};

export default Analytics;
