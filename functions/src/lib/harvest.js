const { drawLootTableItemId } = require("./loot");

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

// The core mechanic behind a Récolte action (functions/src/actions/recolte.js - see
// docs/TODO.md): draw baseQuantity*modifier items uniformly at random from a single loot
// table, one draw at a time via drawLootTableItemId so duplicates are just repeated ids
// in the returned array. recolte.js's resolve() calls this and turns the result into
// Instance documents on commit(), the same way mission.js/partirExplorer.js do for their own loot.
function harvestFromLootTable({ lootTable, baseQuantity, modifier = 1 }) {
  if (!isPositiveInteger(baseQuantity)) {
    throw new Error("baseQuantity must be a positive integer");
  }
  if (!isPositiveInteger(modifier)) {
    throw new Error("modifier must be a positive integer");
  }

  const count = baseQuantity * modifier;
  const items = [];
  for (let i = 0; i < count; i++) {
    const objectId = drawLootTableItemId(lootTable);
    if (objectId) items.push(objectId);
  }
  return items;
}

module.exports = { harvestFromLootTable };
