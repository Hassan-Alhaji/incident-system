import React, { useEffect, useState } from 'react';
import { getOfflineTickets, removeOfflineTicket } from '../utils/offlineStore';
import api from '../utils/api';
import { CloudOff, Cloud, RefreshCw } from 'lucide-react';

const OfflineSyncManager = () => {
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [pendingCount, setPendingCount] = useState(0);
 const [isSyncing, setIsSyncing] = useState(false);

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

 try {
 const queue = await getOfflineTickets();
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
 console.error('Failed to sync ticket:', ticket.id, e);
 }
 }
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

 if (!isOnline || pendingCount > 0) {
 return (
 <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg flex items-center gap-3 px-4 py-3 text-base font-bold text-gray-800 transition-all
 ${!isOnline ? 'bg-red-500' : 'bg-yellow-500'}`}
 >
 {!isOnline ? <CloudOff size={20} /> : <Cloud size={20} />}
 <div>
 {!isOnline ? 'Offline Mode' : 'Syncing Data...'}
 {pendingCount > 0 && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-base">{pendingCount} pending</span>}
 </div>
 {isOnline && pendingCount > 0 && (
 <RefreshCw size={16} className={`ml-2 ${isSyncing ? 'animate-spin' : ''}`} />
 )}
 </div>
 );
 }

 return null;
};

export default OfflineSyncManager;
