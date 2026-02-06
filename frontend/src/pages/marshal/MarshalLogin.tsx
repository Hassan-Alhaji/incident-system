import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const MarshalLogin = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [step, setStep] = useState(1); // 1: Email, 2: OTP
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/auth/otp/request', { email });
            setStep(2);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/otp/verify', { email, otp });
            login(res.data.token, res.data);
            navigate('/marshal/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                    Marshal Portal
                </h2>
                <p className="mt-2 text-center text-sm text-gray-400">
                    {step === 1 ? 'Enter your email to login' : 'Verification Code Sent'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form className="space-y-6" onSubmit={handleSendOtp}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                {loading ? 'Sending...' : 'Send Login Code'}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerifyOtp}>
                            <div className="text-center mb-4 text-sm text-gray-500">
                                Enter the code sent to {email}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={4}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 text-center text-2xl tracking-widest"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                {loading ? 'Verifying...' : 'Login'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-center text-sm text-gray-600 hover:text-gray-900"
                            >
                                Back
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarshalLogin;
