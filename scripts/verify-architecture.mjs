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
const floatingBarVisibility = read('src/lib/floatingBarVisibility.ts');
const floatingBarVisibilityTests = read('src/lib/floatingBarVisibility.test.ts');
const sync = read('src/lib/sync.ts');
const auth = read('src/contexts/AuthContext.tsx');
const practiceSelector = read('src/components/PracticeModeSelector.tsx');
const bottomNavTest = read('src/components/BottomNav.test.tsx');
const bottomNavUi = read('src/components/BottomNav.tsx');
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
const practiceExitStart = index.indexOf('const handlePracticeExit = useCallback(() => {');
const practiceExitEnd = index.indexOf('const handlePracticeExitCancelled = useCallback', practiceExitStart);
const practiceExitHandler = index.slice(practiceExitStart, practiceExitEnd);
if (practiceExitStart < 0 || practiceExitEnd < 0 ||
    !practiceExitHandler.includes('setSectionTransitionDirection(null);')) {
  fail('Quiz exit must clear stale main-section transition state before restoring its destination');
}

if (!index.includes('getFloatingBarVisibility({') ||
    !index.includes('activeTopic: learningState.activeTopic') ||
    !index.includes('quizInProgress: isPracticeSessionInProgress(practicePhase)') ||
    !index.includes('const { show: showBottomNav, mount: mountBottomNav } = getFloatingBarVisibility({')) {
  fail('Floating Bar visibility must use the centralized policy with Learning topic and Quiz state');
}
if (!floatingBarVisibility.includes("tab === 'learn' && activeTopic !== null") ||
    !floatingBarVisibility.includes("tab === 'practice' && quizInProgress") ||
    !floatingBarVisibility.includes('show: mount && !settingsOpen') ||
    !floatingBarVisibilityTests.includes('restores the bar when Back returns to the Learning landing state') ||
    !floatingBarVisibilityTests.includes('unmounts the bar for the %s topic and its nested screens') ||
    !floatingBarVisibilityTests.includes('keeps Settings hidden without changing its existing mount behavior')) {
  fail('Floating Bar topic-depth, auto-restore, Settings, and Quiz regression tests are missing');
}
if (index.includes("custom={sectionTransitionDirection ?? 'left'}") ||
    !index.includes("direction === null ? '0%'") ||
    !index.includes("transition: { duration: direction === null ? 0 : duration")) {
  fail('Main-section exits must immediately clear stale swipe transforms when Quiz restores its originating screen');
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
if (!practice.includes('onQuizReset?: () => void;') ||
    !practice.includes('onQuizReset?.();') ||
    !index.includes('onQuizReset={handlePracticeReset}')) {
  fail('Exiting/resetting a quiz must restore the parent Practice phase and Floating Bar');
}
const practiceNavigationTests = read('src/test/practiceNavigation.test.ts');
if (!practiceNavigationTests.includes("isPracticeSessionInProgress('setup')") ||
    !practiceNavigationTests.includes("isPracticeSessionInProgress('active')") ||
    !practiceNavigationTests.includes("isPracticeSessionInProgress('finished')")) {
  fail('Quiz setup/active/result Floating Bar visibility phase tests are missing');
}
const glass = read('src/glass.css');
const device = read('src/lib/device.ts');
if (!glass.includes('.glass:not(.fixed):not(.absolute):not(.sticky)') ||
    !glass.includes('.glass-panel:not(.fixed):not(.absolute):not(.sticky)')) {
  fail('glass utilities can override fixed/absolute/sticky positioning');
}
if (!index.includes('createPortal(') || !index.includes('document.body')) {
  fail('floating-bar is not portalled to the viewport root');
}
if (index.includes("if (newTab === tab || sectionTransitionDirection) return;") ||
    !index.includes("if (!transitionDirection && sectionTransitionDirection) {")) {
  fail('primary Floating Bar taps must be able to supersede in-flight swipe animations');
}
if (!index.includes('if (element.scrollWidth > element.clientWidth + 1) {') ||
    !index.includes("const overflowX = window.getComputedStyle(element).overflowX;")) {
  fail('swipe exclusion must avoid unnecessary computed-style reads on non-overflowing ancestors');
}
if (!bottomNavUi.includes('window.requestAnimationFrame(() => playClick())') ||
    !bottomNavTest.includes('requests navigation synchronously before click sound work')) {
  fail('non-critical click sound work must not block Floating Bar navigation');
}
if (glass.includes('padding-bottom: env(safe-area-inset-bottom, 0px);') ||
    !css.includes('bottom: calc(10px + env(safe-area-inset-bottom, 0px))')) {
  fail('Floating Bar safe-area clearance must be accounted for exactly once through its fixed offset');
}
if (!glass.includes('--bottom-nav-blur: 8px;') ||
    !glass.includes('--bottom-nav-blur: 12px;') ||
    !glass.includes('hsl(var(--card) / 0.94)') ||
    !glass.includes('@supports not (backdrop-filter: blur(1px))')) {
  fail('Floating Bar needs tuned real blur and a readable no-blur fallback');
}
const navLayoutRule = css.match(/\.bottom-nav \{\n([\s\S]*?)\n\}/)?.[1] ?? '';
if (/background:|backdrop-filter|box-shadow/.test(navLayoutRule)) {
  fail('Floating Bar layout and glass-surface styling must have a single CSS owner each');
}
if (css.includes('/* Low-power / reduced-motion devices: drop the expensive blur entirely. */') ||
    device.includes('matchMedia("(prefers-reduced-motion: reduce)")')) {
  fail('reduced-motion preference must not be misclassified as low-power or remove static glass');
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
if (!index.includes("visualViewport.offsetTop + visualViewport.height") || !index.includes("viewportBottom - rect.top")) {
  fail('floating-bar reserve does not use a consistent visual-viewport coordinate system');
}
if (!css.includes("env(safe-area-inset-bottom") ||
    !glass.includes("left: 50% !important;") ||
    !glass.includes("transform: translateX(-50%)")) {
  fail('Floating Bar safe-area offset or narrow-screen centering regression detected');
}

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
if (!bottomNavTest.includes('renders exactly one navigation surface') ||
    !bottomNavTest.includes('newly selected section as a reset gesture') ||
    !bottomNavTest.includes('consecutive double taps') ||
    !bottomNavTest.includes('another section is tapped between')) {
  fail('Floating Bar uniqueness and rapid-tap regression tests are missing');
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
if (!updateService.includes('result === "unsupported" && !Capacitor.isNativePlatform()') ||
    !updateService.includes('window.location.reload()')) {
  fail('web Update Now must have a supported reload fallback when no service worker is available');
}
if (!settingsPanel.includes('mountedRef.current = false') ||
    !settingsPanel.includes('if (!mountedRef.current) return;')) {
  fail('Settings updater must guard async UI state/timers after unmount');
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
if (!releaseWorkflow.includes('actions/upload-artifact@v4') ||
    !releaseWorkflow.includes('MathMaster-update-feed') ||
    !releaseWorkflow.includes('updates/update.json') ||
    !releaseWorkflow.includes('expectedSha256.equalsIgnoreCase')) {
  fail('signed APK and checksummed update feed must be produced and uploaded without requiring private-repository Pages');
}
const collectApkAt = releaseWorkflow.indexOf('name: Collect release APK');
const uploadApkAt = releaseWorkflow.indexOf('name: Upload release APK');
const publishReleaseAt = releaseWorkflow.indexOf('name: Publish latest GitHub Release APK');
const uploadFeedAt = releaseWorkflow.indexOf('name: Upload update feed bundle for hosting');
if (!(collectApkAt >= 0 && uploadApkAt > collectApkAt &&
      publishReleaseAt > uploadApkAt && uploadFeedAt > publishReleaseAt)) {
  fail('APK and update-feed artifacts must be uploaded after the GitHub Release');
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
const trigData = read('src/lib/trigData.ts');
const trigPracticeMenu = read('src/components/FormulasLearning.tsx');
const trigPracticeTests = read('src/pages/PracticePage.trigRange.test.tsx');
const quizPage = read('src/pages/PracticePage.tsx');

if (!trigData.includes('export function getTrigAngles(proMode = false)') ||
    !trigData.includes('const STANDARD_TRIG_ANGLES: readonly TrigAngle[] = TRIG_ANGLES.filter((angle) => angle <= 90);')) {
  fail('Table and Quiz must share a canonical, dataset-derived Standard/Pro angle selector');
}
if (!trigTable.includes('getTrigAngles(showFullRange)')) {
  fail('Table of Angles must use the shared Standard/Pro angle selector');
}
if (!quizPage.includes('getTrigQuestions(range.trigFunctions ?? TRIG_FUNCTIONS, getTrigAngles(range.trigProMode === true))') ||
    !quizPage.includes('Trigonometry Quiz – Angle Range') ||
    !quizPage.includes('aria-label="Trigonometry quiz angle range"') ||
    !quizPage.includes("trigProMode: false")) {
  fail('Quiz setup range selection must drive the real generated question pool and default to Standard Mode');
}
if (!quizPage.includes('trigProMode: initialExtras?.trigProMode ?? false') ||
    !learning.includes('trigProMode: pendingTrigProMode') ||
    !learning.includes('count: pendingTrigFunctions.length * getTrigAngles(pendingTrigProMode).length') ||
    !trigPracticeMenu.includes('onPracticeTrigFunctions(selectedFunctions, trigProMode)') ||
    !trigPracticeMenu.includes('aria-label="Practice angle range"') ||
    !trigPracticeTests.includes('enforces Standard 0°–90° and Pro 0°–360° inside generated question pools')) {
  fail('Learning → Practice must carry the selected angle range from the popup into the real generator');
}
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
