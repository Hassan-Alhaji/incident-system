const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({ id: '7914a8b1-0e23-411b-bfd8-26a322c3dde3', role: 'OPERATION_SAFETY_TEAM' }, process.env.JWT_SECRET || 'secret');
fetch('http://localhost:3000/api/tickets', {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json()).then(data => {
    if (data.map) {
        console.log("SUCCESS! Found:", data.map(t => t.ticketNo));
    } else {
        console.error("FAILED! Response:", data);
    }
}).catch(console.error);
