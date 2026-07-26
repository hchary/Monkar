// One-off admin script: node scripts/seedWorldData.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
// Populates example regions, region-specific backgrounds, global traits, and one actionType.
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

  const traitsRef = db.collection("worldData").doc("traits").collection("items");
  await traitsRef.doc("robuste").set({
    name: "Robuste",
    description: "Un corps endurci par les épreuves.",
    bonuses: { force: 2 },
    weight: 40,
  });
  await traitsRef.doc("vif-esprit").set({
    name: "Vif d'esprit",
    description: "Toujours une longueur d'avance.",
    bonuses: { intelligence: 2 },
    weight: 30,
  });
  await traitsRef.doc("chanceux").set({
    name: "Chanceux",
    description: "La fortune lui sourit souvent.",
    bonuses: { charisme: 1, agilite: 1 },
    weight: 30,
  });

  const actionTypesRef = db.collection("worldData").doc("actionTypes").collection("items");
  await actionTypesRef.doc("partir-en-quete").set({
    label: "Partir en quête",
    tiers: [
      {
        name: "Catastrophe",
        weight: 5,
        success: false,
        narrativeText: "Une embuscade te laisse pour mort au bord du chemin.",
        consequence: { type: "death", description: "Tombé lors d'une embuscade." },
      },
      {
        name: "Échec",
        weight: 20,
        success: false,
        narrativeText: "La quête tourne court, tu rentres blessé.",
        consequence: { type: "wound", name: "Jambe foulée", description: "Une chute t'a laissé une entorse." },
      },
      {
        name: "Réussite",
        weight: 55,
        success: true,
        narrativeText: "Tu reviens victorieux, quelques pièces et un peu plus d'expérience en poche.",
        bonuses: { force: 1 },
        goldGain: 5,
        reputationGain: 1,
      },
      {
        name: "Exploit légendaire",
        weight: 20,
        success: true,
        narrativeText: "Un exploit dont on parlera dans toutes les tavernes de la région !",
        bonuses: { force: 2, charisme: 1 },
        goldGain: 15,
        itemGain: { name: "Trophée de chasse", qty: 1 },
        reputationGain: 5,
        legendary: true,
      },
    ],
  });

  console.log("World data seeded successfully.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
