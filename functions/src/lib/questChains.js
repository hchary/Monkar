// Composite quest chain progression (docs/TODO.md "Composite quests"), re-keyed onto the bestiary
// by "Mission generation from the bestiary": worldData/questChains/items/{id}.steps is a
// [{ monsterId, difficulty }] list (see shared/schema/questChain.ts), where it used to be
// [{ subjectId, difficulty }] and, before that, a worldData/quests/items id list. Used by
// functions/src/actions/recherche.js (to force a pending step into the next mission-generation batch,
// the same "this exact content offered next, bypassing the normal draw" mechanic
// functions/src/actions/partirEnQuete.js used to give a chain step before it was retired) and
// functions/src/actions/mission.js (to advance a chain when a resolved mission completes one of
// its steps).
//
// Chain documents authored before the bestiary migration are re-authored by hand, not migrated
// (docs/TODO.md "Content migration scripts"): a chain still carrying steps[].subjectId simply stops
// matching anything here.
//
// INTERIM: chain-level rewards (rewardItemIds / rewardTalentIds / rewardReputation /
// rewardRegionId) are declared by the contract and still paid by nobody, and the grant channel
// below is still character.triggeredSubjectIds - the field the scheduled trigger sweep
// (questTriggers.js) also writes. Both are closed by docs/TODO.md "Quest chains on monsters", which
// renames the character field to triggeredMonsterIds once the sweep moves off it too. The ids in it
// are already monster ids: the migration gave each monster its Subject's own document id.

// A chain step beyond the first becomes "pending" the moment it's pushed into
// character.triggeredSubjectIds and character.questChainProgress[chainId] is bumped to its index
// (see findChainAdvance below, both written together by mission.js's resolve()). While pending,
// that exact { monsterId, difficulty } pair is guaranteed a slot in the next mission-generation
// batch (recherche.js's resolve()), bypassing the normal area/difficulty draw for that one slot. If
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
      const grantIndex = triggeredSubjectIds.indexOf(step.monsterId);
      if (grantIndex === -1) return null;
      return { chainId: chain.id, monsterId: step.monsterId, difficulty: step.difficulty, grantIndex };
    })
    .filter(Boolean);

  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, candidate) => (candidate.grantIndex < earliest.grantIndex ? candidate : earliest));
}

// Called after a mission resolves successfully: does its { monsterId, difficulty } pair belong to
// a chain step, and if so, what does completing it mean for that chain's progress? Always advances
// progress by one step so a completed final step stops being reported as "pending" by
// findPendingChainStep above - only the next step's monsterId is conditional on there actually
// being a next step.
function findChainAdvance({ monsterId, difficulty, chains }) {
  for (const chain of chains) {
    const steps = chain.steps || [];
    const stepIndex = steps.findIndex((step) => step.monsterId === monsterId && step.difficulty === difficulty);
    if (stepIndex === -1) continue;
    const nextStep = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;
    return {
      chainId: chain.id,
      nextStepIndex: stepIndex + 1,
      nextMonsterId: nextStep?.monsterId || null,
    };
  }
  return null;
}

module.exports = { findPendingChainStep, findChainAdvance };
