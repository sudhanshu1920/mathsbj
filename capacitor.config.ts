import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sudhanshu.mathsbj",
  appName: "Math Master",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
