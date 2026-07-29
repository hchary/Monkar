// Handler for the crafting mechanic. Given a recette, consumes its ingredients from the
// character's inventory (the instances collection) and produces its results into that same
// inventory. Unlike recolte.js/partirEnQuete.js there is no deferred prepare/resolve/commit
// split: crafting is a single immediate operation, so this only exports craft(), meant to run
// inside a Firestore transaction. Wiring an actual "artisanat" action up to this handler is out
// of scope here - see the "Ajoût handler action d'artisanat" feature request.
//
// An insufficient ingredient makes the whole craft fail atomically: nothing is consumed and an
// empty list is returned, rather than partially consuming what was available.

const { hasIngredients, craftResults } = require("../lib/crafting");

async function craft({ tx, db, characterId, uid, today, recette }) {
  const ingredients = recette.ingredients || [];

  const instancesByObjectId = {};
  const ownedQuantities = {};
  for (const ingredient of ingredients) {
    const snap = await tx.get(
      db
        .collection("instances")
        .where("characterId", "==", characterId)
        .where("objectId", "==", ingredient.objectId)
    );
    instancesByObjectId[ingredient.objectId] = snap.docs;
    ownedQuantities[ingredient.objectId] = snap.docs.length;
  }

  if (!hasIngredients({ recette, ownedQuantities })) return [];

  for (const ingredient of ingredients) {
    const docs = instancesByObjectId[ingredient.objectId];
    for (let i = 0; i < ingredient.qty; i++) {
      tx.delete(docs[i].ref);
    }
  }

  const results = craftResults(recette);
  for (const item of results) {
    const instanceRef = db.collection("instances").doc();
    tx.set(instanceRef, {
      objectId: item.objectId,
      characterId,
      ownerUid: uid,
      acquisitionDate: today,
      condition: "neuf",
      description: "",
    });
  }

  return results;
}

module.exports = { craft };
