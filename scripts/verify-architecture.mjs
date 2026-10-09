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
if ((index.match(/<BottomNav\b/g) ?? []).length !== 1) {
  fail('exactly one Floating Bar component instance must be declared in the app shell');
}
if (!index.includes('hidden={!showBottomNav}')) {
  fail('Floating Bar must stay mounted and hide without remounting in Settings');
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
    !index.includes("applyNavigation();") ||
    !index.includes("AnimatePresence") ||
    !index.includes("mode=\"sync\"")) {
  fail('Unified page motion system is missing from the app shell');
}
if (!index.includes("if (transitionDirection)") ||
    !index.includes("Primary navigation taps are discrete UI actions")) {
  fail('Primary navigation taps must bypass concurrent transition scheduling');
}
if (!index.includes("startTransition(applyNavigation)") ||
    !index.includes("applyNavigation();")) {
  fail('Navigation lifecycle must retain both swipe-concurrent and direct-immediate paths');
}
if (!bottomNavUi.includes("memo(BottomNavBase)")) {
  fail('Floating Bar should be memoized against unrelated parent renders');
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
    !index.includes("prefersReducedMotion ? MOTION.duration.instant : MOTION.duration.page")) {
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
if (!bottomNavUi.includes('previousTap?.tabId === tabId') ||
    !bottomNavUi.includes('previousTap.wasActive')) {
  fail('rapid taps on inactive/different tabs must not trigger a section reset');
}
if (!progressPage.includes('useLayoutEffect') ||
    !progressPage.includes('onSettingsVisibilityChange?.(showSettings)')) {
  fail('Settings visibility must synchronize before paint to keep nav visibility/reserve atomic');
}
if (!css.includes('.glass-panel:not(.bottom-nav)') ||
    !css.includes('nav.glass-panel:not(.bottom-nav)')) {
  fail('Floating Bar must not inherit the generic glass-surface compositor transform');
}
if (!sync.includes('switchedUser') || !sync.includes('data.progress ?? {}')) {
  fail('cross-account sync isolation guard is missing');
}
if (!auth.includes('syncStartTimerRef') || !auth.includes('syncUserIdRef')) {
  fail('auth sync lifecycle guard is missing');
}

const updateFeed = read('src/lib/updateFeed.ts');
const updateService = read('src/lib/appUpdateService.ts');
const updateManager = read('src/components/AppUpdateManager.tsx');
const nativeUpdater = read('src/nativeAppUpdater.ts');
const pwaUpdater = read('src/pwa.ts');
const appVersion = read('src/lib/appVersion.ts');
const viteConfig = read('vite.config.ts');
const releaseWorkflow = read('.github/workflows/android-release.yml');
if (!bottomNav.includes('data-app-floating-nav="true"') || !bottomNav.includes('z-40')) {
  fail('Floating Bar must have one stable identity and remain below dialog overlays');
}
if (nativeUpdater.includes('/releases/tags/latest')) {
  fail('native updater must not rely on anonymous access to a private GitHub Releases API');
}
if (!updateFeed.includes('https://sudhanshu1920.github.io/mathsbj/updates/update.json') ||
    !updateFeed.includes('EXPECTED_APK_URL') ||
    !updateFeed.includes('SHA256_PATTERN')) {
  fail('public update feed, APK destination, and checksum validation are required');
}
if (!updateService.includes('checkForAppUpdate') || !updateService.includes('isNewerRelease')) {
  fail('manual and automatic update checks must use validated metadata and numeric version comparison');
}
if (!updateManager.includes('DISMISSED_VERSION_KEY') ||
    !updateManager.includes('Update Now') ||
    !updateManager.includes('Later')) {
  fail('update dialog must expose Update Now/Later and persist dismissal by version');
}
if (!updateManager.includes('lastAutomaticCheckSucceeded') ||
    !updateManager.includes('30_000') ||
    !updateManager.includes('runCheck(false, false, true)') ||
    !updateManager.includes('window.addEventListener("online", onOnline)')) {
  fail('automatic updater must recover promptly after offline/failed checks and connectivity returns');
}
if (!pwaUpdater.includes('PWA_UPDATE_DISCOVERED_EVENT') ||
    !pwaUpdater.includes('applyPwaUpdate') ||
    !viteConfig.includes('registerType: "prompt"')) {
  fail('PWA updates must wait for explicit user confirmation');
}
if (!appVersion.includes('__APP_VERSION_CODE__') || !viteConfig.includes('__APP_VERSION_CODE__')) {
  fail('installed app build version must be embedded from the actual build');
}
if (!releaseWorkflow.includes('actions/configure-pages@v5') ||
    !releaseWorkflow.includes('actions/upload-pages-artifact@v3') ||
    !releaseWorkflow.includes('actions/deploy-pages@v4') ||
    !releaseWorkflow.includes('updates/update.json') ||
    !releaseWorkflow.includes('expectedSha256.equalsIgnoreCase')) {
  fail('signed APK and checksummed update feed must be published through GitHub Pages');
}
const collectApkAt = releaseWorkflow.indexOf('name: Collect release APK');
const uploadApkAt = releaseWorkflow.indexOf('name: Upload release APK');
const publishReleaseAt = releaseWorkflow.indexOf('name: Publish latest GitHub Release APK');
const configurePagesAt = releaseWorkflow.indexOf('name: Configure GitHub Pages for the public update feed');
if (!(collectApkAt >= 0 && uploadApkAt > collectApkAt &&
      publishReleaseAt > uploadApkAt && configurePagesAt > publishReleaseAt)) {
  fail('APK build and release artifacts must not be blocked by Pages-site setup');
}
if (!releaseWorkflow.includes('request.setMimeType("application/octet-stream");') ||
    !releaseWorkflow.includes('DownloadManager.Request.VISIBILITY_VISIBLE') ||
    releaseWorkflow.includes('DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED')) {
  fail('APK downloads must be verified before the installer can be opened from a completion notification');
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


const trigTable = read('src/components/TrigonometryLearning.tsx');
const trigTableCss = read('src/components/trigonometry-table.css');
if (!trigTable.includes('trig-table-sticky') ||
    !trigTable.includes('trig-table-sticky-header') ||
    !trigTable.includes('trig-table-sticky-corner')) {
  fail('Table of Angles is missing the dedicated sticky first-column layers');
}
if (trigTable.includes('sticky left-0 bg-primary/15') ||
    trigTable.includes('sticky left-0 bg-primary/5')) {
  fail('Table of Angles sticky headers must not use translucent primary backgrounds');
}
if (!trigTable.includes('border-separate border-spacing-0') ||
    trigTable.includes('initial={{ opacity: 0, x: -10 }}') ||
    trigTable.includes('animate={{ opacity: 1, x: 0 }}')) {
  fail('Table of Angles must avoid collapsed-border/translated-row sticky paint conflicts');
}
if (!trigTableCss.includes('.trig-table-grid .trig-table-cell') ||
    !trigTableCss.includes('border-width: 0 1px 1px 0 !important') ||
    !trigTableCss.includes('border-top: 1px solid hsl(var(--border))')) {
  fail('Table of Angles must preserve single-line borders with separated sticky-compatible cells');
}
if (!trigTableCss.includes('background-color: hsl(var(--card)) !important') ||
    !trigTableCss.includes('background-color: hsl(var(--muted)) !important') ||
    !trigTableCss.includes('isolation: isolate') ||
    !trigTableCss.includes('z-index: 40')) {
  fail('Table of Angles sticky cells must keep opaque theme surfaces and correct z-index layering');
}

console.log('Architecture regression checks passed.');
