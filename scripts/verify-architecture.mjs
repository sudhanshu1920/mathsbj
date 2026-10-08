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
const practiceSelector = read('src/components/PracticeModeSelector.tsx');
const offlineReady = read('src/lib/offlineReady.ts');
const streak = read('src/lib/streak.ts');


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
if (index.includes("data-current-theme={currentTheme}") || index.includes("data-current-mode={currentMode}")) {
  fail('app shell still subscribes to theme/mode only for redundant data attributes');
}
if (index.includes("className={tab === 'learn' ? 'animate-fade-in' : 'hidden'}")) {
  fail('inactive Learning screen remains mounted and hidden instead of being unmounted');
}
if (!index.includes("{tab === 'learn' && (") || !index.includes("<LearningPage")) {
  fail('Learning screen is not conditionally mounted');
}
if (!practice.includes("sessionIntervalRef")) {
  fail('Practice session clock consolidation is missing');
}
if (practice.includes("const timerRef = useRef") || practice.includes("const elapsedRef = useRef")) {
  fail('duplicate Practice timer refs were reintroduced');
}
if ((practice.match(/setInterval\(/g) || []).length > 1) {
  fail('Practice should use one consolidated session interval');
}
if (!offlineReady.includes("Capacitor.isNativePlatform()") || !offlineReady.includes("markOfflineReady();")) {
  fail('native offline preparation still performs unnecessary chunk warming');
}
if (!streak.includes("let cache: StreakState | null = null") || !streak.includes("save(s, notify)") || !streak.includes("streak-persisted")) {
  fail('streak hot-path cache/notification throttling is missing');
}
if (!practice.includes('practice-exit-dialog')) {
  fail('Practice exit dialog is missing its viewport positioning class');
}
const glass = read('src/glass.css');
if (!glass.includes('.glass:not(.fixed):not(.absolute):not(.sticky)') ||
    !glass.includes('.glass-panel:not(.fixed):not(.absolute):not(.sticky)')) {
  fail('glass utilities can override fixed/absolute/sticky positioning');
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
if (!index.includes('window.visualViewport?.height ?? window.innerHeight') || !index.includes('viewportHeight - rect.top')) {
  fail('floating-bar reserve does not account for the actual viewport footprint');
}
const bottomNavUi = read('src/components/BottomNav.tsx');
if (!bottomNavUi.includes("aria-current={isActive ? 'page' : undefined}")) {
  fail('floating-bar active navigation semantics are missing');
}
if (!index.includes("getHorizontalSwipeDirection") ||
    !index.includes("direction === 'left'") ||
    !index.includes("direction === 'right'")) {
  fail('Top-level horizontal swipe navigation must support both directions');
}
if (!index.includes("const MAIN_SECTION_ORDER: readonly Tab[] = ['learn', 'practice', 'progress'];") ||
    !index.includes("getAdjacentMainSection(tab, direction)")) {
  fail('Three-section swipe navigation must use one shared Learning/Quiz/Progress section order');
}
if (!index.includes("!settingsOpen") ||
    !index.includes("tab === 'progress');")) {
  fail('Progress/settings swipe root guards are missing');
}
if (!index.includes("direction === 'left' ? 1 : -1")) {
  fail('Left swipe must map to the next section and right swipe to the previous section');
}
if (!index.includes("if (nextTab) handleTabChange(nextTab, direction);")) {
  fail('Boundary swipes must resolve to a safe no-op without navigation');
}
if (!index.includes("tab === 'learn' && learningState.activeTopic === null")) {
  fail('Learning swipe is not restricted to the top-level Learning screen');
}
if (!index.includes("tab === 'practice' && practicePhase === 'setup'")) {
  fail('Quiz swipe is not restricted to quiz setup');
}
if (!index.includes("appSectionSwipeEnabled =")) {
  fail('Page-level swipe enablement guard is missing');
}
if (!index.includes("MOTION.duration.page") ||
    !index.includes("MOTION.ease.standard") ||
    !index.includes("startTransition(applyNavigation)") ||
    !index.includes("AnimatePresence") ||
    !index.includes("mode=\"sync\"")) {
  fail('Unified page motion system is missing from the app shell');
}
if (!index.includes("prefersReducedMotion ? MOTION.duration.instant : MOTION.duration.page")) {
  fail('Page transitions are not reduced-motion aware');
}
const motion = read('src/lib/motion.ts');
for (const token of [
  "duration", "stagger", "distance", "scale", "ease", "springGentle",
]) {
  if (!motion.includes(token)) fail(`shared motion token missing: ${token}`);
}
const button = read('src/components/ui/button.tsx');
if (!button.includes('motion-press')) {
  fail('Base Button does not use shared press feedback');
}
const settingsPanel = read('src/components/SettingsPanel.tsx');
const progressPage = read('src/pages/ProgressPage.tsx');
if (
  practice.includes("whileTap={{ scale: 0.92 }}") ||
  settingsPanel.includes("whileTap={{ scale: 0.92 }}") ||
  progressPage.includes("whileTap={{ scale: 0.92 }}")
) {
  fail('Aggressive 0.92 tap scale should not be reintroduced');
}
if (!index.includes("AnimatePresence") ||
    !index.includes('mode="sync"') ||
    !index.includes('variants={sectionPageVariants}') ||
    !index.includes("x: direction === 'left'") ||
    !index.includes("willChange: sectionTransitionDirection ? 'transform' : 'auto'")) {
  fail('Directional page transition architecture is missing');
}
if (!index.includes("useReducedMotion") ||
    !index.includes("prefersReducedMotion ? 0.01 : 0.28")) {
  fail('Reduced-motion-aware section transition timing is missing');
}
if (!index.includes("startTransition(applyNavigation)")) {
  fail('Navigation must keep the current screen visible while lazy destination chunks resolve');
}
if (!index.includes("!sectionTransitionDirection")) {
  fail('Page-level swiping must be locked while a section transition is active');
}
if (!index.includes("e.pointerType === 'mouse'") || !index.includes('!e.isPrimary')) {
  fail('app-level swipe is not protected from mouse or multi-touch gestures');
}
if (!practiceSelector.includes('data-swipe-ignore-app-section="true"')) {
  fail('Practice mode selector can accidentally trigger app-level navigation');
}
if (!bottomNavUi.includes('motion-press') ||
    !bottomNavUi.includes('const DOUBLE_TAP_DELAY = 280;') ||
    !bottomNavUi.includes('onChange(tabId);')) {
  fail('floating-bar fast tap interaction architecture regressed');
}
if (bottomNavUi.includes('tapTimers') ||
    bottomNavUi.includes('setTimeout(() => {\n        onChange(tabId);')) {
  fail('floating-bar navigation must not defer first-tap navigation');
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
