import test from "node:test";
import assert from "node:assert/strict";
import { parsePublishedRelease, resolveNextReleaseVersion } from "./release-version.mjs";

const legacySourceCommit = null;

test("continues from the actual legacy release instead of resetting existing versions", () => {
  const previous = parsePublishedRelease({
    name: "MathMaster 1.0 (1135)",
    body: String.raw`Automated signed Android release.\nversionCode: 1135`,
  });

  assert.equal(previous.versionCode, 1135);
  assert.equal(previous.versionName, "1.0.0");
  assert.equal(previous.sourceCommit, legacySourceCommit);

  const next = resolveNextReleaseVersion(previous, "a".repeat(40));
  assert.equal(next.versionCode, 1136);
  assert.equal(next.versionName, "1.0.1");
});

test("increments both version values once for a new successful-release candidate", () => {
  const previous = {
    versionCode: 1136,
    versionName: "1.0.1",
    sourceCommit: "a".repeat(40),
    signingCertificateSHA256: "B".repeat(64),
  };

  const next = resolveNextReleaseVersion(previous, "b".repeat(40), true);
  assert.equal(next.versionCode, 1137);
  assert.equal(next.versionName, "1.0.2");
  assert.equal(next.sourceCommit, "b".repeat(40));
  assert.equal(next.signingCertificateSHA256, "B".repeat(64));
  assert.equal(next.reusedForSameCommit, false);
});

test("re-running the same commit reuses its published version without another increment", () => {
  const previous = {
    versionCode: 1137,
    versionName: "1.0.2",
    sourceCommit: "c".repeat(40),
    signingCertificateSHA256: "D".repeat(64),
  };

  const retry = resolveNextReleaseVersion(previous, "c".repeat(40), true);
  assert.equal(retry.versionCode, 1137);
  assert.equal(retry.versionName, "1.0.2");
  assert.equal(retry.reusedForSameCommit, true);
});

test("refuses to overwrite a newer release with an older or divergent source commit", () => {
  const previous = {
    versionCode: 1137,
    versionName: "1.0.2",
    sourceCommit: "c".repeat(40),
    signingCertificateSHA256: null,
  };
  assert.throws(
    () => resolveNextReleaseVersion(previous, "b".repeat(40), false),
    /older\/divergent commit/,
  );
});

test("fails closed when published release metadata is missing instead of resetting versions", () => {
  assert.throws(
    () => parsePublishedRelease({ name: "MathMaster release", body: "No version metadata" }),
    /refusing to reset Android versions/,
  );
});

test("rejects malformed commits and versionCode overflow", () => {
  const previous = { versionCode: 2_100_000_000, versionName: "1.0.0", sourceCommit: null };
  assert.throws(() => resolveNextReleaseVersion(previous, "short"), /full 40-character Git SHA/);
  assert.throws(() => resolveNextReleaseVersion(previous, "e".repeat(40)), /upper bound/);
});
