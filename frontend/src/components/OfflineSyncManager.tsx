import React, { useEffect, useState } from 'react';
import { getOfflineTickets, removeOfflineTicket } from '../utils/offlineStore';
import api from '../utils/api';
import { CloudOff, Cloud, RefreshCw, AlertTriangle } from 'lucide-react';

const OfflineSyncManager = () => {
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [pendingCount, setPendingCount] = useState(0);
 const [isSyncing, setIsSyncing] = useState(false);
 const [syncErrors, setSyncErrors] = useState(0);

 useEffect(() => {
 const handleOnline = () => setIsOnline(true);
 const handleOffline = () => setIsOnline(false);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 const checkPending = async () => {
 const queue = await getOfflineTickets();
 setPendingCount(queue.length);
 };

 useEffect(() => {
 checkPending();
 const interval = setInterval(checkPending, 5000);
 return () => clearInterval(interval);
 }, []);

 const syncTickets = async () => {
 if (!isOnline || isSyncing) return;
 setIsSyncing(true);
 setSyncErrors(0);

 try {
 const queue = await getOfflineTickets();
 let failCount = 0;
 for (const ticket of queue) {
 try {
 // 1. Submit ticket payload
 const res = await api.post('/tickets', ticket.payload);
 const newTicketId = res.data.id;

 // 2. Submit attachments if any
 if (ticket.attachments && ticket.attachments.length > 0) {
 const formData = new FormData();
 ticket.attachments.forEach((file: File) => {
 formData.append('files', file);
 });
 
 await api.post(`/tickets/${newTicketId}/attachments`, formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 }

 // 3. Remove from queue on success
 await removeOfflineTicket(ticket.id);
 } catch (e) {
 failCount++;
 console.error('Failed to sync ticket:', ticket.id, e);
 }
 }
 setSyncErrors(failCount);
 await checkPending();
 } finally {
 setIsSyncing(false);
 }
 };

 // Auto-sync when coming online
 useEffect(() => {
 if (isOnline && pendingCount > 0) {
 syncTickets();
 }
 }, [isOnline, pendingCount]);

 if (!isOnline || pendingCount > 0 || syncErrors > 0) {
 return (
 <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg flex items-center gap-3 px-4 py-3 text-base font-bold text-gray-800 transition-all
 ${!isOnline ? 'bg-red-500 text-white' : syncErrors > 0 ? 'bg-orange-500 text-white' : 'bg-yellow-400'}`}
 >
 {!isOnline ? <CloudOff size={20} /> : syncErrors > 0 ? <AlertTriangle size={20} /> : <Cloud size={20} />}
 <div>
 {!isOnline
 ? 'وضع بدون إنترنت — Offline Mode'
 : syncErrors > 0
 ? `فشلت مزامنة ${syncErrors} تقارير — Sync failed for ${syncErrors} report(s)`
 : 'جاري المزامنة — Syncing...'}
 {pendingCount > 0 && !syncErrors && (
 <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">{pendingCount} pending</span>
 )}
 </div>
 {isOnline && (
 <button
 onClick={syncTickets}
 disabled={isSyncing}
 className="ml-2 flex items-center gap-1 text-sm underline opacity-80 hover:opacity-100"
 title="Retry sync"
 >
 <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
 {syncErrors > 0 ? 'إعادة المحاولة' : ''}
 </button>
 )}
 </div>
 );
 }

 return null;
};

export default OfflineSyncManager;
