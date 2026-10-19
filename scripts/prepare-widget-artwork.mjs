import { access, mkdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SVG_SOURCE = path.join(ROOT, "public", "math_master_widget_atlas.svg");
const NATIVE_PNG = path.join(ROOT, "android-native", "res", "drawable-nodpi", "math_master_widget_atlas.png");

export async function prepareWidgetArtwork() {
  await access(SVG_SOURCE);
  await mkdir(path.dirname(NATIVE_PNG), { recursive: true });

  // Render the resolution-independent 3x2 vector atlas at 3840x1280 for Android.
  // The runtime BitmapRegionDecoder samples individual panels, so the full PNG is never
  // decoded into a full-sized ARGB bitmap during widget refreshes.
  const result = spawnSync("rsvg-convert", [
    "-w", "3840",
    "-h", "1280",
    "-o", NATIVE_PNG,
    SVG_SOURCE,
  ], { encoding: "utf8" });

  if (result.error) {
    throw new Error("Android widget artwork requires rsvg-convert (install librsvg2-bin).");
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error("Unable to rasterize the vector widget atlas." + (detail ? " " + detail : ""));
  }

  const [bytes, info] = await Promise.all([readFile(NATIVE_PNG), stat(NATIVE_PNG)]);
  const validPng = bytes.length > 100_000
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!validPng || info.size !== bytes.length) {
    throw new Error("Generated widget artwork PNG is missing, truncated, or invalid.");
  }
  return { bytes: info.size, width: 3840, height: 1280, destination: NATIVE_PNG };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareWidgetArtwork()
    .then(({ bytes, width, height }) => {
      console.log(`Prepared vector widget artwork at ${width}x${height} (${bytes} bytes).`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown artwork preparation error";
      console.error(`Widget artwork preparation failed: ${message}`);
      process.exitCode = 1;
    });
}
