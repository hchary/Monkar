// Canonical contract for `worldData/recettes/items/{recetteId}`: a crafting recipe resolved by the
// "artisanat" action handler (functions/src/actions/artisanat.js), which consumes one Instance per
// unit of each ingredient and creates one Instance per unit of each result. Authored through
// src/components/creator/RecettesManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/recette.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { RecetteDocumentSchema, DEFAULTS } from "../../../shared/schema/recette";
export type { RecetteDocument } from "../../../shared/schema/recette";
