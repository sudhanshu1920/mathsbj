interface StackedFractionProps {
  whole?: number;
  numerator: number;
  denominator: number;
  suffix?: string;
}

const StackedFraction = ({ whole, numerator, denominator, suffix = '%' }: StackedFractionProps) => {
  return (
    <span className="inline-flex items-center gap-0.5">
      {whole !== undefined && whole > 0 && (
        <span className="font-bold text-primary text-lg">{whole}</span>
      )}
      <span className="inline-flex flex-col items-center leading-none text-xs relative" style={{ verticalAlign: 'middle' }}>
        <span className="text-primary font-semibold">{numerator}</span>
        <span className="w-full h-px bg-primary/60 my-0.5" />
        <span className="text-primary font-semibold">{denominator}</span>
      </span>
      <span className="text-primary font-bold text-lg">{suffix}</span>
    </span>
  );
};

export default StackedFraction;
