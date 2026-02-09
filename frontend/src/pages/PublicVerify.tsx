import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, ShieldCheck, FileSearch } from 'lucide-react';

const PublicVerify = () => {
    const { token } = useParams();
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verify = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const response = await axios.get(`${apiUrl}/verify/${token}`);
                setResult(response.data);
            } catch (error) {
                setResult({ valid: false });
            } finally {
                setLoading(false);
            }
        };
        verify();
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <ShieldCheck size={64} className="mx-auto text-blue-600 mb-6 opacity-80" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Verification</h1>
                <p className="text-gray-500 mb-8">Incident System Official Verification Portal</p>

                {loading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </div>
                ) : result?.valid ? (
                    <div className="space-y-6">
                        <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center justify-center gap-3">
                            <CheckCircle size={24} />
                            <span className="font-bold">Verified Authentic Report</span>
                        </div>

                        <div className="divide-y divide-gray-100 text-left border rounded-xl overflow-hidden">
                            <div className="p-3 flex justify-between bg-gray-50">
                                <span className="text-gray-500 text-sm">Ticket No</span>
                                <span className="font-bold text-gray-900">{result.ticketNo}</span>
                            </div>
                            <div className="p-3 flex justify-between">
                                <span className="text-gray-500 text-sm">Type</span>
                                <span className="font-medium text-gray-800">{result.type}</span>
                            </div>
                            <div className="p-3 flex justify-between bg-gray-50">
                                <span className="text-gray-500 text-sm">Status</span>
                                <span className="text-xs font-bold uppercase tracking-wider">{result.status}</span>
                            </div>
                            <div className="p-3 flex justify-between">
                                <span className="text-gray-500 text-sm">Reporter</span>
                                <span className="font-medium text-gray-800">{result.reporter}</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-400">
                            Verification Hash: {token?.substring(0, 16)}...
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center justify-center gap-3">
                            <XCircle size={24} />
                            <span className="font-bold">Invalid or Expired Report</span>
                        </div>
                        <p className="text-sm text-gray-500">
                            The verification token provided does not match any official records in our system.
                        </p>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="text-blue-600 font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                    >
                        <FileSearch size={18} /> View Public Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublicVerify;
