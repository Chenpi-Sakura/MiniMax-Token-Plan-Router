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
        db.prepare('INSERT INTO users (username, password_hash, is_admin, quota_limit) VALUES (?, ?, 1, 999999)')
          .run('admin', hash);
        console.log('Default admin user created. Please change the password!');
    }

    return db;
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