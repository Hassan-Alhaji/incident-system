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
 // Disabled based on user request (شيل الصوت حالياً)
 return;
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

 const role = user.role;

 return tickets.filter(t => {
  // OC_REPORTER: tickets returned to them or pending their reminder action
  if (role === 'OC_REPORTER') {
   return (t.status === 'RETURNED_TO_REPORTER' || t.status === 'PENDING_REMINDER') && t.createdById === user.id;
  }
  // HSE_CONTROLLER: new tickets to review or department responses to review
  if (role === 'HSE_CONTROLLER') {
   return t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW';
  }
  // DEP_REP: tickets assigned or returned to their department
  if (role === 'DEP_REP') {
   const isSameDept = t.departmentId && t.departmentId === (user as any).repDepartmentId;
   const isAssigned = t.assignedToId === user.id;
   return (t.status === 'ASSIGNED' || t.status === 'RETURNED_TO_DEPARTMENT') && (isSameDept || isAssigned);
  }
  // SAFETY_MANAGER / OC_HSE_MANAGER: escalated tickets
  if (role === 'SAFETY_MANAGER' || role === 'OC_HSE_MANAGER') {
   return t.status === 'ESCALATED';
  }
  // DEP_MANAGER: escalated tickets sent to them
  if (role === 'DEP_MANAGER') {
   return t.status === 'ESCALATED' && t.assignedToId === user.id;
  }
  // HR_REP: tickets with injuries assigned to HR
  if (role === 'HR_REP') {
   return (t.status === 'ASSIGNED' || t.status === 'RETURNED_TO_DEPARTMENT') && t.hasInjury;
  }
  // ADMIN: all tickets that need action
  if (role === 'ADMIN') {
   return ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED', 'ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(t.status);
  }
  return false;
 });
 };

 const fetchTickets = async () => {
 try {
 const endpoint = portal === 'OC' ? '/tickets' : '/tickets';
 const res = await api.get(endpoint);
 const tickets = Array.isArray(res.data) ? res.data : (res.data?.tickets ?? []);
 const pt = filterPendingTickets(tickets);
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
 ? 'bg-blue-600/20 border border-blue-600/50 text-blue-500 animate-pulse' 
 : 'bg-white border border-gray-200 text-gray-800 hover:text-blue-500 hover:border-blue-600/50'
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
 <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden z-50">
 <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
 <h3 className="text-sm font-bold text-gray-800">{t('notifications.title', 'التنبيهات — Notifications')}</h3>
 </div>
 <div className="p-3 flex flex-col gap-2">
 {pendingCount > 0 ? (
 <div className="flex flex-col w-full">
 <div className="text-xs font-medium text-gray-600 mb-2 px-1">
 {t('notifications.pending', 'لديك')} <strong className="text-blue-600">{pendingCount}</strong> {t('notifications.pendingItems', 'تذكرة تحتاج إجراءك')}
 </div>
 <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 w-full relative z-10">
 {pendingTickets.slice(0, 10).map(tk => {
  const statusHints: Record<string, { ar: string; en: string; color: string }> = {
   SUBMITTED: { ar: 'بانتظار مراجعتك', en: 'Awaiting your review', color: 'bg-blue-100 text-blue-700' },
   ASSIGNED: { ar: 'بانتظار ردك', en: 'Awaiting your response', color: 'bg-amber-100 text-amber-700' },
   UNDER_REVIEW: { ar: 'بانتظار مراجعتك', en: 'Awaiting your review', color: 'bg-purple-100 text-purple-700' },
   RETURNED_TO_REPORTER: { ar: 'مُرجعة إليك', en: 'Returned to you', color: 'bg-rose-100 text-rose-700' },
   RETURNED_TO_DEPARTMENT: { ar: 'مُرجعة لقسمك', en: 'Returned to your dept', color: 'bg-pink-100 text-pink-700' },
   ESCALATED: { ar: 'مُصعَّدة إليك', en: 'Escalated to you', color: 'bg-red-100 text-red-700' },
   PENDING_REMINDER: { ar: 'تنبيه بانتظارك', en: 'Reminder pending', color: 'bg-orange-100 text-orange-700' },
  };
  const hint = statusHints[tk.status] || { ar: tk.status, en: tk.status, color: 'bg-gray-100 text-gray-600' };
  return (
  <button 
   key={tk.id}
   onClick={() => {
   setShowDropdown(false);
   navigate(`/tickets/${tk.id}`);
   }}
   className="w-full text-start p-2.5 hover:bg-blue-50 rounded-lg transition-all border border-gray-100 hover:border-blue-200 group"
  >
   <div className="flex justify-between items-center mb-1">
   <span className="font-bold text-xs text-gray-700 group-hover:text-blue-600">{tk.ticketNo}</span>
   <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${hint.color}`}>{hint.ar}</span>
   </div>
   <p className="text-[10px] text-gray-500 truncate w-full">{tk.description || tk.offCircuitReport?.whatHappened || '—'}</p>
  </button>
  );
 })}
 </div>
 {pendingCount > 10 && (
  <button 
  onClick={() => { setShowDropdown(false); navigate('/dashboard'); }}
  className="text-center text-xs text-blue-600 font-bold mt-2 py-2 hover:text-blue-800 w-full"
  >
  {t('notifications.viewAll', 'عرض الكل في لوحة التحكم...')}
  </button>
 )}
 </div>
 ) : (
 <div className="text-center py-6 px-4">
  <Bell size={24} className="mx-auto text-gray-300 mb-2" />
  <p className="text-xs text-gray-400">{t('notifications.empty', 'لا توجد تذاكر تتطلب إجراءً منك حالياً')}</p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
};

export default NotificationBell;
