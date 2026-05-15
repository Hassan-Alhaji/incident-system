const axios = require('axios');
async function test() {
  try {
    const login = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@admin.com',
      password: 'password123'
    });
    const token = login.data.token;
    console.log('Login token:', token.slice(0, 10) + '...');
    const res = await axios.post('http://localhost:3000/api/ai/analytics-chat', {
      question: 'What is the top incident?',
      context: '{"totalTickets": 10}',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31'
    }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Success:', res.data);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
