import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { BookOpen, Target, BarChart3, Sun, Moon, Crown, Keyboard } from 'lucide-react';
import { toggleMode, useMode } from '@/lib/theme';
import { getTablesProMode, setTablesProMode } from '@/lib/settings';

export type PaletteTab = 'learn' | 'practice' | 'progress';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate: (tab: PaletteTab) => void;
  onStartPractice: (topic: string) => void;
  onOpenShortcuts: () => void;
}

const TOPICS = [
  { id: 'tables', label: 'Tables' },
  { id: 'squares', label: 'Squares' },
  { id: 'roots', label: 'Roots' },
  { id: 'cubes', label: 'Cubes' },
  { id: 'powers', label: 'Powers' },
  { id: 'percentage', label: 'Percentage' },
];

const CommandPalette = ({ open, onOpenChange, onNavigate, onStartPractice, onOpenShortcuts }: Props) => {
  const mode = useMode();

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, topics and actions..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => run(() => onNavigate('learn'))}>
            <BookOpen className="mr-2 h-4 w-4" /> Learning
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('practice'))}>
            <Target className="mr-2 h-4 w-4" /> Quiz
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('progress'))}>
            <BarChart3 className="mr-2 h-4 w-4" /> Progress
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Practice">
          {TOPICS.map((t) => (
            <CommandItem key={t.id} onSelect={() => run(() => onStartPractice(t.id))}>
              <Target className="mr-2 h-4 w-4" /> Practice {t.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(toggleMode)}>
            {mode === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Switch to {mode === 'dark' ? 'light' : 'dark'} mode
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTablesProMode(!getTablesProMode()))}>
            <Crown className="mr-2 h-4 w-4" /> Toggle Pro tables (×1–×20)
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenShortcuts)}>
            <Keyboard className="mr-2 h-4 w-4" /> Keyboard shortcuts
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
