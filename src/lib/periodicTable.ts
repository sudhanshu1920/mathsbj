/**
 * Single source of truth for Periodic Table data (Learning + Quiz).
 * Masses: IUPAC standard atomic weights (abridged). Elements without a stable
 * isotope use the mass number of their longest-lived isotope (radioactive = true).
 */

export type ElementCategory =
  | 'alkali-metal' | 'alkaline-earth' | 'transition-metal' | 'post-transition'
  | 'metalloid' | 'nonmetal' | 'halogen' | 'noble-gas' | 'lanthanide' | 'actinide' | 'unknown';

export interface ChemElement {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  radioactive: boolean;
  category: ElementCategory;
  config: string;
  period: number;
  group: number | null;
  block: 's' | 'p' | 'd' | 'f';
  /** grid column 1-18 */
  xpos: number;
  /** grid row 1-7 main, 9 lanthanides, 10 actinides */
  ypos: number;
  state: 'Solid' | 'Liquid' | 'Gas' | 'Unknown';
}

// number|symbol|name|mass|category code|config  (mass ending "*" = radioactive mass number)
const RAW = `H|Hydrogen|1.008|n|1s1
He|Helium|4.0026|g|1s2
Li|Lithium|6.94|a|[He] 2s1
Be|Beryllium|9.0122|e|[He] 2s2
B|Boron|10.81|m|[He] 2s2 2p1
C|Carbon|12.011|n|[He] 2s2 2p2
N|Nitrogen|14.007|n|[He] 2s2 2p3
O|Oxygen|15.999|n|[He] 2s2 2p4
F|Fluorine|18.998|h|[He] 2s2 2p5
Ne|Neon|20.180|g|[He] 2s2 2p6
Na|Sodium|22.990|a|[Ne] 3s1
Mg|Magnesium|24.305|e|[Ne] 3s2
Al|Aluminium|26.982|p|[Ne] 3s2 3p1
Si|Silicon|28.085|m|[Ne] 3s2 3p2
P|Phosphorus|30.974|n|[Ne] 3s2 3p3
S|Sulfur|32.06|n|[Ne] 3s2 3p4
Cl|Chlorine|35.45|h|[Ne] 3s2 3p5
Ar|Argon|39.95|g|[Ne] 3s2 3p6
K|Potassium|39.098|a|[Ar] 4s1
Ca|Calcium|40.078|e|[Ar] 4s2
Sc|Scandium|44.956|t|[Ar] 3d1 4s2
Ti|Titanium|47.867|t|[Ar] 3d2 4s2
V|Vanadium|50.942|t|[Ar] 3d3 4s2
Cr|Chromium|51.996|t|[Ar] 3d5 4s1
Mn|Manganese|54.938|t|[Ar] 3d5 4s2
Fe|Iron|55.845|t|[Ar] 3d6 4s2
Co|Cobalt|58.933|t|[Ar] 3d7 4s2
Ni|Nickel|58.693|t|[Ar] 3d8 4s2
Cu|Copper|63.546|t|[Ar] 3d10 4s1
Zn|Zinc|65.38|t|[Ar] 3d10 4s2
Ga|Gallium|69.723|p|[Ar] 3d10 4s2 4p1
Ge|Germanium|72.630|m|[Ar] 3d10 4s2 4p2
As|Arsenic|74.922|m|[Ar] 3d10 4s2 4p3
Se|Selenium|78.971|n|[Ar] 3d10 4s2 4p4
Br|Bromine|79.904|h|[Ar] 3d10 4s2 4p5
Kr|Krypton|83.798|g|[Ar] 3d10 4s2 4p6
Rb|Rubidium|85.468|a|[Kr] 5s1
Sr|Strontium|87.62|e|[Kr] 5s2
Y|Yttrium|88.906|t|[Kr] 4d1 5s2
Zr|Zirconium|91.224|t|[Kr] 4d2 5s2
Nb|Niobium|92.906|t|[Kr] 4d4 5s1
Mo|Molybdenum|95.95|t|[Kr] 4d5 5s1
Tc|Technetium|98*|t|[Kr] 4d5 5s2
Ru|Ruthenium|101.07|t|[Kr] 4d7 5s1
Rh|Rhodium|102.91|t|[Kr] 4d8 5s1
Pd|Palladium|106.42|t|[Kr] 4d10
Ag|Silver|107.87|t|[Kr] 4d10 5s1
Cd|Cadmium|112.41|t|[Kr] 4d10 5s2
In|Indium|114.82|p|[Kr] 4d10 5s2 5p1
Sn|Tin|118.71|p|[Kr] 4d10 5s2 5p2
Sb|Antimony|121.76|m|[Kr] 4d10 5s2 5p3
Te|Tellurium|127.60|m|[Kr] 4d10 5s2 5p4
I|Iodine|126.90|h|[Kr] 4d10 5s2 5p5
Xe|Xenon|131.29|g|[Kr] 4d10 5s2 5p6
Cs|Caesium|132.91|a|[Xe] 6s1
Ba|Barium|137.33|e|[Xe] 6s2
La|Lanthanum|138.91|l|[Xe] 5d1 6s2
Ce|Cerium|140.12|l|[Xe] 4f1 5d1 6s2
Pr|Praseodymium|140.91|l|[Xe] 4f3 6s2
Nd|Neodymium|144.24|l|[Xe] 4f4 6s2
Pm|Promethium|145*|l|[Xe] 4f5 6s2
Sm|Samarium|150.36|l|[Xe] 4f6 6s2
Eu|Europium|151.96|l|[Xe] 4f7 6s2
Gd|Gadolinium|157.25|l|[Xe] 4f7 5d1 6s2
Tb|Terbium|158.93|l|[Xe] 4f9 6s2
Dy|Dysprosium|162.50|l|[Xe] 4f10 6s2
Ho|Holmium|164.93|l|[Xe] 4f11 6s2
Er|Erbium|167.26|l|[Xe] 4f12 6s2
Tm|Thulium|168.93|l|[Xe] 4f13 6s2
Yb|Ytterbium|173.05|l|[Xe] 4f14 6s2
Lu|Lutetium|174.97|l|[Xe] 4f14 5d1 6s2
Hf|Hafnium|178.49|t|[Xe] 4f14 5d2 6s2
Ta|Tantalum|180.95|t|[Xe] 4f14 5d3 6s2
W|Tungsten|183.84|t|[Xe] 4f14 5d4 6s2
Re|Rhenium|186.21|t|[Xe] 4f14 5d5 6s2
Os|Osmium|190.23|t|[Xe] 4f14 5d6 6s2
Ir|Iridium|192.22|t|[Xe] 4f14 5d7 6s2
Pt|Platinum|195.08|t|[Xe] 4f14 5d9 6s1
Au|Gold|196.97|t|[Xe] 4f14 5d10 6s1
Hg|Mercury|200.59|t|[Xe] 4f14 5d10 6s2
Tl|Thallium|204.38|p|[Xe] 4f14 5d10 6s2 6p1
Pb|Lead|207.2|p|[Xe] 4f14 5d10 6s2 6p2
Bi|Bismuth|208.98|p|[Xe] 4f14 5d10 6s2 6p3
Po|Polonium|209*|p|[Xe] 4f14 5d10 6s2 6p4
At|Astatine|210*|h|[Xe] 4f14 5d10 6s2 6p5
Rn|Radon|222*|g|[Xe] 4f14 5d10 6s2 6p6
Fr|Francium|223*|a|[Rn] 7s1
Ra|Radium|226*|e|[Rn] 7s2
Ac|Actinium|227*|c|[Rn] 6d1 7s2
Th|Thorium|232.04|c|[Rn] 6d2 7s2
Pa|Protactinium|231.04|c|[Rn] 5f2 6d1 7s2
U|Uranium|238.03|c|[Rn] 5f3 6d1 7s2
Np|Neptunium|237*|c|[Rn] 5f4 6d1 7s2
Pu|Plutonium|244*|c|[Rn] 5f6 7s2
Am|Americium|243*|c|[Rn] 5f7 7s2
Cm|Curium|247*|c|[Rn] 5f7 6d1 7s2
Bk|Berkelium|247*|c|[Rn] 5f9 7s2
Cf|Californium|251*|c|[Rn] 5f10 7s2
Es|Einsteinium|252*|c|[Rn] 5f11 7s2
Fm|Fermium|257*|c|[Rn] 5f12 7s2
Md|Mendelevium|258*|c|[Rn] 5f13 7s2
No|Nobelium|259*|c|[Rn] 5f14 7s2
Lr|Lawrencium|266*|c|[Rn] 5f14 7s2 7p1
Rf|Rutherfordium|267*|t|[Rn] 5f14 6d2 7s2
Db|Dubnium|268*|t|[Rn] 5f14 6d3 7s2
Sg|Seaborgium|269*|t|[Rn] 5f14 6d4 7s2
Bh|Bohrium|270*|t|[Rn] 5f14 6d5 7s2
Hs|Hassium|277*|t|[Rn] 5f14 6d6 7s2
Mt|Meitnerium|278*|u|[Rn] 5f14 6d7 7s2
Ds|Darmstadtium|281*|u|[Rn] 5f14 6d8 7s2
Rg|Roentgenium|282*|u|[Rn] 5f14 6d9 7s2
Cn|Copernicium|285*|t|[Rn] 5f14 6d10 7s2
Nh|Nihonium|286*|u|[Rn] 5f14 6d10 7s2 7p1
Fl|Flerovium|289*|u|[Rn] 5f14 6d10 7s2 7p2
Mc|Moscovium|290*|u|[Rn] 5f14 6d10 7s2 7p3
Lv|Livermorium|293*|u|[Rn] 5f14 6d10 7s2 7p4
Ts|Tennessine|294*|u|[Rn] 5f14 6d10 7s2 7p5
Og|Oganesson|294*|u|[Rn] 5f14 6d10 7s2 7p6`;

const CAT: Record<string, ElementCategory> = {
  a: 'alkali-metal', e: 'alkaline-earth', t: 'transition-metal', p: 'post-transition',
  m: 'metalloid', n: 'nonmetal', h: 'halogen', g: 'noble-gas', l: 'lanthanide', c: 'actinide', u: 'unknown',
};

export const CATEGORY_LABEL: Record<ElementCategory, string> = {
  'alkali-metal': 'Alkali Metal',
  'alkaline-earth': 'Alkaline Earth Metal',
  'transition-metal': 'Transition Metal',
  'post-transition': 'Post-transition Metal',
  metalloid: 'Metalloid',
  nonmetal: 'Reactive Nonmetal',
  halogen: 'Halogen',
  'noble-gas': 'Noble Gas',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
  unknown: 'Unknown Properties',
};

const GASES = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
const LIQUIDS = new Set([35, 80]);
const PERIOD_END = [2, 10, 18, 36, 54, 86, 118];

function place(n: number): Pick<ChemElement, 'period' | 'group' | 'block' | 'xpos' | 'ypos'> {
  const period = PERIOD_END.findIndex((e) => n <= e) + 1;
  const start = period === 1 ? 1 : PERIOD_END[period - 2] + 1;
  const idx = n - start;

  if (period === 1) {
    const group = n === 1 ? 1 : 18;
    return { period, group, block: 's', xpos: group, ypos: period };
  }

  // Periods 2–3: s-block, then the p-block at groups 13–18.
  if (period <= 3) {
    const group = idx < 2 ? idx + 1 : idx + 11;
    return { period, group, block: group <= 2 ? 's' : 'p', xpos: group, ypos: period };
  }

  // Periods 4–5 are complete 18-column rows.
  if (period <= 5) {
    const group = idx + 1;
    return { period, group, block: group <= 2 ? 's' : group <= 12 ? 'd' : 'p', xpos: group, ypos: period };
  }

  // Textbook layout: La/Ac occupy group 3 in the main table; the remaining
  // 14 f-block members are shown in separated rows underneath.
  if (idx === 0 || idx === 1) {
    const group = idx + 1;
    return { period, group, block: 's', xpos: group, ypos: period };
  }
  if (idx === 2) {
    return { period, group: 3, block: 'd', xpos: 3, ypos: period };
  }
  if (idx >= 3 && idx <= 16) {
    return {
      period,
      group: null,
      block: 'f',
      xpos: idx,
      ypos: period === 6 ? 9 : 10,
    };
  }

  const group = 4 + (idx - 17);
  return { period, group, block: group <= 12 ? 'd' : 'p', xpos: group, ypos: period };
}

export const ELEMENTS: ChemElement[] = RAW.split('\n').map((line, i) => {
  const [symbol, name, massRaw, cat, config] = line.split('|');
  const number = i + 1;
  const radioactive = massRaw.endsWith('*');
  return {
    number,
    symbol,
    name,
    mass: parseFloat(massRaw),
    radioactive,
    category: CAT[cat],
    config,
    state: number > 103 ? 'Unknown' : GASES.has(number) ? 'Gas' : LIQUIDS.has(number) ? 'Liquid' : 'Solid',
    ...place(number),
  };
});

export const getElement = (n: number) => ELEMENTS[n - 1];

/** Textbook round figures: nearest whole number, except Cl and Cu which are conventionally 35.5 / 63.5. */
const ROUND_OVERRIDE: Record<number, number> = { 17: 35.5, 29: 63.5 };

export function roundMass(el: ChemElement): number {
  return ROUND_OVERRIDE[el.number] ?? Math.round(el.mass);
}

export function formatMass(el: ChemElement, mode: 'exact' | 'round' = 'exact'): string {
  if (mode === 'round') return String(roundMass(el));
  return el.radioactive ? `[${el.mass}]` : String(el.mass);
}
