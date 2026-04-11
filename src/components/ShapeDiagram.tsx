import { memo } from 'react';

interface DiagramProps {
  type: string;
  className?: string;
}

const strokeColor = 'currentColor';
const fillColor = 'hsl(var(--primary) / 0.1)';
const labelColor = 'hsl(var(--primary))';

const diagrams: Record<string, JSX.Element> = {
  square: (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <rect x="20" y="20" width="80" height="80" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <text x="60" y="68" textAnchor="middle" fontSize="14" fill={labelColor} fontStyle="italic">a</text>
      <text x="8" y="68" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 140 100" className="w-full h-full">
      <rect x="15" y="15" width="110" height="70" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <text x="70" y="58" textAnchor="middle" fontSize="14" fill={labelColor} fontStyle="italic">l</text>
      <text x="5" y="55" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">b</text>
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 120 110" className="w-full h-full">
      <polygon points="60,10 10,100 110,100" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="10" x2="60" y2="100" stroke={strokeColor} strokeWidth="1" strokeDasharray="4" />
      <text x="60" y="115" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">b</text>
      <text x="68" y="60" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
    </svg>
  ),
  'right-triangle': (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <polygon points="10,110 110,110 10,20" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <rect x="10" y="98" width="12" height="12" fill="none" stroke={strokeColor} strokeWidth="1.5" />
      <text x="60" y="125" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
      <text x="2" y="70" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">b</text>
      <text x="68" y="60" fontSize="12" fill={labelColor} fontStyle="italic">c</text>
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <circle cx="60" cy="60" r="48" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="60" x2="108" y2="60" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="84" y="55" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
      <circle cx="60" cy="60" r="2.5" fill={strokeColor} />
    </svg>
  ),
  semicircle: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M 10,65 A 50,50 0 0,1 110,65" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="10" y1="65" x2="110" y2="65" stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="65" x2="60" y2="15" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="64" y="45" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
    </svg>
  ),
  parallelogram: (
    <svg viewBox="0 0 140 100" className="w-full h-full">
      <polygon points="30,15 130,15 110,85 10,85" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="50" y1="15" x2="50" y2="85" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="70" y="95" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">b</text>
      <text x="55" y="55" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
    </svg>
  ),
  trapezium: (
    <svg viewBox="0 0 140 100" className="w-full h-full">
      <polygon points="40,15 100,15 130,85 10,85" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="70" y1="15" x2="70" y2="85" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="70" y="10" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
      <text x="70" y="98" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">b</text>
      <text x="76" y="55" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
    </svg>
  ),
  rhombus: (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <polygon points="60,10 110,60 60,110 10,60" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="10" y1="60" x2="110" y2="60" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <line x1="60" y1="10" x2="60" y2="110" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="85" y="55" fontSize="11" fill={labelColor}>d₁</text>
      <text x="63" y="35" fontSize="11" fill={labelColor}>d₂</text>
    </svg>
  ),
  'equilateral-triangle': (
    <svg viewBox="0 0 120 110" className="w-full h-full">
      <polygon points="60,10 10,100 110,100" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <text x="60" y="115" textAnchor="middle" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
      <text x="28" y="58" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
      <text x="88" y="58" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
    </svg>
  ),
  cube: (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <polygon points="20,85 20,35 55,20 55,70" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <polygon points="20,35 55,20 100,35 65,50" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      <polygon points="55,20 100,35 100,85 55,70" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="20" y1="85" x2="65" y2="100" stroke={strokeColor} strokeWidth="2" />
      <line x1="65" y1="100" x2="100" y2="85" stroke={strokeColor} strokeWidth="2" />
      <line x1="65" y1="100" x2="65" y2="50" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="42" y="100" fontSize="12" fill={labelColor} fontStyle="italic">a</text>
    </svg>
  ),
  cuboid: (
    <svg viewBox="0 0 140 110" className="w-full h-full">
      <polygon points="15,80 15,35 50,20 50,65" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <polygon points="15,35 50,20 125,30 90,45" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      <polygon points="50,20 125,30 125,75 50,65" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="15" y1="80" x2="90" y2="90" stroke={strokeColor} strokeWidth="2" />
      <line x1="90" y1="90" x2="125" y2="75" stroke={strokeColor} strokeWidth="2" />
      <line x1="90" y1="90" x2="90" y2="45" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="52" y="98" fontSize="11" fill={labelColor} fontStyle="italic">l</text>
      <text x="5" y="60" fontSize="11" fill={labelColor} fontStyle="italic">h</text>
      <text x="112" y="58" fontSize="11" fill={labelColor} fontStyle="italic">b</text>
    </svg>
  ),
  sphere: (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <circle cx="60" cy="60" r="48" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="60" rx="48" ry="14" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4" />
      <line x1="60" y1="60" x2="108" y2="60" stroke={strokeColor} strokeWidth="1.5" />
      <text x="84" y="55" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
      <circle cx="60" cy="60" r="2.5" fill={strokeColor} />
    </svg>
  ),
  hemisphere: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M 10,65 A 50,50 0 0,1 110,65" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="65" rx="50" ry="12" fill="none" stroke={strokeColor} strokeWidth="1.5" />
      <line x1="60" y1="65" x2="110" y2="65" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="88" y="60" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
    </svg>
  ),
  cylinder: (
    <svg viewBox="0 0 120 130" className="w-full h-full">
      <ellipse cx="60" cy="25" rx="42" ry="14" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="18" y1="25" x2="18" y2="100" stroke={strokeColor} strokeWidth="2" />
      <line x1="102" y1="25" x2="102" y2="100" stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="100" rx="42" ry="14" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="25" x2="102" y2="25" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <line x1="108" y1="25" x2="108" y2="100" stroke={strokeColor} strokeWidth="1" strokeDasharray="3" />
      <text x="80" y="20" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
      <text x="112" y="65" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
    </svg>
  ),
  cone: (
    <svg viewBox="0 0 120 130" className="w-full h-full">
      <line x1="60" y1="10" x2="18" y2="105" stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="10" x2="102" y2="105" stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="105" rx="42" ry="14" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="10" x2="60" y2="105" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <line x1="60" y1="105" x2="102" y2="105" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="64" y="60" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
      <text x="80" y="118" fontSize="12" fill={labelColor} fontStyle="italic">r</text>
      <text x="36" y="60" fontSize="12" fill={labelColor} fontStyle="italic">l</text>
    </svg>
  ),
  frustum: (
    <svg viewBox="0 0 120 130" className="w-full h-full">
      <line x1="40" y1="25" x2="18" y2="105" stroke={strokeColor} strokeWidth="2" />
      <line x1="80" y1="25" x2="102" y2="105" stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="25" rx="20" ry="8" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <ellipse cx="60" cy="105" rx="42" ry="14" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
      <line x1="60" y1="25" x2="60" y2="105" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4" />
      <text x="64" y="70" fontSize="12" fill={labelColor} fontStyle="italic">h</text>
      <text x="80" y="118" fontSize="12" fill={labelColor} fontStyle="italic">R</text>
      <text x="64" y="20" fontSize="11" fill={labelColor} fontStyle="italic">r</text>
    </svg>
  ),
};

const ShapeDiagram = memo(({ type, className = '' }: DiagramProps) => {
  const svg = diagrams[type];
  if (!svg) return null;

  return (
    <div className={`w-24 h-24 text-foreground mx-auto ${className}`}>
      {svg}
    </div>
  );
});

ShapeDiagram.displayName = 'ShapeDiagram';

export default ShapeDiagram;
