import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import {
 Plus, Trash2, Edit2, Users, CheckCircle, XCircle, AlertCircle, AlertTriangle,
 Loader2, X, ShieldCheck, Search as SearchIcon, UserPlus, Upload, Download, FileSpreadsheet, Map, Building, Briefcase, Wrench, Calendar
} from 'lucide-react';
import { useToast } from '../components/Toast';
import ZoneDrawerMap from '../components/ZoneDrawerMap';

const OC_ROLE_OPTIONS = [
 { value: 'OC_REPORTER', label: 'Reporter' },
 { value: 'HSE_CONTROLLER', label: 'HSE Controller' },
 { value: 'OC_HSE_MANAGER', label: 'HSE Manager' },
 { value: 'SAFETY_MANAGER', label: 'Safety Manager' },
 { value: 'DEP_REP', label: 'Department Rep' },
 { value: 'DEP_MANAGER', label: 'Department Manager' },
 { value: 'HR_REP', label: 'HR Representative' },
 { value: 'FINANCE_REP', label: 'Finance Rep' },
 { value: 'SERVICE_PROVIDER_REP', label: 'Service Provider Rep' },
];

const roleColors: Record<string, string> = {
 OC_REPORTER: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
 HSE_CONTROLLER: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
 OC_HSE_MANAGER: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
 SAFETY_MANAGER: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
 DEP_MANAGER: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
 DEP_REP: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
 HR_REP: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
 SERVICE_PROVIDER_REP: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
 FINANCE_REP: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
};

const statusColors: Record<string, string> = {
 ACTIVE: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
 PENDING: 'bg-blue-600/10 border-blue-600/30 text-blue-500',
 SUSPENDED: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const Settings = () => {
 const { user } = useAuth();
 const { t } = useTranslation();
 const { showToast } = useToast();
 const [users, setUsers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [showModal, setShowModal] = useState(false);
 const [editingUser, setEditingUser] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [activeTab, setActiveTab] = useState<'users' | 'zones' | 'departments' | 'providers' | 'events' | 'system'>('users');

 // Maintenance Mode
 const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
 const [maintenanceLoading, setMaintenanceLoading] = useState(false);

 const [form, setForm] = useState({ name: '', email: '', role: 'OC_REPORTER', mobile: '', canManageUsers: false, canManageEvents: false, canManageServiceProviders: false, canViewAnalytics: false, isIntakeEnabled: false, repDepartmentId: '' });
 const [userDepartments, setUserDepartments] = useState<any[]>([]);

 // Global Entities State
 const [zones, setZones] = useState<any[]>([]);
 const [showZoneModal, setShowZoneModal] = useState(false);
 const [zoneFormData, setZoneFormData] = useState({ name: '', description: '', coordinates: [] as {lat: number, lng: number}[] });
 const [zoneError, setZoneError] = useState('');

 const [departments, setDepartments] = useState<any[]>([]);
 const [showDepartmentModal, setShowDepartmentModal] = useState(false);
 const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
 const [departmentFormData, setDepartmentFormData] = useState({ nameEn: '', nameAr: '', manager: {name:'', email:'', mobile:''}, representatives: [{name:'', email:'', mobile:''}] });
 const [departmentError, setDepartmentError] = useState('');
 const [syncingAzure, setSyncingAzure] = useState(false);


 // Confirmation modal state
 const [confirmModal, setConfirmModal] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

 const [serviceProviders, setServiceProviders] = useState<any[]>([]);
 const [showProviderModal, setShowProviderModal] = useState(false);
 const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
 const [providerFormData, setProviderFormData] = useState({ name: '', nameAr: '', commercialRegistrationNumber: '', responsibleDepartmentId: '', representativeName: '', representativeEmail: '', representativeMobile: '', representatives: [{name:'', email:'', mobile:''}] });
 const [providerError, setProviderError] = useState('');

 const [events, setEvents] = useState<any[]>([]);
 const [showEventModal, setShowEventModal] = useState(false);
 const [editingEventId, setEditingEventId] = useState<string | null>(null);
 const [eventFormData, setEventFormData] = useState({ nameEn: '', nameAr: '', status: 'ACTIVE' });
 const [eventError, setEventError] = useState('');

 useEffect(() => { 
 if (activeTab === 'users') { fetchUsers(); api.get('/departments').then(res => setUserDepartments(res.data)).catch(() => {}); }
 if (activeTab === 'zones') fetchZones();
 if (activeTab === 'departments') fetchDepartments();
 if (activeTab === 'providers') fetchServiceProviders();
 if (activeTab === 'events') fetchEvents();
 if (activeTab === 'system') fetchMaintenanceStatus();
 }, [activeTab]);

 const fetchMaintenanceStatus = async () => {
  try { const res = await api.get('/maintenance'); setMaintenanceEnabled(res.data.enabled === true); } catch (e) {}
 };

 const toggleMaintenance = async () => {
  setMaintenanceLoading(true);
  try {
   const newState = !maintenanceEnabled;
   await api.put('/maintenance', { enabled: newState });
   setMaintenanceEnabled(newState);
   showToast(newState ? 'Maintenance mode ENABLED — users will see the maintenance page' : 'Maintenance mode DISABLED — platform is live', newState ? 'warning' : 'success');
  } catch (err: any) {
   showToast(err.response?.data?.message || 'Failed to update maintenance mode', 'error');
  } finally {
   setMaintenanceLoading(false);
  }
 };

 const fetchZones = async () => {
 try { const res = await api.get('/zones'); setZones(res.data); } catch (e) {}
 };
 const fetchDepartments = async () => {
 try { const res = await api.get('/departments'); setDepartments(res.data); } catch (e) {}
 };
 const fetchServiceProviders = async () => {
 try { const res = await api.get('/service-providers'); setServiceProviders(res.data); } catch (e) {}
 };
 const fetchEvents = async () => {
 try { const res = await api.get('/events'); setEvents(res.data); } catch (e) {}
 };

 const handleZoneSubmit = async () => {
 setZoneError('');
 try { await api.post('/zones', zoneFormData); setShowZoneModal(false); fetchZones(); } 
 catch (err: any) { setZoneError(err.response?.data?.error || t('errors.failedCreateZone')); }
 };
 const deleteZone = async (id: string) => {
 setConfirmModal({ title: t('confirm.deleteZone'), message: t('confirm.deleteZoneMsg'), onConfirm: async () => { try { await api.delete(`/zones/${id}`); fetchZones(); } catch (err: any) { showToast(err.response?.data?.message || t('errors.deleteFailed'), 'error'); } setConfirmModal(null); } });
 };

 const handleDepartmentSubmit = async () => {
 setDepartmentError('');
 try {
   if (editingDepartmentId) {
     await api.put(`/departments/${editingDepartmentId}`, departmentFormData);
   } else {
     await api.post('/departments', departmentFormData);
   }
   setShowDepartmentModal(false); setEditingDepartmentId(null); fetchDepartments();
 } catch (err: any) { setDepartmentError(err.response?.data?.message || t('errors.failedCreateDept')); }

 const syncDepartmentsFromAzure = async () => {
   if (syncingAzure) return;
   setSyncingAzure(true);
   try {
     const res = await api.post('/departments/sync-azure');
     const { added, skipped, failed, total } = res.data;
     showToast(
       isRtl
         ? `تمت المزامنة من Azure — مضاف: ${added}، موجود: ${skipped}، إجمالي: ${total}`
         : `Azure sync done — Added: ${added}, Existed: ${skipped}, Total: ${total}`,
       failed > 0 ? 'warning' : 'success'
     );
     fetchDepartments();
   } catch (err: any) {
     const msg = err.response?.data?.message || 'Azure sync failed';
     showToast(msg, 'error');
   } finally {
     setSyncingAzure(false);
   }
 };

 };
 const openEditDepartment = (d: any) => {
   setEditingDepartmentId(d.id);
   setDepartmentFormData({
     nameEn: d.name || '', nameAr: d.nameAr || '',
     manager: { name: d.manager?.name || '', email: d.manager?.email || '', mobile: d.manager?.mobile || '' },
     representatives: d.representatives?.length > 0 ? d.representatives.map((r: any) => ({ name: r.name || '', email: r.email || '', mobile: r.mobile || '' })) : [{ name: '', email: '', mobile: '' }]
   });
   setDepartmentError('');
   setShowDepartmentModal(true);
 };
 const deleteDepartment = async (id: string) => {
 setConfirmModal({ title: t('confirm.deleteDept'), message: t('confirm.deleteDeptMsg'), onConfirm: async () => { try { await api.delete(`/departments/${id}`); fetchDepartments(); } catch (err: any) { showToast(err.response?.data?.message || t('errors.deleteFailed'), 'error'); } setConfirmModal(null); } });
 };

 const handleProviderSubmit = async () => {
 setProviderError('');
 try {
   if (editingProviderId) {
     await api.put(`/service-providers/${editingProviderId}`, providerFormData);
   } else {
     await api.post('/service-providers', providerFormData);
   }
   setShowProviderModal(false); setEditingProviderId(null); fetchServiceProviders();
 } catch (err: any) { setProviderError(err.response?.data?.message || t('errors.failedCreateProvider')); }
 };
 const openEditProvider = (sp: any) => {
   setEditingProviderId(sp.id);
   setProviderFormData({
     name: sp.name || '', nameAr: sp.nameAr || '',
     commercialRegistrationNumber: sp.commercialRegistrationNumber || '',
     responsibleDepartmentId: sp.departmentId || sp.department?.id || '',
     representativeName: sp.representativeName || '',
     representativeEmail: sp.representativeEmail || '',
     representativeMobile: sp.representativeMobile || '',
     representatives: sp.representatives?.length > 0 ? sp.representatives.map((r: any) => ({ name: r.name || '', email: r.email || '', mobile: r.mobile || '' })) : [{ name: '', email: '', mobile: '' }]
   });
   setProviderError('');
   setShowProviderModal(true);
 };
 const deleteProvider = async (id: string) => {
 setConfirmModal({ title: t('confirm.deleteProvider'), message: t('confirm.deleteProviderMsg'), onConfirm: async () => { try { await api.delete(`/service-providers/${id}`); fetchServiceProviders(); } catch (err: any) { showToast(err.response?.data?.message || t('errors.deleteFailed'), 'error'); } setConfirmModal(null); } });
 };

 const handleEventSubmit = async () => {
   setEventError('');
   try {
     if (editingEventId) {
       await api.put(`/events/${editingEventId}`, eventFormData);
     } else {
       await api.post('/events', eventFormData);
     }
     setShowEventModal(false); setEditingEventId(null); fetchEvents();
   } catch (err: any) { setEventError(err.response?.data?.message || 'Failed to save event'); }
 };
 const openEditEvent = (ev: any) => {
   setEditingEventId(ev.id);
   setEventFormData({ nameEn: ev.nameEn || '', nameAr: ev.nameAr || '', status: ev.status || 'ACTIVE' });
   setEventError('');
   setShowEventModal(true);
 };
 const deleteEvent = async (id: string) => {
   setConfirmModal({ title: 'Delete Event', message: 'Are you sure you want to delete this event?', onConfirm: async () => { try { await api.delete(`/events/${id}`); fetchEvents(); } catch (err: any) { showToast(err.response?.data?.message || 'Delete failed', 'error'); } setConfirmModal(null); } });
 };

 const fetchUsers = async () => {
 setLoading(true);
 try {
 const res = await api.get('/users');
 setUsers(res.data);
 } catch (err: any) {
 setError(err.response?.data?.message || t('errors.loadUsersFailed'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchUsers(); }, []);

 const handleSubmit = async () => {
 setError('');
 // English-only name validation
 const englishRegex = /^[A-Za-z\s]+$/;
 if (!englishRegex.test(form.name)) {
 setError(t('errors.nameEnglishOnly'));
 return;
 }
 if (!form.mobile?.trim()) {
 setError(t('errors.mobileRequired'));
 return;
 }
 try {
 if (editingUser) {
 await api.put(`/users/${editingUser}`, form);
 setSuccess(t('oc.settings.userUpdated'));
 } else {
 await api.post('/users', form);
 setSuccess(t('oc.settings.userCreated'));
 }
 setShowModal(false);
 setEditingUser(null);
 setForm({ name: '', email: '', role: 'OC_REPORTER', mobile: '', canManageUsers: false, canManageEvents: false, canManageServiceProviders: false, canViewAnalytics: false, isIntakeEnabled: false, repDepartmentId: '' });
 fetchUsers();
 setTimeout(() => setSuccess(''), 3000);
 } catch (err: any) {
 setError(err.response?.data?.message || t('errors.operationFailed'));
 }
 };

 const handleDelete = async (id: string) => {
 setConfirmModal({ title: t('confirm.deleteUser'), message: t('confirm.deleteUserMsg'), onConfirm: async () => {
   try { await api.delete(`/users/${id}`); setSuccess(t('oc.settings.userDeleted')); fetchUsers(); setTimeout(() => setSuccess(''), 3000); }
   catch (err: any) { setError(err.response?.data?.message || t('errors.deleteFailed')); }
   setConfirmModal(null);
 }});
 };

 const handleToggleStatus = async (id: string, currentStatus: string) => {
 const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
 const msg = newStatus === 'SUSPENDED'
   ? t('confirm.suspendUserMsg', 'هل أنت متأكد من تعليق حساب هذا المستخدم؟ لن يتمكن من تسجيل الدخول.')
   : t('confirm.activateUserMsg', 'هل أنت متأكد من تفعيل حساب هذا المستخدم؟');
 setConfirmModal({ title: t('confirm.changeUserStatus', 'تغيير حالة المستخدم'), message: msg, onConfirm: async () => {
   try { await api.patch(`/users/${id}/status`, { status: newStatus }); fetchUsers(); }
   catch (err: any) { setError(err.response?.data?.message || 'Status update failed'); }
   setConfirmModal(null);
 }});
 };

 const openEditModal = (u: any) => {
 setEditingUser(u.id);
 setForm({ name: u.name, email: u.email, role: u.role, mobile: u.mobile || '', canManageUsers: u.canManageUsers || false, canManageEvents: u.canManageEvents || false, canManageServiceProviders: u.canManageServiceProviders || false, canViewAnalytics: u.canViewAnalytics || false, isIntakeEnabled: u.isIntakeEnabled || false, repDepartmentId: u.repDepartmentId || '' });
 setShowModal(true);
 setError('');
 };

 const openCreateModal = () => {
 setEditingUser(null);
 setForm({ name: '', email: '', role: 'OC_REPORTER', mobile: '', canManageUsers: false, canManageEvents: false, canManageServiceProviders: false, canViewAnalytics: false, isIntakeEnabled: false, repDepartmentId: '' });
 setShowModal(true);
 setError('');
 };

 const fileInputRef = useRef<HTMLInputElement>(null);
 const [importing, setImporting] = useState(false);
 const [importResult, setImportResult] = useState<any>(null);

 const handleDownloadTemplate = async () => {
 try {
 const res = await api.get('/users/template', { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
 const a = document.createElement('a'); a.href = url; a.download = 'oc_users_template.xlsx'; 
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 window.URL.revokeObjectURL(url);
 } catch (err: any) { 
 console.error('Download template error:', err);
 setError(t('errors.downloadTemplateFailed') + ': ' + (err.response?.data?.message || err.message)); 
 showToast(t('errors.downloadTemplateFailed'), 'error');
 }
 };

 const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setImporting(true); setError(''); setImportResult(null);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const res = await api.post('/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
 setImportResult(res.data.summary);
 setSuccess(`Import: ${res.data.summary.added} added, ${res.data.summary.skipped} skipped`);
 fetchUsers();
 setTimeout(() => setSuccess(''), 5000);
 } catch (err: any) {
 setError(err.response?.data?.message || 'Import failed');
 } finally {
 setImporting(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 const filtered = users.filter(u =>
 !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
 );

 // Role stats
 const roleStats = OC_ROLE_OPTIONS.map(r => ({
 ...r,
 count: users.filter(u => u.role === r.value && u.status === 'ACTIVE').length
 }));

 if (!user?.canManageUsers && user?.role !== 'OC_HSE_MANAGER' && user?.role !== 'ADMIN') {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <AlertCircle className="text-red-500 mb-3" size={40} />
 <h2 className="text-lg font-bold text-red-400">{t('oc.accessDenied')}</h2>
 <p className="text-gray-800 text-base mt-2">{t('oc.settings.noPermission')}</p>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
 <div>
 <h1 className="text-lg font-bold text-gray-800">{t('oc.settings.title')}</h1>
 <p className="text-gray-500 text-xs mt-0.5">{t('oc.settings.subtitle')}</p>
 </div>
 {activeTab === 'users' && (
 <button onClick={openCreateModal}
 className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs shadow-md shadow-blue-500/20 transition-all w-full sm:w-auto justify-center">
 <UserPlus size={14} /> {t('oc.settings.addUser')}
 </button>
 )}
 </div>

 {/* Admin Tabs */}
 <div className="flex gap-1 border-b border-gray-200 pb-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
 <button onClick={() => setActiveTab('users')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'users' ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Users size={13} /> Users
 </button>
 <button onClick={() => setActiveTab('zones')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'zones' ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Map size={13} /> Zones
 </button>
 <button onClick={() => setActiveTab('departments')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'departments' ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Building size={13} /> Departments
 </button>
 {user?.role === 'ADMIN' && (
 <button onClick={() => setActiveTab('providers')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'providers' ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Briefcase size={13} /> Providers
 </button>
 )}
 {(user?.role === 'ADMIN' || user?.canManageEvents) && (
 <button onClick={() => setActiveTab('events')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'events' ? 'bg-blue-600/15 text-blue-500 border border-blue-600/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Calendar size={13} /> Events
 </button>
 )}
 {(user?.role === 'ADMIN' || user?.role === 'OC_HSE_MANAGER' || user?.canManageUsers) && (
 <button onClick={() => setActiveTab('system')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'system' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'text-gray-600 hover:bg-gray-100'}`}>
 <Wrench size={13} /> System
 </button>
 )}
 </div>

 {activeTab === 'users' && (
 <div className="space-y-2.5 animate-in fade-in">

 {/* Excel Import/Export Bar */}
 <div className="bg-white border border-gray-200 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
 <div className="flex items-center gap-2 flex-1">
 <FileSpreadsheet size={16} className="text-emerald-400 flex-shrink-0" />
 <span className="text-sm text-gray-800">{t('oc.settings.excelTools')}</span>
 </div>
 <div className="flex gap-2">
 <button onClick={handleDownloadTemplate}
 className="bg-white border border-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:text-emerald-400 hover:border-emerald-500/50 transition-all flex-1 sm:flex-none justify-center">
 <Download size={13} /> {t('oc.settings.downloadTemplate')}
 </button>
 <label className={`bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/25 transition-all flex-1 sm:flex-none justify-center ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
 {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
 {importing ? t('oc.settings.importing') : t('oc.settings.importExcel')}
 <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
 </label>
 </div>
 </div>

 {/* Import Result */}
 {importResult && (
 <div className="bg-white border border-emerald-500/30 rounded-xl shadow-sm p-3 space-y-1">
 <p className="text-base font-bold text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Import Result</p>
 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="bg-white rounded-lg p-2">
 <p className="text-lg font-bold text-emerald-400">{importResult.added}</p>
 <p className="text-[10px] text-gray-800">Added</p>
 </div>
 <div className="bg-white rounded-lg p-2">
 <p className="text-lg font-bold text-blue-500">{importResult.skipped}</p>
 <p className="text-[10px] text-gray-800">Skipped</p>
 </div>
 <div className="bg-white rounded-lg p-2">
 <p className="text-lg font-bold text-gray-800">{importResult.totalRows}</p>
 <p className="text-[10px] text-gray-800">Total</p>
 </div>
 </div>
 {importResult.errors?.length > 0 && (
 <details className="mt-1">
 <summary className="text-[10px] text-gray-800 cursor-pointer">Show errors ({importResult.errors.length})</summary>
 <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-red-400 space-y-0.5">
 {importResult.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}
 </div>
 </details>
 )}
 </div>
 )}

 {success && (
 <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl shadow-sm p-3 flex items-center gap-2">
 <CheckCircle className="text-emerald-400" size={16} />
 <p className="text-emerald-400 text-base">{success}</p>
 </div>
 )}
 {error && (
 <div className="bg-red-500/10 border border-red-500/30 rounded-xl shadow-sm p-3 flex items-center gap-2">
 <AlertCircle className="text-red-400" size={16} />
 <p className="text-red-400 text-base">{error}</p>
 </div>
 )}

 {/* Role Distribution */}
 <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
 {roleStats.map(r => (
 <div key={r.value} className="bg-white border border-gray-200 rounded-lg p-2 text-center">
 <p className="text-xl font-bold text-gray-800">{r.count}</p>
 <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{r.label}</p>
 </div>
 ))}
 </div>

 {/* Search */}
 <div className="relative">
 <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input
 type="text" value={search} onChange={(e) => setSearch(e.target.value)}
 placeholder={t('oc.settings.searchUsers')}
 className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
 </div>

 {/* User List */}
 {loading ? (
 <div className="flex justify-center py-12">
 <Loader2 className="animate-spin text-blue-600" size={28} />
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-16">
 <Users className="mx-auto text-gray-800 mb-3" size={40} />
 <p className="text-gray-800 text-base">{t('oc.settings.noUsers')}</p>
 </div>
 ) : (
 <div className="space-y-2">
 {filtered.map(u => (
 <div key={u.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl shadow-sm flex items-center justify-center font-bold text-base
 ${u.status === 'ACTIVE' ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white' : 'bg-slate-200 text-gray-800'}`}>
 {u.name?.charAt(0)?.toUpperCase() || '?'}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-base font-medium text-gray-800">{u.name}</p>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleColors[u.role] || 'bg-slate-200 text-gray-800 border-gray-300'}`}>
 {OC_ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
 </span>
 {u.status === 'PENDING' && (
 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-600/15 text-blue-500 border-blue-600/30">
 Pending
 </span>
 )}
 </div>
 <p className="text-base text-gray-800 truncate" dir="ltr">{u.email}</p>
 </div>
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <button onClick={() => handleToggleStatus(u.id, u.status)}
 title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
 className={`p-1.5 rounded-lg border text-base transition-all
 ${statusColors[u.status] || 'bg-slate-500/10 border-slate-500/30 text-gray-800'}
 hover:opacity-80`}>
 {u.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
 </button>
 <button onClick={() => openEditModal(u)}
 className="p-1.5 rounded-lg border border-gray-200 text-gray-800 hover:text-blue-500 hover:border-blue-600/50 transition-all">
 <Edit2 size={14} />
 </button>
 <button onClick={() => handleDelete(u.id)}
 className="p-1.5 rounded-lg border border-gray-200 text-gray-800 hover:text-red-400 hover:border-red-500/50 transition-all">
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Create/Edit Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-5">
 <h3 className="text-lg font-bold text-gray-800">
 {editingUser ? 'Edit User' : 'Add User'}
 </h3>
 <button onClick={() => setShowModal(false)} className="text-gray-800 hover:text-gray-800">
 <X size={20} />
 </button>
 </div>

 <div className="space-y-3" dir="ltr">
 {error && (
 <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-base flex items-center gap-2">
 <AlertCircle size={14} /> {error}
 </div>
 )}
 <p className="text-blue-500/70 text-[10px]">⚠ All fields must be in English</p>

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Full Name (First, Second, Last) *</label>
 <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="e.g. John William Doe"
 dir="ltr"
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
 </div>

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Email Address *</label>
 <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
 placeholder="user@company.com" dir="ltr"
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
 </div>

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Role *</label>
 <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
 {OC_ROLE_OPTIONS.map(r => (
 <option key={r.value} value={r.value}>{r.label}</option>
 ))}
 </select>
 </div>

 {/* Point 9: Department dropdown for DEP_REP / DEP_MANAGER */}
 {(form.role === 'DEP_REP' || form.role === 'DEP_MANAGER') && (
 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Linked Department (القسم المرتبط) *</label>
 <select value={form.repDepartmentId} onChange={(e) => setForm({ ...form, repDepartmentId: e.target.value })}
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
 <option value="">-- Select Department --</option>
 {userDepartments.map((d: any) => (
 <option key={d.id} value={d.id}>{d.name}{d.nameAr ? ` / ${d.nameAr}` : ''}</option>
 ))}
 </select>
 {!form.repDepartmentId && <p className="text-amber-500 text-[10px] mt-1">⚠ Without a department, this user won't see any tickets</p>}
 </div>
 )}

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Mobile Number *</label>
 <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/[^0-9+]/g, '') })}
 placeholder="+966500000000" dir="ltr" required type="tel" inputMode="numeric"
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
 </div>

 <div className="space-y-3 pt-4 border-t border-gray-200 mt-4">
 <h4 className="text-base font-semibold text-gray-900 mb-2">Additional Permissions (صلاحيات إضافية)</h4>
 <div className="grid grid-cols-1 gap-2">
 <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
 onClick={() => setForm({ ...form, canManageUsers: !form.canManageUsers })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.canManageUsers ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300'}`}>
 {form.canManageUsers && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-purple-800 select-none">Can Activate / Manage Users (تفعيل المستخدمين)</span>
 </div>
 <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
 onClick={() => setForm({ ...form, canManageEvents: !form.canManageEvents })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.canManageEvents ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300'}`}>
 {form.canManageEvents && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-emerald-800 select-none">Can Add / Manage Events (إدارة الفعاليات)</span>
 </div>
 <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
 onClick={() => setForm({ ...form, canViewAnalytics: !form.canViewAnalytics })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.canViewAnalytics ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'}`}>
 {form.canViewAnalytics && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-blue-800 select-none">Can View Analytics (مشاهدة الإحصائيات)</span>
 </div>
 <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200 cursor-pointer hover:bg-teal-100 transition-colors"
 onClick={() => setForm({ ...form, isIntakeEnabled: !form.isIntakeEnabled })}>
 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.isIntakeEnabled ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300'}`}>
 {form.isIntakeEnabled && <CheckCircle size={14} />}
 </div>
 <span className="text-base font-medium text-teal-800 select-none">Ticket Intake Enabled (استقبال تذاكر المبلغين)</span>
 </div>
 </div>
 </div>

 <div className="flex gap-2 pt-2">
 <button onClick={() => setShowModal(false)}
 className="flex-1 bg-white border border-gray-200 text-gray-800 font-bold py-2.5 rounded-xl shadow-sm text-base hover:bg-slate-200 transition-all">
 {t('common.cancel')}
 </button>
 <button onClick={handleSubmit} disabled={!form.name || !form.email}
 className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-2.5 rounded-xl shadow-sm text-base shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-all">
 {editingUser ? t('common.save') : t('oc.settings.create')}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Zones Tab */}
 {activeTab === 'zones' && (
 <div className="space-y-4 animate-in fade-in">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-3"><Map className="text-blue-500 flex-shrink-0" /><div><h3 className="font-bold text-gray-600 text-sm">Zone Boundaries</h3><p className="text-xs text-gray-500">Map incidents to zones</p></div></div>
 <button onClick={() => { setZoneError(''); setZoneFormData({ name: '', description: '', coordinates: [] }); setShowZoneModal(true); }} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-500 border border-blue-600/50 px-3 py-1.5 flex items-center gap-2 rounded-lg text-sm font-bold w-full sm:w-auto justify-center"><Plus size={16}/> Add Zone</button>
 </div>
 {zones.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {zones.map(z => (
 <div key={z.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 relative group">
 <h4 className="font-bold text-gray-600">{z.name}</h4>
 <p className="text-base text-gray-800 mb-2">{z.description || 'No description'}</p>
 <p className="text-[10px] text-gray-800">Polygon: {(() => {
   try { return Array.isArray(z.coordinates) ? z.coordinates.length : JSON.parse(z.coordinates || '[]').length; }
   catch { return 0; }
 })()} points</p>
 <button onClick={() => deleteZone(z.id)} className="absolute top-2 right-2 p-1.5 text-gray-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-white rounded"><Trash2 size={14}/></button>
 </div>
 ))}
 </div>
 ) : (<div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-800">No zones defined.</div>)}
 </div>
 )}

 {/* Departments Tab */}
 {activeTab === 'departments' && (
 <div className="space-y-4 animate-in fade-in">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-3"><Building className="text-blue-500 flex-shrink-0" /><div><h3 className="font-bold text-gray-600 text-sm">Departments Management</h3><p className="text-xs text-gray-500">View and configure departments.</p></div></div>
 <button onClick={() => { setEditingDepartmentId(null); setDepartmentError(''); setDepartmentFormData({ nameEn: '', nameAr: '', manager: {name:'', email:'', mobile:''}, representatives: [{name:'', email:'', mobile:''}] }); setShowDepartmentModal(true); }} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-500 border border-blue-600/50 px-3 py-1.5 flex items-center gap-2 rounded-lg text-sm font-bold w-full sm:w-auto justify-center"><Plus size={16}/> Add Department</button>
 <button
   onClick={syncDepartmentsFromAzure}
   disabled={syncingAzure}
   className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-600 border border-indigo-600/50 px-3 py-1.5 flex items-center gap-2 rounded-lg text-sm font-bold w-full sm:w-auto justify-center disabled:opacity-50"
   title="Sync departments from Microsoft Azure AD"
 >
   {syncingAzure
     ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> {isRtl ? 'جارٍ المزامنة...' : 'Syncing...'}</>
     : <>🔄 {isRtl ? 'مزامنة من Azure' : 'Sync from Azure'}</>
   }
 </button>
 </div>
 <div className="space-y-2 md:hidden">
 {departments.map(d => (
 <div key={d.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 space-y-1.5">
 <div className="flex items-center justify-between">
 <p className="font-bold text-gray-700 text-sm">{d.name}</p>
 <div className="flex gap-1.5">
 <button onClick={() => openEditDepartment(d)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-500"><Edit2 size={14} /></button>
 <button onClick={() => deleteDepartment(d.id)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
 </div>
 </div>
 {d.nameAr && <p className="text-xs text-gray-500" dir="rtl">{d.nameAr}</p>}
 <div className="flex items-center justify-between text-xs text-gray-500">
 <span>Manager: <strong className="text-emerald-600">{d.manager?.name || 'N/A'}</strong></span>
 <span>{d.representatives?.length || 0} reps</span>
 </div>
 </div>
 ))}
 </div>
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto hidden md:block w-full">
 <table className="w-full text-left text-sm">
 <thead className="bg-white text-gray-800 text-xs">
 <tr><th className="px-4 py-3">Name (EN)</th><th className="px-4 py-3">Name (AR)</th><th className="px-4 py-3">Manager</th><th className="px-4 py-3">Reps</th><th className="px-4 py-3 text-right">Action</th></tr>
 </thead>
 <tbody className="divide-y divide-slate-700/50 text-gray-800">
 {departments.map(d => (
 <tr key={d.id}>
 <td className="px-4 py-3 font-bold text-gray-600">{d.name}</td>
 <td className="px-4 py-3 text-gray-600">{d.nameAr || '-'}</td>
 <td className="px-4 py-3 text-emerald-400">{d.manager?.name || 'N/A'}</td>
 <td className="px-4 py-3 text-gray-800">{d.representatives?.length || 0}</td>
 <td className="px-4 py-3 text-right flex items-center justify-end gap-2"><button onClick={() => openEditDepartment(d)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-500 hover:border-blue-400 transition-all" title="Edit"><Edit2 size={14} /></button><button onClick={() => deleteDepartment(d.id)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-400 hover:border-red-400 transition-all" title="Delete"><Trash2 size={14} /></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Events Tab */}
 {activeTab === 'events' && (
 <div className="space-y-4 animate-in fade-in">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-3"><Calendar className="text-blue-500 flex-shrink-0" /><div><h3 className="font-bold text-gray-600 text-sm">Events Management</h3><p className="text-xs text-gray-500">Manage Dakar Rally, Formula 1, etc.</p></div></div>
 <button onClick={() => { setEventError(''); setEventFormData({ nameEn: '', nameAr: '', status: 'ACTIVE' }); setEditingEventId(null); setShowEventModal(true); }} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-500 border border-blue-600/50 px-3 py-1.5 flex items-center gap-2 rounded-lg text-sm font-bold w-full sm:w-auto justify-center"><Plus size={16}/> Add Event</button>
 </div>
 {events.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {events.map(ev => (
 <div key={ev.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 relative group">
 <h4 className="font-bold text-gray-600">{ev.nameEn} / {ev.nameAr}</h4>
 <p className="text-sm text-gray-500 mb-2">Status: <span className={ev.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}>{ev.status}</span></p>
 <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => openEditEvent(ev)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"><Edit2 size={14} /></button>
 <button onClick={() => deleteEvent(ev.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"><Trash2 size={14} /></button>
 </div>
 </div>
 ))}
 </div>
 ) : (<div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-800">No events defined.</div>)}
 </div>
 )}

 {/* Service Providers Tab */}
 {activeTab === 'providers' && (
 <div className="space-y-4 animate-in fade-in">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-3"><Briefcase className="text-blue-500 flex-shrink-0" /><div><h3 className="font-bold text-gray-600 text-sm">Service Providers</h3><p className="text-xs text-gray-500">Manage Providers & Blacklisting.</p></div></div>
 <button onClick={() => { setEditingProviderId(null); setProviderError(''); setProviderFormData({ name: '', nameAr: '', commercialRegistrationNumber: '', responsibleDepartmentId: '', representativeName: '', representativeEmail: '', representativeMobile: '', representatives: [{name:'', email:'', mobile:''}] }); setShowProviderModal(true); }} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-500 border border-blue-600/50 px-3 py-1.5 flex items-center gap-2 rounded-lg text-sm font-bold w-full sm:w-auto justify-center"><Plus size={16}/> Add Provider</button>
 </div>
 <div className="space-y-2 md:hidden">
 {serviceProviders.map(sp => (
 <div key={sp.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 space-y-2">
 <div className="flex items-center justify-between">
 <p className="font-bold text-gray-700 text-sm">{sp.name}</p>
 <div className="flex gap-1.5">
 <button onClick={() => openEditProvider(sp)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-500"><Edit2 size={14} /></button>
 <button onClick={() => deleteProvider(sp.id)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
 </div>
 </div>
 <p className="text-xs text-gray-500 font-mono">CR: {sp.commercialRegistrationNumber}</p>
 <div className="flex items-center justify-between text-xs">
 <span className="text-gray-500">{sp.department?.name || 'N/A'}</span>
 <button onClick={() => {
 const newStatus = sp.status === 'BLACKLISTED' ? 'ACTIVE' : 'BLACKLISTED';
 setConfirmModal({ title: `Change Status`, message: `Change to ${newStatus}?`, onConfirm: async () => {
 try { await api.patch(`/service-providers/${sp.id}/status`, { status: newStatus }); fetchServiceProviders(); } catch (err: any) { showToast(err.response?.data?.message || t('errors.operationFailed'), 'error'); }
 setConfirmModal(null);
 }});
 }}
 className={`px-2 py-0.5 rounded text-xs font-bold ${sp.status === 'BLACKLISTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
 {sp.status}
 </button>
 </div>
 </div>
 ))}
 </div>
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto hidden md:block w-full">
 <table className="w-full text-left text-sm">
 <thead className="bg-white text-gray-800 text-xs">
 <tr><th className="px-4 py-3">CR Number</th><th className="px-4 py-3">Provider Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
 </thead>
 <tbody className="divide-y divide-slate-700/50 text-gray-800">
 {serviceProviders.map(sp => (
 <tr key={sp.id}>
 <td className="px-4 py-3 font-mono text-gray-800">{sp.commercialRegistrationNumber}</td>
 <td className="px-4 py-3 font-bold text-gray-600">{sp.name}</td>
 <td className="px-4 py-3 text-gray-800">{sp.department?.name || 'N/A'}</td>
 <td className="px-4 py-3 text-center">
 <button onClick={() => {
 const newStatus = sp.status === 'BLACKLISTED' ? 'ACTIVE' : 'BLACKLISTED';
 setConfirmModal({ title: t('confirm.changeStatus'), message: t('confirm.changeStatusMsg', { status: newStatus === 'BLACKLISTED' ? 'Blacklisted / قائمة سوداء' : 'Active / نشط' }), onConfirm: async () => {
 try { await api.patch(`/service-providers/${sp.id}/status`, { status: newStatus }); fetchServiceProviders(); } catch (err: any) { showToast(err.response?.data?.message || t('errors.operationFailed'), 'error'); }
 setConfirmModal(null);
 }});
 }}
 className={`px-3 py-1 rounded text-sm font-bold transition-all ${sp.status === 'BLACKLISTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
 {sp.status}
 </button>
 </td>
 <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
 <button onClick={() => openEditProvider(sp)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-500 hover:border-blue-400 transition-all" title="Edit"><Edit2 size={14} /></button>
 <button onClick={() => deleteProvider(sp.id)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-400 hover:border-red-400 transition-all" title="Delete"><Trash2 size={14} /></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Event Modal */}
 {showEventModal && (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-bold text-gray-800">{editingEventId ? 'Edit Event' : 'Add New Event'}</h3><button onClick={() => setShowEventModal(false)} className="text-gray-800 hover:text-gray-800"><X size={20}/></button></div>
 <div className="space-y-4">
 {eventError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-base">{eventError}</div>}
 <div><label className="block text-base font-medium text-gray-800 mb-1">Event Name (English) *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={eventFormData.nameEn} onChange={e => setEventFormData({...eventFormData, nameEn: e.target.value})} placeholder="e.g. Dakar Rally" /></div>
 <div><label className="block text-base font-medium text-gray-800 mb-1">Event Name (Arabic) *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={eventFormData.nameAr} onChange={e => setEventFormData({...eventFormData, nameAr: e.target.value})} placeholder="مثال: رالي داكار" /></div>
 <div><label className="block text-base font-medium text-gray-800 mb-1">Status</label><select className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={eventFormData.status} onChange={e => setEventFormData({...eventFormData, status: e.target.value})}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
 </div>
 <div className="flex gap-2 mt-6 justify-end">
 <button onClick={handleEventSubmit} disabled={!eventFormData.nameEn || !eventFormData.nameAr} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 font-bold rounded-xl shadow-sm text-white text-base disabled:opacity-50">{editingEventId ? 'Save Changes' : 'Create Event'}</button>
 </div>
 </div>
 </div>
 )}

 {/* Zone Modal */}
 {showZoneModal && (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-bold text-gray-800">Add New Zone</h3><button onClick={() => setShowZoneModal(false)} className="text-gray-800 hover:text-gray-800"><X size={20}/></button></div>
 <div className="grid md:grid-cols-2 gap-6">
 <div className="space-y-4">
 {zoneError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-base">{zoneError}</div>}
 <div><label className="block text-base font-medium text-gray-800 mb-1">Zone Name *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={zoneFormData.name} onChange={e => setZoneFormData({...zoneFormData, name: e.target.value})} /></div>
 <div><label className="block text-base font-medium text-gray-800 mb-1">Description (Optional)</label><textarea className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" rows={3} value={zoneFormData.description} onChange={e => setZoneFormData({...zoneFormData, description: e.target.value})} /></div>
 <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl shadow-sm text-blue-400 text-base"><h4 className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={14}/> Drawing Zones</h4><p>Click on the map multiple times to draw the boundaries.</p></div>
 </div>
 <div className="flex flex-col">
 <label className="block text-base font-medium text-gray-800 mb-1">Zone Boundary *</label>
 <ZoneDrawerMap existingZones={zones} onPolygonChange={(points) => setZoneFormData(prev => ({ ...prev, coordinates: points }))} />
 </div>
 </div>
 <div className="flex gap-2 pt-4 justify-end">
 <button onClick={handleZoneSubmit} disabled={zoneFormData.coordinates.length < 3 || !zoneFormData.name} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 font-bold rounded-xl shadow-sm text-white text-base disabled:opacity-50">Create Zone</button>
 </div>
 </div>
 </div>
 )}

 {/* Department Modal */}
 {showDepartmentModal && (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 my-8">
 <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3"><h3 className="text-lg font-bold text-gray-800">{editingDepartmentId ? 'Edit Department (تعديل القسم)' : 'Add Department (Auto-Provisions Users)'}</h3><button onClick={() => { setShowDepartmentModal(false); setEditingDepartmentId(null); }} className="text-gray-800 hover:text-gray-800"><X size={20}/></button></div>
 <div className="space-y-6">
 {departmentError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-base">{departmentError}</div>}
 
 <div className="grid md:grid-cols-2 gap-4">
 <div><label className="block text-base font-medium text-gray-800 mb-1">Department Name (English) *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={departmentFormData.nameEn} onChange={e => setDepartmentFormData({...departmentFormData, nameEn: e.target.value})} /></div>
 <div><label className="block text-base font-medium text-gray-800 mb-1">اسم القسم (Arabic) *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={departmentFormData.nameAr} onChange={e => setDepartmentFormData({...departmentFormData, nameAr: e.target.value})} dir="rtl"/></div>
 </div>

 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
 <h4 className="text-base font-bold text-blue-500 mb-3 border-b border-gray-200 pb-2">Department Manager</h4>
 <div className="grid md:grid-cols-3 gap-3">
 <div><label className="block text-base text-gray-800 mb-1">Full Name</label><input className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={departmentFormData.manager.name} onChange={e => setDepartmentFormData({...departmentFormData, manager: {...departmentFormData.manager, name: e.target.value}})} /></div>
 <div><label className="block text-base text-gray-800 mb-1">Email</label><input type="email" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={departmentFormData.manager.email} onChange={e => setDepartmentFormData({...departmentFormData, manager: {...departmentFormData.manager, email: e.target.value}})} /></div>
 <div><label className="block text-base text-gray-800 mb-1">Mobile</label><input type="tel" inputMode="numeric" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={departmentFormData.manager.mobile} onChange={e => setDepartmentFormData({...departmentFormData, manager: {...departmentFormData.manager, mobile: e.target.value.replace(/[^0-9+]/g, '')}})} /></div>
 </div>
 </div>

 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
 <h4 className="text-base font-bold text-emerald-400">Representatives</h4>
 <button onClick={() => setDepartmentFormData({...departmentFormData, representatives: [...departmentFormData.representatives, {name:'', email:'', mobile:''}]})} className="text-base bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add Rep</button>
 </div>
 <div className="space-y-3">
 {departmentFormData.representatives.map((rep, idx) => (
 <div key={idx} className="flex gap-2 items-start">
 <div className="grid md:grid-cols-3 gap-2 flex-1">
 <input placeholder="Full Name" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.name} onChange={e => { const newReps = [...departmentFormData.representatives]; newReps[idx].name = e.target.value; setDepartmentFormData({...departmentFormData, representatives: newReps}); }} />
 <input placeholder="Email" type="email" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.email} onChange={e => { const newReps = [...departmentFormData.representatives]; newReps[idx].email = e.target.value; setDepartmentFormData({...departmentFormData, representatives: newReps}); }} />
 <input placeholder="Mobile" type="tel" inputMode="numeric" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.mobile} onChange={e => { const newReps = [...departmentFormData.representatives]; newReps[idx].mobile = e.target.value.replace(/[^0-9+]/g, ''); setDepartmentFormData({...departmentFormData, representatives: newReps}); }} />
 </div>
 {departmentFormData.representatives.length > 1 && (
 <button onClick={() => { const newReps = [...departmentFormData.representatives]; newReps.splice(idx, 1); setDepartmentFormData({...departmentFormData, representatives: newReps}); }} className="p-2 text-gray-800 hover:text-red-400 bg-white rounded-lg border border-gray-200"><Trash2 size={16}/></button>
 )}
 </div>
 ))}
 </div>
 </div>
 
 <button onClick={handleDepartmentSubmit} disabled={!departmentFormData.nameEn} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold rounded-xl shadow-md shadow-blue-500/20 text-white transition-all text-base disabled:opacity-50">{editingDepartmentId ? 'Update Department (تحديث القسم)' : 'Create Department & Provision Users'}</button>
 </div>
 </div>
 </div>
 )}

 {/* Provider Modal */}
 {showProviderModal && (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 my-8">
 <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3"><h3 className="text-lg font-bold text-gray-800">{editingProviderId ? 'Edit Service Provider (تعديل المزود)' : 'Add Service Provider (Auto-Provisions Users)'}</h3><button onClick={() => { setShowProviderModal(false); setEditingProviderId(null); }} className="text-gray-800 hover:text-gray-800"><X size={20}/></button></div>
 <div className="space-y-6">
 {providerError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-base">{providerError}</div>}
 
 <div className="grid md:grid-cols-2 gap-4">
 <div><label className="block text-base font-medium text-gray-800 mb-1">Company Name (English) *</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={providerFormData.name} onChange={e => setProviderFormData({...providerFormData, name: e.target.value})} /></div>
 <div><label className="block text-base font-medium text-gray-800 mb-1">اسم الشركة (عربي)</label><input className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" dir="rtl" value={providerFormData.nameAr} onChange={e => setProviderFormData({...providerFormData, nameAr: e.target.value})} /></div>
 <div className="md:col-span-2"><label className="block text-base font-medium text-gray-800 mb-1">Commercial Registration Number * (Starts with 700) / رقم السجل التجاري * (يبدأ بـ 700)</label><input type="text" placeholder="700xxxxxxx" className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 font-mono" value={providerFormData.commercialRegistrationNumber} onChange={e => setProviderFormData({...providerFormData, commercialRegistrationNumber: e.target.value})} /></div>
 </div>

 {/* Primary Representative Block */}
 <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
   <h4 className="text-sm font-bold text-blue-900 mb-3">Primary Representative / ممثل المورد الرئيسي</h4>
   <div className="grid md:grid-cols-3 gap-3">
     <div>
       <label className="block text-xs font-medium text-gray-700 mb-1">Name / الاسم</label>
       <input className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" value={providerFormData.representativeName} onChange={e => setProviderFormData({...providerFormData, representativeName: e.target.value})} />
     </div>
     <div>
       <label className="block text-xs font-medium text-gray-700 mb-1">Email / البريد</label>
       <input type="email" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" value={providerFormData.representativeEmail} onChange={e => setProviderFormData({...providerFormData, representativeEmail: e.target.value})} />
     </div>
     <div>
       <label className="block text-xs font-medium text-gray-700 mb-1">Mobile / الجوال</label>
       <input type="tel" inputMode="numeric" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" value={providerFormData.representativeMobile} onChange={e => setProviderFormData({...providerFormData, representativeMobile: e.target.value.replace(/[^0-9+]/g, '')})} />
     </div>
   </div>
 </div>
 
 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">Responsible Sponsoring Department *</label>
 <select className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800" value={providerFormData.responsibleDepartmentId} onChange={e => setProviderFormData({...providerFormData, responsibleDepartmentId: e.target.value})}>
 <option value="">-- Select Department --</option>
 {departments.map(d => (
 <option key={d.id} value={d.id}>{d.name} {d.nameAr ? `(${d.nameAr})` : ''}</option>
 ))}
 </select>
 </div>

 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
 <h4 className="text-base font-bold text-emerald-400">Company Representatives</h4>
 <button onClick={() => setProviderFormData({...providerFormData, representatives: [...providerFormData.representatives, {name:'', email:'', mobile:''}]})} className="text-base bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add Rep</button>
 </div>
 <div className="space-y-3">
 {providerFormData.representatives.map((rep, idx) => (
 <div key={idx} className="flex gap-2 items-start">
 <div className="grid md:grid-cols-3 gap-2 flex-1">
 <input placeholder="Full Name" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.name} onChange={e => { const newReps = [...providerFormData.representatives]; newReps[idx].name = e.target.value; setProviderFormData({...providerFormData, representatives: newReps}); }} />
 <input placeholder="Email" type="email" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.email} onChange={e => { const newReps = [...providerFormData.representatives]; newReps[idx].email = e.target.value; setProviderFormData({...providerFormData, representatives: newReps}); }} />
 <input placeholder="Mobile" type="tel" inputMode="numeric" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800" value={rep.mobile} onChange={e => { const newReps = [...providerFormData.representatives]; newReps[idx].mobile = e.target.value.replace(/[^0-9+]/g, ''); setProviderFormData({...providerFormData, representatives: newReps}); }} />
 </div>
 {providerFormData.representatives.length > 1 && (
 <button onClick={() => { const newReps = [...providerFormData.representatives]; newReps.splice(idx, 1); setProviderFormData({...providerFormData, representatives: newReps}); }} className="p-2 text-gray-800 hover:text-red-400 bg-white rounded-lg border border-gray-200"><Trash2 size={16}/></button>
 )}
 </div>
 ))}
 </div>
 </div>
 
 <button onClick={handleProviderSubmit} disabled={!providerFormData.name || !providerFormData.commercialRegistrationNumber || !providerFormData.responsibleDepartmentId} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold rounded-xl shadow-md shadow-blue-500/20 text-white transition-all text-base disabled:opacity-50">{editingProviderId ? 'Update Provider (تحديث المزود)' : 'Create Provider & Provision Users'}</button>
 </div>
 </div>
 </div>
 )}

 {/* System / Maintenance Tab */}
 {activeTab === 'system' && (
 <div className="space-y-4 animate-in fade-in">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-3"><Wrench className="text-amber-500 flex-shrink-0" /><div><h3 className="font-bold text-gray-600 text-sm">System Controls</h3><p className="text-xs text-gray-500">Manage maintenance mode and platform settings.</p></div></div>
 </div>

 {/* Maintenance Mode Card */}
 <div className={`border rounded-2xl p-5 transition-all ${maintenanceEnabled ? 'bg-red-50 border-red-200 shadow-lg shadow-red-100/50' : 'bg-white border-gray-200 shadow-sm'}`}>
 <div className="flex items-start gap-4">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${maintenanceEnabled ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-gray-100'}`}>
 <Wrench size={22} className={maintenanceEnabled ? 'text-white' : 'text-gray-400'} />
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className={`font-bold text-base ${maintenanceEnabled ? 'text-red-700' : 'text-gray-800'}`}>Maintenance Mode</h3>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${maintenanceEnabled ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
 {maintenanceEnabled ? 'ACTIVE' : 'OFF'}
 </span>
 </div>
 <p className={`text-xs leading-relaxed mb-4 ${maintenanceEnabled ? 'text-red-600' : 'text-gray-500'}`}>
 {maintenanceEnabled
 ? '⚠️ The platform is currently in maintenance mode. All non-admin users see the maintenance page and cannot access the system.'
 : 'When enabled, all non-admin users will see a maintenance page. Only ADMIN users can access the platform.'}
 </p>
 <button
 onClick={toggleMaintenance}
 disabled={maintenanceLoading}
 className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 ${
 maintenanceEnabled
 ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
 : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
 }`}
 >
 {maintenanceLoading ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
 {maintenanceEnabled ? 'Disable Maintenance (Go Live)' : 'Enable Maintenance Mode'}
 </button>
 </div>
 </div>
 </div>

 {/* Contact Info */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
 <p className="text-xs text-gray-500 mb-2 font-medium">During maintenance, users will be shown this contact:</p>
 <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
 <ShieldCheck size={14} className="text-blue-500" />
 <span className="text-sm font-bold text-blue-700" dir="ltr">safety@saudimotorsport.com</span>
 </div>
 </div>
 </div>
 )}


 {/* Confirmation Modal */}
 {confirmModal && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
 <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in">
 <div className="flex flex-col items-center text-center">
 <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mb-4">
 <AlertTriangle className="text-red-500" size={28} />
 </div>
 <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
 <p className="text-sm text-gray-600 whitespace-pre-line mb-6">{confirmModal.message}</p>
 <div className="flex gap-3 w-full">
 <button onClick={() => setConfirmModal(null)}
 className="flex-1 bg-gray-100 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all">
 Cancel (إلغاء)
 </button>
 <button onClick={confirmModal.onConfirm}
 className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-lg hover:from-red-600 hover:to-red-700 transition-all">
 Delete (حذف)
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
