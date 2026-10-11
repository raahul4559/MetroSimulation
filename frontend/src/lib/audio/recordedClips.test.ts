import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClipIndex, findClip, validateClipEntry, type RecordedClipEntry } from "./recordedClips";

const valid: RecordedClipEntry = {
  id: "en-stand-clear",
  language: "en",
  text: "Please stand clear of the doors.",
  file: "/audio/announcements/en/stand-clear.ogg",
  attribution: "Jane Doe",
  license: "CC-BY-4.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.ogg",
  official: false,
};

describe("recorded clip manifest", () => {
  it("accepts a fully attributed, permissively licensed clip", () => {
    assert.deepEqual(validateClipEntry(valid), []);
  });

  it("rejects unknown or missing licenses and missing attribution", () => {
    assert.ok(validateClipEntry({ ...valid, license: "All rights reserved" }).length > 0);
    assert.ok(validateClipEntry({ ...valid, attribution: "" }).length > 0);
    assert.ok(validateClipEntry({ ...valid, sourceUrl: null }).length > 0);
  });

  it("refuses an official claim without BMRCL's documented permission", () => {
    assert.ok(validateClipEntry({ ...valid, official: true }).some((p) => p.includes("officialPermission")));
  });

  it("refuses files outside the announcements folder", () => {
    assert.ok(validateClipEntry({ ...valid, file: "/audio/announcements/../../secret.mp3" }).length > 0);
  });

  it("matches whole sentences regardless of case, spacing and final punctuation", () => {
    const { index, rejected } = buildClipIndex({ clips: [valid, { ...valid, id: "bad", license: "" }] });
    assert.equal(rejected.length, 1);
    assert.ok(findClip(index, "please stand  clear of the doors", "en"));
    assert.equal(findClip(index, "Please stand clear of the doors.", "hi"), null);
    assert.equal(findClip(index, "Please stand clear of the doors at Majestic.", "en"), null);
  });

  it("treats a missing or malformed manifest as no recordings", () => {
    assert.equal(buildClipIndex(null).index.size, 0);
    assert.equal(buildClipIndex({ clips: "nope" }).index.size, 0);
  });
});
