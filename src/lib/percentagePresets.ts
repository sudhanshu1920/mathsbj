/*
 * Canonical Percentage Preset ranges shared by Quiz UI, validation, and
 * question generation. IDs are stable within quiz configuration state.
 */
export const PERCENTAGE_PRESETS = [
  { id: 'denominators-1-10', label: '1/1 – 1/10', from: 1, to: 10 },
  { id: 'denominators-11-20', label: '1/11 – 1/20', from: 11, to: 20 },
  { id: 'denominators-21-30', label: '1/21 – 1/30', from: 21, to: 30 },
  { id: 'denominators-31-40', label: '1/31 – 1/40', from: 31, to: 40 },
  { id: 'denominators-41-50', label: '1/41 – 1/50', from: 41, to: 50 },
] as const;

export type PercentagePresetId = (typeof PERCENTAGE_PRESETS)[number]['id'];

export interface PercentagePresetRangeSelection {
  from: number;
  to: number;
  pctRangeMode?: 'preset' | 'custom';
  pctPresetIds?: unknown;
}

export function normalizePercentagePresetIds(value: unknown): PercentagePresetId[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(value.filter((item): item is string => typeof item === 'string'));
  return PERCENTAGE_PRESETS.filter((preset) => requested.has(preset.id)).map((preset) => preset.id);
}

export function getSelectedPercentagePresets(value: unknown) {
  const ids = new Set(normalizePercentagePresetIds(value));
  return PERCENTAGE_PRESETS.filter((preset) => ids.has(preset.id));
}

/**
 * Resolve multi-select state. Older configs can restore one exact legacy
 * range if the ID collection is absent; an explicit empty array is authoritative.
 */
export function resolvePercentagePresets(range: PercentagePresetRangeSelection) {
  if (range.pctRangeMode !== 'preset') return [];
  if (Array.isArray(range.pctPresetIds)) return getSelectedPercentagePresets(range.pctPresetIds);
  const legacyPreset = PERCENTAGE_PRESETS.find(
    (preset) => preset.from === range.from && preset.to === range.to,
  );
  return legacyPreset ? [legacyPreset] : [];
}

export function togglePercentagePresetIds(current: unknown, presetId: string): PercentagePresetId[] {
  if (!PERCENTAGE_PRESETS.some((preset) => preset.id === presetId)) {
    return normalizePercentagePresetIds(current);
  }
  const selected = new Set(normalizePercentagePresetIds(current));
  if (selected.has(presetId as PercentagePresetId)) selected.delete(presetId as PercentagePresetId);
  else selected.add(presetId as PercentagePresetId);
  return PERCENTAGE_PRESETS.filter((preset) => selected.has(preset.id)).map((preset) => preset.id);
}
