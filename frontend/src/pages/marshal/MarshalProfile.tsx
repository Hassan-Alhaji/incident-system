import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { ArrowLeft, Save, User, Mail, Phone, Hash, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MarshalProfile = () => {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Initial State using separate fields if available, else split name
    const [formData, setFormData] = useState({
        firstName: user?.firstName || user?.name?.split(' ')[0] || '',
        lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
        mobile: user?.mobile || '',
    });

    const validate = () => {
        const englishRegex = /^[A-Za-z\s]+$/;
        const mobileRegex = /^(00|\+)\d+$/;

        if (!formData.firstName || !englishRegex.test(formData.firstName)) {
            return "First Name must be English characters only.";
        }
        if (!formData.lastName || !englishRegex.test(formData.lastName)) {
            return "Last Name must be English characters only.";
        }
        if (!formData.mobile || !mobileRegex.test(formData.mobile)) {
            return "Mobile must start with a country code (e.g. 00966...)";
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMsg({ type: '', text: '' });

        const error = validate();
        if (error) {
            setMsg({ type: 'error', text: error });
            setIsSaving(false);
            return;
        }

        try {
            const res = await api.put('/users/profile', formData);
            if (user && res.data.user) {
                const token = localStorage.getItem('token');
                if (token) login(token, res.data.user);
            }
            setMsg({ type: 'success', text: 'Profile updated successfully' });
        } catch (error: any) {
            console.error(error);
            setMsg({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800">
                <ArrowLeft size={18} className="mr-1" /> Back
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 p-6 text-white flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
                        {user.firstName?.charAt(0) || user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">My Profile</h1>
                        <p className="text-blue-100 opacity-90">{user.role?.replace(/_/g, ' ')}</p>
                    </div>
                </div>

                <div className="p-6">
                    {msg.text && (
                        <div className={`p-4 rounded-lg mb-6 ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {msg.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Read Only Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                    <Hash size={12} /> Marshal ID
                                </label>
                                <div className="font-mono text-gray-700 font-medium">
                                    {user.marshalId || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                    <Shield size={12} /> Role
                                </label>
                                <div className="font-mono text-gray-700 font-medium">
                                    {user.role?.replace(/_/g, ' ')}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                    <Mail size={12} /> Email
                                </label>
                                <div className="font-mono text-gray-700 font-medium truncate">
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        {/* Editable Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <User size={16} /> First Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                />
                                <p className="text-xs text-gray-400 mt-1">English characters only</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <User size={16} /> Last Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                />
                                <p className="text-xs text-gray-400 mt-1">English characters only</p>
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <Phone size={16} /> Mobile Number
                                </label>
                                <input
                                    type="tel"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={formData.mobile}
                                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                    placeholder="00966..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MarshalProfile;
