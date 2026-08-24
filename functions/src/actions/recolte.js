// Handler for every Récolte action (functions/src/lib/actionKinds.js's HARVEST_ACTION_KIND_ID),
// registered once under the shared "recolte" handlerId - unlike the Aventure-branch handlers
// (mission.js, partirExplorer.js), there is no single hardcoded action document here, since a game
// can have several Récolte actions (bûcheron, pêcheur...) all sharing this mechanic. actionTypeId
// is read from the pipeline's own argument rather than a module constant for that reason.
//
// Mechanic (docs/TODO.md "Action de récolte"): the harvest always runs to completion - no more
// weighted roll deciding whether it fails outright (see "Abandoning the paliers system" in
// docs/ISSUE-02-ACTION-FRAMEWORK.md). It draws a random loot table among those matching the
// action's own lootTagIds (tag overlap) and rarity, then pulls baseQuantity items from it via
// harvestFromLootTable - baseQuantity being the sum of the character's mastery level in every
// profession the action is associated with, counting only professions the character actually
// knows (active or previously held). A profession the character never held contributes nothing to
// the sum, and neither does a missing candidate table - the harvest simply yields no loot rather
// than failing, exactly like a Récolte action nobody is skilled enough for.

const { FieldValue } = require("firebase-admin/firestore");
const { harvestFromLootTable } = require("../lib/harvest");
const { pickRandom } = require("../lib/loot");
const { createActionResult, applyActionResult } = require("../lib/actionResult");

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

// Turns a table draw's raw object ids into the same loot-entry shape missionLoot.js's
// drawMissionLoot produces, so the ActionResult's `itemsGained` channel carries harvest and
// mission loot identically and neither ActionOutcome.jsx's "Butin obtenu" box nor the commit-time
// Instance write needs a récolte-specific branch. Repeated ids from the same draw simply produce
// several entries, one per harvested unit - each becomes its own Instance on commit, exactly like
// distinct mission loot.
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

  let loot = [];
  const table = pickRandom(candidateTables);
  if (table) {
    const baseQuantity = masteryLevelSum(character, actionType.professionIds);
    if (baseQuantity > 0) {
      const objectIds = harvestFromLootTable({ lootTable: table, baseQuantity });
      loot = toLootEntries({ objectIds, objects, table });
    }
  }

  // A harvest's whole outcome is what it gathered, so its ActionResult carries one field - but it
  // goes through the same applier as everything else (docs/TODO.md "ActionResult and the single
  // applier"), which is what keeps `lastAction.loot` and the commit-time materialization identical
  // across every action that grants an item.
  const { updates: effects } = applyActionResult(character, createActionResult({ itemsGained: loot }), {
    today,
    circumstance: `lors d'une récolte (${actionType.label || actionTypeId})`,
  });
  const { lastAction: effectSummary = {}, ...stateUpdates } = effects;

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      ...stateUpdates,
      lastAction: {
        actionTypeId,
        date: today,
        success: true,
        narrativeText: "",
        ...effectSummary,
      },
    },
    logFields: {
      success: true,
      narrativeText: "",
      lootCount: loot.length,
    },
  };
}

// Runs when the player closes the result pop-up (see acknowledgeAction in functions/src/index.js)
// - identical in shape to the other Aventure handlers' own commit(), turning the loot frozen onto
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
