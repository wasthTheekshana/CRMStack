import { createHash, randomBytes } from 'crypto';
import { query } from '../config/db';

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return rawToken;
}

export async function findValidToken(rawToken: string): Promise<{ userId: string } | null> {
  const tokenHash = sha256(rawToken);
  const result = await query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  if (!result.rows[0]) return null;
  return { userId: result.rows[0].user_id };
}

export async function markTokenUsed(rawToken: string): Promise<void> {
  const tokenHash = sha256(rawToken);
  await query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
}

// Atomically claims the token: marks it used and returns userId in one UPDATE.
// Returns null if the token doesn't exist, is already used, or has expired.
// Use this in resetPassword instead of findValidToken + markTokenUsed to eliminate the TOCTOU race.
export async function claimToken(rawToken: string): Promise<{ userId: string } | null> {
  const tokenHash = sha256(rawToken);
  const result = await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  if (!result.rows[0]) return null;
  return { userId: result.rows[0].user_id };
}

export async function deleteExpiredTokens(): Promise<void> {
  await query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
}
