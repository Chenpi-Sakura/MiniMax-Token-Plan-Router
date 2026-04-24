const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../models/database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = !!user.is_admin;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                isAdmin: !!user.is_admin,
                quotaLimit: user.quota_limit
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

router.get('/me', isAuthenticated, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT id, username, is_admin, quota_limit, created_at FROM users WHERE id = ?')
        .get(req.session.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        username: user.username,
        isAdmin: !!user.is_admin,
        quotaLimit: user.quota_limit,
        createdAt: user.created_at
    });
});

module.exports = router;