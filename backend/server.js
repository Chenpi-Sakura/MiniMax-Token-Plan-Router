require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./src/models/database');
const { isAuthenticated, isAdmin } = require('./src/middleware/auth');
const { createRateLimiter, quotaChecker } = require('./src/middleware/rateLimiter');
const { proxyRequest } = require('./src/services/proxy');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const keyRoutes = require('./src/routes/keys');
const statsRoutes = require('./src/routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: process.env.DB_DIR || path.join(__dirname, 'data')
    }),
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/admin', userRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/stats', statsRoutes);

app.post('/v1/chat/completions',
    quotaChecker,
    createRateLimiter(60000, 60),
    proxyRequest
);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`MiniMax Proxy Server running on port ${PORT}`);
    console.log(`Default admin credentials: admin / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
});

module.exports = app;