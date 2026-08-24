// Handler for the "Se renseigner" action, registered under the shared "recherche" handlerId -
// like recolte.js/artisanat.js, a game can only ever need one of these per world, but the
// convention of keying by handlerId rather than a hardcoded action document id
// (docs/ISSUE-02-ACTION-FRAMEWORK.md D13) is kept anyway. Renamed from the earlier "rumeur"
// handlerId now that its rumor-harvesting half has been removed - only mission generation
// remains, so the handlerId no longer names a mechanic the handler doesn't perform.
//
// Performing it generates actionType.missionRollCount missions into character.missionJournal,
// replacing whatever was still sitting there unclaimed (see mission journal below).
//
// Mission generation (docs/TODO.md "Mission generation from the bestiary"): each draw picks a
// difficulty from the engine's own 25/45/20/6/3/1 distribution, then a *monster* from the bestiary
// - the ones whose resolved areaType matches the area the character's region sits in
// (region.areaId -> worldData/areas/items -> area.type, matched through the parent chain by
// lib/monsters.js), exactly the pool partirExplorer.js draws its encounters from. The two draws are
// independent: monster.difficulty does not gate which monsters appear at which difficulty, it only
// raises the loot rarity ceiling later (docs/TODO.md "Monster-pool loot"). The mission's name is
// `Chasse {monster.name}` and its tagIds are the monster's resolved ones; richer names come from
// the bestiary itself, where parentId makes "dragon ancien" a child of "dragon".
//
// A content gap - a region with no area, an area no monster covers, or an empty bestiary - yields
// fewer missions rather than failing the action outright, the same "silently skipped rather than
// failing" convention functions/src/missionLoot.js's drawMissionLoot already uses for a missing
// loot table.
//
// Missions stay region-locked: the journal entry keeps the regionId it was generated in and
// mission.js refuses to resolve it anywhere else, so travelling strands whatever is left unclaimed.
//
// Always available, no condition - every character can perform it any time (subject only to the
// normal once-per-Interval action lock).
//
// No ActionResult here (docs/TODO.md "ActionResult and the single applier"): generating missions
// writes the mission journal and nothing else, and the applier's eight-field vocabulary has no word
// for the journal. Building an empty result to route around would add a call and apply nothing.

const { randomUUID } = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted, DIFFICULTY_ORDER } = require("../lib/rolls");
const { DIFFICULTY_WEIGHTS } = require("../lib/missionResolution");
const { pickRandom } = require("../lib/loot");
const { indexMonstersById, resolveMonster, monstersForAreaType } = require("../lib/monsters");
const { findPendingChainStep } = require("../lib/questChains");

// The engine's own distribution (25/45/20/6/3/1 across facile..mythique) in the
// `[{ difficulty, weight }]` shape rollWeighted takes, the same table partirExplorer.js builds for
// its per-round draw. Not overridable per actionType here: exploration lets an author soften its
// own rounds, but the journal is the game's one shared offer and stays on the engine's curve.
const DIFFICULTY_WEIGHT_TABLE = DIFFICULTY_ORDER.map((difficulty, index) => ({
  difficulty,
  weight: DIFFICULTY_WEIGHTS[index],
}));

// "Chasse dragon", not "Chasse au dragon": no French article contraction is attempted, since the
// bestiary authors its names as bare nouns and a contraction would need gender/number the catalog
// does not carry. The difficulty is not part of the title either - it is its own field, already
// rendered with the difficulty-text-* accent class in the journal and the result pop-up.
function missionName(monsterName) {
  return `Chasse ${monsterName}`;
}

// Shared by the normal draw below and the forced quest-chain slot in resolve(), which brings its
// own monster and its own authored difficulty instead of drawing either. `monster` is always a
// *resolved* monster (lib/monsters.js), so its tagIds already include everything the parent chain
// contributes.
function buildMission({ monster, difficulty }) {
  return {
    targetMonsterId: monster.id,
    name: missionName(monster.name),
    difficulty,
    tagIds: monster.tagIds || [],
  };
}

// One mission draw: a difficulty off the weighted table, then a uniform pick among the monsters
// this area actually holds. Returns null when the pool is empty - the caller skips that roll rather
// than retrying it, the same "silently skipped, not retried" precedent drawMissionLoot set for
// per-item content gaps.
function drawMission({ candidateMonsters }) {
  const target = pickRandom(candidateMonsters || []);
  if (!target) return null;

  const difficulty = rollWeighted(DIFFICULTY_WEIGHT_TABLE)?.difficulty || null;
  return buildMission({ monster: target, difficulty });
}

async function prepare({ db, character }) {
  const regionId = character.region?.id;
  if (!regionId) throw new HttpsError("failed-precondition", "Ce personnage n'a pas de région.");

  const regionRef = db.collection("worldData").doc("regions").collection("items").doc(regionId);
  const regionSnap = await regionRef.get();
  const region = regionSnap.exists ? { id: regionSnap.id, ...regionSnap.data() } : null;

  // A region with no area authored yet is a content gap, not an error: areaType stays null and
  // monstersForAreaType returns nothing, so the batch simply comes back empty.
  const areaSnap = region?.areaId
    ? await db.collection("worldData").doc("areas").collection("items").doc(region.areaId).get()
    : null;
  const areaType = areaSnap?.exists ? areaSnap.data().type || null : null;

  const [monstersSnap, chainsSnap] = await Promise.all([
    db.collection("worldData").doc("monsters").collection("items").get(),
    db.collection("worldData").doc("questChains").collection("items").get(),
  ]);
  const monsters = monstersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chains = chainsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Resolved once for the whole batch rather than per draw - the pool cannot change mid-action and
  // the parent-chain walk is the expensive part (the same call partirExplorer.js's prepare makes).
  // The raw list is handed on as well, since a forced chain step names a monster the area filter
  // may well have excluded.
  const candidateMonsters = monstersForAreaType(monsters, areaType);

  return { region, areaType, monsters, candidateMonsters, chains };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { region, monsters, candidateMonsters, chains } = context;

  const missionRollCount = Number(actionType.missionRollCount) || 3;
  const adventureZoneIds = region?.adventureZoneIds || [];
  const newMissions = [];

  // The location is drawn per mission and independently of the target, still from the region's own
  // adventure zones - it names where the hunt happens, it does not constrain what is hunted.
  function journalEntry(drawn) {
    return {
      id: randomUUID(),
      ...drawn,
      locationId: pickRandom(adventureZoneIds) || "",
      regionId: region?.id || character.region.id,
      generatedAt: today,
    };
  }

  // Composite quests (docs/TODO.md "Composite quests"): a pending chain step claims one slot of
  // this batch outright, guaranteed, before the rest draw normally - the mission-generation
  // analogue of partirEnQuete.js's old "this exact quest, bypassing the region pool" bypass. The
  // step names a monster, so the forced slot deliberately ignores the area filter: the chain sends
  // the character after that monster at the chain's own authored difficulty.
  const pendingStep = findPendingChainStep({ character, chains: chains || [] });
  if (pendingStep) {
    const monstersById = indexMonstersById(monsters || []);
    const stepMonster = monstersById[pendingStep.monsterId];
    if (stepMonster) {
      const monster = resolveMonster(stepMonster, monstersById);
      newMissions.push(journalEntry(buildMission({ monster, difficulty: pendingStep.difficulty })));
    }
  }

  for (let i = newMissions.length; i < missionRollCount; i++) {
    const drawn = drawMission({ candidateMonsters });
    if (!drawn) continue; // content gap - skipped, not retried
    newMissions.push(journalEntry(drawn));
  }

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      // A rolling offer, not a history - entirely replaced on every resolution (see the header
      // comment), unlike a growing journal.
      missionJournal: newMissions,
      lastAction: {
        actionTypeId,
        date: today,
        success: true,
        narrativeText: "",
        // The generated missions themselves, not just a count, so the result pop-up
        // (ActionOutcome.jsx) can list what was just offered.
        missionsGenerated: newMissions,
      },
    },
    logFields: {
      success: true,
      narrativeText: "",
      missionsGeneratedCount: newMissions.length,
    },
  };
}

module.exports = { prepare, resolve, drawMission };
