import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, forgotPassword, verifyResetToken, resetPassword } from '../controllers/authController';
import { resolveTenantOptional } from '../middleware/tenantResolver';

const router = Router();

// 10 attempts per 15 minutes per IP — prevents brute-force on login.
// Raised automatically in the test environment, and overridable via
// LOGIN_RATE_LIMIT_MAX so a dockerized dev/e2e stack (which runs NODE_ENV=production)
// can disable throttling for end-to-end tests without weakening real production,
// where the variable is left unset.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'test' ? 10_000 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// 5 reset emails per hour per IP — prevents email spam abuse
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests, please try again later' },
});

// 10 attempts per 15 minutes per IP — prevents token enumeration
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

router.post('/login',               loginLimiter,   resolveTenantOptional, login);
router.post('/logout',              logout);
router.get('/me',                   me);
router.post('/forgot-password',     forgotLimiter,  forgotPassword);
router.post('/verify-reset-token',  resetLimiter,   verifyResetToken);
router.post('/reset-password',      resetLimiter,   resetPassword);

export default router;
