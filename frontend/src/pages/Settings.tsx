import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Plus, Trash2, Edit2, Users, Calendar, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'events'>('users');

    // Users State
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [userError, setUserError] = useState<string>('');
    const [userSuccess, setUserSuccess] = useState<string>('');
    const [userFormData, setUserFormData] = useState({
        name: '', email: '', password: '', role: 'SPORT_MARSHAL',
        isIntakeEnabled: false,
        canViewMedical: false, canViewSafety: false, canViewSport: false, canViewAll: false
    });

    // Events State
    const [events, setEvents] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
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
        setLoadingUsers(true);
        setUserError('');
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err: any) {
            console.error(err);
            setUserError(err.response?.data?.message || 'Failed to load users. Please check your connection.');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUserSubmit = async () => {
        setUserError('');
        setUserSuccess('');
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser}`, userFormData);
            } else {
                await api.post('/users', userFormData);
            }
            closeUserModal();
            fetchUsers();
            setUserSuccess(editingUser ? 'User updated successfully' : 'User created successfully');
            setTimeout(() => setUserSuccess(''), 3000);
        } catch (err: any) {
            setUserError(err.response?.data?.message || 'Operation failed');
        }
    };

    const deleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
            setUserSuccess('User deleted successfully');
            setTimeout(() => setUserSuccess(''), 3000);
        } catch (err: any) {
            setUserError(err.response?.data?.message || 'Failed to delete user');
        }
    };

    const toggleUserStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.patch(`/users/${id}/status`, { status: newStatus });
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    const openUserModal = (u?: any) => {
        setUserError('');
        if (u) {
            setEditingUser(u.id);
            setUserFormData({
                name: u.name, email: u.email, password: '', role: u.role,
                isIntakeEnabled: u.isIntakeEnabled || false,
                canViewMedical: u.canViewMedical || false,
                canViewSafety: u.canViewSafety || false,
                canViewSport: u.canViewSport || false,
                canViewAll: u.canViewAll || false
            });
        } else {
            setEditingUser(null);
            setUserFormData({
                name: '', email: '', password: '', role: 'SPORT_MARSHAL',
                isIntakeEnabled: false,
                canViewMedical: false, canViewSafety: false, canViewSport: false, canViewAll: false
            });
        }
        setShowUserModal(true);
    };

    const closeUserModal = () => { setShowUserModal(false); setEditingUser(null); };

    // --- Event Handlers ---
    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const res = await api.get('/events');
            setEvents(res.data);
        } catch (err) { console.error(err); }
        finally { setLoadingEvents(false); }
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

    if (user?.role !== 'ADMIN' && user?.role !== 'CHIEF_OF_CONTROL') return (
        <div className="flex flex-col items-center justify-center p-12 text-center text-red-500 bg-red-50 rounded-xl border border-red-100 m-8">
            <AlertCircle size={48} className="mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p>You do not have permission to view this page.</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                {userSuccess && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-pulse">
                        <CheckCircle size={16} /> {userSuccess}
                    </div>
                )}
            </div>

            {/* Global Error Display */}
            {userError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span>{userError}</span>
                </div>
            )}

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
                        <button onClick={() => openUserModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all hover:translate-y-[-1px]">
                            <Plus size={20} /> Add User
                        </button>
                    </div>

                    {loadingUsers ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                            <Loader2 size={32} className="animate-spin mb-2 text-emerald-600" />
                            <p>Loading users...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.length > 0 ? (
                                        users.map(u => (
                                            <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-sm border border-emerald-200">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{u.name}</p>
                                                            <p className="text-xs text-gray-500">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600 border border-gray-200">
                                                        {u.role.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleUserStatus(u.id, u.status)}
                                                        className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border min-w-[100px] justify-center transition-all ${u.status === 'ACTIVE'
                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shadow-sm'
                                                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-sm'
                                                            }`}
                                                    >
                                                        {u.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {u.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {u.isIntakeEnabled ? (
                                                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-100 inline-flex items-center gap-1">
                                                            <CheckCircle size={12} />
                                                            Ticket Intake
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs px-2">default</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => openUserModal(u)} className="text-gray-500 p-2 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors" title="Edit User">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => deleteUser(u.id)} className="text-gray-500 p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Delete User">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                    <Users size={48} className="mb-4 text-gray-200" />
                                                    <p className="text-lg font-medium text-gray-500">No users found</p>
                                                    <p className="text-sm">Click "Add User" to create your first user account.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-emerald-600" />
                            <div>
                                <h3 className="font-bold text-emerald-900">Event Configuration</h3>
                                <p className="text-sm text-emerald-700">Manage active events for incident reports here.</p>
                            </div>
                        </div>
                        <button onClick={openEventModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm hover:translate-y-[-1px] transition-all">
                            <Plus size={20} /> Add Event
                        </button>
                    </div>

                    {loadingEvents ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                            <Loader2 size={32} className="animate-spin mb-2 text-emerald-600" />
                            <p>Loading events...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {events.length > 0 ? (
                                        events.map(e => (
                                            <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900">{e.name}</td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleEventStatus(e.id, e.isActive)}
                                                        className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${e.isActive
                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shadow-sm'
                                                            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {e.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {e.isActive ? 'Active' : 'Inactive'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => deleteEvent(e.id)} className="text-gray-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <Calendar size={48} className="mb-4 text-gray-200" />
                                                    <p className="text-lg font-medium text-gray-500">No events found</p>
                                                    <p className="text-sm">Create an event so users can select it in reports.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                            <button onClick={closeUserModal} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                        </div>

                        <div className="space-y-4">
                            {/* Error inside modal */}
                            {userError && !loadingUsers && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} />{userError}</div>}

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">Full Name</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="Enter full name"
                                    value={userFormData.name}
                                    onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">Email Address</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="user@example.com"
                                    value={userFormData.email}
                                    onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">Role</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                                    value={userFormData.role}
                                    onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
                                >
                                    <optgroup label="Operations">
                                        <option value="SPORT_MARSHAL">Sport Marshal</option>
                                        <option value="OPERATION_CONTROL_TEAM">Operation Control Team</option>
                                        <option value="DEPUTY_CHIEF_CONTROL_OFFICER">Deputy Chief Control Officer</option>
                                        <option value="CHIEF_OF_CONTROL">Chief of Control</option>
                                    </optgroup>

                                    <optgroup label="Safety">
                                        <option value="SAFETY_MARSHAL">Safety Marshal</option>
                                        <option value="OPERATION_SAFETY_TEAM">Operation Safety Team</option>
                                        <option value="DEPUTY_CHIEF_SAFETY_OFFICER">Deputy Chief Safety Officer</option>
                                        <option value="CHIEF_SAFETY_OFFICER">Chief Safety Officer</option>
                                    </optgroup>

                                    <optgroup label="Medical">
                                        <option value="MEDICAL_MARSHAL">Medical Marshal</option>
                                        <option value="MEDICAL_EVACUATION_CREW">Medical Evacuation Crew</option>
                                        <option value="OPERATION_MEDICAL_TEAM">Operation Medical Team</option>
                                        <option value="DEPUTY_CHIEF_MEDICAL_OFFICER">Deputy Chief Medical Officer</option>
                                        <option value="CHIEF_MEDICAL_OFFICER">Chief Medical Officer</option>
                                    </optgroup>

                                    {user?.role === 'ADMIN' && <optgroup label="System"><option value="ADMIN">System Administrator</option></optgroup>}
                                </select>
                            </div>

                            <div className="space-y-3 pt-2">
                                <h4 className="text-sm font-semibold text-gray-900">Additional Permissions</h4>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setUserFormData({ ...userFormData, canViewMedical: !userFormData.canViewMedical })}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewMedical ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {userFormData.canViewMedical && <CheckCircle size={14} />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 select-none">View Medical</span>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setUserFormData({ ...userFormData, canViewSafety: !userFormData.canViewSafety })}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewSafety ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {userFormData.canViewSafety && <CheckCircle size={14} />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 select-none">View Safety</span>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setUserFormData({ ...userFormData, canViewSport: !userFormData.canViewSport })}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewSport ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {userFormData.canViewSport && <CheckCircle size={14} />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 select-none">View Sport</span>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setUserFormData({ ...userFormData, canViewAll: !userFormData.canViewAll })}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewAll ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {userFormData.canViewAll && <CheckCircle size={14} />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 select-none">View All Tickets</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setUserFormData({ ...userFormData, isIntakeEnabled: !userFormData.isIntakeEnabled })}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.isIntakeEnabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                        {userFormData.isIntakeEnabled && <CheckCircle size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 select-none">Enable Ticket Intake</p>
                                        <p className="text-xs text-gray-500 select-none">Legacy: View all incoming tickets (Superceeded by above)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button onClick={closeUserModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors">Cancel</button>
                                <button onClick={handleUserSubmit} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-all transform active:scale-95">
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal */}
            {showEventModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Add New Event</h3>
                            <button onClick={closeEventModal} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                        </div>

                        <div className="space-y-4">
                            {eventError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} />{eventError}</div>}

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700">Event Name</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="e.g. Riyadh Season Gran Prix 2026"
                                    value={eventFormData.name}
                                    onChange={e => setEventFormData({ ...eventFormData, name: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer" onClick={() => setEventFormData({ ...eventFormData, isActive: !eventFormData.isActive })}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${eventFormData.isActive ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
                                    {eventFormData.isActive && <CheckCircle size={14} />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 select-none">Active Event</p>
                                    <p className="text-xs text-gray-500 select-none">Show this event in report dropdowns</p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button onClick={closeEventModal} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors">Cancel</button>
                                <button onClick={handleEventSubmit} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-all transform active:scale-95">
                                    Create Event
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
