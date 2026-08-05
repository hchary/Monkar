// The scheduled Interval-tick sweep behind quest triggers (docs/TODO.md "Quest triggers and
// end-of-action pop-up pages"): grants a quest to every character whose owned talents/
// reputation/profession/region/etc. satisfy that quest's authored `trigger.conditions` - the
// same row shape and evaluator already used to gate action availability (actionConditions.js).
//
// Server-only, unlike actionConditions.js/actionLifecycle.js: this only ever runs inside the
// scheduled Cloud Function registered in functions/src/index.ts, so there is no client copy that
// needs to agree with it.

const { FieldValue } = require("firebase-admin/firestore");
const { evaluateConditions, conditionsNeedInstances } = require("./actionConditions");

// A quest with no trigger, or an empty conditions list, is never auto-granted - see
// shared/schema/quest.ts's `trigger` field.
function questsWithTriggers(quests) {
  return quests.filter((quest) => Array.isArray(quest?.trigger?.conditions) && quest.trigger.conditions.length > 0);
}

// The quest ids a single character newly qualifies for in this pass. Quests already in
// character.triggeredQuestIds are skipped, so a match is granted exactly once, ever - a
// character who later stops meeting a trigger's conditions (e.g. reputation drops back down)
// keeps whatever it already granted.
function evaluateQuestTriggersForCharacter({ character, triggerableQuests, instanceTagIds }) {
  const alreadyTriggered = new Set(character?.triggeredQuestIds || []);
  const ctx = { character, instanceTagIds: instanceTagIds || new Set() };

  return triggerableQuests
    .filter((quest) => !alreadyTriggered.has(quest.id))
    .filter((quest) => evaluateConditions(quest.trigger.conditions, ctx).ok)
    .map((quest) => quest.id);
}

// Full sweep: every living character against every quest carrying a trigger. Run once per
// Interval tick (see functions/src/index.ts's scheduled `sweepQuestTriggers` export) rather than
// on any individual character's own completesAt clock, per docs/TODO.md's cadence decision.
async function sweepQuestTriggers({ db }) {
  const [questsSnap, charactersSnap] = await Promise.all([
    db.collection("worldData").doc("quests").collection("items").get(),
    db.collection("characters").where("alive", "==", true).get(),
  ]);

  const quests = questsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const triggerableQuests = questsWithTriggers(quests);
  if (triggerableQuests.length === 0) return { charactersUpdated: 0 };

  // The owned-instance tag set costs extra reads per character, so it is only ever loaded when
  // some trigger actually asks for it - same guard as actionContext.js's buildConditionContext.
  const needsInstances = triggerableQuests.some((quest) => conditionsNeedInstances(quest.trigger.conditions));
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

    let instanceTagIds = new Set();
    if (needsInstances) {
      const instancesSnap = await db.collection("instances").where("characterId", "==", characterDoc.id).get();
      for (const instanceDoc of instancesSnap.docs) {
        for (const tagId of objectTagIdsByObjectId.get(instanceDoc.data().objectId) || []) instanceTagIds.add(tagId);
      }
    }

    const newlyTriggeredIds = evaluateQuestTriggersForCharacter({ character, triggerableQuests, instanceTagIds });
    if (newlyTriggeredIds.length === 0) continue;

    await characterDoc.ref.update({ triggeredQuestIds: FieldValue.arrayUnion(...newlyTriggeredIds) });
    charactersUpdated += 1;
  }

  return { charactersUpdated };
}

module.exports = { questsWithTriggers, evaluateQuestTriggersForCharacter, sweepQuestTriggers };
