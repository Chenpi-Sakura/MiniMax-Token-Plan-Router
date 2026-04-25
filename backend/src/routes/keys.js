const express = require('express');
const { getDb } = require('../models/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { generateApiKey, hashApiKey, maskApiKey } = require('../utils/crypto');

const router = express.Router();

router.use(isAuthenticated);

router.get('/', (req, res) => {
    try {
        const db = getDb();
        let keys;

        if (req.session.isAdmin) {
            keys = db.prepare(`
                SELECT ak.*, u.username
                FROM api_keys ak
                JOIN users u ON ak.user_id = u.id
                ORDER BY ak.created_at DESC
            `).all();
        } else {
            keys = db.prepare(`
                SELECT * FROM api_keys
                WHERE user_id = ?
                ORDER BY created_at DESC
            `).all(req.session.userId);
        }

        res.json(keys.map(k => ({
            id: k.id,
            userId: k.user_id,
            username: k.username,
            keyPrefix: k.key_prefix,
            maskedKey: maskApiKey(k.key_prefix),
            name: k.name,
            quotaUsed: k.quota_used,
            quotaLimit: k.quota_limit,
            expiresAt: k.expires_at,
            isActive: !!k.is_active,
            createdAt: k.created_at
        })));
    } catch (error) {
        console.error('Get keys error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', (req, res) => {
    try {
        const { name, userId, expiresAt, quotaLimit } = req.body;

        const db = getDb();
        const targetUserId = req.session.isAdmin && userId ? userId : req.session.userId;

        if (req.session.isAdmin && userId) {
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 12);

        const result = db.prepare(`
            INSERT INTO api_keys (user_id, key_hash, key_prefix, name, quota_limit, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(targetUserId, keyHash, keyPrefix, name || null, quotaLimit || null, expiresAt || null);

        res.status(201).json({
            id: result.lastInsertRowid,
            apiKey: apiKey,
            keyPrefix: keyPrefix,
            name: name || null,
            quotaLimit: quotaLimit || null,
            expiresAt: expiresAt || null,
            message: 'Store this API key securely. It will not be shown again.'
        });
    } catch (error) {
        console.error('Create key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const db = getDb();
        const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        if (!req.session.isAdmin && key.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id/toggle', (req, res) => {
    try {
        const { id } = req.params;

        const db = getDb();
        const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        if (!req.session.isAdmin && key.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ?')
            .run(key.is_active ? 0 : 1, id);

        res.json({ success: true, isActive: !key.is_active });
    } catch (error) {
        console.error('Toggle key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;