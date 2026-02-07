import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, AlertTriangle, Clock } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const MarshalDashboard = () => {
    const navigate = useNavigate();
    useAuth(); // Keep hook execution if needed for auth check/redirect side effects, or remove user destructuring.
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                // Fetch tickets created by me or assigned to me (if any logic exists)
                // For now, simple fetch.
                const res = await api.get('/tickets'); // Backend handles filtering by CreatedBy for Marshals
                setTickets(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTickets();
    }, []);

    const returnedTickets = tickets.filter((t: any) => t.status === 'RETURNED_TO_MARSHAL');
    const recentTickets = tickets.filter((t: any) => t.status !== 'RETURNED_TO_MARSHAL');

    return (
        <div className="space-y-6">
            {/* Create Action */}
            <button
                onClick={() => navigate('/marshal/new')}
                className="w-full bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-center gap-3 text-lg font-bold hover:bg-red-700 transition"
            >
                <PlusCircle size={28} />
                Create New Ticket
            </button>

            {/* Action Required Section */}
            {returnedTickets.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h3 className="text-orange-800 font-bold flex items-center gap-2 mb-3">
                        <AlertTriangle size={20} /> Action Required
                    </h3>
                    <div className="space-y-3">
                        {returnedTickets.map((ticket: any) => (
                            <div key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className="bg-white p-3 rounded-lg shadow-sm border border-orange-100 cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-gray-900">{ticket.ticketNo}</span>
                                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Returned</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{ticket.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent History */}
            <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock size={20} /> My Recent Tickets
                </h3>
                {loading ? (
                    <div className="text-center py-8 text-gray-400">Loading...</div>
                ) : recentTickets.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-gray-100 text-gray-400">
                        No recent tickets found.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentTickets.map((ticket: any) => (
                            <div key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-gray-900">{ticket.ticketNo}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${ticket.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' :
                                        ticket.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' :
                                            'bg-purple-100 text-purple-800'
                                        }`}>
                                        {ticket.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                    <span>{ticket.type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarshalDashboard;
