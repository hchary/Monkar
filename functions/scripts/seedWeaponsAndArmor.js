// One-off admin script: node scripts/seedWeaponsAndArmor.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Populates worldData/objects/items with a catalog of weapons and armor pieces commonly found
// across fantasy settings (swords, axes, blunt weapons, polearms, ranged weapons, and light/
// medium/heavy armor including shields and helmets). Idempotent: re-running skips any object
// whose name already exists, and reuses/creates worldData/tags/items entries by name instead of
// duplicating tags.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

// name -> { description, type, rarity, tags: [tag names] }
// type is one of OBJECT_TYPES (src/components/creator/ObjectsManager.jsx): here only "arme" and
// "armure" are used. Tag names are resolved to worldData/tags/items ids at seed time.
const ITEMS = [
  // Armes de mêlée - tranchantes et perforantes
  {
    name: "Épée courte",
    description: "Une épée légère et maniable, appréciée pour sa rapidité au combat rapproché.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  {
    name: "Épée longue",
    description: "Une lame équilibrée, taillée pour trancher comme pour percer, à la portée généreuse.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  {
    name: "Épée à deux mains",
    description: "Une lame imposante qui exige les deux mains, capable de fendre une armure d'un seul coup.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Deux mains"],
  },
  {
    name: "Rapière",
    description: "Une lame fine et souple, conçue pour l'estoc et les duels rapides.",
    type: "arme",
    tags: ["Arme de mêlée", "Perforant", "Une main"],
  },
  {
    name: "Cimeterre",
    description: "Une lame courbe originaire des terres arides, redoutable en frappe glissée.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  {
    name: "Dague",
    description: "Une lame courte et discrète, aussi utile pour se défendre que pour trancher une corde.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Perforant", "Une main"],
  },
  {
    name: "Hachette",
    description: "Une petite hache à main, facile à lancer ou à glisser à la ceinture.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  {
    name: "Hache de guerre",
    description: "Une hache robuste conçue pour le combat, capable de briser un bouclier.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  {
    name: "Hache à deux mains",
    description: "Une hache massive qui fauche large, redoutable contre plusieurs adversaires.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Deux mains"],
  },
  // Armes contondantes
  {
    name: "Masse d'armes",
    description: "Une arme contondante à tête cloutée, efficace contre les armures lourdes.",
    type: "arme",
    tags: ["Arme de mêlée", "Contondant", "Une main"],
  },
  {
    name: "Marteau de guerre",
    description: "Un marteau renforcé dont le poids suffit à briser les os sous une armure.",
    type: "arme",
    tags: ["Arme de mêlée", "Contondant", "Une main"],
  },
  {
    name: "Marteau à deux mains",
    description: "Un marteau colossal qui écrase tout sur son passage, lent mais dévastateur.",
    type: "arme",
    tags: ["Arme de mêlée", "Contondant", "Deux mains"],
  },
  {
    name: "Bâton de combat",
    description: "Un long bâton de bois dur, arme humble mais redoutable entre des mains expérimentées.",
    type: "arme",
    tags: ["Arme de mêlée", "Contondant", "Deux mains"],
  },
  {
    name: "Fléau d'armes",
    description: "Une tête cloutée reliée par une chaîne à un manche, imprévisible et brutale.",
    type: "arme",
    tags: ["Arme de mêlée", "Contondant", "Une main"],
  },
  {
    name: "Fouet",
    description: "Une lanière de cuir tressée, plus utile pour désarmer ou entraver que pour tuer.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Une main"],
  },
  // Armes d'hast
  {
    name: "Lance",
    description: "Une longue hampe surmontée d'une pointe, idéale pour tenir un adversaire à distance.",
    type: "arme",
    tags: ["Arme de mêlée", "Perforant", "Deux mains"],
  },
  {
    name: "Hallebarde",
    description: "Une arme d'hast combinant une lame et une pointe, aussi utile pour frapper que pour désarçonner.",
    type: "arme",
    tags: ["Arme de mêlée", "Tranchant", "Perforant", "Deux mains"],
  },
  {
    name: "Pique",
    description: "Une longue perche destinée à tenir une ligne face à la cavalerie.",
    type: "arme",
    tags: ["Arme de mêlée", "Perforant", "Deux mains"],
  },
  {
    name: "Trident",
    description: "Une arme à trois pointes, aussi utile à la pêche qu'au combat.",
    type: "arme",
    tags: ["Arme de mêlée", "Perforant", "Deux mains"],
  },
  // Armes à distance
  {
    name: "Arc court",
    description: "Un arc léger et facile à manier, parfait pour la chasse ou les tirs rapprochés.",
    type: "arme",
    tags: ["Arme à distance", "Perforant", "Deux mains"],
  },
  {
    name: "Arc long",
    description: "Un arc puissant à la portée impressionnante, redoutable entre des mains entraînées.",
    type: "arme",
    tags: ["Arme à distance", "Perforant", "Deux mains"],
  },
  {
    name: "Arbalète légère",
    description: "Une arbalète compacte, rapide à recharger, prisée des éclaireurs.",
    type: "arme",
    tags: ["Arme à distance", "Perforant", "Deux mains"],
  },
  {
    name: "Arbalète lourde",
    description: "Une arbalète massive dont le carreau peut transpercer une armure de plates.",
    type: "arme",
    tags: ["Arme à distance", "Perforant", "Deux mains"],
  },
  {
    name: "Fronde",
    description: "Une simple lanière de cuir pour projeter des pierres, arme du berger comme du brigand.",
    type: "arme",
    tags: ["Arme à distance", "Contondant", "Une main"],
  },
  // Armures
  {
    name: "Armure de cuir",
    description: "Une armure souple en cuir bouilli, offrant une protection discrète sans gêner les mouvements.",
    type: "armure",
    tags: ["Armure légère"],
  },
  {
    name: "Armure de cuir clouté",
    description: "Du cuir renforcé de rivets métalliques, un compromis entre protection et mobilité.",
    type: "armure",
    tags: ["Armure légère"],
  },
  {
    name: "Cotte de mailles",
    description: "Un tissu d'anneaux de métal entrelacés, une protection éprouvée contre les lames.",
    type: "armure",
    tags: ["Armure moyenne"],
  },
  {
    name: "Armure d'écailles",
    description: "Des plaques métalliques cousues en rangs superposés, souples et résistantes.",
    type: "armure",
    tags: ["Armure moyenne"],
  },
  {
    name: "Brigandine",
    description: "Une veste de tissu doublée de plaques métalliques rivetées, portée par nombre de gardes.",
    type: "armure",
    tags: ["Armure moyenne"],
  },
  {
    name: "Armure de plates",
    description: "Une armure complète de plaques forgées, offrant une protection maximale au prix de la mobilité.",
    type: "armure",
    tags: ["Armure lourde"],
  },
  {
    name: "Casque en cuir",
    description: "Une coiffe de cuir renforcé, protection légère contre les coups portés à la tête.",
    type: "armure",
    tags: ["Armure légère"],
  },
  {
    name: "Heaume",
    description: "Un casque métallique enveloppant, offrant une protection quasi totale du visage.",
    type: "armure",
    tags: ["Armure lourde"],
  },
  {
    name: "Gantelets",
    description: "Des gants de métal articulés, protégeant les mains sans sacrifier la dextérité.",
    type: "armure",
    tags: ["Armure moyenne"],
  },
  {
    name: "Jambières",
    description: "Des protections de métal ou de cuir bouilli couvrant les tibias et les genoux.",
    type: "armure",
    tags: ["Armure moyenne"],
  },
  {
    name: "Bouclier rond",
    description: "Un bouclier léger en bois cerclé de métal, simple et polyvalent.",
    type: "armure",
    tags: ["Bouclier"],
  },
  {
    name: "Écu",
    description: "Un bouclier en forme de cerf-volant qui protège tout le flanc gauche du porteur.",
    type: "armure",
    tags: ["Bouclier"],
  },
  {
    name: "Pavois",
    description: "Un immense bouclier que l'on plante au sol, utilisé pour former un mur face aux tirs ennemis.",
    type: "armure",
    tags: ["Bouclier"],
  },
];

async function getOrCreateTagId(tagsRef, tagCache, name) {
  if (tagCache.has(name)) return tagCache.get(name);

  const existing = await tagsRef.where("name", "==", name).limit(1).get();
  if (!existing.empty) {
    const id = existing.docs[0].id;
    tagCache.set(name, id);
    return id;
  }

  const ref = tagsRef.doc();
  await ref.set({ name });
  tagCache.set(name, ref.id);
  return ref.id;
}

async function seed() {
  const tagsRef = db.collection("worldData").doc("tags").collection("items");
  const objectsRef = db.collection("worldData").doc("objects").collection("items");
  const tagCache = new Map();

  const existingObjects = await objectsRef.get();
  const existingNames = new Set(existingObjects.docs.map((d) => d.data().name));

  let created = 0;
  let skipped = 0;

  for (const item of ITEMS) {
    if (existingNames.has(item.name)) {
      skipped += 1;
      continue;
    }

    const tagIds = [];
    for (const tagName of item.tags) {
      tagIds.push(await getOrCreateTagId(tagsRef, tagCache, tagName));
    }

    await objectsRef.doc().set({
      name: item.name,
      description: item.description,
      rarity: "commun",
      type: item.type,
      tagIds,
    });
    created += 1;
  }

  console.log(`Weapons and armor seeded: ${created} created, ${skipped} skipped (already existed).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
