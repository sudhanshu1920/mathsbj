import { Delete, Check, Plus } from 'lucide-react';
import { playClick } from '@/lib/sound';

interface MathKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Which special keys to enable. */
  variant?: 'numeric' | 'fraction' | 'mixed' | 'decimal' | 'full';
  disabled?: boolean;
  /** Hide the OK row (submit handled externally, e.g. by a fixed bottom bar). */
  hideOk?: boolean;
}

/**
 * Custom on-screen math keypad supporting digits, /, %, ., space, backspace and OK.
 * Designed for percentage / fraction practice typing.
 */
const MathKeypad = ({ value, onChange, onSubmit, variant = 'full', disabled, hideOk }: MathKeypadProps) => {
  const press = (k: string) => {
    if (disabled) return;
    try { playClick(); } catch { /* audio is optional */ }
    if (k === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === 'ok') {
      onSubmit();
      return;
    }
    // The "+" key acts as a mixed-number separator: insert single space.
    if (k === 'mix') {
      const trimmed = value.replace(/\s+$/, '');
      if (!trimmed || trimmed.endsWith(' ')) return;
      onChange(trimmed + ' ');
      return;
    }
    onChange(value + k);
  };

  type Key = { label: React.ReactNode; key: string; tone?: 'num' | 'op' | 'ok' | 'back' | 'mute'; span?: number };
  const allRows: Key[][] = [
    [
      { label: '1', key: '1', tone: 'num' },
      { label: '2', key: '2', tone: 'num' },
      { label: '3', key: '3', tone: 'num' },
    ],
    [
      { label: '4', key: '4', tone: 'num' },
      { label: '5', key: '5', tone: 'num' },
      { label: '6', key: '6', tone: 'num' },
    ],
    [
      { label: '7', key: '7', tone: 'num' },
      { label: '8', key: '8', tone: 'num' },
      { label: '9', key: '9', tone: 'num' },
    ],
    [
      { label: <Plus size={20} />, key: 'mix', tone: 'op' },
      { label: '0', key: '0', tone: 'num' },
      { label: '/', key: '/', tone: 'op' },
    ],
    [
      { label: '%', key: '%', tone: 'op' },
      { label: '.', key: '.', tone: 'op' },
      { label: <Delete size={20} />, key: 'back', tone: 'back' },
    ],
    [
      { label: <span className="inline-flex items-center gap-2"><Check size={20} /> OK</span>, key: 'ok', tone: 'ok', span: 3 },
    ],
  ];
  const rows = hideOk ? allRows.slice(0, -1) : allRows;

  const toneClass = (t?: Key['tone']) => {
    switch (t) {
      case 'op':
        return 'glass text-primary border-primary/40 [@media(hover:hover)]:hover:border-primary';
      case 'back':
        return 'glass text-destructive border-destructive/40 [@media(hover:hover)]:hover:border-destructive';
      case 'ok':
        return 'gradient-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.5)]';
      case 'mute':
        return 'opacity-30 pointer-events-none bg-card border border-border text-muted-foreground';
      default:
        return 'glass text-foreground [@media(hover:hover)]:hover:border-primary/60';
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto select-none">
      {rows.flat().map((k, i) => (
        <button
          key={`${i}-${k.key}`}
          type="button"
          onClick={(e) => { e.currentTarget.blur(); press(k.key); }}
          style={k.span ? { gridColumn: `span ${k.span} / span ${k.span}` } : undefined}
          className={`motion-press keypad-key ${k.tone === 'back' ? 'keypad-key-danger' : ''} h-12 rounded-2xl font-display font-bold text-xl flex items-center justify-center transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${toneClass(k.tone)}`}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
};

export default MathKeypad;