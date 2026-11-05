export const STUDY_MODE_LEARNING_DEEP_LINK = "mathmaster://learn";

export function isStudyModeLearningDeepLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "mathmaster:"
      && url.hostname === "learn"
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
