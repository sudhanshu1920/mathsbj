import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const PART_COUNT = 17;
const PART_DIR = path.join(ROOT, "assets", "widget-art", "atlas-parts");

export async function prepareWidgetArtwork() {
  const chunks = [];
  for (let index = 1; index <= PART_COUNT; index += 1) {
    const partName = `atlas-part-${String(index).padStart(2, "0")}.b64`;
    const chunk = (await readFile(path.join(PART_DIR, partName), "utf8")).trim();
    if (!chunk || !/^[A-Za-z0-9+/]+={0,2}$/.test(chunk)) {
      throw new Error(`Widget artwork source chunk is invalid: ${partName}`);
    }
    chunks.push(chunk);
  }

  const encoded = chunks.join("");
  if (encoded.length % 4 !== 0) {
    throw new Error("Widget artwork base64 source has an invalid encoded length");
  }
  const artwork = Buffer.from(encoded, "base64");
  if (artwork.length < 100_000
      || artwork.toString("ascii", 0, 4) !== "RIFF"
      || artwork.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Widget artwork source is missing, truncated, or is not a valid WebP atlas");
  }

  const destinations = [
    path.join(ROOT, "public", "math_master_widget_atlas.webp"),
    path.join(ROOT, "android-native", "res", "drawable-nodpi", "math_master_widget_atlas.webp"),
  ];
  for (const destination of destinations) {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, artwork);
  }
  return { bytes: artwork.length, destinations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareWidgetArtwork()
    .then(({ bytes, destinations }) => {
      console.log(`Prepared high-resolution widget artwork (${bytes} bytes) for ${destinations.length} build targets.`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown artwork preparation error";
      console.error(`Widget artwork preparation failed: ${message}`);
      process.exitCode = 1;
    });
}
