import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, ArrowLeft } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [step, setStep] = useState(1); // 1: Email, 2: OTP
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Vercel Deployment Trigger: 2026-02-07 14:15

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            console.log('Attempting to send OTP via API...');
            const response = await api.post('/auth/otp/request', { email });
            console.log('OTP Request Response:', response.data);

            // If we're in test mode, the backend sends the code back for convenience
            if (response.data.testCode) {
                console.log('TEST MODE: OTP Code is', response.data.testCode);
            }

            setStep(2);
        } catch (err: any) {
            console.error('Login Error:', err);
            const message = err.response?.data?.message || err.message || 'Failed to send code';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/auth/otp/verify', {
                email,
                otp,
            });

            if (data.token) {
                login(data.token, data);
                navigate('/dashboard');
            } else {
                throw new Error('No token received');
            }
        } catch (err: any) {
            console.error('Verify Error:', err);
            const message = err.response?.data?.message || err.message || 'Invalid code';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-12 w-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <ShieldCheck size={28} strokeWidth={2.5} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                    Incident Portal
                </h2>
                <p className="mt-2 text-center text-sm text-gray-500">
                    Sign in with your email
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-10 shadow-xl shadow-gray-100 rounded-2xl border border-gray-100">
                    {error && (
                        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2 border border-red-100 animate-pulse">
                            ⚠️ {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form className="space-y-6" onSubmit={handleSendOtp}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Sending Code...' : 'Send Login Code →'}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerifyOtp}>
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-2">We sent a verification code to</p>
                                <p className="font-medium text-gray-900">{email}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Verification Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    className="block w-full text-center py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-2xl tracking-[0.5em] font-mono transition-all"
                                    placeholder="• • • • • •"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Verify & Login'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-center text-sm text-gray-500 hover:text-emerald-600 font-medium"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <ArrowLeft size={16} /> Try different email
                                </div>
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
