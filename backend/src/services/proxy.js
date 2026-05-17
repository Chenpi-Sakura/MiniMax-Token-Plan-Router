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

function processNonStreamResponse(data) {
    if (!data || !data.choices || !data.choices[0]) {
        return data;
    }

    const cloned = JSON.parse(JSON.stringify(data));

    for (const choice of cloned.choices) {
        const message = choice.message;
        if (!message || !message.content) continue;

        const content = message.content;
        const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/g);

        if (thinkingMatch) {
            const reasoningParts = [];
            let processedContent = content;

            for (const match of thinkingMatch) {
                const innerContent = match.replace(/<think>/, '').replace(/<\/think>/, '');
                reasoningParts.push(innerContent);
            }

            if (reasoningParts.length > 0) {
                message.reasoning_content = reasoningParts.join('');
            }

            processedContent = processedContent.replace(/<think>[\s\S]*?<\/think>/g, '');
            message.content = processedContent.trim();
        }
    }

    return cloned;
}

const MINIMAX_OPENAI_TAG_CLOSE = '</think>';
const MINIMAX_OPENAI_TAG_START = '<think>';

function buildResidualChunk(meta) {
    const ts = meta.thinkingState;
    if (!ts.inThinking && !ts.buffer) return null;

    let residual = '';
    if (ts.buffer) {
        residual = ts.buffer;
        ts.buffer = '';
    }
    if (ts.inThinking) {
        ts.inThinking = false;
        const chunk = {
            choices: [{
                delta: { reasoning_content: residual },
                finish_reason: undefined,
                index: 0
            }]
        };
        return `data: ${JSON.stringify(chunk)}\n\n`;
    }
    return null;
}

function splitByThinkingTags(text, inThinking, ts) {
    const results = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (inThinking) {
            const endIdx = remaining.indexOf(MINIMAX_OPENAI_TAG_CLOSE);
            if (endIdx !== -1) {
                const beforeEnd = remaining.slice(0, endIdx);
                if (beforeEnd) {
                    results.push({ type: 'reasoning', content: beforeEnd });
                }
                const afterEnd = remaining.slice(endIdx + MINIMAX_OPENAI_TAG_CLOSE.length);
                results.push({ type: 'tag_close' });
                remaining = afterEnd;
                inThinking = false;
            } else {
                results.push({ type: 'reasoning', content: remaining });
                remaining = '';
            }
        } else {
            const startIdx = remaining.indexOf(MINIMAX_OPENAI_TAG_START);
            if (startIdx !== -1) {
                const beforeStart = remaining.slice(0, startIdx);
                if (beforeStart) {
                    results.push({ type: 'content', content: beforeStart });
                }
                results.push({ type: 'tag_open' });
                remaining = remaining.slice(startIdx + MINIMAX_OPENAI_TAG_START.length);
                inThinking = true;
            } else {
                results.push({ type: 'content', content: remaining });
                remaining = '';
            }
        }
    }

    return results;
}

function transformStreamChunk(line, meta) {
    const trimmedLine = line.trim();
    if (!trimmedLine || !trimmedLine.startsWith('data:')) {
        return [];
    }

    const dataStr = trimmedLine.slice(5).trim();
    if (dataStr === '[DONE]') {
        return ['data: [DONE]\n\n'];
    }

    let chunk;
    try {
        chunk = JSON.parse(dataStr);
    } catch (e) {
        return [`${line}\n\n`];
    }

    if (!chunk.choices || !chunk.choices[0]) {
        return [`${line}\n\n`];
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

    const extractedContent = delta && delta.content;
    if (delta && extractedContent !== undefined) {
        delete choice.delta.content;
    }

    const remainingKeys = delta ? Object.keys(delta).filter(k => k !== 'content' && delta[k] !== undefined && delta[k] !== null) : [];
    const hasRemaining = remainingKeys.length > 0 || (choice.finish_reason !== undefined && choice.finish_reason !== 'stop' && choice.finish_reason !== 'length');

    const outputParts = [];

    if (hasRemaining) {
        const outChunk = {
            choices: [{
                delta: { ...delta },
                finish_reason: choice.finish_reason,
                index: choice.index || 0
            }]
        };
        outputParts.push(`data: ${JSON.stringify(outChunk)}\n\n`);
    }

    if (extractedContent) {
        const text = extractedContent;
        const ts = meta.thinkingState;
        const prefix = ts.buffer;
        const fullText = prefix + text;
        ts.buffer = '';

        if (!ts.inThinking && !ts.buffer) {
            const fullIdx = fullText.indexOf(MINIMAX_OPENAI_TAG_START);
            const partialStartIdx = fullText.indexOf('<');
            if (partialStartIdx !== -1 && (fullIdx === -1 || partialStartIdx < fullIdx)) {
                const beforePartial = fullText.slice(0, partialStartIdx);
                if (beforePartial) {
                    outputParts.push(`data: ${JSON.stringify({ choices: [{ delta: { content: beforePartial }, finish_reason: undefined, index: choice.index || 0 }] })}\n\n`);
                }
                ts.buffer = fullText.slice(partialStartIdx);
                return outputParts;
            }
        }

        if (!ts.inThinking && ts.buffer) {
            const fullIdx = fullText.indexOf(MINIMAX_OPENAI_TAG_START);
            if (fullIdx !== 0) {
                outputParts.push(`data: ${JSON.stringify({ choices: [{ delta: { content: ts.buffer + fullText.slice(0, fullIdx) }, finish_reason: undefined, index: choice.index || 0 }] })}\n\n`);
                ts.buffer = '';
            }
        }

        const segments = splitByThinkingTags(fullText, ts.inThinking, ts);

        for (const seg of segments) {
            if (seg.type === 'content') {
                outputParts.push(`data: ${JSON.stringify({ choices: [{ delta: { content: seg.content }, finish_reason: undefined, index: choice.index || 0 }] })}\n\n`);
            } else if (seg.type === 'reasoning') {
                outputParts.push(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: seg.content }, finish_reason: undefined, index: choice.index || 0 }] })}\n\n`);
            } else if (seg.type === 'tag_open') {
                ts.inThinking = true;
            } else if (seg.type === 'tag_close') {
                ts.inThinking = false;
            }
        }
    }

    return outputParts;
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

            const meta = {
                lastToolCallId: null,
                toolCallArgsBuffer: null,
                thinkingState: { inThinking: false, buffer: '' }
            };

            let streamBuffer = '';

            minimaxResponse.data.on('data', (chunk) => {
                streamBuffer += chunk.toString();
                const lines = streamBuffer.split('\n');
                streamBuffer = lines.pop() || '';

                for (const line of lines) {
                    const results = transformStreamChunk(line, meta);
                    for (const item of results) {
                        if (item) {
                            res.write(item);
                        }
                    }
                }
            });

            minimaxResponse.data.on('end', () => {
                if (streamBuffer.trim()) {
                    const results = transformStreamChunk(streamBuffer, meta);
                    for (const item of results) {
                        if (item) {
                            res.write(item);
                        }
                    }
                }
                const residual = buildResidualChunk(meta);
                if (residual) {
                    res.write(residual);
                }
                res.end();
            });

            minimaxResponse.data.on('error', (err) => {
                console.error('Stream error:', err);
                res.end();
            });
        } else {
            const mappedResponse = mapMinimaxToOpenAI(minimaxResponse.data);
            const processedResponse = processNonStreamResponse(mappedResponse);
            return res.json(processedResponse);
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