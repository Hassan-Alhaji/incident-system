import React from 'react';
import { Outlet } from 'react-router-dom';

const PublicLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
                <header className="bg-slate-900 text-white p-4 text-center">
                    <h1 className="text-xl font-bold uppercase tracking-wider">Marshal Incident Reporting</h1>
                </header>
                <main className="p-4">
                    <Outlet />
                </main>
                <footer className="bg-gray-100 p-3 text-center text-xs text-gray-500 border-t">
                    Incident Management System &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </div>
    );
};

export default PublicLayout;
