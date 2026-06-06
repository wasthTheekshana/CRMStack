# Phase 5 — Password Reset & Email Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-service password reset for all users via Outlook SMTP email, with single-use time-limited tokens stored in a dedicated DB table.

**Architecture:** Three new backend endpoints (`forgot-password`, `verify-reset-token`, `reset-password`) backed by a `password_reset_tokens` table and a nodemailer email service. Two new frontend pages (ForgotPasswordPage, ResetPasswordPage) plus a "Forgot password?" link in LoginForm. Token is a random 32-byte hex string; only its SHA-256 hash is stored in the DB.

**Tech Stack:** Express + TypeScript + PostgreSQL (backend), React 18 + React Router + shadcn/ui (frontend), nodemailer with Outlook SMTP.

**Note:** This project is NOT a git repository — skip all git/commit steps. No test infrastructure exists — use TypeScript compilation as the verification step.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/migrations/012_password_reset_tokens.sql` | Create | New table for reset tokens |
| `backend/src/models/resetTokenModel.ts` | Create | Token CRUD: create, find valid, mark used, delete expired |
| `backend/src/services/emailService.ts` | Create | Nodemailer wrapper; exports `sendPasswordResetEmail` |
| `backend/src/controllers/authController.ts` | Modify | Add `forgotPassword`, `verifyResetToken`, `resetPassword` handlers |
| `backend/src/routes/auth.ts` | Modify | Wire three new public routes |
| `backend/.env` | Modify | Add SMTP_* and APP_BASE_URL vars |
| `frontend/src/lib/api/authApi.ts` | Create | Three API functions: forgotPassword, verifyResetToken, resetPassword |
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | Create | Email input form + success state |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | Create | Token verification on mount + new password form |
| `frontend/src/components/auth/LoginForm.tsx` | Modify | Add "Forgot password?" link |
| `frontend/src/App.tsx` | Modify | Add two public routes: `/forgot-password`, `/reset-password` |

---

### Task 1: Database — `password_reset_tokens` migration

**Files:**
- Create: `backend/migrations/012_password_reset_tokens.sql`

**Context:** The existing migrations live in `backend/migrations/`. They are plain SQL files run manually with psql. The latest is `011_create_dok_admins.sql`.

- [ ] **Step 1: Create the migration file**

Create `backend/migrations/012_password_reset_tokens.sql` with this exact content:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens (user_id);
```

- [ ] **Step 2: Run the migration**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npx ts-node -e \"require('./src/config/db').query(require('fs').readFileSync('./migrations/012_password_reset_tokens.sql', 'utf8')).then(() => { console.log('Migration OK'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })\""
```

Expected output: `Migration OK`

If that fails (ts-node not available), run with psql directly:
```
cmd /c "psql -U dokcrm -d dokcrm -f "d:\Project\Sale Funnel\backend\migrations\012_password_reset_tokens.sql""
```

Expected: no errors, two `CREATE INDEX` lines in output.

- [ ] **Step 3: Verify table exists**

```
cmd /c "psql -U dokcrm -d dokcrm -c "\d password_reset_tokens""
```

Expected: table with columns `id, user_id, token_hash, expires_at, used_at, created_at`.

---

### Task 2: Backend Model — `resetTokenModel.ts`

**Files:**
- Create: `backend/src/models/resetTokenModel.ts`

**Context:** All model files in `backend/src/models/` import `query` from `'../config/db'` and export typed functions. No ORM — plain SQL via `pg`.

- [ ] **Step 1: Create the model file**

Create `backend/src/models/resetTokenModel.ts`:

```typescript
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

export async function deleteExpiredTokens(): Promise<void> {
  await query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 3: Backend Service — nodemailer + `emailService.ts`

**Files:**
- Modify: `backend/.env`
- Create: `backend/src/services/emailService.ts`

**Context:** No email service exists yet. Need to install `nodemailer` and `@types/nodemailer`. The `.env` currently has DB and JWT vars only. `SMTP_PORT=587` uses STARTTLS (Outlook default) — `secure: false` is correct for port 587.

- [ ] **Step 1: Install nodemailer**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npm install nodemailer && npm install --save-dev @types/nodemailer"
```

Expected: both packages appear in `package.json` with no errors.

- [ ] **Step 2: Add env vars to `backend/.env`**

Open `backend/.env` and append these lines at the end (fill in your real Outlook credentials):

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your@outlook.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@dokcrm.com
APP_BASE_URL=http://localhost:5173
```

- [ ] **Step 3: Create `backend/src/services/emailService.ts`**

Create the file at `backend/src/services/emailService.ts`:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST!,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM!,
    to,
    subject: 'Reset your DOK CRM password',
    text: [
      'You requested a password reset for your DOK CRM account.',
      '',
      'Click the link below to set a new password. This link expires in 1 hour.',
      '',
      resetLink,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#4f46e5;">Reset your DOK CRM password</h2>
        <p>You requested a password reset for your DOK CRM account.</p>
        <p>Click the button below to set a new password.
           This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 24px;background:#4f46e5;
                  color:#fff;border-radius:6px;text-decoration:none;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:14px;">
          If you did not request this, you can safely ignore this email.
        </p>
        <p style="color:#9ca3af;font-size:12px;">
          Or copy this link: ${resetLink}
        </p>
      </div>
    `,
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 4: Backend Handlers — `authController.ts` + routes

**Files:**
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/routes/auth.ts`

**Context on `authController.ts` current imports (top of file):**
```typescript
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByUsername, updateLastLogin } from '../models/userModel';
import { findTenantById } from '../models/tenantModel';
import { query } from '../config/db';
```

The file currently exports `login` and `me`. Two new imports are needed. All three new handlers follow the same pattern as `login` and `me`.

**Context on `auth.ts`:**
```typescript
import { Router } from 'express';
import { login, me } from '../controllers/authController';
const router = Router();
router.post('/login', login);
router.get('/me',     me);
export default router;
```

- [ ] **Step 1: Add imports to `authController.ts`**

Find the existing imports block at the top of `backend/src/controllers/authController.ts`. Add two new import lines immediately after the existing imports:

```typescript
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByUsername, updateLastLogin } from '../models/userModel';
import { findTenantById } from '../models/tenantModel';
import { query } from '../config/db';
import { createResetToken, findValidToken, markTokenUsed } from '../models/resetTokenModel';
import { sendPasswordResetEmail } from '../services/emailService';
```

- [ ] **Step 2: Add `forgotPassword` handler**

Append the following function at the end of `backend/src/controllers/authController.ts`:

```typescript
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const SUCCESS = { message: 'If that email is registered, you will receive a reset link shortly.' };

  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, email, tenant_id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = result.rows[0];
    if (!user) { res.json(SUCCESS); return; }

    const tenant = await findTenantById(user.tenant_id);
    if (!tenant || tenant.status !== 'active') { res.json(SUCCESS); return; }

    const rawToken = await createResetToken(user.id);
    const resetLink = `${process.env.APP_BASE_URL}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetLink);
    res.json(SUCCESS);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
}
```

- [ ] **Step 3: Add `verifyResetToken` handler**

Append immediately after `forgotPassword`:

```typescript
export async function verifyResetToken(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token required' });
    return;
  }
  try {
    const found = await findValidToken(token);
    if (!found) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [found.userId]
    );
    const tenant = userResult.rows[0]?.tenant_id
      ? await findTenantById(userResult.rows[0].tenant_id)
      : null;
    if (!tenant || tenant.status !== 'active') {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    res.json({ valid: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 4: Add `resetPassword` handler**

Append immediately after `verifyResetToken`:

```typescript
export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and newPassword required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  try {
    const found = await findValidToken(token);
    if (!found) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [found.userId]
    );
    const tenant = userResult.rows[0]?.tenant_id
      ? await findTenantById(userResult.rows[0].tenant_id)
      : null;
    if (!tenant || tenant.status !== 'active') {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, found.userId]);
    await markTokenUsed(token);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 5: Wire routes in `auth.ts`**

Replace the full content of `backend/src/routes/auth.ts` with:

```typescript
import { Router } from 'express';
import { login, me, forgotPassword, verifyResetToken, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/login',               login);
router.get('/me',                   me);
router.post('/forgot-password',     forgotPassword);
router.post('/verify-reset-token',  verifyResetToken);
router.post('/reset-password',      resetPassword);

export default router;
```

- [ ] **Step 6: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 5: Frontend API — `authApi.ts`

**Files:**
- Create: `frontend/src/lib/api/authApi.ts`

**Context:** All API calls use `apiFetch` from `@/config/api`. The existing `collections.ts` in the same folder follows the same pattern. `apiFetch` throws `new Error(body.error)` on non-2xx responses.

- [ ] **Step 1: Create `frontend/src/lib/api/authApi.ts`**

```typescript
import { apiFetch } from '@/config/api';

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyResetToken(token: string): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>('/api/auth/verify-reset-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 6: Frontend Page — `ForgotPasswordPage.tsx`

**Files:**
- Create: `frontend/src/pages/auth/ForgotPasswordPage.tsx`

**Context:** The existing `LoginPage.tsx` uses the same card layout (`bg-gradient-to-br from-blue-50 to-indigo-100`) and the same "D" logo mark. Match that layout exactly. The page has two states: the form and the success message (shown regardless of whether the email existed — anti-enumeration).

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/auth/ForgotPasswordPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { forgotPassword } from '@/lib/api/authApi'

export function ForgotPasswordPage() {
  const [email, setEmail]           = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsSubmitting(true)
    setError(null)
    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch {
      setError('Failed to send email. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-white">D</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                If that email is registered, you'll receive a reset link shortly.
                Check your inbox and spam folder.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || !email}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <Link to="/login">
                <Button type="button" variant="ghost" className="w-full text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 7: Frontend Page — `ResetPasswordPage.tsx`

**Files:**
- Create: `frontend/src/pages/auth/ResetPasswordPage.tsx`

**Context:** This page reads `?token=` from the URL query string using React Router's `useSearchParams`. On mount it calls `verifyResetToken` — if invalid, it shows an error state instead of the form. The `toast` function is from `sonner` (already installed, used throughout the app). Password show/hide toggle matches the `LoginForm` pattern.

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/auth/ResetPasswordPage.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyResetToken, resetPassword } from '@/lib/api/authApi'

export function ResetPasswordPage() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const token           = searchParams.get('token') ?? ''

  const [tokenValid, setTokenValid]         = useState<boolean | null>(null)
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    verifyResetToken(token)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await resetPassword(token, newPassword)
      toast.success('Password updated. Please log in.')
      navigate('/login', { replace: true })
    } catch {
      setError('This reset link is invalid or has expired.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-white">D</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          {tokenValid === null && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {tokenValid === false && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-600">
                This reset link is invalid or has expired.
              </p>
              <Link to="/forgot-password">
                <Button className="w-full">Request a new link</Button>
              </Link>
            </div>
          )}

          {tokenValid === true && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye    className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !newPassword || !confirmPassword}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set New Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 8: Frontend Wiring — LoginForm link + App.tsx routes

**Files:**
- Modify: `frontend/src/components/auth/LoginForm.tsx`
- Modify: `frontend/src/App.tsx`

**Context on `LoginForm.tsx`:** Currently imports from `react-hook-form`, `zod`, `lucide-react`, and shadcn. Does NOT import `Link` from react-router-dom. The password field ends at line 98 and the submit button starts at line 100. The "Forgot password?" link belongs between the password field block and the submit button.

**Context on `App.tsx`:** Public routes are currently just `/login` and `/superadmin/login`. The two new routes are public (no `ProtectedRoute` wrapper) and must be added before the protected route block.

- [ ] **Step 1: Add `Link` import to `LoginForm.tsx`**

Find the existing imports in `frontend/src/components/auth/LoginForm.tsx`. Add the react-router-dom import:

```typescript
import { Link } from 'react-router-dom'
```

The full imports block should be:

```typescript
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
```

- [ ] **Step 2: Add "Forgot password?" link to `LoginForm.tsx`**

Find the closing `</div>` of the password field block (around line 98, just before the submit `<Button>`). Insert the link between the password block and the submit button:

```tsx
      {errors.password && (
        <p className="text-sm text-red-500">{errors.password.message}</p>
      )}
    </div>

    <div className="flex justify-end">
      <Link
        to="/forgot-password"
        className="text-sm text-primary hover:underline"
      >
        Forgot password?
      </Link>
    </div>

    <Button type="submit" className="w-full" disabled={isLoading}>
```

- [ ] **Step 3: Add page imports to `App.tsx`**

In `frontend/src/App.tsx`, find the existing auth page imports:

```typescript
import { LoginPage } from '@/pages/auth/LoginPage'
```

Add the two new page imports immediately after:

```typescript
import { LoginPage }           from '@/pages/auth/LoginPage'
import { ForgotPasswordPage }  from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage }   from '@/pages/auth/ResetPasswordPage'
```

- [ ] **Step 4: Add public routes to `App.tsx`**

Find the public routes block in the `<Routes>`:

```tsx
{/* Public routes */}
<Route path="/login" element={<LoginPage />} />
```

Add the two new routes immediately after:

```tsx
{/* Public routes */}
<Route path="/login"           element={<LoginPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password"  element={<ResetPasswordPage />} />
```

- [ ] **Step 5: Verify TypeScript compiles with zero errors**

```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner, no errors.

---

### Task 9: Manual Smoke Test

- [ ] **Step 1: Start the backend**

```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npm run dev"
```

- [ ] **Step 2: Start the frontend**

```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npm run dev"
```

- [ ] **Step 3: Test the forgot-password flow**

1. Open `http://localhost:5173/login`
2. Verify a "Forgot password?" link appears below the password field
3. Click it — should navigate to `/forgot-password`
4. Enter an email that does NOT exist → submit → success message appears (anti-enumeration)
5. Enter a real user's email → submit → success message appears
6. Check the Outlook inbox — an email should arrive with a "Reset Password" button
7. Click the reset link in the email — should navigate to `/reset-password?token=...`
8. The spinner appears briefly, then the new-password form shows
9. Enter mismatched passwords → error "Passwords do not match" (no API call)
10. Enter matching passwords (min 6 chars) → submit → toast "Password updated. Please log in." → redirected to `/login`
11. Log in with the new password → succeeds

- [ ] **Step 4: Test invalid/expired token**

1. Navigate to `http://localhost:5173/reset-password?token=fakeinvalidtoken`
2. After the spinner: error state "This reset link is invalid or has expired." with "Request a new link" button
3. Click "Request a new link" → navigates to `/forgot-password`

- [ ] **Step 5: Test single-use token**

1. Complete a successful password reset using a real token
2. Use the browser's back button to return to the reset page with the same token URL
3. The page should show the invalid/expired error state (token was marked `used_at`)
