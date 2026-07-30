// Canonical contract for `worldData/trainerTypes/items/{trainerTypeId}`: the kind of trainer a
// trainable talent requires, referenced by talent.trainerTypeId. Authored through
// src/components/creator/TrainerTypesManager.jsx.
//
// Deliberately a stub - the full component (description, region, availability) is specified under
// "Entraîneurs" in docs/TODO.md and not implemented yet.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Trainer type display name, e.g. \"Maître d'armes\"." },
};

module.exports = { FIELDS };
