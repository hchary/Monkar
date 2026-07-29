const { drawLootTableItemId } = require("./loot");

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

// The core mechanic behind any harvest-type action (not implemented yet - see
// docs/TODO.md): draw baseQuantity*modifier items uniformly at random from a single loot
// table, one draw at a time via drawLootTableItemId so duplicates are just repeated ids
// in the returned array. A harvest action's resolve() would call this and turn the
// result into Instance documents, the same way partirEnQuete.js's commit() does.
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
