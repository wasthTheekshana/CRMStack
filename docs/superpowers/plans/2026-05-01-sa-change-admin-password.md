# SA Change Admin Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the super admin to change the password of tenant admin users from the Users Search page and the Tenant Detail page, while explicitly blocking password changes for sales users.

**Architecture:** Add a role guard to the existing `resetUserPassword` backend handler, extract a shared `ChangePasswordModal` from the existing inline dialog in `SAUsersPage`, wire it into both `SAUsersPage` and `SATenantDetailPage`.

**Tech Stack:** Express/TypeScript backend, React 18 + shadcn/ui + sonner toasts frontend, existing `saResetUserPassword` service function, bcrypt.

---

## File Map

**Create:**
- `frontend/src/components/superadmin/ChangePasswordModal.tsx`

**Modify:**
- `backend/src/controllers/superAdminController.ts` — add role guard in `resetUserPassword`
- `frontend/src/pages/superadmin/SAUsersPage.tsx` — replace inline dialog with `ChangePasswordModal`, admin-only button
- `frontend/src/pages/superadmin/SATenantDetailPage.tsx` — add Actions column + `ChangePasswordModal`

---

### Task 1: Backend — Add Role Guard to `resetUserPassword`

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (lines 331–352)

The current handler hashes and updates without checking the user's role. We add a DB lookup before hashing: if the user doesn't exist return 404, if `role !== 'admin'` return 403.

- [ ] **Step 1: Open the file and locate the handler**

Read `backend/src/controllers/superAdminController.ts` lines 331–352. The current function body starts with a 400 check then goes straight to `bcrypt.hash`.

- [ ] **Step 2: Replace the handler body with the role-guarded version**

Find this exact block in `superAdminController.ts`:

```typescript
export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 6) {
    res.status(400).json({ error: 'tempPassword required (min 6 chars)' }); return;
  }
  try {
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, display_name`,
      [passwordHash, id]
    );
    if (!result.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ updated: true, userId: result.rows[0].id, email: result.rows[0].email,
               displayName: result.rows[0].display_name });
  } catch (err) {
    console.error('SA resetUserPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

Replace it with:

```typescript
export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 6) {
    res.status(400).json({ error: 'tempPassword required (min 6 chars)' }); return;
  }
  try {
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

- [ ] **Step 3: Verify the file compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat(sa): add role guard to resetUserPassword — admin only"
```

---

### Task 2: Frontend — Create `ChangePasswordModal` Shared Component

**Files:**
- Create: `frontend/src/components/superadmin/ChangePasswordModal.tsx`

This component is extracted from the inline dialog currently in `SAUsersPage.tsx`. It adds a **Confirm Password** field and raises the minimum password length from 6 to 8 characters. It calls `saResetUserPassword` from `saService` directly.

- [ ] **Step 1: Create the file**

Create `frontend/src/components/superadmin/ChangePasswordModal.tsx` with the following content:

```typescript
import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { saResetUserPassword } from '@/services/saService'
import { toast } from 'sonner'

interface Props {
  user: { id: string; email: string } | null
  onClose: () => void
}

export function ChangePasswordModal({ user, onClose }: Props) {
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]               = useState(false)
  const [copied, setCopied]                 = useState(false)

  const valid = newPassword.length >= 8 && newPassword === confirmPassword

  const handleClose = () => {
    setNewPassword('')
    setConfirmPassword('')
    setCopied(false)
    onClose()
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(newPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async () => {
    if (!user || !valid) return
    setLoading(true)
    try {
      await saResetUserPassword(user.id, newPassword)
      toast.success(`Password updated for ${user.email}`)
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Change Password</DialogTitle>
          <DialogDescription className="text-slate-400">
            Set a new password for{' '}
            <span className="text-white font-medium">{user?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-slate-400">New Password</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Min. 8 characters"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white shrink-0"
                onClick={copyPassword}
                disabled={!newPassword}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400">Confirm Password</Label>
            <Input
              type="text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Repeat password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-slate-400" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!valid || loading}
              onClick={handleSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Change Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/superadmin/ChangePasswordModal.tsx
git commit -m "feat(sa): add ChangePasswordModal shared component"
```

---

### Task 3: Frontend — Update `SAUsersPage` to Use `ChangePasswordModal`

**Files:**
- Modify: `frontend/src/pages/superadmin/SAUsersPage.tsx`

Remove the inline dialog and its four state variables. Replace with `ChangePasswordModal`. The "Reset Password" button in the Actions column is replaced with an admin-only "Change Password" button; sales users show `—` instead.

- [ ] **Step 1: Read the current file**

Read `frontend/src/pages/superadmin/SAUsersPage.tsx` in full (186 lines).

- [ ] **Step 2: Replace the file contents**

The new version:

```typescript
import { useState } from 'react'
import { Search, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { saSearchUsers, SAUser } from '@/services/saService'
import { ChangePasswordModal } from '@/components/superadmin/ChangePasswordModal'
import { toast } from 'sonner'

export function SAUsersPage() {
  const [query, setQuery]         = useState('')
  const [users, setUsers]         = useState<SAUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched]   = useState(false)
  const [pwTarget, setPwTarget]   = useState<SAUser | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearched(false)
    try {
      const results = await saSearchUsers(query.trim())
      setUsers(results)
      setSearched(true)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-slate-400 text-sm mt-1">Search users across all tenants</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email..."
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 max-w-md"
        />
        <Button type="submit" disabled={searching} className="bg-indigo-600 hover:bg-indigo-700">
          {searching
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {/* Results */}
      {searched && (
        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Tenant</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="bg-slate-900 hover:bg-slate-800/60">
                  <td className="px-4 py-3 text-white">{u.displayName}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={u.role === 'admin' ? 'border-indigo-700 text-indigo-400' : 'border-slate-600 text-slate-400'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{u.tenantName}</div>
                    <div className="text-slate-500 text-xs font-mono">{u.tenantSubdomain}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
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
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No users found for "{query}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ChangePasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/superadmin/SAUsersPage.tsx
git commit -m "feat(sa): replace inline dialog with ChangePasswordModal, admin-only button"
```

---

### Task 4: Frontend — Add Actions Column to `SATenantDetailPage`

**Files:**
- Modify: `frontend/src/pages/superadmin/SATenantDetailPage.tsx` (users table around lines 258–294)

Add a fifth column "Actions" to the users table. For admin users show a "Change Password" ghost button with a key icon. For non-admin users render `null` (no button, no placeholder text). Add `pwTarget` state and `<ChangePasswordModal>` at the bottom of the card content.

- [ ] **Step 1: Read the top of the file to see existing imports**

Read `frontend/src/pages/superadmin/SATenantDetailPage.tsx` lines 1–15.

- [ ] **Step 2: Add `KeyRound` to the lucide-react import**

Find the existing lucide import line (it will include icons like `ArrowLeft`, `Users`, `BarChart2`, etc.) and add `KeyRound` to it. For example:

```typescript
// Before (example — match whatever icons are already there):
import { ArrowLeft, Users, BarChart2, Building2 } from 'lucide-react'

// After:
import { ArrowLeft, Users, BarChart2, Building2, KeyRound } from 'lucide-react'
```

- [ ] **Step 3: Add `ChangePasswordModal` import**

After the existing imports in the file, add:

```typescript
import { ChangePasswordModal } from '@/components/superadmin/ChangePasswordModal'
```

- [ ] **Step 4: Add `pwTarget` state**

Find the block where `useState` calls are grouped near the top of the component function. Add:

```typescript
const [pwTarget, setPwTarget] = useState<{ id: string; email: string } | null>(null)
```

- [ ] **Step 5: Add Actions column header to the users table**

Find the `<thead>` of the users table (around line 265–271). It currently has four `<th>` elements: Name, Email, Role, Last Login. Add a fifth:

```typescript
// Before:
<th className="text-left px-4 py-2">Last Login</th>
// After:
<th className="text-left px-4 py-2">Last Login</th>
<th className="text-right px-4 py-2"></th>
```

- [ ] **Step 6: Add Actions column cell to each user row**

Find the user row body (around lines 274–287). It currently ends after the Last Login `<td>`. Add an Actions `<td>` immediately after:

```typescript
// After the Last Login td:
<td className="px-4 py-2 text-right">
  {u.role === 'admin' && (
    <Button
      variant="ghost"
      size="sm"
      className="text-slate-400 hover:text-white h-7 gap-1 text-xs"
      onClick={() => setPwTarget({ id: u.id, email: u.email })}
    >
      <KeyRound className="h-3.5 w-3.5" />
      Change Password
    </Button>
  )}
</td>
```

- [ ] **Step 7: Update the `colSpan` on the empty-state row**

Find the empty-state row: `<td colSpan={4} ...>No users</td>` and change it to `colSpan={5}`.

- [ ] **Step 8: Render `ChangePasswordModal` at the bottom of the card**

After the closing `</table>` tag inside `<CardContent>`, add:

```typescript
<ChangePasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />
```

- [ ] **Step 9: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/superadmin/SATenantDetailPage.tsx
git commit -m "feat(sa): add Change Password action to tenant detail users table"
```
