import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

function parseVersionName(value) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(value ?? "").trim());
  if (!match) throw new Error(`Invalid Android versionName in latest release: ${value}`);
  const parts = match.slice(1).map((part) => part === undefined ? 0 : Number(part));
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    throw new Error("Android versionName contains an invalid numeric component.");
  }
  return parts;
}

function bumpPatchVersion(versionName) {
  const [major, minor, patch] = parseVersionName(versionName);
  if (patch >= Number.MAX_SAFE_INTEGER) throw new Error("Android versionName patch component overflow.");
  return `${major}.${minor}.${patch + 1}`;
}

export function parsePublishedRelease(release) {
  const name = String(release?.name ?? "");
  const body = String(release?.body ?? "");
  const codeMatch = /versionCode\s*:\s*(\d+)/i.exec(body)
    ?? /\((\d+)\)\s*$/.exec(name);
  const nameMatch = /versionName\s*:\s*([0-9]+(?:\.[0-9]+){1,2})/i.exec(body)
    ?? /MathMaster\s+([0-9]+(?:\.[0-9]+){1,2})\s+\(\d+\)/i.exec(name);
  const sourceMatch = /sourceCommit\s*:\s*([0-9a-f]{40})/i.exec(body);
  const certificateMatch = /signingCertificateSHA256\s*:\s*([0-9a-f]{64})/i.exec(body);

  if (!codeMatch || !nameMatch) {
    throw new Error("Latest published release is missing a readable versionCode/versionName; refusing to reset Android versions.");
  }

  const versionCode = Number(codeMatch[1]);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode >= MAX_ANDROID_VERSION_CODE) {
    throw new Error(`Latest release versionCode is invalid or exhausted: ${codeMatch[1]}`);
  }

  // Historical releases used "1.0". Preserve that baseline and normalize
  // the next patch release to the three-component format (e.g. 1.0.1).
  const versionName = parseVersionName(nameMatch[1]).join(".");
  return {
    versionCode,
    versionName,
    sourceCommit: sourceMatch?.[1]?.toLowerCase() ?? null,
    signingCertificateSHA256: certificateMatch?.[1]?.toUpperCase() ?? null,
  };
}

export function resolveNextReleaseVersion(previous, currentCommit, isPreviousCommitAncestor = true) {
  const commit = String(currentCommit ?? "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Current source commit must be a full 40-character Git SHA.");

  if (previous.sourceCommit && commit === previous.sourceCommit) {
    return {
      versionCode: previous.versionCode,
      versionName: previous.versionName,
      sourceCommit: commit,
      signingCertificateSHA256: previous.signingCertificateSHA256 ?? null,
      reusedForSameCommit: true,
    };
  }

  if (previous.sourceCommit && !isPreviousCommitAncestor) {
    throw new Error("Refusing to publish an older/divergent commit over a newer release. Build the current main branch instead.");
  }

  const versionCode = previous.versionCode + 1;
  if (!Number.isSafeInteger(versionCode) || versionCode > MAX_ANDROID_VERSION_CODE) {
    throw new Error("Android versionCode has reached the supported upper bound.");
  }

  return {
    versionCode,
    versionName: bumpPatchVersion(previous.versionName),
    sourceCommit: commit,
    signingCertificateSHA256: previous.signingCertificateSHA256 ?? null,
    reusedForSameCommit: false,
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout.trim();
}

function readLatestPublishedRelease() {
  const raw = run("gh", ["release", "view", "latest", "--json", "name,body"]);
  let release;
  try {
    release = JSON.parse(raw);
  } catch {
    throw new Error("GitHub returned an unreadable latest release response.");
  }
  return parsePublishedRelease(release);
}

function isAncestor(previousCommit, currentCommit) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", previousCommit, currentCommit], {
    encoding: "utf8",
    stdio: "ignore",
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error("Unable to validate Git ancestry for the previous release commit.");
}

function main() {
  const currentCommit = (process.env.GITHUB_SHA || run("git", ["rev-parse", "HEAD"])).toLowerCase();
  const previous = readLatestPublishedRelease();
  const isPreviousCommitAncestor = previous.sourceCommit
    ? isAncestor(previous.sourceCommit, currentCommit)
    : true;
  const next = resolveNextReleaseVersion(previous, currentCommit, isPreviousCommitAncestor);
  process.stdout.write(`${JSON.stringify(next, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Release version resolution failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
