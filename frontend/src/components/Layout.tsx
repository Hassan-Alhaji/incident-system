import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, PlusCircle, LogOut, Globe, Bell,
    Menu, X, ShieldAlert, BadgeCheck, Settings
} from 'lucide-react';
import api from '../utils/api';
import OnboardingModal from './OnboardingModal';

function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [lang, setLang] = useState('EN');

    // Notification State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'New Ticket', icon: PlusCircle, path: '/tickets/new' },
    ];

    if (user?.role === 'ADMIN') {
        menuItems.push({ name: 'Settings', icon: Settings, path: '/settings' });
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user) return;
            try {
                const res = await api.get('/notifications');
                setNotifications(res.data);
                setUnreadCount(res.data.filter((n: any) => !n.read).length);
            } catch (err) {
                console.error('Failed to fetch notifications', err);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const handleMarkAsRead = async (id: string, link?: string) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            if (link) {
                setShowNotifications(false);
                navigate(link);
            }
        } catch (err) { console.error(err); }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put(`/notifications/read-all`);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) { console.error(err); }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <OnboardingModal />

            {/* Sidebar */}
            <aside className={`bg-emerald-950 text-white transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className="p-6 flex items-center gap-3">
                    <div className="bg-emerald-600 p-2 rounded-lg">
                        <ShieldAlert size={24} />
                    </div>
                    {isSidebarOpen && <span className="font-bold text-xl tracking-tight">SAMF Incident</span>}
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${active ? 'bg-emerald-600 text-white' : 'text-emerald-100 hover:bg-emerald-900'}`}
                            >
                                <Icon size={22} />
                                {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-emerald-900 space-y-4">
                    {isSidebarOpen && (
                        <div
                            onClick={() => navigate('/profile')}
                            className="flex items-center gap-3 px-4 py-2 bg-emerald-900 rounded-xl cursor-pointer hover:bg-emerald-800 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold">
                                {user?.firstName?.charAt(0) || user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold truncate">{user?.firstName ? `${user.firstName} ${user.lastName}` : user?.name}</p>
                                <p className="text-xs text-emerald-300 truncate">{user?.role?.replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-4 py-3 text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                        <LogOut size={22} />
                        {isSidebarOpen && <span className="font-medium">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 relative z-30">
                    <button onClick={toggleSidebar} className="text-gray-500 hover:text-emerald-900">
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setLang(lang === 'EN' ? 'AR' : 'EN')}
                            className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-emerald-600 transition-colors"
                        >
                            <Globe size={18} />
                            {lang === 'EN' ? 'English' : 'عربي'}
                        </button>

                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-1 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <Bell size={20} className="text-gray-500" />
                                {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />}
                            </button>

                            {/* Dropdown */}
                            {showNotifications && (
                                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                                    <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-gray-50">
                                        <h3 className="font-bold text-sm text-gray-900">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <button onClick={handleMarkAllRead} className="text-xs text-blue-600 font-medium hover:underline">
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 text-xs">No notifications</div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleMarkAsRead(n.id, n.link)}
                                                    className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${n.read ? 'opacity-60 bg-white' : 'bg-blue-50/30'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="text-sm font-bold text-gray-800">{n.title}</p>
                                                        <span className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-8 w-[1px] bg-gray-200 mx-2" />
                        <div className="flex items-center gap-2">
                            <BadgeCheck size={18} className="text-blue-500" />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Sync</span>
                        </div>
                    </div>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default Layout;
