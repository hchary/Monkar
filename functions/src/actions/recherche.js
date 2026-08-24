// Handler for the "Se renseigner" action, registered under the shared "recherche" handlerId -
// like recolte.js/artisanat.js, a game can only ever need one of these per world, but the
// convention of keying by handlerId rather than a hardcoded action document id
// (docs/ISSUE-02-ACTION-FRAMEWORK.md D13) is kept anyway. Renamed from the earlier "rumeur"
// handlerId now that its rumor-harvesting half has been removed - only mission generation
// remains, so the handlerId no longer names a mechanic the handler doesn't perform.
//
// Performing it generates actionType.missionRollCount missions into character.missionJournal,
// replacing whatever was still sitting there unclaimed (see mission journal below). A content gap
// (no matching mission Subject/Action) just yields fewer results rather than failing the action
// outright - the same "silently skipped rather than failing" convention
// functions/src/missionResolution.js's drawQuestLoot already uses.
//
// Mission generation (docs/TODO.md "Regional mission generation and journal"): a difficulty is
// drawn first, then a random worldData/missionSubjects/items entry whose climateIds overlaps the
// character's region's own climateIds and whose difficultyTiers list includes that difficulty,
// then a random worldData/missionActions/items entry sharing that Subject's type, then a random
// variation for the Subject (independent of difficulty) - the title is assembled from that draw by
// assembleMissionName below.
//
// Always available, no condition - every character can perform it any time (subject only to the
// normal once-per-Interval action lock).

const { randomUUID } = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { DIFFICULTY_ORDER } = require("../lib/rolls");
const { pickRandom } = require("../lib/loot");
const { findPendingChainStep } = require("../lib/questChains");

function overlaps(a, b) {
  const set = new Set(b || []);
  return (a || []).some((x) => set.has(x));
}

function findDifficultyTier(subject, difficulty) {
  return (subject.difficultyTiers || []).find((tier) => tier.difficulty === difficulty) || null;
}

// difficulty-tier prefix, then variation prefix, then the subject's base name, then variation
// suffix, then difficulty-tier suffix, all behind the Action's phrase - per docs/TODO.md's own
// worked example ("Vaincre" + "dragon" at épique with tier suffix "liche" and variation suffix
// "rouge" -> "Vaincre dragon rouge liche"). Any absent slot is simply skipped.
//
// Lifted here from the deleted functions/src/missionNaming.js, whose slot-assembly style mirrored
// the retired narrative generator's (docs/TODO.md "Narration removal"). Interim: this whole
// subject/action draw is replaced by a monster-catalog draw naming missions `Chasse {monster.name}`
// (docs/TODO.md "Mission generation from the bestiary"), which takes this helper with it.
const SUBJECT_SLOT_ORDER = ["tierPrefix", "variationPrefix", "name", "variationSuffix", "tierSuffix"];

function assembleMissionName({ action, subject, difficulty, variation }) {
  const tier = findDifficultyTier(subject, difficulty);
  const slots = {
    tierPrefix: tier?.prefix || null,
    variationPrefix: variation?.prefix || null,
    name: subject.name,
    variationSuffix: variation?.suffix || null,
    tierSuffix: tier?.suffix || null,
  };

  const subjectString = SUBJECT_SLOT_ORDER.map((slot) => slots[slot])
    .filter(Boolean)
    .join(" ");

  return `${action.phrase} ${subjectString}`;
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
  const [regionSnap, missionSubjectsSnap, missionActionsSnap, chainsSnap] = await Promise.all([
    regionRef.get(),
    db.collection("worldData").doc("missionSubjects").collection("items").get(),
    db.collection("worldData").doc("missionActions").collection("items").get(),
    db.collection("worldData").doc("questChains").collection("items").get(),
  ]);

  const region = regionSnap.exists ? { id: regionSnap.id, ...regionSnap.data() } : null;
  const missionSubjects = missionSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const missionActions = missionActionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chains = chainsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { region, missionSubjects, missionActions, chains };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { region, missionSubjects, missionActions, chains } = context;

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
