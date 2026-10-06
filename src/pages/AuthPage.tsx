import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, supabaseConfigured } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { setGuest } from '@/lib/guest';

type Mode = 'login' | 'signup' | 'forgot';

const emailSchema = z.string().trim().email('Invalid email').max(255);
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(100);
const nameSchema = z.string().trim().min(1, 'Name required').max(60);

interface AuthPageProps {
  initialMode?: Mode;
  onBack?: () => void;
}

const AuthPage = ({ initialMode = 'login', onBack }: AuthPageProps = {}) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const googleSignIn = async () => {
    if (!supabaseConfigured || !supabase) {
      toast.error('Account sign-in is not configured in this build. Continue as Guest.');
      return;
    }
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || 'Google sign-in failed');
        return;
      }
      if (result.redirected) return;
      toast.success('Welcome!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    setGuest(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured || !supabase) {
      toast.error('Account sign-in is not configured in this build. Continue as Guest.');
      return;
    }
    setBusy(true);
    try {
      const e1 = emailSchema.safeParse(email);
      if (!e1.success) { toast.error(e1.error.issues[0].message); return; }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(e1.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('Check your email for a reset link');
        setMode('login');
        return;
      }

      const p1 = passwordSchema.safeParse(password);
      if (!p1.success) { toast.error(p1.error.issues[0].message); return; }

      if (mode === 'signup') {
        const n1 = nameSchema.safeParse(name);
        if (!n1.success) { toast.error(n1.error.issues[0].message); return; }
        if (password !== confirm) { toast.error('Passwords do not match'); return; }

        const { error } = await supabase.auth.signUp({
          email: e1.data,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: n1.data },
          },
        });
        if (error) {
          // Do not disclose whether an email is already registered.
          toast.error('Unable to create the account. Please try again or use Sign in / Reset password.');
          return;
        }
        toast.success('Check your email to confirm your account');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: e1.data, password });
        if (error) {
          if (error.message.toLowerCase().includes('invalid')) toast.error('Invalid email or password');
          else if (error.message.toLowerCase().includes('confirm')) toast.error('Please confirm your email first');
          else toast.error(error.message);
          return;
        }
        toast.success('Welcome back!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Math Master</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === 'login' && 'Welcome back. Sign in to sync your progress.'}
            {mode === 'signup' && 'Create an account to save your streak everywhere.'}
            {mode === 'forgot' && "We'll email you a reset link."}
          </p>
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-3 mb-5">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={googleSignIn}
              disabled={busy}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 11v3.2h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.2 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5L18.2 5C16.6 3.5 14.5 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6 0-1.1-.1-1.6H12z"/>
              </svg>
              Continue with Google
            </Button>
            <div className="relative flex items-center">
              <div className="flex-1 h-px bg-border" />
              <span className="px-3 text-xs uppercase tracking-wider text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="pl-9" autoComplete="name" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" autoComplete="email" required />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete="new-password" required />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' && 'Sign in'}
            {mode === 'signup' && 'Create account'}
            {mode === 'forgot' && 'Send reset link'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm space-y-2">
          {mode === 'login' && (
            <>
              <button className="text-muted-foreground hover:text-foreground transition" onClick={() => setMode('forgot')}>Forgot password?</button>
              <div>
                New here?{' '}
                <button className="text-primary font-medium hover:underline" onClick={() => setMode('signup')}>Create account</button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div>
              Already have an account?{' '}
              <button className="text-primary font-medium hover:underline" onClick={() => setMode('login')}>Sign in</button>
            </div>
          )}
          {mode === 'forgot' && (
            <button className="text-primary font-medium hover:underline" onClick={() => setMode('login')}>Back to sign in</button>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={continueAsGuest}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Zap className="h-3 w-3" /> Continue as Guest
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;