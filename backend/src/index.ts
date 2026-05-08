import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRoutes from './routes/index';
import { startScheduler } from './scheduler';

dotenv.config();

// H4: Fail fast if critical env vars are missing
const REQUIRED_ENV = ['JWT_SECRET', 'SA_JWT_SECRET', 'DB_PASSWORD'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 4000;

// Trust the nginx proxy (needed for rate-limiter IP detection behind reverse proxy)
app.set('trust proxy', 1);

// H3: Security headers
app.use(helmet());

// C2: CORS — allow static origins from CORS_ORIGIN env var plus any subdomain of
// CORS_BASE_DOMAIN (e.g. "crmstack.site") so tenant subdomains don't need to be
// enumerated individually.
const staticOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const baseDomain = process.env.TENANT_BASE_DOMAIN || process.env.CORS_BASE_DOMAIN || '';
const tenantSubdomainRe = baseDomain
  ? new RegExp(`^https://[a-z0-9-]+\\.${baseDomain.replace(/\./g, '\\.')}$`)
  : null;

const corsOrigin: cors.CorsOptions['origin'] = (origin, callback) => {
  if (!origin) return callback(null, true); // server-to-server / curl
  if (staticOrigins.includes(origin)) return callback(null, true);
  if (tenantSubdomainRe?.test(origin)) return callback(null, true);
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
};

app.use(cors({ origin: corsOrigin, credentials: true }));

// M7: Parse cookies for httpOnly JWT auth
app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', db: 'postgresql' }));
app.use('/api', apiRoutes);

startScheduler();

app.listen(PORT, () => {
  console.log(`\n  CRM STACK Backend running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);
});
