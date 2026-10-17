import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '@/lib/periodicTable';

describe('Periodic Table physical-property snapshot', () => {
  it('attaches one element-keyed, sourced physical-property object to all 118 existing elements', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.map((element) => element.number)).toEqual(
      Array.from({ length: 118 }, (_, index) => index + 1),
    );
    expect(new Set(ELEMENTS.map((element) => element.symbol)).size).toBe(118);

    for (const element of ELEMENTS) {
      const physical = element.physicalProperties;
      expect(physical, `missing physical property model for Z=${element.number}`).toBeDefined();
      if (!physical) throw new Error(`Missing physical property model for Z=${element.number}`);

      expect(physical.sourceName).toBe('PubChem Periodic Table');
      expect(physical.sourceUrl).toBe(`https://pubchem.ncbi.nlm.nih.gov/element/${element.symbol}`);
      for (const [key, value] of Object.entries({
        densityGPerCm3: physical.densityGPerCm3,
        meltingPointK: physical.meltingPointK,
        boilingPointK: physical.boilingPointK,
      })) {
        expect(value === null || (Number.isFinite(value) && value > 0), `invalid ${key} for Z=${element.number}`).toBe(true);
      }
    }
  });

  it('keeps representative gas, liquid, and solid measurements attached to their atomic numbers', () => {
    expect(ELEMENTS[0].physicalProperties).toMatchObject({
      densityGPerCm3: 0.00008988,
      meltingPointK: 13.81,
      boilingPointK: 20.28,
    });
    expect(ELEMENTS[34].state).toBe('Liquid');
    expect(ELEMENTS[34].physicalProperties).toMatchObject({
      densityGPerCm3: 3.11,
      meltingPointK: 265.95,
      boilingPointK: 331.95,
    });
    expect(ELEMENTS[79].state).toBe('Liquid');
    expect(ELEMENTS[79].physicalProperties).toMatchObject({
      densityGPerCm3: 13.5336,
      meltingPointK: 234.32,
      boilingPointK: 629.88,
    });
    expect(ELEMENTS[25].physicalProperties?.densityGPerCm3).toBe(7.874);
    expect(ELEMENTS[25].physicalProperties?.sourceUrl).toContain('/element/Fe');
  });

  it('omits misleading pressure-dependent or sublimation transition values', () => {
    expect(ELEMENTS[1].physicalProperties).toMatchObject({
      meltingPointK: null,
      boilingPointK: 4.22,
    });
    expect(ELEMENTS[5].physicalProperties).toMatchObject({
      densityGPerCm3: 2.267,
      meltingPointK: null,
      boilingPointK: null,
    });
    expect(ELEMENTS[32].physicalProperties).toMatchObject({
      densityGPerCm3: 5.776,
      meltingPointK: null,
      boilingPointK: null,
    });
    expect(ELEMENTS[1].physicalProperties?.caveat).toMatch(/pressure/i);
    expect(ELEMENTS[5].physicalProperties?.caveat).toMatch(/sublimes/i);
  });

  it('does not present unestablished bulk state/data as measured for uncertain elements', () => {
    for (const atomicNumber of [85, 87, ...Array.from({ length: 22 }, (_, i) => i + 97)]) {
      const element = ELEMENTS[atomicNumber - 1];
      expect(element.state, `bulk phase incorrectly classified for Z=${atomicNumber}`).toBe('Unknown');
      expect(element.physicalProperties).toMatchObject({
        densityGPerCm3: null,
        meltingPointK: null,
        boilingPointK: null,
      });
      expect(element.physicalProperties?.caveat).toBeTruthy();
    }
  });
});
