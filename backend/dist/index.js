"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
require("./database/init");
const rateLimit_1 = require("./middleware/rateLimit");
const auth_1 = __importDefault(require("./routes/auth"));
const teams_1 = __importDefault(require("./routes/teams"));
const events_1 = __importDefault(require("./routes/events"));
const stats_1 = __importDefault(require("./routes/stats"));
const invites_1 = __importDefault(require("./routes/invites"));
const admin_1 = __importDefault(require("./routes/admin"));
const profile_1 = __importDefault(require("./routes/profile"));
const settings_1 = __importDefault(require("./routes/settings"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const apiRateLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 300);
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
const corsOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const apiLimiter = (0, rateLimit_1.createRateLimiter)({
    windowMs: Number.isFinite(apiRateLimitWindowMs) && apiRateLimitWindowMs > 0
        ? apiRateLimitWindowMs
        : 15 * 60 * 1000,
    max: Number.isFinite(apiRateLimitMax) && apiRateLimitMax > 0 ? apiRateLimitMax : 300,
    message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = (0, rateLimit_1.createRateLimiter)({
    windowMs: Number.isFinite(apiRateLimitWindowMs) && apiRateLimitWindowMs > 0
        ? apiRateLimitWindowMs
        : 15 * 60 * 1000,
    max: Number.isFinite(authRateLimitMax) && authRateLimitMax > 0 ? authRateLimitMax : 20,
    message: { error: 'Too many auth attempts, please try again later.' },
});
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
// Middleware
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
if (corsOrigins.length > 0) {
    app.use((0, cors_1.default)({ origin: corsOrigins }));
}
else {
    app.use((0, cors_1.default)());
}
app.use(express_1.default.json());
app.use('/api', apiLimiter);
// Serve uploaded files
app.use('/uploads', express_1.default.static('uploads'));
// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'sqadX.app API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            teams: {
                list: 'GET /api/teams',
                create: 'POST /api/teams',
                details: 'GET /api/teams/:id',
                members: 'GET /api/teams/:id/members'
            },
            events: {
                list: 'GET /api/events?team_id=:id',
                create: 'POST /api/events',
                details: 'GET /api/events/:id',
                respond: 'POST /api/events/:id/response'
            },
            stats: {
                team: 'GET /api/stats/team/:id',
                player: 'GET /api/stats/player/:id'
            }
        },
        documentation: 'See README.md for complete API documentation'
    });
});
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/teams', teams_1.default);
app.use('/api/events', events_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/profile', profile_1.default);
app.use('/api', invites_1.default);
// File upload endpoint
app.post('/api/admin/upload/logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        const logoPath = `/uploads/${req.file.filename}`;
        const db = require('./database/init').default;
        db.prepare(`
      UPDATE organizations 
      SET logo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(logoPath);
        const org = db.prepare('SELECT * FROM organizations WHERE id = 1').get();
        res.json(org);
    }
    catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map