import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/init';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '30d').trim() || '30d';
const loginRateLimitWindowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const loginRateLimitMax = Number(process.env.LOGIN_RATE_LIMIT_MAX || 8);

const loginAttemptLimiter = createRateLimiter({
  windowMs: Number.isFinite(loginRateLimitWindowMs) && loginRateLimitWindowMs > 0
    ? loginRateLimitWindowMs
    : 15 * 60 * 1000,
  max: Number.isFinite(loginRateLimitMax) && loginRateLimitMax > 0 ? loginRateLimitMax : 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const username = typeof req.body?.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : 'unknown';
    return `${req.ip}:${username || 'unknown'}`;
  },
  message: { error: 'Too many login attempts, please try again later.' },
});

// Register (invite-only)
router.post('/register', async (_req, res) => {
  return res.status(403).json({ error: 'Registration is invite-only. Please use your personal invite link.' });
});

// Login
router.post('/login', loginAttemptLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUsername = String(username).trim().toLowerCase();

    // Find user
    const user = db.prepare(
      'SELECT id, username, email, password, name, nickname, role, profile_picture, phone_number FROM users WHERE LOWER(username) = ?'
    ).get(normalizedUsername) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.error(`Invalid password for user: ${normalizedUsername}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        role: user.role,
        profile_picture: user.profile_picture,
        phone_number: user.phone_number
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = db.prepare(
      'SELECT id, username, email, name, nickname, role, profile_picture, phone_number, created_at FROM users WHERE id = ?'
    ).get(decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
