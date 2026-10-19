import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARTS_DIRECTORY = path.join(REPOSITORY_ROOT, "android-native/assets/widget-artwork-atlas");
const PART_COUNT = 11;
const EXPECTED_BASE64_LENGTH = 184388;
const EXPECTED_BYTE_LENGTH = 138290;
const EXPECTED_SHA256 = "e6352dc04d42192950359c79677d18023a8f08ff024259b7ba3059008fdc75de";
const EXPECTED_WIDTH = 1536;
const EXPECTED_HEIGHT = 512;

export function getWebPDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 30) {
    throw new Error("Widget artwork atlas is too small to be a valid WebP image.");
  }
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Widget artwork atlas has an invalid WebP container header.");
  }
  const chunkOffset = bytes.indexOf(Buffer.from("VP8 "));
  if (chunkOffset < 0 || chunkOffset + 18 > bytes.length) {
    throw new Error("Widget artwork atlas must use a supported VP8 WebP bitstream.");
  }
  if (bytes[chunkOffset + 11] !== 0x9d
    || bytes[chunkOffset + 12] !== 0x01
    || bytes[chunkOffset + 13] !== 0x2a) {
    throw new Error("Widget artwork atlas has an invalid VP8 frame header.");
  }
  return {
    width: bytes.readUInt16LE(chunkOffset + 14) & 0x3fff,
    height: bytes.readUInt16LE(chunkOffset + 16) & 0x3fff,
  };
}

export async function loadWidgetArtworkAtlas() {
  const encodedParts = [];
  for (let index = 0; index < PART_COUNT; index += 1) {
    const filename = `part-${String(index).padStart(2, "0")}.b64`;
    const part = await readFile(path.join(PARTS_DIRECTORY, filename), "utf8");
    if (!/^[A-Za-z0-9+/=]+$/.test(part.trim())) {
      throw new Error(`Widget artwork atlas part ${filename} contains invalid Base64 data.`);
    }
    encodedParts.push(part.trim());
  }

  const encoded = encodedParts.join("");
  if (encoded.length !== EXPECTED_BASE64_LENGTH) {
    throw new Error(`Widget artwork atlas Base64 length mismatch: expected ${EXPECTED_BASE64_LENGTH}, got ${encoded.length}.`);
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== EXPECTED_BYTE_LENGTH) {
    throw new Error(`Widget artwork atlas byte length mismatch: expected ${EXPECTED_BYTE_LENGTH}, got ${bytes.length}.`);
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== EXPECTED_SHA256) {
    throw new Error("Widget artwork atlas SHA-256 validation failed; refusing to package corrupt artwork.");
  }
  const dimensions = getWebPDimensions(bytes);
  if (dimensions.width !== EXPECTED_WIDTH || dimensions.height !== EXPECTED_HEIGHT) {
    throw new Error(`Widget artwork atlas dimensions mismatch: expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}, got ${dimensions.width}x${dimensions.height}.`);
  }
  return bytes;
}

export async function prepareWidgetArtworkAtlas() {
  const atlas = await loadWidgetArtworkAtlas();
  const publicPath = path.join(REPOSITORY_ROOT, "public/math_master_widget_atlas.webp");
  await writeFile(publicPath, atlas);
  return { path: publicPath, bytes: atlas.length, ...getWebPDimensions(atlas) };
}
