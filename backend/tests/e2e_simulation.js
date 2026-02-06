const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // You might need to install this if not native in node environment, but axios handles it.
// Actually form-data package is usually needed for node axios file uploads.
// I'll assume it's available or I'll install it.

const BASE_URL = 'http://localhost:3000/api';

async function runTest() {
    try {
        console.log('=== STARTING E2E TEST ===');

        // 1. Login as Marshal
        console.log('1. Logging in as Marshal...');
        // First send OTP
        await axios.post(`${BASE_URL}/auth/send-otp`, { marshalId: '1001', email: 'sport_marshal@test.com' });
        // Verify OTP
        const marshalRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { marshalId: '1001', otp: '3333' });
        const marshalToken = marshalRes.data.token;
        console.log('   Marshal Logged In. Token acquired.');

        // 2. Create Ticket
        console.log('2. Creating Ticket...');
        const ticketData = {
            eventName: 'Test Event',
            venue: 'Test Venue',
            description: 'E2E Test Incident Description',
            priority: 'MEDIUM',
            type: 'SPORT',
            location: 'Turn 1'
        };
        const ticketRes = await axios.post(`${BASE_URL}/tickets`, ticketData, {
            headers: { Authorization: `Bearer ${marshalToken}` }
        });
        const ticketId = ticketRes.data.id;
        console.log(`   Ticket Created. ID: ${ticketId}`);

        // 3. Upload Attachment
        console.log('3. Uploading Attachment...');
        // Create a dummy image file
        const dummyImagePath = path.join(__dirname, 'test_image.txt');
        fs.writeFileSync(dummyImagePath, 'This is a test image file content acting as image');

        const form = new FormData();
        form.append('files', fs.createReadStream(dummyImagePath), 'test_image.txt');

        await axios.post(`${BASE_URL}/tickets/${ticketId}/attachments`, form, {
            headers: {
                Authorization: `Bearer ${marshalToken}`,
                ...form.getHeaders()
            }
        });
        console.log('   Attachment Uploaded.');

        // 4. Login as Control Ops (Chief) (to process and close)
        console.log('4. Logging in as Chief of Control...');
        await axios.post(`${BASE_URL}/auth/send-otp`, { marshalId: '1003', email: 'chief_control@test.com' });
        const opsRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { marshalId: '1003', otp: '3333' });
        const opsToken = opsRes.data.token;
        console.log('   Chief Logged In.');

        // 5. Update Ticket Status
        console.log('5. Updating Ticket Status to OPEN...');
        await axios.put(`${BASE_URL}/tickets/${ticketId}`, { status: 'OPEN' }, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('   Ticket Opened.');

        // 6. Add Comment
        console.log('6. Adding Comment...');
        await axios.post(`${BASE_URL}/tickets/${ticketId}/comments`, { text: 'Control received. Dispatching.' }, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('   Comment Added.');

        // 7. Close Ticket
        console.log('7. Closing Ticket...');
        await axios.post(`${BASE_URL}/tickets/${ticketId}/close`, { closureReason: 'Resolved by test.' }, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('   Ticket Closed.');

        // 8. Export PDF
        console.log('8. Generating PDF Report...');
        const pdfRes = await axios.post(`${BASE_URL}/tickets/${ticketId}/export-pdf`, {}, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('   PDF Generated.');
        console.log(`   Download URL: ${pdfRes.data.downloadUrl}`);
        console.log(`   Verify URL: ${pdfRes.data.verifyUrl}`);

        console.log('=== TEST PASSED SUCCESSFULLY ===');

    } catch (error) {
        console.error('!!! TEST FAILED !!!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runTest();
