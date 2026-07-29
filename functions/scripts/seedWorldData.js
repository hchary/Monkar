// One-off admin script: node scripts/seedWorldData.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
// Populates example regions, region-specific backgrounds, and one actionType.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

async function seed() {
  const coastRegionRef = db.collection("worldData").doc("regions").collection("items").doc("cote-des-brumes");
  await coastRegionRef.set({
    name: "Côte des Brumes",
    nameSuggestions: ["Aldric", "Maren", "Yseult", "Corentin"],
  });

  await coastRegionRef.collection("backgrounds").doc("pecheur").set({
    name: "Pêcheur",
    profession: "Pêcheur",
    reputationStart: 0,
    startingGold: 10,
    startingItems: [{ name: "Filet de pêche", qty: 1 }],
    weight: 60,
  });

  await coastRegionRef.collection("backgrounds").doc("marin-deserteur").set({
    name: "Marin déserteur",
    profession: "Marin",
    reputationStart: -5,
    startingGold: 25,
    startingItems: [{ name: "Dague rouillée", qty: 1 }],
    weight: 40,
  });

  const forestRegionRef = db.collection("worldData").doc("regions").collection("items").doc("foret-de-sylvenoire");
  await forestRegionRef.set({
    name: "Forêt de Sylvenoire",
    nameSuggestions: ["Elowen", "Fenrick", "Sylas", "Briar"],
  });

  await forestRegionRef.collection("backgrounds").doc("bucheron").set({
    name: "Bûcheron",
    profession: "Bûcheron",
    reputationStart: 0,
    startingGold: 15,
    startingItems: [{ name: "Hache", qty: 1 }],
    weight: 70,
  });

  await forestRegionRef.collection("backgrounds").doc("garde-foret").set({
    name: "Garde-forêt",
    profession: "Garde-forêt",
    reputationStart: 5,
    startingGold: 20,
    startingItems: [{ name: "Arc court", qty: 1 }],
    weight: 30,
  });

  // Predates the action framework's handlerId/kindId fields entirely, and is not kept in step
  // with them - live actionTypes/items/partir-en-quete is edited through ActionsManager instead.
  // The tiers array this used to seed (a per-tier weighted death/wound/gold/reputation roll) is
  // gone: partirEnQuete.js's own handler decides the quest's outcome now - see "Abandoning the
  // paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md.
  const actionTypesRef = db.collection("worldData").doc("actionTypes").collection("items");
  await actionTypesRef.doc("partir-en-quete").set({
    label: "Partir en quête",
  });

  console.log("World data seeded successfully.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
