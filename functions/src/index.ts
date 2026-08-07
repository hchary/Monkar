import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
const { runActionPipeline } = require("./lib/actionPipeline");
const { sweepQuestTriggers } = require("./lib/questTriggers");
const {
  isActionRunning,
  isActionAcknowledged,
  actionCompletesAtMillis,
  toMillis,
  HOUR_MS,
} = require("./lib/actionLifecycle");
const { withProfessionChange, knownLevel } = require("./lib/professions");
import { withAuthAndSchema } from "./lib/callableHandler";
import { CharacterDocumentSchema, DEFAULTS as CHARACTER_DEFAULTS } from "./schema/character";
const recolte = require("./actions/recolte");
const artisanat = require("./actions/artisanat");
const recherche = require("./actions/recherche");
const mission = require("./actions/mission");
const sEntrainer = require("./actions/sEntrainer");
const apprentissage = require("./actions/apprentissage");
const partirExplorer = require("./actions/partirExplorer");
const faireDuCommerce = require("./actions/faireDuCommerce");

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Every callable that acts on "the caller's own character" (rather than one named by id) resolves
// it the same way: the one living character owned by this uid, same query runActionPipeline uses.
async function getOwnCharacterSnap(uid: string) {
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
// roller (see functions/src/lib/actionPipeline.js) - drawing a mission, picking a trainer, and
// so on. Keyed by handlerId (worldData/actionTypes/items/{id}.handlerId), not by the action
// type's own document id, so an action can be renamed or duplicated without a code change
// (docs/ISSUE-02-ACTION-FRAMEWORK.md D13). "partirEnQuete" is retired (docs/TODO.md "Retiring
// quests and quest objectives for the subject-action system") - any worldData/actionTypes/items
// document still authored with that handlerId needs disabling (enabled: false) or deleting by
// hand in the Firestore console.
const ACTION_HANDLERS: Record<string, any> = {
  recolte,
  artisanat,
  recherche,
  mission,
  sEntrainer,
  apprentissage,
  partirExplorer,
  faireDuCommerce,
};

const CreateCharacterInput = z.object({
  regionId: z.string().min(1, "regionId is required."),
  name: z.string().min(1, "name is required."),
});

exports.createCharacter = onCall(
  withAuthAndSchema(CreateCharacterInput, async ({ uid, data }) => {
    const { regionId, name } = data;

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
    const region: any = regionSnap.data();

    const originsSnap = await db.collection("worldData").doc("origins").collection("items").get();
    // Valid = restricted to (among others) this region, or unrestricted (no regionIds at all).
    const validOrigins = originsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as any)
      .filter((o) => !o.regionIds?.length || o.regionIds.includes(regionId));
    if (validOrigins.length === 0) {
      throw new HttpsError("failed-precondition", "This region has no valid origins configured.");
    }
    const origin = validOrigins[Math.floor(Math.random() * validOrigins.length)];

    const today = todayUTC();

    const talentIds: string[] = origin.talentIds || [];
    const talentSnaps = talentIds.length
      ? await db.getAll(...talentIds.map((id) => db.collection("worldData").doc("talents").collection("items").doc(id)))
      : [];
    const talentsGranted = talentSnaps
      .filter((snap) => snap.exists)
      .map((snap) => {
        const talent: any = snap.data();
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

    const itemIds: string[] = origin.startingItemIds || [];
    const itemSnaps = itemIds.length
      ? await db.getAll(...itemIds.map((id) => db.collection("worldData").doc("objects").collection("items").doc(id)))
      : [];
    const itemsGranted = itemSnaps.filter((snap) => snap.exists).map((snap) => ({ id: snap.id, ...(snap.data() as any) }));

    // origin.profession is a worldData/professions/items id (OriginsManager's "Métier associé"
    // picker), not a display name - resolve it here so it's granted the same way as talents/items
    // (id + name snapshot) instead of leaking the raw id into origin.profession/character.profession.
    const professionSnap = origin.profession
      ? await db.collection("worldData").doc("professions").collection("items").doc(origin.profession).get()
      : null;
    const professionGranted = professionSnap?.exists
      ? { id: professionSnap.id, name: (professionSnap.data() as any).name }
      : null;

    const characterRef = db.collection("characters").doc();
    const characterDoc = {
      ...CHARACTER_DEFAULTS,
      ownerUid: uid,
      name,
      region: { id: regionId, name: region.name },
      origin: {
        id: origin.id,
        name: origin.name,
        description: origin.description || "",
        profession: professionGranted,
        reputationStart: origin.reputationStart || 0,
        talents: talentsGranted.map((t) => ({ id: t.id, name: t.name })),
        items: itemsGranted.map((item) => ({ id: item.id, name: item.name })),
      },
      profession: professionGranted?.name || "",
      // The profession granted by the origin becomes the character's active profession from the
      // start, mirroring what switchKnownProfession does on a later switch (functions/src/lib/
      // professions.js's withProfessionChange) - level 1, and already present in knownProfessions
      // so a later switch away and back doesn't need special-casing.
      ...(professionGranted && {
        professionId: professionGranted.id,
        professionLevel: 1,
        knownProfessions: [{ professionId: professionGranted.id, level: 1 }],
      }),
      reputation: origin.reputationStart || 0,
      talents: talentsGranted,
      createdAt: FieldValue.serverTimestamp(),
    };

    // Validated as a safety net right at the write boundary - catches a typo'd/mistyped field in
    // this handler itself, not just malformed caller input (which withAuthAndSchema already
    // rejected above).
    await characterRef.set(CharacterDocumentSchema.parse(characterDoc));

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
  })
);

exports.performAction = onCall(async (request: any) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { actionTypeId, recetteId, missionId, talentId, professionId, instanceId } = request.data;
  if (!actionTypeId) throw new HttpsError("invalid-argument", "actionTypeId is required.");

  const { response } = await runActionPipeline({
    db,
    uid,
    actionTypeId,
    actionHandlers: ACTION_HANDLERS,
    today: todayUTC(),
    payload: { recetteId, missionId, talentId, professionId, instanceId },
  });

  // Intermède-budget actions (docs/TODO.md "Intermède actions") never write lastAction, so they
  // have no result pop-up to read a confirmation from - the handler's response is echoed straight
  // back to the caller instead. Every other handler leaves this undefined, so { ok: true } is
  // unchanged for them.
  return response ? { ok: true, response } : { ok: true };
});

// Closes the loop on a finished action: runs whatever the action deferred until the player
// actually saw the result (a mission's rolled loot becomes Instance documents, see
// mission.commit), then marks it acknowledged so the result pop-up doesn't reopen and re-clicking
// "Fermer" can't duplicate anything.
//
// Deferring the commit is deliberate: the outcome is fixed the moment the action resolves, but
// nothing lands in the character's inventory until they have been shown what they got. Replaces
// the quest-specific claimQuestLoot - every action gets the same acknowledgement mechanism, and
// the per-action side effect is the handler's commit() hook.
exports.acknowledgeAction = onCall(async (request: any) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterRef = (await getOwnCharacterSnap(uid)).ref;

  await db.runTransaction(async (tx: any) => {
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
exports.acknowledgeOriginIntro = onCall(async (request: any) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterRef = (await getOwnCharacterSnap(uid)).ref;
  await characterRef.update({ originIntroSeen: true });

  return { ok: true };
});

const SwitchKnownProfessionInput = z.object({
  professionId: z.string().min(1, "professionId is required."),
});

// Switches the active profession to one the character already knows (or has known before),
// upserting the previously-active one into knownProfessions first (see
// functions/src/lib/professions.js's withProfessionChange). `level` is deliberately not a
// parameter here: it is looked up from the character's own data, since this endpoint only ever
// switches between professions already held, never grants progress in one it doesn't.
exports.switchKnownProfession = onCall(
  withAuthAndSchema(SwitchKnownProfessionInput, async ({ uid, data }) => {
    const { professionId } = data;
    const characterSnap = await getOwnCharacterSnap(uid);
    const character = characterSnap.data();

    if (professionId === character.professionId) return { ok: true };

    const level = knownLevel(character, professionId);
    if (level == null) throw new HttpsError("failed-precondition", "This character has never held that profession.");

    await characterSnap.ref.update(withProfessionChange(character, professionId, level));

    return { ok: true };
  })
);

// TEST-ONLY: backdates the caller's own running action by 24h so it completes immediately,
// rather than clearing the lock outright (the countdown and result dialog both read completesAt).
// Was a direct client updateDoc before firestore.rules locked characters writes to isCreator()
// only; kept as a callable so the dev workflow it supports still works.
// TODO: remove before the game goes live to real players.
exports.debugAdvanceTime = onCall(async (request: any) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const characterSnap = await getOwnCharacterSnap(uid);
  const character = characterSnap.data();

  const completesAt = actionCompletesAtMillis(character);
  if (completesAt == null) return { ok: true };

  const shift = 24 * HOUR_MS;
  const startedAt = toMillis(character.lastAction?.startedAt ?? character.lastActionAt);
  const patch: Record<string, any> = { "lastAction.completesAt": Timestamp.fromMillis(completesAt - shift) };
  if (startedAt != null) patch["lastAction.startedAt"] = Timestamp.fromMillis(startedAt - shift);

  await characterSnap.ref.update(patch);

  return { ok: true };
});

// The first scheduled, non-request-triggered Cloud Function in the project (docs/TODO.md "Quest
// triggers and end-of-action pop-up pages") - every other mechanic resolves lazily on a player
// action instead. Ticks on fixed Interval boundaries (00:00 and 12:00 UTC), independent of any
// individual character's own completesAt clock, and sweeps every living character against every
// quest carrying a `trigger` (functions/src/lib/questTriggers.js). A newly triggered quest is
// surfaced on its own page in the end-of-action result pop-up the next time the player sees it
// (ActionResultDialog.jsx) - there is no separate notification push.
exports.sweepQuestTriggers = onSchedule({ schedule: "0 0,12 * * *", timeZone: "UTC" }, async () => {
  await sweepQuestTriggers({ db });
});
