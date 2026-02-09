
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, User, Shield, AlertCircle, FileText,
    History, Paperclip, ExternalLink, Send, Activity, X, Download, Loader2
} from 'lucide-react';

interface Ticket {
    id: string;
    ticketNo: string;
    type: string;
    status: string;
    priority: string;
    eventName: string;
    venue: string;
    dateTime: string;
    location: string;
    description: string;
    drivers: string;
    witnesses: string;
    createdAt: string;
    createdBy: { name: string; role: string };
    assignedToId?: string | null;
    escalatedToRole?: string | null; // Add this
    activityLogs: any[];
    attachments?: any[];
    medicalReport?: any;
    pitGridReport?: any;
}

const TicketDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('summary');
    const [comment, setComment] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [showEscalationModal, setShowEscalationModal] = useState(false);
    const [escalationForm, setEscalationForm] = useState({ toRole: 'MEDICAL', reason: '', notes: '' });

    const handleEscalate = async () => {
        try {
            await api.post(`/tickets/${id}/escalate`, escalationForm);
            alert('Ticket Escalated Successfully');
            setShowEscalationModal(false);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            alert('Escalation failed');
        }
    };

    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const response = await api.post(`/tickets/${id}/export-pdf`, {}, {
                responseType: 'blob' // Important: Expect binary data
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `report-${ticket?.ticketNo || 'incident'}.pdf`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename=(.+)/);
                if (fileNameMatch.length === 2) fileName = fileNameMatch[1];
            }
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err: any) {
            console.error('Export error:', err);
            let message = 'Export failed. Please try again.';

            if (err.response && err.response.data instanceof Blob) {
                try {
                    const errorText = await err.response.data.text();
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.message) message = `Export Failed: ${errorJson.message}`;
                } catch (e) {
                    // Blob was not JSON text
                }
            } else if (err.message) {
                message = `Export Failed: ${err.message}`;
            }

            alert(message);
        } finally {
            setIsExporting(false);
        }
    };
    // ... (existing code) ...


    const [showMedicalModal, setShowMedicalModal] = useState(false);
    const [medicalForm, setMedicalForm] = useState({ summary: '', recommendation: '', licenseAction: 'NONE' });

    const handleSubmitMedical = async () => {
        try {
            await api.post(`/tickets/${id}/medical-report`, medicalForm);
            alert('Medical Report Submitted');
            setShowMedicalModal(false);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Failed to submit report');
        }
    };

    const handleSendAction = async () => {
        if (!comment.trim() && files.length === 0) return;
        setIsSending(true);
        try {
            // 1. Send Comment
            if (comment.trim()) {
                await api.post(`/tickets/${id}/comments`, { text: comment });
            }

            // 2. Upload Files
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));
                await api.post(`/tickets/${id}/attachments`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setComment('');
            setFiles([]);

            // Refresh ticket data
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
            setActiveTab('timeline');

        } catch (err) {
            console.error(err);
            alert('Failed to send update');
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        const fetchTicket = async () => {
            try {
                const response = await api.get(`/tickets/${id}`);
                setTicket(response.data);
            } catch (error) {
                console.error('Error fetching ticket:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTicket();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading ticket details...</div>;
    if (!ticket) return <div className="p-8 text-center">Ticket not found</div>;

    const drivers = JSON.parse(ticket.drivers || '[]');
    const witnesses = JSON.parse(ticket.witnesses || '[]');
    const medicalReport = ticket.medicalReport;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-emerald-100 text-emerald-700';
            case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-700';
            case 'ESCALATED': return 'bg-orange-100 text-orange-700';
            case 'AWAITING_MEDICAL': return 'bg-red-100 text-red-700';
            case 'AWAITING_DECISION': return 'bg-purple-100 text-purple-700';
            case 'RESOLVED': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const tabs = ['summary', 'timeline', 'attachments'];
    if (user?.role === 'ADMIN' || user?.role === 'MEDICAL') {
        tabs.push('medical');
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Medical Modal */}
            {showMedicalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Activity size={20} className="text-red-600" /> Medical Assessment
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Clinical Summary</label>
                                <textarea
                                    className="w-full border rounded-lg p-2 h-24"
                                    value={medicalForm.summary}
                                    onChange={(e) => setMedicalForm({ ...medicalForm, summary: e.target.value })}
                                    placeholder="Describe injuries and condition..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Treatment Recommendation</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2"
                                    value={medicalForm.recommendation}
                                    onChange={(e) => setMedicalForm({ ...medicalForm, recommendation: e.target.value })}
                                    placeholder="e.g. Hospital transfer, On-site treatment"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Driver License Action</label>
                                <select
                                    className="w-full border rounded-lg p-2"
                                    value={medicalForm.licenseAction}
                                    onChange={(e) => setMedicalForm({ ...medicalForm, licenseAction: e.target.value })}
                                >
                                    <option value="NONE">No Action</option>
                                    <option value="SUSPEND">Suspend License (Unfit)</option>
                                    <option value="CLEAR">Clear (Fit to Race)</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowMedicalModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                                <button onClick={handleSubmitMedical} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Submit Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Escalation Modal */}
            {showEscalationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Escalate Ticket</h2>
                        <div className="space-y-4 text-sm">
                            <div>
                                <label className="block font-medium mb-1">Escalate To</label>
                                <select
                                    className="w-full border rounded-lg p-2"
                                    value={escalationForm.toRole}
                                    onChange={(e) => setEscalationForm({ ...escalationForm, toRole: e.target.value })}
                                >
                                    <option value="">Select Department/Role</option>
                                    {(() => {
                                        let options: { value: string, label: string }[] = [];

                                        if (user?.role === 'ADMIN') {
                                            options = [
                                                { value: 'MEDICAL_OP_TEAM', label: 'Medical Department' },
                                                { value: 'CONTROL_OP_TEAM', label: 'Sporting Department' }, // Mapped to Control
                                                { value: 'SAFETY_OP_TEAM', label: 'Safety Department' },
                                                { value: 'SCRUTINEERS', label: 'Stewards' }, // Mapping 'Stewards' to Scrutineers (Tech)
                                                { value: 'JUDGEMENT', label: 'Judges' }
                                            ];
                                        } else {
                                            // Matrix Logic mirroring Backend
                                            switch (user?.role) {
                                                // Medical
                                                case 'MEDICAL_OP_TEAM':
                                                    options = [
                                                        { value: 'DEPUTY_MEDICAL_OFFICER', label: 'Deputy Medical Officer' },
                                                        { value: 'CHIEF_MEDICAL_OFFICER', label: 'Chief Medical Officer' },
                                                        { value: 'SAFETY_OP_TEAM', label: 'Safety Department' },
                                                        { value: 'CONTROL_OP_TEAM', label: 'Sporting/Control Department' }
                                                    ];
                                                    break;
                                                case 'DEPUTY_MEDICAL_OFFICER':
                                                    options = [{ value: 'CHIEF_MEDICAL_OFFICER', label: 'Chief Medical Officer' }];
                                                    break;

                                                // Safety
                                                case 'SAFETY_OP_TEAM':
                                                    options = [
                                                        { value: 'DEPUTY_SAFETY_OFFICER', label: 'Deputy Safety Officer' },
                                                        { value: 'SAFETY_OFFICER_CHIEF', label: 'Chief Safety Officer' },
                                                        { value: 'MEDICAL_OP_TEAM', label: 'Medical Department' },
                                                        { value: 'CONTROL_OP_TEAM', label: 'Sporting/Control Department' }
                                                    ];
                                                    break;
                                                case 'DEPUTY_SAFETY_OFFICER':
                                                    options = [{ value: 'SAFETY_OFFICER_CHIEF', label: 'Chief Safety Officer' }];
                                                    break;

                                                // Control / Sport
                                                case 'CONTROL_OP_TEAM':
                                                    options = [
                                                        { value: 'CHIEF_OF_CONTROL', label: 'Chief of Control' },
                                                        { value: 'DEPUTY_CONTROL_OP_OFFICER', label: 'Deputy Control Officer' },
                                                        { value: 'MEDICAL_OP_TEAM', label: 'Medical Department' },
                                                        { value: 'SAFETY_OP_TEAM', label: 'Safety Department' }
                                                    ];
                                                    break;
                                                case 'DEPUTY_CONTROL_OP_OFFICER':
                                                case 'CHIEF_OF_CONTROL':
                                                    options = [
                                                        { value: 'MEDICAL_OP_TEAM', label: 'Medical Department' },
                                                        { value: 'SAFETY_OP_TEAM', label: 'Safety Department' },
                                                        { value: 'SCRUTINEERS', label: 'Stewards/Scrutineers' },
                                                        { value: 'JUDGEMENT', label: 'Judges' },
                                                        ...(user.role === 'DEPUTY_CONTROL_OP_OFFICER' ? [{ value: 'CHIEF_OF_CONTROL', label: 'Chief of Control' }] : [])
                                                    ];
                                                    break;
                                                default:
                                                    options = [];
                                                    break;
                                            }
                                        }

                                        return options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ));
                                    })()}
                                </select>
                            </div>
                            <div>
                                <label className="block font-medium mb-1">Reason for Escalation</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2"
                                    placeholder="e.g. Needs medical review"
                                    value={escalationForm.reason}
                                    onChange={(e) => setEscalationForm({ ...escalationForm, reason: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block font-medium mb-1">Additional Notes</label>
                                <textarea
                                    className="w-full border rounded-lg p-2 h-24"
                                    value={escalationForm.notes}
                                    onChange={(e) => setEscalationForm({ ...escalationForm, notes: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowEscalationModal(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEscalate}
                                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                                >
                                    Confirm Escalation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-full md:w-auto justify-center md:justify-start">
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </button>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all shadow-sm
                            ${isExporting
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-95'
                            }`}
                    >
                        {isExporting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Download size={16} />
                        )}
                        {isExporting ? 'Generating...' : 'Download Report'}
                    </button>


                    {/* Escalation (Admin/Ops/Medical/Safety/Control) */}
                    {(() => {
                        if (!user) return null;
                        if (ticket.status === 'DRAFT') return null;

                        const canEscalateRole = ['ADMIN', 'MEDICAL_OP_TEAM', 'SAFETY_OP_TEAM', 'CONTROL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'DEPUTY_SAFETY_OFFICER', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'SAFETY_OFFICER_CHIEF', 'CHIEF_OF_CONTROL', 'SCRUTINEERS', 'JUDGEMENT'].includes(user.role);

                        if (!canEscalateRole) return null;

                        // Admin override
                        if (user.role === 'ADMIN') {
                            return (
                                <button
                                    onClick={() => setShowEscalationModal(true)}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
                                >
                                    Escalate
                                </button>
                            );
                        }

                        // Others: Logic for Escalated Tickets
                        if (ticket.status === 'ESCALATED') {
                            // Check if escalated TO ME or MY DEPT
                            const isMyEscalation =
                                (ticket.escalatedToRole === user.role) ||
                                (ticket.escalatedToRole === 'MEDICAL_OP_TEAM' && ['MEDICAL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER'].includes(user.role)) ||
                                (ticket.escalatedToRole === 'SAFETY_OP_TEAM' && ['SAFETY_OP_TEAM', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF'].includes(user.role)) ||
                                (ticket.escalatedToRole === 'CONTROL_OP_TEAM' && ['CONTROL_OP_TEAM', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL'].includes(user.role));

                            if (!isMyEscalation) return null;
                        } else {
                            if (ticket.assignedToId && ticket.assignedToId !== user.id) return null;
                        }

                        return (
                            <button
                                onClick={() => setShowEscalationModal(true)}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
                            >
                                Escalate
                            </button>
                        );
                    })()}

                    {/* Transfer/Return (Scrutineers/Judgement) */}
                    {user && ['SCRUTINEERS', 'JUDGEMENT'].includes(user.role) && (
                        <>
                            <button
                                onClick={async () => {
                                    const notes = prompt("Notes for transfer:");
                                    if (notes === null) return;
                                    const target = user.role === 'SCRUTINEERS' ? 'JUDGEMENT' : 'SCRUTINEERS';
                                    try {
                                        // Need a distinct User ID ideally, but for MVP we might need a workaround or specific input. 
                                        // For now, using a placeholder logic or assuming backend handles 'pool' if assignedToId missing?
                                        // Backend requires assignedToId.
                                        const targetId = prompt(`Enter User ID for ${target}:`);
                                        if (!targetId) return;

                                        await api.post(`/tickets/${id}/transfer`, { toRole: target, notes, assignedToId: targetId });
                                        window.location.reload();
                                    } catch (e) { alert('Failed to transfer'); }
                                }}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
                            >
                                Transfer
                            </button>
                            <button
                                onClick={async () => {
                                    const notes = prompt("Notes for return:");
                                    if (notes === null) return;
                                    const targetId = prompt(`Enter Control Officer ID to return to:`);
                                    if (!targetId) return;

                                    try {
                                        await api.post(`/tickets/${id}/return`, { notes, assignedToId: targetId });
                                        window.location.reload();
                                    } catch (e) { alert('Failed to return'); }
                                }}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm font-medium"
                            >
                                Return to Control
                            </button>
                        </>
                    )}

                    {/* Close (Allowed roles) */}
                    {(() => {
                        if (!user) return null;
                        if (ticket.status === 'CLOSED') return null;

                        const canCloseRole = ['DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL', 'SCRUTINEERS', 'JUDGEMENT', 'ADMIN'].includes(user.role);

                        if (!canCloseRole) return null;

                        // Super Closer Override (Admin + Chiefs + Deputies)
                        // Allow them to close ANY ticket they have access to view, bypassing assignment
                        const isSuperCloser = ['ADMIN',
                            'CHIEF_OF_CONTROL', 'DEPUTY_CONTROL_OP_OFFICER',
                            'CHIEF_MEDICAL_OFFICER', 'DEPUTY_MEDICAL_OFFICER',
                            'SAFETY_OFFICER_CHIEF', 'DEPUTY_SAFETY_OFFICER'
                        ].includes(user.role);

                        if (isSuperCloser) {
                            return (
                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to close this ticket?')) {
                                            try {
                                                await api.post(`/tickets/${id}/close`);
                                                window.location.reload();
                                            } catch (e) { alert('Failed to close'); }
                                        }
                                    }}
                                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2 text-sm font-medium"
                                >
                                    Close Ticket
                                </button>
                            );
                        }

                        // Others: Logic for Escalated Tickets
                        if (ticket.status === 'ESCALATED') {
                            const isMyEscalation =
                                (ticket.escalatedToRole === user.role) ||
                                (ticket.escalatedToRole === 'MEDICAL_OP_TEAM' && ['MEDICAL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER'].includes(user.role)) ||
                                (ticket.escalatedToRole === 'SAFETY_OP_TEAM' && ['SAFETY_OP_TEAM', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF'].includes(user.role)) ||
                                (ticket.escalatedToRole === 'CONTROL_OP_TEAM' && ['CONTROL_OP_TEAM', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL'].includes(user.role));

                            if (!isMyEscalation) return null;
                        } else {
                            if (ticket.assignedToId !== user.id) return null;
                        }

                        return (
                            <button
                                onClick={async () => {
                                    if (confirm('Are you sure you want to close this ticket?')) {
                                        try {
                                            await api.post(`/tickets/${id}/close`);
                                            window.location.reload();
                                        } catch (e) { alert('Failed to close'); }
                                    }
                                }}
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2 text-sm font-medium"
                            >
                                Close Ticket
                            </button>
                        );
                    })()}

                    {/* Reopen (Admin or COC) */}
                    {(user?.role === 'ADMIN' || user?.role === 'CHIEF_OF_CONTROL') && ticket.status === 'CLOSED' && (
                        <button
                            onClick={async () => {
                                const confirmMsg = user.role === 'ADMIN'
                                    ? 'Are you sure you want to REOPEN this ticket and send to CHIEF OF CONTROL?'
                                    : 'Are you sure you want to REOPEN this ticket?';

                                if (confirm(confirmMsg)) {
                                    try {
                                        await api.post(`/tickets/${id}/reopen`);
                                        window.location.reload();
                                    } catch (e) { alert('Failed to reopen'); }
                                }
                            }}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm font-medium"
                        >
                            {user.role === 'ADMIN' ? 'Reopen to COC' : 'Reopen Ticket'}
                        </button>
                    )}

                    {(user?.role === 'ADMIN' || user?.role.includes('MEDICAL')) && !medicalReport && ticket.type === 'MEDICAL' && (
                        <button
                            onClick={() => setShowMedicalModal(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium"
                        >
                            <Activity size={16} /> Medical Assessment
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Info Card */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{ticket.type} Incident</span>
                                <h1 className="text-2xl font-bold text-gray-900 mt-1 break-all">{ticket.ticketNo}</h1>
                            </div>
                            <div className="flex flex-col items-start md:items-end gap-1 w-full md:w-auto">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(ticket.status)}`}>
                                    {ticket.status.replace('_', ' ')}
                                </span>
                                {ticket.status === 'ESCALATED' && (
                                    <div className="flex flex-col items-end gap-1 mt-1">
                                        {/* Escalated To Target */}
                                        {ticket.escalatedToRole && (
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                                To: {ticket.escalatedToRole.replace(/_/g, ' ')}
                                            </span>
                                        )}

                                        {/* Escalated From Source (Log check) */}
                                        {(() => {
                                            const escLog = ticket.activityLogs?.find((l: any) => l.action === 'TICKET_ESCALATED');
                                            if (!escLog) return null;
                                            return (
                                                <div className="text-right mt-1">
                                                    <p className="text-[10px] text-gray-400">From: {escLog.actor.name}</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {activeTab === 'summary' && (
                                <div className="space-y-8">
                                    {/* PIT GRID DETAIL VIEW */}
                                    {ticket.pitGridReport && (
                                        <div className="space-y-6">
                                            <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100">
                                                <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 mb-4">Pit & Grid Report</h4>

                                                {/* Header Grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                                                    <div><span className="block text-xs uppercase text- emerald-400 font-bold tracking-wider">Pit</span> <span className="font-bold text-gray-900">{ticket.pitGridReport.pitNumber || '-'}</span></div>
                                                    <div><span className="block text-xs uppercase text- emerald-400 font-bold tracking-wider">Session</span> <span className="font-bold text-gray-900">{ticket.pitGridReport.sessionCategory}</span></div>
                                                    <div><span className="block text-xs uppercase text- emerald-400 font-bold tracking-wider">Car #</span> <span className="font-bold text-gray-900">{ticket.pitGridReport.carNumber}</span></div>
                                                    <div><span className="block text-xs uppercase text- emerald-400 font-bold tracking-wider">Lap</span> <span className="font-bold text-gray-900">{ticket.pitGridReport.lapNumber || '-'}</span></div>
                                                </div>

                                                {/* Speed & Operator Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                    <div className="bg-white p-4 rounded border border-emerald-100">
                                                        <h5 className="text-xs font-bold text-emerald-900 uppercase mb-2">Pit Speed</h5>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div><span className="text-gray-500 text-xs">Limit</span> <div className="font-medium">{ticket.pitGridReport.speedLimit || 'N/A'}</div></div>
                                                            <div><span className="text-gray-500 text-xs">Recorded</span> <div className="font-bold text-red-600">{ticket.pitGridReport.speedRecorded || 'N/A'}</div></div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-4 rounded border border-emerald-100">
                                                        <h5 className="text-xs font-bold text-emerald-900 uppercase mb-2">Radar Operator</h5>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div><span className="text-gray-500 text-xs">Name</span> <div className="font-medium">{ticket.pitGridReport.radarOperatorName || '-'}</div></div>
                                                            <div><span className="text-gray-500 text-xs">Phone</span> <div className="font-medium">{ticket.pitGridReport.radarOperatorPhone || '-'}</div></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Violations */}
                                                <div className="mb-6">
                                                    <h5 className="text-xs font-bold text-emerald-900 uppercase mb-2">Violations Detected</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ticket.pitGridReport.drivingOnWhiteLine && <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Driving on White Line</span>}
                                                        {ticket.pitGridReport.refueling && <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Refueling Violation</span>}
                                                        {ticket.pitGridReport.driverChange && <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Driver Change Violation</span>}
                                                        {ticket.pitGridReport.excessMechanics && <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Excess Mechanics</span>}

                                                        {(!ticket.pitGridReport.drivingOnWhiteLine && !ticket.pitGridReport.refueling && !ticket.pitGridReport.driverChange && !ticket.pitGridReport.excessMechanics) && (
                                                            <span className="text-gray-400 text-sm italic">No Checkbox Violations Recorded</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Remarks */}
                                                {ticket.pitGridReport.remarks && (
                                                    <div>
                                                        <h5 className="text-xs font-bold text-emerald-900 uppercase mb-1">Remarks</h5>
                                                        <p className="bg-yellow-50 p-4 rounded text-gray-800 border-l-4 border-yellow-400 text-sm">
                                                            {ticket.pitGridReport.remarks}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* MEDICAL DETAIL VIEW (If Applicable) */}
                                    {ticket.type === 'MEDICAL' && ticket.medicalReport && (
                                        <div className="space-y-6">
                                            {/* Patient & License Info */}
                                            <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100 flex flex-col md:flex-row gap-6">
                                                <div className="flex-1 space-y-4">
                                                    <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 flex items-center gap-2">
                                                        <User size={18} /> Patient Details
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">Full Name</span> <span className="font-bold text-gray-900 text-base">{ticket.medicalReport.patientGivenName} {ticket.medicalReport.patientSurname}</span></div>
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">DOB / Gender</span> <span className="font-medium text-gray-800">{ticket.medicalReport.patientDob ? new Date(ticket.medicalReport.patientDob).toLocaleDateString() : '-'} ({ticket.medicalReport.patientGender})</span></div>
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">Role</span> <span className="font-medium text-gray-800">{ticket.medicalReport.patientRole?.replace('_', ' ')}</span></div>
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">Competitor No</span> <span className="font-bold text-gray-900">{ticket.medicalReport.carNumber || '-'}</span></div>
                                                    </div>
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 flex items-center gap-2">
                                                        <Shield size={18} /> License & Status
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">Motorsport ID</span> <span className="font-mono bg-white px-2 py-1 rounded border border-emerald-100">{ticket.medicalReport.motorsportId || 'N/A'}</span></div>
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">License Action</span>
                                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${ticket.medicalReport.licenseAction === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                {ticket.medicalReport.licenseAction?.replace('_', ' ') || 'NONE'}
                                                            </span>
                                                        </div>
                                                        <div><span className="block text-xs uppercase text-emerald-400 font-bold tracking-wider">Permit No</span> <span className="font-medium text-gray-800">{ticket.medicalReport.permitNumber || '-'}</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Clinical Info */}
                                            <div className="bg-red-50/50 p-6 rounded-xl border border-red-100">
                                                <h4 className="font-bold text-red-900 border-b border-red-200 pb-2 mb-4 flex items-center gap-2">
                                                    <Activity size={18} /> Clinical Initial Report
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-6">
                                                    <div>
                                                        <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Injury Type</span>
                                                        <div className="font-bold text-gray-900 bg-white p-2 rounded border border-red-100">{ticket.medicalReport.injuryType?.replace(/_/g, ' ')}</div>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Consciousness</span>
                                                        <div className="font-medium text-gray-900 bg-white p-2 rounded border border-red-100">{ticket.medicalReport.conscious ? 'Conscious / Alert' : 'Unconscious'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Transport</span>
                                                        <div className="font-medium text-gray-900 bg-white p-2 rounded border border-red-100">
                                                            {ticket.medicalReport.transportRequired ? 'Transport Required' : 'No Transport'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 text-sm">
                                                    {ticket.medicalReport.incidentDescription && (
                                                        <div>
                                                            <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Description of Circumstances</span>
                                                            <p className="bg-white p-3 rounded-lg border border-red-100 text-gray-700">{ticket.medicalReport.incidentDescription}</p>
                                                        </div>
                                                    )}
                                                    {ticket.medicalReport.initialCondition && (
                                                        <div>
                                                            <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Initial Condition</span>
                                                            <p className="bg-white p-3 rounded-lg border border-red-100 text-gray-700">{ticket.medicalReport.initialCondition}</p>
                                                        </div>
                                                    )}
                                                    {ticket.medicalReport.treatmentGiven && (
                                                        <div>
                                                            <span className="block text-xs uppercase text-red-400 font-bold tracking-wider mb-1">Treatment Given</span>
                                                            <p className="bg-white p-3 rounded-lg border border-red-100 text-gray-700">{ticket.medicalReport.treatmentGiven}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Description (Common) */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <FileText size={16} className="text-emerald-600" />
                                            Incident Description
                                        </h3>
                                        <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                                            {ticket.description}
                                        </p>
                                    </div>

                                    {/* Grid Info */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Event</p>
                                            <p className="text-sm font-bold text-gray-900">{ticket.eventName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Venue</p>
                                            <p className="text-sm font-bold text-gray-900">{ticket.venue}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Date & Time</p>
                                            <p className="text-sm font-bold text-gray-900">{new Date(ticket.dateTime).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Location</p>
                                            <p className="text-sm font-bold text-gray-900">{ticket.location}</p>
                                        </div>
                                    </div>

                                    {/* Drivers & Witnesses */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                <Shield size={16} className="text-red-500" />
                                                Involved Drivers
                                            </h3>
                                            <div className="space-y-2">
                                                {drivers.map((d: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                                                        <span className="font-bold text-gray-900">{d.carNo}</span>
                                                        <span className="text-gray-700">{d.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                <User size={16} className="text-green-500" />
                                                Witnesses
                                            </h3>
                                            <div className="space-y-2">
                                                {witnesses.map((w: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                                                        <span className="font-medium text-gray-900">{w.name}</span>
                                                        <span className="text-gray-500">{w.contact}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'timeline' && (
                                <div className="space-y-6 py-4">
                                    {ticket.activityLogs?.map((log: any, i: number) => (
                                        <div key={i} className="flex gap-4 relative">
                                            {i < ticket.activityLogs.length - 1 && <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-100" />}
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 z-10">
                                                <History size={14} />
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-sm font-bold text-gray-900">{log.action.replace('_', ' ')}</span>
                                                    <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-gray-600">{log.details}</p>
                                                <div className="mt-2 flex items-center gap-1">
                                                    <div className="w-4 h-4 rounded-full bg-gray-200" />
                                                    <span className="text-[10px] text-gray-400 font-medium">{log.actor?.name || 'Automated'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'medical' && (
                                <div className="space-y-6">
                                    {!medicalReport ? (
                                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                            <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No medical report submitted yet.</p>
                                            <p className="text-xs">Medical staff can submit a report via the "Medical Assessment" button.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="bg-white p-3 rounded-full shadow-sm text-red-600"><Activity size={24} /></div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg">Medical Report</h3>
                                                    <p className="text-xs text-gray-500">Submitted by {medicalReport.author?.name} on {new Date(medicalReport.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase text-red-700 tracking-wider mb-1">Clinical Summary</h4>
                                                    <p className="text-gray-800 bg-white p-4 rounded-lg shadow-sm border border-red-100">{medicalReport.summary}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase text-red-700 tracking-wider mb-1">Recommendation</h4>
                                                        <p className="text-gray-800 bg-white p-3 rounded-lg shadow-sm border border-red-100 font-medium">{medicalReport.recommendation}</p>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase text-red-700 tracking-wider mb-1">License Action</h4>
                                                        <span className={`inline-block px-3 py-2 rounded-lg text-sm font-bold ${medicalReport.licenseAction === 'SUSPEND' ? 'bg-red-600 text-white' :
                                                            medicalReport.licenseAction === 'CLEAR' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                                                            }`}>
                                                            {medicalReport.licenseAction}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'attachments' && (
                                <div className="py-6">
                                    {ticket.attachments && ticket.attachments.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {ticket.attachments.map((att: any, i: number) => {
                                                const fileUrl = `http://localhost:3000${att.url.replace(/\\/g, '/')}`;
                                                return (
                                                    <div key={i} className="border rounded-lg p-2 bg-gray-50 relative group">
                                                        <a href={fileUrl} target="_blank" rel="noreferrer" className="block">
                                                            {att.mimeType.startsWith('image') ? (
                                                                <img
                                                                    src={fileUrl}
                                                                    alt={att.name}
                                                                    className="w-full h-32 object-cover rounded-md hover:opacity-90 transition-opacity"
                                                                />
                                                            ) : (
                                                                <div className="h-32 flex items-center justify-center bg-gray-200 rounded-md hover:bg-gray-300 transition-colors cursor-pointer relative">
                                                                    <Paperclip size={24} className="text-gray-400" />
                                                                    <span className="absolute bottom-2 text-[10px] text-gray-500 font-medium bg-white/80 px-2 py-0.5 rounded">
                                                                        Download
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </a>
                                                        <div className="flex justify-between items-start mt-2">
                                                            <div className="min-w-0">
                                                                <p className="text-xs truncate font-medium text-gray-700" title={att.name}>{att.name}</p>
                                                                <p className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</p>
                                                            </div>
                                                            {att.refId && (
                                                                <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-mono px-1.5 py-0.5 rounded border border-emerald-200" title="Reference ID">
                                                                    {att.refId.split('-').pop()} {/* Show Short ID e.g. A1 */}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400">
                                            <Paperclip size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No attachments uploaded yet</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions & Sidebar */}
                <div className="space-y-6 text-sm">
                    {/* Quick Actions Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-bold text-gray-900 mb-4">Actions</h3>
                        <div className="space-y-3">
                            {ticket.status === 'CLOSED' ? (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                                    <div className="flex justify-center mb-2">
                                        <div className="p-2 bg-gray-200 rounded-full">
                                            <AlertCircle size={24} />
                                        </div>
                                    </div>
                                    <p className="font-semibold">This ticket is closed</p>
                                    <p className="text-xs">Updates and comments are disabled.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <textarea
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            className="w-full border-gray-200 rounded-lg p-3 h-24 focus:ring-emerald-500 focus:border-emerald-500 pr-10"
                                            placeholder="Add a comment or update..."
                                        />
                                        <div className="absolute bottom-3 right-3">
                                            <label className="cursor-pointer text-gray-400 hover:text-emerald-600 transition-colors">
                                                <Paperclip size={20} />
                                                <input
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => e.target.files && setFiles([...files, ...Array.from(e.target.files)])}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Selected Files Preview */}
                                    {files.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-gray-100 text-xs px-2 py-1 rounded-full border border-gray-200">
                                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                                    <button
                                                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                                                        className="text-gray-500 hover:text-red-500"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSendAction}
                                        disabled={isSending || (!comment.trim() && files.length === 0)}
                                        className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSending ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                                        {isSending ? 'Sending...' : 'Send Update'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Ticket Metadata Sidebar */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Reporter</p>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase text-xs">
                                    {ticket.createdBy?.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{ticket.createdBy?.name || 'Unknown'}</p>
                                    <p className="text-xs text-gray-400">{ticket.createdBy?.role || 'Guest'}</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Priority</p>
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-orange-500" />
                                <span className="font-bold">{ticket.priority}</span>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <button className="text-emerald-600 font-bold hover:underline flex items-center gap-1">
                                View Full Audit Log <ExternalLink size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetail;
