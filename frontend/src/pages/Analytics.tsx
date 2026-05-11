import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import {
  AlertTriangle, Loader2, ShieldCheck, Clock, FileWarning, Activity,
  TrendingUp, TrendingDown, Users, MapPin, BarChart3, Sparkles,
  CheckCircle, XCircle, Eye, AlertOctagon, Calendar, Trophy, Flame,
  Send, Bot, Download, Filter, X, ChevronRight, ChevronLeft, Briefcase, ChevronDown
} from 'lucide-react';
import { useToast } from '../components/Toast';
import AnalyticsMap from '../components/AnalyticsMap';

// ── helpers ───────────────────────────────────────────────────────────────────
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

const INSIGHT_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  CRITICAL: { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', icon: <AlertOctagon size={14} /> },
  WARNING:  { color: '#9a3412', bg: '#fff7ed', border: '#fdba74', icon: <AlertTriangle size={14} /> },
  INFO:     { color: '#1e40af', bg: '#eff6ff', border: '#93c5fd', icon: <Eye size={14} /> },
  POSITIVE: { color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', icon: <CheckCircle size={14} /> },
};

// ── reusable mini components ──────────────────────────────────────────────────
const Section: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
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

const ProgressBar: React.FC<{ value: number; color?: string; height?: number }> = ({ value, color, height = 8 }) => (
  <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color || pctColor(value) }} />
  </div>
);

// Circular gauge for RCI
const RCIGauge: React.FC<{ value: number; level: string, t: any }> = ({ value, level, t }) => {
  const radius = 70, stroke = 12;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  const style = getRciStyle(level, t);
  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="90" cy="90" r={radius} stroke="#f1f5f9" strokeWidth={stroke} fill="none" />
        <circle cx="90" cy="90" r={radius} stroke={style.color} strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black" style={{ color: style.color }}>{value}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('analytics.rci.outof100', '/ 100')}</span>
        <span className="mt-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: style.color, background: style.bg }}>
          {style.emoji} {style.label}
        </span>
      </div>
    </div>
  );
};

// ── TYPE COLOR MAP for violation breakdown ───────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; label: string; labelAr: string }> = {
  NEAR_MISS:            { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Near Miss', labelAr: 'شبه حادثة' },
  UNSAFE_ACT:           { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Unsafe Act', labelAr: 'تصرف غير آمن' },
  UNSAFE_CONDITION:     { bg: 'bg-red-100', text: 'text-red-800', label: 'Unsafe Condition', labelAr: 'حالة غير آمنة' },
  FIRE:                 { bg: 'bg-red-200', text: 'text-red-900', label: 'Fire', labelAr: 'حريق' },
  ENVIRONMENTAL:        { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Environmental', labelAr: 'بيئي' },
  PROPERTY_DAMAGE:      { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Property Damage', labelAr: 'أضرار ممتلكات' },
  FIRST_AID:            { bg: 'bg-pink-100', text: 'text-pink-800', label: 'First Aid', labelAr: 'إسعافات أولية' },
  MEDICAL_TREATMENT:    { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Medical Treatment', labelAr: 'علاج طبي' },
  LOST_TIME_INJURY:     { bg: 'bg-rose-200', text: 'text-rose-900', label: 'Lost Time Injury', labelAr: 'إصابة وقت ضائع' },
  FATALITY:             { bg: 'bg-gray-800', text: 'text-white', label: 'Fatality', labelAr: 'وفاة' },
  OBSERVATION:          { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Observation', labelAr: 'ملاحظة' },
  VEHICLE_INCIDENT:     { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Vehicle Incident', labelAr: 'حادث مركبة' },
  OTHER:                { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Other', labelAr: 'أخرى' },
};

const ServiceProviderCard: React.FC<{ sp: any; rank: number; t: any; isRtl: boolean }> = ({ sp, rank, t, isRtl }) => {
  const [expanded, setExpanded] = useState(false);
  const types = Object.entries(sp.byType || {}).sort((a: any, b: any) => b[1] - a[1]);
  const maxTypeCount = types.length > 0 ? (types[0][1] as number) : 1;

  // Rank badge color
  const rankColors = ['from-red-600 to-rose-700', 'from-orange-500 to-amber-600', 'from-amber-400 to-yellow-500'];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : 'from-slate-400 to-slate-500';

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-md">
      {/* Header — clickable */}
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

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
          {/* Provider info row */}
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

          {/* Violation type breakdown */}
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

const Analytics = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { showToast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Date range filter ────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(sixMonthsAgo);
  const [dateTo,   setDateTo]   = useState(today);
  const [applied,  setApplied]  = useState({ from: sixMonthsAgo, to: today });

  // ── AI Chat ──────────────────────────────────────────────────────────────
  const [aiOpen,    setAiOpen]    = useState(false);
  const [aiInput,   setAiInput]   = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async (from: string, to: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/analytics', { params: { from, to } });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('analytics.errors.loadFailed', 'Failed to load analytics'));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(applied.from, applied.to); }, [applied]);

  const handleApply = () => {
    setApplied({ from: dateFrom, to: dateTo });
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/tickets/export', {
        params: { startDate: applied.from, endDate: applied.to },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HSE_Analytics_${applied.from}_${applied.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('analytics.errors.exportFailed', 'Export failed. Please try again.'), 'error');
    }
  };

  const [aiUnavailable, setAiUnavailable] = useState(false);

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput('');
    setAiHistory(h => [...h, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analytics-chat', {
        question: userMsg,
        context: JSON.stringify(data),
        dateFrom: applied.from,
        dateTo: applied.to,
      });
      setAiHistory(h => [...h, { role: 'ai', text: res.data.answer }]);
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 503 || data?.unavailable) {
        setAiUnavailable(true);
        setAiHistory(h => [...h, {
          role: 'ai',
          text: isRtl
            ? '⚠️ الذكاء الاصطناعي غير متاح مؤقتاً بسبب تجاوز الحصة المجانية. يرجى المحاولة لاحقاً.'
            : '⚠️ AI is temporarily unavailable (free quota exceeded). Please try again later.'
        }]);
      } else {
        setAiHistory(h => [...h, { role: 'ai', text: t('analytics.ai.error', '⚠️ Sorry, could not get a response. Please try again.') }]);
      }
    } finally {
      setAiLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };


  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  if (error) return (
    <div className="text-center py-20">
      <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
      <p className="text-red-600 text-sm font-semibold">{error}</p>
    </div>
  );

  if (!data) return null;

  const rc = data.reportingCulture || {};
  const rcStyle = getRciStyle(rc.level, t);
  const rciTrend = rc.trend?.previous != null ? rc.rci - rc.trend.previous : null;

  // Pyramid layers (bottom to top is Heinrich convention; we render top-down)
  const pyramidLayers = [
    { key: 'fatality',    label: t('analytics.pyramid.fatality', 'Fatalities'),         actual: data.pyramid?.fatality || 0,    expected: 0,                         color: '#7f1d1d', width: 18 },
    { key: 'lti',         label: t('analytics.pyramid.lti', 'LTI / Serious Injuries'), actual: data.pyramid?.lti || 0,         expected: data.pyramidExpected?.lti, color: '#dc2626', width: 30 },
    { key: 'medical',     label: t('analytics.pyramid.medical', 'Medical / First Aid'), actual: data.pyramid?.medical || 0,     expected: data.pyramidExpected?.medical, color: '#ea580c', width: 50 },
    { key: 'nearMiss',    label: t('analytics.pyramid.nearMiss', 'Near-Miss'),   actual: data.pyramid?.nearMiss || 0,    expected: data.pyramidExpected?.nearMiss, color: '#f59e0b', width: 75 },
    { key: 'observation', label: t('analytics.pyramid.observation', 'Observations'), actual: data.pyramid?.observation || 0, expected: data.pyramidExpected?.observation, color: '#16a34a', width: 100 },
  ];

  const maxHourCount = Math.max(...(data.byHourOfDay || []).map((h: any) => h.count), 1);
  const maxDayCount  = Math.max(...(data.byDayOfWeek || []).map((d: any) => d.count), 1);
  const maxParetoCount = Math.max(...(data.paretoTypes || []).map((p: any) => p.count), 1);
  const maxDeptCount = Math.max(...(data.departmentHeatmap || []).map((d: any) => d.count), 1);

  return (
    <div className={`space-y-5 pb-8 relative ${isRtl ? 'font-arabic dir-rtl' : 'font-sans dir-ltr'}`}>

      {/* ── AI Chat Sidebar Panel ── */}
      <div className={`fixed top-0 ${isRtl ? 'left-0' : 'right-0'} h-full w-full sm:w-96 bg-slate-50 border-${isRtl ? 'r' : 'l'} border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${aiOpen ? 'translate-x-0' : (isRtl ? '-translate-x-full' : 'translate-x-full')} flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{t('analytics.ai.title', 'HSE AI Assistant')}</h3>
              <p className="text-[10px] text-violet-200">{t('analytics.ai.subtitle', 'Ask anything about your safety data')}</p>
            </div>
          </div>
          <button onClick={() => setAiOpen(false)} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/20 transition-all">
            {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {aiHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
              <Sparkles size={32} className="mb-3 text-violet-300" />
              <p className="text-sm font-semibold">{t('analytics.ai.welcome', 'Ask me about your HSE statistics!')}</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {[
                  t('analytics.ai.q1', 'What is the top incident type?'), 
                  t('analytics.ai.q2', 'Which department has the most delays?'), 
                  t('analytics.ai.q3', 'How is our RCI score?')
                ].map(q => (
                  <button key={q} onClick={() => { setAiInput(q); }}
                    className="text-[11px] bg-white border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full hover:bg-violet-50 transition-all shadow-sm">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {aiHistory.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? (isRtl ? 'justify-start' : 'justify-end') : (isRtl ? 'justify-end flex-row-reverse' : 'justify-start')}`}>
              {m.role === 'ai' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm"><Bot size={16} className="text-white" /></div>}
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? `bg-blue-600 text-white ${isRtl ? 'rounded-tl-sm' : 'rounded-tr-sm'} shadow-md`
                  : `bg-white border border-slate-200 text-slate-700 ${isRtl ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-sm`
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className={`flex gap-3 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm"><Bot size={16} className="text-white" /></div>
              <div className={`bg-white border border-slate-200 px-4 py-2.5 rounded-2xl ${isRtl ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-sm`}>
                <Loader2 size={16} className="animate-spin text-violet-500" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 focus-within:ring-2 focus-within:ring-violet-400 transition-all">
            <input
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiSend()}
              placeholder={t('analytics.ai.placeholder', 'Ask about incidents, trends...')}
              className="flex-1 text-sm bg-transparent px-2 py-2 focus:outline-none"
            />
            <button
              onClick={handleAiSend} disabled={!aiInput.trim() || aiLoading}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                !aiInput.trim() || aiLoading ? 'bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md'
              }`}
            >
              <Send size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {aiOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 sm:hidden"
          onClick={() => setAiOpen(false)}
        />
      )}

      {/* ── Date range filter bar ── */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-50 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600">{t('analytics.filter.from', 'From')}</span>
            <input
              type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="text-sm bg-transparent focus:outline-none"
            />
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold text-slate-600">{t('analytics.filter.to', 'To')}</span>
            <input
              type="date" value={dateTo} min={dateFrom} max={today}
              onChange={e => setDateTo(e.target.value)}
              className="text-sm bg-transparent focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 sm:py-2 rounded-lg transition-all shadow-sm"
          >
            <Filter size={13} /> {t('analytics.filter.apply', 'Apply Filter')}
          </button>
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 sm:py-2 rounded-lg transition-all shadow-sm"
          >
            <Download size={13} /> {t('analytics.filter.export', 'Export Excel')}
          </button>
          </div>
        </div>

        <button
          onClick={() => !aiUnavailable && setAiOpen(o => !o)}
          disabled={aiUnavailable}
          title={aiUnavailable ? (isRtl ? 'الذكاء الاصطناعي غير متاح (تجاوز الحصة)' : 'AI unavailable (quota exceeded)') : ''}
          className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm ${
            aiUnavailable
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : aiOpen
                ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white'
          }`}
        >
          <Bot size={14} /> {aiUnavailable ? (isRtl ? 'AI غير متاح' : 'AI Unavailable') : t('analytics.ai.button', 'AI Assistant')}
        </button>

      </div>

      {/* ── Hero header (dark gradient) ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 shadow-lg shadow-blue-900/20">
        <div className={`absolute top-0 ${isRtl ? 'left-0' : 'right-0'} w-56 h-56 bg-blue-500/20 rounded-full blur-3xl pointer-events-none`} />
        <div className={`absolute bottom-0 ${isRtl ? 'right-12' : 'left-12'} w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none`} />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
            <BarChart3 size={24} className="text-blue-200" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t('analytics.hero.title', 'HSE Analytics Dashboard')}</h1>
            <p className="text-blue-200/80 text-sm mt-1 font-medium">
              {t('analytics.hero.subtitle', 'Safety Performance & Reporting Culture')} — <span className="text-blue-100">{applied.from} → {applied.to}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── MAP SECTION ── */}
      {data.mapCases && data.mapCases.length > 0 && (
        <Section title={isRtl ? 'خريطة البلاغات المباشرة' : 'Live Incidents Map'} icon={<MapPin size={16} />}>
          <div className="mb-3 flex gap-4 flex-wrap text-xs font-bold text-slate-600 items-center justify-center bg-slate-50 py-2 rounded-lg">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm"></span> {isRtl ? 'رئيسي (Major/Fatal)' : 'Major'}</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm"></span> {isRtl ? 'مؤثر (Significant)' : 'Significant'}</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm"></span> {isRtl ? 'بسيط (Minor)' : 'Minor'}</div>
            <div className="w-px h-4 bg-slate-300 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-sm flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></span> {isRtl ? 'مفتوحة (Open)' : 'Open'}</div>
            <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-400 border-2 border-slate-700 shadow-sm flex items-center justify-center text-[8px] text-white font-black opacity-80">✓</span> {isRtl ? 'مغلقة (Closed)' : 'Closed'}</div>
          </div>
          <AnalyticsMap cases={data.mapCases} isRtl={isRtl} />
        </Section>
      )}

      {/* ── 1. KPI HERO ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Days Without LTI */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-white p-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-4 shadow-md">
            <ShieldCheck size={20} />
          </div>
          <p className="text-4xl font-black text-emerald-700 leading-none tracking-tight">
            {data.daysSinceLastLTI != null ? fmtNum(data.daysSinceLastLTI) : '∞'}
          </p>
          <p className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">{t('analytics.kpi.daysWithoutLTI', 'Days Without LTI')}</p>
        </div>

        {/* Open Incidents */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-white p-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center mb-4 shadow-md">
            <Activity size={20} />
          </div>
          <p className="text-4xl font-black text-blue-700 leading-none tracking-tight">{fmtNum(data.openCount)}</p>
          <p className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">{t('analytics.kpi.openTickets', 'Open Tickets')}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{t('analytics.kpi.outOfTotal', 'out of {{total}} total', { total: fmtNum(data.totalTickets) })}</p>
        </div>

        {/* Overdue Action Plans */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 border border-white p-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center mb-4 shadow-md">
            <Clock size={20} />
          </div>
          <p className={`text-4xl font-black leading-none tracking-tight ${data.overdueActionPlansCount > 0 ? 'text-red-700' : 'text-slate-700'}`}>
            {fmtNum(data.overdueActionPlansCount)}
          </p>
          <p className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">{t('analytics.kpi.overduePlans', 'Overdue Plans')}</p>
        </div>

        {/* Total Injuries */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-white p-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center mb-4 shadow-md">
            <AlertTriangle size={20} />
          </div>
          <p className="text-4xl font-black text-rose-700 leading-none tracking-tight">{fmtNum(data.lagging?.totalInjuries || 0)}</p>
          <p className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">{t('analytics.kpi.recordedInjuries', 'Recorded Injuries')}</p>
        </div>
      </div>



      {/* ── 2. REPORTING CULTURE INDEX (RCI) ── */}
      <Section title={t('analytics.rci.title', 'Reporting Culture Index (RCI)')} subtitle={t('analytics.rci.subtitle', 'Key indicator of safety culture health')} icon={<Sparkles size={16} />}>
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Gauge */}
          <div className="flex-shrink-0 mx-auto lg:mx-0 flex flex-col items-center gap-3">
            <RCIGauge value={rc.rci || 0} level={rc.level || 'POOR'} t={t} />
            {rciTrend != null && rciTrend !== 0 && (
              <div className={`flex items-center gap-1.5 text-sm font-bold bg-slate-50 px-3 py-1.5 rounded-full ${rciTrend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {rciTrend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {rciTrend > 0 ? '+' : ''}{rciTrend} {t('analytics.rci.vsLastMonth', 'vs last month')}
              </div>
            )}
          </div>

          {/* Components breakdown */}
          <div className="flex-1 w-full space-y-4">
            <p className="text-sm font-bold text-slate-800">{t('analytics.rci.components', 'Index Components:')}</p>
            {[
              { key: 'nearMissRatio',     label: t('analytics.rci.compNearMiss', 'Near-Miss Ratio (40%)'),         hint: `${t('analytics.rci.actual', 'Actual')}: ${rc.rawValues?.actualNearMissRatio || 0}:1 — ${t('analytics.rci.ideal', 'Ideal')}: ${rc.rawValues?.idealNearMissRatio || 130}:1` },
              { key: 'reporterDiversity', label: t('analytics.rci.compDiversity', 'Reporter Diversity (25%)'),      hint: `${rc.rawValues?.uniqueReporters || 0} ${t('analytics.rci.reportersFrom', 'reporters from')} ${rc.rawValues?.totalReporters || 0} ${t('analytics.rci.totalReports', 'total reports')}` },
              { key: 'proactiveRate',     label: t('analytics.rci.compProactive', 'Proactive Rate (20%)'),          hint: `${rc.rawValues?.proactivePercent || 0}% ${t('analytics.rci.areProactive', 'are proactive reports')}` },
              { key: 'timeliness',        label: t('analytics.rci.compTimeliness', 'Timeliness (15%)'),              hint: `${rc.rawValues?.timelyPercent || 0}% ${t('analytics.rci.reportedWithin24h', 'reported within 24h')}` },
            ].map(c => {
              const v = rc.components?.[c.key] || 0;
              return (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700">{c.label}</span>
                    <span className="text-xs font-black" style={{ color: pctColor(v) }}>{v}/100</span>
                  </div>
                  <ProgressBar value={v} />
                  <p className="text-[11px] text-slate-500 mt-1">{c.hint}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insights */}
        {rc.insights?.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" />
              {t('analytics.rci.automatedInsights', 'Automated Recommendations & Alerts:')}
            </p>
            {rc.insights.map((ins: any, i: number) => {
              const s = INSIGHT_STYLE[ins.level] || INSIGHT_STYLE.INFO;
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm shadow-sm"
                  style={{ background: s.bg, borderColor: s.border, color: s.color }}>
                  <span className="flex-shrink-0 mt-0.5">{s.icon}</span>
                  <span className="font-semibold leading-relaxed">{isRtl ? ins.textAr : ins.textEn}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 3. HEINRICH PYRAMID ── */}
      <Section title={t('analytics.pyramid.title', 'Incident Pyramid (Industrial Standard)')} subtitle="1 LTI : 10 Medical : 30 Near-Miss : 100 Observation" icon={<TrendingUp size={16} />}>
        <div className="space-y-3">
          {pyramidLayers.map(layer => {
            const gap = layer.expected != null && layer.actual < layer.expected ? layer.expected - layer.actual : 0;
            const ok  = layer.expected != null ? layer.actual >= layer.expected : true;
            return (
              <div key={layer.key} className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-32 ${isRtl ? 'text-left' : 'text-right'}`}>
                  <div className="text-xs font-bold text-slate-700">{layer.label}</div>
                </div>
                <div className="flex-1 relative" style={{ width: `${layer.width}%` }}>
                  <div className="h-10 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md"
                    style={{ background: `linear-gradient(135deg, ${layer.color}, ${layer.color}cc)`, width: `${layer.width}%`, [isRtl ? 'marginLeft' : 'marginRight']: 'auto' }}>
                    {layer.actual}
                  </div>
                </div>
                <div className={`flex-shrink-0 w-36 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {layer.expected != null && layer.expected > 0 ? (
                    <>
                      <div className="text-[11px] text-slate-500 font-medium">{t('analytics.pyramid.ideal', 'Ideal')}: {layer.expected}</div>
                      {gap > 0 ? (
                        <div className="text-[11px] font-bold text-red-600 flex items-center gap-1">⚠️ {t('analytics.pyramid.gap', 'Gap')}: {gap}</div>
                      ) : ok ? (
                        <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">✓ {t('analytics.pyramid.healthy', 'Healthy Rate')}</div>
                      ) : null}
                    </>
                  ) : <div className="text-[11px] text-slate-400">—</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            {t('analytics.pyramid.hint', 'The golden rule: for every serious incident there should be proportional lower-severity reports. A large gap in the lower layers indicates under-reporting and hidden risks.')}
          </p>
        </div>
      </Section>

      {/* ── 4. LEADING vs LAGGING ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title={t('analytics.leading.title', 'Leading Indicators')} subtitle={t('analytics.leading.subtitle', 'Prevent incidents before they occur')} icon={<TrendingUp size={16} />}>
          <div className="space-y-3">
            {[
              { label: t('analytics.leading.nearMiss', 'Near-Miss'),                value: data.leading?.nearMiss,             bg: 'bg-amber-50',    color: 'text-amber-700' },
              { label: t('analytics.leading.observations', 'Unsafe Observations & Acts'), value: data.leading?.observation,          bg: 'bg-emerald-50',  color: 'text-emerald-700' },
              { label: t('analytics.leading.approvedPlans', 'Approved Action Plans'),           value: data.leading?.actionPlansApproved,  bg: 'bg-blue-50',     color: 'text-blue-700' },
              { label: t('analytics.leading.onTimePlans', 'On-Time Action Plans'),     value: data.leading?.actionPlansOnTime,    bg: 'bg-indigo-50',   color: 'text-indigo-700' },
            ].map((it, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${it.bg} rounded-xl`}>
                <span className="text-sm font-semibold text-slate-700">{it.label}</span>
                <span className={`text-2xl font-black ${it.color}`}>{fmtNum(it.value || 0)}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t('analytics.lagging.title', 'Lagging Indicators')} subtitle={t('analytics.lagging.subtitle', 'Incidents that already occurred')} icon={<TrendingDown size={16} />}>
          <div className="space-y-3">
            {[
              { label: t('analytics.pyramid.fatality', 'Fatalities'),           value: data.lagging?.fatality,       bg: 'bg-red-100',   color: 'text-red-800' },
              { label: t('analytics.pyramid.lti', 'LTI / Serious Injuries'), value: data.lagging?.lti,         bg: 'bg-rose-50',   color: 'text-rose-700' },
              { label: t('analytics.pyramid.medical', 'Medical / First Aid'), value: data.lagging?.medical,       bg: 'bg-orange-50', color: 'text-orange-700' },
              { label: t('analytics.lagging.totalInjuries', 'Total Injuries'),  value: data.lagging?.totalInjuries, bg: 'bg-pink-50',   color: 'text-pink-700' },
            ].map((it, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${it.bg} rounded-xl`}>
                <span className="text-sm font-semibold text-slate-700">{it.label}</span>
                <span className={`text-2xl font-black ${it.color}`}>{fmtNum(it.value || 0)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── 5. DEPARTMENT CULTURE SCORECARD ── */}
      {rc.byDepartment?.length > 0 && (
        <Section title={t('analytics.scorecard.title', 'Department Reporting Culture Scorecard')} icon={<Users size={16} />}>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {rc.byDepartment.map((d: any) => (
              <div key={d.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">{isRtl ? d.nameAr : d.nameEn}</span>
                  <span className="inline-block w-12 text-center font-black px-2 py-1 rounded-md text-white text-xs shadow-sm"
                    style={{ background: pctColor(d.rci) }}>{d.rci}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center bg-white rounded-lg py-1.5 border border-slate-100">
                    <p className="text-slate-400 text-[10px]">{t('analytics.scorecard.total', 'Total')}</p>
                    <p className="font-bold text-slate-800">{d.total}</p>
                  </div>
                  <div className="text-center bg-white rounded-lg py-1.5 border border-slate-100">
                    <p className="text-slate-400 text-[10px]">{t('analytics.scorecard.incidents', 'Incidents')}</p>
                    <p className="font-bold text-rose-600">{d.accidents}</p>
                  </div>
                  <div className="text-center bg-white rounded-lg py-1.5 border border-slate-100">
                    <p className="text-slate-400 text-[10px]">{t('analytics.scorecard.proactive', 'Proactive')}</p>
                    <p className="font-bold text-emerald-600">{d.proactive}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500">{t('analytics.scorecard.ratio', 'Ratio')}: <strong className="text-slate-700">{d.ratio != null ? `${d.ratio}:1` : '∞:1'}</strong></span>
                  <span className="text-slate-500">{t('analytics.scorecard.reporters', 'Reporters')}: <strong className="text-slate-700">{d.uniqueReporters}</strong></span>
                  {d.alert === 'SUSPECTED_UNDER_REPORTING' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 ring-1 ring-red-200 px-2 py-0.5 rounded-full">
                      <AlertOctagon size={10} /> {t('analytics.scorecard.underReporting', 'Under-Reporting')}
                    </span>
                  )}
                  {d.alert === 'SINGLE_REPORTER' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 rounded-full">
                      <Users size={10} /> {t('analytics.scorecard.singleReporter', 'Single Reporter')}
                    </span>
                  )}
                  {!d.alert && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">✓</span>}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className={`w-full text-sm ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.department', 'Department')}</th>
                  <th className="py-3 px-2 font-bold">RCI</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.total', 'Total')}</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.incidents', 'Incidents')}</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.proactive', 'Proactive')}</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.ratio', 'Ratio')}</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.reporters', 'Reporters')}</th>
                  <th className="py-3 px-2 font-bold">{t('analytics.scorecard.alert', 'Alert')}</th>
                </tr>
              </thead>
              <tbody>
                {rc.byDepartment.map((d: any) => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2 font-bold text-slate-800">{isRtl ? d.nameAr : d.nameEn}</td>
                    <td className="py-3 px-2">
                      <span className="inline-block w-12 text-center font-black px-2 py-1 rounded-md text-white text-xs shadow-sm"
                        style={{ background: pctColor(d.rci) }}>{d.rci}</span>
                    </td>
                    <td className="py-3 px-2 font-semibold">{d.total}</td>
                    <td className="py-3 px-2 text-rose-600 font-semibold">{d.accidents}</td>
                    <td className="py-3 px-2 text-emerald-600 font-semibold">{d.proactive}</td>
                    <td className="py-3 px-2 text-slate-600 font-mono text-xs">{d.ratio != null ? `${d.ratio}:1` : '∞:1'}</td>
                    <td className="py-3 px-2 text-slate-600 font-semibold">{d.uniqueReporters}</td>
                    <td className="py-3 px-2">
                      {d.alert === 'SUSPECTED_UNDER_REPORTING' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-700 bg-red-50 ring-1 ring-red-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                          <AlertOctagon size={12} /> {t('analytics.scorecard.underReporting', 'Under-Reporting')}
                        </span>
                      )}
                      {d.alert === 'SINGLE_REPORTER' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                          <Users size={12} /> {t('analytics.scorecard.singleReporter', 'Single Reporter')}
                        </span>
                      )}
                      {!d.alert && <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-200">✓ {t('analytics.scorecard.healthy', 'Healthy')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── 6. RISK HEATMAPS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zone heatmap */}
        {data.zoneDistribution?.length > 0 && (
          <Section title={t('analytics.heatmaps.zones', 'Incidents by Zone')} icon={<MapPin size={16} />}>
            <div className="space-y-4">
              {data.zoneDistribution.slice(0, 8).map((z: any, i: number) => {
                const max = data.zoneDistribution[0].count;
                const pct = (z.count / max) * 100;
                const colors = ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a'];
                const color = colors[Math.min(i, colors.length - 1)];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-white text-[11px] font-black flex-shrink-0" style={{ background: color }}>{i + 1}</span>
                        <span className="text-sm font-bold text-slate-800 truncate">{z.name}</span>
                        {z.injuries > 0 && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full flex-shrink-0">🩹 {z.injuries}</span>}
                      </div>
                      <span className="text-sm font-black flex-shrink-0" style={{ color }}>{z.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Department heatmap */}
        {data.departmentHeatmap?.length > 0 && (
          <Section title={t('analytics.heatmaps.departments', 'Incidents by Department')} icon={<Users size={16} />}>
            <div className="space-y-4">
              {data.departmentHeatmap.slice(0, 8).map((d: any, i: number) => {
                const pct = (d.count / maxDeptCount) * 100;
                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{isRtl ? d.nameAr : d.nameEn}</span>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                        {d.injuries > 0 && <span className="bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">🩹 {d.injuries}</span>}
                        {d.avgClosureHours != null && <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded-md">⏱ {d.avgClosureHours}h</span>}
                        <span className="font-black text-blue-600 text-sm">{d.count}</span>
                      </div>
                    </div>
                    <ProgressBar value={pct} color="#3b82f6" height={10} />
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* ── 7. TIME PATTERNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By hour of day */}
        <Section title={t('analytics.time.hour', 'Incidents by Hour of Day')} subtitle={t('analytics.time.hourSub', 'When do incidents occur?')} icon={<Clock size={16} />}>
          <div className="flex items-end gap-1.5 h-36 mt-2">
            {data.byHourOfDay?.map((h: any) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5 group relative" title={`${h.hour}:00 — ${h.count}`}>
                <div className="w-full rounded-t bg-gradient-to-t from-blue-600 to-blue-400 transition-all group-hover:from-blue-700 group-hover:to-blue-500"
                  style={{ height: `${(h.count / maxHourCount) * 100}%`, minHeight: h.count > 0 ? 4 : 0 }} />
                <span className="text-[9px] font-bold text-slate-400">{h.hour}</span>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                  {h.count} incidents
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* By day of week */}
        <Section title={t('analytics.time.day', 'Incidents by Day of Week')} icon={<Calendar size={16} />}>
          <div className="space-y-3 mt-2">
            {data.byDayOfWeek?.map((d: any) => {
              const pct = (d.count / maxDayCount) * 100;
              // Ensure day names are translated
              const dayName = t(`analytics.days.${d.name.toLowerCase()}`, d.name);
              return (
                <div key={d.day} className="flex items-center gap-4">
                  <span className={`w-20 text-xs font-bold text-slate-700 ${isRtl ? 'text-right' : 'text-left'}`}>{dayName}</span>
                  <div className="flex-1">
                    <ProgressBar value={pct} color="#8b5cf6" height={12} />
                  </div>
                  <span className={`w-8 text-sm font-black text-violet-700 ${isRtl ? 'text-left' : 'text-right'}`}>{d.count}</span>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ── 8. PARETO + COMPLIANCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pareto by type */}
        {data.paretoTypes?.length > 0 && (
          <Section title={t('analytics.pareto.title', 'Incident Types (Pareto Analysis)')} subtitle={t('analytics.pareto.subtitle', '80/20 — Most frequent types')} icon={<FileWarning size={16} />}>
            <div className="space-y-4">
              {data.paretoTypes.map((p: any, i: number) => (
                <div key={p.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-700">{i + 1}. {t(`oc.incidentTypes.${p.type}`, p.type?.replace(/_/g, ' '))}</span>
                    <span className="text-sm font-black text-slate-800">{p.count}</span>
                  </div>
                  <ProgressBar value={(p.count / maxParetoCount) * 100} color={`hsl(${200 - i * 15}, 70%, 50%)`} height={10} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Compliance */}
        <Section title={t('analytics.compliance.title', 'Compliance & Regulatory Actions')} icon={<ShieldCheck size={16} />}>
          <div className="space-y-5">
            {[
              { label: t('analytics.compliance.gosi', 'GOSI Reporting'),    value: data.compliance?.gosiRate || 100, sub: `${data.compliance?.gosiSubmitted || 0} / ${data.compliance?.gosiNeeded || 0}` },
              { label: t('analytics.compliance.rca', 'RCA Completion'), value: data.compliance?.rcaRate  || 100, sub: `${data.compliance?.rcaCompleted  || 0} / ${data.compliance?.rcaNeeded  || 0}` },
              { label: t('analytics.compliance.ontime', 'On-Time Reports (<24h)'),     value: 100 - (data.compliance?.lateReportRate || 0), sub: `${data.compliance?.lateReports || 0} ${t('analytics.compliance.lateReports', 'late reports')}` },
            ].map((it, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">{it.label}</span>
                  <span className="text-lg font-black" style={{ color: pctColor(it.value) }}>{it.value}%</span>
                </div>
                <ProgressBar value={it.value} height={12} />
                <p className="text-xs font-medium text-slate-500 mt-1.5">{it.sub}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── 9. PERFORMANCE: Closure time + Top overdue depts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Closure time by type */}
        {data.avgClosureByType?.length > 0 && (
          <Section title={t('analytics.performance.closure', 'Avg. Closure Time by Type')} subtitle={`${t('analytics.performance.overallAvg', 'Overall Avg:')} ${data.avgClosureText}`} icon={<Clock size={16} />}>
            <div className="space-y-4">
              {data.avgClosureByType.slice(0, 6).map((typeItem: any) => {
                const max = data.avgClosureByType[0].avgHours || 1;
                const pct = (typeItem.avgHours / max) * 100;
                return (
                  <div key={typeItem.type}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-bold text-slate-700">{t(`oc.incidentTypes.${typeItem.type}`, typeItem.type?.replace(/_/g, ' '))}</span>
                      <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-xs">{typeItem.avgHours < 24 ? `${typeItem.avgHours}h` : `${Math.floor(typeItem.avgHours / 24)}d`}</span>
                    </div>
                    <ProgressBar value={pct} color="#06b6d4" height={10} />
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Top overdue departments */}
        {data.topOverdueDepartments?.length > 0 ? (
          <Section title={t('analytics.performance.overdue', 'Most Overdue Departments')} icon={<AlertOctagon size={16} />}>
            <div className="space-y-3">
              {data.topOverdueDepartments.map((d: any, i: number) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-black text-base flex-shrink-0 shadow-sm">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{isRtl ? d.nameAr : d.nameEn}</p>
                    <p className="text-[11px] text-red-600 font-semibold mt-0.5">{t('analytics.performance.oldestOverdue', 'Oldest overdue:')} {d.oldestDays} {t('analytics.performance.days', 'days')}</p>
                  </div>
                  <span className="text-xl font-black text-red-600 flex-shrink-0">{d.count}</span>
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title={t('analytics.performance.overdue', 'Most Overdue Departments')} icon={<CheckCircle size={16} />}>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <p className="text-base font-black text-emerald-700">{t('analytics.performance.noOverdue', 'No Overdue Plans')}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{t('analytics.performance.allOnTrack', 'All departments are on track with their plans 🎉')}</p>
            </div>
          </Section>
        )}
      </div>

      {/* ── 10. MONTHLY TREND ── */}
      {Object.keys(data.monthlyTrend || {}).length > 0 && (
        <Section title={t('analytics.trend.title', 'Monthly Trend — Last 6 Months')} icon={<BarChart3 size={16} />}>
          <div className="flex items-end gap-3 h-48 mt-4">
            {Object.entries(data.monthlyTrend).map(([k, v]: any) => {
              const max = Math.max(...(Object.values(data.monthlyTrend) as any[]).map(x => x.total), 1);
              const totalH = (v.total / max) * 100;
              const injH   = (v.injuries / max) * 100;
              const ltiH   = (v.lti / max) * 100;
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end gap-1" style={{ height: '140px' }}>
                    <div className="flex-1 rounded-t bg-gradient-to-t from-blue-500 to-blue-300 relative group-hover:from-blue-600 group-hover:to-blue-400 transition-colors" style={{ height: `${totalH}%` }}>
                      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">{v.total}</span>
                    </div>
                    <div className="flex-1 rounded-t bg-gradient-to-t from-rose-500 to-rose-300 relative group-hover:from-rose-600 group-hover:to-rose-400 transition-colors" style={{ height: `${injH}%` }}>
                      {v.injuries > 0 && <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">{v.injuries}</span>}
                    </div>
                    <div className="flex-1 rounded-t bg-gradient-to-t from-red-700 to-red-500 relative group-hover:from-red-800 group-hover:to-red-600 transition-colors" style={{ height: `${ltiH}%` }}>
                      {v.lti > 0 && <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">{v.lti}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-md">{k.split('-')[1]}/{k.split('-')[0].slice(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 mt-6 justify-center text-xs font-bold text-slate-600">
            <span className="flex items-center gap-2"><span className="w-4 h-4 bg-blue-500 rounded" /> {t('analytics.trend.total', 'Total')}</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 bg-rose-500 rounded" /> {t('analytics.trend.injuries', 'Injuries')}</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 bg-red-700 rounded" /> LTI</span>
          </div>
        </Section>
      )}

      {/* ── 11. TOP REPORTERS / SAFETY CHAMPIONS ── */}
      {data.topReporters?.length > 0 && (
        <Section title={t('analytics.champions.title', 'Safety Champions (Top Reporters)')} subtitle={t('analytics.champions.subtitle', 'Employees most committed to reporting culture')} icon={<Trophy size={16} />}>
          <div className="space-y-3">
            {data.topReporters.map((r: any, i: number) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-base flex-shrink-0 shadow-md">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{r.name}</p>
                    {r.champion && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-200 px-2.5 py-0.5 rounded-full flex-shrink-0">
                        <Flame size={12} /> {t('analytics.champions.championBadge', 'Safety Champion')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">{r.role?.replace(/_/g, ' ')} — {r.proactiveRate}% {t('analytics.champions.proactiveRate', 'proactive reports')}</p>
                </div>
                <span className="text-2xl font-black text-amber-700 flex-shrink-0">{r.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 12. SERVICE PROVIDER VIOLATIONS ── */}
      {data.serviceProviderViolations?.length > 0 && (
        <Section title={t('analytics.spv.title', 'Service Provider Violations')} subtitle={t('analytics.spv.subtitle', 'Top contractors with the most reported incidents')} icon={<Briefcase size={16} />}>
          <div className="space-y-2">
            {data.serviceProviderViolations.map((sp: any, i: number) => (
              <ServiceProviderCard key={sp.id} sp={sp} rank={i + 1} t={t} isRtl={isRtl} />
            ))}
          </div>
        </Section>
      )}

      {/* Footer note */}
      <p className="text-center text-[11px] text-slate-400 pt-4 font-medium">
        {t('analytics.footerNote', 'These statistics are built according to international HSE best practices and Saudi industrial site standards.')}
      </p>
    </div>
  );
};

export default Analytics;
