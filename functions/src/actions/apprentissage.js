// Handler for every Apprentissage action (functions/src/lib/actionKinds.js's
// PROFESSION_LEARNING_ACTION_KIND_ID), registered once under the shared "apprentissage" handlerId
// - same "one handler, several action documents" convention as sEntrainer.js/artisanat.js, since
// a game can have several such actions (one per trainer type / location).
//
// Grants a character its first profession (docs/TODO.md "Profession (métier) creation" - "Still
// open: how a character is first assigned a profession via a quest or a trainer"). Only the
// trainer path is built here: assignment at character creation, from the drawn origin's linked
// profession, already exists in createCharacter (functions/src/index.ts); a quest-driven grant
// was deliberately left out of this pass.
//
// Always succeeds once its preconditions are met (reachability - enforced upstream by the
// implicit trainerReachable condition; not already practising a profession - enforced upstream by
// the implicit professionless condition; the picked profession actually taught at this trainer
// type), same precondition-gated, not chance-gated convention as sEntrainer.js/artisanat.js.
//
// The player picks the profession client-side (ProfessionPicker.jsx only ever offers professions
// whose trainerTypeIds includes this action's own trainerTypeId), but every one of those facts is
// re-checked here as the authority, never trusted from the client - same convention as
// sEntrainer.js's talentId.
//
// Catalog-side validation (is this profession actually taught here?) happens once in prepare(),
// since worldData/professions/items is creator content, not player-mutable state - same asymmetry
// as sEntrainer.js's talent catalog check. Player-mutable state (whether the character still has
// no profession) is re-read fresh in resolve() from the transactionally re-read character, never
// trusted from prepare()'s pre-transaction snapshot.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { withProfessionChange } = require("../lib/professions");

async function prepare({ db, character, actionType, payload }) {
  if (character.professionId) {
    throw new HttpsError("failed-precondition", "Vous exercez déjà un métier.");
  }

  const professionId = payload?.professionId;
  if (!professionId) throw new HttpsError("invalid-argument", "professionId is required.");

  const professionSnap = await db.collection("worldData").doc("professions").collection("items").doc(professionId).get();
  if (!professionSnap.exists) throw new HttpsError("not-found", "Métier introuvable dans le catalogue.");
  const profession = professionSnap.data();

  if (!(profession.trainerTypeIds || []).includes(actionType.trainerTypeId || "")) {
    throw new HttpsError("failed-precondition", "Ce métier ne s'apprend pas auprès de ce type d'entraîneur.");
  }

  return { professionId, professionName: profession.name };
}

async function resolve({ character, actionTypeId, today, context }) {
  if (character.professionId) {
    throw new HttpsError("failed-precondition", "Vous exercez déjà un métier.");
  }

  const { professionId, professionName } = context;
  const professionUpdate = withProfessionChange(character, professionId, 1);

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      ...professionUpdate,
      // Kept in step with the origin-driven grant in createCharacter, which sets both fields
      // together - see docs/TODO.md "Character link"'s note on reconciling character.profession
      // (legacy free-text) with professionId.
      profession: professionName,
      lastAction: {
        actionTypeId,
        date: today,
        success: true,
        narrativeText: `Vous apprenez désormais le métier de ${professionName}.`,
        professionId,
        professionName,
      },
    },
    logFields: {
      success: true,
      professionId,
    },
  };
}

module.exports = { prepare, resolve };
