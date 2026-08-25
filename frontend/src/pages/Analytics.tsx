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
  RefreshCw, Radio, Layers
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
}

const VialCard: React.FC<VialCardProps> = ({ label, count, total, gradient, textColor, borderColor, fillColor }) => {
  const pct = total > 0 ? Math.min(100, Math.max(12, Math.round((count / total) * 100))) : 15;

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all group">
      <span className="text-[11px] font-bold text-slate-700 text-center mb-1.5 h-6 flex items-center justify-center leading-tight">
        {label}
      </span>
      
      {/* 3D Glass Cylinder */}
      <div className={`relative w-12 h-20 sm:w-14 sm:h-24 rounded-2xl border-2 ${borderColor} bg-slate-50/80 overflow-hidden flex flex-col justify-end p-1 shadow-inner`}>
        {/* Liquid level */}
        <div 
          className={`w-full rounded-xl transition-all duration-700 ease-out flex items-center justify-center relative overflow-hidden ${gradient}`}
          style={{ height: `${pct}%`, minHeight: '24px' }}
        >
          {/* Subtle liquid shimmer */}
          <div className="absolute inset-0 bg-white/20 opacity-40 animate-pulse" />
          <span className="font-black text-xs sm:text-sm text-white drop-shadow-sm z-10">
            {count}
          </span>
        </div>
      </div>

      <div className="mt-1.5 text-center">
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${fillColor} ${textColor}`}>
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
  const detailsList = data.detailsList || [];
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

  return (
    <div className={`space-y-4 pb-12 relative ${isRtl ? 'font-arabic dir-rtl' : 'font-sans dir-ltr'}`}>

      {/* ── TOP HEADER ROW: TRAINING | BRANDING | DRILLDOWN DETAILS TABLE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        
        {/* 1. TRAINING BOX (Top Left - Purple outlined) */}
        <div className="lg:col-span-3 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-2 border-indigo-500/40 rounded-3xl p-4 text-white shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-indigo-400/20 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/30 rounded-lg text-indigo-300">
                <GraduationCap size={18} />
              </span>
              <h3 className="text-sm font-black tracking-wide text-indigo-100">
                {isRtl ? 'التدريب والتأهيل' : 'Training & Drills'}
              </h3>
            </div>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-bold px-2 py-0.5 rounded-full">
              {isRtl ? 'ربط لحظي' : 'Live'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center my-1">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-2">
              <p className="text-[11px] font-semibold text-indigo-200 mb-0.5">{isRtl ? 'تدريب السلامة' : 'Safety'}</p>
              <p className="text-lg font-black text-emerald-400 font-mono">{training.safetyHours}<span className="text-xs font-normal text-slate-300">/hr</span></p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-2">
              <p className="text-[11px] font-semibold text-indigo-200 mb-0.5">{isRtl ? 'تدريب الأمن' : 'Security'}</p>
              <p className="text-lg font-black text-blue-400 font-mono">{training.securityHours}<span className="text-xs font-normal text-slate-300">/hr</span></p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-indigo-400/20 mt-1 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-200 font-bold">
              <span>👥 {training.traineesCount}</span>
              <span className="text-[10px] opacity-80">{isRtl ? 'مستفيد/مُبلّغ' : 'Trainees'}</span>
            </div>
            <div className="text-end">
              <span className="text-[10px] text-indigo-300 block">{isRtl ? 'إجمالي الساعات' : 'Total Hours'}</span>
              <span className="text-sm font-black text-amber-300 font-mono">{training.totalHours} hr</span>
            </div>
          </div>
        </div>

        {/* 2. CENTER BRANDING & TITLE */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl p-4 text-white shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center ring-2 ring-white/20 mb-2 shadow-inner">
            <ShieldCheck size={26} className="text-blue-400" />
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
            {isRtl ? 'لوحة مؤشرات وبلاغات الأمن والسلامة التنفيذية' : 'Executive HSE Incidents & Safety Dashboard'}
          </h1>
          
          {data.isDepRestricted && data.userDepartment ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-full text-xs font-bold shadow-sm">
              <Lock size={12} />
              <span>{isRtl ? `لوحة مخصصة لإدارة: ${data.userDepartment.nameAr || data.userDepartment.name}` : `Scoped for Department: ${data.userDepartment.name}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-blue-200/80 text-xs font-medium">
                {isRtl ? 'الإدارة العامة للسلامة والأمن والمخاطر' : 'General Directorate of Safety & Security'}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{isRtl ? 'مباشر' : 'Live'}</span>
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 mt-3 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setDashboardMode('EXECUTIVE')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dashboardMode === 'EXECUTIVE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              {isRtl ? '📊 اللوحة التنفيذية' : 'Executive View'}
            </button>
            <button
              onClick={() => setDashboardMode('CULTURE')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dashboardMode === 'CULTURE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              {isRtl ? '🎯 ثقافة السلامة (RCI)' : 'Safety Culture'}
            </button>
          </div>
        </div>

        {/* 3. DRILLDOWN DETAILS TABLE (Top Right - Red outlined) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-red-50 text-red-600 rounded-md">
                <ListFilter size={14} />
              </span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {isRtl ? 'التفاصيل والمعاينة السريعة للبلاغات' : 'Incident Details & Drilldown'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                title={isRtl ? 'تحديث لحظي' : 'Live Refresh'}
                className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : ''} />
              </button>
              <span className="text-[10px] text-slate-500 font-mono font-bold">
                {detailsList.length} {isRtl ? 'تذكرة' : 'tickets'}
              </span>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[130px] space-y-1.5 pr-1 text-xs">
            {detailsList.length > 0 ? (
              detailsList.slice(0, 8).map((item: any) => (
                <div 
                  key={item.id} 
                  onClick={() => navigate(`/tickets/${item.id}`)}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-black bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-700">
                      {item.ticketNo}
                    </span>
                    <span className="font-bold text-slate-700 text-xs truncate max-w-[180px] sm:max-w-[240px]">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isRtl ? (item.status === 'CLOSED' ? 'مغلقة' : item.status === 'SUBMITTED' ? 'جديدة' : 'جاري المعالجة') : item.status}
                    </span>
                    <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-600" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-6 text-xs">{isRtl ? 'لا توجد بلاغات مسجلة وفق الفلتر المحدد' : 'No records found'}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER RIBBON BAR (Years with actual data | Quarters | Months | Dept | Status | Severity) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          {/* 1. Year Buttons (Strictly only years that have actual data) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {availableYears.map(y => (
              <button
                key={y}
                type="button"
                onClick={() => { setSelectedYear(y); setShowCustomDates(false); }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                  selectedYear === y && !showCustomDates ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {y}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelectedYear('ALL'); setShowCustomDates(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedYear === 'ALL' && !showCustomDates ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isRtl ? 'الكل' : 'All'}
            </button>
          </div>

          {/* 2. Quarters Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { q: 1, label: 'Qtr 1' },
              { q: 2, label: 'Qtr 2' },
              { q: 3, label: 'Qtr 3' },
              { q: 4, label: 'Qtr 4' },
            ].map(item => (
              <button
                key={item.q}
                type="button"
                onClick={() => {
                  setSelectedQuarter(selectedQuarter === item.q ? null : item.q);
                  setSelectedMonth(null);
                  setShowCustomDates(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedQuarter === item.q ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 3. Month Quick Select */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedMonth || ''}
              onChange={e => {
                setSelectedMonth(e.target.value ? parseInt(e.target.value, 10) : null);
                setSelectedQuarter(null);
                setShowCustomDates(false);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">{isRtl ? '— كل الشهور —' : '— All Months —'}</option>
              {months.map(m => (
                <option key={m.num} value={m.num}>{isRtl ? m.ar : m.en}</option>
              ))}
            </select>
          </div>

          {/* 4. Department Dropdown (Locked for DEP_MANAGER/DEP_REP) */}
          <div className="flex items-center gap-1.5 min-w-[160px]">
            {data.isDepRestricted ? (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 w-full">
                <Lock size={12} className="text-amber-600" />
                <span className="truncate">{data.userDepartment ? (isRtl ? data.userDepartment.nameAr : data.userDepartment.name) : 'قسمي'}</span>
              </div>
            ) : (
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">{isRtl ? '📌 جميع الحالات' : '📌 All Statuses'}</option>
            <option value="OPEN">{isRtl ? 'مفتوحة (Open)' : 'Open'}</option>
            <option value="IN_PROGRESS">{isRtl ? 'جاري المعالجة (In Progress)' : 'In Progress'}</option>
            <option value="CLOSED">{isRtl ? 'مغلقة (Closed)' : 'Closed'}</option>
          </select>

          {/* 6. Severity Classification Filter */}
          <select
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">{isRtl ? '⚡ جميع التصنيفات' : '⚡ All Severities'}</option>
            <option value="MAJOR">{isRtl ? 'عالية (Major)' : 'Major'}</option>
            <option value="SIGNIFICANT">{isRtl ? 'متوسطة (Significant)' : 'Significant'}</option>
            <option value="MINOR">{isRtl ? 'منخفضة (Minor)' : 'Minor'}</option>
          </select>

          {/* 7. Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm flex-shrink-0"
          >
            <Download size={13} /> {isRtl ? 'تصدير' : 'Export'}
          </button>
        </div>
      </div>

      {/* ── MAIN CENTERPIECE SECTION: VIALS (LEFT) | LARGE INTERACTIVE MAP (CENTER) | UNITS STATUS (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* ── 1. COLUMN LEFT (22% / 3 cols): 6 VIAL METRIC GAUGES ── */}
        <div className="lg:col-span-3 bg-gradient-to-br from-slate-50 to-slate-100/90 border-2 border-red-400/60 rounded-3xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between space-y-2.5">
          <div className="flex items-center justify-between border-b border-red-200/80 pb-2">
            <h3 className="text-xs font-black text-red-950 uppercase tracking-wide flex items-center gap-1.5">
              <span>🧪</span>
              <span>{isRtl ? 'مؤشرات الملاحظات' : 'Incident Indicators'}</span>
            </h3>
            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
              {kpis.total} {isRtl ? 'إجمالي' : 'Total'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {/* 1. Total */}
            <VialCard
              label={isRtl ? 'المجموع' : 'Total'}
              count={kpis.total}
              total={kpis.total}
              gradient="bg-gradient-to-t from-stone-800 to-stone-600"
              textColor="text-stone-800"
              borderColor="border-stone-400"
              fillColor="bg-stone-100"
            />
            {/* 2. Resolved */}
            <VialCard
              label={isRtl ? 'تمت معالجتها' : 'Resolved'}
              count={kpis.resolved}
              total={kpis.total}
              gradient="bg-gradient-to-t from-slate-600 to-slate-400"
              textColor="text-slate-700"
              borderColor="border-slate-400"
              fillColor="bg-slate-100"
            />
            {/* 3. In Progress */}
            <VialCard
              label={isRtl ? 'جاري المعالجة' : 'In Progress'}
              count={kpis.inProgress}
              total={kpis.total}
              gradient="bg-gradient-to-t from-amber-500 to-yellow-400"
              textColor="text-amber-800"
              borderColor="border-amber-400"
              fillColor="bg-amber-100"
            />
            {/* 4. On Track */}
            <VialCard
              label={isRtl ? 'وفق الخطة' : 'On Track'}
              count={kpis.onTrack}
              total={kpis.total}
              gradient="bg-gradient-to-t from-emerald-600 to-teal-400"
              textColor="text-emerald-800"
              borderColor="border-emerald-400"
              fillColor="bg-emerald-100"
            />
            {/* 5. Overdue */}
            <VialCard
              label={isRtl ? 'متأخرة' : 'Overdue'}
              count={kpis.overdue}
              total={kpis.total}
              gradient="bg-gradient-to-t from-red-600 to-rose-400"
              textColor="text-red-800"
              borderColor="border-red-400"
              fillColor="bg-red-100"
            />
            {/* 6. Critical / Unspecified */}
            <VialCard
              label={isRtl ? 'عالية الخطورة' : 'Critical'}
              count={kpis.critical}
              total={kpis.total}
              gradient="bg-gradient-to-t from-red-700 to-red-500"
              textColor="text-red-900"
              borderColor="border-red-600"
              fillColor="bg-red-100"
            />
          </div>
        </div>

        {/* ── 2. COLUMN CENTER (55% / 6.5 cols - PROMINENT LARGE INTERACTIVE MAP) ── */}
        <div className="lg:col-span-6 bg-white border-2 border-emerald-500/50 rounded-3xl p-3.5 shadow-md flex flex-col justify-between space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <MapPin size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  {isRtl ? 'الخريطة التفاعلية المباشرة لمتابعة ورصد التذاكر' : 'Live Interactive Incident Map'}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  {isRtl ? 'انقر على أي نقطة لعرض تفاصيل البلاغ ومتابعته لحظياً' : 'Click any marker to inspect incident details in real-time'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{data.mapCases?.length || 0} {isRtl ? 'بلاغ موقعي' : 'Pins'}</span>
              </span>
            </div>
          </div>

          {/* Expanded High-Resolution Map Container */}
          <div className="rounded-2xl overflow-hidden border border-slate-200/90 h-[360px] sm:h-[400px] shadow-inner relative">
            <AnalyticsMap cases={data.mapCases || []} isRtl={isRtl} />
          </div>

          {/* Quick Location Landmarks Footer */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-2 pt-1 font-bold bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="flex items-center gap-1">🏁 {isRtl ? 'حلبة كورنيش جدة' : 'Jeddah Circuit'}</span>
            <span className="flex items-center gap-1">🏢 {isRtl ? 'المقر الرئيسي' : 'HQ'}</span>
            <span className="flex items-center gap-1">📍 {isRtl ? 'الرياض' : 'Riyadh'}</span>
            <span className="flex items-center gap-1">🕋 {isRtl ? 'مكة المكرمة' : 'Makkah'}</span>
            <span className="flex items-center gap-1 text-blue-600">🔴 {isRtl ? 'حرجة' : 'Major'} | 🟠 {isRtl ? 'متوسطة' : 'Signif'} | 🟢 {isRtl ? 'منخفضة' : 'Minor'}</span>
          </div>
        </div>

        {/* ── 3. COLUMN RIGHT (23% / 3 cols): UNITS STATUS & HIGH SEVERITY FOCUS ── */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-3.5 shadow-sm flex flex-col justify-between space-y-3">
          
          {/* Top: Status per Unit (Safety, Security, Health) */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>📊</span>
                <span>{isRtl ? 'الملاحظات حسب الوحدة' : 'Status by Unit'}</span>
              </h3>
              <div className="flex items-center gap-1.5 text-[9px] font-black">
                <span className="text-blue-600">مفتوحة</span>
                <span className="text-amber-600">جاري</span>
                <span className="text-emerald-600">مغلقة</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {units.map((u: any) => (
                <div key={u.key} className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{u.icon}</span>
                      <span className="font-bold text-slate-800 text-[11px]">{isRtl ? u.labelAr : u.labelEn}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-black">
                      <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{u.open}</span>
                      <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{u.inProgress}</span>
                      <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{u.closed}</span>
                      <span className="text-slate-700 font-mono ml-0.5">({u.total})</span>
                    </div>
                  </div>
                  {/* Stacked Progress Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-2.5 flex overflow-hidden">
                    <div style={{ width: `${u.total > 0 ? (u.open / u.total) * 100 : 0}%` }} className="bg-blue-500 h-full transition-all" title="Open" />
                    <div style={{ width: `${u.total > 0 ? (u.inProgress / u.total) * 100 : 0}%` }} className="bg-amber-500 h-full transition-all" title="In Progress" />
                    <div style={{ width: `${u.total > 0 ? (u.closed / u.total) * 100 : 0}%` }} className="bg-emerald-500 h-full transition-all" title="Closed" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Focus on High / Major Severity (عالية التصنيف) */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-black text-rose-900 mb-1.5 flex items-center gap-1">
              <span>⚠️</span>
              <span>{isRtl ? 'عالية التصنيف (Major Severity)' : 'Major Severity Focus'}</span>
            </h4>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {units.map((u: any) => (
                <div key={u.key} className="bg-red-50/70 border border-red-200/80 rounded-2xl p-1.5">
                  <span className="text-xs">{u.icon}</span>
                  <p className="text-[10px] font-bold text-red-900 truncate">{isRtl ? u.labelAr : u.labelEn}</p>
                  <p className="text-base font-black text-red-600 font-mono">{u.major}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM 4-CARD ROW: DEPT STATUS | DETECTION SOURCE | SEVERITY | LOCATION ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* CARD 1 (Bottom Left - Blue): حالة الملاحظات حسب الإدارة */}
        <div className="bg-white border-2 border-blue-400/50 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <Users size={14} className="text-blue-600" />
              <span>{isRtl ? 'حالة الملاحظات حسب الإدارة' : 'Status by Department'}</span>
            </h3>
          </div>
          <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
            {(data.deptStatusBreakdown || []).slice(0, 5).map((d: any) => (
              <div key={d.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 truncate max-w-[140px]">{isRtl ? d.nameAr : d.name}</span>
                  <span className="text-slate-900 font-mono">{d.total}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                  <div style={{ width: `${d.total > 0 ? (d.open / d.total) * 100 : 0}%` }} className="bg-amber-500 h-full" title="Open" />
                  <div style={{ width: `${d.total > 0 ? (d.closed / d.total) * 100 : 0}%` }} className="bg-emerald-500 h-full" title="Closed" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2 (Yellow): كيف تم اكتشاف الملاحظة / الحادث؟ */}
        <div className="bg-white border-2 border-amber-400/50 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Search size={14} className="text-amber-600" />
                <span>{isRtl ? 'مصدر اكتشاف الحادث' : 'How Was It Detected?'}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {isRtl ? 'الجهة أو الطريقة التي أدت إلى اكتشاف الحادث أو الملاحظة' : 'The channel that led to discovering the incident'}
              </p>
            </div>
            <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              {(data.detectionSourceStats || []).reduce((s: number, x: any) => s + x.count, 0)} {isRtl ? 'إجمالي' : 'total'}
            </span>
          </div>
          <div className="space-y-2">
            {(data.detectionSourceStats || []).map((ds: any) => {
              const max = Math.max(...(data.detectionSourceStats || []).map((x: any) => x.count), 1);
              const pct = max > 0 ? Math.round((ds.count / max) * 100) : 0;
              // Background colors per category
              const bgMap: Record<string, string> = {
                INSPECTION:           'bg-blue-50   border-blue-200',
                AUDIT:                'bg-violet-50 border-violet-200',
                INTERNAL_OBSERVATION: 'bg-emerald-50 border-emerald-200',
                EXTERNAL_SOURCE:      'bg-amber-50  border-amber-200',
              };
              const badgeBg: Record<string, string> = {
                INSPECTION:           'bg-blue-100 text-blue-800',
                AUDIT:                'bg-violet-100 text-violet-800',
                INTERNAL_OBSERVATION: 'bg-emerald-100 text-emerald-800',
                EXTERNAL_SOURCE:      'bg-amber-100 text-amber-800',
              };
              return (
                <div key={ds.key} className={`rounded-2xl border p-2.5 ${bgMap[ds.key] || 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span className="text-sm">{ds.icon}</span>
                      <span>{isRtl ? ds.labelAr : ds.labelEn}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${badgeBg[ds.key] || 'bg-slate-100 text-slate-700'}`}>
                        {ds.count}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{ds.percentage}%</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: ds.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* CARD 3 (Cyan): تصنيف الملاحظات (Severity Levels) */}
        <div className="bg-white border-2 border-cyan-400/50 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-cyan-950 flex items-center gap-1.5">
              <Flame size={14} className="text-cyan-600" />
              <span>{isRtl ? 'تصنيف الملاحظات' : 'Severity Classification'}</span>
            </h3>
          </div>
          <div className="space-y-3">
            {(data.severityDistribution || []).map((sev: any) => {
              const max = Math.max(...(data.severityDistribution || []).map((x: any) => x.count), 1);
              return (
                <div key={sev.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">{isRtl ? sev.labelAr : sev.labelEn}</span>
                    <span className="font-mono text-slate-900">{sev.count}</span>
                  </div>
                  <ProgressBar value={(sev.count / max) * 100} color={sev.color} height={8} />
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 4 (Bottom Right - Green): حالة الملاحظة حسب الموقع */}
        <div className="bg-white border-2 border-emerald-400/50 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <MapPin size={14} className="text-emerald-600" />
              <span>{isRtl ? 'حالة الملاحظة حسب الموقع' : 'Incidents by Location'}</span>
            </h3>
          </div>
          <div className="space-y-2.5">
            {(data.locationDistribution || []).map((loc: any, i: number) => {
              const max = Math.max(...(data.locationDistribution || []).map((x: any) => x.count), 1);
              const colors = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 truncate max-w-[150px]">{loc.name}</span>
                    <span className="font-mono text-slate-900">{loc.count}</span>
                  </div>
                  <ProgressBar value={(loc.count / max) * 100} color={colors[i % colors.length]} height={6} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONDITIONAL VIEW: SAFETY CULTURE INDEX & HEINRICH PYRAMID (Mode Switcher) ── */}
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

          {/* Compliance & Pareto */}
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
                      <span className="text-sm font-bold text-slate-700">{it.label}</span>
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
                  <div key={d.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="font-bold text-slate-800">{isRtl ? d.nameAr : d.nameEn}</span>
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

    </div>
  );
};

export default Analytics;
