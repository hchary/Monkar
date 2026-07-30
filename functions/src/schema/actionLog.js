// Canonical contract for the top-level `actionsLog` collection: one document per action a character
// performed, written inside performAction's transaction (functions/src/lib/actionPipeline.js).
// Append-only history - nothing updates or deletes a log entry.
//
// firestore.rules allows read on ownerUid (or any creator) and refuses every client write, so Cloud
// Functions (Admin SDK) are the sole writer.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  characterId: { type: "string", description: "Id in `characters` - who acted." },
  ownerUid: {
    type: "string",
    description: "Auth uid of the owning player. Denormalized from the character because the read rule needs it.",
  },
  actionTypeId: { type: "string", description: "Id in worldData/actionTypes/items - what was performed." },
  date: { type: "string", description: "YYYY-MM-DD (UTC) the action was started." },
  createdAt: { type: "timestamp" },
  // Everything past this point is the handler's own payload, spread onto the document by the
  // pipeline. There is no shared shape to document here: each handler decides what its logFields
  // carry - see the `logFields` returned by resolve() in functions/src/actions/*.js.
};

module.exports = { FIELDS };
