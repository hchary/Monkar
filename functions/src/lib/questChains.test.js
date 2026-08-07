const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { findPendingChainStep, findChainAdvance } = require("./questChains");

describe("findPendingChainStep", () => {
  const chain = {
    id: "chain1",
    steps: [
      { subjectId: "s-first", difficulty: "facile" },
      { subjectId: "s-second", difficulty: "moyen" },
      { subjectId: "s-third", difficulty: "difficile" },
    ],
  };

  test("returns null when no chain has been started", () => {
    const character = { triggeredSubjectIds: [], questChainProgress: {} };
    assert.equal(findPendingChainStep({ character, chains: [chain] }), null);
  });

  test("returns null once the last step has been resolved (progress reaches steps.length)", () => {
    const character = { triggeredSubjectIds: ["s-second"], questChainProgress: { chain1: 3 } };
    assert.equal(findPendingChainStep({ character, chains: [chain] }), null);
  });

  test("finds the pending step granted by resolving the previous one", () => {
    const character = { triggeredSubjectIds: ["s-second"], questChainProgress: { chain1: 1 } };
    const pending = findPendingChainStep({ character, chains: [chain] });
    assert.deepEqual(pending, { chainId: "chain1", subjectId: "s-second", difficulty: "moyen", grantIndex: 0 });
  });

  test("picks the earliest-granted step when several chains have one pending", () => {
    const chainA = {
      id: "chainA",
      steps: [
        { subjectId: "a1", difficulty: "facile" },
        { subjectId: "a2", difficulty: "moyen" },
      ],
    };
    const chainB = {
      id: "chainB",
      steps: [
        { subjectId: "b1", difficulty: "facile" },
        { subjectId: "b2", difficulty: "moyen" },
      ],
    };
    const character = {
      triggeredSubjectIds: ["b2", "a2"],
      questChainProgress: { chainA: 1, chainB: 1 },
    };
    const pending = findPendingChainStep({ character, chains: [chainA, chainB] });
    assert.equal(pending.chainId, "chainB");
    assert.equal(pending.subjectId, "b2");
  });

  test("ignores a step not yet actually granted into triggeredSubjectIds", () => {
    const character = { triggeredSubjectIds: [], questChainProgress: { chain1: 1 } };
    assert.equal(findPendingChainStep({ character, chains: [chain] }), null);
  });
});

describe("findChainAdvance", () => {
  const chain = {
    id: "chain1",
    steps: [
      { subjectId: "s-first", difficulty: "facile" },
      { subjectId: "s-second", difficulty: "moyen" },
      { subjectId: "s-third", difficulty: "difficile" },
    ],
  };

  test("returns null for a subject/difficulty pair that belongs to no chain", () => {
    assert.equal(findChainAdvance({ subjectId: "unrelated", difficulty: "facile", chains: [chain] }), null);
  });

  test("returns null when the subject matches a step but at the wrong difficulty", () => {
    assert.equal(findChainAdvance({ subjectId: "s-first", difficulty: "epique", chains: [chain] }), null);
  });

  test("advances to the next step and names the next subject id for a non-final step", () => {
    const advance = findChainAdvance({ subjectId: "s-first", difficulty: "facile", chains: [chain] });
    assert.deepEqual(advance, { chainId: "chain1", nextStepIndex: 1, nextSubjectId: "s-second" });
  });

  test("still bumps progress past the final step, but grants no next subject", () => {
    const advance = findChainAdvance({ subjectId: "s-third", difficulty: "difficile", chains: [chain] });
    assert.deepEqual(advance, { chainId: "chain1", nextStepIndex: 3, nextSubjectId: null });
  });
});
