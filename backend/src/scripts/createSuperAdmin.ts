import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query } from '../config/db';

dotenv.config();

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('\n  DOK CRM — Create Super Admin\n');

  const email       = await ask('  Email:        ');
  const displayName = await ask('  Display Name: ');
  const password    = await ask('  Password:     ');

  if (!email || !displayName || !password) {
    console.error('\n  All fields are required.\n');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO dok_admins (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       display_name  = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       is_active     = TRUE`,
    [email.toLowerCase().trim(), displayName, passwordHash]
  );

  console.log(`\n  Super admin created: ${email}\n`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  Error:', err.message, '\n');
  process.exit(1);
});
