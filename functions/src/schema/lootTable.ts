// Canonical contract for `worldData/lootTables/items/{tableId}`: a weighted pool of objects an
// action can draw from. Selected by matching the table's rarity and tagIds against the action's
// (recolte: actionType.rarity + actionType.lootTagIds; partirEnQuete: the objective's rarity plus
// the quest/objective tagIds), then drawn from by functions/src/lib/loot.js's drawLootTableItemId -
// mirrored client-side in src/lib/lootTables.js.
//
// Authored through src/components/creator/TablesDeTirageManager.jsx, which writes the whole
// document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/lootTable.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { LootTableDocumentSchema, DEFAULTS } from "../../../shared/schema/lootTable";
export type { LootTableDocument } from "../../../shared/schema/lootTable";
