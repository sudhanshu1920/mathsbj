/**
 * Single source of truth for Periodic Table data (Learning + Quiz).
 * Masses: IUPAC standard atomic weights (abridged). Elements without a stable
 * isotope use the mass number of their longest-lived isotope (radioactive = true).
 */

export type ElementCategory =
  | 'alkali-metal' | 'alkaline-earth' | 'transition-metal' | 'post-transition'
  | 'metalloid' | 'nonmetal' | 'halogen' | 'noble-gas' | 'lanthanide' | 'actinide' | 'unknown';

export type PeriodicQuestionType = 'atomic-number' | 'symbol' | 'name' | 'mass';
export type PeriodicMassMode = 'round' | 'exact';

export interface ElementPhysicalProperties {
  /** PubChem periodic-table snapshot; density is normalized to g/cm³. */
  densityGPerCm3: number | null;
  /** PubChem values are Kelvin. Null means no suitable value was included. */
  meltingPointK: number | null;
  boilingPointK: number | null;
  sourceName: 'PubChem Periodic Table';
  /** Element-specific record for provenance and additional measurement notes. */
  sourceUrl: string;
  caveat?: string;
}

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
  /** Approximate bulk phase at 20 °C and 1 atm; Unknown where not established. */
  state: 'Solid' | 'Liquid' | 'Gas' | 'Unknown';
  /** Every exported element has this object; unavailable values are explicitly null. */
  physicalProperties?: ElementPhysicalProperties;
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

  // Textbook layout: periods 6–7 reserve group 3 for the f-block marker.
  // All 15 lanthanides/actinides are rendered in the separated rows below.
  if (idx === 0 || idx === 1) {
    const group = idx + 1;
    return { period, group, block: 's', xpos: group, ypos: period };
  }
  if (idx >= 2 && idx <= 16) {
    return {
      period,
      group: null,
      block: 'f',
      // The f-block is aligned under groups 4–18 (15 elements).
      xpos: idx + 2,
      ypos: period === 6 ? 9 : 10,
    };
  }

  const group = 4 + (idx - 17);
  return { period, group, block: group <= 12 ? 'd' : 'p', xpos: group, ypos: period };
}

const UNCERTAIN_BULK_STATE = new Set([85, 87]);
const PHYSICAL_DATA_SOURCE = 'PubChem Periodic Table' as const;
export const PUBCHEM_PERIODIC_TABLE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON';

/**
 * Offline snapshot of PubChem's Periodic Table structured fields.
 * Format: atomicNumber|meltingPointK|boilingPointK|densityGPerCm3.
 * Blank values deliberately remain unavailable rather than inferred.
 *
 * Values are omitted for bulk properties not established for transient/
 * synthetic elements in this snapshot. Helium's pressure-dependent melting
 * point and normal-pressure subliming elements (carbon and arsenic) are
 * intentionally not mislabeled as ordinary 1-atm melting/boiling points.
 */
const PHYSICAL_DATA_RAW = `1|13.81|20.28|0.00008988
2||4.22|0.0001785
3|453.65|1615|0.534
4|1560|2744|1.85
5|2348|4273|2.37
6|||2.2670
7|63.15|77.36|0.0012506
8|54.36|90.2|0.001429
9|53.53|85.03|0.001696
10|24.56|27.07|0.0008999
11|370.95|1156|0.97
12|923|1363|1.74
13|933.437|2792|2.70
14|1687|3538|2.3296
15|317.3|553.65|1.82
16|388.36|717.75|2.067
17|171.65|239.11|0.003214
18|83.8|87.3|0.0017837
19|336.53|1032|0.89
20|1115|1757|1.54
21|1814|3109|2.99
22|1941|3560|4.5
23|2183|3680|6.0
24|2180|2944|7.15
25|1519|2334|7.3
26|1811|3134|7.874
27|1768|3200|8.86
28|1728|3186|8.912
29|1357.77|2835|8.933
30|692.68|1180|7.134
31|302.91|2477|5.91
32|1211.4|3106|5.323
33|||5.776
34|493.65|958|4.809
35|265.95|331.95|3.11
36|115.79|119.93|0.003733
37|312.46|961|1.53
38|1050|1655|2.64
39|1795|3618|4.47
40|2128|4682|6.52
41|2750|5017|8.57
42|2896|4912|10.2
43|2430|4538|11
44|2607|4423|12.1
45|2237|3968|12.4
46|1828.05|3236|12.0
47|1234.93|2435|10.501
48|594.22|1040|8.69
49|429.75|2345|7.31
50|505.08|2875|7.287
51|903.78|1860|6.685
52|722.66|1261|6.232
53|386.85|457.55|4.93
54|161.36|165.03|0.005887
55|301.59|944|1.93
56|1000|2170|3.62
57|1191|3737|6.15
58|1071|3697|6.770
59|1204|3793|6.77
60|1294|3347|7.01
61|1315|3273|7.26
62|1347|2067|7.52
63|1095|1802|5.24
64|1586|3546|7.90
65|1629|3503|8.23
66|1685|2840|8.55
67|1747|2973|8.80
68|1802|3141|9.07
69|1818|2223|9.32
70|1092|1469|6.90
71|1936|3675|9.84
72|2506|4876|13.3
73|3290|5731|16.4
74|3695|5828|19.3
75|3459|5869|20.8
76|3306|5285|22.57
77|2719|4701|22.42
78|2041.55|4098|21.46
79|1337.33|3129|19.282
80|234.32|629.88|13.5336
81|577|1746|11.8
82|600.61|2022|11.342
83|544.55|1837|9.807
84|527|1235|9.32
86|202|211.45|0.00973
88|973|1413|5
89|1324|3471|10.07
90|2023|5061|11.72
91|1845||15.37
92|1408|4404|18.95
93|917|4175|20.25
94|913|3501|19.84
95|1449|2284|13.69
96|1618|3400|13.51`;

function parsePhysicalValue(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const VERIFIED_PHYSICAL_VALUES = new Map<number, Pick<ElementPhysicalProperties, 'densityGPerCm3' | 'meltingPointK' | 'boilingPointK'>>(
  PHYSICAL_DATA_RAW.split('\n').map((line) => {
    const [numberRaw, meltingRaw, boilingRaw, densityRaw] = line.split('|');
    return [Number(numberRaw), {
      meltingPointK: parsePhysicalValue(meltingRaw),
      boilingPointK: parsePhysicalValue(boilingRaw),
      densityGPerCm3: parsePhysicalValue(densityRaw),
    }];
  }),
);

function getPhysicalCaveat(number: number): string | undefined {
  if (number === 2) return 'Helium does not solidify at 1 atm; pressure-dependent melting values are omitted.';
  if (number === 6) return 'Carbon sublimes at 1 atm; ordinary-pressure melting and boiling values are omitted.';
  if (number === 33) return 'Arsenic sublimes at 1 atm; ordinary-pressure melting and boiling values are omitted.';
  if (number === 85 || number === 87) return 'Reliable bulk physical measurements are not established in this snapshot.';
  if (number >= 97) return 'Bulk physical values are omitted because this snapshot does not distinguish experimentally measured values from estimates for these synthetic/radioactive elements.';
  return undefined;
}

function createPhysicalProperties(number: number): ElementPhysicalProperties {
  const values = VERIFIED_PHYSICAL_VALUES.get(number);
  const caveat = getPhysicalCaveat(number);
  return {
    densityGPerCm3: values?.densityGPerCm3 ?? null,
    meltingPointK: values?.meltingPointK ?? null,
    boilingPointK: values?.boilingPointK ?? null,
    sourceName: PHYSICAL_DATA_SOURCE,
    sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/element/${number}`,
    ...(caveat ? { caveat } : {}),
  };
}

export const ELEMENTS: ChemElement[] = RAW.split('\n').map((line, i) => {
  const [symbol, name, massRaw, cat, config] = line.split('|');
  const number = i + 1;
  const radioactive = massRaw.endsWith('*');
  const uncertainState = number >= 97 || UNCERTAIN_BULK_STATE.has(number);
  return {
    number,
    symbol,
    name,
    mass: parseFloat(massRaw),
    radioactive,
    category: CAT[cat],
    config,
    state: uncertainState ? 'Unknown' : GASES.has(number) ? 'Gas' : LIQUIDS.has(number) ? 'Liquid' : 'Solid',
    physicalProperties: createPhysicalProperties(number),
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
