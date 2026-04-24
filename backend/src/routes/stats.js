const express = require('express');
const { getDb } = require('../models/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);

router.get('/', (req, res) => {
    try {
        const db = getDb();
        const period = req.query.period || '7d';
        let dateFilter = '';

        switch (period) {
            case '24h':
                dateFilter = "WHERE created_at >= datetime('now', '-1 day')";
                break;
            case '7d':
                dateFilter = "WHERE created_at >= datetime('now', '-7 days')";
                break;
            case '30d':
                dateFilter = "WHERE created_at >= datetime('now', '-30 days')";
                break;
            default:
                dateFilter = '';
        }

        let stats;
        if (req.session.isAdmin) {
            stats = db.prepare(`
                SELECT
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_requests,
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM api_keys WHERE is_active = 1) as active_keys
                FROM request_logs
                ${dateFilter}
            `).get();

            const dailyStats = db.prepare(`
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as requests,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
                FROM request_logs
                ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `).all();

            const topUsers = db.prepare(`
                SELECT
                    u.username,
                    COUNT(*) as requests
                FROM request_logs rl
                JOIN users u ON rl.user_id = u.id
                ${dateFilter ? dateFilter.replace('WHERE', 'WHERE rl.') : ''}
                GROUP BY u.id, u.username
                ORDER BY requests DESC
                LIMIT 10
            `).all();

            stats.dailyStats = dailyStats;
            stats.topUsers = topUsers;
        } else {
            stats = db.prepare(`
                SELECT
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_requests
                FROM request_logs
                WHERE user_id = ?
                ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}
            `).get(req.session.userId);

            stats.quotaUsed = db.prepare(`
                SELECT COALESCE(SUM(quota_used), 0) as used
                FROM api_keys
                WHERE user_id = ?
            `).get(req.session.userId).used;

            const user = db.prepare('SELECT quota_limit FROM users WHERE id = ?')
                .get(req.session.userId);
            stats.quotaLimit = user ? user.quota_limit : 0;
        }

        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/logs', (req, res) => {
    try {
        const db = getDb();
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        let logs;
        let total;

        if (req.session.isAdmin) {
            logs = db.prepare(`
                SELECT
                    rl.*,
                    u.username,
                    ak.key_prefix
                FROM request_logs rl
                JOIN users u ON rl.user_id = u.id
                LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
                ORDER BY rl.created_at DESC
                LIMIT ? OFFSET ?
            `).all(limit, offset);

            total = db.prepare('SELECT COUNT(*) as count FROM request_logs').get().count;
        } else {
            logs = db.prepare(`
                SELECT
                    rl.*,
                    ak.key_prefix
                FROM request_logs rl
                LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
                WHERE rl.user_id = ?
                ORDER BY rl.created_at DESC
                LIMIT ? OFFSET ?
            `).all(req.session.userId, limit, offset);

            total = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE user_id = ?')
                .get(req.session.userId).count;
        }

        res.json({
            logs: logs.map(l => ({
                id: l.id,
                username: l.username,
                keyPrefix: l.key_prefix,
                model: l.model,
                status: l.status,
                ipAddress: l.ip_address,
                createdAt: l.created_at
            })),
            total,
            limit,
            offset
        });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;