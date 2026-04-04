import { useState } from 'react';
import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  linkWithPopup,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

export default function SecuritySection() {
  const { firebaseUser } = useAuthStore();

  // Determine sign-in methods
  const providers = firebaseUser?.providerData?.map((p) => p.providerId) ?? [];
  const hasPassword = providers.includes('password');
  const hasGoogle = providers.includes('google.com');

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-5">
      <h2 className="text-sm font-semibold text-ga-text-primary">🔒 Security</h2>

      {/* Sign-in methods */}
      <div>
        <h3 className="text-xs font-medium text-ga-text-secondary mb-2">Sign-in Methods</h3>
        <div className="flex gap-2 flex-wrap">
          {hasPassword && (
            <span className="text-xs bg-green-500/20 text-green-400 rounded-full px-3 py-1">
              ✓ Email + Password
            </span>
          )}
          {hasGoogle && (
            <span className="text-xs bg-blue-500/20 text-blue-400 rounded-full px-3 py-1">
              ✓ Google
            </span>
          )}
        </div>
      </div>

      {/* Password section */}
      {hasPassword ? (
        <ChangePasswordForm />
      ) : (
        <SetPasswordForm />
      )}

      {/* Link Google (if not linked) */}
      {!hasGoogle && (
        <div className="border-t border-ga-border pt-4">
          <LinkGoogleButton />
        </div>
      )}

      {/* Danger Zone */}
      <div className="border-t border-ga-border pt-4">
        <h3 className="text-xs font-medium text-red-400 mb-2">Danger Zone</h3>
        <DeleteAccountButton />
      </div>
    </div>
  );
}


// ==========================================================================
// Change Password (for email+password users)
// ==========================================================================

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getAuth();

  // Validation
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValid = hasMinLength && hasNumber && hasMixedCase && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async () => {
    if (!isValid || !auth.currentUser) return;
    setLoading(true);
    setError(null);

    try {
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password') {
        setError('Current password is incorrect.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Session expired. Please sign out and sign in again.');
      } else {
        setError(`Failed to update password: ${(err as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
    } catch {
      toast.error('Failed to send reset email');
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-ga-text-secondary">Change Password</h3>

      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">Current Password</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full max-w-sm bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        <button onClick={handleForgotPassword} className="text-xs text-ga-accent hover:underline mt-1">
          Forgot your password? Reset via email
        </button>
      </div>

      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">New Password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full max-w-sm bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
      </div>

      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">Confirm New Password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full max-w-sm bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
      </div>

      {/* Validation checklist */}
      <div className="space-y-0.5 text-xs">
        <Check ok={hasMinLength} label="At least 8 characters" />
        <Check ok={hasNumber} label="Contains a number" />
        <Check ok={hasMixedCase} label="Contains uppercase and lowercase" />
        <Check ok={passwordsMatch} label="Passwords match" />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={!isValid || loading}
        className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </div>
  );
}


// ==========================================================================
// Set Password (for Google-only users)
// ==========================================================================

function SetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValid = hasMinLength && hasNumber && hasMixedCase && passwordsMatch;

  const handleSubmit = async () => {
    if (!isValid || !auth.currentUser) return;
    setLoading(true);

    try {
      // Re-authenticate with Google first (required for sensitive operations)
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(auth.currentUser, provider);

      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password set! You can now sign in with email + password too.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-ga-text-secondary">Set a Password</h3>
      <p className="text-xs text-ga-text-secondary">
        You're signed in with Google. Set a password to add email+password as an alternative sign-in method.
      </p>

      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">New Password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full max-w-sm bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
      </div>
      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">Confirm Password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full max-w-sm bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
      </div>

      <div className="space-y-0.5 text-xs">
        <Check ok={hasMinLength} label="At least 8 characters" />
        <Check ok={hasNumber} label="Contains a number" />
        <Check ok={hasMixedCase} label="Contains uppercase and lowercase" />
        <Check ok={passwordsMatch} label="Passwords match" />
      </div>

      <button onClick={handleSubmit} disabled={!isValid || loading}
        className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
        {loading ? 'Setting...' : 'Set Password'}
      </button>
    </div>
  );
}


// ==========================================================================
// Link Google Account
// ==========================================================================

function LinkGoogleButton() {
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleLink = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(auth.currentUser, provider);
      toast.success('Google account linked!');
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/credential-already-in-use') {
        toast.error('This Google account is already linked to another user.');
      } else {
        toast.error(`Failed to link: ${(err as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs text-ga-text-secondary mb-2">
        Link your Google account for easier sign-in.
      </p>
      <button onClick={handleLink} disabled={loading}
        className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
        {loading ? 'Linking...' : '🔗 Link Google Account'}
      </button>
    </div>
  );
}


// ==========================================================================
// Delete Account
// ==========================================================================

function DeleteAccountButton() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const { signOut } = useAuthStore();
  const auth = getAuth();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || !auth.currentUser) return;
    setStep('deleting');

    try {
      // Re-authenticate
      const providers = auth.currentUser.providerData.map((p) => p.providerId);
      if (providers.includes('google.com')) {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      }
      // Note: if email+password, they should have recently signed in. If not, this will fail.

      // Delete Firestore profile via backend
      try {
        await apiClient.delete(`/api/admin/users/${auth.currentUser.uid}`);
      } catch {
        // If not admin, Firestore profile deletion will happen via admin later
      }

      // Delete Firebase Auth account
      await deleteUser(auth.currentUser);

      toast.success('Account deleted.');
      signOut();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/requires-recent-login') {
        toast.error('Session expired. Please sign out, sign in again, then try deleting.');
      } else {
        toast.error(`Failed to delete: ${(err as Error).message}`);
      }
      setStep('idle');
    }
  };

  if (step === 'idle') {
    return (
      <button onClick={() => setStep('confirm')}
        className="text-xs text-red-400 hover:text-red-300 transition-colors">
        🗑 Delete My Account
      </button>
    );
  }

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
      <p className="text-sm text-red-400 font-medium">
        Permanently delete your account and all data?
      </p>
      <p className="text-xs text-ga-text-secondary">
        This cannot be undone. Type <strong>DELETE</strong> to confirm.
      </p>
      <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type DELETE"
        className="w-40 bg-ga-bg-hover border border-red-500/30 rounded-lg px-3 py-2 text-sm text-ga-text-primary font-mono" />
      <div className="flex gap-2">
        <button onClick={handleDelete} disabled={confirmText !== 'DELETE' || step === 'deleting'}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
          {step === 'deleting' ? 'Deleting...' : 'Confirm Delete'}
        </button>
        <button onClick={() => { setStep('idle'); setConfirmText(''); }}
          className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}


// ==========================================================================
// Helpers
// ==========================================================================

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', ok ? 'text-green-400' : 'text-ga-text-secondary/50')}>
      <span>{ok ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );
}
