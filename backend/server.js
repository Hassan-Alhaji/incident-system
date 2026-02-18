const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// *** DEBUG MIDDLEWARE ***
app.use((req, res, next) => {
    console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
const path = require('path'); // Ensure path is required
app.use(express.json());
// Serve uploads from absolute path to ensure consistency regardless of CWD
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// *** HEALTH CHECK (Top Priority) ***
app.get('/api/health', (req, res) => {
    console.log('[DEBUG] Health Check Hit');
    res.status(200).send('OK');
});

// Debug endpoint removed due to Express 5 compatibility issues

// Import Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const reportRoutes = require('./routes/reportRoutes');
const medicalRoutes = require('./routes/medicalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const publicRoutes = require('./routes/publicTicketRoutes');
const eventRoutes = require('./routes/eventRoutes');

// Mount Routes
console.log('[DEBUG] Mounting /api/auth...');
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/verify', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/public', publicRoutes);
app.use('/api/events', eventRoutes);

// Mount medical routes under /api/tickets/:id
app.use('/api/tickets/:id', medicalRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Incident System API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Catch-all for 404s to see what's being missed
app.use((req, res) => {
    console.log(`[DEBUG] 404 Hits: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'Route not found (Debug)', url: req.url });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Keep-alive for some environments
setInterval(() => { }, 1000 * 60);
