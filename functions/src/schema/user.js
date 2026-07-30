// Canonical contract for the top-level `users` collection, keyed by the player's auth uid: the
// account-level record, as opposed to `characters` which holds the in-game persona.
//
// Written only by createCharacter (functions/src/index.js) with merge:true. firestore.rules lets a
// signed-in user read and create their own document but never update or delete it, so `role` cannot
// be self-granted from the client.
//
// The document id IS the auth uid, never a field.

const FIELDS = {
  role: {
    type: "string",
    description:
      "Always \"player\" today - the only value any writer sets, and the only one firestore.rules lets a " +
      "client create. Creator access does NOT come from this field: functions/scripts/setCreatorRole.js " +
      "sets an auth custom claim, which is what firestore.rules' isCreator() actually checks, and it never " +
      "touches this document.",
  },
  characterId: {
    type: "string",
    description: "Id in `characters` of the character created most recently for this user.",
  },
};

const DEFAULTS = {
  role: "player",
};

module.exports = { FIELDS, DEFAULTS };
