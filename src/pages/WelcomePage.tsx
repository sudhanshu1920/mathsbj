import { m as motion } from 'framer-motion';
import { UserPlus, LogIn, Zap, Gamepad2 } from 'lucide-react';
import { setGuest } from '@/lib/guest';
import ChunkyButton from '@/components/duo/ChunkyButton';

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
        <div className="mx-auto mb-6 flex justify-center">
          <div className="glass-panel rounded-3xl p-6 inline-flex items-center justify-center glass-glow">
            <Gamepad2 className="h-16 w-16 text-primary neon-text" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="font-display font-black text-5xl tracking-wide text-foreground uppercase neon-text">Math Quest</h1>
        <p className="mt-3 text-sm text-muted-foreground font-display font-semibold uppercase tracking-wider">
          Premium gaming HUD · works offline
        </p>

        <div className="mt-8 space-y-3">
          <ChunkyButton onClick={continueAsGuest} size="lg" variant="primary" className="w-full">
            <Zap className="h-5 w-5" /> Get Started
          </ChunkyButton>

          <ChunkyButton onClick={() => onAuthRequested('login')} size="lg" variant="ghost" className="w-full">
            <LogIn className="h-5 w-5" /> I Already Have an Account
          </ChunkyButton>

          <button
            onClick={() => onAuthRequested('signup')}
            className="w-full text-sm font-display font-bold text-muted-foreground hover:text-foreground pt-2"
          >
            <UserPlus className="inline h-4 w-4 mr-1" /> Create Account
          </button>
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