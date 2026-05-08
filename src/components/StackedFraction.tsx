interface StackedFractionProps {
  whole?: number;
  numerator: number;
  denominator: number;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'foreground';
}

const SIZES = {
  sm: { whole: 'text-sm', frac: 'text-[11px]', bar: 'min-w-[14px]' },
  md: { whole: 'text-lg', frac: 'text-xs', bar: 'min-w-[18px]' },
  lg: { whole: 'text-2xl', frac: 'text-sm', bar: 'min-w-[22px]' },
};

const StackedFraction = ({
  whole,
  numerator,
  denominator,
  suffix = '%',
  size = 'md',
  color = 'primary',
}: StackedFractionProps) => {
  const s = SIZES[size];
  const txt = color === 'primary' ? 'text-primary' : 'text-foreground';
  const bar = color === 'primary' ? 'bg-primary/70' : 'bg-foreground/60';
  return (
    <span className="inline-flex items-baseline gap-1 align-middle">
      {whole !== undefined && whole > 0 && (
        <span className={`font-bold ${txt} ${s.whole}`}>{whole}</span>
      )}
      <span
        className={`inline-flex flex-col items-center leading-none ${s.frac} ${s.bar} relative`}
        style={{ verticalAlign: 'middle', transform: 'translateY(0.15em)' }}
      >
        <span className={`${txt} font-bold tabular-nums`}>{numerator}</span>
        <span className={`block w-full h-[1.5px] ${bar} my-[2px] rounded-full`} />
        <span className={`${txt} font-bold tabular-nums`}>{denominator}</span>
      </span>
      {suffix && <span className={`font-bold ${txt} ${s.whole}`}>{suffix}</span>}
    </span>
  );
};

export default StackedFraction;
