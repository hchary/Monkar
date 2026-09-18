import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { withAuthAndSchema } from "./lib/callableHandler";
import { CharacterDocumentSchema, DEFAULTS as CHARACTER_DEFAULTS } from "./schema/character";

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

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

    // origin.profession is a worldData/professions/items id, not a display name - resolve it here
    // so it's granted the same way as talents/items (id + name snapshot) instead of leaking the
    // raw id into origin.profession/character.profession.
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
