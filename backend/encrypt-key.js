#!/usr/bin/env node

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encrypt(plaintext, masterKey) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(masterKey, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

const apiKey = process.argv[2];
const masterKey = process.argv[3];

if (!apiKey || !masterKey) {
    console.log('Usage: node encrypt-key.js <api-key> <master-key>');
    console.log('');
    console.log('Example:');
    console.log('  node encrypt-key.js "your-minimax-api-key" "your-master-key-at-least-32-chars"');
    process.exit(1);
}

if (masterKey.length < 32) {
    console.error('Error: Master key must be at least 32 characters');
    process.exit(1);
}

const encrypted = encrypt(apiKey, masterKey);
console.log('Encrypted API key:');
console.log('enc:' + encrypted);
console.log('');
console.log('Add this to your .env file as ENCRYPTED_MINIMAX_KEY');