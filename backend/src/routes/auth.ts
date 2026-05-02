import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me, forgotPassword, verifyResetToken, resetPassword } from '../controllers/authController';

const router = Router();

// 10 attempts per 15 minutes per IP — prevents brute-force on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

router.post('/login',               loginLimiter,   login);
router.get('/me',                   me);
router.post('/forgot-password',     forgotLimiter,  forgotPassword);
router.post('/verify-reset-token',  resetLimiter,   verifyResetToken);
router.post('/reset-password',      resetLimiter,   resetPassword);

export default router;
