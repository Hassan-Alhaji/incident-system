import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { ShieldAlert, CheckCircle, Save } from 'lucide-react';

const OnboardingModal = () => {
    const { user, login, token } = useAuth();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        mobile: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!user || user.isProfileCompleted) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        const englishRegex = /^[A-Za-z\s]+$/;
        // Mobile must start with 00 or + and be followed by digits
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
        setError('');

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            const res = await api.put('/users/profile', formData);
            if (res.data.user && token) {
                // Update local context with new user data
                login(token, res.data.user);
                // Redirect logic is handled by the fact that the modal disappears when isProfileCompleted becomes true
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
                <div className="bg-emerald-600 p-6 text-white text-center">
                    <ShieldAlert size={48} className="mx-auto mb-3 opacity-90" />
                    <h2 className="text-2xl font-bold">Complete Your Profile</h2>
                    <p className="text-emerald-100 mt-2">Required for Security & Identification</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100">
                        <p className="font-bold mb-1">Welcome, {user.name}!</p>
                        Please provide your official details to proceed. Names must be in English.
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                                <input
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border"
                                    placeholder="English only"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                                <input
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border"
                                    placeholder="English only"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number <span className="text-red-500">*</span></label>
                            <input
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border"
                                placeholder="00966..."
                            />
                            <p className="text-xs text-gray-400 mt-1">Start with country code (e.g. 00966 or +1...)</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Saving...' : (
                                <>
                                    <Save size={20} />
                                    Save & Continue
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
