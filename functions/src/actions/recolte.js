// Handler for every Récolte action (functions/src/lib/actionKinds.js's HARVEST_ACTION_KIND_ID),
// registered once under the shared "recolte" handlerId - unlike partirEnQuete.js, there is no
// single hardcoded action document here, since a game can have several Récolte actions (bûcheron,
// pêcheur...) all sharing this mechanic. actionTypeId is read from the pipeline's own argument
// rather than a module constant for that reason.
//
// Mechanic (docs/TODO.md "Action de récolte"): on a successful tier, draw a random loot table
// among those matching the action's own lootTagIds (tag overlap) and rarity, then pull
// baseQuantity items from it via harvestFromLootTable - baseQuantity being the sum of the
// character's mastery level in every profession the action is associated with, counting only
// professions the character actually knows (active or previously held). A profession the
// character never held contributes nothing to the sum.

const { rollWeighted } = require("../lib/rolls");
const { applyTierEffects, isSuccess } = require("../lib/actionEffects");
const { harvestFromLootTable } = require("../lib/harvest");
const { pickRandom } = require("../lib/loot");

// Only known professions count - a character missing some of the action's associated métiers
// still harvests, just for less: the professions it doesn't know contribute zero to the sum,
// they don't disqualify the action (professionIds gates *access* via hasProfession, not the
// quantity formula).
function masteryLevelSum(character, professionIds) {
  const levelByProfessionId = new Map(
    (character.knownProfessions || []).map((known) => [known.professionId, known.level])
  );
  // The active profession's live level can be ahead of its stale knownProfessions entry (bumped
  // since the last profession switch - see src/lib/professions.js), so it must win here.
  if (character.professionId) levelByProfessionId.set(character.professionId, character.professionLevel);

  return (professionIds || []).reduce((sum, id) => sum + (levelByProfessionId.get(id) || 0), 0);
}

async function prepare({ db, actionType }) {
  const lootTablesSnap = await db
    .collection("worldData")
    .doc("lootTables")
    .collection("items")
    .where("rarity", "==", actionType.rarity)
    .get();
  const lootTagIds = actionType.lootTagIds || [];
  const candidateTables = lootTablesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((table) => (table.tagIds || []).some((id) => lootTagIds.includes(id)));

  const objectsSnap = await db.collection("worldData").doc("objects").collection("items").get();
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { candidateTables, objects };
}

// Turns a table draw's raw object ids into the same loot-entry shape partirEnQuete.js uses, so
// ActionOutcome.jsx's "Butin obtenu" box and the commit-time Instance write need no récolte-
// specific branch. Repeated ids from the same draw simply produce several entries, one per
// harvested unit - each becomes its own Instance on commit, exactly like distinct quest loot.
function toLootEntries({ objectIds, objects, table }) {
  return objectIds
    .map((objectId) => objects.find((o) => o.id === objectId))
    .filter(Boolean)
    .map((object) => ({
      objectId: object.id,
      name: object.name,
      rarity: object.rarity,
      type: object.type,
      tagIds: object.tagIds || [],
      tableId: table.id,
      tableName: table.name,
      description: object.description || "",
    }));
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { candidateTables, objects } = context;
  const tier = rollWeighted(actionType.tiers);
  const success = isSuccess(tier);

  let loot = [];
  if (success) {
    const table = pickRandom(candidateTables);
    if (table) {
      const baseQuantity = masteryLevelSum(character, actionType.professionIds);
      if (baseQuantity > 0) {
        const objectIds = harvestFromLootTable({ lootTable: table, baseQuantity });
        loot = toLootEntries({ objectIds, objects, table });
      }
    }
  }

  const updates = applyTierEffects({
    tier,
    today,
    actionTypeId,
    character,
    narrativeText: tier.narrativeText || "",
    lastActionExtra: { loot },
  });

  return {
    updates,
    logFields: {
      tierName: tier.name,
      success,
      narrativeText: tier.narrativeText || "",
      consequence: updates.lastAction.consequence,
    },
  };
}

// Runs when the player closes the result pop-up (see acknowledgeAction in functions/src/index.js)
// - identical in shape to partirEnQuete.js's commit(), turning the loot frozen onto
// lastAction.loot during resolve() into Instance documents the character actually owns.
async function commit({ tx, db, characterRef, lastAction, uid, today }) {
  for (const item of lastAction.loot || []) {
    const instanceRef = db.collection("instances").doc();
    tx.set(instanceRef, {
      objectId: item.objectId,
      characterId: characterRef.id,
      ownerUid: uid,
      acquisitionDate: today,
      condition: "neuf",
      description: item.description,
    });
  }
}

module.exports = { prepare, resolve, commit };
