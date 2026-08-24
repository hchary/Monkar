// The scheduled Interval-tick sweep behind subject triggers (docs/TODO.md "Quest triggers and
// end-of-action pop-up pages", repointed at worldData/missionSubjects/items by "Retiring quests
// and quest objectives for the subject-action system"): grants a mission Subject to every
// character whose owned talents/reputation/profession/region/etc. satisfy that Subject's authored
// `trigger.conditions` - the same row shape and evaluator already used to gate action availability
// (actionConditions.js).
//
// Server-only, unlike actionConditions.js/actionLifecycle.js: this only ever runs inside the
// scheduled Cloud Function registered in functions/src/index.ts, so there is no client copy that
// needs to agree with it.

const { FieldValue } = require("firebase-admin/firestore");
const { evaluateConditions, conditionsNeedInstances } = require("./actionConditions");

// A Subject with no trigger, or an empty conditions list, is never auto-granted - the same rule the
// field carries in its new home, shared/schema/monster.ts's `trigger`. INTERIM: this sweep still
// reads worldData/missionSubjects/items and writes character.triggeredSubjectIds; it is repointed at
// the bestiary by docs/TODO.md "Mission generation from the bestiary".
function subjectsWithTriggers(subjects) {
  return subjects.filter((subject) => Array.isArray(subject?.trigger?.conditions) && subject.trigger.conditions.length > 0);
}

// The Subject ids a single character newly qualifies for in this pass. Subjects already in
// character.triggeredSubjectIds are skipped, so a match is granted exactly once, ever - a
// character who later stops meeting a trigger's conditions (e.g. reputation drops back down)
// keeps whatever it already granted.
function evaluateQuestTriggersForCharacter({ character, triggerableSubjects, instanceTagIds }) {
  const alreadyTriggered = new Set(character?.triggeredSubjectIds || []);
  const ctx = { character, instanceTagIds: instanceTagIds || new Set() };

  return triggerableSubjects
    .filter((subject) => !alreadyTriggered.has(subject.id))
    .filter((subject) => evaluateConditions(subject.trigger.conditions, ctx).ok)
    .map((subject) => subject.id);
}

// Full sweep: every living character against every Subject carrying a trigger, plus (as a sibling
// pass, not a separate concern) resetting each character's Intermède budget counter
// (docs/TODO.md "Intermède actions"). Run once per Interval tick (see functions/src/index.ts's
// scheduled `sweepQuestTriggers` export) rather than on any individual character's own completesAt
// clock, per docs/TODO.md's cadence decision.
async function sweepQuestTriggers({ db }) {
  const [subjectsSnap, charactersSnap] = await Promise.all([
    db.collection("worldData").doc("missionSubjects").collection("items").get(),
    db.collection("characters").where("alive", "==", true).get(),
  ]);

  const subjects = subjectsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const triggerableSubjects = subjectsWithTriggers(subjects);
  if (triggerableSubjects.length === 0) return { charactersUpdated: 0 };

  // The owned-instance tag set costs extra reads per character, so it is only ever loaded when
  // some trigger actually asks for it - same guard as actionContext.js's buildConditionContext.
  const needsInstances = triggerableSubjects.some((subject) => conditionsNeedInstances(subject.trigger.conditions));
  const objectTagIdsByObjectId = needsInstances
    ? new Map(
        (await db.collection("worldData").doc("objects").collection("items").get()).docs.map((doc) => [
          doc.id,
          doc.data().tagIds || [],
        ])
      )
    : null;

  let charactersUpdated = 0;

  for (const characterDoc of charactersSnap.docs) {
    const character = characterDoc.data();
    const updates = {};

    let instanceTagIds = new Set();
    if (needsInstances) {
      const instancesSnap = await db.collection("instances").where("characterId", "==", characterDoc.id).get();
      for (const instanceDoc of instancesSnap.docs) {
        for (const tagId of objectTagIdsByObjectId.get(instanceDoc.data().objectId) || []) instanceTagIds.add(tagId);
      }
    }

    const newlyTriggeredIds = evaluateQuestTriggersForCharacter({ character, triggerableSubjects, instanceTagIds });
    if (newlyTriggeredIds.length > 0) updates.triggeredSubjectIds = FieldValue.arrayUnion(...newlyTriggeredIds);

    // Sibling reset pass for docs/TODO.md "Intermède actions"'s per-Interval budget - piggybacked
    // on this same scheduled tick rather than a second cron schedule, per that entry's own
    // decision.
    if ((character.intermedeActionsThisInterval || 0) !== 0) updates.intermedeActionsThisInterval = 0;

    if (Object.keys(updates).length === 0) continue;

    await characterDoc.ref.update(updates);
    charactersUpdated += 1;
  }

  return { charactersUpdated };
}

module.exports = { subjectsWithTriggers, evaluateQuestTriggersForCharacter, sweepQuestTriggers };
