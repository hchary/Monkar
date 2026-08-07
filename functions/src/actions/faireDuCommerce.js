// Handler for the "Faire du commerce" action (docs/TODO.md "Intermède actions"), registered under
// the shared "faireDuCommerce" handlerId - same "one handler, several action documents" convention
// as sEntrainer.js/apprentissage.js, since a game can eventually have several commerce actions
// (one per market/location).
//
// Scoped to selling only, per the spec - buying would need an NPC/shop pricing catalog that
// doesn't exist and isn't part of this pass. The player sells one owned Instance for gold.
//
// Its kind ("commerce", under "intermede" in actionKinds.js) is one of the kinds
// actionUsesIntermedeBudget recognizes, so functions/src/lib/actionPipeline.js skips both the
// once-per-Interval lock check and the stampLifecycle/lastAction envelope for it entirely: this
// handler never writes lastAction, resolves instantly, and can run again immediately, up to the
// shared character.intermedeActionsThisInterval cap of 3 - independent of whatever the character's
// main action is doing. Since there is no lastAction-driven result pop-up for it, the confirmation
// the player sees is threaded back through performAction's own return value (see `response` below
// and actionPipeline.js's threading of it) rather than through the character document.
//
// Catalog-side validation (does this instance/object exist, does it belong to this character)
// happens once in prepare() from a plain (non-transactional) read, since the object catalog is
// creator content - same asymmetry as sEntrainer.js's talent catalog check. The instance itself is
// player-mutable state (it could be sold twice in a race, or already gone), so its ownership is
// re-checked fresh in resolve() via a transactional read right before it's deleted.

const { HttpsError } = require("firebase-functions/v2/https");
const { salePrice } = require("../lib/salePrice");

async function prepare({ db, characterId, payload }) {
  const instanceId = payload?.instanceId;
  if (!instanceId) throw new HttpsError("invalid-argument", "instanceId is required.");

  const instanceSnap = await db.collection("instances").doc(instanceId).get();
  if (!instanceSnap.exists) throw new HttpsError("not-found", "Objet introuvable.");
  const instance = instanceSnap.data();
  if (instance.characterId !== characterId) {
    throw new HttpsError("failed-precondition", "Cet objet ne vous appartient pas.");
  }

  const objectSnap = await db.collection("worldData").doc("objects").collection("items").doc(instance.objectId).get();
  if (!objectSnap.exists) throw new HttpsError("not-found", "Objet introuvable dans le catalogue.");

  return { instanceId, object: { id: objectSnap.id, ...objectSnap.data() } };
}

async function resolve({ tx, db, character, characterId, context }) {
  const { instanceId, object } = context;

  // Re-validated here as the authority - the client-side availability check is UX, never trusted.
  const usedThisInterval = character.intermedeActionsThisInterval || 0;
  if (usedThisInterval >= 3) {
    throw new HttpsError(
      "failed-precondition",
      "Vous avez déjà effectué vos 3 actions d'Intermède pour cet Interval."
    );
  }

  const instanceRef = db.collection("instances").doc(instanceId);
  const instanceSnap = await tx.get(instanceRef);
  if (!instanceSnap.exists || instanceSnap.data().characterId !== characterId) {
    throw new HttpsError("failed-precondition", "Cet objet ne vous appartient plus.");
  }

  const price = salePrice(object);
  tx.delete(instanceRef);

  return {
    updates: {
      gold: (character.gold || 0) + price,
      intermedeActionsThisInterval: usedThisInterval + 1,
    },
    logFields: {
      success: true,
      objectId: object.id,
      goldGained: price,
    },
    response: {
      objectName: object.name,
      goldGained: price,
    },
  };
}

module.exports = { prepare, resolve };
