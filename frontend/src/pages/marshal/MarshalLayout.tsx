import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import OnboardingModal from '../../components/OnboardingModal';

const MarshalLayout = () => {
    const { user, logout, isLoading } = useAuth();
    const navigate = useNavigate();

    if (isLoading) return <div className="p-10 text-center">Loading...</div>;

    if (!user) {
        return <Navigate to="/marshal/login" />;
    }

    // Optional: Check status
    if (user.status !== 'ACTIVE') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Account Suspended</h2>
                    <p className="text-gray-600">Please contact the administrator.</p>
                    <button onClick={logout} className="mt-4 text-sm text-blue-600 underline">Logout</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <OnboardingModal />

            {/* Mobile Header */}
            <header className="bg-black text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
                <div
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors"
                    onClick={() => navigate('/marshal/profile')}
                >
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-bold">
                        {user.firstName?.charAt(0) || user.name?.charAt(0) || 'M'}
                    </div>
                    <div>
                        <h1 className="font-bold text-sm">{user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || 'User')}</h1>
                        <p className="text-xs text-gray-400">{user.role?.replace(/_/g, ' ') || 'Marshal'}</p>
                    </div>
                </div>
                <button onClick={() => { logout(); navigate('/marshal/login'); }} className="text-gray-400 hover:text-white">
                    <LogOut size={20} />
                </button>
            </header>

            <main className="flex-1 w-full max-w-2xl mx-auto p-4">
                <Outlet />
            </main>
        </div>
    );
};

export default MarshalLayout;
