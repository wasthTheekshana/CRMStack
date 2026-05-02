import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index';
import { startScheduler } from './scheduler';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', db: 'postgresql' }));
app.use('/api', apiRoutes);

startScheduler();

app.listen(PORT, () => {
  console.log(`\n  DOK CRM Backend running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);
});
