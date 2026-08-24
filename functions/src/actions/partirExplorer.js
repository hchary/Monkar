// Handler for the "Partir explorer" action (docs/TODO.md "Aventure exploration mechanics"),
// registered under the shared "partirExplorer" handlerId - a second, sibling Aventure-branch
// action alongside mission.js's "Mission", not a replacement for it.
//
// Rewired onto the bestiary by docs/TODO.md "ActionResult and the single applier": a round no
// longer synthesises an objective out of the drawn location's tags, it draws a *monster* from the
// area the character's region sits in (region.areaId → worldData/areas/items → area.type, matched
// against each monster's resolved areaType, parent chain included - lib/monsters.js) and resolves
// it through the d100 engine, exactly like a mission. The location is still drawn, but only for
// flavour: it names the run in the result pop-up and in the circumstance stamped on an evolved
// talent.
//
// actionType.encounterCount rounds run independently, each one its own ActionResult applied to the
// character the previous round left behind - so a mid-run talent gain genuinely raises the next
// round's roll, and a mid-run death ends the run there. It is the only action where wounds
// accumulate *within* one occurrence, which makes it the handler docs/TODO.md "Healing and wound
// recovery" should be balanced against.
//
// A region with no area, an area no monster covers, or a bestiary that is simply empty are content
// gaps, not errors: the action runs and resolves zero rounds, the same "silently skipped rather
// than failing" convention the loot draw uses for a missing table.
//
// `fatigue` keeps accumulating here and keeps being read by nothing - documented, not fixed.

const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted, DIFFICULTY_ORDER } = require("../lib/rolls");
const { pickRandom } = require("../lib/loot");
const { resolveMission, DIFFICULTY_WEIGHTS } = require("../lib/missionResolution");
const { monstersForAreaType } = require("../lib/monsters");
const { rollTalentEvolutionIds } = require("../lib/talentEvolution");
const { rollReputationReward } = require("../lib/reputation");
const { createActionResult, applyActionResult } = require("../lib/actionResult");
const { drawMissionLoot, difficultyToRarity } = require("../missionLoot");

// The engine's own distribution (25/45/20/6/3/1 across facile..mythique), in the
// `[{ difficulty, weight }]` shape rollWeighted takes. An actionType may still override it through
// its own questDifficultyWeights - a gentler exploration is an authoring decision, not a rules one.
const DEFAULT_DIFFICULTY_WEIGHTS = DIFFICULTY_ORDER.map((difficulty, index) => ({
  difficulty,
  weight: DIFFICULTY_WEIGHTS[index],
}));

async function prepare({ db, character }) {
  const regionId = character.region?.id || null;
  const regionSnap = regionId
    ? await db.collection("worldData").doc("regions").collection("items").doc(regionId).get()
    : null;
  const region = regionSnap?.exists ? { id: regionSnap.id, ...regionSnap.data() } : null;

  const areaSnap = region?.areaId
    ? await db.collection("worldData").doc("areas").collection("items").doc(region.areaId).get()
    : null;
  const areaType = areaSnap?.exists ? areaSnap.data().type || null : null;

  // A location with no candidates (region has none authored yet) is a content gap, not an error -
  // the run simply has no name to show.
  const locationId = pickRandom(region?.adventureZoneIds || []);
  let location = null;
  if (locationId) {
    const locationSnap = await db
      .collection("worldData")
      .doc("adventureZones")
      .collection("items")
      .doc(locationId)
      .get();
    if (locationSnap.exists) location = { id: locationSnap.id, ...locationSnap.data() };
  }

  const [monstersSnap, lootTablesSnap, objectsSnap, talentsSnap] = await Promise.all([
    db.collection("worldData").doc("monsters").collection("items").get(),
    db.collection("worldData").doc("lootTables").collection("items").get(),
    db.collection("worldData").doc("objects").collection("items").get(),
    db.collection("worldData").doc("talents").collection("items").get(),
  ]);
  const monsters = monstersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lootTables = lootTablesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const talents = talentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Resolved once for the whole run rather than per round: the pool cannot change mid-action, and
  // the parent-chain walk is the expensive part.
  const candidateMonsters = monstersForAreaType(monsters, areaType);

  return { location, areaType, candidateMonsters, lootTables, objects, talents };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { location, candidateMonsters, lootTables, objects, talents } = context;

  const locationName = location?.name || null;
  const difficultyWeights = actionType.questDifficultyWeights || DEFAULT_DIFFICULTY_WEIGHTS;
  const encounterCount = Number(actionType.encounterCount) || 1;
  const circumstance = locationName ? `lors d'une exploration à ${locationName}` : "lors d'une exploration";

  // Threaded forward each round so a mid-run talent gain or escalating wound state genuinely
  // affects what follows, instead of every round rolling against the character's pre-action
  // snapshot (docs/TODO.md "Aventure exploration mechanics").
  let roundCharacter = character;
  const rounds = [];
  const loot = [];
  const talentEvolutions = [];
  const stateUpdates = {};
  let totalReputationGained = 0;

  for (let i = 0; i < encounterCount; i++) {
    const monster = pickRandom(candidateMonsters);
    if (!monster) break; // content gap - no bestiary entry covers this area, so there is nothing to meet

    const difficulty = rollWeighted(difficultyWeights)?.difficulty || null;
    const tagIds = monster.tagIds || [];
    const outcome = resolveMission({ character: roundCharacter, tagIds, difficulty });

    const { trainedIds, gainedIds } = outcome.success
      ? rollTalentEvolutionIds({
          characterTalents: roundCharacter.talents || [],
          catalogTalents: talents,
          tagIds,
          objectiveRarity: difficultyToRarity(difficulty),
          difficulty,
        })
      : { trainedIds: [], gainedIds: [] };

    const result = createActionResult({
      itemsGained: drawMissionLoot({
        difficulty,
        tagIds,
        lootTables,
        objects,
        rarityOffset: outcome.success ? 0 : 2,
      }),
      talentsGained: gainedIds,
      talentTrained: trainedIds,
      reputationGained: outcome.success ? rollReputationReward(difficulty) : 0,
      injury: outcome.injury,
    });

    const { updates: effects, died } = applyActionResult(roundCharacter, result, {
      today,
      circumstance,
      talentCatalog: talents,
    });
    const { lastAction: effectSummary = {}, ...roundState } = effects;

    rounds.push({
      difficulty,
      monsterId: monster.id,
      monsterName: monster.name,
      score: outcome.updatedRoll,
      threshold: outcome.threshold,
      success: outcome.success,
      wound: outcome.wound,
      reputationGained: effectSummary.reputationGained || 0,
    });

    loot.push(...(effectSummary.loot || []));
    talentEvolutions.push(...(effectSummary.talentEvolutions || []));
    totalReputationGained += effectSummary.reputationGained || 0;

    // Each round's patch overwrites the previous one's for the fields it touches - the applier
    // computes every one of them from the character it was handed, which is the character the
    // round before it left behind, so the last write already carries the whole run.
    Object.assign(stateUpdates, roundState);
    roundCharacter = { ...roundCharacter, ...roundState };

    // An already-dead character doesn't draw further encounters - the loop stops immediately,
    // leaving fewer than encounterCount rounds recorded for this occurrence.
    if (died) break;
  }

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
    fatigue: (character.fatigue || 0) + rounds.length,
    ...stateUpdates,
    lastAction: {
      actionTypeId,
      date: today,
      // At least one encounter went the character's way - the per-round detail in `rounds` is
      // what actually distinguishes a clean sweep from a costly one (docs/TODO.md "Aventure
      // exploration mechanics", "Result pop-up" left this UI/summary decision to this entry).
      success: rounds.some((r) => r.success),
      narrativeText: "",
      location: location ? { id: location.id, name: location.name } : null,
      rounds,
      totalReputationGained,
      loot,
      talentEvolutions,
    },
  };

  const logFields = {
    success: updates.lastAction.success,
    narrativeText: updates.lastAction.narrativeText,
    location: updates.lastAction.location,
    roundsResolved: rounds.length,
  };

  return { updates, logFields };
}

// Identical in shape to the other Aventure handlers' own commit() - turns the loot flattened
// onto lastAction.loot during resolve() into Instance documents the character actually owns.
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
