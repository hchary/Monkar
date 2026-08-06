// Handler for the "Rumeur" action (docs/TODO.md "Rumor and mission system"), registered under the
// shared "rumeur" handlerId - like recolte.js/artisanat.js, a game can only ever need one Rumeur
// action per world, but the convention of keying by handlerId rather than a hardcoded action
// document id (docs/ISSUE-02-ACTION-FRAMEWORK.md D13) is kept anyway.
//
// Performing it does two things in the same resolution, neither of which can fail the action
// outright - a content gap (no qualifying rumor, no "objectif de quête" narrativeSubject authored)
// just yields fewer results, the same "silently skipped rather than failing" convention
// partirEnQuete.js's drawQuestLoot already uses:
//   - Harvests up to actionType.rumorHarvestCount rare-or-above rumor sightings from the
//     character's current region into character.rumorJournal (denormalized copies, skipping rumor
//     ids already owned).
//   - Generates actionType.missionRollCount missions into character.missionJournal, replacing
//     whatever was still sitting there unclaimed - reusing the same generative building blocks
//     "Partir en quête" uses for its own narration rather than a hand-authored mission catalog.
//
// Region-to-region propagation of rumorSightings (and the periodic re-evaluation that would drive
// it) is not implemented here - it depends on a still-undecided Interval-tick cadence mechanism,
// see docs/TODO.md's "Still open" note. This handler only ever reads whatever sightings already
// exist in the character's current region (seeded at a rumor's originRegionIds by
// RumorsManager.jsx).

const { randomUUID } = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { RARITY_ORDER, DIFFICULTY_ORDER } = require("../lib/rolls");
const { pickRandom } = require("../lib/loot");

// Same reserved tag id QuestObjectivesManager.jsx's OBJECTIVE_TAG_ID forces onto every quest
// objective it authors - duplicated as a literal here rather than imported, since functions/
// shares no build step with the Vite app (same reason actionKinds.js/actionConditions.js are
// hand-mirrored copies instead of a shared import).
const OBJECTIVE_TAG_ID = "objectif-de-quete";

// Picks up to `count` distinct items without replacement - used for both the rumor harvest (never
// hand the same sighting twice) and, implicitly, is not needed for missions, which draw with
// replacement (nothing stops two generated missions from sharing the same objective).
function pickRandomUnique(items, count) {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

async function prepare({ db, character }) {
  const regionId = character.region?.id;
  if (!regionId) throw new HttpsError("failed-precondition", "Ce personnage n'a pas de région.");

  const regionRef = db.collection("worldData").doc("regions").collection("items").doc(regionId);
  const [regionSnap, sightingsSnap, rumorsSnap, narrativeSubjectsSnap] = await Promise.all([
    regionRef.get(),
    regionRef.collection("rumorSightings").get(),
    db.collection("worldData").doc("rumors").collection("items").get(),
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
  ]);

  const region = regionSnap.exists ? { id: regionSnap.id, ...regionSnap.data() } : null;
  const sightings = sightingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rumors = rumorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objectives = narrativeSubjectsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((subject) => (subject.tagIds || []).includes(OBJECTIVE_TAG_ID));

  return { region, sightings, rumors, objectives };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { region, sightings, rumors, objectives } = context;

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
        linkedQuestId: rumor.linkedQuestId || null,
        receivedAt: today,
      };
    })
    .filter(Boolean);

  const missionRollCount = Number(actionType.missionRollCount) || 3;
  const adventureZoneIds = region?.adventureZoneIds || [];
  const newMissions = [];
  for (let i = 0; i < missionRollCount; i++) {
    const objective = pickRandom(objectives);
    if (!objective) break; // content gap - no "objectif de quête" narrativeSubject authored yet
    newMissions.push({
      id: randomUUID(),
      objectiveId: objective.id,
      difficulty: pickRandom(DIFFICULTY_ORDER),
      tagIds: objective.tagIds || [],
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

module.exports = { prepare, resolve };
