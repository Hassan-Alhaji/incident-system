import React from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LogOut, LayoutDashboard, PlusCircle, Globe,
  AlertTriangle, Settings, BarChart3, ShieldCheck, BookOpen,
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import ErrorBoundary from '../components/ErrorBoundary';

const OC_ROLES = [
  'OC_REPORTER', 'OC_SUPERVISOR', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER',
  'HSE_CONTROLLER', 'ADMIN', 'DEP_REP', 'DEP_MANAGER', 'SERVICE_PROVIDER_REP',
  'SAFETY_MANAGER', 'HR_REP', 'FINANCE_REP',
];

const ROLE_LABELS: Record<string, string> = {
  OC_REPORTER: 'Reporter',
  OC_SUPERVISOR: 'Supervisor',
  OC_SAFETY_INVESTIGATOR: 'Safety Investigator',
  OC_HSE_MANAGER: 'HSE Manager',
  HSE_CONTROLLER: 'HSE Controller',
  SAFETY_MANAGER: 'Safety Manager',
  ADMIN: 'Administrator',
  DEP_REP: 'Department Rep',
  DEP_MANAGER: 'Dept. Manager',
  HR_REP: 'HR Representative',
  FINANCE_REP: 'Finance Representative',
  SERVICE_PROVIDER_REP: 'Service Provider',
};

const Layout = () => {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40">
          <ShieldCheck className="text-white" size={24} />
        </div>
        <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  if (!OC_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-red-100 p-10 rounded-2xl text-center max-w-sm shadow-lg">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('oc.accessDenied')}</h2>
          <p className="text-slate-500 text-sm mb-7 leading-relaxed">
            {t('oc.noPermission')}
          </p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-blue-600 hover:text-blue-700 text-sm font-semibold underline underline-offset-2"
          >
            {t('oc.login.title', 'Return to Login')}
          </button>
        </div>
      </div>
    );
  }

  const toggleLang = () => {
    const next = i18n.language.startsWith('ar') ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const canCreateTicket = user.role === 'OC_REPORTER' || user.role === 'ADMIN';
  const canManageSettings =
    user.canManageUsers ||
    ['OC_HSE_MANAGER', 'HSE_CONTROLLER', 'ADMIN'].includes(user.role);
  const canSeeAnalytics =
    user.canViewAnalytics ||
    ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(user.role);

  const navItems = [
    {
      path: '/dashboard',
      icon: <LayoutDashboard size={17} />,
      label: t('oc.nav.dashboard'),
      show: true,
    },
    {
      path: '/tickets/new',
      icon: <PlusCircle size={17} />,
      label: t('oc.nav.newTicket'),
      show: canCreateTicket,
    },
    {
      path: '/analytics',
      icon: <BarChart3 size={17} />,
      label: t('oc.nav.analytics'),
      show: canSeeAnalytics,
    },
    {
      path: '/settings',
      icon: <Settings size={17} />,
      label: t('oc.nav.settings'),
      show: canManageSettings,
    },
    {
      path: '/user-guide',
      icon: <BookOpen size={17} />,
      label: t('oc.nav.userGuide'),
      show: true,
    },
  ].filter(item => item.show);

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const initials = user.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ────── Sidebar (desktop) ────── */}
      <aside className="hidden lg:flex w-60 bg-slate-900 flex-col fixed inset-y-0 ltr:left-0 rtl:right-0 z-50 shadow-sidebar">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-700/20 p-1.5">
              <img
                src="/smc-logo.png"
                alt="Saudi Motorsport"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">SMC HSE</p>
              <p className="text-slate-400 text-[10px] font-medium tracking-widest uppercase mt-0.5">
                Incident Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto sidebar-scroll">
          {navItems.map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group
                  ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <span className={`transition-colors flex-shrink-0
                  ${active ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-800/70">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-slate-500 text-[10px] truncate mt-0.5">{roleLabel}</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-all flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ────── Main content ────── */}
      <div className="flex-1 ltr:lg:ml-60 rtl:lg:mr-60 flex flex-col min-h-screen">

        {/* Top header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 h-14 flex items-center px-4 lg:px-6">

          {/* Mobile: brand */}
          <div className="flex lg:hidden items-center gap-2.5 flex-1">
            <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 shadow-sm">
              <img
                src="/smc-logo.png"
                alt="SMC"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <span className="font-bold text-slate-900 text-sm">SMC HSE</span>
          </div>

          {/* Desktop: spacer */}
          <div className="hidden lg:block flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/user-guide')}
              title={t('oc.nav.userGuide')}
              className="h-8 px-2.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-xs font-bold flex items-center gap-1.5"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">{t('oc.nav.userGuide')}</span>
            </button>

            <button
              onClick={toggleLang}
              className="h-8 px-2.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-xs font-bold flex items-center gap-1.5"
            >
              <Globe size={14} />
              <span>{i18n.language.startsWith('ar') ? 'EN' : 'AR'}</span>
            </button>

            <NotificationBell portal="OC" />

            {/* Mobile logout */}
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 lg:px-7 lg:py-6 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* ────── Bottom nav (mobile only) ────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
          <div className="flex overflow-x-auto scrollbar-none px-1 min-w-0">
            {navItems.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 py-3 px-3 min-h-[56px] min-w-[60px] transition-all relative
                    ${active ? 'text-blue-600' : 'text-slate-500'}`}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-blue-600 rounded-b-full" />
                  )}
                  {item.icon}
                  <span className="text-[11px] font-semibold leading-none whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
