import { query } from '../config/db';

export interface DokAdmin {
  id:          string;
  email:       string;
  displayName: string;
  passwordHash: string;
  isActive:    boolean;
  createdAt:   Date;
  lastLoginAt: Date | null;
}

const mapAdmin = (row: Record<string, unknown>): DokAdmin => ({
  id:           row.id as string,
  email:        row.email as string,
  displayName:  row.display_name as string,
  passwordHash: row.password_hash as string,
  isActive:     row.is_active as boolean,
  createdAt:    row.created_at as Date,
  lastLoginAt:  row.last_login_at as Date | null,
});

export async function findAdminByEmail(email: string): Promise<DokAdmin | null> {
  const result = await query(
    'SELECT * FROM dok_admins WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase().trim()]
  );
  return result.rows.length ? mapAdmin(result.rows[0]) : null;
}

export async function updateAdminLastLogin(id: string): Promise<void> {
  await query(
    'UPDATE dok_admins SET last_login_at = NOW() WHERE id = $1',
    [id]
  );
}

export async function createAdmin(data: {
  email:       string;
  displayName: string;
  passwordHash: string;
}): Promise<DokAdmin> {
  const result = await query(
    `INSERT INTO dok_admins (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.email.toLowerCase().trim(), data.displayName, data.passwordHash]
  );
  return mapAdmin(result.rows[0]);
}
