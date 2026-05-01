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
