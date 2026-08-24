// Composite quest chain progression (docs/TODO.md "Composite quests"), ported onto the Subject/
// difficulty-pair mission system by "Retiring quests and quest objectives for the subject-action
// system": worldData/questChains/items/{id}.steps is now a [{ subjectId, difficulty }] list rather
// than a worldData/quests/items id list (see shared/schema/questChain.ts). Used by
// functions/src/actions/recherche.js (to force a pending step into the next mission-generation batch,
// the same "this exact content offered next, bypassing the normal draw" mechanic
// functions/src/actions/partirEnQuete.js used to give a chain step before it was retired) and
// functions/src/actions/mission.js (to advance a chain when a resolved mission completes one of
// its steps).
//
// INTERIM: the contract has already moved on - shared/schema/questChain.ts now declares
// steps[].monsterId plus chain-level rewards - while this module still reads steps[].subjectId and
// pays no rewards. Both are rewired by docs/TODO.md "Quest chains on monsters".

// A chain step beyond the first becomes "pending" the moment it's pushed into
// character.triggeredSubjectIds and character.questChainProgress[chainId] is bumped to its index
// (see findChainAdvance below, both written together by mission.js's resolve()). While pending,
// that exact { subjectId, difficulty } pair is guaranteed a slot in the next mission-generation
// batch (recherche.js's resolve()), bypassing the normal climate/difficulty draw for that one slot. If
// more than one chain has a step pending at once, the earliest-granted one wins (earliest insertion
// into triggeredSubjectIds).
function findPendingChainStep({ character, chains }) {
  const triggeredSubjectIds = character.triggeredSubjectIds || [];
  const progressByChainId = character.questChainProgress || {};

  const candidates = chains
    .map((chain) => {
      const steps = chain.steps || [];
      const stepIndex = progressByChainId[chain.id] || 0;
      if (stepIndex <= 0 || stepIndex >= steps.length) return null;
      const step = steps[stepIndex];
      const grantIndex = triggeredSubjectIds.indexOf(step.subjectId);
      if (grantIndex === -1) return null;
      return { chainId: chain.id, subjectId: step.subjectId, difficulty: step.difficulty, grantIndex };
    })
    .filter(Boolean);

  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, candidate) => (candidate.grantIndex < earliest.grantIndex ? candidate : earliest));
}

// Called after a mission resolves successfully: does its { subjectId, difficulty } pair belong to
// a chain step, and if so, what does completing it mean for that chain's progress? Always advances
// progress by one step so a completed final step stops being reported as "pending" by
// findPendingChainStep above - only the next step's subjectId is conditional on there actually
// being a next step.
function findChainAdvance({ subjectId, difficulty, chains }) {
  for (const chain of chains) {
    const steps = chain.steps || [];
    const stepIndex = steps.findIndex((step) => step.subjectId === subjectId && step.difficulty === difficulty);
    if (stepIndex === -1) continue;
    const nextStep = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;
    return {
      chainId: chain.id,
      nextStepIndex: stepIndex + 1,
      nextSubjectId: nextStep?.subjectId || null,
    };
  }
  return null;
}

module.exports = { findPendingChainStep, findChainAdvance };
