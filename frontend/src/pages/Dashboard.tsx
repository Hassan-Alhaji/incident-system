import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Filter, Search, Clock, CheckCircle2, AlertCircle, MoreHorizontal, TrendingUp, PieChart as PieIcon, Download, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

interface Ticket {
 id: string;
 ticketNo: string;
 type: string;
 status: string;
 priority: string;
 eventName: string;
 createdAt: string;
 createdBy: { name: string };
 description: string;
 closedAt?: string;
 updatedAt: string;
}

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981'];

const ExportSection = () => {
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [downloading, setDownloading] = useState(false);

 const handleDownload = async () => {
 if (!startDate || !endDate) return alert('Please select a date range.');

 setDownloading(true);
 try {
 const response = await api.get(`/tickets/export-excel`, {
 params: { startDate, endDate },
 responseType: 'blob' // Important: Expect binary data
 });

 // Create blob link to download
 const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
 const link = document.createElement('a');
 link.href = url;
 const contentDisposition = response.headers['content-disposition'];
 let fileName = `tickets_export.xlsx`;
 if (contentDisposition) {
 const fileNameMatch = contentDisposition.match(/filename=(.+)/);
 if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
 }
 link.setAttribute('download', fileName);
 document.body.appendChild(link);
 link.click();
 link.parentNode?.removeChild(link);
 } catch (err: any) {
 console.error(err);
 let message = 'Export failed.';
 if (err?.response && err.response.data instanceof Blob) {
 try {
 const errorText = await err.response.data.text();
 const errorJson = JSON.parse(errorText);
 if (errorJson.message) message = `Export Failed: ${errorJson.message}`;
 } catch (e) { /* Blob was not JSON text */ }
 } else if (err?.message) {
 message = `Export Failed: ${err.message}`;
 }
 alert(message);
 } finally {
 setDownloading(false);
 }
 };

 return (
 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 shadow-sm mb-8 flex flex-wrap items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="bg-green-100 p-2 rounded-lg text-green-700">
 <FileSpreadsheet size={20} />
 </div>
 <div>
 <h3 className="font-bold text-gray-900 text-base">Export Data</h3>
 <p className="text-base text-gray-500">Download Excel report</p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <div>
 <input
 type="date"
 className="border border-gray-300 rounded-lg px-3 py-1.5 text-base focus:ring-2 focus:ring-blue-400 outline-none"
 value={startDate}
 onChange={e => setStartDate(e.target.value)}
 />
 </div>
 <span className="text-gray-400 text-base">-</span>
 <div>
 <input
 type="date"
 className="border border-gray-300 rounded-lg px-3 py-1.5 text-base focus:ring-2 focus:ring-blue-400 outline-none"
 value={endDate}
 onChange={e => setEndDate(e.target.value)}
 />
 </div>
 <button
 onClick={handleDownload}
 disabled={downloading}
 className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-base font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:bg-gray-400 transition-colors shadow-sm shadow-emerald-200"
 >
 {downloading ? '...' : <><Download size={14} /> Export</>}
 </button>
 </div>
 </div>
 );
};

const Dashboard = () => {
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [loading, setLoading] = useState(true);
 const [trendData, setTrendData] = useState<any[]>([]);
 const [typeData, setTypeData] = useState<any[]>([]);

 const [searchQuery, setSearchQuery] = useState('');
 const [filterDate, setFilterDate] = useState('');
 const [filterEvent, setFilterEvent] = useState('');
 const [filterDept, setFilterDept] = useState('');
 const [filterStatus, setFilterStatus] = useState('');

 const { user } = useAuth();
 const navigate = useNavigate();

 useEffect(() => {
 const fetchTickets = async () => {
 try {
 const response = await api.get('/tickets');
 const fetchedTickets = response.data;
 setTickets(fetchedTickets);

 // Process Trend Data (Last 7 Days)
 const last7Days = [...Array(7)].map((_, i) => {
 const d = new Date();
 d.setDate(d.getDate() - i);
 return d.toISOString().split('T')[0];
 }).reverse();

 const trend = last7Days.map(date => ({
 date: date.substring(5),
 count: fetchedTickets.filter((t: Ticket) => t.createdAt.startsWith(date)).length
 }));
 setTrendData(trend);

 // Process Type Data
 const types = ['MEDICAL', 'SAFETY', 'SPORT'];
 const typeStats = types.map(type => ({
 name: type,
 value: fetchedTickets.filter((t: Ticket) => t.type === type).length
 })).filter(item => item.value > 0);
 setTypeData(typeStats);

 } catch (error) {
 console.error('Error fetching tickets:', error);
 } finally {
 setLoading(false);
 }
 };
 fetchTickets();
 }, []);

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'OPEN': return 'bg-emerald-100 text-emerald-700';
 case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-700';
 case 'ESCALATED': return 'bg-orange-100 text-orange-700';
 case 'RESOLVED': return 'bg-emerald-100 text-emerald-700'; // Resolved can be blue or gray
 case 'CLOSED': return 'bg-gray-100 text-gray-700';
 default: return 'bg-gray-100 text-gray-700';
 }
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case 'CRITICAL': return 'text-red-600';
 case 'HIGH': return 'text-orange-600';
 case 'MEDIUM': return 'text-yellow-600';
 default: return 'text-emerald-600';
 }
 };

 // Role based visibility
 const isMarshal = user?.role?.includes('MARSHAL'); // Simple check, or list specific roles

 // Only ADMIN and COC see full statistics
 const canViewStats = user?.role === 'ADMIN' || user?.role === 'CHIEF_OF_CONTROL';
 const canViewAnalytics = user?.role === 'ADMIN' || user?.canViewAnalytics;

 return (
 <div className="space-y-8 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex justify-between items-center">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Incident Dashboard</h1>
 <p className="text-gray-500 mt-1">Overview of event incidents and reports</p>
 </div>
 <div className="flex gap-4">
 {!isMarshal && (
 <button
 onClick={() => navigate('/tickets/new')}
 className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:scale-105 transition-all flex items-center gap-2"
 >
 <Plus size={20} /> New Incident
 </button>
 )}
 </div>
 </div>

 {/* Premium Analytics Dashboard */}
 {canViewAnalytics && <AnalyticsDashboard />}

 {/* Stats Cards - Restrict Visibility */}
 {canViewStats && (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 {[
 { label: 'Open', count: tickets.filter(t => t.status === 'OPEN').length, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'Reviewing', count: tickets.filter(t => t.status === 'ESCALATED').length, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
 { label: 'Closed', count: tickets.filter(t => t.status === 'CLOSED').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
 { label: 'Total', count: tickets.length, icon: MoreHorizontal, color: 'text-purple-600', bg: 'bg-purple-50' }
 ].map((stat, i) => (
 <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
 <div className={`${stat.bg} p-4 rounded-xl shadow-sm ${stat.color} shadow-sm`}>
 <stat.icon size={28} />
 </div>
 <div>
 <p className="text-base font-medium text-gray-500">{stat.label}</p>
 <p className="text-3xl font-bold text-gray-900">{stat.count}</p>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Charts Section - Restrict Visibility */}
 {canViewStats && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Trend Chart */}
 <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
 <div className="flex items-center gap-2 mb-6">
 <TrendingUp className="text-gray-400" size={20} />
 <h3 className="font-bold text-gray-900">Incident Trend (7 Days)</h3>
 </div>
 <div className="h-64 pl-0">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={trendData}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
 <Tooltip
 contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
 cursor={{ fill: '#F3F4F6' }}
 />
 <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={50} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Distribution Chart */}
 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
 <div className="flex items-center gap-2 mb-6">
 <PieIcon className="text-gray-400" size={20} />
 <h3 className="font-bold text-gray-900">Type Distribution</h3>
 </div>
 <div className="h-64 relative">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={typeData}
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {typeData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
 </PieChart>
 </ResponsiveContainer>
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <div className="text-center">
 <span className="block text-3xl font-bold text-gray-900">{tickets.length}</span>
 <span className="text-base text-gray-500 uppercase font-bold tracking-wider">Total</span>
 </div>
 </div>
 </div>
 <div className="flex justify-center gap-4 flex-wrap mt-4">
 {typeData.map((entry, index) => (
 <div key={index} className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
 <span className="text-base text-gray-600 font-medium">{entry.name}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Admin Export Section (Compact) */}
 {(user?.role === 'ADMIN' || user?.role === 'CHIEF_OF_CONTROL') && <ExportSection />}

 {/* Filters & Search */}
 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
 <div className="relative flex-1 w-full md:w-auto min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
 <input
 type="text"
 placeholder="Search Ticket No..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 font-medium text-base"
 />
 </div>
 
 <input 
 type="date" 
 value={filterDate}
 onChange={(e) => setFilterDate(e.target.value)}
 className="border border-gray-200 bg-gray-50 rounded-xl shadow-sm px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 font-medium"
 />

 <select 
 value={filterEvent}
 onChange={(e) => setFilterEvent(e.target.value)}
 className="border border-gray-200 bg-gray-50 rounded-xl shadow-sm px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 font-medium"
 >
 <option value="">All Events</option>
 {Array.from(new Set(tickets.map(t => t.eventName))).map((event: any) => (
 <option key={event} value={event}>{event}</option>
 ))}
 </select>

 <select 
 value={filterDept}
 onChange={(e) => setFilterDept(e.target.value)}
 className="border border-gray-200 bg-gray-50 rounded-xl shadow-sm px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 font-medium capitalize"
 >
 <option value="">All Departments</option>
 <option value="MEDICAL">Medical</option>
 <option value="SAFETY">Safety</option>
 <option value="SPORT">Sport</option>
 <option value="OFF_CIRCUIT">Off-Circuit</option>
 </select>

 <select 
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="border border-gray-200 bg-gray-50 rounded-xl shadow-sm px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 font-medium"
 >
 <option value="">All Status</option>
 <option value="OPEN">Open</option>
 <option value="ESCALATED">Escalated</option>
 <option value="UNDER_REVIEW">Under Review</option>
 <option value="CLOSED">Closed</option>
 <option value="RESOLVED">Resolved</option>
 <option value="REOPENED">Reopened</option>
 </select>

 <button 
 onClick={() => {
 setSearchQuery('');
 setFilterDate('');
 setFilterEvent('');
 setFilterDept('');
 setFilterStatus('');
 }}
 className="flex items-center gap-2 text-gray-500 border border-gray-200 px-5 py-3 rounded-xl shadow-sm hover:bg-gray-50 transition-colors font-medium text-base"
 >
 <Filter size={18} />
 Clear Filters
 </button>
 </div>

 {/* Tickets Table & Mobile List */}
 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
 {/* Desktop Table View */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-gray-50/50 border-b border-gray-100">
 <tr>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider">Ticket Info</th>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider">Type</th>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider">Status</th>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider">Subject / Detail</th>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider">Priority</th>
 <th className="px-6 py-4 text-base font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 text-base">
 {loading ? (
 <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading tickets...</td></tr>
 ) : tickets.length === 0 ? (
 <tr><td colSpan={6} className="text-center py-12 text-gray-500">No tickets found</td></tr>
 ) : (
 tickets.filter(t => {
 if (searchQuery && !t.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 if (filterDate && !t.createdAt.startsWith(filterDate)) return false;
 if (filterEvent && t.eventName !== filterEvent) return false;
 if (filterDept && t.type !== filterDept) return false;
 if (filterStatus && t.status !== filterStatus) return false;
 return true;
 }).map((ticket: any) => {
 // Calculate Time Elapsed
 let elapsedTimeStr = '-';
 if (ticket.status === 'CLOSED' && ticket.closedAt) {
 const created = new Date(ticket.createdAt).getTime();
 const closed = new Date(ticket.closedAt).getTime();
 const diffMins = Math.round((closed - created) / 60000);
 if (diffMins < 60) elapsedTimeStr = `${diffMins} mins`;
 else if (diffMins < 1440) elapsedTimeStr = `${(diffMins/60).toFixed(1)} hrs`;
 else elapsedTimeStr = `${(diffMins/1440).toFixed(1)} days`;
 }

 return (
 <tr
 key={ticket.id}
 className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
 onClick={() => navigate(`/tickets/${ticket.id}`)}
 >
 <td className="px-6 py-4">
 <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{ticket.ticketNo}</div>
 <div className="text-gray-500 text-base mt-0.5">{new Date(ticket.createdAt).toLocaleDateString('en-US')} • {ticket.eventName}</div>
 </td>
 <td className="px-6 py-4">
 <span className="font-medium bg-gray-100 px-2 py-1 rounded text-base text-gray-600 border border-gray-200">{ticket.type}</span>
 </td>
 <td className="px-6 py-4">
 <span className={`px-2.5 py-1 rounded-full text-base font-bold border ${getStatusColor(ticket.status).replace('bg-', 'border-').replace('text-', 'text-').replace('100', '200') + ' ' + getStatusColor(ticket.status)} whitespace-nowrap`}>
 {ticket.status.replace('_', ' ')}
 </span>
 </td>
 <td className="px-6 py-4">
 {/* Dynamic Content based on Type */}
 {ticket.type === 'SPORT' && ticket.controlReport ? (
 <div>
 <div className="font-bold text-gray-900">Car #{ticket.controlReport.competitorNumber || 'N/A'}</div>
 <div className="text-base text-red-500 font-medium">{ticket.controlReport.violationType}</div>
 </div>
 ) : ticket.type === 'MEDICAL' && ticket.medicalReport ? (
 <div>
 <div className="font-bold text-gray-900">{ticket.medicalReport.patientName || 'Unknown Patient'}</div>
 <div className="text-base text-red-500 font-medium">{ticket.medicalReport.injuryType}</div>
 </div>
 ) : ticket.type === 'SAFETY' && ticket.safetyReport ? (
 <div>
 <div className="font-bold text-gray-900">{ticket.safetyReport.hazardType}</div>
 <div className="text-base text-gray-500">{ticket.safetyReport.locationDetail || ticket.location}</div>
 </div>
 ) : (
 <div className="text-gray-400 text-base italic">No specific details</div>
 )}
 </td>
 <td className="px-6 py-4 font-bold">
 <span className={getPriorityColor(ticket.priority)}>{ticket.priority}</span>
 </td>
 <td className="px-6 py-4 text-right text-gray-400 group-hover:text-blue-600 font-medium transition-colors">
 View Details &rarr;
 {elapsedTimeStr !== '-' && (
 <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-end gap-1">
 <Clock size={10} /> Time: {elapsedTimeStr}
 </div>
 )}
 </td>
 </tr>
 )})
 )}
 </tbody>
 </table>
 </div>

 {/* Mobile Card View */}
 <div className="md:hidden divide-y divide-gray-100">
 {loading ? (
 <div className="p-12 text-center text-gray-500">Loading tickets...</div>
 ) : tickets.length === 0 ? (
 <div className="p-12 text-center text-gray-500">No tickets found</div>
 ) : (
 tickets.filter(t => {
 if (searchQuery && !t.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 if (filterDate && !t.createdAt.startsWith(filterDate)) return false;
 if (filterEvent && t.eventName !== filterEvent) return false;
 if (filterDept && t.type !== filterDept) return false;
 if (filterStatus && t.status !== filterStatus) return false;
 return true;
 }).map((ticket: any) => {
 return (
 <div
 key={ticket.id}
 className="p-5 hover:bg-blue-50/30 transition-colors active:bg-blue-100 cursor-pointer flex flex-col gap-4"
 onClick={() => navigate(`/tickets/${ticket.id}`)}
 >
 <div className="flex justify-between items-start gap-2">
 <div>
 <div className="font-bold text-gray-900 text-lg">{ticket.ticketNo}</div>
 <div className="text-gray-500 text-sm mt-1">{new Date(ticket.createdAt).toLocaleDateString('en-US')} • {ticket.eventName}</div>
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status).replace('bg-', 'border-').replace('text-', 'text-').replace('100', '200') + ' ' + getStatusColor(ticket.status)} whitespace-nowrap`}>
 {ticket.status.replace('_', ' ')}
 </span>
 </div>
 
 <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
 {ticket.type === 'SPORT' && ticket.controlReport ? (
 <div>
 <div className="font-bold text-gray-900 text-sm">Car #{ticket.controlReport.competitorNumber || 'N/A'}</div>
 <div className="text-sm text-red-500 font-medium mt-1">{ticket.controlReport.violationType}</div>
 </div>
 ) : ticket.type === 'MEDICAL' && ticket.medicalReport ? (
 <div>
 <div className="font-bold text-gray-900 text-sm">{ticket.medicalReport.patientName || 'Unknown Patient'}</div>
 <div className="text-sm text-red-500 font-medium mt-1">{ticket.medicalReport.injuryType}</div>
 </div>
 ) : ticket.type === 'SAFETY' && ticket.safetyReport ? (
 <div>
 <div className="font-bold text-gray-900 text-sm">{ticket.safetyReport.hazardType}</div>
 <div className="text-sm text-gray-500 mt-1">{ticket.safetyReport.locationDetail || ticket.location}</div>
 </div>
 ) : (
 <div className="text-gray-400 text-sm italic">No specific details</div>
 )}
 </div>
 
 <div className="flex justify-between items-center mt-1">
 <span className="font-bold bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-600 border border-gray-200">{ticket.type}</span>
 <span className={`text-base font-bold ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 </div>
 );
};

export default Dashboard;
