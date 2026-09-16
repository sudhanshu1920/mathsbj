import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHORTCUTS: [string, string][] = [
  ['1', 'Go to Learning'],
  ['2', 'Go to Quiz'],
  ['3', 'Go to Progress'],
  ['Ctrl / ⌘ + K', 'Open command palette'],
  ['Enter', 'Submit the current answer'],
  ['Esc', 'Go back / close overlay'],
  ['?', 'Show this help'],
];

const ShortcutsHelp = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display">Keyboard shortcuts</DialogTitle>
      </DialogHeader>
      <div className="divide-y divide-border/50">
        {SHORTCUTS.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground">{desc}</span>
            <kbd className="text-[11px] px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground tabular-nums">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default ShortcutsHelp;
