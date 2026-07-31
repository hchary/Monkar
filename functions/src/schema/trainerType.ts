// Canonical contract for `worldData/trainerTypes/items/{trainerTypeId}`: the kind of trainer a
// trainable talent requires, referenced by talent.trainerTypeId. Authored through
// src/components/creator/TrainerTypesManager.jsx.
//
// Deliberately a stub - the full component (description, region, availability) is specified under
// "Entraîneurs" in docs/TODO.md and not implemented yet.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/trainerType.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { TrainerTypeDocumentSchema } from "../../../shared/schema/trainerType";
export type { TrainerTypeDocument } from "../../../shared/schema/trainerType";
