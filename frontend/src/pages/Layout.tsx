import React from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogOut, LayoutDashboard, PlusCircle, Globe, AlertTriangle, Settings, BarChart3 } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';

const OC_ROLES = ['OC_REPORTER', 'OC_SUPERVISOR', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER', 'HSE_CONTROLLER', 'ADMIN', 'DEP_REP', 'DEP_MANAGER', 'SERVICE_PROVIDER_REP'];

const Layout = () => {
 const { user, logout, isLoading } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const { t, i18n } = useTranslation();

 if (isLoading) return (
 <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
 <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
 </div>
 );

 if (!user) return <Navigate to="/login" />;

 if (!OC_ROLES.includes(user.role)) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
 <div className="bg-white border border-red-200 p-8 rounded-2xl text-center max-w-sm shadow-lg">
 <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
 <h2 className="text-xl font-bold text-red-600 mb-2">{t('oc.accessDenied')}</h2>
 <p className="text-gray-600 text-sm mb-6">{t('oc.noPermission')}</p>
 <button onClick={() => { logout(); navigate('/login'); }}
 className="text-blue-600 hover:text-blue-700 underline text-sm font-medium">{t('menu.logout')}</button>
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
 HSE_CONTROLLER: 'HSE Controller',
 ADMIN: 'Admin'
 };
 return labels[role] || role;
 };

 const canCreateTicket = user.role === 'OC_REPORTER' || user.role === 'ADMIN';
 const canManageSettings = user.canManageUsers || user.role === 'OC_HSE_MANAGER' || user.role === 'HSE_CONTROLLER' || user.role === 'ADMIN';
 const canSeeAnalytics = user.canViewAnalytics || user.role === 'OC_HSE_MANAGER' || user.role === 'HSE_CONTROLLER' || user.role === 'ADMIN';

 return (
 <div className="min-h-screen bg-[#f0f2f5] text-gray-800 flex flex-col">
 {/* Header */}
 <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
 <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md shadow-blue-600/20">
 {user.name?.charAt(0) || 'U'}
 </div>
 <div>
 <h1 className="font-semibold text-sm text-gray-900 leading-tight">{user.name}</h1>
 <p className="text-[11px] text-blue-600 font-medium">{roleLabel(user.role)}</p>
 </div>
 </div>
 <div className="flex items-center gap-1.5">
 <button onClick={toggleLang}
 className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all text-xs font-bold flex items-center gap-1">
 <Globe size={15} />
 <span>{i18n.language.startsWith('ar') ? 'AR' : 'EN'}</span>
 </button>
 <NotificationBell portal="OC" />
 <button onClick={() => { logout(); navigate('/login'); }}
 className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
 <LogOut size={16} />
 </button>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <main className="flex-1 w-full max-w-3xl lg:max-w-5xl mx-auto px-4 py-5 pb-24">
 <Outlet />
 </main>

 {/* Bottom Navigation */}
 <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 safe-area-bottom shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.08)]">
 <div className="max-w-3xl lg:max-w-5xl mx-auto flex">
 {[
   { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: t('oc.nav.dashboard'), show: true },
   { path: '/tickets/new', icon: <PlusCircle size={20} />, label: t('oc.nav.newTicket'), show: canCreateTicket },
   { path: '/analytics', icon: <BarChart3 size={20} />, label: t('oc.nav.analytics'), show: canSeeAnalytics },
   { path: '/settings', icon: <Settings size={20} />, label: t('oc.nav.settings'), show: canManageSettings },
 ].filter(item => item.show).map(item => (
 <button
   key={item.path}
   onClick={() => navigate(item.path)}
   className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all relative
   ${isActive(item.path) ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
 >
   {isActive(item.path) && (
     <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-b-full" />
   )}
   {item.icon}
   <span className="text-[10px] font-semibold">{item.label}</span>
 </button>
 ))}
 </div>
 </nav>
 </div>
 );
};

export default Layout;
