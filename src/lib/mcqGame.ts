export type MCQGameValue = string | number;

export interface MCQGameOption {
  value: MCQGameValue;
  /** Index into the original display options; null means this is a safe fallback. */
  sourceIndex: number | null;
}

/**
 * Produces four distinct displayed values and keeps each value bound to the
 * exact option the quiz engine must receive on collision.
 */
export function buildMCQGameOptions(
  options: readonly MCQGameValue[] | undefined,
  correctAnswer: MCQGameValue,
  optionPool: readonly MCQGameValue[] = [],
): MCQGameOption[] {
  const source = Array.isArray(options) ? options : [];
  const correctKey = String(correctAnswer).trim();
  const normalized: MCQGameOption[] = [];
  const seen = new Set<string>();

  const append = (value: MCQGameValue, sourceIndex: number | null) => {
    const key = String(value).trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push({ value, sourceIndex });
  };

  source.forEach((value, index) => append(value, index));

  const correctMatches = source.filter((value) => String(value).trim() === correctKey).length;
  if (correctMatches !== 1 || !seen.has(correctKey)) {
    append(correctAnswer, null);
  }

  optionPool.forEach((value) => append(value, null));

  // The common, already-valid Quiz Engine path remains in its original order.
  const sourceKeys = source.map((value) => String(value).trim());
  const sourceIsValid =
    source.length === 4 &&
    sourceKeys.every(Boolean) &&
    new Set(sourceKeys).size === 4 &&
    sourceKeys.filter((key) => key === correctKey).length === 1;

  if (sourceIsValid) {
    return source.map((value, sourceIndex) => ({ value, sourceIndex }));
  }

  const correctOption = normalized.find((option) => String(option.value).trim() === correctKey);
  const distractors = normalized.filter((option) => String(option.value).trim() !== correctKey);
  const selected: MCQGameOption[] = [];

  if (correctOption) selected.push(correctOption);
  selected.push(...distractors.slice(0, 3));

  if (typeof correctAnswer === "number") {
    const offsets = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 0.5, -0.5, 11, -11, 20, -20];
    for (const offset of offsets) {
      if (selected.length >= 4) break;
      const candidate = correctAnswer + offset;
      const key = String(candidate);
      if (key === correctKey || selected.some((option) => String(option.value).trim() === key)) continue;
      selected.push({ value: candidate, sourceIndex: null });
    }
  } else {
    const label = String(correctAnswer).trim();
    let suffix = 1;
    while (selected.length < 4 && suffix <= 20) {
      const candidate = suffix === 1 ? "Not " + label : label + " (option " + suffix + ")";
      if (!selected.some((option) => String(option.value).trim() === candidate)) {
        selected.push({ value: candidate, sourceIndex: null });
      }
      suffix += 1;
    }
  }

  // Fallback text options are only used for malformed/underspecified source
  // data. Keep every lane distinct even for unusual empty or duplicate pools.
  let suffix = 1;
  while (selected.length < 4 && suffix <= 20) {
    const candidate = "Alternative " + suffix;
    if (!selected.some((option) => String(option.value).trim() === candidate)) {
      selected.push({ value: candidate, sourceIndex: null });
    }
    suffix += 1;
  }

  // For repaired data, shuffle the lanes so a repaired question does not
  // systematically put its correct answer in the same lane.
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [selected[index], selected[swapIndex]] = [selected[swapIndex], selected[index]];
  }

  return selected.slice(0, 4);
}
