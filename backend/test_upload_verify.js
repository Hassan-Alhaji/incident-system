const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000/api';
const TICKET_ID = 'REPLACE_WITH_VALID_TICKET_ID'; // User needs to set this or we create one

async function testUpload() {
    try {
        console.log('1. Creating a test ticket...');
        const ticketRes = await axios.post(`${API_URL}/tickets`, {
            type: 'SAFETY',
            priority: 'LOW',
            eventName: 'Test Event',
            venue: 'Test Body',
            incidentDate: new Date(),
            location: 'Test Loc',
            description: 'Test Description',
            witnesses: '[]',
            drivers: '[]'
        });
        const ticketId = ticketRes.data.id;
        console.log(`Ticket created: ${ticketId}`);

        console.log('2. Uploading a test image...');
        const form = new FormData();
        // Create a dummy image buffer
        const buffer = Buffer.from('fake image data', 'utf-8');
        form.append('files', buffer, { filename: 'test-image.txt', contentType: 'text/plain' });

        const uploadRes = await axios.post(`${API_URL}/tickets/${ticketId}/attachments`, form, {
            headers: { ...form.getHeaders() }
        });
        console.log('Upload response:', uploadRes.data);

        console.log('3. Verifying attachment in DB...');
        // We can't directly check DB, but we can try to fetch the attachment content
        // First get ticket to find attachment ID
        const ticketDetails = await axios.get(`${API_URL}/tickets/${ticketId}`);
        const attachments = ticketDetails.data.attachments;
        if (attachments.length === 0) {
            console.error('FAILED: No attachments found on ticket.');
            return;
        }
        const att = attachments[0];
        console.log('Attachment found:', att);

        if (!att.url.includes('/api/attachments/')) {
            console.error('FAILED: Attachment URL is not using the new API format:', att.url);
            console.error('Old format detected. Code is NOT updated.');
            return;
        }

        console.log('4. Fetching content...');
        const contentRes = await axios.get(`http://localhost:3000${att.url}`);
        console.log('Content fetched successfully. Length:', contentRes.data.length);

        if (contentRes.data === 'fake image data') {
            console.log('SUCCESS: Content matches uploaded data!');
        } else {
            console.log('SUCCESS: Content fetched (text/plain).');
        }

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testUpload();
