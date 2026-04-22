const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Debug logging (dev only) — Point #13
if (!isProd) {
    app.use((req, res, next) => {
        console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
        next();
    });
}

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan(isProd ? 'combined' : 'dev'));
const path = require('path');
app.use(express.json({ limit: '10mb' })); // Limit request body size
const { sanitizeInput } = require('./middleware/sanitizeMiddleware');
app.use(sanitizeInput); // Sanitize all inputs
// Serve uploads from absolute path to ensure consistency regardless of CWD
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiting — Point #5
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { message: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// *** HEALTH CHECK (Top Priority) ***
app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const notificationRoutes = require('./routes/notificationRoutes');
const eventRoutes = require('./routes/eventRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', ticketRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/zones', require('./routes/zoneRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/service-providers', require('./routes/serviceProviderRoutes'));

app.get('/', (req, res) => {
    res.json({
        message: 'Incident System API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Catch-all for 404s
app.use((req, res) => {
    if (!isProd) console.log(`[DEBUG] 404: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'Route not found', url: req.url });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
    setInterval(() => { }, 1000 * 60);
}

module.exports = app;
