// Core mechanic behind the artisanat (crafting) handler (functions/src/actions/artisanat.js):
// given a recette's ingredients and the quantities the character currently owns of each, decide
// whether the craft succeeds, and if so, turn the recette's results into a flat list of produced
// objects - one entry per unit, mirroring how recolte.js/mission.js turn a loot draw into one
// Instance per entry rather than a single {objectId, qty} pair.

function hasIngredients({ recette, ownedQuantities }) {
  return (recette.ingredients || []).every(
    (ingredient) => (ownedQuantities[ingredient.objectId] || 0) >= ingredient.qty
  );
}

function craftResults(recette) {
  const produced = [];
  for (const result of recette.results || []) {
    for (let i = 0; i < result.qty; i++) {
      produced.push({ objectId: result.objectId });
    }
  }
  return produced;
}

module.exports = { hasIngredients, craftResults };
