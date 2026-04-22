/**
 * Simple input sanitizer middleware
 * Strips dangerous HTML/script tags from string inputs in req.body
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')  // Remove inline event handlers
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')  // Remove inline event handlers (single quotes)
        .replace(/javascript\s*:/gi, '')         // Remove javascript: protocol
        .trim();
};

const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            cleaned[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = sanitizeObject(value);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
};

const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
};

module.exports = { sanitizeInput, sanitizeString };
