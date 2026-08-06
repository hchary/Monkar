// Handler for the "S'entraîner" action (docs/TODO.md "Trainers"), registered under the shared
// "sEntrainer" handlerId - like recolte.js/artisanat.js, a game can have several training actions
// (one per trainer type / location) all sharing this mechanic.
//
// Training always succeeds once its preconditions are met (reachability - enforced upstream by
// the implicit trainerReachable condition, see actionCatalog.js's resolveConditions - ownership of
// a trainable, not-yet-maxed talent matching this action's own trainerTypeId, and sufficient
// gold): there is no live weighted-tier roll left in the framework to gate a chance of failure on
// (see "Abandoning the paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md), so this follows
// artisanat.js's precedent - precondition-gated, not chance-gated - rather than the retired tiers
// system the original Trainers note assumed still existed.
//
// The player picks the talent client-side (TalentPicker.jsx only ever offers talents the
// character owns, that are trainable, not already at quality 5, and whose catalog entry's
// trainerTypeId matches this action's own), but every one of those facts is re-checked here as
// the authority, never trusted from the client - same convention as artisanat.js's recetteId.
//
// Catalog-side validation (does this talent train at this trainer type?) happens once in
// prepare(), since worldData/talents/items is creator content, not player-mutable state - same
// asymmetry as artisanat.js's recipeCategoryIds check. Player-mutable state (the owned talent's
// current quality, the character's gold) is re-read fresh in resolve() from the transactionally
// re-read character, never trusted from prepare()'s pre-transaction snapshot.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { bumpTalentQuality } = require("../lib/talentEvolution");
const { trainingCost } = require("../lib/trainingCost");

async function prepare({ db, character, actionType, payload }) {
  const talentId = payload?.talentId;
  if (!talentId) throw new HttpsError("invalid-argument", "talentId is required.");

  const ownedTalent = (character.talents || []).find((t) => t.id === talentId);
  if (!ownedTalent) throw new HttpsError("failed-precondition", "Ce talent n'est pas possédé par ce personnage.");
  if (!ownedTalent.trainable) throw new HttpsError("failed-precondition", "Ce talent n'est pas entraînable.");

  const catalogSnap = await db.collection("worldData").doc("talents").collection("items").doc(talentId).get();
  if (!catalogSnap.exists) throw new HttpsError("not-found", "Talent introuvable dans le catalogue.");
  const catalogTalent = catalogSnap.data();

  if ((catalogTalent.trainerTypeId || "") !== (actionType.trainerTypeId || "")) {
    throw new HttpsError("failed-precondition", "Ce talent ne s'entraîne pas auprès de ce type d'entraîneur.");
  }

  return {};
}

async function resolve({ character, actionType, actionTypeId, today, payload }) {
  const talentId = payload?.talentId;
  const talents = character.talents || [];
  const index = talents.findIndex((t) => t.id === talentId);
  if (index < 0) throw new HttpsError("failed-precondition", "Ce talent n'est pas possédé par ce personnage.");

  const talent = talents[index];
  if (!talent.trainable) throw new HttpsError("failed-precondition", "Ce talent n'est pas entraînable.");
  if ((talent.quality || 1) >= 5) {
    throw new HttpsError("failed-precondition", "Ce talent a déjà atteint sa qualité maximale.");
  }

  const cost = trainingCost(talent);
  if ((character.gold || 0) < cost) {
    throw new HttpsError("failed-precondition", "Or insuffisant pour cet entraînement.");
  }

  const evolved = bumpTalentQuality(talent, { today, circumstance: `Entraînement : ${actionType.label}` });
  const nextTalents = talents.map((t, i) => (i === index ? evolved : t));
  const talentEvolutions = [
    { talentId: evolved.id, name: evolved.name, kind: "evolution", quality: evolved.quality, rarity: evolved.rarity },
  ];

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      gold: (character.gold || 0) - cost,
      talents: nextTalents,
      lastAction: {
        actionTypeId,
        date: today,
        success: true,
        narrativeText: "Vous vous entraînez avec ardeur.",
        talentEvolutions,
        goldSpent: cost,
      },
    },
    logFields: {
      success: true,
      talentId: evolved.id,
      goldSpent: cost,
    },
  };
}

module.exports = { prepare, resolve };
