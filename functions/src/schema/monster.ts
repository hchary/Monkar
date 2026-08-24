// Canonical contract for `worldData/monsters/items/{monsterId}`: the bestiary mission generation
// draws its target from, replacing the retired missionSubject/missionAction pair (docs/TODO.md
// "Area and Monster contracts"). Authored through src/components/creator/MonstersManager.jsx,
// which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field. It is also what missionJournal[].
// targetMonsterId, character.triggeredMonsterIds and questChain.steps[].monsterId store.
//
// Documents form a prototypal inheritance tree through `parentId`, resolved at read time by
// functions/src/lib/monsters.js's resolveMonster - array fields concatenate down the chain, scalar
// fields take the first non-null. Nothing flattens the tree in Firestore.
//
// The field contract itself lives in shared/schema/monster.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema convention
// expects, carrying the collection-level documentation above.
export { MonsterDocumentSchema, DEFAULTS } from "../../../shared/schema/monster";
export type { MonsterDocument } from "../../../shared/schema/monster";
