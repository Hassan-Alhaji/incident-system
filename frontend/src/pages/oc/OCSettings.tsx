import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import {
    Plus, Trash2, Edit2, Users, CheckCircle, XCircle, AlertCircle,
    Loader2, X, ShieldCheck, Search as SearchIcon, UserPlus, Upload, Download, FileSpreadsheet
} from 'lucide-react';

const OC_ROLE_OPTIONS = [
    { value: 'OC_REPORTER', label: 'Reporter' },
    { value: 'OC_SUPERVISOR', label: 'Supervisor' },
    { value: 'OC_SAFETY_INVESTIGATOR', label: 'Safety Investigator' },
    { value: 'OC_HSE_MANAGER', label: 'HSE Manager' },
];

const roleColors: Record<string, string> = {
    OC_REPORTER: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    OC_SUPERVISOR: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    OC_SAFETY_INVESTIGATOR: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    OC_HSE_MANAGER: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    PENDING: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    SUSPENDED: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const OCSettings = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({ name: '', email: '', role: 'OC_REPORTER', mobile: '' });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/oc/users');
            setUsers(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load users');
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
            setError('Name must be in English letters only.');
            return;
        }
        if (!form.mobile?.trim()) {
            setError('Mobile number is required.');
            return;
        }
        try {
            if (editingUser) {
                await api.put(`/oc/users/${editingUser}`, form);
                setSuccess(t('oc.settings.userUpdated'));
            } else {
                await api.post('/oc/users', form);
                setSuccess(t('oc.settings.userCreated'));
            }
            setShowModal(false);
            setEditingUser(null);
            setForm({ name: '', email: '', role: 'OC_REPORTER', mobile: '' });
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('oc.settings.confirmDelete'))) return;
        try {
            await api.delete(`/oc/users/${id}`);
            setSuccess(t('oc.settings.userDeleted'));
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Delete failed');
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
            await api.patch(`/oc/users/${id}/status`, { status: newStatus });
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Status update failed');
        }
    };

    const openEditModal = (u: any) => {
        setEditingUser(u.id);
        setForm({ name: u.name, email: u.email, role: u.role, mobile: u.mobile || '' });
        setShowModal(true);
        setError('');
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setForm({ name: '', email: '', role: 'OC_REPORTER', mobile: '' });
        setShowModal(true);
        setError('');
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get('/oc/users/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const a = document.createElement('a'); a.href = url; a.download = 'oc_users_template.xlsx'; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) { 
            console.error('Download template error:', err);
            setError('Failed to download template: ' + (err.response?.data?.message || err.message)); 
            alert('Failed to download template. See console for details.');
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true); setError(''); setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/oc/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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
                <p className="text-slate-400 text-sm mt-2">{t('oc.settings.noPermission')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">{t('oc.settings.title')}</h1>
                    <p className="text-slate-400 text-xs mt-0.5">{t('oc.settings.subtitle')}</p>
                </div>
                <button onClick={openCreateModal}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all">
                    <UserPlus size={16} /> {t('oc.settings.addUser')}
                </button>
            </div>

            {/* Excel Import/Export Bar */}
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 flex items-center gap-2 flex-wrap">
                <FileSpreadsheet size={16} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-slate-400 flex-1">{t('oc.settings.excelTools')}</span>
                <button onClick={handleDownloadTemplate}
                    className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:text-emerald-400 hover:border-emerald-500/50 transition-all">
                    <Download size={13} /> {t('oc.settings.downloadTemplate')}
                </button>
                <label className={`bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/25 transition-all ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importing ? t('oc.settings.importing') : t('oc.settings.importExcel')}
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                </label>
            </div>

            {/* Import Result */}
            {importResult && (
                <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Import Result</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-emerald-400">{importResult.added}</p>
                            <p className="text-[10px] text-slate-400">Added</p>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-amber-400">{importResult.skipped}</p>
                            <p className="text-[10px] text-slate-400">Skipped</p>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                            <p className="text-lg font-bold text-slate-300">{importResult.totalRows}</p>
                            <p className="text-[10px] text-slate-400">Total</p>
                        </div>
                    </div>
                    {importResult.errors?.length > 0 && (
                        <details className="mt-1">
                            <summary className="text-[10px] text-slate-500 cursor-pointer">Show errors ({importResult.errors.length})</summary>
                            <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-red-400 space-y-0.5">
                                {importResult.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}
                            </div>
                        </details>
                    )}
                </div>
            )}

            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="text-emerald-400" size={16} />
                    <p className="text-emerald-400 text-sm">{success}</p>
                </div>
            )}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="text-red-400" size={16} />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Role Distribution */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {roleStats.map(r => (
                    <div key={r.value} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-white">{r.count}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{r.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('oc.settings.searchUsers')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50" />
            </div>

            {/* User List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-amber-500" size={28} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Users className="mx-auto text-slate-600 mb-3" size={40} />
                    <p className="text-slate-500 text-sm">{t('oc.settings.noUsers')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(u => (
                        <div key={u.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
                                ${u.status === 'ACTIVE' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-white">{u.name}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleColors[u.role] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                        {OC_ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                                    </span>
                                    {u.status === 'PENDING' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">
                                            Pending
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 truncate" dir="ltr">{u.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => handleToggleStatus(u.id, u.status)}
                                    title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                    className={`p-1.5 rounded-lg border text-xs transition-all
                                        ${statusColors[u.status] || 'bg-slate-500/10 border-slate-500/30 text-slate-400'}
                                        hover:opacity-80`}>
                                    {u.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                </button>
                                <button onClick={() => openEditModal(u)}
                                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 transition-all">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(u.id)}
                                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all">
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
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-white">
                                {editingUser ? 'Edit User' : 'Add User'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3" dir="ltr">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-xs flex items-center gap-2">
                                    <AlertCircle size={14} /> {error}
                                </div>
                            )}
                            <p className="text-amber-400/70 text-[10px]">⚠ All fields must be in English</p>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Enter full name (English only)"
                                    dir="ltr"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="user@company.com" dir="ltr"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Role *</label>
                                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50">
                                    {OC_ROLE_OPTIONS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number *</label>
                                <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                                    placeholder="+966500000000" dir="ltr" required
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowModal(false)}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm hover:bg-slate-700 transition-all">
                                    {t('common.cancel')}
                                </button>
                                <button onClick={handleSubmit} disabled={!form.name || !form.email}
                                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-all">
                                    {editingUser ? t('common.save') : t('oc.settings.create')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OCSettings;
