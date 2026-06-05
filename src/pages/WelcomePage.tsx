import { motion } from 'framer-motion';
import { Sparkles, UserPlus, LogIn, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setGuest } from '@/lib/guest';

interface Props {
  onAuthRequested: (mode: 'login' | 'signup') => void;
}

const WelcomePage = ({ onAuthRequested }: Props) => {
  const continueAsGuest = () => setGuest(true);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10 text-center"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mx-auto mb-6 h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center shadow-[0_0_40px_-8px_hsl(var(--primary)/0.7)]"
        >
          <Sparkles className="h-10 w-10 text-primary-foreground" />
        </motion.div>

        <h1 className="text-4xl font-display font-bold tracking-tight text-glow">Math Master</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Premium math learning. Works fully offline.
        </p>

        <div className="mt-10 space-y-3">
          <Button
            onClick={continueAsGuest}
            size="lg"
            className="w-full gradient-primary text-primary-foreground font-semibold shadow-[0_0_24px_-8px_hsl(var(--primary)/0.8)]"
          >
            <Zap className="h-4 w-4" />
            Continue as Guest
          </Button>

          <Button
            onClick={() => onAuthRequested('login')}
            size="lg"
            variant="outline"
            className="w-full"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>

          <Button
            onClick={() => onAuthRequested('signup')}
            size="lg"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/70">
          Guest mode keeps progress on this device.<br />
          Sign in anytime to back up & sync.
        </p>
      </motion.div>
    </div>
  );
};

export default WelcomePage;