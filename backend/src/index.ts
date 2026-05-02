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

// C2: CORS origin from env var — support comma-separated list or regex string
const rawOrigin = process.env.CORS_ORIGIN || '';
const corsOrigin = rawOrigin
  ? rawOrigin.split(',').map(s => s.trim())
  : /^http:\/\/localhost(:\d+)?$/;

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
