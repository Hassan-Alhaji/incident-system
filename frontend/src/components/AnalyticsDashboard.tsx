import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, Clock, AlertTriangle, Users, MapPin, TrendingUp, ShieldAlert, HeartPulse, Shield, FileText, AlertOctagon, Target } from 'lucide-react';
import api from '../utils/api';

// Premium Color Palettes
const CATEGORY_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
const PRIORITY_COLORS: Record<string, string> = {
    'CRITICAL': '#ef4444',
    'HIGH': '#f97316',
    'MEDIUM': '#eab308',
    'LOW': '#22c55e',
    'NORMAL': '#3b82f6'
};

const AnalyticsDashboard = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;
        api.get('/analytics')
            .then(res => {
                if (isMounted) {
                    setData(res.data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    if (err.response?.status === 403) setError('UNAUTHORIZED');
                    else setError('Failed to load analytics');
                    setLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, []);

    if (loading) return (
        <div className="h-64 flex items-center justify-center bg-gray-50/50 rounded-2xl border border-gray-100 animate-pulse mb-8">
            <div className="text-emerald-500 font-medium flex items-center gap-2"><Activity className="animate-spin" /> Loading Live Telemetry...</div>
        </div>
    );
    if (error || !data) return null;

    // Formatting Helpers
    const formatDuration = (ms: number) => {
        if (!ms || ms <= 0) return '0m';
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    // Prepare Data
    const typeData = Object.keys(data.typeDistribution || {}).map(key => ({
        name: key, value: data.typeDistribution[key]
    })).filter(d => d.value > 0);

    const priorityData = Object.keys(data.priorityDistribution || {}).map(key => ({
        name: key, value: data.priorityDistribution[key]
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    // Calculate counts
    const escalatedCount = data.statusDistribution['ESCALATED'] || 0;
    const openCount = data.statusDistribution['OPEN'] || 0;

    // Custom Tooltip Formatter
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-xl text-sm border border-gray-700">
                    <p className="font-bold mb-1">{label || payload[0].name}</p>
                    <p className="text-emerald-400 font-medium">Count: {payload[0].value}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="mb-10 space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-700">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Telemetry Hub</h2>
                        <p className="text-sm font-medium text-gray-500 mt-0.5">Live operational statistics & metrics</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    LIVE SYNC
                </div>
            </div>
            
            {/* KPI Cards Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Activity size={100} /></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Session Incidents</p>
                        <p className="text-3xl font-black text-gray-900">{data.totalTickets}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center relative z-10 border border-blue-100">
                        <Target size={24} />
                    </div>
                </div>

                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><AlertTriangle size={100} /></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Action Required</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-gray-900">{openCount + escalatedCount}</p>
                            {escalatedCount > 0 && <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 rounded-full border border-orange-100">{escalatedCount} Escalated</span>}
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center relative z-10 border border-orange-100">
                        <ShieldAlert size={24} />
                    </div>
                </div>

                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between overflow-hidden relative border-b-4 border-b-red-500">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><HeartPulse size={100} /></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Medical</p>
                        <p className="text-3xl font-black text-gray-900">{formatDuration(data.averageClosureTimeMsByType['MEDICAL'])}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center relative z-10 border border-red-100">
                        <Clock size={24} />
                    </div>
                </div>

                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between overflow-hidden relative border-b-4 border-b-yellow-500">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Shield size={100} /></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Safety</p>
                        <p className="text-3xl font-black text-gray-900">{formatDuration(data.averageClosureTimeMsByType['SAFETY'])}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center relative z-10 border border-yellow-100">
                        <Activity size={24} />
                    </div>
                </div>
            </div>

            {/* Grid Layout for Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Category Distribution (Pie) */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><FileText size={16} /></div>
                        <h3 className="text-gray-900 font-bold tracking-tight">Category Distribution</h3>
                    </div>
                    <div className="flex-1 min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%" cy="50%"
                                    innerRadius={70} outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Metric */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                            <span className="text-3xl font-black text-gray-900 leading-none">{data.totalTickets}</span>
                            <span className="text-[10px] font-bold text-gray-400 tracking-widest mt-1">TOTAL</span>
                        </div>
                    </div>
                    {/* Compact Legend */}
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {typeData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}></span>
                                {entry.name.replace('_', ' ')}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Top Incident Hotspots (Map/Bar) */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm col-span-1 lg:col-span-2 flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-red-50 text-red-600"><MapPin size={16} /></div>
                            <h3 className="text-gray-900 font-bold tracking-tight">Incident Hotspots (Top Locations)</h3>
                        </div>
                    </div>
                    {data.topLocations && data.topLocations.length > 0 ? (
                        <div className="flex-1 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topLocations} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                                    <Bar dataKey="count" fill="url(#colorMap)" radius={[0, 8, 8, 0]} barSize={24} />
                                    <defs>
                                        <linearGradient id="colorMap" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#f87171" />
                                            <stop offset="100%" stopColor="#ef4444" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm font-medium text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            No location data mapped yet
                        </div>
                    )}
                </div>

                {/* 3. Priority Breakdown (Severity) */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600"><AlertOctagon size={16} /></div>
                        <h3 className="text-gray-900 font-bold tracking-tight">Severity Analysis</h3>
                    </div>
                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                        {priorityData.length > 0 ? priorityData.map(p => {
                            const widthPct = Math.max(10, Math.round((p.value / data.totalTickets) * 100));
                            const color = PRIORITY_COLORS[p.name] || PRIORITY_COLORS['NORMAL'];
                            return (
                                <div key={p.name} className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-gray-700">{p.name}</span>
                                        <span className="text-gray-500">{p.value} tickets ({widthPct}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className="h-2.5 rounded-full relative" 
                                            style={{ width: `${widthPct}%`, backgroundColor: color }}
                                        >
                                            <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center text-sm text-gray-400 font-medium">No priority data logged</div>
                        )}
                    </div>
                </div>

                {/* 4. Top Personnel (Active Marshals) */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm col-span-1 lg:col-span-2 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600"><Users size={16} /></div>
                        <h3 className="text-gray-900 font-bold tracking-tight">Top Field Operators</h3>
                    </div>
                    {data.topReporters && data.topReporters.length > 0 ? (
                        <div className="flex-1 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topReporters} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} dy={10} />
                                    <YAxis hide />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc', radius: 8}} />
                                    <Bar dataKey="count" fill="url(#colorUsers)" radius={[8, 8, 0, 0]} maxBarSize={60} label={{ position: 'top', fill: '#0f766e', fontSize: 12, fontWeight: 'bold' }}>
                                    </Bar>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#14b8a6" />
                                            <stop offset="100%" stopColor="#0f766e" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm font-medium text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            No operator data available
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default AnalyticsDashboard;
