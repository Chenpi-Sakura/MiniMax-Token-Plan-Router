const { getDb } = require('../models/database');

function createRateLimiter(windowMs = 60000, maxRequests = 60) {
    const requests = new Map();

    return function rateLimiter(req, res, next) {
        const userId = req.session.userId;
        if (!userId) {
            return next();
        }

        const now = Date.now();
        const key = `rate_${userId}`;
        const record = requests.get(key) || { count: 0, resetTime: now + windowMs };

        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + windowMs;
            requests.set(key, record);
        } else {
            record.count++;
            requests.set(key, record);
        }

        if (record.count > maxRequests) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter);
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: retryAfter
            });
        }

        res.set('X-RateLimit-Limit', maxRequests);
        res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
        res.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

        next();
    };
}

function quotaChecker(req, res, next) {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    const db = getDb();
    const keyHash = require('../utils/crypto').hashApiKey(apiKey);

    const keyRecord = db.prepare(`
        SELECT ak.*, u.quota_limit as user_quota_limit, u.is_admin
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = ? AND ak.is_active = 1
    `).get(keyHash);

    if (!keyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return res.status(401).json({ error: 'API key expired' });
    }

    if (!keyRecord.is_admin && keyRecord.quota_used >= keyRecord.user_quota_limit) {
        return res.status(403).json({ error: 'Quota exceeded' });
    }

    req.apiKeyRecord = keyRecord;
    next();
}

function extractApiKey(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

module.exports = {
    createRateLimiter,
    quotaChecker,
    extractApiKey
};