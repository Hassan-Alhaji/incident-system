import React from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogOut, LayoutDashboard, PlusCircle, Globe, AlertTriangle, Settings, BarChart3 } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';

const OC_ROLES = ['OC_REPORTER', 'OC_SUPERVISOR', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER', 'ADMIN'];

const OCLayout = () => {
    const { user, logout, isLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="animate-spin h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full"></div>
        </div>
    );

    if (!user) return <Navigate to="/oc/login" />;

    if (!OC_ROLES.includes(user.role)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl text-center max-w-sm">
                    <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-red-400 mb-2">{t('oc.accessDenied')}</h2>
                    <p className="text-slate-400 text-sm mb-6">{t('oc.noPermission')}</p>
                    <button onClick={() => { logout(); navigate('/oc/login'); }}
                        className="text-amber-400 underline text-sm">{t('menu.logout')}</button>
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

    const roleLabel = (role: string) => {
        const labels: Record<string, string> = {
            OC_REPORTER: t('oc.roles.reporter'),
            OC_SUPERVISOR: t('oc.roles.supervisor'),
            OC_SAFETY_INVESTIGATOR: t('oc.roles.investigator'),
            OC_HSE_MANAGER: t('oc.roles.hseManager'),
            ADMIN: 'Admin'
        };
        return labels[role] || role;
    };

    const canCreateTicket = user.role === 'OC_REPORTER' || user.role === 'ADMIN';
    const canManageSettings = user.canManageUsers || user.role === 'OC_HSE_MANAGER' || user.role === 'ADMIN';
    const canSeeAnalytics = user.canViewAnalytics || user.role === 'OC_HSE_MANAGER' || user.role === 'ADMIN';

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-700/50 sticky top-0 z-50 shadow-xl">
                <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-amber-500/20">
                            {user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <h1 className="font-bold text-sm text-white leading-tight">{user.name}</h1>
                            <p className="text-[11px] text-amber-400/80 font-medium">{roleLabel(user.role)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Fix #21: Show language label */}
                        <button onClick={toggleLang}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 transition-all text-xs font-bold flex items-center gap-1">
                            <Globe size={14} />
                            <span>{i18n.language.startsWith('ar') ? 'AR' : 'EN'}</span>
                        </button>
                        {/* Notification bell component */}
                        <NotificationBell portal="OC" />
                        <button onClick={() => { logout(); navigate('/oc/login'); }}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content — Fix #25: wider on desktop */}
            <main className="flex-1 w-full max-w-3xl lg:max-w-5xl mx-auto px-4 py-4 pb-24">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-50 safe-area-bottom">
                <div className="max-w-3xl lg:max-w-5xl mx-auto flex">
                    <button
                        onClick={() => navigate('/oc/dashboard')}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all
                            ${isActive('/oc/dashboard') ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <LayoutDashboard size={20} />
                        <span className="text-[10px] font-medium">{t('oc.nav.dashboard')}</span>
                    </button>
                    {canCreateTicket && (
                        <button
                            onClick={() => navigate('/oc/tickets/new')}
                            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all
                                ${isActive('/oc/tickets/new') ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <PlusCircle size={20} />
                            <span className="text-[10px] font-medium">{t('oc.nav.newTicket')}</span>
                        </button>
                    )}
                    {canSeeAnalytics && (
                        <button
                            onClick={() => navigate('/oc/analytics')}
                            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all
                                ${isActive('/oc/analytics') ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <BarChart3 size={20} />
                            <span className="text-[10px] font-medium">{t('oc.nav.analytics')}</span>
                        </button>
                    )}
                    {canManageSettings && (
                        <button
                            onClick={() => navigate('/oc/settings')}
                            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all
                                ${isActive('/oc/settings') ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Settings size={20} />
                            <span className="text-[10px] font-medium">{t('oc.nav.settings')}</span>
                        </button>
                    )}
                </div>
            </nav>
        </div>
    );
};

export default OCLayout;

