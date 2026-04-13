import localforage from 'localforage';

localforage.config({
    name: 'IncidentSystemOfflineDB',
    storeName: 'ticketsQueue'
});

export interface OfflineTicket {
    id: string; // Temporary unique ID
    payload: any; // The main incident data
    attachments: File[]; // Raw file objects
    timestamp: number;
}

export const saveOfflineTicket = async (ticketData: OfflineTicket) => {
    try {
        const queue: OfflineTicket[] = (await localforage.getItem('pendingTickets')) || [];
        queue.push(ticketData);
        await localforage.setItem('pendingTickets', queue);
        return true;
    } catch (error) {
        console.error('Failed to save ticket offline:', error);
        return false;
    }
};

export const getOfflineTickets = async (): Promise<OfflineTicket[]> => {
    return (await localforage.getItem('pendingTickets')) || [];
};

export const clearOfflineTickets = async () => {
    await localforage.setItem('pendingTickets', []);
};

export const removeOfflineTicket = async (id: string) => {
    let queue: OfflineTicket[] = (await localforage.getItem('pendingTickets')) || [];
    queue = queue.filter(t => t.id !== id);
    await localforage.setItem('pendingTickets', queue);
};
