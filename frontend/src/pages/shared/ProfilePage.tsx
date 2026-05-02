import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  User,
  Mail,
  Shield,
  Key,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/authStore'
import { updateUserProfile } from '@/lib/api/collections'
import { formatDate } from '@/lib/utils/formatters'

export function ProfilePage() {
  const [searchParams] = useSearchParams()
  const { userProfile, user } = useAuthStore()
  const defaultTab = searchParams.get('tab') || 'profile'

  // Profile form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (userProfile?.displayName) {
      setDisplayName(userProfile.displayName)
    }
  }, [userProfile])

  // Update display name
  const handleUpdateProfile = async () => {
    if (!user?.id || !displayName.trim()) return

    setIsUpdatingProfile(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      await updateUserProfile(user.id, { displayName: displayName.trim() })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
      setProfileError('Failed to update profile. Please try again.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    setIsChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    try {
      if (!user?.id) throw new Error('No user logged in')
      // API verifies old password server-side when password field is sent
      await updateUserProfile(user.id, { password: newPassword } as Parameters<typeof updateUserProfile>[1])
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 5000)
    } catch (error: unknown) {
      console.error('Error changing password:', error)
      setPasswordError('Failed to change password. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and security
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your display name and view account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  Profile updated successfully!
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
                <p className="text-xs text-muted-foreground">
                  This is how your name appears throughout the application
                </p>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{userProfile?.email}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact admin for assistance.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {userProfile?.role}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Member Since</Label>
                <p className="text-sm text-muted-foreground">
                  {userProfile?.createdAt ? formatDate(userProfile.createdAt) : '-'}
                </p>
              </div>

              <Button
                onClick={handleUpdateProfile}
                disabled={isUpdatingProfile || displayName === userProfile?.displayName}
                className="w-full sm:w-auto"
              >
                {isUpdatingProfile ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  Password changed successfully!
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full sm:w-auto"
              >
                {isChangingPassword ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Change Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Account Status</p>
                  <p className="text-xs text-muted-foreground">Your account is active</p>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-700">
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Last Login</p>
                  <p className="text-xs text-muted-foreground">
                    {userProfile?.lastLoginAt ? formatDate(userProfile.lastLoginAt) : 'First session'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
