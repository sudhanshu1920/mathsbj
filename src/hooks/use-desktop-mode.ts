import { useEffect, useState } from 'react';

/** Tracks the `desktop-mode` class on <html> (toggled by DesktopModeToggle). */
export const useDesktopMode = () => {
  const [desktop, setDesktop] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('desktop-mode'),
  );

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDesktop(el.classList.contains('desktop-mode'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return desktop;
};

/** True when desktop mode is on AND the viewport is wide enough for the side panel. */
export const useWideDesktop = (minWidth = 1024) => {
  const desktop = useDesktopMode();
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= minWidth,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [minWidth]);

  return desktop && wide;
};
