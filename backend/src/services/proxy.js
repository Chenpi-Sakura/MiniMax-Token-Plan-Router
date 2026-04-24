const axios = require('axios');
const { getDb } = require('../models/database');
const { decrypt } = require('../utils/crypto');

const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat';
const MINIMAX_API_PATH = '/v1/text/chatcompletion_v2';

async function proxyRequest(req, res) {
    const keyRecord = req.apiKeyRecord;
    const apiKey = extractMasterKey();

    if (!apiKey) {
        console.error('Master API key not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const model = req.body.model || 'abab5.5-chat';
    const messages = req.body.messages;

    if (!messages) {
        return res.status(400).json({ error: 'Messages are required' });
    }

    try {
        const startTime = Date.now();

        const minimaxResponse = await axios.post(
            `${MINIMAX_API_URL}${MINIMAX_API_PATH}`,
            {
                model: model,
                messages: messages,
                stream: req.body.stream || false,
                max_tokens: req.body.max_tokens,
                temperature: req.body.temperature,
                top_p: req.body.top_p
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000,
                responseType: req.body.stream ? 'stream' : 'json'
            }
        );

        const db = getDb();
        db.prepare(`
            UPDATE api_keys SET quota_used = quota_used + 1 WHERE id = ?
        `).run(keyRecord.id);

        db.prepare(`
            INSERT INTO request_logs (user_id, api_key_id, model, status, ip_address)
            VALUES (?, ?, ?, ?, ?)
        `).run(keyRecord.user_id, keyRecord.id, model, 'success', req.ip);

        if (req.body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            minimaxResponse.data.on('data', (chunk) => {
                res.write(chunk);
            });

            minimaxResponse.data.on('end', () => {
                res.end();
            });

            minimaxResponse.data.on('error', (err) => {
                console.error('Stream error:', err);
                res.end();
            });
        } else {
            res.json(minimaxResponse.data);
        }

    } catch (error) {
        const db = getDb();
        db.prepare(`
            INSERT INTO request_logs (user_id, api_key_id, model, status, ip_address)
            VALUES (?, ?, ?, ?, ?)
        `).run(keyRecord.user_id, keyRecord.id, req.body.model || 'unknown', 'error', req.ip);

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        console.error('MiniMax proxy error:', error);
        res.status(500).json({ error: 'Proxy request failed' });
    }
}

function extractMasterKey() {
    const encryptedKey = process.env.ENCRYPTED_MINIMAX_KEY;
    const plainKey = process.env.MINIMAX_API_KEY;

    if (encryptedKey) {
        try {
            if (encryptedKey.startsWith('enc:')) {
                return decrypt(encryptedKey.substring(4));
            }
            return encryptedKey;
        } catch (error) {
            console.error('Failed to decrypt master key:', error);
            return null;
        }
    }

    if (plainKey) {
        return plainKey;
    }

    return null;
}

module.exports = {
    proxyRequest
};