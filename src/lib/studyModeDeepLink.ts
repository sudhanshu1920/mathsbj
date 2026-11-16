export const STUDY_MODE_LEARNING_DEEP_LINK = "mathmaster://learn";
export const STUDY_MODE_STUDY_APPS_DEEP_LINK = "mathmaster://study-apps";
export const STUDY_MODE_STUDY_APPS_SESSION_KEY = "mathmaster:open-study-apps-picker";

function isTrustedStudyModeDeepLink(value: string, hostname: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "mathmaster:"
      && url.hostname === hostname
      && (url.pathname === "" || url.pathname === "/")
      && url.username === ""
      && url.password === ""
      && url.port === ""
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

export function isStudyModeLearningDeepLink(value: string): boolean {
  return isTrustedStudyModeDeepLink(value, "learn");
}

export function isStudyModeStudyAppsDeepLink(value: string): boolean {
  return isTrustedStudyModeDeepLink(value, "study-apps");
}
