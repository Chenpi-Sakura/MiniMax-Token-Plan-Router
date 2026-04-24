const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../models/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(isAdmin);

router.get('/users', (req, res) => {
    try {
        const db = getDb();
        const users = db.prepare(`
            SELECT
                u.id,
                u.username,
                u.is_admin,
                u.quota_limit,
                u.created_at,
                (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id) as key_count,
                (SELECT COALESCE(SUM(quota_used), 0) FROM api_keys WHERE user_id = u.id) as total_usage
            FROM users u
            ORDER BY u.created_at DESC
        `).all();

        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            isAdmin: !!u.is_admin,
            quotaLimit: u.quota_limit,
            keyCount: u.key_count,
            totalUsage: u.total_usage,
            createdAt: u.created_at
        })));
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { username, password, quotaLimit, isAdmin: isAdminFlag } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, is_admin, quota_limit)
            VALUES (?, ?, ?, ?)
        `).run(username, passwordHash, isAdminFlag ? 1 : 0, quotaLimit || 1000);

        res.status(201).json({
            id: result.lastInsertRowid,
            username,
            isAdmin: !!isAdminFlag,
            quotaLimit: quotaLimit || 1000
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { password, quotaLimit, isAdmin: isAdminFlag } = req.body;

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
        }

        if (quotaLimit !== undefined) {
            db.prepare('UPDATE users SET quota_limit = ? WHERE id = ?').run(quotaLimit, id);
        }

        if (isAdminFlag !== undefined) {
            db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdminFlag ? 1 : 0, id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/users/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const db = getDb();
        const result = db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'User not found or cannot delete admin' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;