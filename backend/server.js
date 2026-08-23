const express = require('express');
const path = require('path');
const logger = require('./lib/logger');
const cors = require('cors');
const compression = require('compression');
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
        logger.info(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
        next();
    });
}

// Middleware — CORS
// In production: only explicit FRONTEND_URL is allowed.
// In development: allow localhost + LAN IPs (for mobile testing on the same network).
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin / curl / server-to-server
        const allowed = [];
        if (!isProd) {
            allowed.push(
                /^http:\/\/localhost(:\d+)?$/,
                /^http:\/\/127\.0\.0\.1(:\d+)?$/,
                /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,           // LAN class C (dev only)
                /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,             // LAN class A (dev only)
                /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/ // LAN class B (dev only)
            );
        }
        if (process.env.FRONTEND_URL) allowed.push(process.env.FRONTEND_URL);
        const ok = allowed.some(r => r instanceof RegExp ? r.test(origin) : r === origin);
        cb(null, ok);
    },
    credentials: true
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProd ? {
        directives: {
            defaultSrc: ["'self'"],
            // 'unsafe-inline' kept for scripts because some build artifacts emit inline JSON; no 'unsafe-eval'
            scriptSrc: ["'self'", "'unsafe-inline'"],
            // Tailwind / Vite emit inline styles → 'unsafe-inline' is required for styles
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            // connectSrc restricted to self + explicit FRONTEND_URL + tile servers
            connectSrc: [
                "'self'",
                ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
                ...(process.env.API_URL ? [process.env.API_URL] : []),
                "https://*.tile.openstreetmap.org",
            ],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
        }
    } : false
}));
app.use(compression()); // Gzip/Brotli compress all responses
app.use(morgan(isProd ? 'combined' : 'dev'));
// Skip JSON parsing for multipart uploads so Multer gets the raw stream
app.use((req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.startsWith('multipart/form-data')) return next();
    express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const { sanitizeInput } = require('./middleware/sanitizeMiddleware');
const { csrfProtection } = require('./middleware/csrfMiddleware');
app.use('/api', sanitizeInput);    // Sanitize API inputs (body, query, params)
app.use('/api', csrfProtection);   // B2: CSRF origin validation for state-changing requests
// Serve uploads from absolute path to ensure consistency regardless of CWD
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiting
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 attempts per IP
    message: { message: 'Too many authentication attempts. Please try again after 1 minute.' },
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

const prisma = require('./prismaClient');

// *** HEALTH CHECK (Top Priority) ***
const healthCheck = async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'OK', database: 'connected' });
    } catch (error) {
        logger.error({ err: error }, 'Health check database failure');
        res.status(503).json({ status: 'ERROR', database: 'disconnected' });
    }
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck); // Alias for Render and external monitoring


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
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.get('/', (req, res) => {
    res.json({
        message: 'Incident System API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Catch-all for 404s
app.use((req, res) => {
    if (!isProd) logger.info(`[DEBUG] 404: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'Route not found', url: req.url });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);

        // Keep-alive: ping self every 14 minutes to prevent Render free tier sleep
        if (isProd) {
            const https = require('https');
            const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://incident-system-api.onrender.com`;
            setInterval(() => {
                https.get(`${SELF_URL}/api/health`, (res) => {
                    logger.info(`[Keep-Alive] Pinged /api/health → ${res.statusCode}`);
                }).on('error', (err) => {
                    logger.warn({ err }, '[Keep-Alive] Ping failed');
                });
            }, 14 * 60 * 1000); // every 14 minutes
        }
    });
}

module.exports = app;
