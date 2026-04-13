import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface NotificationBellProps {
    portal: 'OC' | 'INCIRCUIT';
}

const NotificationBell: React.FC<NotificationBellProps> = ({ portal }) => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTickets, setPendingTickets] = useState<any[]>([]);
    const [hasNew, setHasNew] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const alarmIntervalRef = useRef<number | null>(null);
    const repeatCountRef = useRef(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const maxAlarms = 5;

    const playAlertSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const playNote = (freq: number, time: number, duration: number) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
                osc.start(time);
                osc.stop(time + duration);
            };

            const now = audioCtx.currentTime;
            playNote(880, now, 0.2);
            playNote(1046, now + 0.15, 0.3);
            playNote(1318, now + 0.3, 0.4);
        } catch (e) {
            console.error('Audio playback failed', e);
        }
    };

    const filterPendingTickets = (tickets: any[]) => {
        if (!user) return [];

        if (portal === 'OC') {
            const isSupervisor = user.role === 'OC_SUPERVISOR' || user.role === 'ADMIN';
            const isInvestigator = user.role === 'OC_SAFETY_INVESTIGATOR' || user.role === 'ADMIN';
            const isHSE = user.role === 'OC_HSE_MANAGER' || user.role === 'ADMIN';

            return tickets.filter(t => {
                if (isSupervisor && (t.status === 'OPEN' || t.status === 'SUPERVISOR_REVIEW' || t.status === 'RETURNED_FOR_EDIT')) return true;
                if (isInvestigator && t.status === 'UNDER_INVESTIGATION') return true;
                if (isHSE && t.status === 'FINAL_REVIEW') return true;
                return false;
            });
        } else {
            const isAdmin = user.role === 'ADMIN' || user.role === 'RACE_CONTROL';
            const isMedicalChief = ['MEDICAL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER'].includes(user.role);
            const isSafetyChief = ['SAFETY_OP_TEAM', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF'].includes(user.role);
            const isControlChief = ['CONTROL_OP_TEAM', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL'].includes(user.role);

            return tickets.filter(t => {
                if (isAdmin && (t.status === 'OPEN' || t.status === 'ESCALATED')) return true;
                if (t.status === 'ESCALATED') {
                    if (isMedicalChief && t.escalatedToRole === 'MEDICAL_OP_TEAM') return true;
                    if (isSafetyChief && t.escalatedToRole === 'SAFETY_OP_TEAM') return true;
                    if (isControlChief && t.escalatedToRole === 'CONTROL_OP_TEAM') return true;
                    if (t.escalatedToRole === user.role) return true;
                }
                if (t.status === 'OPEN' && t.assignedToId === user.id) return true;
                return false;
            });
        }
    };

    const fetchTickets = async () => {
        try {
            const endpoint = portal === 'OC' ? '/oc/tickets' : '/tickets';
            const res = await api.get(endpoint);
            const pt = filterPendingTickets(res.data || []);
            const count = pt.length;
            setPendingTickets(pt);
            
            setPendingCount(prevCount => {
                const lsKey = `ackCount_${portal}_${user?.id}`;
                const ackCount = parseInt(localStorage.getItem(lsKey) || '0', 10);
                
                if (count > ackCount || count > prevCount) {
                    // New tickets arrived
                    setHasNew(true);
                    triggerAlarmCycle();
                } else if (count === 0) {
                    setHasNew(false);
                    clearAlarmCycle();
                }

                // If count went down, update acknowledged silently so it doesn't alarm arbitrarily later
                if (count < ackCount) {
                     localStorage.setItem(lsKey, count.toString());
                }

                return count;
            });
        } catch (err) {
            console.error('Notification polling failed', err);
        }
    };

    const triggerAlarmCycle = () => {
        clearAlarmCycle();
        repeatCountRef.current = 0;
        
        // Initial Play
        playAlertSound();
        repeatCountRef.current++;

        alarmIntervalRef.current = setInterval(() => {
            if (repeatCountRef.current >= maxAlarms) {
                clearAlarmCycle();
                return;
            }
            playAlertSound();
            repeatCountRef.current++;
        }, 60000); // every minute
    };

    const clearAlarmCycle = () => {
        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
    };

    const acknowledgeAlert = () => {
        clearAlarmCycle();
        setHasNew(false);
        const lsKey = `ackCount_${portal}_${user?.id}`;
        localStorage.setItem(lsKey, pendingCount.toString());
    };

    const toggleDropdown = () => {
        if (!showDropdown) {
            acknowledgeAlert();
        }
        setShowDropdown(!showDropdown);
    };

    useEffect(() => {
        if (!user) return;
        fetchTickets();
        const pollInterval = setInterval(fetchTickets, 30000);

        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(pollInterval);
            clearAlarmCycle();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [user, portal]);

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className={`p-2 rounded-lg transition-all relative ${
                    hasNew 
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400 animate-pulse' 
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50'
                }`}
            >
                <Bell size={16} className={hasNew ? 'animate-bounce' : ''} />
                {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border-2 border-slate-900">
                        {pendingCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 shadow-2xl rounded-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-slate-700 bg-slate-800/80">
                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                    </div>
                    <div className="p-4 flex flex-col items-center justify-center text-center gap-2">
                        {pendingCount > 0 ? (
                            <div className="flex flex-col w-full text-left">
                                <div className="text-xs font-medium text-slate-400 mb-2 px-1">
                                    You have <strong className="text-amber-400">{pendingCount}</strong> item(s) pending review:
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1 w-full relative z-10">
                                    {pendingTickets.slice(0, 10).map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => {
                                                setShowDropdown(false);
                                                navigate(portal === 'OC' ? `/oc/tickets/${t.id}` : `/tickets/${t.id}`);
                                            }}
                                            className="w-full text-left p-3 hover:bg-slate-700/50 rounded-lg transition-all border border-slate-700/50 hover:border-amber-500/30 group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-200 group-hover:text-amber-400">{t.ticketNo}</span>
                                                <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full">{t.status.replace(/_/g, ' ')}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate w-full">{t.description || t.offCircuitReport?.whatHappened || 'Pending action'}</p>
                                        </button>
                                    ))}
                                </div>
                                {pendingCount > 10 && (
                                    <button 
                                        onClick={() => { setShowDropdown(false); navigate(portal === 'OC' ? '/oc/dashboard' : '/dashboard'); }}
                                        className="text-center text-xs text-slate-400 mt-2 py-2 hover:text-slate-200 w-full"
                                    >
                                        View all in dashboard...
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 py-4">No pending tickets require your action right now.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
