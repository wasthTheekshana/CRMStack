# Phase 5 — Password Reset & Email Service: Design Spec

**Date:** 2026-04-25
**Project:** DOK CRM SaaS
**Phase:** 5 of 8
**Status:** Approved — ready for implementation

---

## 1. Overview

Add self-service password reset for all users (tenant admins and sales users). A user who has forgotten their password submits their email, receives a time-limited reset link via email (Outlook SMTP), clicks the link, and sets a new password.

---

## 2. Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Email provider | Nodemailer + Outlook SMTP | No third-party account needed, works with existing Office 365 credentials |
| Token storage | Separate `password_reset_tokens` table | Keeps users table clean, supports audit trail, clean single-use enforcement |
| Token hashing | SHA-256 | Sufficient for random tokens (no need for bcrypt's slowness) |
| Token expiry | 1 hour | Short enough to limit exposure window |
| Anti-enumeration | `forgot-password` always returns 200 | Prevents attackers from discovering registered emails |
| Frontend base URL | `APP_BASE_URL` env var (defaults to `http://localhost:5173`) | Swap for real domain at deployment time |
| Who can reset | All users (admins + sales) | Self-service for everyone |

---

## 3. Database

### New migration: `backend/migrations/012_password_reset_tokens.sql`

```sql
CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON password_reset_tokens (token_hash);
CREATE INDEX ON password_reset_tokens (user_id);
```

**Token lifecycle:**
1. On `forgot-password`: any previous unused tokens for the user are deleted, a new token is inserted
2. On `reset-password`: `used_at = NOW()` is set; token is rejected for any future use
3. Tokens with `expires_at < NOW()` are considered invalid regardless of `used_at`

---

## 4. Backend

### 4.1 New environment variables (`backend/.env`)

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your@outlook.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@dokcrm.com
APP_BASE_URL=http://localhost:5173
```

### 4.2 New files

| File | Purpose |
|------|---------|
| `backend/src/models/resetTokenModel.ts` | DB operations for `password_reset_tokens` |
| `backend/src/services/emailService.ts` | Nodemailer wrapper; exports `sendPasswordResetEmail` |

### 4.3 Modified files

| File | Change |
|------|--------|
| `backend/src/controllers/authController.ts` | Add three new handler functions |
| `backend/src/routes/auth.ts` | Wire three new public routes |

### 4.4 Model — `resetTokenModel.ts`

```typescript
createResetToken(userId: string): Promise<string>
// Deletes existing unused tokens for user, inserts new token (1-hour expiry),
// returns the raw 32-byte hex token (NOT the hash)

findValidToken(rawToken: string): Promise<{ userId: string } | null>
// SHA-256 hashes rawToken, looks up token_hash WHERE used_at IS NULL AND expires_at > NOW()

markTokenUsed(rawToken: string): Promise<void>
// Sets used_at = NOW() for the matching token_hash

deleteExpiredTokens(): Promise<void>
// Housekeeping: DELETE WHERE expires_at < NOW()
```

### 4.5 Email service — `emailService.ts`

```typescript
sendPasswordResetEmail(to: string, resetLink: string): Promise<void>
```

Sends a plain-text + HTML email:
- **Subject:** `Reset your DOK CRM password`
- **Body:** "Click the link below to reset your password. This link expires in 1 hour." + the reset link
- Throws on SMTP failure (caller catches and returns 500)

### 4.6 New API endpoints

All three routes are **public** (no `requireAuth` middleware).

---

#### `POST /api/auth/forgot-password`

**Request body:**
```json
{ "email": "user@example.com" }
```

**Logic:**
1. Find user by email (case-insensitive)
2. If not found: return `200` immediately (anti-enumeration)
3. Check user's tenant status — if suspended: return `200` immediately without creating a token (no information leak)
4. Call `createResetToken(user.id)` — gets raw token
5. Build reset link: `${APP_BASE_URL}/reset-password?token=${rawToken}`
6. Call `sendPasswordResetEmail(user.email, resetLink)`
7. If SMTP throws: log error, return `500 { error: 'Failed to send email' }`
8. Return `200 { message: 'If that email is registered, you will receive a reset link shortly.' }`

---

#### `POST /api/auth/verify-reset-token`

**Request body:**
```json
{ "token": "<raw-token>" }
```

**Logic:**
1. Call `findValidToken(token)` — returns `{ userId }` or null
2. If null: return `400 { error: 'Invalid or expired reset link' }`
3. Fetch user's tenant status — if suspended: return `400 { error: 'Invalid or expired reset link' }`
4. Return `200 { valid: true }`

---

#### `POST /api/auth/reset-password`

**Request body:**
```json
{ "token": "<raw-token>", "newPassword": "minimum6chars" }
```

**Logic:**
1. Validate `newPassword` length >= 6
2. Call `findValidToken(token)` — get `userId`
3. If null: return `400 { error: 'Invalid or expired reset link' }`
4. Fetch user; check tenant is active — if suspended: return `400 { error: 'Invalid or expired reset link' }` (no info leak)
5. Hash `newPassword` with bcrypt
6. Update `users.password_hash`
7. Call `markTokenUsed(token)`
8. Return `200 { message: 'Password updated successfully' }`

---

## 5. Frontend

### 5.1 New pages

| File | Route |
|------|-------|
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | `/forgot-password` |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | `/reset-password` |

Both routes are **public** (outside the auth guard).

---

#### `ForgotPasswordPage.tsx`

- Email input + "Send Reset Link" button
- On submit: calls `forgotPassword(email)`
- After submit (success or not): shows success message — *"If that email is registered, you'll receive a reset link shortly."* — regardless of outcome (matches anti-enumeration backend behaviour)
- "Back to Login" link
- SMTP failure (500 response): shows *"Failed to send email. Please try again."*

---

#### `ResetPasswordPage.tsx`

- Reads `token` from `?token=` query param on mount
- Immediately calls `verifyResetToken(token)`:
  - If invalid/expired: shows error state — *"This reset link is invalid or has expired."* + "Request a new link" button (navigates to `/forgot-password`)
  - If valid: shows the reset form
- Reset form: new password + confirm password fields (client-side mismatch check before API call)
- On submit: calls `resetPassword(token, newPassword)`
  - Success: redirect to `/login` + toast *"Password updated. Please log in."*
  - `400` from API: show *"This reset link is invalid or has expired."* + "Request a new link" button
  - `500`: show *"Something went wrong. Please try again."*

---

### 5.2 Modified files

| File | Change |
|------|--------|
| `frontend/src/pages/auth/LoginPage.tsx` | Add "Forgot password?" link below password field, navigates to `/forgot-password` |
| `frontend/src/App.tsx` | Add two public routes: `/forgot-password` and `/reset-password` |
| `frontend/src/lib/api/auth.ts` | Add `forgotPassword`, `verifyResetToken`, `resetPassword` API functions |

### 5.3 New API functions (`auth.ts`)

```typescript
forgotPassword(email: string): Promise<void>
verifyResetToken(token: string): Promise<{ valid: boolean }>
resetPassword(token: string, newPassword: string): Promise<void>
```

---

## 6. Security Rules

| Rule | Detail |
|------|--------|
| Anti-enumeration | `forgot-password` always returns 200, regardless of whether email exists or tenant is suspended |
| Token hashing | Only SHA-256(token) stored in DB — raw token never persisted |
| Single-use | `used_at` set on successful reset; subsequent uses rejected |
| Token invalidation on re-request | Previous unused tokens for the same user are deleted when a new request is made |
| Expiry | 1 hour from creation |
| Suspended tenant | No token created and no email sent (forgot-password returns 200 anyway); verify and reset both return generic 400 if tenant is suspended |
| Password minimum | 6 characters (consistent with user creation validation) |
| SMTP failure | Logged server-side, generic 500 returned — no internal detail exposed |
| Same error message | Invalid token, expired token, and used token all return the same message (no oracle) |

---

## 7. What is NOT in Phase 5

- Rate limiting on `forgot-password` (Phase 6 / deployment hardening)
- Email verification on signup
- Magic link / passwordless login
- HTML email branding / templates beyond basic styling
- Token cleanup cron job (expired tokens are filtered at query time; bulk cleanup is optional housekeeping)
