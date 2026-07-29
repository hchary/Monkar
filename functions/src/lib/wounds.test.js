const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { applyWound } = require("./wounds");

describe("applyWound - light", () => {
  test("increments the light counter while below 3", () => {
    assert.deepStrictEqual(applyWound({}, "light"), {
      woundsLight: 1,
      woundsSevere: 0,
      woundsPermanent: 0,
      died: false,
    });
    assert.deepStrictEqual(applyWound({ woundsLight: 2 }, "light"), {
      woundsLight: 3,
      woundsSevere: 0,
      woundsPermanent: 0,
      died: false,
    });
  });

  test("escalates to a severe wound once already at 3 light wounds", () => {
    assert.deepStrictEqual(applyWound({ woundsLight: 3 }, "light"), {
      woundsLight: 3,
      woundsSevere: 1,
      woundsPermanent: 0,
      died: false,
    });
  });

  test("a light wound never kills directly, even at 3 permanent wounds - it escalates through severe first", () => {
    assert.deepStrictEqual(applyWound({ woundsLight: 3, woundsSevere: 0, woundsPermanent: 3 }, "light"), {
      woundsLight: 3,
      woundsSevere: 0,
      woundsPermanent: 3,
      died: true,
    });
  });
});

describe("applyWound - severe", () => {
  test("increments the severe counter while below 3", () => {
    assert.deepStrictEqual(applyWound({ woundsSevere: 1 }, "severe"), {
      woundsLight: 0,
      woundsSevere: 2,
      woundsPermanent: 0,
      died: false,
    });
  });

  test("escalates to a permanent wound once already at 3 severe wounds", () => {
    assert.deepStrictEqual(applyWound({ woundsSevere: 3 }, "severe"), {
      woundsLight: 0,
      woundsSevere: 3,
      woundsPermanent: 1,
      died: false,
    });
  });

  test("kills the character instead of granting a wound once already at 3 permanent wounds", () => {
    assert.deepStrictEqual(applyWound({ woundsSevere: 0, woundsPermanent: 3 }, "severe"), {
      woundsLight: 0,
      woundsSevere: 0,
      woundsPermanent: 3,
      died: true,
    });
  });

  test("death takes priority over the severe-to-permanent escalation", () => {
    assert.deepStrictEqual(applyWound({ woundsSevere: 3, woundsPermanent: 3 }, "severe"), {
      woundsLight: 0,
      woundsSevere: 3,
      woundsPermanent: 3,
      died: true,
    });
  });
});

describe("applyWound - permanent", () => {
  test("increments the permanent counter while below 3", () => {
    assert.deepStrictEqual(applyWound({ woundsPermanent: 2 }, "permanent"), {
      woundsLight: 0,
      woundsSevere: 0,
      woundsPermanent: 3,
      died: false,
    });
  });

  test("kills the character instead of a 4th permanent wound", () => {
    assert.deepStrictEqual(applyWound({ woundsPermanent: 3 }, "permanent"), {
      woundsLight: 0,
      woundsSevere: 0,
      woundsPermanent: 3,
      died: true,
    });
  });
});

describe("applyWound - validation", () => {
  test("rejects an unknown severity", () => {
    assert.throws(() => applyWound({}, "scratch"));
  });
});
