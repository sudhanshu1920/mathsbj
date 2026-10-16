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
    !index.includes("x: direction === null") ||
    !index.includes("transition: { duration: direction === null ? 0 : duration")) {
  fail('Main-section exits must immediately clear stale swipe transforms when Quiz restores its originating screen');
}
if (!index.includes("opacity: direction === null ? 0 : 1")) {
  fail('Non-swipe exits must hide the outgoing screen immediately to prevent overlap with the restored destination');
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
const practiceNavigation = read('src/lib/practiceNavigation.ts');
if (!practiceNavigationTests.includes("isPracticeSessionInProgress('setup')") ||
    !practiceNavigationTests.includes("isPracticeSessionInProgress('active')") ||
    !practiceNavigationTests.includes("isPracticeSessionInProgress('finished')")) {
  fail('Quiz setup/active/result Floating Bar visibility phase tests are missing');
}
if (!index.includes('setLearningPracticeReturn(launchContext)') ||
    !index.includes('setLearningPracticeSelectorOpen(restoreSelector)') ||
    !index.includes('replaceNextNavigationEntry.current = true') ||
    !index.includes("tab === 'learn' && learningPracticeSelectorOpen") ||
    !learning.includes('practiceSelectorOpen = false') ||
    !learning.includes('practiceReturn?.extras?.timerEnabled') ||
    !practiceSelector.includes('initialSettings?.timerEnabled ?? false') ||
    !practiceNavigation.includes('LEARNING_PRACTICE_SELECTOR_DEPTH') ||
    !practiceNavigationTests.includes('returns a Learning-origin quiz to the Practice selector') ||
    !index.includes('setPracticeBackRequest((value) => value + 1);') ||
    !index.includes('isHandlingPopstate.current = false;') ||
    !learning.includes("if (activeTopic === 'periodic-table' && periodicSelectedElement)")) {
  fail('Learning topic → Practice selector → Quiz → selector → topic restoration contract is incomplete');
}
if (!practice.includes('levelUpTimerRef') ||
    !practice.includes('xpPopTimerRef') ||
    /if \(sessionIntervalRef\.current\) clearInterval\(sessionIntervalRef\.current\);\n\s+if \(sessionIntervalRef\.current\) clearInterval/.test(practice)) {
  fail('Practice exit must clear each unique interval and every deferred UI timeout without duplicate cleanup');
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
const expectedUpdateManifestUrl = 'https://raw.githubusercontent.com/sudhanshu1920/mathsbj-updates/main/updates/update.json';
const expectedUpdateApkUrl = 'https://github.com/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk';
if (!updateFeed.includes(expectedUpdateManifestUrl) ||
    !updateFeed.includes(`export const EXPECTED_APK_URL = \"${expectedUpdateApkUrl}\";`) ||
    !updateFeed.includes('SHA256_PATTERN') ||
    !releaseWorkflow.includes(`\"apkUrl\": \"${expectedUpdateApkUrl}\",`) ||
    !releaseWorkflow.includes('\"github.com\".equalsIgnoreCase(updateUri.getHost())') ||
    !releaseWorkflow.includes('\"/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk\".equals(updateUri.getPath())')) {
  fail('manifest URL, manifest APK URL, native APK allowlist, and checksum validation must use one trusted public release location');
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
if (!updateManager.includes('dismissedVersionCode = useRef(0)') ||
    updateManager.includes('localStorage.getItem("mathmaster.dismissed-update-version-code")') ||
    !updateManager.includes('Update Now') ||
    !updateManager.includes('Later')) {
  fail('update dialog must expose Update Now/Later and keep dismissal scoped to the current app session');
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
    !releaseWorkflow.includes('expectedSha256.equalsIgnoreCase') ||
    !releaseWorkflow.includes('MATHMASTER_UPDATES_TOKEN') ||
    !releaseWorkflow.includes('name: Publish APK and update manifest to public update host') ||
    !releaseWorkflow.includes('https://raw.githubusercontent.com/${UPDATES_REPO}/main/updates/update.json?cacheBust=${GITHUB_SHA}')) {
  fail('signed APK and checksummed manifest must be published and verified on the separate public update host');
}
const notificationSendStepAt = releaseWorkflow.indexOf('name: Send new-release push notification through Firebase');
const notificationSendStepEnd = releaseWorkflow.indexOf('\n# [BUILD_APK]', notificationSendStepAt);
const notificationSendStep = releaseWorkflow.slice(notificationSendStepAt, notificationSendStepEnd);
if (!releaseWorkflow.includes('name: Verify published APK asset SHA-256 before push') ||
    !releaseWorkflow.includes('PUBLISHED_APK_URL}?cacheBust=${GITHUB_SHA}') ||
    !releaseWorkflow.includes('manifest["sha256"].lower() != sys.argv[4].lower()') ||
    !releaseWorkflow.includes('published-update.json")') ||
    !releaseWorkflow.includes('actual_sha256') ||
    !releaseWorkflow.includes('expected_sha256') ||
    !notificationSendStep.includes('node scripts/release-notification-sender.mjs') ||
    notificationSendStep.includes('continue-on-error: true')) {
  fail('release push must verify the actually published APK checksum and expose configured FCM failures to Actions');
}
const collectApkAt = releaseWorkflow.indexOf('name: Collect release APK');
const uploadApkAt = releaseWorkflow.indexOf('name: Upload release APK');
const publishReleaseAt = releaseWorkflow.indexOf('name: Publish latest GitHub Release APK');
const uploadFeedAt = releaseWorkflow.indexOf('name: Upload update feed bundle for hosting');
const publishPublicUpdateAt = releaseWorkflow.indexOf('name: Publish APK and update manifest to public update host');
if (!(collectApkAt >= 0 && uploadApkAt > collectApkAt &&
      publishReleaseAt > uploadApkAt && uploadFeedAt > publishReleaseAt &&
      publishPublicUpdateAt > uploadFeedAt)) {
  fail('APK, checksum manifest, and public update-host publication must run in the required order');
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

// Quiz startup/exit transition invariants.
const learningLaunchStart = index.indexOf('const handleStartPractice = useCallback(');
const learningLaunchEnd = index.indexOf('const clearPracticeState =', learningLaunchStart);
const learningLaunchHandler = index.slice(learningLaunchStart, learningLaunchEnd);
if (learningLaunchStart < 0 || learningLaunchEnd < 0 ||
    learningLaunchHandler.indexOf("setPracticePhase('starting');") < 0 ||
    learningLaunchHandler.indexOf("setPracticePhase('starting');") > learningLaunchHandler.indexOf("setTab('practice');")) {
  fail('Learning-origin Start Quiz must enter the startup phase before mounting PracticePage');
}
if (!practiceNavigation.includes("phase === 'starting' || phase === 'active'") ||
    !practiceNavigation.includes("phase === 'starting' || phase === 'active' || phase === 'finished'") ||
    !practiceNavigation.includes("if (phase === 'starting' || phase === 'active') return 'practice-active';")) {
  fail('Quiz startup must hide the Floating Bar and keep startup/active history depth stable');
}
if (!practice.includes("useLayoutEffect(() => {\n    if (initialTopic && initialMode) {")) {
  fail('Learning-origin Quiz session must initialize before paint to prevent setup screen flash');
}
const exitConfirmStart = practice.indexOf('const handleExitConfirmed = useCallback(() => {');
const exitConfirmEnd = practice.indexOf('const handleExitRequest = useCallback', exitConfirmStart);
const exitConfirmHandler = practice.slice(exitConfirmStart, exitConfirmEnd);
if (exitConfirmStart < 0 || exitConfirmEnd < 0 ||
    !exitConfirmHandler.includes('if (fromLearning && onExit)') ||
    !exitConfirmHandler.includes('clearSessionTimers();\n      onExit();')) {
  fail('Learning-origin Quiz exit must clean timers and navigate directly without rendering Quiz setup first');
}
const backRequestEffectStart = practice.indexOf('const request = externalBackRequest ?? 0;');
const backRequestEffect = practice.slice(backRequestEffectStart, practice.indexOf('}, [externalBackRequest, config, finished]);', backRequestEffectStart));
if (backRequestEffect.indexOf('if (!config || finished) return;') < 0 ||
    backRequestEffect.indexOf('if (!config || finished) return;') > backRequestEffect.indexOf('lastExternalBackRequestRef.current = request;')) {
  fail('Back requests during Quiz startup must remain pending until the active session can show confirmation');
}

// Challenge Timer must share one exclusive mode and one lifecycle-controlled clock.
const practiceConfigStart = practice.indexOf('interface PracticeConfig {');
const practiceConfigEnd = practice.indexOf('type AnswerType', practiceConfigStart);
const practiceConfig = practice.slice(practiceConfigStart, practiceConfigEnd);
if (practiceConfigStart < 0 || practiceConfigEnd < 0 ||
    !practiceConfig.includes('timerMode: QuizTimerMode;') ||
    practiceConfig.includes('timerEnabled: boolean;')) {
  fail('Quiz timer configuration must use one mutually exclusive timerMode source of truth');
}
const quizTimer = read('src/lib/quizTimer.ts');
if (!quizTimer.includes('CHALLENGE_MINUTES = [1, 2, 3, 4, 5, 10]') ||
    !quizTimer.includes('getRemainingSeconds') ||
    !quizTimer.includes('getTimerModeFromToggle')) {
  fail('Challenge durations, deadline calculation, and timer-mode switching must use shared tested helpers');
}
if (!practice.includes("config.timerMode === 'challenge'") ||
    !practice.includes("config.timerMode === 'perQuestion' && config.timerSeconds < 9999") ||
    !practice.includes('getRemainingSeconds(deadline, performance.now())') ||
    !practice.includes('performance.now() >= challengeDeadlineRef.current')) {
  fail('Challenge expiry and per-question timeout must be isolated within the shared session clock');
}
if (!practice.includes('Solved {totalAttempts}') ||
    !practice.includes("config.timerMode === 'challenge' ? 'Solved' : 'Attempted'") ||
    !practice.includes('challengeDeadlineRef.current = null;')) {
  fail('Challenge solved count, result labeling, and timer deadline cleanup are required');
}

// Challenge mode disables fixed question-count controls and overrides their pool lifetime.
if (!quizTimer.includes('isQuestionCountSelectionDisabled') ||
    !quizTimer.includes('shouldUseInfiniteQuestionPool')) {
  fail('Challenge question-count availability and time-based pool lifetime must use shared helpers');
}
if (!practice.includes('const questionCountDisabled = isQuestionCountSelectionDisabled(repetitionEnabled, timerMode);') ||
    (practice.match(/disabled={questionCountDisabled}/g) || []).length < 2 ||
    !practice.includes('if (questionCountDisabled) return;')) {
  fail('All fixed Questions buttons must be natively disabled and protected by click guards during Challenge');
}
if (!practice.includes('shouldUseInfiniteQuestionPool(cfg.timerMode, cfg.repetitionEnabled, cfg.infinite)') ||
    !practice.includes("const isFiniteQuiz = config.timerMode !== 'challenge' &&")) {
  fail('Challenge must use a recyclable question pool and finish by its timer, not fixed question count');
}

// Quiz Tables Pro Mode must reuse Learning's persistent setting and question generator.
const tableQuestionTests = read('src/test/practiceQuestionGeneration.test.ts');
const tableRangeUiTests = read('src/pages/PracticePage.trigRange.test.tsx');
if (!practice.includes('getTablesProMode, setTablesProMode') ||
    !practice.includes('aria-label="Tables Pro Mode"') ||
    !practice.includes("const proMax = getTablesProMode() ? 20 : 10") ||
    !practice.includes("window.addEventListener('tables-pro-updated', syncTablesProMode)")) {
  fail('Quiz Tables Pro Mode must reuse the shared persisted setting and keep its compact range toggle synchronized');
}
if (!tableQuestionTests.includes('uses the shared Tables Standard/Pro mode for the exact selected table range') ||
    !tableRangeUiTests.includes('uses the shared Learning/Quiz Pro Mode setting from the Tables range panel')) {
  fail('Quiz Tables Pro Mode must cover both actual generated question ranges and UI setting synchronization');
}

// Release versioning must be centralized, idempotent, and shared by both APK workflows.
const releaseVersion = read('scripts/release-version.mjs');
const releaseVersionTests = read('scripts/release-version.test.mjs');
const releaseWorkflowVersion = read('.github/workflows/android-release.yml');
const manualApkWorkflow = read('.github/workflows/android-apk.yml');
const viteConfigVersion = read('vite.config.ts');
const settingsPanelVersion = read('src/components/SettingsPanel.tsx');
if (!releaseVersion.includes('parsePublishedRelease') ||
    !releaseVersion.includes('resolveNextReleaseVersion') ||
    !releaseVersion.includes('reusedForSameCommit') ||
    !releaseVersion.includes('merge-base') ||
    !releaseVersionTests.includes('re-running the same commit reuses its published version') ||
    !releaseVersionTests.includes('refuses to overwrite a newer release with an older or divergent source commit')) {
  fail('Automatic release versioning must preserve the real published baseline, handle retries idempotently, and reject stale source commits');
}
for (const [label, workflow] of [
  ['Android Release APK', releaseWorkflowVersion],
  ['Android APK', manualApkWorkflow],
]) {
  if (!workflow.includes('node scripts/release-version.mjs') ||
      !workflow.includes('node --test scripts/release-version.test.mjs') ||
      workflow.includes('VERSION_NAME: "1.0"') ||
      workflow.includes('EXPECTED_VERSION_CODE="$(git rev-list --count HEAD)"')) {
    fail(label + ' must use the shared tested release version resolver rather than hardcoded or commit-count versions');
  }
}
if (!releaseWorkflowVersion.includes('versionName: %s') ||
    !releaseWorkflowVersion.includes('sourceCommit: %s') ||
    !releaseWorkflowVersion.includes('signingCertificateSHA256: %s') ||
    !releaseWorkflowVersion.includes('681A1EEB65E63DB5CCDF01748A27AA0045033E5C3C5D0C29ED16EE0D35769B64') ||
    releaseWorkflowVersion.indexOf('Verify APK identity, version, signature and installability') >
      releaseWorkflowVersion.indexOf('Publish latest GitHub Release APK')) {
  fail('Published APK metadata must record its source/version/certificate and only publish after successful signature verification');
}
if (!viteConfigVersion.includes('process.env.VITE_APP_VERSION_CODE') ||
    !viteConfigVersion.includes('process.env.VITE_APP_VERSION_NAME') ||
    !settingsPanelVersion.includes("import { APP_VERSION_NAME } from '@/lib/appVersion';") ||
    !settingsPanelVersion.includes('App Version {APP_VERSION_NAME}')) {
  fail('Settings must display the same versionName injected into Vite and the Android release');
}

// Automatic update alert lifecycle and safe APK verification.
const updateManagerSource = read('src/components/AppUpdateManager.tsx');
const updateManagerTests = read('src/components/AppUpdateManager.test.tsx');
const updateOrderingSource = read('src/lib/updateVersion.ts');
if (!updateManagerSource.includes('dismissedVersionCode = useRef(0)') ||
    !updateManagerSource.includes('safeCandidate.versionCode <= dismissedVersionCode.current') ||
    updateManagerSource.includes('localStorage.getItem("mathmaster.dismissed-update-version-code")')) {
  fail('"Later" must suppress duplicate alerts only for the current app session, not permanently across launches');
}
if (!updateManagerSource.includes('App.addListener("resume", checkOnForeground)') ||
    !updateManagerSource.includes('document.addEventListener("visibilitychange", checkOnForeground)') ||
    !updateManagerSource.includes('runCheck(false, false, true)') ||
    !updateManagerSource.includes('FOREGROUND_EVENT_DEDUPE_MS')) {
  fail('Update checks must refresh on native resume/web foreground while deduplicating one lifecycle transition');
}
if (!updateManagerSource.includes('Current version:') ||
    !updateManagerSource.includes('New version:') ||
    !updateManagerSource.includes('installAttemptInFlight.current')) {
  fail('Update alert must show installed/latest versions and guard repeated Update Now actions');
}
if (!updateManagerTests.includes('dismisses only for the current app session') ||
    !updateManagerTests.includes('starts the trusted APK update only after Update Now is clicked') ||
    !updateManagerTests.includes('shows the actual installed and latest versions')) {
  fail('Update alert needs tests for actual version display, session dismissal, and explicit install action');
}
if (!updateOrderingSource.includes('latestCodeValid && currentCodeValid) return latest.versionCode! > current.versionCode!') ||
    !updateOrderingSource.includes('Semantic comparison is a compatibility fallback only')) {
  fail('versionCode must be authoritative when available, with semantic version fallback only when build codes are missing');
}
const apkVerifierStart = releaseWorkflowVersion.indexOf('new Thread(() -> {');
const apkHashCheck = releaseWorkflowVersion.indexOf('expectedSha256.equalsIgnoreCase(actualSha256)', apkVerifierStart);
const apkInstallerPost = releaseWorkflowVersion.indexOf('mainHandler.post(() -> {', apkHashCheck);
if (apkVerifierStart < 0 || apkHashCheck < apkVerifierStart || apkInstallerPost < apkHashCheck ||
    !releaseWorkflowVersion.includes('"MathMaster-APK-verifier"') ||
    !releaseWorkflowVersion.includes('if (apkUri == null)')) {
  fail('Downloaded APK checksum must run off the UI thread and the Android installer must only open after verification');
}

const nativeUpdaterSource = read('src/nativeAppUpdater.ts');
const updateFeedSource = read('src/lib/updateFeed.ts');
if (!nativeUpdaterSource.includes('versionCode: update.versionCode') ||
    !releaseWorkflowVersion.includes('Integer expectedVersionCode = call.getInt("versionCode");') ||
    !releaseWorkflowVersion.includes('getPackageArchiveInfo(destinationFile.getAbsolutePath(), 0)') ||
    !releaseWorkflowVersion.includes('downloadedInfo.packageName') ||
    !releaseWorkflowVersion.includes('downloadedVersionCode != expectedVersionCode.longValue()')) {
  fail('Native updater must verify the downloaded APK package identity and expected versionCode before installation');
}
if (!updateFeedSource.includes('Number(data.versionCode) > 2100000000')) {
  fail('Update metadata must reject versionCodes outside Android supported bounds');
}

// Quiz countdown progress must use the active timer deadline and leave the overall quiz bar intact.
const questionTimerPage = read('src/pages/PracticePage.tsx');
const questionTimerHelpers = read('src/lib/quizTimer.ts');
const questionTimerTests = read('src/lib/quizTimer.test.ts');
const questionTimerUiTests = read('src/pages/PracticePage.quizSetup.test.tsx');
const questionTimerStyles = read('src/index.css');
if (!questionTimerPage.includes('questionDeadlineRef') ||
    !questionTimerPage.includes('getTimerProgressPercent(') ||
    !questionTimerPage.includes('aria-label="Question timer"') ||
    !questionTimerPage.includes('transformOrigin: \'right center\'') ||
    !questionTimerPage.includes('animationDuration: `${countdownDurationSeconds}s`') ||
    !questionTimerPage.includes('questionDeadlineRef.current = config.timerSeconds < 9999') ||
    !questionTimerPage.includes('const isCountdownProgressVisible = isQuestionTimerActive || config.timerMode === \'challenge\'') ||
    !questionTimerPage.includes('data-testid="quiz-overall-progress"')) {
  fail('Quiz countdown must follow the existing per-question/challenge deadline, shrink from the right, reset with each question, and preserve overall progress');
}
if (!questionTimerHelpers.includes('export function getTimerProgressPercent(') ||
    !questionTimerTests.includes('converts the active timer deadline into a clamped percentage') ||
    !questionTimerTests.includes('safely handles missing deadlines and invalid duration values') ||
    !questionTimerTests.includes('expect(getTimerProgressPercent(deadline, 10_000, 8_000)).toBe(20)')) {
  fail('Countdown percentage calculation needs deadline-based 100/80/50/20/0 and invalid-input regression tests');
}
if (!questionTimerUiTests.includes('uses the active countdown deadline, retains overall quiz progress, and resets on the next question') ||
    !questionTimerUiTests.includes('does not render a countdown bar when the timer mode is off') ||
    !questionTimerUiTests.includes('animationDuration: \'10s\'')) {
  fail('Quiz timer UI needs timer-sync, question-reset, original progress bar, and timer-off coverage');
}
if (!questionTimerStyles.includes('@media (prefers-reduced-motion: no-preference)') ||
    !questionTimerStyles.includes('transform-origin: right center') ||
    !questionTimerStyles.includes('question-timer-progress-shrink')) {
  fail('Countdown animation must shrink from the right and respect reduced-motion settings');
}

// Theme boot/switch must apply one validated appearance before first paint.
const themeModule = read('src/lib/theme.ts');
const themeHtml = read('index.html');
const themeBootstrapCss = read('src/index.css');
const themeTests = read('src/lib/theme.test.ts');
const themeHydrationTests = read('src/lib/themeHydration.test.ts');
const themeTypeBlock = themeModule.match(/export type ThemeId =([\s\S]*?);/)?.[1] ?? '';
const bootstrapThemeBlock = themeHtml.match(/const themeIds = \[([\s\S]*?)\];/)?.[1] ?? '';
const declaredThemeIds = [...themeTypeBlock.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
const bootstrapThemeIds = [...bootstrapThemeBlock.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (declaredThemeIds.length === 0 ||
    declaredThemeIds.some((id) => !bootstrapThemeIds.includes(id)) ||
    bootstrapThemeIds.some((id) => !declaredThemeIds.includes(id))) {
  fail('First-paint theme bootstrap IDs must exactly match the runtime theme union');
}
const parseLegacyThemeMap = (source, pattern) => {
  const block = source.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)': '([^']+)'/g)]
    .map((match) => match[1] + ':' + match[2])
    .sort()
    .join('|');
};
if (parseLegacyThemeMap(themeModule, /const LEGACY_THEME_MAP: Record<string, ThemeId> = \{([\s\S]*?)\n\};/) !==
    parseLegacyThemeMap(themeHtml, /const legacyThemes = \{([\s\S]*?)\n        \};/)) {
  fail('Legacy saved-theme aliases must resolve identically before first paint and at runtime');
}
if (!themeHtml.includes('class="theme-arctic-blue dark"') ||
    themeHtml.indexOf('const themeIds = [') > themeHtml.indexOf('<script type="module" src="/src/main.tsx"></script>') ||
    !themeHtml.includes('root.dataset.mode = mode') ||
    !themeModule.includes('getMode = (): ModeId => currentMode') ||
    !themeModule.includes('persistModeSoon();') ||
    !themeModule.includes('applyAppearanceSnapshot(currentTheme, currentMode, true)') ||
    !themeBootstrapCss.includes('html.theme-appearance-updating *::before') ||
    !themeBootstrapCss.includes('transition-duration: 0ms !important;')) {
  fail('Theme switching must be memory-backed, atomic, pre-bootstrapped, and suppress color transitions only during the switch');
}
for (const testName of [
  'applies mode and selected theme atomically before persistence completes',
  'keeps only the latest choice after rapid repeated switches',
  'continues switching when localStorage writes throw',
  'falls back to safe defaults for unsupported runtime values',
  'keeps theme subscribers isolated from mode-only updates',
]) {
  if (!themeTests.includes(testName)) fail('Missing theme-switch regression case: ' + testName);
}


if (!themeHydrationTests.includes('hydrates saved premium theme and appearance before app initialization')) {
  fail('Saved appearance and selected premium theme need first-load hydration coverage');
}


const percentagePresets = read('src/lib/percentagePresets.ts');
if (!practice.includes('pctPresetIds?: string[]') ||
    !practice.includes('togglePercentagePresetRange') ||
    !practice.includes('setTopicRanges((previous) => {')) {
  fail('Percentage preset selection must use a collection and functional state updates');
}
if (!practice.includes('aria-pressed={isSelected}') ||
    !practice.includes('PERCENTAGE_PRESETS.map((preset) =>') ||
    !practice.includes('Select at least one preset range to start.')) {
  fail('Percentage preset UI must expose independent pressed states and empty-selection guidance');
}
if (!practice.includes('resolvePercentagePresets(range).length > 0') ||
    !practice.includes("range.pctRangeMode === 'preset'") ||
    !practice.includes('percentagePresetId?: PercentagePresetId')) {
  fail('Percentage preset validation and question-source identities are missing');
}
if (!practice.includes('selectQuestionsAcrossPresetRanges(baseQuestions, config.count, config.sequential)') ||
    !practice.includes('selectQuestionsWithPresetCoverage(baseQuestions, config.count, selectedPresetIds, config.sequential)')) {
  fail('Finite quizzes must retain question coverage for every selected Percentage preset');
}
if (!percentagePresets.includes('normalizePercentagePresetIds') ||
    !percentagePresets.includes('togglePercentagePresetIds') ||
    !percentagePresets.includes('resolvePercentagePresets')) {
  fail('Shared Percentage preset normalization/toggle/resolve helpers are missing');
}

const quizRetryQueue = read('src/lib/quizRetryQueue.ts');
const quizRetryTests = read('src/test/quizRetryQueue.test.ts');
if (!practice.includes('questionsRef.current = nextQueue') ||
    !practice.includes('ensureOutstandingQuestionRetries') ||
    !practice.includes('shouldFinishQuestionQueue') ||
    !practice.includes('getQuizCompletionPercent(completedQuestionIds.size, originalQuestionCount)') ||
    !practice.includes('data-testid="quiz-repetition-results"')) {
  fail('Quiz Repetition must retry wrong identities, keep completion progress stable, and wait for completion');
}
if (!quizRetryQueue.includes('at most one pending retry per identity') ||
    !quizRetryQueue.includes('ensureOutstandingQuestionRetries') ||
    !quizRetryQueue.includes('getQuizCompletionPercent') ||
    !quizRetryQueue.includes('completedCount >= originalQuestionCount') ||
    !quizRetryTests.includes('does not create duplicate pending retry entries') ||
    !quizRetryTests.includes('requeues a retry after another wrong attempt')) {
  fail('Quiz retry lifecycle tests or core queue safeguards are missing');
}

const percentageCustomUiTests = read('src/pages/PracticePage.percentageCustom.test.tsx');
const percentageCustomTests = read('src/test/percentagePresetSelection.test.ts');
if (!practice.includes('pctNumFrom: current.pctNumFrom ?? 1') ||
    !practice.includes('pctDenFrom: current.pctDenFrom ?? 2') ||
    !practice.includes("e.target.value === '' ? undefined : Number(e.target.value)") ||
    !practice.includes('No questions could be generated for') ||
    !practice.includes('quizStartLockRef.current')) {
  fail('Percentage Custom defaults must be canonicalized, empty inputs validated, empty-pool failures surfaced, and duplicate starts guarded');
}
if (!percentageCustomUiTests.includes('persists the displayed defaults, accepts a valid edit, and launches the quiz') ||
    !percentageCustomUiTests.includes('treats a genuinely empty input as invalid') ||
    !percentageCustomTests.includes('validates custom Percentage bounds, empties, and ascending semantics') ||
    !percentageCustomTests.includes('generates all fractions for the selected custom range and ignores stale preset IDs')) {
  fail('Percentage Custom range UI/generator regression coverage is missing');
}

const digitMultiSelectUiTests = read('src/pages/PracticePage.digitMultiSelect.test.tsx');
const digitMultiSelectGeneratorTests = read('src/test/practiceQuestionGeneration.test.ts');
if (!practice.includes('operand1DigitCounts?: number[]') ||
    !practice.includes('getSelectedDigitCounts(range, 1)') ||
    !practice.includes('selectQuestionsWithDigitCoverage(baseQuestions, config.count, config.sequential)') ||
    !practice.includes('grid grid-cols-5 gap-1 sm:gap-1.5') ||
    !practice.includes('{digits}D') ||
    !digitMultiSelectUiTests.includes('selects multiple digits independently') ||
    !digitMultiSelectUiTests.includes('requires at least one selected digit') ||
    !digitMultiSelectGeneratorTests.includes('validates and generates every selected digit-count combination')) {
  fail('Quiz +/- must keep compact multi-select controls, independent digit ranges, fair question coverage, and regression tests');
}

console.log('Architecture regression checks passed.');
