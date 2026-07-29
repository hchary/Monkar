const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { runActionPipeline } = require("./lib/actionPipeline");
const { isActionRunning, isActionAcknowledged, actionCompletesAtMillis, toMillis, HOUR_MS } = require("./lib/actionLifecycle");
const { withProfessionChange, knownLevel } = require("./lib/professions");
const { DEFAULTS: CHARACTER_DEFAULTS } = require("./schema/character");
const partirEnQuete = require("./actions/partirEnQuete");
const recolte = require("./actions/recolte");
const artisanat = require("./actions/artisanat");

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Every callable that acts on "the caller's own character" (rather than one named by id) resolves
// it the same way: the one living character owned by this uid, same query runActionPipeline uses.
async function getOwnCharacterSnap(uid) {
  const charSnap = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No living character found for this user.");
  return charSnap.docs[0];
}

// A handler is the escape hatch for an action whose mechanics don't fit the generic tier
// roller (see functions/src/lib/actionPipeline.js) - drawing a quest, picking a trainer, and
// so on. Keyed by handlerId (worldData/actionTypes/items/{id}.handlerId), not by the action
// type's own document id, so an action can be renamed or duplicated without a code change
// (docs/ISSUE-02-ACTION-FRAMEWORK.md D13).
const ACTION_HANDLERS = {
  partirEnQuete,
  recolte,
  artisanat,
};

exports.createCharacter = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { regionId, name } = request.data;
  if (!regionId || !name) throw new HttpsError("invalid-argument", "regionId and name are required.");

  const existingAlive = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (!existingAlive.empty) {
    throw new HttpsError("already-exists", "You already have a living character.");
  }

  const regionRef = db.collection("worldData").doc("regions").collection("items").doc(regionId);
  const regionSnap = await regionRef.get();
  if (!regionSnap.exists) throw new HttpsError("not-found", "Unknown region.");
  const region = regionSnap.data();

  const originsSnap = await db.collection("worldData").doc("origins").collection("items").get();
  // Valid = restricted to (among others) this region, or unrestricted (no regionIds at all).
  const validOrigins = originsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => !o.regionIds?.length || o.regionIds.includes(regionId));
  if (validOrigins.length === 0) {
    throw new HttpsError("failed-precondition", "This region has no valid origins configured.");
  }
  const origin = validOrigins[Math.floor(Math.random() * validOrigins.length)];

  const today = todayUTC();

  const talentIds = origin.talentIds || [];
  const talentSnaps = talentIds.length
    ? await db.getAll(...talentIds.map((id) => db.collection("worldData").doc("talents").collection("items").doc(id)))
    : [];
  const talentsGranted = talentSnaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const talent = snap.data();
      return {
        id: snap.id,
        name: talent.name,
        quality: 1,
        trainable: !!talent.trainable,
        rarity: talent.rarity || "commun",
        effect: talent.effect || "",
        tagIds: talent.tagIds || [],
        lastChangeDate: today,
        lastChangeCircumstance: `Origine : ${origin.name}`,
      };
    });

  const itemIds = origin.startingItemIds || [];
  const itemSnaps = itemIds.length
    ? await db.getAll(...itemIds.map((id) => db.collection("worldData").doc("objects").collection("items").doc(id)))
    : [];
  const itemsGranted = itemSnaps.filter((snap) => snap.exists).map((snap) => ({ id: snap.id, ...snap.data() }));

  const characterRef = db.collection("characters").doc();
  await characterRef.set({
    ...CHARACTER_DEFAULTS,
    ownerUid: uid,
    name,
    region: { id: regionId, name: region.name },
    origin: {
      id: origin.id,
      name: origin.name,
      description: origin.description || "",
      profession: origin.profession || "",
      reputationStart: origin.reputationStart || 0,
      talents: talentsGranted.map((t) => ({ id: t.id, name: t.name })),
      items: itemsGranted.map((item) => ({ id: item.id, name: item.name })),
    },
    profession: origin.profession || "",
    reputation: origin.reputationStart || 0,
    talents: talentsGranted,
    createdAt: FieldValue.serverTimestamp(),
  });

  for (const item of itemsGranted) {
    await db.collection("instances").doc().set({
      objectId: item.id,
      characterId: characterRef.id,
      ownerUid: uid,
      acquisitionDate: today,
      condition: "neuf",
      description: item.description || "",
    });
  }

  await db.collection("users").doc(uid).set({ role: "player", characterId: characterRef.id }, { merge: true });

  return { characterId: characterRef.id };
});

exports.performAction = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { actionTypeId, recetteId } = request.data;
  if (!actionTypeId) throw new HttpsError("invalid-argument", "actionTypeId is required.");

  await runActionPipeline({
    db,
    uid,
    actionTypeId,
    actionHandlers: ACTION_HANDLERS,
    today: todayUTC(),
    payload: { recetteId },
  });

  return { ok: true };
});

// Closes the loop on a finished action: runs whatever the action deferred until the player
// actually saw the result (a quest's rolled loot becomes Instance documents, see
// partirEnQuete.commit), then marks it acknowledged so the result pop-up doesn't reopen and
// re-clicking "Fermer" can't duplicate anything.
//
// Deferring the commit is deliberate: the outcome is fixed the moment the action resolves, but
// nothing lands in the character's inventory until they have been shown what they got. Replaces
// the quest-specific claimQuestLoot - every action gets the same acknowledgement mechanism, and
// the per-action side effect is the handler's commit() hook.
exports.acknowledgeAction = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterRef = (await getOwnCharacterSnap(uid)).ref;

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const character = characterDoc.data();
    const lastAction = character.lastAction;
    if (!lastAction) throw new HttpsError("failed-precondition", "No action result to acknowledge.");

    // Idempotent: the pop-up can be closed twice (two tabs, a retried call) without committing
    // the same loot twice.
    if (isActionAcknowledged(character)) return;

    // The result is only revealed once the action has run its course; acknowledging it before
    // then would materialize the loot early.
    if (isActionRunning(character, Date.now())) {
      throw new HttpsError("failed-precondition", "This action has not finished yet.");
    }

    const handler = ACTION_HANDLERS[lastAction.handlerId];
    if (handler?.commit) {
      await handler.commit({ tx, db, characterRef, character, lastAction, uid, today: todayUTC() });
    }

    tx.update(characterRef, { "lastAction.acknowledged": true });
  });

  return { ok: true };
});

// Dismisses the origin intro dialog once, permanently - moved server-side alongside every other
// characters write once firestore.rules stopped letting a player update: their own doc directly.
exports.acknowledgeOriginIntro = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterRef = (await getOwnCharacterSnap(uid)).ref;
  await characterRef.update({ originIntroSeen: true });

  return { ok: true };
});

// Switches the active profession to one the character already knows (or has known before),
// upserting the previously-active one into knownProfessions first (see
// functions/src/lib/professions.js's withProfessionChange). `level` is deliberately not a
// parameter here: it is looked up from the character's own data, since this endpoint only ever
// switches between professions already held, never grants progress in one it doesn't.
exports.switchKnownProfession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { professionId } = request.data;
  if (!professionId) throw new HttpsError("invalid-argument", "professionId is required.");

  const characterSnap = await getOwnCharacterSnap(uid);
  const character = characterSnap.data();

  if (professionId === character.professionId) return { ok: true };

  const level = knownLevel(character, professionId);
  if (level == null) throw new HttpsError("failed-precondition", "This character has never held that profession.");

  await characterSnap.ref.update(withProfessionChange(character, professionId, level));

  return { ok: true };
});

// TEST-ONLY: backdates the caller's own running action by 24h so it completes immediately,
// rather than clearing the lock outright (the countdown and result dialog both read completesAt).
// Was a direct client updateDoc before firestore.rules locked characters writes to isCreator()
// only; kept as a callable so the dev workflow it supports still works.
// TODO: remove before the game goes live to real players.
exports.debugAdvanceTime = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterSnap = await getOwnCharacterSnap(uid);
  const character = characterSnap.data();

  const completesAt = actionCompletesAtMillis(character);
  if (completesAt == null) return { ok: true };

  const shift = 24 * HOUR_MS;
  const startedAt = toMillis(character.lastAction?.startedAt ?? character.lastActionAt);
  const patch = { "lastAction.completesAt": Timestamp.fromMillis(completesAt - shift) };
  if (startedAt != null) patch["lastAction.startedAt"] = Timestamp.fromMillis(startedAt - shift);

  await characterSnap.ref.update(patch);

  return { ok: true };
});
