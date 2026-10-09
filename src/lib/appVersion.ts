export const APP_VERSION_CODE =
  Number.isSafeInteger(__APP_VERSION_CODE__) && __APP_VERSION_CODE__ > 0 ? __APP_VERSION_CODE__ : 1;

export const APP_VERSION_NAME =
  typeof __APP_VERSION_NAME__ === "string" && __APP_VERSION_NAME__.length > 0 ? __APP_VERSION_NAME__ : "1.0";
