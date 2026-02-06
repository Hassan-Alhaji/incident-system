import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Plus, Trash2, Edit2, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'events'>('users');

    // Users State
    const [users, setUsers] = useState<any[]>([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [userError, setUserError] = useState<string>('');
    const [userFormData, setUserFormData] = useState({
        name: '', email: '', password: '', role: 'SPORT_MARSHAL', isIntakeEnabled: false
    });

    // Events State
    const [events, setEvents] = useState<any[]>([]);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventError, setEventError] = useState<string>('');
    const [eventFormData, setEventFormData] = useState({
        name: '', isActive: true
    });

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'events') fetchEvents();
    }, [activeTab]);

    // --- User Handlers ---
    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const handleUserSubmit = async () => {
        setUserError('');
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser}`, userFormData);
            } else {
                await api.post('/users', userFormData);
            }
            closeUserModal();
            fetchUsers();
        } catch (err: any) {
            setUserError(err.response?.data?.message || 'Operation failed');
        }
    };

    const deleteUser = async (id: string) => {
        if (!confirm('Delete user?')) return;
        try { await api.delete(`/users/${id}`); fetchUsers(); } catch (err) { alert('Failed'); }
    };

    const openUserModal = (u?: any) => {
        setUserError('');
        if (u) {
            setEditingUser(u.id);
            setUserFormData({
                name: u.name, email: u.email, password: '', role: u.role,
                isIntakeEnabled: u.isIntakeEnabled || false
            });
        } else {
            setEditingUser(null);
            setUserFormData({ name: '', email: '', password: '', role: 'SPORT_MARSHAL', isIntakeEnabled: false });
        }
        setShowUserModal(true);
    };

    const closeUserModal = () => { setShowUserModal(false); setEditingUser(null); };

    // --- Event Handlers ---
    const fetchEvents = async () => {
        try {
            const res = await api.get('/events');
            setEvents(res.data);
        } catch (err) { console.error(err); }
    };

    const handleEventSubmit = async () => {
        setEventError('');
        try {
            await api.post('/events', eventFormData);
            closeEventModal();
            fetchEvents();
        } catch (err: any) {
            setEventError(err.response?.data?.error || 'Failed to create event');
        }
    };

    const toggleEventStatus = async (id: string, currentStatus: boolean) => {
        try {
            await api.patch(`/events/${id}`, { isActive: !currentStatus });
            fetchEvents();
        } catch (err) { console.error(err); }
    };

    const deleteEvent = async (id: string) => {
        if (!confirm('Delete this event?')) return;
        try { await api.delete(`/events/${id}`); fetchEvents(); } catch (err) { alert('Failed'); }
    };

    const openEventModal = () => {
        setEventError('');
        setEventFormData({ name: '', isActive: true });
        setShowEventModal(true);
    };

    const closeEventModal = () => { setShowEventModal(false); };

    if (user?.role !== 'ADMIN') return <div className="p-8 text-center text-red-500">Access Denied</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-4 flex items-center gap-2 font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={18} /> User Management
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className={`pb-3 px-4 flex items-center gap-2 font-medium border-b-2 transition-colors ${activeTab === 'events' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Calendar size={18} /> Event Management
                </button>
            </div>

            {/* Content */}
            {activeTab === 'users' ? (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => openUserModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                            <Plus size={20} /> Add User
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Permissions</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">{u.name.charAt(0)}</div>
                                                <div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600 border border-gray-200">{u.role.replace(/_/g, ' ')}</span></td>
                                        <td className="px-6 py-4">{u.isIntakeEnabled ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">View All (Intake)</span> : <span className="text-gray-400 text-xs">Assigned Only</span>}</td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => openUserModal(u)} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg"><Edit2 size={18} /></button>
                                            <button onClick={() => deleteUser(u.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <p className="text-sm text-emerald-800">Events added here will appear in the Incident Report form dropdown.</p>
                        <button onClick={openEventModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                            <Plus size={20} /> Add Event
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Event Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Created At</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {events.map(e => (
                                    <tr key={e.id}>
                                        <td className="px-6 py-4 font-medium text-gray-900">{e.name}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleEventStatus(e.id, e.isActive)}
                                                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border ${e.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                            >
                                                {e.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                {e.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => deleteEvent(e.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {events.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No events found. Add one to get started.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                        <div className="space-y-4">
                            {userError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{userError}</div>}
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input className="w-full border rounded-lg p-2" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input className="w-full border rounded-lg p-2" value={userFormData.email} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <input type="password" className="w-full border rounded-lg p-2" value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <select className="w-full border rounded-lg p-2" value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}>
                                    <option value="SPORT_MARSHAL">Sport Marshal</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="MEDICAL_MARSHAL">Medical Marshal</option>
                                    <option value="SAFETY_MARSHAL">Safety Marshal</option>
                                    <option value="CONTROL_OP_TEAM">Control Op Team</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={userFormData.isIntakeEnabled} onChange={e => setUserFormData({ ...userFormData, isIntakeEnabled: e.target.checked })} />
                                <label className="text-sm font-medium">Enable Ticket Intake</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={closeUserModal} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                                <button onClick={handleUserSubmit} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg">{editingUser ? 'Update' : 'Create'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal */}
            {showEventModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">Add Event</h3>
                        <div className="space-y-4">
                            {eventError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{eventError}</div>}
                            <div>
                                <label className="block text-sm font-medium mb-1">Event Name</label>
                                <input className="w-full border rounded-lg p-2" placeholder="e.g. Saudi Grand Prix 2026" value={eventFormData.name} onChange={e => setEventFormData({ ...eventFormData, name: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={eventFormData.isActive} onChange={e => setEventFormData({ ...eventFormData, isActive: e.target.checked })} />
                                <label className="text-sm font-medium">Active (Visible in forms)</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={closeEventModal} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                                <button onClick={handleEventSubmit} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg">Create Event</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
