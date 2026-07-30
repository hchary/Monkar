// Canonical contract for the top-level `instances` collection: one document per physical item a
// character owns - the counterpart of worldData/objects/items, which describes the item TYPE.
// Quantity is not a field: owning three ropes means three Instance documents, which is what lets
// artisanat consume ingredients by deleting one document per unit.
//
// firestore.rules allows read on ownerUid and refuses every client write, so Cloud Functions
// (Admin SDK) are the sole writer. Created by createCharacter (origin starting items) and by the
// recolte / partirEnQuete / artisanat handlers' commit hooks; deleted by artisanat when an
// ingredient is consumed.
//
// Note for readers: a client query must filter on BOTH ownerUid and characterId - filtering on
// characterId alone cannot prove to Firestore that every match satisfies the ownerUid rule, so the
// whole query is denied (see src/components/InventoryTab.jsx).
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  objectId: { type: "string", description: "Id in worldData/objects/items - the item type this is an instance of." },
  characterId: { type: "string", description: "Id in `characters` - who holds it." },
  ownerUid: {
    type: "string",
    description: "Auth uid of the owning player. Denormalized from the character because the read rule needs it.",
  },
  acquisitionDate: { type: "string", description: "YYYY-MM-DD (UTC) the instance was obtained." },
  condition: {
    type: "string",
    description: "Wear state. Always \"neuf\" today - nothing degrades an instance yet.",
  },
  description: {
    type: "string",
    description:
      "Snapshot of the object's description at acquisition, so later catalog edits don't rewrite an " +
      "item the player already holds. Quest loot appends the clause describing how it was obtained " +
      "(see drawQuestLoot in functions/src/actions/partirEnQuete.js).",
  },
};

const DEFAULTS = {
  condition: "neuf",
};

module.exports = { FIELDS, DEFAULTS };
