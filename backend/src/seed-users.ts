/**
 * Seed initial users into PostgreSQL.
 * Matches the existing accounts from Firestore (scripts/seed-users.ts).
 * Usage: npm run seed-users
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'dokcrm',
  user:     process.env.DB_USER     || 'dokcrm',
  password: process.env.DB_PASSWORD || 'dokcrm@local123',
});

const users = [
  { email: 'dokadmin@gmail.com', username: 'dokadmin', displayName: 'DOK Admin',    password: 'dokadmin@123', role: 'admin' },
  { email: 'salesA@gmail.com',   username: 'salesa',   displayName: 'Pradeepa',     password: 'sales@@123',   role: 'sales' },
  { email: 'salesB@gmail.com',   username: 'salesb',   displayName: 'Shanaka',      password: 'SalesB@123',   role: 'sales' },
];

async function seed() {
  console.log('\n🌱 Seeding users...\n');
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    try {
      await pool.query(
        `INSERT INTO users (email, username, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [u.email, u.username, u.displayName, hash, u.role]
      );
      console.log(`  ✅ ${u.email} (${u.role})`);
    } catch (err) {
      console.error(`  ❌ ${u.email}:`, (err as Error).message);
    }
  }
  console.log('\nDone.\n');
  await pool.end();
}

seed();
