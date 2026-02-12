import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { LogOut, Save, User, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!currentPassword) {
      setError('Please enter your current password to confirm changes');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          newUsername: newUsername !== user.username ? newUsername : undefined, 
          newPassword: newPassword || undefined,
          currentPassword 
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      
      // Update local context with new token and user info
      login(data.token, data.user);
      setSuccess('Profile updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 pt-12 md:pt-24">
      <div className="w-full max-w-xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Account Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account credentials and preferences.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="grid gap-8">
          {/* Profile Section */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </h2>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-lg text-sm border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-sm border border-emerald-500/20 animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Username
                  </label>
                  <Input 
                    placeholder="New username"
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)}
                  />
                </div>

                <div className="h-px bg-border/50 my-2" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none flex items-center gap-2">
                      <Lock className="h-3 w-3" /> New Password
                    </label>
                    <Input 
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none">
                      Confirm New Password
                    </label>
                    <Input 
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border/50">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Current Password
                      <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Required for any changes</span>
                    </label>
                    <Input 
                      type="password"
                      placeholder="Enter current password to save"
                      value={currentPassword} 
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      className="border-primary/20 focus-visible:ring-primary/30"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={isLoading || (!newPassword && newUsername === user.username)}
                  className="gap-2 min-w-[120px]"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            User ID: {user.id} • Account Created: {new Date(user.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
