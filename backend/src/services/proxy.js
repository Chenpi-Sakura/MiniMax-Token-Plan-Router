const axios = require('axios');
const { getDb } = require('../models/database');
const { decrypt } = require('../utils/crypto');

const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat';
const MINIMAX_API_PATH = '/v1/chat/completions';

let toolCallCounter = 0;
function generateToolCallId() {
    return `call_${Date.now()}_${++toolCallCounter}`;
}

function mapMinimaxToOpenAI(response) {
    if (!response || !response.choices || !response.choices[0]) {
        return response;
    }

    const choice = response.choices[0];
    const message = choice.message;

    if (message && message.tool_calls && message.tool_calls.length > 0) {
        choice.finish_reason = 'tool_calls';

        message.tool_calls = message.tool_calls.map(tc => {
            if (!tc.id || !tc.id.startsWith('call_')) {
                tc.id = tc.id || generateToolCallId();
            }
            if (!tc.type) {
                tc.type = 'function';
            }
            if (!tc.function) {
                tc.function = { name: '', arguments: '{}' };
            }
            if (typeof tc.function.arguments === 'object') {
                tc.function.arguments = JSON.stringify(tc.function.arguments);
            } else if (typeof tc.function.arguments !== 'string') {
                tc.function.arguments = '{}';
            }
            return tc;
        });
    }

    return response;
}

function transformStreamChunk(chunkStr, meta) {
    if (!chunkStr || typeof chunkStr !== 'string') {
        return null;
    }

    const line = chunkStr.trim();
    if (!line.startsWith('data:')) {
        return null;
    }

    const dataStr = line.slice(5).trim();
    if (dataStr === '[DONE]') {
        return 'data: [DONE]\n\n';
    }

    try {
        const chunk = JSON.parse(dataStr);
        if (!chunk.choices || !chunk.choices[0]) {
            return chunkStr;
        }

        const choice = chunk.choices[0];
        const delta = choice.delta;

        if (delta && delta.tool_calls && delta.tool_calls.length > 0) {
            for (const tc of delta.tool_calls) {
                if (!tc.id || !tc.id.startsWith('call_')) {
                    tc.id = tc.id || (meta.lastToolCallId = meta.lastToolCallId || generateToolCallId());
                }
                if (!tc.type) {
                    tc.type = 'function';
                }
                if (tc.function) {
                    if (typeof tc.function.arguments === 'object' && tc.function.arguments !== null) {
                        meta.toolCallArgsBuffer = meta.toolCallArgsBuffer || {};
                        Object.assign(meta.toolCallArgsBuffer, tc.function.arguments);
                        tc.function.arguments = JSON.stringify(meta.toolCallArgsBuffer);
                    } else if (typeof tc.function.arguments === 'string' && tc.function.arguments) {
                        try {
                            const parsed = JSON.parse(tc.function.arguments);
                            meta.toolCallArgsBuffer = meta.toolCallArgsBuffer || {};
                            Object.assign(meta.toolCallArgsBuffer, parsed);
                            tc.function.arguments = JSON.stringify(meta.toolCallArgsBuffer);
                        } catch {
                            tc.function.arguments = tc.function.arguments;
                        }
                    }
                }
            }
        }

        if (delta && delta.tool_calls && delta.tool_calls.length > 0) {
            if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
                choice.finish_reason = 'tool_calls';
            }
        }

        return `data: ${JSON.stringify(chunk)}\n\n`;
    } catch (e) {
        return chunkStr;
    }
}

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

    const requestPayload = {
        model: model,
        messages: messages,
        stream: req.body.stream || false,
        max_tokens: req.body.max_tokens,
        temperature: req.body.temperature,
        top_p: req.body.top_p
    };

    if (req.body.tools) {
        requestPayload.tools = req.body.tools;
    }

    if (req.body.tool_choice) {
        requestPayload.tool_choice = req.body.tool_choice;
    } else {
        requestPayload.tool_choice = { type: 'auto' };
    }

    try {
        const startTime = Date.now();

        const minimaxResponse = await axios.post(
            `${MINIMAX_API_URL}${MINIMAX_API_PATH}`,
            requestPayload,
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
            res.setHeader('X-Content-Type-Options', 'nosniff');

            const meta = { lastToolCallId: null, toolCallArgsBuffer: null };

            minimaxResponse.data.on('data', (chunk) => {
                const chunkStr = chunk.toString();
                const lines = chunkStr.split('\n');

                for (const line of lines) {
                    const transformed = transformStreamChunk(line, meta);
                    if (transformed) {
                        res.write(transformed);
                    }
                }
            });

            minimaxResponse.data.on('end', () => {
                res.end();
            });

            minimaxResponse.data.on('error', (err) => {
                console.error('Stream error:', err);
                res.end();
            });
        } else {
            const mappedResponse = mapMinimaxToOpenAI(minimaxResponse.data);
            res.json(mappedResponse);
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