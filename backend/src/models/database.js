const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/proxy.db');
const INIT_SQL_PATH = path.join(__dirname, '../../init.sql');

let db = null;

function initDatabase() {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSql);

    const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
    if (adminExists.count === 0) {
        const bcrypt = require('bcrypt');
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const hash = bcrypt.hashSync(adminPassword, 10);
        db.prepare('INSERT INTO users (username, password_hash, is_admin, limit_type) VALUES (?, ?, 1, \'unlimited\')')
          .run('admin', hash);
        console.log('Default admin user created. Please change the password!');
    }

    migrateSchema(db);

    return db;
}

function migrateSchema(db) {
    const userTableInfo = db.prepare("PRAGMA table_info('users')").all();
    const hasQuotaLimit = userTableInfo.some(col => col.name === 'quota_limit');
    const hasLimitType = userTableInfo.some(col => col.name === 'limit_type');

    if (hasQuotaLimit && !hasLimitType) {
        db.exec("ALTER TABLE users ADD COLUMN limit_type TEXT DEFAULT 'unlimited'");
        db.exec("ALTER TABLE users ADD COLUMN limit_value INTEGER");
        db.exec("UPDATE users SET limit_type = 'count', limit_value = quota_limit WHERE is_admin = 0");
        db.exec("UPDATE users SET limit_type = 'unlimited' WHERE is_admin = 1");
        console.log('Database schema migrated: added limit_type and limit_value columns.');
    }

    const keyTableInfo = db.prepare("PRAGMA table_info('api_keys')").all();
    const hasQuotaLimitKey = keyTableInfo.some(col => col.name === 'quota_limit');
    if (!hasQuotaLimitKey) {
        db.exec("ALTER TABLE api_keys ADD COLUMN quota_limit INTEGER");
        console.log('Database schema migrated: added quota_limit column to api_keys.');
    }
}

function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

module.exports = {
    initDatabase,
    getDb
};