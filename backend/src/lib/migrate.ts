/**
 * Run pending SQL migration files in order.
 * Tracks applied migrations in schema_migrations table.
 * Each file is wrapped in a transaction so partial failures roll back cleanly.
 * Usage: npm run migrate
 */
import fs from 'fs';
import path from 'path';
import { pool } from './db';

async function migrate() {
  // H8: Create migration tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '../../migrations');
  const allFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set<string>(applied.rows.map((r: { filename: string }) => r.filename));
  const pending = allFiles.filter(f => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log('All migrations already applied.');
    await pool.end();
    return;
  }

  console.log(`Running ${pending.length} pending migration(s)...\n`);

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  ▶ ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✅ Done\n`);
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      console.error(`  ❌ Failed: ${(err as Error).message}\n`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log('All migrations complete.');
  await pool.end();
}

migrate();
