// Handler for the "Rumeur" action (docs/TODO.md "Rumor and mission system"), registered under the
// shared "rumeur" handlerId - like recolte.js/artisanat.js, a game can only ever need one Rumeur
// action per world, but the convention of keying by handlerId rather than a hardcoded action
// document id (docs/ISSUE-02-ACTION-FRAMEWORK.md D13) is kept anyway.
//
// Performing it does two things in the same resolution, neither of which can fail the action
// outright - a content gap (no qualifying rumor, no matching mission Subject/Action) just yields
// fewer results, the same "silently skipped rather than failing" convention
// functions/src/missionResolution.js's drawQuestLoot already uses:
//   - Harvests up to actionType.rumorHarvestCount rare-or-above rumor sightings from the
//     character's current region into character.rumorJournal (denormalized copies, skipping rumor
//     ids already owned).
//   - Generates actionType.missionRollCount missions into character.missionJournal, replacing
//     whatever was still sitting there unclaimed (see mission journal below).
//
// Mission generation (docs/TODO.md "Regional mission generation and journal"): a difficulty is
// drawn first, then a random worldData/missionSubjects/items entry whose climateIds overlaps the
// character's region's own climateIds and whose difficultyTiers list includes that difficulty,
// then a random worldData/missionActions/items entry sharing that Subject's type, then a random
// variation for the Subject (independent of difficulty) - the title is assembled from that draw by
// functions/src/missionNaming.js, replacing the earlier "one random 'objectif de quête'
// narrativeSubject + a uniformly random difficulty" mechanic (docs/TODO.md "Mission subject and
// action catalog"'s own note on this being a separate follow-up).
//
// Region-to-region propagation of rumorSightings (and the periodic re-evaluation that would drive
// it) is not implemented here - it depends on a still-undecided Interval-tick cadence mechanism,
// see docs/TODO.md's "Still open" note. This handler only ever reads whatever sightings already
// exist in the character's current region (seeded at a rumor's originRegionIds by
// RumorsManager.jsx).
//
// Renamed "Se renseigner" in-game (docs/TODO.md "Se renseigner intermède action") - the content
// doc's label/kindId change by hand in the Firestore console, not this handler, which keeps the
// "rumeur" handlerId for continuity. Repurposed: no longer always available - gated by the
// implicit "renseignementAvailable" condition (functions/src/lib/actionConditions.js), injected
// whenever the action's kindId inherits from RENSEIGNEMENT_ACTION_KIND_ID
// (functions/src/lib/actionKinds.js). That gate reads character.missionsSinceRenseignement,
// incremented on every mission resolution (functions/src/actions/mission.js) and reset to 0
// below whenever this handler resolves.

const { randomUUID } = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { RARITY_ORDER, DIFFICULTY_ORDER } = require("../lib/rolls");
const { pickRandom } = require("../lib/loot");
const { assembleMissionName } = require("../missionNaming");
const { findPendingChainStep } = require("../lib/questChains");

// Picks up to `count` distinct items without replacement - used for both the rumor harvest (never
// hand the same sighting twice) and, implicitly, is not needed for missions, which draw with
// replacement (nothing stops two generated missions from sharing the same Subject/Action pair).
function pickRandomUnique(items, count) {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function overlaps(a, b) {
  const set = new Set(b || []);
  return (a || []).some((x) => set.has(x));
}

function findDifficultyTier(subject, difficulty) {
  return (subject.difficultyTiers || []).find((tier) => tier.difficulty === difficulty) || null;
}

// Shared by drawMission's normal random draw and the forced composite-quest-chain draw below: a
// Subject and difficulty are already picked, only the type-matched Action and the independent
// variation remain random. Returns null on a content gap (no matching Action for that Subject's
// type) - the caller skips this roll rather than retrying it, the same "silently skipped, not
// retried" precedent drawQuestLoot set for per-item content gaps.
function buildMission({ subject, difficulty, missionActions }) {
  const candidateActions = missionActions.filter((action) => action.type === subject.type);
  const action = pickRandom(candidateActions);
  if (!action) return null;

  const variation = pickRandom(subject.variations || []) || null;
  const tier = findDifficultyTier(subject, difficulty);
  const tagIds = [...new Set([...(tier?.tagIds || []), ...(variation?.tagIds || [])])];

  return {
    subject,
    action,
    difficulty,
    tagIds,
    name: assembleMissionName({ action, subject, difficulty, variation }),
  };
}

// One mission draw: difficulty, then a climate+difficulty-matched Subject, then buildMission for
// the rest - see the header comment above.
function drawMission({ region, missionSubjects, missionActions }) {
  const difficulty = pickRandom(DIFFICULTY_ORDER);

  const candidateSubjects = missionSubjects.filter(
    (subject) => overlaps(subject.climateIds, region?.climateIds) && findDifficultyTier(subject, difficulty)
  );
  const subject = pickRandom(candidateSubjects);
  if (!subject) return null;

  return buildMission({ subject, difficulty, missionActions });
}

async function prepare({ db, character }) {
  const regionId = character.region?.id;
  if (!regionId) throw new HttpsError("failed-precondition", "Ce personnage n'a pas de région.");

  const regionRef = db.collection("worldData").doc("regions").collection("items").doc(regionId);
  const [regionSnap, sightingsSnap, rumorsSnap, missionSubjectsSnap, missionActionsSnap, chainsSnap] =
    await Promise.all([
      regionRef.get(),
      regionRef.collection("rumorSightings").get(),
      db.collection("worldData").doc("rumors").collection("items").get(),
      db.collection("worldData").doc("missionSubjects").collection("items").get(),
      db.collection("worldData").doc("missionActions").collection("items").get(),
      db.collection("worldData").doc("questChains").collection("items").get(),
    ]);

  const region = regionSnap.exists ? { id: regionSnap.id, ...regionSnap.data() } : null;
  const sightings = sightingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rumors = rumorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const missionSubjects = missionSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const missionActions = missionActionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chains = chainsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { region, sightings, rumors, missionSubjects, missionActions, chains };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { region, sightings, rumors, missionSubjects, missionActions, chains } = context;

  const rareIndex = RARITY_ORDER.indexOf("rare");
  const ownedRumorIds = new Set((character.rumorJournal || []).map((r) => r.id));
  const qualifyingSightings = sightings.filter(
    (sighting) => RARITY_ORDER.indexOf(sighting.rarity) >= rareIndex && !ownedRumorIds.has(sighting.id)
  );

  const rumorHarvestCount = Number(actionType.rumorHarvestCount) || 1;
  const newRumorEntries = pickRandomUnique(qualifyingSightings, rumorHarvestCount)
    .map((sighting) => {
      const rumor = rumors.find((r) => r.id === sighting.id);
      if (!rumor) return null; // content gap - a sighting whose catalog entry was deleted
      return {
        id: sighting.id,
        text: rumor.text,
        // The rumor's effective rarity where it was harvested, not the catalog's origin rarity -
        // a character picking it up far from its source experiences it exactly as decayed.
        rarity: sighting.rarity,
        receivedAt: today,
      };
    })
    .filter(Boolean);

  const missionRollCount = Number(actionType.missionRollCount) || 3;
  const adventureZoneIds = region?.adventureZoneIds || [];
  const newMissions = [];

  // Composite quests (docs/TODO.md "Composite quests", ported by "Retiring quests and quest
  // objectives for the subject-action system"): a pending chain step claims one slot of this
  // batch outright, guaranteed, before the rest draw normally - the mission-generation analogue of
  // partirEnQuete.js's old "this exact quest, bypassing the region pool" bypass.
  const pendingStep = findPendingChainStep({ character, chains: chains || [] });
  if (pendingStep) {
    const subject = missionSubjects.find((s) => s.id === pendingStep.subjectId);
    const drawn = subject ? buildMission({ subject, difficulty: pendingStep.difficulty, missionActions }) : null;
    if (drawn) {
      newMissions.push({
        id: randomUUID(),
        subjectId: drawn.subject.id,
        actionId: drawn.action.id,
        name: drawn.name,
        difficulty: drawn.difficulty,
        tagIds: drawn.tagIds,
        locationId: pickRandom(adventureZoneIds) || "",
        regionId: region?.id || character.region.id,
        generatedAt: today,
      });
    }
  }

  for (let i = newMissions.length; i < missionRollCount; i++) {
    const drawn = drawMission({ region, missionSubjects, missionActions });
    if (!drawn) continue; // content gap - skipped, not retried
    newMissions.push({
      id: randomUUID(),
      subjectId: drawn.subject.id,
      actionId: drawn.action.id,
      name: drawn.name,
      difficulty: drawn.difficulty,
      tagIds: drawn.tagIds,
      locationId: pickRandom(adventureZoneIds) || "",
      regionId: region?.id || character.region.id,
      generatedAt: today,
    });
  }

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      rumorJournal: [...(character.rumorJournal || []), ...newRumorEntries],
      // A rolling offer, not a history - entirely replaced on every resolution (see the header
      // comment), unlike rumorJournal which only ever grows.
      missionJournal: newMissions,
      // Resets "Se renseigner"'s own cadence gate - see the header comment.
      missionsSinceRenseignement: 0,
      lastAction: {
        actionTypeId,
        date: today,
        success: true,
        narrativeText: "",
        rumorsHarvested: newRumorEntries,
        missionsGeneratedCount: newMissions.length,
      },
    },
    logFields: {
      success: true,
      narrativeText: "",
      rumorsHarvestedCount: newRumorEntries.length,
      missionsGeneratedCount: newMissions.length,
    },
  };
}

module.exports = { prepare, resolve, drawMission };
