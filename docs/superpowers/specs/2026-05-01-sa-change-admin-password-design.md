# Super Admin — Change Admin Password Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the super admin to change the password of tenant admin users (role = `admin`) from two places: the Tenant Detail page and the Users Search page. Sales users are explicitly excluded.

**Architecture:** The backend endpoint `PUT /api/super-admin/users/:id/password` already exists but has no role guard. We add an admin-only check there, extract a shared `ChangePasswordModal` component from the existing inline dialog in `SAUsersPage`, and wire it into both pages.

**Tech Stack:** Express/TypeScript backend, React 18 + shadcn/ui frontend, existing `saResetUserPassword` service function.

---

## What Already Exists (do not rewrite)

- `PUT /api/super-admin/users/:id/password` → `resetUserPassword` handler in `superAdminController.ts`
- `saResetUserPassword(id, tempPassword)` in `saService.ts`
- Inline reset-password dialog inside `SAUsersPage.tsx` — this becomes `ChangePasswordModal`

---

## Backend Change

### `resetUserPassword` in `backend/src/controllers/superAdminController.ts`

Add a role check **before** hashing the new password:

```typescript
export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 6) {
    res.status(400).json({ error: 'tempPassword required (min 6 chars)' }); return;
  }
  try {
    // Role guard — admin users only
    const userCheck = await query(
      `SELECT role FROM users WHERE id = $1`,
      [id]
    );
    if (!userCheck.rows.length) {
      res.status(404).json({ error: 'User not found' }); return;
    }
    if (userCheck.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Password can only be changed for admin users' }); return;
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, display_name`,
      [passwordHash, id]
    );
    res.json({ updated: true, userId: result.rows[0].id, email: result.rows[0].email,
               displayName: result.rows[0].display_name });
  } catch (err) {
    console.error('SA resetUserPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Frontend Components

### `ChangePasswordModal` — new shared component

**File:** `frontend/src/components/superadmin/ChangePasswordModal.tsx`

Props:
```typescript
interface Props {
  user: { id: string; email: string } | null;  // null = closed
  onClose: () => void;
}
```

UI (extracted from the existing `SAUsersPage` inline dialog — same dark slate theme):
- `DialogDescription`: "Set a new password for **{email}**"
- **New Password** input (min 8 chars — stricter than the old 6)
- **Confirm Password** input (must match)
- **Copy** icon button (copies new password to clipboard)
- **Cancel** / **Change Password** button (disabled until both fields valid and matching)
- On success: `toast.success('Password updated for {email}')` + `onClose()`
- On error (incl. 403 from backend): `toast.error(errorMessage)`

Minimum password length: **8 characters** (stricter than the existing inline dialog's 6).

---

### `SAUsersPage.tsx` — modify

**File:** `frontend/src/pages/superadmin/SAUsersPage.tsx`

1. Remove the inline reset-password dialog and its local state (`resetTarget`, `newPassword`, `resetLoading`, `copied`).
2. Add `import { ChangePasswordModal }` and a single state: `const [pwTarget, setPwTarget] = useState<SAUser | null>(null)`.
3. In the users table Actions column:
   - If `u.role === 'admin'`: show **"Change Password"** button (indigo outline, key icon) → `setPwTarget(u)`
   - If `u.role !== 'admin'`: show muted text `"—"` (no button)
4. Render `<ChangePasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />` at the bottom.

```tsx
// Actions cell
<td className="px-4 py-3 text-right">
  {u.role === 'admin' ? (
    <Button
      variant="outline"
      size="sm"
      className="border-slate-600 text-slate-300 hover:text-white text-xs h-7 gap-1"
      onClick={() => setPwTarget(u)}
    >
      <KeyRound className="h-3.5 w-3.5" />
      Change Password
    </Button>
  ) : (
    <span className="text-slate-600 text-xs">—</span>
  )}
</td>
```

---

### `SATenantDetailPage.tsx` — modify

**File:** `frontend/src/pages/superadmin/SATenantDetailPage.tsx`

1. Add `import { ChangePasswordModal }` and state: `const [pwTarget, setPwTarget] = useState<{ id: string; email: string } | null>(null)`.
2. In the existing users table, add an Actions column header and cell:
   - If `user.role === 'admin'`: key icon button → `setPwTarget({ id: user.id, email: user.email })`
   - If `user.role !== 'admin'`: render nothing (no column space wasted — use `null`)
3. Render `<ChangePasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />` at the bottom.

Users table current columns: Name, Email, Role, Last Login  
New: Name, Email, Role, Last Login, **Actions** (only populated for admin rows)

```tsx
// In thead
<th className="text-right px-4 py-3 text-slate-400 font-medium text-sm"></th>

// In tbody row
<td className="px-4 py-3 text-right">
  {user.role === 'admin' && (
    <Button
      variant="ghost"
      size="sm"
      className="text-slate-400 hover:text-white h-7 gap-1 text-xs"
      onClick={() => setPwTarget({ id: user.id, email: user.email })}
    >
      <KeyRound className="h-3.5 w-3.5" />
      Change Password
    </Button>
  )}
</td>
```

---

## File Map

**Create:**
- `frontend/src/components/superadmin/ChangePasswordModal.tsx`

**Modify:**
- `backend/src/controllers/superAdminController.ts` — add role guard in `resetUserPassword`
- `frontend/src/pages/superadmin/SAUsersPage.tsx` — replace inline dialog with `ChangePasswordModal`, admin-only button
- `frontend/src/pages/superadmin/SATenantDetailPage.tsx` — add Actions column + `ChangePasswordModal`

---

## Security

- Backend enforces `role = 'admin'` check — cannot bypass from frontend
- Endpoint already requires `requireSuperAdmin` middleware
- Password hashed with bcrypt (cost 12) before storage
- No plaintext password stored or returned

---

## Error States

| Scenario | Handling |
|---|---|
| User not found | Backend 404 → toast "User not found" |
| User is sales role | Backend 403 → toast "Password can only be changed for admin users" |
| Passwords don't match | Frontend disabled button — cannot submit |
| Password < 8 chars | Frontend disabled button — cannot submit |
| Network error | toast.error generic message |
