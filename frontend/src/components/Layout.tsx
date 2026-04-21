import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
 LayoutDashboard, PlusCircle, LogOut, Globe,
 Menu, X, ShieldAlert, BadgeCheck, Settings
} from 'lucide-react';
import api from '../utils/api';
import NotificationBell from './NotificationBell';

function Layout() {
 const { user, logout } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const [isSidebarOpen, setSidebarOpen] = useState(true);
 const { t, i18n } = useTranslation();
 const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

 // Handle screen resize
 useEffect(() => {
 const handleResize = () => {
 const mobile = window.innerWidth < 1024;
 setIsMobile(mobile);
 if (mobile) {
 setSidebarOpen(false);
 } else {
 setSidebarOpen(true);
 }
 };

 // Initial check
 handleResize();

 window.addEventListener('resize', handleResize);
 return () => window.removeEventListener('resize', handleResize);
 }, []);

 // Close sidebar on route change if mobile
 useEffect(() => {
 if (isMobile && isSidebarOpen) setSidebarOpen(false);
 }, [location, isMobile]);

 const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

 const menuItems = [
 { name: t('menu.dashboard', 'Dashboard'), icon: LayoutDashboard, path: '/dashboard' },
 { name: t('menu.newTicket', 'New Ticket'), icon: PlusCircle, path: '/tickets/new' },
 ];

 if (user?.role === 'ADMIN') {
 menuItems.push({ name: t('menu.settings', 'Settings'), icon: Settings, path: '/settings' });
 }

 const handleLogout = () => {
 logout();
 navigate('/login');
 };

 return (
 <div className="flex h-screen bg-[#f0f2f5] overflow-hidden relative">

 {/* Mobile Overlay */}
 {isMobile && isSidebarOpen && (
 <div
 className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
 onClick={() => setSidebarOpen(false)}
 />
 )}

 {/* Sidebar */}
 <aside
 className={`
 fixed lg:static inset-y-0 left-0 z-50
 bg-white text-gray-800 border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col h-full shadow-sm
 ${isSidebarOpen
 ? 'translate-x-0 w-64'
 : (isMobile ? '-translate-x-full w-64 invisible' : 'translate-x-0 w-20')
 }
 `}
 >
 <div className="p-6 flex items-center gap-3 shrink-0">
 <div className="bg-blue-600 p-2 rounded-lg shrink-0 shadow-md shadow-blue-600/20">
 <ShieldAlert size={24} className="text-white" />
 </div>
 {(isSidebarOpen || isMobile) && <span className="font-bold text-lg text-gray-900 tracking-tight whitespace-nowrap">SAMF Incident</span>}
 </div>

 <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
 {menuItems.map((item) => {
 const Icon = item.icon;
 const active = location.pathname === item.path;
 return (
 <Link
 key={item.name}
 to={item.path}
 className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
 >
 <Icon size={22} className="shrink-0" />
 {(isSidebarOpen || isMobile) && <span className="font-medium whitespace-nowrap">{item.name}</span>}
 </Link>
 );
 })}
 </nav>

 <div className="p-4 border-t border-gray-100 space-y-4 shrink-0">
 {(isSidebarOpen || isMobile) && (
 <div
 onClick={() => navigate('/profile')}
 className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
 >
 <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-sm">
 {user?.firstName?.charAt(0) || user?.name?.charAt(0) || 'U'}
 </div>
 <div className="overflow-hidden">
 <p className="text-sm font-semibold text-gray-900 truncate">{user?.firstName ? `${user.firstName} ${user.lastName}` : user?.name}</p>
 <p className="text-xs text-gray-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
 </div>
 </div>
 )}
 <button
 onClick={handleLogout}
 className="w-full flex items-center gap-4 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
 >
 <LogOut size={22} className="shrink-0" />
 {(isSidebarOpen || isMobile) && <span className="font-medium whitespace-nowrap">{t('menu.logout', 'Logout')}</span>}
 </button>
 {/* Mobile Close Button to be explicit */}
 {isMobile && (
 <button
 onClick={() => setSidebarOpen(false)}
 className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 mt-2 lg:hidden"
 >
 <X size={20} className="mr-2" /> Close Menu
 </button>
 )}
 </div>
 </aside>

 {/* Main Content */}
 <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative transition-all duration-300">
 {/* Top Header */}
 <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-30 shadow-sm">
 <button onClick={toggleSidebar} className="text-gray-500 hover:text-emerald-900 p-2 rounded-lg hover:bg-gray-100">
 <Menu size={24} />
 </button>

 <div className="flex items-center gap-4 lg:gap-6">
 <button
 onClick={() => i18n.changeLanguage(i18n.language.startsWith('ar') ? 'en' : 'ar')}
 className="hidden sm:flex items-center gap-2 text-base font-bold text-gray-700 hover:text-emerald-600 transition-colors"
 >
 <Globe size={18} />
 {i18n.language.startsWith('ar') ? 'English' : 'عربي'}
 </button>

 {/* Smart Notification Bell */}
 <NotificationBell portal="INCIRCUIT" />

 <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block" />
 <div className="flex items-center gap-2 hidden sm:flex">
 <BadgeCheck size={18} className="text-blue-500" />
 <span className="text-base font-bold text-gray-400 uppercase tracking-widest">Live Sync</span>
 </div>
 </div>
 </header>

 {/* Scrollable Area */}
 <div className="flex-1 overflow-y-auto p-4 lg:p-8 w-full">
 <Outlet />
 </div>
 </main>
 </div>
 );
}

export default Layout;
