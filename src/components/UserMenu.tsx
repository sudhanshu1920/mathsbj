import { useEffect, useState } from 'react';
import { LogOut, User as UserIcon, Cloud, CloudOff, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { isSyncing } from '@/lib/sync';

const UserMenu = () => {
  const { user, signOut } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(isSyncing());

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    const onSync = (e: Event) => setSyncing(!!(e as CustomEvent).detail?.syncing);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    window.addEventListener('sync-state', onSync as EventListener);
    return () => {
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
      window.removeEventListener('sync-state', onSync as EventListener);
    };
  }, []);

  if (!user) return null;
  const initial = (user.user_metadata?.display_name || user.email || '?').toString().charAt(0).toUpperCase();

  const StatusIcon = syncing ? Loader2 : online ? Cloud : CloudOff;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center hover:bg-primary/20 transition" aria-label="Account">
          {initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-background flex items-center justify-center">
            <StatusIcon className={`h-2.5 w-2.5 ${syncing ? 'animate-spin text-primary' : online ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">{user.user_metadata?.display_name || 'Account'}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {syncing ? 'Syncing…' : online ? 'Synced • Online' : 'Offline — changes saved locally'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;