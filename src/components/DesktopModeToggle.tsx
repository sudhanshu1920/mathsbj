import { Monitor, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'desktop-mode';

const applyDesktopClass = (enabled: boolean) => {
  document.documentElement.classList.toggle('desktop-mode', enabled);
};

export const initDesktopMode = () => {
  const saved = localStorage.getItem(STORAGE_KEY) === '1';
  applyDesktopClass(saved);
};

const DesktopModeToggle = () => {
  const [desktop, setDesktop] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  useEffect(() => {
    applyDesktopClass(desktop);
    localStorage.setItem(STORAGE_KEY, desktop ? '1' : '0');
  }, [desktop]);

  return (
    <button
      onClick={() => setDesktop((d) => !d)}
      className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
      aria-label="Toggle desktop mode"
      title={desktop ? 'Switch to mobile layout' : 'Switch to desktop layout'}
    >
      {desktop ? <Smartphone size={18} /> : <Monitor size={18} />}
    </button>
  );
};

export default DesktopModeToggle;
