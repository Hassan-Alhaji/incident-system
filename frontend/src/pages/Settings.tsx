import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Plus, Trash2, Edit2, Users, Calendar, CheckCircle, XCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ZoneDrawerMap from '../components/ZoneDrawerMap';

const Settings = () => {
 const { user } = useAuth();
 const [activeTab, setActiveTab] = useState<'users' | 'events' | 'zones' | 'departments' | 'serviceProviders'>('users');

 // Users State
 const [users, setUsers] = useState<any[]>([]);
 const [loadingUsers, setLoadingUsers] = useState(false);
 const [showUserModal, setShowUserModal] = useState(false);
 const [editingUser, setEditingUser] = useState<string | null>(null);
 const [userError, setUserError] = useState<string>('');
 const [userSuccess, setUserSuccess] = useState<string>('');
 const [userFormData, setUserFormData] = useState({
 name: '', email: '', password: '', mobile: '', role: 'SPORT_MARSHAL', userGroup: 'IN_CIRCUIT',
 isIntakeEnabled: false,
 canViewMedical: false, canViewSafety: false, canViewSport: false, canViewAll: false,
 canViewAnalytics: false, canEscalate: false, canManageUsers: false,
 canCloseTickets: false, canPerformRCA: false
 });

 const [importing, setImporting] = useState(false);
 const [importGroup, setImportGroup] = useState<'IN_CIRCUIT' | 'OFF_CIRCUIT'>('IN_CIRCUIT');
 const fileInputRef = React.useRef<HTMLInputElement>(null);

 // Events State
 const [events, setEvents] = useState<any[]>([]);
 const [loadingEvents, setLoadingEvents] = useState(false);
 const [showEventModal, setShowEventModal] = useState(false);
 const [eventError, setEventError] = useState<string>('');
 const [eventFormData, setEventFormData] = useState({
 name: '', isActive: true
 });

 // Zones State
 const [zones, setZones] = useState<any[]>([]);
 const [loadingZones, setLoadingZones] = useState(false);
 const [showZoneModal, setShowZoneModal] = useState(false);
 const [zoneError, setZoneError] = useState<string>('');
 const [zoneFormData, setZoneFormData] = useState({ name: '', description: '', coordinates: [] as {lat: number, lng: number}[] });

 // Departments State
 const [departments, setDepartments] = useState<any[]>([]);
 const [showDepartmentModal, setShowDepartmentModal] = useState(false);
 const [departmentError, setDepartmentError] = useState<string>('');
 const [departmentFormData, setDepartmentFormData] = useState({ name: '', managerId: '' });
 
 // Service Providers State
 const [serviceProviders, setServiceProviders] = useState<any[]>([]);

 useEffect(() => {
 if (activeTab === 'users') fetchUsers();
 if (activeTab === 'events') fetchEvents();
 if (activeTab === 'zones') fetchZones();
 if (activeTab === 'departments') fetchDepartments();
 if (activeTab === 'serviceProviders') fetchServiceProviders();
 }, [activeTab]);

 const fetchDepartments = async () => {
 try {
 const res = await api.get('/departments');
 setDepartments(res.data);
 } catch (e) {}
 };

 const handleDepartmentSubmit = async () => {
 setDepartmentError('');
 try {
 await api.post('/departments', departmentFormData);
 setShowDepartmentModal(false);
 fetchDepartments();
 } catch (err: any) {
 setDepartmentError(err.response?.data?.message || err.response?.data?.error || 'Failed to create department');
 }
 };

 const deleteDepartment = async (id: string) => {
 if (!confirm('Are you sure you want to delete this department?')) return;
 try {
 await api.delete(`/departments/${id}`);
 fetchDepartments();
 } catch (e) {
 alert('Failed to delete department');
 }
 };

 const fetchServiceProviders = async () => {
 try {
 const res = await api.get('/service-providers');
 setServiceProviders(res.data);
 } catch (e) {}
 };

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

 const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (!e.target.files || e.target.files.length === 0) return;
 const file = e.target.files[0];
 const formData = new FormData();
 formData.append('file', file);
 formData.append('userGroup', importGroup);
 
 setImporting(true);
 setUserError('');
 try {
 const res = await api.post('/users/import', formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 setUserSuccess(`Import completed: ${res.data.summary?.added} added, ${res.data.summary?.updated} updated.`);
 fetchUsers();
 } catch (err: any) {
 setUserError(err.response?.data?.message || 'Import failed');
 } finally {
 setImporting(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
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
 name: u.name, email: u.email, password: '', mobile: u.mobile || '', role: u.role, userGroup: u.userGroup || 'IN_CIRCUIT',
 isIntakeEnabled: u.isIntakeEnabled || false,
 canViewMedical: u.canViewMedical || false,
 canViewSafety: u.canViewSafety || false,
 canViewSport: u.canViewSport || false,
 canViewAll: u.canViewAll || false,
 canViewAnalytics: u.canViewAnalytics || false,
 canEscalate: u.canEscalate || false,
 canManageUsers: u.canManageUsers || false,
 canCloseTickets: u.canCloseTickets || false,
 canPerformRCA: u.canPerformRCA || false
 });
 } else {
 setEditingUser(null);
 setUserFormData({
 name: '', email: '', password: '', mobile: '', role: 'SPORT_MARSHAL', userGroup: 'IN_CIRCUIT',
 isIntakeEnabled: false,
 canViewMedical: false, canViewSafety: false, canViewSport: false, canViewAll: false,
 canViewAnalytics: false, canEscalate: false, canManageUsers: false,
 canCloseTickets: false, canPerformRCA: false
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

 const handleDownloadTemplate = async () => {
 try {
 const res = await api.get('/users/template', { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', 'users_template.xlsx');
 document.body.appendChild(link);
 link.click();
 link.remove();
 } catch (err) {
 setUserError('Failed to download template.');
 setTimeout(() => setUserError(''), 5000);
 }
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

 // --- Zone Handlers ---
 const fetchZones = async () => {
 setLoadingZones(true);
 try {
 const res = await api.get('/zones');
 setZones(res.data);
 } catch (err) { console.error(err); }
 finally { setLoadingZones(false); }
 };

 const handleZoneSubmit = async () => {
 setZoneError('');
 try {
 await api.post('/zones', zoneFormData);
 closeZoneModal();
 fetchZones();
 } catch (err: any) {
 setZoneError(err.response?.data?.error || 'Failed to create zone');
 }
 };

 const deleteZone = async (id: string) => {
 if (!confirm('Deactivate this zone?')) return;
 try { await api.delete(`/zones/${id}`); fetchZones(); } catch (err) { alert('Failed'); }
 };

 const openZoneModal = () => {
 setZoneError('');
 setZoneFormData({ name: '', description: '', coordinates: [] });
 setShowZoneModal(true);
 };

 const closeZoneModal = () => { setShowZoneModal(false); };

 if (user?.role !== 'ADMIN' && user?.role !== 'CHIEF_OF_CONTROL') return (
 <div className="flex flex-col items-center justify-center p-12 text-center text-red-500 bg-red-50 rounded-xl shadow-sm border border-red-100 m-8">
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
 <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-base font-medium flex items-center gap-2 animate-pulse">
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
 <button
 onClick={() => setActiveTab('zones')}
 className={`pb-3 px-4 flex items-center gap-2 font-medium border-b-2 transition-colors ${activeTab === 'zones' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
 >
 <AlertCircle size={18} /> Zone Management
 </button>
 <button
 onClick={() => setActiveTab('departments')}
 className={`pb-3 px-4 flex items-center gap-2 font-medium border-b-2 transition-colors ${activeTab === 'departments' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
 >
 <AlertCircle size={18} /> Departments
 </button>
 <button
 onClick={() => setActiveTab('serviceProviders')}
 className={`pb-3 px-4 flex items-center gap-2 font-medium border-b-2 transition-colors ${activeTab === 'serviceProviders' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
 >
 <Users size={18} /> Service Providers
 </button>
 </div>

 {/* Content */}
 {activeTab === 'users' ? (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row justify-between gap-4">
 <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 p-2 rounded-lg">
 <span className="text-base font-medium text-gray-700 px-2">Bulk Import:</span>
 <select 
 className="border border-gray-300 rounded-md text-base p-1.5 outline-none"
 value={importGroup}
 onChange={(e) => setImportGroup(e.target.value as 'IN_CIRCUIT' | 'OFF_CIRCUIT')}
 disabled={importing}
 >
 <option value="IN_CIRCUIT">In-Circuit Group</option>
 <option value="OFF_CIRCUIT">Off-Circuit Group</option>
 </select>
 <input 
 type="file" 
 accept=".xlsx,.csv" 
 className="hidden" 
 ref={fileInputRef} 
 onChange={handleImportFile} 
 />
 <button 
 onClick={() => fileInputRef.current?.click()}
 disabled={importing}
 className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-base font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
 >
 {importing ? <Loader2 size={16} className="animate-spin" /> : <span>Upload Excel</span>}
 </button>
 <button
 onClick={handleDownloadTemplate}
 className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-base font-medium hover:bg-gray-50 flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
 >
 <Download size={16} /> <span className="hidden sm:inline">Template</span>
 </button>
 </div>
 <button onClick={() => openUserModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all hover:translate-y-[-1px]">
 <Plus size={20} /> Add User
 </button>
 </div>

 {loadingUsers ? (
 <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
 <Loader2 size={32} className="animate-spin mb-2 text-emerald-600" />
 <p>Loading users...</p>
 </div>
 ) : (
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">User</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Role</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
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
 <p className="text-base text-gray-500">{u.email}</p>
 </div>
 </div>
 </td>
 <td className="px-6 py-4">
 <span className="bg-gray-100 px-2 py-1 rounded text-base font-bold text-gray-600 border border-gray-200 block mb-1 w-max">
 {u.role.replace(/_/g, ' ')}
 </span>
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.userGroup === 'OFF_CIRCUIT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
 {u.userGroup === 'OFF_CIRCUIT' ? 'Off-Circuit' : 'In-Circuit'}
 </span>
 </td>
 <td className="px-6 py-4">
 <button
 onClick={() => toggleUserStatus(u.id, u.status)}
 className={`flex items-center gap-1 text-base font-bold px-3 py-1.5 rounded-full border min-w-[100px] justify-center transition-all ${u.status === 'ACTIVE'
 ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shadow-sm'
 : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-sm'
 }`}
 >
 {u.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
 {u.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
 </button>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-wrap gap-1">
 {u.isIntakeEnabled && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100" title="Legacy Intake">Intake</span>}
 {u.canViewMedical && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">Medical</span>}
 {u.canViewSafety && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">Safety</span>}
 {u.canViewSport && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">Sport</span>}
 {u.canViewAll && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-100">View All</span>}
 {u.canViewAnalytics && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-100">Analytics</span>}
 {u.canEscalate && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-100">Escalate</span>}
 {u.canManageUsers && <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-100">Users</span>}
 {u.canCloseTickets && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100">Close</span>}
 {u.canPerformRCA && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-100">RCA</span>}
 
 {!u.isIntakeEnabled && !u.canViewMedical && !u.canViewSafety && !u.canViewSport && !u.canViewAll && !u.canViewAnalytics && !u.canEscalate && !u.canManageUsers && !u.canCloseTickets && !u.canPerformRCA && (
 <span className="text-gray-400 text-base px-1">None</span>
 )}
 </div>
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
 <p className="text-base">Click "Add User" to create your first user account.</p>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>
 ) : activeTab === 'events' ? (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100">
 <div className="flex items-center gap-3">
 <Calendar className="text-emerald-600" />
 <div>
 <h3 className="font-bold text-emerald-900">Event Configuration</h3>
 <p className="text-base text-emerald-700">Manage active events for incident reports here.</p>
 </div>
 </div>
 <button onClick={openEventModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm hover:translate-y-[-1px] transition-all">
 <Plus size={20} /> Add Event
 </button>
 </div>

 {loadingEvents ? (
 <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
 <Loader2 size={32} className="animate-spin mb-2 text-emerald-600" />
 <p>Loading events...</p>
 </div>
 ) : (
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Event Name</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
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
 className={`flex items-center gap-1 text-base font-bold px-3 py-1.5 rounded-full border transition-all ${e.isActive
 ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shadow-sm'
 : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
 }`}
 >
 {e.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
 {e.isActive ? 'Active' : 'Inactive'}
 </button>
 </td>
 <td className="px-6 py-4 text-base text-gray-500">{new Date(e.createdAt).toLocaleDateString('en-US')}</td>
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
 <p className="text-base">Create an event so users can select it in reports.</p>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>
 ) : activeTab === 'zones' ? (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
 <div className="flex items-center gap-3">
 <AlertCircle className="text-blue-600" />
 <div>
 <h3 className="font-bold text-blue-900">Zone Configuration</h3>
 <p className="text-base text-blue-700">Manage incident locations/zones within the facility.</p>
 </div>
 </div>
 <button onClick={openZoneModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm hover:translate-y-[-1px] transition-all">
 <Plus size={20} /> Add Zone
 </button>
 </div>

 {loadingZones ? (
 <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
 <Loader2 size={32} className="animate-spin mb-2 text-blue-600" />
 <p>Loading zones...</p>
 </div>
 ) : (
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Zone Name</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Description</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {zones.length > 0 ? (
 zones.map(z => (
 <tr key={z.id} className="hover:bg-gray-50/50 transition-colors">
 <td className="px-6 py-4 font-bold text-gray-900">{z.name}</td>
 <td className="px-6 py-4 text-base text-gray-600">{z.description || '-'}</td>
 <td className="px-6 py-4 text-base text-gray-500">{new Date(z.createdAt).toLocaleDateString('en-US')}</td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => deleteZone(z.id)} className="text-gray-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
 <Trash2 size={18} />
 </button>
 </td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
 <div className="flex flex-col items-center justify-center">
 <AlertCircle size={48} className="mb-4 text-gray-200" />
 <p className="text-lg font-medium text-gray-500">No zones found</p>
 <p className="text-base">Create a zone so reporters can select it.</p>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>
 ) : null}

 {activeTab === 'departments' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-lg border border-indigo-100">
 <div className="flex items-center gap-3">
 <Users className="text-indigo-600" />
 <div>
 <h3 className="font-bold text-indigo-900">Departments Management</h3>
 <p className="text-base text-indigo-700">View and configure system departments.</p>
 </div>
 </div>
 <button onClick={() => { setDepartmentError(''); setDepartmentFormData({ name: '', managerId: '' }); setShowDepartmentModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm hover:translate-y-[-1px] transition-all">
 <Plus size={20} /> Add Department
 </button>
 </div>
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto p-4">
 <table className="w-full text-left">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Name</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Manager</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
 </tr>
 </thead>
 <tbody>
 {departments.map(d => (
 <tr key={d.id} className="border-b border-gray-100">
 <td className="px-6 py-4 font-bold">{d.name}</td>
 <td className="px-6 py-4 text-gray-500">{d.manager?.name || 'N/A'}</td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => deleteDepartment(d.id)} className="text-gray-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
 <Trash2 size={18} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'serviceProviders' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-pink-50 p-4 rounded-lg border border-pink-100">
 <div className="flex items-center gap-3">
 <AlertCircle className="text-pink-600" />
 <div>
 <h3 className="font-bold text-pink-900">Service Providers Blacklist</h3>
 <p className="text-base text-pink-700">Manage Service Providers and their Commercial Registration Numbers.</p>
 </div>
 </div>
 </div>
 <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto p-4">
 <table className="w-full text-left">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">CR Number</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Provider Name</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider">Department</th>
 <th className="px-6 py-4 text-base font-semibold text-gray-500 uppercase tracking-wider text-right">Status / Action</th>
 </tr>
 </thead>
 <tbody>
 {serviceProviders.map(sp => (
 <tr key={sp.id} className="border-b border-gray-100">
 <td className="px-6 py-4 font-mono text-gray-500">{sp.commercialRegistrationNumber}</td>
 <td className="px-6 py-4 font-bold">{sp.name}</td>
 <td className="px-6 py-4">{sp.department?.name || 'N/A'}</td>
 <td className="px-6 py-4 text-right">
 <button
 onClick={async () => {
 const newStatus = sp.status === 'BLACKLISTED' ? 'ACTIVE' : 'BLACKLISTED';
 if (confirm(`Change status to ${newStatus}?`)) {
 await api.patch(`/service-providers/${sp.id}/status`, { status: newStatus });
 const res = await api.get('/service-providers');
 setServiceProviders(res.data);
 }
 }}
 className={`px-3 py-1.5 rounded text-base font-bold transition-colors ${sp.status === 'BLACKLISTED' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
 >
 {sp.status}
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* User Modal */}
 {showUserModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
 <button onClick={closeUserModal} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
 </div>

 <div className="space-y-4">
 {/* Error inside modal */}
 {userError && !loadingUsers && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-base flex items-center gap-2"><AlertCircle size={16} />{userError}</div>}

 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Full Name</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all"
 placeholder="Enter full name"
 value={userFormData.name}
 onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Email Address</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all"
 placeholder="user@example.com"
 value={userFormData.email}
 onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Mobile Number *</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all"
 placeholder="+966500000000"
 value={userFormData.mobile}
 onChange={e => setUserFormData({ ...userFormData, mobile: e.target.value })}
 dir="ltr"
 required
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">User Group</label>
 <select
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all bg-white font-medium"
 value={userFormData.userGroup}
 onChange={e => setUserFormData({ ...userFormData, userGroup: e.target.value })}
 >
 <option value="IN_CIRCUIT">In-Circuit Operations</option>
 <option value="OFF_CIRCUIT">Off-Circuit Operations</option>
 </select>
 </div>
 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Role</label>
 <select
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all bg-white"
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

 <optgroup label="Stewards">
 <option value="SCRUTINEERS">Scrutineers</option>
 <option value="JUDGEMENT">Judgement / Stewards</option>
 </optgroup>

 {user?.role === 'ADMIN' && <optgroup label="System"><option value="ADMIN">System Administrator</option></optgroup>}
 </select>
 </div>
 </div>

 <div className="space-y-3 pt-2">
 <h4 className="text-base font-semibold text-gray-900">Additional Permissions</h4>

 <div className="grid grid-cols-2 gap-3">
 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canViewMedical: !userFormData.canViewMedical })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewMedical ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canViewMedical && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-gray-700 select-none">View Medical</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canViewSafety: !userFormData.canViewSafety })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewSafety ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canViewSafety && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-gray-700 select-none">View Safety</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canViewSport: !userFormData.canViewSport })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewSport ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canViewSport && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-gray-700 select-none">View Sport</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canViewAll: !userFormData.canViewAll })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewAll ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canViewAll && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-gray-700 select-none">View All Tickets</span>
 </div>
 
 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canViewAnalytics: !userFormData.canViewAnalytics })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canViewAnalytics ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canViewAnalytics && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-gray-700 select-none">View Statistics (مشاهدة الاحصائيات)</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canEscalate: !userFormData.canEscalate })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canEscalate ? 'bg-amber-600 border-amber-600 text-gray-800' : 'bg-white border-gray-300'}`}>
 {userFormData.canEscalate && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-amber-800 select-none">Can Escalate (Cross-Department)</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canManageUsers: !userFormData.canManageUsers })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canManageUsers ? 'bg-purple-600 border-purple-600 text-gray-800' : 'bg-white border-gray-300'}`}>
 {userFormData.canManageUsers && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-purple-800 select-none">Can Activate / Manage Users (تفعيل المستخدمين)</span>
 </div>
 
 <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canCloseTickets: !userFormData.canCloseTickets })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canCloseTickets ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canCloseTickets && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-red-800 select-none">Can Close Tickets (اغلاق التذكرة)</span>
 </div>

 <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
 onClick={() => setUserFormData({ ...userFormData, canPerformRCA: !userFormData.canPerformRCA })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.canPerformRCA ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.canPerformRCA && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-orange-800 select-none">Can Perform RCA (تحليل الحادث)</span>
 </div>
 </div>

 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setUserFormData({ ...userFormData, isIntakeEnabled: !userFormData.isIntakeEnabled })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userFormData.isIntakeEnabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {userFormData.isIntakeEnabled && <CheckCircle size={14} />}
 </div>
 <div>
 <p className="text-base font-medium text-gray-900 select-none">Receive Tickets from Reporters (استقبال التذاكر)</p>
 <p className="text-base text-gray-500 select-none">Intake and triage incoming tickets</p>
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
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xl font-bold text-gray-900">Add New Event</h3>
 <button onClick={closeEventModal} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
 </div>

 <div className="space-y-4">
 {eventError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-base flex items-center gap-2"><AlertCircle size={16} />{eventError}</div>}

 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Event Name</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:border-emerald-500 outline-none transition-all"
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
 <p className="text-base font-medium text-gray-900 select-none">Active Event</p>
 <p className="text-base text-gray-500 select-none">Show this event in report dropdowns</p>
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

 {/* Zone Modal */}
 {showZoneModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
 <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xl font-bold text-gray-900">Add New Zone</h3>
 <button onClick={closeZoneModal} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
 </div>
 <div className="grid md:grid-cols-2 gap-6">
 <div className="space-y-4">
 {zoneError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-base">{zoneError}</div>}
 <div>
 <label className="block text-base font-medium mb-1">Zone Name *</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 outline-none"
 placeholder="e.g. Turn 1 Grandstand"
 value={zoneFormData.name}
 onChange={e => setZoneFormData({ ...zoneFormData, name: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-base font-medium mb-1">Description (Optional)</label>
 <textarea
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 outline-none"
 placeholder="e.g. North ticket entrance"
 rows={3}
 value={zoneFormData.description}
 onChange={e => setZoneFormData({ ...zoneFormData, description: e.target.value })}
 />
 </div>
 <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-base text-blue-800">
 <h4 className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={16}/> Drawing Zones</h4>
 <p>Draw the boundary of the zone on the map using the tool on the right. When incidents are reported, the system will automatically map them to this zone if their location pin falls inside it.</p>
 </div>
 </div>
 
 <div className="flex flex-col">
 <label className="block text-base font-medium mb-1">Zone Boundary *</label>
 <ZoneDrawerMap 
 onPolygonChange={(points) => setZoneFormData(prev => ({ ...prev, coordinates: points }))}
 />
 {zoneFormData.coordinates.length > 0 && (
 <p className="text-base text-emerald-600 mt-2 font-bold text-center">
 <CheckCircle size={12} className="inline mr-1" /> Boundary marked ({zoneFormData.coordinates.length} points)
 </p>
 )}
 </div>
 </div>

 <div className="flex gap-3 pt-6 border-t mt-4 justify-end">
 <button onClick={closeZoneModal} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
 <button 
 onClick={handleZoneSubmit} 
 disabled={zoneFormData.coordinates.length < 3 || !zoneFormData.name}
 className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
 Create Zone
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Department Modal */}
 {showDepartmentModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xl font-bold text-gray-900">Add New Department</h3>
 <button onClick={() => setShowDepartmentModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
 </div>

 <div className="space-y-4">
 {departmentError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-base flex items-center gap-2"><AlertCircle size={16} />{departmentError}</div>}

 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Department Name</label>
 <input
 className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
 placeholder="e.g. Safety Team"
 value={departmentFormData.name}
 onChange={e => setDepartmentFormData({ ...departmentFormData, name: e.target.value })}
 />
 </div>

 <div>
 <label className="block text-base font-medium mb-1 text-gray-700">Assign Manager (Optional)</label>
 <select
 className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
 value={departmentFormData.managerId}
 onChange={e => setDepartmentFormData({ ...departmentFormData, managerId: e.target.value })}
 >
 <option value="">-- No Manager --</option>
 {users.filter(u => u.status === 'ACTIVE').map(u => (
 <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
 ))}
 </select>
 </div>

 <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
 <button onClick={() => setShowDepartmentModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors">Cancel</button>
 <button onClick={handleDepartmentSubmit} disabled={!departmentFormData.name} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-gray-800 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50">
 Create Department
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
