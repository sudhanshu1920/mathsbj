import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error('Architecture regression:', message);
  process.exit(1);
};

const css = read('src/index.css');
const learning = read('src/pages/LearningPage.tsx');
const icons = read('src/lib/topicIcons.ts');
const practice = read('src/pages/PracticePage.tsx');
const index = read('src/pages/Index.tsx');
const sync = read('src/lib/sync.ts');
const auth = read('src/contexts/AuthContext.tsx');

if (!css.includes('padding-bottom: var(--floating-bar-height, 0px);')) {
  fail('floating-bar reserve is not tied to the runtime measurement variable');
}
for (const forbidden of ['--bottom-nav-height', '--app-bottom-inset', 'data-app-bottom-bar']) {
  if (css.includes(forbidden)) fail(`legacy floating-bar token/block remains: ${forbidden}`);
}
if (learning.includes('TOPIC_ICON_MAP[t.id]')) {
  fail('LearningPage reverted to string-topic access via t.id');
}
if (!learning.includes('TOPIC_ICON_MAP[topicId]')) {
  fail('LearningPage does not use the canonical topicId mapping');
}
for (const id of [
  'tables', 'squares', 'square-roots', 'cubes', 'cube-roots',
  'powers', 'percentage', 'formulas', 'periodic-table',
]) {
  if (!icons.includes(id)) {
    fail(`missing canonical topic icon mapping: ${id}`);
  }
}
if (!icons.includes('Grid3x3') || !icons.includes('Radical') || !icons.includes('Sigma') || !icons.includes('Atom')) {
  fail('core semantic topic icon imports are missing');
}
if (practice.includes('sort(() => Math.random() - 0.5)')) {
  fail('biased random sort shuffle reintroduced');
}
if (!index.includes('const showBottomNav = !settingsOpen;')) {
  fail('floating-bar visibility is not controlled by the shared Settings state');
}
if (!index.includes('createPortal(') || !index.includes('document.body')) {
  fail('floating-bar is not portalled to the viewport root');
}
const bottomNav = read('src/components/BottomNav.tsx');
if (!bottomNav.includes('bottom-nav fixed bottom-0')) {
  fail('floating-bar is not fixed to the viewport');
}
if (!index.includes("scrollElement.style.setProperty('--floating-bar-height', '0px');")) {
  fail('Settings layout does not clear the floating-bar reserve synchronously');
}
if (!index.includes('--floating-bar-height') || !index.includes('ResizeObserver')) {
  fail('runtime floating-bar measurement architecture is missing');
}
if (!sync.includes('switchedUser') || !sync.includes('data.progress ?? {}')) {
  fail('cross-account sync isolation guard is missing');
}
if (!auth.includes('syncStartTimerRef') || !auth.includes('syncUserIdRef')) {
  fail('auth sync lifecycle guard is missing');
}

// Periodic ranges must be contiguous, non-overlapping, and end exactly at 118.
const rangesText = read('src/lib/periodicRanges.ts');
const ranges = [...rangesText.matchAll(
  /\{\s*from:\s*(\d+),\s*to:\s*(\d+),\s*label:\s*'([^']+)'\s*\}/g,
)].map(([, from, to, label]) => ({ from: Number(from), to: Number(to), label }));
if (!ranges.length || ranges[0].from !== 1) fail('periodic ranges do not start at element 1');
for (let i = 0; i < ranges.length; i += 1) {
  const range = ranges[i];
  if (range.from > range.to) fail(`invalid periodic range: ${range.label}`);
  if (i > 0 && range.from !== ranges[i - 1].to + 1) {
    fail(`periodic ranges overlap or contain a gap before ${range.label}`);
  }
}
if (ranges.at(-1)?.to !== 118) fail('periodic ranges do not end at element 118');

console.log('Architecture regression checks passed.');
