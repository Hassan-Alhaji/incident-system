/**
 * B2: CSRF Protection Middleware - Origin/Referer header validation
 * JWT is in Authorization header (not cookies), so traditional CSRF tokens are
 * not required. This adds a defense-in-depth layer by validating request origin.
 */
const logger = require('../lib/logger');
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const EXCLUDED_PATHS = [
    '/api/auth/otp/request',
    '/api/auth/otp/verify',
    '/api/auth/register',
    '/api/health',
    '/health',
];

const csrfProtection = (req, res, next) => {
    if (!STATE_CHANGING_METHODS.includes(req.method)) return next();
    if (EXCLUDED_PATHS.some(p => req.path === p || req.originalUrl.startsWith(p))) return next();

    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    let source = origin;
    if (!source && referer) {
        try { source = new URL(referer).origin; } catch(_) {}
    }

    // No origin header = server-to-server or same-origin curl; allow
    if (!source) return next();

    const normalizedSource = source.replace(/\/$/, '');
    const allowed = new Set();
    if (process.env.FRONTEND_URL) allowed.add(process.env.FRONTEND_URL.replace(/\/$/, ''));

    if (process.env.NODE_ENV !== 'production') {
        ['http://localhost:5173','http://localhost:3000','http://localhost:4173'].forEach(o => allowed.add(o));
        if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/
            .test(normalizedSource)) return next();
    }

    if (!allowed.has(normalizedSource)) {
        logger.warn({ source, method: req.method, path: req.originalUrl }, 'CSRF: Origin not allowed');
        return res.status(403).json({ message: 'Forbidden: invalid request origin.' });
    }
    next();
};

module.exports = { csrfProtection };
