import { useState, useEffect } from 'react'
import {
  Loader2,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Mail,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getAllUsers,
  createUserProfile,
  updateUserStatus,
  reassignLeads,
  getLeadCountByUser,
  isUsernameAvailable,
} from '@/lib/api/collections'
import { User } from '@/types'
import { cn } from '@/lib/utils/cn'
import { usePlan } from '@/store/authStore'

export function TeamManagement() {
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)

  // Form states
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
  })
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const plan = usePlan()

  // Fetch users and lead counts
  const fetchData = async () => {
    try {
      setIsLoading(true)
      const allUsers = await getAllUsers()
      setUsers(allUsers)

      // Get lead counts for each user
      const counts: Record<string, number> = {}
      for (const user of allUsers) {
        counts[user.uid] = await getLeadCountByUser(user.uid)
      }
      setLeadCounts(counts)
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Create new salesperson
  const handleCreateUser = async () => {
    if (!newUserForm.username || !newUserForm.email || !newUserForm.password || !newUserForm.displayName) {
      setError('All fields are required')
      return
    }

    // Validate username format (alphanumeric and underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(newUserForm.username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    if (newUserForm.username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (newUserForm.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Check if username is available
      const usernameAvailable = await isUsernameAvailable(newUserForm.username)
      if (!usernameAvailable) {
        setError('Username is already taken')
        setIsSubmitting(false)
        return
      }

      // Create user via API (no Firebase Auth needed)
      await createUserProfile({
        email: newUserForm.email,
        username: newUserForm.username.toLowerCase(),
        displayName: newUserForm.displayName,
        password: newUserForm.password,
        role: 'sales',
      })

      setNewUserForm({ username: '', email: '', password: '', displayName: '' })
      setShowAddDialog(false)
      await fetchData()
    } catch (err: unknown) {
      console.error('Error creating user:', err)
      const msg = (err as Error).message || ''
      if (msg === 'USER_LIMIT_REACHED') {
        setShowAddDialog(false)
        setLimitReached(true)
      } else if (msg.includes('already exists')) {
        setError('Email or username is already in use')
      } else {
        setError('Failed to create user. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle user status
  const handleToggleStatus = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      await updateUserStatus(selectedUser.uid, !selectedUser.isActive)
      setShowStatusConfirm(false)
      setSelectedUser(null)
      await fetchData()
    } catch (err: unknown) {
      console.error('Error updating user status:', err)
      const msg = (err as Error).message || ''
      if (msg === 'USER_LIMIT_REACHED' && !selectedUser.isActive) {
        setShowStatusConfirm(false)
        setLimitReached(true)
      } else {
        alert('Failed to update user status. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reassign leads
  const handleReassignLeads = async () => {
    if (!selectedUser || !targetUserId) return

    const targetUser = users.find((u) => u.uid === targetUserId)
    if (!targetUser) return

    setIsSubmitting(true)
    try {
      const count = await reassignLeads(
        selectedUser.uid,
        targetUserId,
        targetUser.email
      )
      alert(`Successfully reassigned ${count} leads to ${targetUser.displayName}`)
      setShowReassignDialog(false)
      setSelectedUser(null)
      setTargetUserId('')
      await fetchData()
    } catch (err) {
      console.error('Error reassigning leads:', err)
      alert('Failed to reassign leads')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get available users for reassignment (active sales users, excluding selected)
  const getReassignmentTargets = () => {
    return users.filter(
      (u) =>
        u.role === 'sales' &&
        u.isActive !== false &&
        u.uid !== selectedUser?.uid
    )
  }

  const salesUsers = users.filter((u) => u.role === 'sales')
  const activeCount = salesUsers.filter((u) => u.isActive !== false).length
  const inactiveCount = salesUsers.filter((u) => u.isActive === false).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage your sales team and reassign leads
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Salesperson
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{salesUsers.length}</p>
                <p className="text-xs text-muted-foreground">Total Salespeople</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveCount}</p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Team</CardTitle>
          <CardDescription>Manage team members and their leads</CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="divide-y">
            {salesUsers.map((user) => (
              <div
                key={user.uid}
                className={cn(
                  'flex flex-col md:flex-row md:items-center justify-between p-4 gap-3',
                  user.isActive === false && 'bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold',
                      user.isActive === false ? 'bg-gray-400' : 'bg-primary'
                    )}
                  >
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.displayName}</span>
                      {user.username && (
                        <span className="text-sm text-muted-foreground">@{user.username}</span>
                      )}
                      <Badge
                        variant={user.isActive === false ? 'secondary' : 'default'}
                        className={cn(
                          'text-xs',
                          user.isActive === false
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        )}
                      >
                        {user.isActive === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {leadCounts[user.uid] || 0} leads
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto md:ml-0">
                  {/* Reassign button - show if user has leads */}
                  {(leadCounts[user.uid] || 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setShowReassignDialog(true)
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Reassign
                    </Button>
                  )}

                  {/* Toggle status button */}
                  <Button
                    variant={user.isActive === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user)
                      setShowStatusConfirm(true)
                    }}
                  >
                    {user.isActive === false ? (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Activate
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4 mr-1" />
                        Deactivate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {salesUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No salespeople found</p>
                <Button
                  variant="link"
                  onClick={() => setShowAddDialog(true)}
                  className="mt-2"
                >
                  Add your first salesperson
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Salesperson Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Salesperson</DialogTitle>
            <DialogDescription>
              Create a new salesperson account. They will be able to log in with
              these credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                placeholder="John Doe"
                value={newUserForm.displayName}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, displayName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="johndoe"
                value={newUserForm.username}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase() })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used for login. Letters, numbers, and underscores only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={newUserForm.email}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={newUserForm.password}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, password: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false)
                setError(null)
                setNewUserForm({ username: '', email: '', password: '', displayName: '' })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Leads Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reassign Leads</DialogTitle>
            <DialogDescription>
              Transfer all {leadCounts[selectedUser?.uid || ''] || 0} leads from{' '}
              <strong>{selectedUser?.displayName}</strong> to another salesperson.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                This action will transfer all leads and cannot be easily undone.
                Make sure to select the correct target salesperson.
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transfer leads to</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {getReassignmentTargets().map((user) => (
                    <SelectItem key={user.uid} value={user.uid}>
                      {user.displayName} ({leadCounts[user.uid] || 0} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReassignDialog(false)
                setSelectedUser(null)
                setTargetUserId('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassignLeads}
              disabled={isSubmitting || !targetUserId}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reassign Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.isActive === false
                ? 'Activate Salesperson'
                : 'Deactivate Salesperson'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.isActive === false ? (
                <>
                  Are you sure you want to activate{' '}
                  <strong>{selectedUser?.displayName}</strong>? They will be able
                  to access the system again.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate{' '}
                  <strong>{selectedUser?.displayName}</strong>?
                  {(leadCounts[selectedUser?.uid || ''] || 0) > 0 && (
                    <span className="block mt-2 text-orange-600">
                      Note: This salesperson has{' '}
                      {leadCounts[selectedUser?.uid || '']} active leads. Consider
                      reassigning them first.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowStatusConfirm(false)
                setSelectedUser(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={
                selectedUser?.isActive !== false
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
              }
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedUser?.isActive === false ? 'Activate' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Limit Reached Dialog */}
      <AlertDialog open={limitReached} onOpenChange={setLimitReached}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              User Limit Reached
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your <span className="font-semibold capitalize">{plan ?? 'current'}</span> plan
              has reached its user limit. To add more users, contact CRM STACK support to upgrade
              your plan or purchase an additional licence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLimitReached(false)}>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => window.open('mailto:support@crmstack.com', '_blank')}
            >
              Contact Support
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
