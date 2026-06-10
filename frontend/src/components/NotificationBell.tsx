import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// Module-level constants — stable references, safe in hook deps
const STATUS_HINTS: Record<string, { ar: string; en: string; color: string }> = {
 SUBMITTED: { ar: 'بانتظار مراجعتك', en: 'Awaiting your review', color: 'bg-blue-100 text-blue-700' },
 ASSIGNED: { ar: 'بانتظار ردك', en: 'Awaiting your response', color: 'bg-amber-100 text-amber-700' },
 UNDER_REVIEW: { ar: 'بانتظار مراجعتك', en: 'Awaiting your review', color: 'bg-purple-100 text-purple-700' },
 RETURNED_TO_REPORTER: { ar: 'مُرجعة إليك', en: 'Returned to you', color: 'bg-rose-100 text-rose-700' },
 RETURNED_TO_DEPARTMENT: { ar: 'مُرجعة لقسمك', en: 'Returned to your dept', color: 'bg-pink-100 text-pink-700' },
 ESCALATED: { ar: 'مُصعَّدة إليك', en: 'Escalated to you', color: 'bg-red-100 text-red-700' },
 PENDING_REMINDER: { ar: 'تنبيه بانتظارك', en: 'Reminder pending', color: 'bg-orange-100 text-orange-700' },
};

const TYPE_COLORS: Record<string, string> = {
 NEW_TICKET: 'bg-blue-100 text-blue-700',
 ESCALATION: 'bg-red-100 text-red-700',
 CLOSURE: 'bg-emerald-100 text-emerald-700',
 FINANCIAL_VIOLATION: 'bg-red-100 text-red-800',
 WARNING_VIOLATION: 'bg-orange-100 text-orange-700',
 REMINDER: 'bg-amber-100 text-amber-700',
 INFO: 'bg-slate-100 text-slate-600',
};

interface NotificationBellProps {
 /** Reserved for future per-portal endpoint switching */
 portal?: 'OC' | 'INCIRCUIT';
}

interface DBNotification {
 id: string;
 title: string;
 message: string;
 type: string;
 link: string | null;
 read: boolean;
 createdAt: string;
}

interface PendingTicket {
 id: string;
 ticketNo: string;
 status: string;
 description?: string;
 offCircuitReport?: { whatHappened?: string };
}

type UnifiedItem = {
 key: string;
 kind: 'notification' | 'pending';
 title: string;
 message: string;
 link: string;
 read: boolean;
 time: string;
 color: string;
 dbId?: string; // for mark-as-read
};

const NotificationBell: React.FC<NotificationBellProps> = () => {
 const { user } = useAuth();
 const { t, i18n } = useTranslation();
 const isRtl = i18n.language?.startsWith('ar');
 const navigate = useNavigate();

 const [items, setItems] = useState<UnifiedItem[]>([]);
 const [unreadCount, setUnreadCount] = useState(0);
 const [showDropdown, setShowDropdown] = useState(false);
 const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

 const dropdownRef = useRef<HTMLDivElement>(null);
 const prevUnreadRef = useRef(0);

 // ── Filter pending tickets by role (same logic as before) ──
 const filterPendingTickets = useCallback((tickets: any[]): PendingTicket[] => {
  if (!user) return [];
  const role = user.role;

  return tickets.filter(t => {
   if (role === 'OC_REPORTER') {
    return (t.status === 'RETURNED_TO_REPORTER' || t.status === 'PENDING_REMINDER') && t.createdById === user.id;
   }
   if (role === 'HSE_CONTROLLER') {
    return t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW';
   }
   if (role === 'DEP_REP') {
    const isSameDept = t.departmentId && t.departmentId === (user as any).repDepartmentId;
    const isAssigned = t.assignedToId === user.id;
    return (t.status === 'ASSIGNED' || t.status === 'RETURNED_TO_DEPARTMENT') && (isSameDept || isAssigned);
   }
   if (role === 'SAFETY_MANAGER' || role === 'OC_HSE_MANAGER') {
    return t.status === 'ESCALATED';
   }
   if (role === 'DEP_MANAGER') {
    return t.status === 'ESCALATED' && t.assignedToId === user.id;
   }
   if (role === 'HR_REP') {
    return (t.status === 'ASSIGNED' || t.status === 'RETURNED_TO_DEPARTMENT') && t.hasInjury;
   }
   if (role === 'ADMIN') {
    return ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED', 'ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(t.status);
   }
   // FINANCE_REP: tickets forwarded to finance
   if (role === 'FINANCE_REP') {
    return t.forwardedToFinance === true && t.status === 'CLOSED';
   }
   return false;
  });
 }, [user]);

 // ── Unified fetch: DB notifications + pending tickets ──
 const fetchAll = useCallback(async () => {
  if (!user) return;
  try {
   const [notifRes, ticketRes] = await Promise.all([
    api.get('/notifications').catch(() => ({ data: [] })),
    api.get('/tickets').catch(() => ({ data: { tickets: [] } })),
   ]);

   const dbNotifs: DBNotification[] = Array.isArray(notifRes.data) ? notifRes.data : [];
   const tickets = Array.isArray(ticketRes.data) ? ticketRes.data : (ticketRes.data?.tickets ?? []);
   const pending = filterPendingTickets(tickets);

   // ── Convert DB notifications → UnifiedItem ──
   const notifItems: UnifiedItem[] = dbNotifs.map(n => ({
    key: `notif-${n.id}`,
    kind: 'notification',
    title: n.title,
    message: n.message,
    link: n.link || '/dashboard',
    read: n.read,
    time: n.createdAt,
    color: TYPE_COLORS[n.type] || TYPE_COLORS.INFO,
    dbId: n.id,
   }));

   // ── Convert pending tickets → UnifiedItem (always "unread") ──
   const pendingItems: UnifiedItem[] = pending.map(tk => {
    const hint = STATUS_HINTS[tk.status] || { ar: tk.status, en: tk.status, color: 'bg-gray-100 text-gray-600' };
    return {
     key: `pending-${tk.id}`,
     kind: 'pending',
     title: tk.ticketNo,
     message: isRtl ? hint.ar : hint.en,
     link: `/tickets/${tk.id}`,
     read: false,
     time: new Date().toISOString(), // always top
     color: hint.color,
    };
   });

   // ── Merge: pending first, then DB notifications sorted by time ──
   const merged = [
    ...pendingItems,
    ...notifItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
   ];

   setItems(merged);

   const newUnread = merged.filter(i => !i.read).length;
   setUnreadCount(newUnread);

   // Detect new unread items
   if (newUnread > prevUnreadRef.current) {
    // Could trigger sound here if desired
   }
   prevUnreadRef.current = newUnread;
  } catch (err) {
   console.error('Notification fetch failed', err);
  }
 }, [user, filterPendingTickets, isRtl]);

 // ── Mark single notification as read ──
 const markRead = async (item: UnifiedItem) => {
  if (item.kind === 'notification' && item.dbId && !item.read) {
   try {
    await api.put(`/notifications/${item.dbId}/read`);
    setItems(prev => prev.map(i => i.key === item.key ? { ...i, read: true } : i));
    setUnreadCount(prev => Math.max(0, prev - 1));
   } catch { /* silent */ }
  }
 };

 // ── Mark all DB notifications as read ──
 const markAllRead = async () => {
  try {
   await api.put('/notifications/read-all');
   // Compute new state from the most recent items snapshot to avoid stale closure.
   setItems(prev => {
    const next = prev.map(i => i.kind === 'notification' ? { ...i, read: true } : i);
    setUnreadCount(next.filter(i => !i.read).length);
    return next;
   });
  } catch { /* silent */ }
 };

 // ── Click handler: navigate + mark read ──
 const handleItemClick = (item: UnifiedItem) => {
  markRead(item);
  setShowDropdown(false);
  navigate(item.link);
 };

 // ── Polling ──
 useEffect(() => {
  if (!user) return;
  fetchAll();
  const poll = setInterval(fetchAll, 30000);

  const handleClickOutside = (e: MouseEvent) => {
   if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
    setShowDropdown(false);
   }
  };
  document.addEventListener('mousedown', handleClickOutside);

  return () => {
   clearInterval(poll);
   document.removeEventListener('mousedown', handleClickOutside);
  };
 }, [user, fetchAll]);

 if (!user) return null;

 const displayItems = activeTab === 'unread' ? items.filter(i => !i.read) : items;

 // Time formatter
 const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRtl ? 'الآن' : 'Just now';
  if (mins < 60) return isRtl ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRtl ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRtl ? `منذ ${days} ي` : `${days}d ago`;
 };

 return (
 <div className="relative" ref={dropdownRef}>
  <button
   id="notification-bell"
   onClick={() => setShowDropdown(!showDropdown)}
   aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
   className={`p-2 rounded-lg transition-all relative ${
    unreadCount > 0
     ? 'bg-blue-600/20 border border-blue-600/50 text-blue-500'
     : 'bg-white border border-gray-200 text-gray-800 hover:text-blue-500 hover:border-blue-600/50'
   }`}
  >
   <Bell size={16} className={unreadCount > 0 ? 'animate-bounce' : ''} />
   {unreadCount > 0 && (
    <span className="absolute -top-1.5 ltr:-right-1.5 rtl:-left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border-2 border-slate-900">
     {unreadCount > 99 ? '99+' : unreadCount}
    </span>
   )}
  </button>

  {showDropdown && (
   <div className="absolute top-full ltr:right-0 rtl:left-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden z-50">
    {/* Header */}
    <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
     <h3 className="text-sm font-bold text-gray-800">{t('notifications.title', 'الإشعارات — Notifications')}</h3>
     {items.some(i => i.kind === 'notification' && !i.read) && (
      <button
       onClick={markAllRead}
       className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
      >
       <CheckCheck size={12} /> {isRtl ? 'قراءة الكل' : 'Mark all read'}
      </button>
     )}
    </div>

    {/* Tabs */}
    <div className="flex border-b border-gray-100">
     <button
      onClick={() => setActiveTab('all')}
      className={`flex-1 py-2 text-xs font-bold transition-colors ${activeTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
     >
      {isRtl ? 'الكل' : 'All'} ({items.length})
     </button>
     <button
      onClick={() => setActiveTab('unread')}
      className={`flex-1 py-2 text-xs font-bold transition-colors ${activeTab === 'unread' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
     >
      {isRtl ? 'غير مقروء' : 'Unread'} ({unreadCount})
     </button>
    </div>

    {/* Items */}
    <div className="max-h-80 overflow-y-auto custom-scrollbar">
     {displayItems.length > 0 ? (
      <div className="flex flex-col">
       {displayItems.slice(0, 20).map(item => (
        <button
         key={item.key}
         onClick={() => handleItemClick(item)}
         className={`w-full text-start p-3 transition-all border-b border-gray-50 group ${
          item.read
           ? 'hover:bg-gray-50'
           : 'bg-blue-50/40 hover:bg-blue-50'
         }`}
        >
         <div className="flex items-start gap-2.5">
          {/* Unread dot */}
          <div className="pt-1.5 flex-shrink-0">
           {!item.read ? (
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
           ) : (
            <div className="w-2 h-2" />
           )}
          </div>

          <div className="flex-1 min-w-0">
           <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="font-bold text-xs text-gray-800 group-hover:text-blue-600 truncate">
             {item.title}
            </span>
            <span className="text-[9px] text-gray-400 flex-shrink-0">
             {timeAgo(item.time)}
            </span>
           </div>
           <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">{item.message}</p>
           <div className="flex items-center gap-2 mt-1">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${item.color}`}>
             {item.kind === 'pending'
              ? (isRtl ? 'يتطلب إجراء' : 'Action needed')
              : (isRtl ? 'إشعار' : 'Notification')
             }
            </span>
            <ExternalLink size={10} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
           </div>
          </div>
         </div>
        </button>
       ))}
      </div>
     ) : (
      <div className="text-center py-8 px-4">
       <Bell size={28} className="mx-auto text-gray-200 mb-3" />
       <p className="text-xs text-gray-400 font-medium">
        {activeTab === 'unread'
         ? (isRtl ? 'لا توجد إشعارات غير مقروءة' : 'No unread notifications')
         : (isRtl ? 'لا توجد إشعارات حالياً' : 'No notifications yet')
        }
       </p>
      </div>
     )}
    </div>

    {/* Footer */}
    {items.length > 20 && (
     <div className="p-2 border-t border-gray-100 bg-gray-50/50">
      <button
       onClick={() => { setShowDropdown(false); navigate('/dashboard'); }}
       className="text-center text-xs text-blue-600 font-bold py-1 hover:text-blue-800 w-full transition-colors"
      >
       {t('notifications.viewAll', 'عرض الكل...')}
      </button>
     </div>
    )}
   </div>
  )}
 </div>
 );
};

export default NotificationBell;
