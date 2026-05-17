const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

function getMasterKey() {
    const key = process.env.MASTER_KEY;
    if (!key) {
        throw new Error('MASTER_KEY environment variable is not set');
    }
    return key.trim();
}

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encrypt(plaintext) {
    const masterKey = getMasterKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(masterKey, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData) {
    const masterKey = getMasterKey();
    const parts = encryptedData.trim().split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3].trim();

    const key = deriveKey(masterKey, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function generateApiKey() {
    const prefix = 'sk_minimax_';
    const randomPart = crypto.randomBytes(16).toString('hex');
    return prefix + randomPart;
}

function maskApiKey(apiKey) {
    if (apiKey.length <= 12) {
        return apiKey.substring(0, 4) + '****';
    }
    return apiKey.substring(0, 12) + '****';
}

module.exports = {
    encrypt,
    decrypt,
    hashApiKey,
    generateApiKey,
    maskApiKey
};