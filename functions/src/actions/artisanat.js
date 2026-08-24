// Handler for every Artisanat action (functions/src/lib/actionKinds.js's CRAFTING_ACTION_KIND_ID),
// registered once under the shared "artisanat" handlerId - same convention as recolte.js, since a
// game can have several Artisanat actions (forge, alchimie...) all sharing this mechanic.
//
// Crafting always succeeds once its ingredients are confirmed present - this was the first handler
// to skip the weighted-paliers system entirely, before récolte/quête were rebuilt the same way (see
// "Abandoning the paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md) - so a missing/invalid
// recette throws a friendly precondition error instead of ever reaching a fail-tier. The player
// picks the recette client-side (CraftingTab.jsx only ever offers recettes the character knows and
// whose categoryIds overlaps the action's own recipeCategoryIds), but this is re-checked here as
// the authority, never trusted from the client.
//
// Ingredients are consumed immediately in resolve() - the same transaction that starts the action,
// so they leave the character's inventory the moment "Commencer" is clicked - while the produced
// results ride the ActionResult's `itemsGained` channel onto lastAction.loot and only turn into
// instances in commit(), once the player acknowledges the result pop-up. That split (consume at
// resolve, produce at commit) is the one difference from the crafting mechanic's original
// single-shot sketch (functions/src/lib/crafting.js's hasIngredients/craftResults, still reused
// here for the actual check and the flattening of results into one entry per unit).
//
// The consumed ingredients ride the `itemsLost` channel, which records them on the result rather
// than deleting anything: the deletion has to stay in this transaction, where the
// reads-before-writes ordering the instance query needs is available (docs/TODO.md "ActionResult
// and the single applier").

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { hasIngredients, craftResults } = require("../lib/crafting");
const { createActionResult, applyActionResult } = require("../lib/actionResult");

async function prepare({ db, character, actionType, payload }) {
  const recetteId = payload?.recetteId;
  if (!recetteId) throw new HttpsError("invalid-argument", "recetteId is required.");

  const knownRecipes = character.knownRecipes || [];
  if (!knownRecipes.includes(recetteId)) {
    throw new HttpsError("failed-precondition", "Cette recette n'est pas connue par ce personnage.");
  }

  const recetteSnap = await db.collection("worldData").doc("recettes").collection("items").doc(recetteId).get();
  if (!recetteSnap.exists) throw new HttpsError("not-found", "Recette introuvable.");
  const recette = { id: recetteSnap.id, ...recetteSnap.data() };

  const recipeCategoryIds = actionType.recipeCategoryIds || [];
  const matchesCategory = (recette.categoryIds || []).some((id) => recipeCategoryIds.includes(id));
  if (!matchesCategory) {
    throw new HttpsError("failed-precondition", "Cette recette n'appartient pas aux catégories de cette action.");
  }

  const objectsSnap = await db.collection("worldData").doc("objects").collection("items").get();
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { recette, objects };
}

async function resolve({ tx, db, character, characterRef, actionTypeId, today, context }) {
  const { recette, objects } = context;
  const ingredients = recette.ingredients || [];

  // All reads must happen before any write in a Firestore transaction - gathering every
  // ingredient's owned instances first, then deleting them below, keeps that order.
  const instancesByObjectId = {};
  const ownedQuantities = {};
  for (const ingredient of ingredients) {
    const snap = await tx.get(
      db
        .collection("instances")
        .where("characterId", "==", characterRef.id)
        .where("objectId", "==", ingredient.objectId)
    );
    instancesByObjectId[ingredient.objectId] = snap.docs;
    ownedQuantities[ingredient.objectId] = snap.docs.length;
  }

  if (!hasIngredients({ recette, ownedQuantities })) {
    throw new HttpsError("failed-precondition", "Ingrédients insuffisants pour cette recette.");
  }

  for (const ingredient of ingredients) {
    const docs = instancesByObjectId[ingredient.objectId];
    for (let i = 0; i < ingredient.qty; i++) tx.delete(docs[i].ref);
  }

  const results = craftResults(recette).map((item) => {
    const object = objects.find((o) => o.id === item.objectId);
    return {
      objectId: item.objectId,
      name: object?.name || item.objectId,
      rarity: object?.rarity || null,
      description: object?.description || "",
    };
  });

  const { updates: effects } = applyActionResult(
    character,
    createActionResult({
      itemsGained: results,
      itemsLost: ingredients.flatMap((ingredient) => Array(ingredient.qty).fill(ingredient.objectId)),
    }),
    { today, circumstance: `en fabriquant ${recette.name}` }
  );
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
        narrativeText: "Vous reposez vos outils et contemplez votre oeuvre.",
        recetteId: recette.id,
        recetteName: recette.name,
        ...effectSummary,
      },
    },
    logFields: {
      success: true,
      recetteId: recette.id,
      recetteName: recette.name,
      resultCount: results.length,
    },
  };
}

// Runs when the player closes the result pop-up ("Terminer" - see acknowledgeAction in
// functions/src/index.js) - turns the results frozen onto lastAction.loot during resolve() into
// Instance documents the character actually owns, identical in shape to recolte.js's commit().
async function commit({ tx, db, characterRef, lastAction, uid, today }) {
  // `craftResults` is the pre-ActionResult name of this list, kept as a read-time fallback so a
  // craft still running when that change deployed still materializes - same treatment
  // actionLifecycle.js gives the retired `lootClaimed` flag. Nothing writes it any more.
  for (const item of lastAction.loot || lastAction.craftResults || []) {
    const instanceRef = db.collection("instances").doc();
    tx.set(instanceRef, {
      objectId: item.objectId,
      characterId: characterRef.id,
      ownerUid: uid,
      acquisitionDate: today,
      condition: "neuf",
      description: item.description || "",
    });
  }
}

module.exports = { prepare, resolve, commit };
